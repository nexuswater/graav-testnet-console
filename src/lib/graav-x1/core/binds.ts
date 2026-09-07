import { randomUUID } from 'node:crypto';
import { BIND_DOMAIN, BIND_TYPES, REVOKE_TYPES, X1 } from './config';
import { lock } from './db';
import { address, currentX, digest, hash32, need, nonce, verifySignature, wireTypedData } from './security';
import type { Binding, Context, Database, Hex, Sql, TypedData } from './types';

type Challenge = { nonce: Hex; x_user_id: string; wallet: `0x${string}`; purpose: 'BIND' | 'REVOKE'; bind_id: string | null; session_hash: string; revision: number; typed_data: TypedData; expires_at: number; used_at: number | null };
export async function activeBind(sql: Sql, column: 'x_user_id' | 'wallet', value: string): Promise<Binding | null> {
  // The column is an internal closed union, never user-provided SQL.
  const r = await sql.query<Binding>(`SELECT * FROM graav_x1.bindings WHERE chain_id=1449000 AND ${column}=$1 AND revoked_at IS NULL`, [value]);
  return r.rows[0] ?? null;
}
export class BindService {
  constructor(private db: Database, private now: () => number) {}
  async challenge(ctx: Context, walletInput: unknown, purpose: 'BIND' | 'REVOKE' = 'BIND') {
    const at = this.now(), x = currentX(ctx, at), wallet = address(walletInput);
    return this.db.transaction(async sql => {
      await lock(sql, [`x:${x.xUserId}`, `wallet:${wallet}`]);
      await sql.query('INSERT INTO graav_x1.subjects(x_user_id) VALUES ($1) ON CONFLICT DO NOTHING', [x.xUserId]);
      const current = await activeBind(sql, 'x_user_id', x.xUserId);
      const owner = await activeBind(sql, 'wallet', wallet);
      need(!owner || owner.x_user_id === x.xUserId, 'WALLET_ALREADY_BOUND', 409);
      if (purpose === 'REVOKE') need(current?.wallet === wallet, 'CURRENT_BOUND_WALLET_REQUIRED', 403);
      const revision = (await sql.query<{ revision: number }>('SELECT revision FROM graav_x1.subjects WHERE x_user_id=$1', [x.xUserId])).rows[0].revision;
      const challengeNonce = nonce(), expiresAt = at + X1.bindTtl;
      const message = { xUserId: x.xUserId, wallet, chainId: X1.chainId, nonce: challengeNonce, expiresAt };
      const typed: TypedData = purpose === 'BIND'
        ? { domain: BIND_DOMAIN, types: BIND_TYPES, primaryType: 'GRAAVBind', message }
        : { domain: BIND_DOMAIN, types: REVOKE_TYPES, primaryType: 'GRAAVRevoke', message: { ...message, bindId: current!.id } };
      await sql.query(`INSERT INTO graav_x1.challenges(nonce,x_user_id,wallet,purpose,bind_id,session_hash,revision,typed_data,created_at,expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`, [challengeNonce,x.xUserId,wallet,purpose,current?.id ?? null,digest(x.sessionId),revision,JSON.stringify(typed),at,expiresAt]);
      return { nonce: challengeNonce, expiresAt, typedData: wireTypedData(typed) };
    });
  }
  async confirm(ctx: Context, input: { nonce: unknown; wallet: unknown; signature: unknown }) {
    const at = this.now(), x = currentX(ctx, at), wallet = address(input.wallet), challengeNonce = hash32(input.nonce);
    return this.db.transaction(async sql => {
      await lock(sql, [`x:${x.xUserId}`, `wallet:${wallet}`]);
      const c = (await sql.query<Challenge>('SELECT * FROM graav_x1.challenges WHERE nonce=$1 FOR UPDATE', [challengeNonce])).rows[0];
      need(c, 'CHALLENGE_NOT_FOUND', 404);
      need(c.x_user_id === x.xUserId && c.session_hash === digest(x.sessionId), 'X_SESSION_MISMATCH', 403);
      need(c.wallet === wallet, 'WALLET_MISMATCH', 403);
      need(c.used_at === null, 'CHALLENGE_USED', 409);
      need(at < c.expires_at, 'CHALLENGE_EXPIRED', 410);
      const revision = (await sql.query<{revision:number}>('SELECT revision FROM graav_x1.subjects WHERE x_user_id=$1', [x.xUserId])).rows[0].revision;
      need(c.revision === revision, 'CHALLENGE_SUPERSEDED', 409);
      const signature = await verifySignature(c.typed_data, input.signature, wallet);
      const current = await activeBind(sql, 'x_user_id', x.xUserId);
      const owner = await activeBind(sql, 'wallet', wallet);
      need(!owner || owner.x_user_id === x.xUserId, 'WALLET_ALREADY_BOUND', 409);
      if (c.purpose === 'REVOKE') need(current?.id === c.bind_id && current.wallet === wallet, 'BIND_CHANGED', 409);
      // Check time again after signature recovery and any lock wait; persisted binding has no expiry.
      need(this.now() < c.expires_at, 'CHALLENGE_EXPIRED', 410);
      currentX(ctx, this.now());
      if (current) await sql.query('UPDATE graav_x1.bindings SET revoked_at=$1,revoke_reason=$2,revoke_proof=$3::jsonb WHERE id=$4', [at,c.purpose === 'REVOKE' ? 'USER_REVOKED' : 'REBOUND',JSON.stringify({typedData:c.typed_data,signature}),current.id]);
      let binding: Binding | null = null;
      if (c.purpose === 'BIND') {
        const id = randomUUID();
        const r = await sql.query<Binding>(`INSERT INTO graav_x1.bindings(id,x_user_id,wallet,handle,nonce,signature,typed_data,bound_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) RETURNING *`, [id,x.xUserId,wallet,x.handle,c.nonce,signature,JSON.stringify(c.typed_data),at]);
        binding = r.rows[0];
      }
      await sql.query('UPDATE graav_x1.challenges SET used_at=$1 WHERE nonce=$2', [at,c.nonce]);
      await sql.query('UPDATE graav_x1.subjects SET revision=revision+1 WHERE x_user_id=$1', [x.xUserId]);
      return { bound: binding !== null, binding: binding ? { id: binding.id, wallet: binding.wallet, boundAt: binding.bound_at } : null };
    });
  }
  async status(ctx: Context) {
    const x = currentX(ctx, this.now()), binding = await activeBind(this.db, 'x_user_id', x.xUserId);
    const wallet = binding ? address(binding.wallet) : null;
    return { x: { xUserId: x.xUserId, handle: x.handle }, binding: binding ? { id: binding.id, wallet, boundAt: binding.bound_at } : null };
  }
}
