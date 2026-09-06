import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getAddress, recoverTypedDataAddress } from 'viem';
import { EIP712_DOMAIN_FIELDS } from './config';
import type { Address, Context, Hex, Identity, TypedData } from './types';

export class X1Error extends Error { constructor(public code: string, public status = 400) { super(code); } }
export function need(value: unknown, code: string, status = 400): asserts value { if (!value) throw new X1Error(code, status); }
export function xId(value: unknown): string { need(typeof value === 'string' && /^[1-9][0-9]{0,31}$/.test(value), 'BAD_X_ID'); return value; }
export function address(value: unknown): Address {
  need(typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value), 'BAD_WALLET');
  need(!/^0x0{40}$/i.test(value), 'ZERO_WALLET');
  return getAddress(value.toLowerCase()).toLowerCase() as Address;
}
export function hash32(value: unknown): Hex { need(typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value), 'BAD_HASH'); return value.toLowerCase() as Hex; }
export function uuid(value: unknown): string { need(typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value), 'BAD_UUID'); return value; }
export function opaque(): string { return randomBytes(24).toString('base64url'); }
export function nonce(): Hex { return `0x${randomBytes(32).toString('hex')}`; }
export function digest(value: string): string { return createHash('sha256').update(value).digest('hex'); }
export function currentX(ctx: Context, now: number): Identity {
  need(ctx.x && Number.isSafeInteger(ctx.x.expiresAt) && ctx.x.expiresAt > now, 'X_LOGIN_REQUIRED', 401);
  xId(ctx.x.xUserId); need(ctx.x.sessionId, 'X_SESSION_REQUIRED', 401); return ctx.x;
}
export function optionalX(ctx: Context, now: number): Identity | null { return ctx.x && ctx.x.expiresAt > now ? currentX(ctx, now) : null; }
/** EOA-only v1: enforce canonical 65-byte r,s,v before recovery. */
export async function verifySignature(typed: TypedData, signature: unknown, wallet: Address): Promise<Hex> {
  need(typeof signature === 'string' && /^0x[0-9a-fA-F]{130}$/.test(signature), 'BAD_SIGNATURE');
  const r = BigInt(`0x${signature.slice(2, 66)}`), s = BigInt(`0x${signature.slice(66, 130)}`);
  const order = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
  const v = Number.parseInt(signature.slice(130), 16);
  need(r > 0n && r < order && s > 0n && s <= order / 2n && (v === 27 || v === 28), 'NON_CANONICAL_SIGNATURE');
  try {
    const recovered = await recoverTypedDataAddress({ ...typed, signature: signature as Hex });
    need(address(recovered) === wallet, 'SIGNER_MISMATCH', 403);
  } catch (error) { if (error instanceof X1Error) throw error; throw new X1Error('BAD_SIGNATURE'); }
  return signature.toLowerCase() as Hex;
}
export function wireTypedData(typed: TypedData): TypedData { return { ...typed, types: { EIP712Domain: EIP712_DOMAIN_FIELDS, ...typed.types } }; }

/** Dedicated, scoped anonymous visitor cookie. It never authenticates X. */
export function visitorCookie(secret: string, now: number, token?: string): { token: string; visitorId: string } {
  need(secret.length >= 32, 'VISITOR_SECRET_REQUIRED', 503);
  const mac = (s: string) => createHmac('sha256', secret).update(`graav-x1-visitor-v1:${s}`).digest('base64url');
  if (token && token.length < 500) {
    const [id, rawExpiry, sig, extra] = token.split('.');
    const expiry = Number(rawExpiry), expected = mac(`${id}.${rawExpiry}`);
    if (!extra && /^[A-Za-z0-9_-]{32}$/.test(id ?? '') && Number.isSafeInteger(expiry) && expiry > now && expiry <= now + 2592000 && sig?.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { token, visitorId: digest(id) };
    }
  }
  const id = opaque(), payload = `${id}.${now + 2592000}`;
  return { token: `${payload}.${mac(payload)}`, visitorId: digest(id) };
}
