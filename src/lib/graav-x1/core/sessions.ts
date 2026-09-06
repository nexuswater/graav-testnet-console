import { randomUUID } from 'node:crypto';
import { keccak256 } from 'viem';
import { activeBind } from './binds';
import { ORDER_DOMAIN, ORDER_TYPES, X1 } from './config';
import { lock } from './db';
import { validateQuote, verifyBuyEvidence } from './evidence';
import { attributionPolicy, feeSplit } from './policy';
import { address, currentX, hash32, need, nonce, opaque, optionalX, uuid, verifySignature, wireTypedData, X1Error } from './security';
import type { Context, Database, Gateway, Hex, Order, Sql, Touch, TypedData } from './types';

type Session = { id: string; via: string | null; created_at: number; expires_at: number; action: 'BUY' };
export function intentFor(order: Order): TypedData {
  return { domain: ORDER_DOMAIN, types: ORDER_TYPES, primaryType: 'GRAAVBuyIntent', message: {
    sessionId: order.session_id, orderId: order.id, wallet: order.wallet, chainId: X1.chainId,
    market: X1.market, token: X1.token, destination: order.quote.to, amountWei: X1.amountWei,
    minOut: order.quote.minOut, calldataHash: keccak256(order.quote.data),
    transactionNonce: order.quote.transactionNonce, nonce: order.nonce, expiresAt: order.expires_at,
  } };
}
function publicOrder(o: Order) {
  return { id: o.id, sessionId: o.session_id, wallet: o.wallet, status: o.status, expiresAt: o.expires_at,
    txHash: o.tx_hash, explorerUrl: o.tx_hash ? `${X1.explorer}/tx/${o.tx_hash}` : null,
    evidence: o.evidence, creditReason: o.credit_reason,
    feeSplit: o.status === 'COMPLETE' ? feeSplit(X1.amountWei, o.credit_reason === 'ELIGIBLE') : null,
    transaction: { from: o.wallet, chainId: X1.chainId, to: o.quote.to, data: o.quote.data,
      value: `0x${BigInt(X1.amountWei).toString(16)}`, nonce: `0x${o.quote.transactionNonce.toString(16)}` },
    minOut: o.quote.minOut,
    session: { via: o.touch?.via ?? null, attributionId: o.touch?.id ?? null, buyerMustBind: false as const },
    intent: wireTypedData(intentFor(o)),
  };
}
export class SessionService {
  private publicOrigin:string;
  constructor(private db: Database, private gateway: Gateway, private now: () => number, publicOrigin:string=X1.origin) {
    const url=new URL(publicOrigin);
    need(url.protocol==='https:' || ['localhost','127.0.0.1'].includes(url.hostname),'HTTPS_ORIGIN_REQUIRED',503);
    this.publicOrigin=url.origin;
  }
  async mint(ctx: Context, input: { action: unknown; market: unknown; amountWei: unknown; share?: unknown }) {
    need(input.action === 'BUY', 'ACTION_NOT_ALLOWED');
    need(address(input.market) === address(X1.market), 'MARKET_NOT_ALLOWED');
    need(input.amountWei === X1.amountWei, 'AMOUNT_NOT_ALLOWED');
    need(input.share === undefined || typeof input.share === 'boolean', 'BAD_SHARE_FLAG');
    const at = this.now(), x = optionalX(ctx, at);
    let via: string | null = null;
    if (input.share === true) {
      const owner = currentX(ctx, at);
      need(await activeBind(this.db, 'x_user_id', owner.xUserId), 'DISTRIBUTOR_BIND_REQUIRED', 403);
      via = owner.xUserId;
    }
    const id = opaque(), expiresAt = at + X1.linkTtl;
    await this.db.query(`INSERT INTO graav_x1.sessions(id,action,chain_id,market,token,amount_wei,created_by_x_user_id,via,created_at,expires_at)
      VALUES ($1,'BUY',1449000,$2,$3,$4,$5,$6,$7,$8)`, [id,address(X1.market),address(X1.token),X1.amountWei,x?.xUserId ?? null,via,at,expiresAt]);
    const url = `${this.publicOrigin}/s/${id}`;
    return { id, url, shareUrl: via ? `${url}?via=${via}` : null, expiresAt, action: 'BUY', market: X1.market,
      amountWei: X1.amountWei, session: { via, attributionId: null, buyerMustBind: false } };
  }
  private async session(sql: Sql, id: string, requireFresh = true): Promise<Session> {
    need(/^[A-Za-z0-9_-]{32}$/.test(id), 'SESSION_NOT_FOUND', 404);
    const s = (await sql.query<Session>('SELECT * FROM graav_x1.sessions WHERE id=$1', [id])).rows[0];
    need(s, 'SESSION_NOT_FOUND', 404);
    if (requireFresh) need(this.now() < s.expires_at, 'SESSION_EXPIRED', 410);
    return s;
  }
  async getSession(id: string) {
    const s = await this.session(this.db,id);
    return { id:s.id, action:'BUY', amountWei:X1.amountWei, market:X1.market, token:X1.token,
      chainId:X1.chainId, expiresAt:s.expires_at, session:{via:s.via,attributionId:null,buyerMustBind:false} };
  }
  /** Called for an actual opened link. Only an explicit query value creates a new last touch. */
  async touch(ctx: Context, id: string, input: { via?: unknown; idempotencyKey: unknown }) {
    const key = uuid(input.idempotencyKey);
    return this.db.transaction(async sql => {
      await lock(sql,[`visitor:${ctx.visitorId}`]);
      await this.session(sql,id); // Unknown/expired IDs cannot poison attribution.
      if (input.via === undefined) return { recorded:false, reason:'NO_NEW_TOUCH' };
      const existing = (await sql.query<Touch & {session_id:string}>('SELECT * FROM graav_x1.touches WHERE visitor_id=$1 AND idempotency_key=$2', [ctx.visitorId,key])).rows[0];
      if (existing) { need(existing.session_id===id,'IDEMPOTENCY_CONFLICT',409); return { recorded:true, attributionId:existing.id }; }
      const via = typeof input.via === 'string' && /^[1-9][0-9]{0,31}$/.test(input.via) ? input.via : null;
      const binding = via ? await activeBind(sql,'x_user_id',via) : null;
      const at = this.now(), touchId = randomUUID(), reason = !via ? 'INVALID_VIA' : !binding ? 'UNBOUND_VIA' : 'CANDIDATE';
      await sql.query(`INSERT INTO graav_x1.touches(id,visitor_id,session_id,idempotency_key,via,bind_id,wallet,touched_at,expires_at,reason)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [touchId,ctx.visitorId,id,key,via,binding?.id ?? null,binding?.wallet ?? null,at,at+X1.touchTtl,reason]);
      return { recorded:true, attributionId:touchId };
    });
  }
  async prepare(ctx: Context, id: string, input: { wallet: unknown; idempotencyKey: unknown }) {
    await this.session(this.db,id);
    const wallet = address(input.wallet), key = uuid(input.idempotencyKey), at = this.now();
    const x = optionalX(ctx,at);
    const existing = (await this.db.query<Order>('SELECT * FROM graav_x1.orders WHERE visitor_id=$1 AND idempotency_key=$2', [ctx.visitorId,key])).rows[0];
    if (existing) { need(existing.wallet===wallet && existing.session_id===id,'IDEMPOTENCY_CONFLICT',409); return publicOrder(existing); }
    const quote = await this.gateway.quoteBuy(wallet,at);
    validateQuote(quote,this.now()); // No guessed ABI or fallback calldata.
    return this.db.transaction(async sql => {
      await lock(sql,[`visitor:${ctx.visitorId}`]);
      await this.session(sql,id);
      const previous = (await sql.query<Order>('SELECT * FROM graav_x1.orders WHERE visitor_id=$1 AND idempotency_key=$2', [ctx.visitorId,key])).rows[0];
      if (previous) { need(previous.wallet===wallet && previous.session_id===id,'IDEMPOTENCY_CONFLICT',409); return publicOrder(previous); }
      const touch = (await sql.query<Touch>('SELECT id,via,bind_id,wallet,touched_at,expires_at,reason FROM graav_x1.touches WHERE visitor_id=$1 ORDER BY seq DESC LIMIT 1', [ctx.visitorId])).rows[0] ?? null;
      const buyerBind = await activeBind(sql,'wallet',wallet);
      const buyerX = x?.xUserId ?? buyerBind?.x_user_id ?? null;
      const orderId = randomUUID();
      const r = await sql.query<Order>(`INSERT INTO graav_x1.orders(id,session_id,visitor_id,idempotency_key,wallet,buyer_x_user_id,quote,nonce,transaction_nonce,created_at,expires_at,touch)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12::jsonb) RETURNING *`, [orderId,id,ctx.visitorId,key,wallet,buyerX,JSON.stringify(quote),nonce(),quote.transactionNonce,at,quote.expiresAt,JSON.stringify(touch)]);
      return publicOrder(r.rows[0]);
    });
  }
  private async ownedOrder(sql: Sql, ctx: Context, orderId: string, forUpdate = false): Promise<Order> {
    uuid(orderId);
    const o = (await sql.query<Order>(`SELECT * FROM graav_x1.orders WHERE id=$1${forUpdate ? ' FOR UPDATE' : ''}`, [orderId])).rows[0];
    need(o && o.visitor_id === ctx.visitorId,'ORDER_NOT_FOUND',404); return o;
  }
  async getOrder(ctx: Context, id: string) { return publicOrder(await this.ownedOrder(this.db,ctx,id)); }
  async authorize(ctx: Context, id: string, signature: unknown) {
    const initial = await this.ownedOrder(this.db,ctx,id);
    const canonicalSig = await verifySignature(intentFor(initial),signature,initial.wallet);
    return this.db.transaction(async sql => {
      await lock(sql,[`wallet:${initial.wallet}`]);
      const o = await this.ownedOrder(sql,ctx,id,true), at = this.now();
      if (o.authorized_at !== null) { need(o.intent_signature===canonicalSig,'ORDER_ALREADY_AUTHORIZED',409); return publicOrder(o); }
      need(o.status === 'PREPARED' && at < o.expires_at,'ORDER_EXPIRED',410);
      // Signed but never-submitted expired orders must not permanently lock a wallet nonce.
      await sql.query("UPDATE graav_x1.orders SET status='EXPIRED' WHERE wallet=$1 AND status='AUTHORIZED' AND tx_hash IS NULL AND expires_at<$2", [o.wallet,at]);
      const reserved = (await sql.query('SELECT id FROM graav_x1.orders WHERE wallet=$1 AND transaction_nonce=$2 AND authorized_at IS NOT NULL AND status<>\'EXPIRED\'', [o.wallet,o.quote.transactionNonce])).rows[0];
      need(!reserved,'WALLET_NONCE_RESERVED',409);
      await sql.query("UPDATE graav_x1.orders SET status='AUTHORIZED',intent_signature=$1,authorized_at=$2 WHERE id=$3", [canonicalSig,at,id]);
      return publicOrder({...o,status:'AUTHORIZED',intent_signature:canonicalSig,authorized_at:at});
    });
  }
  /** Register a wallet-returned hash even after expiry, so receipt recovery never needs a second spend. */
  async submitted(ctx: Context, id: string, hashInput: unknown) {
    const hash = hash32(hashInput);
    return this.db.transaction(async sql => {
      const o = await this.ownedOrder(sql,ctx,id,true);
      need(o.authorized_at !== null,'ORDER_NOT_AUTHORIZED',403);
      need(o.status !== 'EXPIRED','ORDER_EXPIRED',410);
      if (o.tx_hash) { need(o.tx_hash===hash,'TX_HASH_ALREADY_LOCKED',409); return publicOrder(o); }
      const collision = (await sql.query('SELECT id FROM graav_x1.orders WHERE tx_hash=$1',[hash])).rows[0];
      need(!collision,'TX_ALREADY_CLAIMED',409);
      await sql.query("UPDATE graav_x1.orders SET status='SUBMITTED',tx_hash=$1 WHERE id=$2",[hash,id]);
      return publicOrder({...o,status:'SUBMITTED',tx_hash:hash});
    });
  }
  async confirm(ctx: Context, id: string) {
    const o = await this.ownedOrder(this.db,ctx,id);
    need(o.authorized_at !== null && o.tx_hash,'ORDER_NOT_SUBMITTED',409);
    if (['COMPLETE','FAILED','REVIEW_REQUIRED'].includes(o.status)) return publicOrder(o);
    const observation = await this.gateway.observe(o.tx_hash);
    if (!observation) return { ...publicOrder(o), pending:true };
    let evidence;
    try { evidence = verifyBuyEvidence(o,o.tx_hash,observation); }
    catch (e) {
      if (e instanceof X1Error && e.status === 202) return {...publicOrder(o),pending:true};
      if (!(e instanceof X1Error)) throw e;
      // Do not turn RPC mismatch/reorg or ordinary wait conditions into an irreversible failure.
      if (['NON_CANONICAL_BLOCK','WRONG_CHAIN','BLOCK_MISMATCH','HASH_MISMATCH'].includes(e.code)) throw e;
      const status = e.code === 'TX_REVERTED' ? 'FAILED' : 'REVIEW_REQUIRED';
      await this.db.query("UPDATE graav_x1.orders SET status=$1,credit_reason=$2 WHERE id=$3 AND status='SUBMITTED'",[status,e.code,id]);
      return this.getOrder(ctx,id);
    }
    let creatorAtExecution: `0x${string}`|null=null;
    try { creatorAtExecution=await this.gateway.creatorAt(evidence.blockNumber); }
    catch { /* Missing creator proof suppresses rewards; a verified BUY remains completable. */ }
    return this.db.transaction(async sql => {
      // Serialize settlement with rebind/revoke and last moment known buyer binding changes.
      await lock(sql,[`wallet:${o.wallet}`,...(o.touch?.via ? [`x:${o.touch.via}`] : [])]);
      const fresh = await this.ownedOrder(sql,ctx,id,true);
      if (fresh.status === 'COMPLETE') return publicOrder(fresh);
      need(fresh.status === 'SUBMITTED' && fresh.tx_hash === evidence.txHash,'ORDER_CHANGED',409);
      const binding = fresh.touch?.via ? await activeBind(sql,'x_user_id',fresh.touch.via) : null;
      const buyerBind = await activeBind(sql,'wallet',fresh.wallet);
      const buyerXNow = optionalX(ctx,this.now())?.xUserId ?? buyerBind?.x_user_id ?? null;
      const knownSelf = fresh.touch?.via && (fresh.buyer_x_user_id===fresh.touch.via || buyerXNow===fresh.touch.via);
      const reason = attributionPolicy({action:'BUY',touch:fresh.touch,binding,buyerWallet:fresh.wallet,
        buyerX:knownSelf ? fresh.touch!.via : fresh.buyer_x_user_id ?? buyerXNow,creator:creatorAtExecution,executedAt:evidence.blockTimestamp});
      if (reason === 'ELIGIBLE') {
        const split = feeSplit(X1.amountWei,true);
        await sql.query(`INSERT INTO graav_x1.ledger(id,order_id,tx_hash,kind,distributor_x_user_id,distributor_wallet,buyer_wallet,market,funded_amount_wei,amount_wei,bps,evidence,created_at)
          VALUES ($1,$2,$3,'CREDIT',$4,$5,$6,$7,$8,$9,15,$10::jsonb,$11)`, [randomUUID(),id,evidence.txHash,fresh.touch!.via,fresh.touch!.wallet,fresh.wallet,address(X1.market),X1.amountWei,split.distributorWei,JSON.stringify(evidence),this.now()]);
      }
      await sql.query("UPDATE graav_x1.orders SET status='COMPLETE',evidence=$1::jsonb,credit_reason=$2 WHERE id=$3",[JSON.stringify(evidence),reason,id]);
      return publicOrder({...fresh,status:'COMPLETE',evidence,credit_reason:reason});
    });
  }
  async rewards(ctx: Context) {
    const x = currentX(ctx,this.now());
    const rows = (await this.db.query<{id:string;kind:string;amount_wei:string;distributor_wallet:string;tx_hash:Hex;created_at:number}>('SELECT id,kind,amount_wei,distributor_wallet,tx_hash,created_at FROM graav_x1.ledger WHERE distributor_x_user_id=$1 ORDER BY created_at DESC LIMIT 100',[x.xUserId])).rows;
    const total = (await this.db.query<{total:string}>('SELECT COALESCE(sum(amount_wei),0)::text AS total FROM graav_x1.ledger WHERE distributor_x_user_id=$1',[x.xUserId])).rows[0].total;
    return { xUserId:x.xUserId, balanceWei:total, accounting:'TESTNET_OFFCHAIN', claimEnabled:false,
      entries:rows.map(r=>({...r,explorerUrl:`${X1.explorer}/tx/${r.tx_hash}`})) };
  }
}
