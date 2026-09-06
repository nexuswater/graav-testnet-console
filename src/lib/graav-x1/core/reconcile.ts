import { randomUUID } from 'node:crypto';
import { X1 } from './config';
import { need } from './security';
import type { Database, Gateway, Order } from './types';

/** Invoke from an authenticated internal worker. It never transfers value or rewrites a credit. */
export async function reconcileCredit(db: Database, gateway: Gateway, orderId: string, now: number) {
  const order = (await db.query<Order>("SELECT * FROM graav_x1.orders WHERE id=$1",[orderId])).rows[0];
  need(order?.evidence,'COMPLETED_ORDER_REQUIRED',404);
  if(order.credit_reason==='REORG_REVERSED')return {reversed:true,reason:'ALREADY_REVERSED'};
  need(order.status==='COMPLETE','COMPLETED_ORDER_REQUIRED',409);
  const canonical = await gateway.canonicalBlock(order.evidence.blockNumber);
  if(canonical.hash.toLowerCase()===order.evidence.blockHash.toLowerCase()) return {reversed:false,reason:'CANONICAL'};
  need(canonical.head>=order.evidence.blockNumber+X1.confirmations-1,'WAIT_CONFIRMATIONS',202);
  return db.transaction(async sql => {
    await sql.query('SELECT id FROM graav_x1.orders WHERE id=$1 FOR UPDATE',[orderId]);
    const credit = (await sql.query<{tx_hash:string;distributor_x_user_id:string;distributor_wallet:string;buyer_wallet:string;market:string;funded_amount_wei:string;amount_wei:string}>("SELECT * FROM graav_x1.ledger WHERE order_id=$1 AND kind='CREDIT'",[orderId])).rows[0];
    if(!credit) return {reversed:false,reason:'NO_CREDIT'};
    const evidence = {reason:'REORG',previous:order.evidence,canonicalBlockHash:canonical.hash};
    await sql.query(`INSERT INTO graav_x1.ledger(id,order_id,tx_hash,kind,distributor_x_user_id,distributor_wallet,buyer_wallet,market,funded_amount_wei,amount_wei,bps,evidence,created_at)
      VALUES ($1,$2,$3,'REVERSAL',$4,$5,$6,$7,$8,$9,15,$10::jsonb,$11) ON CONFLICT (order_id,kind) DO NOTHING`,[randomUUID(),orderId,credit.tx_hash,credit.distributor_x_user_id,credit.distributor_wallet,credit.buyer_wallet,credit.market,credit.funded_amount_wei,(-BigInt(credit.amount_wei)).toString(),JSON.stringify(evidence),now]);
    await sql.query("UPDATE graav_x1.orders SET status='REVIEW_REQUIRED',credit_reason='REORG_REVERSED' WHERE id=$1",[orderId]);
    return {reversed:true,reason:'REORG'};
  });
}
