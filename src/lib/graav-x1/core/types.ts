export type Address = `0x${string}`;
export type Hex = `0x${string}`;
export type Identity = { xUserId: string; handle: string | null; sessionId: string; expiresAt: number };
/** Populated ONLY by authenticated server adapters, never request JSON. */
export type Context = { visitorId: string; x: Identity | null };
export type Sql = { query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }> };
export type Database = Sql & { transaction<T>(work: (sql: Sql) => Promise<T>): Promise<T> };
export type Binding = {
  id: string; x_user_id: string; wallet: Address; chain_id: number; handle: string | null;
  nonce: Hex; signature: Hex; typed_data: unknown; bound_at: number; revoked_at: number | null;
};
export type Touch = {
  id: string; via: string | null; bind_id: string | null; wallet: Address | null;
  touched_at: number; expires_at: number; reason: string;
};
export type Quote = {
  to: Address; data: Hex; minOut: string; transactionNonce: number; preparedBlock: number;
  expiresAt: number; creator: Address | null;
};
export type Order = {
  id: string; session_id: string; visitor_id: string; wallet: Address; buyer_x_user_id: string | null;
  quote: Quote; nonce: Hex; created_at: number; expires_at: number; touch: Touch | null;
  intent_signature: Hex | null; authorized_at: number | null; tx_hash: Hex | null;
  status: 'PREPARED' | 'AUTHORIZED' | 'SUBMITTED' | 'COMPLETE' | 'FAILED' | 'REVIEW_REQUIRED' | 'EXPIRED';
  evidence: Evidence | null; credit_reason: string | null;
};
export type Observation = {
  chainId: number;
  tx: { hash: Hex; from: Address; to: Address; value: string; input: Hex; nonce: number; chainId: number; blockHash: Hex; blockNumber: number };
  receipt: { transactionHash: Hex; from: Address; to: Address; status: 'success' | 'reverted'; blockHash: Hex; blockNumber: number };
  block: { hash: Hex; number: number; timestamp: number }; head: number;
  transfers: { token: Address; from: Address; to: Address; value: string; removed: boolean }[];
};
export type Evidence = { txHash: Hex; blockHash: Hex; blockNumber: number; blockTimestamp: number; tokensOut: string };
export type Gateway = {
  quoteBuy(wallet: Address, now: number): Promise<Quote>;
  observe(hash: Hex): Promise<Observation | null>;
  canonicalBlock(number: number): Promise<{ hash: Hex; head: number }>;
  creatorAt(number: number): Promise<Address|null>;
};
export type TypedData = {
  domain: { name: string; version: string; chainId: number; verifyingContract: Address };
  primaryType: string; types: Record<string, readonly { readonly name: string; readonly type: string }[]>;
  message: Record<string, string | number>;
};
