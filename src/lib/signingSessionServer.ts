/**
 * Server-only signing session: HMAC opaque id + best-effort status Map.
 * Do not import from client components.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { isAddress } from "viem";
import {
  validateAllowlist,
  normAddr,
  RLUSD_CLONE_FACTORY_ADDRESS,
  RLUSD_CLONE_CURVE_ADDRESS,
  RLUSD_CLONE_COIN_ADDRESS,
  type SessionAction,
  SESSION_CHAIN_ID,
} from "@/lib/sessionAllowlist";
import {
  SESSION_DEFAULT_TTL_SEC,
  SESSION_MAX_TTL_SEC,
  sessionPublicUrl,
  type PublicSessionView,
  type SessionStatus,
  type SigningSessionPayload,
} from "@/lib/signingSession";

type StoredStatus = {
  status: "signed";
  txHash: string;
  at: number;
};

/** Best-effort across serverless instances; signed ids remain self-validating. */
const statusById = new Map<string, StoredStatus>();

function sessionSecret(): string {
  return (
    process.env.SESSION_SIGNING_SECRET?.trim() ||
    process.env.X_SESSION_SECRET?.trim() ||
    "graav-signing-session-dev-only"
  );
}

function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function hmac(payloadB64: string): string {
  return base64Url(
    createHmac("sha256", sessionSecret()).update(payloadB64).digest()
  );
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function isKnownRlusdCloneAddress(addr: string): boolean {
  const known = [RLUSD_CLONE_FACTORY_ADDRESS, RLUSD_CLONE_CURVE_ADDRESS, RLUSD_CLONE_COIN_ADDRESS];
  return known.some((candidate) => normAddr(candidate) === normAddr(addr));
}

function isValidBoundAddress(addr: string): boolean {
  return isAddress(addr) || (isKnownRlusdCloneAddress(addr) && isAddress(addr, { strict: false }));
}

const ACTIONS: SessionAction[] = ["buy", "sell", "swap", "create"];

export function createNonce(): string {
  return base64Url(randomBytes(12));
}

export type CreateSessionInput = {
  chainId?: number;
  factory: string;
  market?: string;
  dex?: string;
  token?: string;
  action: SessionAction;
  amount?: string;
  minOut?: string;
  /** unix seconds or omit for default TTL */
  expiry?: number;
  /** ttl seconds from now if expiry omitted */
  ttlSec?: number;
  nonce?: string;
  createName?: string;
  createSymbol?: string;
  metadataURI?: string;
  swapSide?: "xrpToToken" | "tokenToXrp";
  /** Reply-track attribution (all optional) */
  originTweetId?: string;
  replyTweetId?: string;
  dmConversationId?: string;
  buyerXUserId?: string;
  verifiedBuyTx?: string;
};

export function buildPayload(
  input: CreateSessionInput
): { ok: true; payload: SigningSessionPayload } | { ok: false; error: string } {
  const action = input.action;
  if (!ACTIONS.includes(action)) {
    return { ok: false, error: "action must be buy|sell|swap|create" };
  }
  const chainId = input.chainId ?? SESSION_CHAIN_ID;
  const factory = (input.factory || "").trim();
  const market = input.market?.trim() || undefined;
  const dex = input.dex?.trim() || undefined;
  const token = input.token?.trim() || undefined;

  const allowErr = validateAllowlist({
    chainId,
    factory,
    market,
    dex,
    action,
  });
  if (allowErr) return { ok: false, error: allowErr };

  if (factory && !isValidBoundAddress(factory)) {
    return { ok: false, error: "factory must be a valid address" };
  }
  if (market && !isValidBoundAddress(market)) {
    return { ok: false, error: "market must be a valid address" };
  }
  if (dex && !isValidBoundAddress(dex)) {
    return { ok: false, error: "dex must be a valid address" };
  }
  if (token && !isValidBoundAddress(token)) {
    return { ok: false, error: "token must be a valid address" };
  }

  if (action === "create") {
    const sym = (input.createSymbol || "").trim();
    const name = (input.createName || "").trim();
    if (!sym || !name) {
      return { ok: false, error: "create requires createName and createSymbol" };
    }
  }

  const now = Math.floor(Date.now() / 1000);
  let expiry = input.expiry;
  if (expiry == null) {
    const ttl = Math.min(
      Math.max(1, input.ttlSec ?? SESSION_DEFAULT_TTL_SEC),
      SESSION_MAX_TTL_SEC
    );
    expiry = now + ttl;
  }
  if (expiry <= now) {
    return { ok: false, error: "expiry must be in the future" };
  }
  if (expiry > now + SESSION_MAX_TTL_SEC) {
    return { ok: false, error: `expiry max TTL is ${SESSION_MAX_TTL_SEC}s` };
  }

  const amount = (input.amount ?? (action === "create" ? "0" : "")).trim();
  if (action !== "create" && !amount) {
    return { ok: false, error: "amount required" };
  }
  const minOut = (input.minOut ?? "0").trim();

  const payload: SigningSessionPayload = {
    chainId,
    factory,
    market,
    dex,
    token,
    action,
    amount,
    minOut,
    expiry,
    nonce: (input.nonce || createNonce()).trim(),
    createName: input.createName?.trim() || undefined,
    createSymbol: input.createSymbol?.trim() || undefined,
    metadataURI: input.metadataURI?.trim() || undefined,
    swapSide: input.swapSide,
    originTweetId: input.originTweetId?.trim() || undefined,
    replyTweetId: input.replyTweetId?.trim() || undefined,
    dmConversationId: input.dmConversationId?.trim() || undefined,
    buyerXUserId: input.buyerXUserId?.trim() || undefined,
    verifiedBuyTx: input.verifiedBuyTx?.trim() || undefined,
  };
  return { ok: true, payload };
}

export function encodeSessionId(payload: SigningSessionPayload): string {
  const payloadB64 = base64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = hmac(payloadB64);
  return `s1.${payloadB64}.${sig}`;
}

export function decodeSessionId(
  id: string
):
  | { ok: true; payload: SigningSessionPayload }
  | { ok: false; error: string } {
  const parts = id.split(".");
  if (parts.length !== 3 || parts[0] !== "s1") {
    return { ok: false, error: "invalid session id format" };
  }
  const [, payloadB64, sig] = parts;
  if (!payloadB64 || !sig || !safeEqual(hmac(payloadB64), sig)) {
    return { ok: false, error: "invalid session signature" };
  }
  let payload: SigningSessionPayload;
  try {
    payload = JSON.parse(
      fromBase64Url(payloadB64).toString("utf8")
    ) as SigningSessionPayload;
  } catch {
    return { ok: false, error: "invalid session payload" };
  }
  const allowErr = validateAllowlist({
    chainId: payload.chainId,
    factory: payload.factory,
    market: payload.market,
    dex: payload.dex,
    action: payload.action,
  });
  if (allowErr) return { ok: false, error: allowErr };
  return { ok: true, payload };
}

function deriveStatus(
  id: string,
  payload: SigningSessionPayload
): { status: SessionStatus; txHash?: string } {
  const now = Math.floor(Date.now() / 1000);
  if (payload.expiry <= now) return { status: "expired" };
  const stored = statusById.get(id);
  if (stored?.status === "signed") {
    return { status: "signed", txHash: stored.txHash };
  }
  return { status: "pending" };
}

export function getPublicSession(
  id: string,
  origin?: string
): PublicSessionView {
  const decoded = decodeSessionId(id);
  if (!decoded.ok) {
    return {
      id,
      status: "invalid",
      payload: null,
      error: decoded.error,
      url: sessionPublicUrl(id, origin),
    };
  }
  const { status, txHash } = deriveStatus(id, decoded.payload);
  return {
    id,
    status,
    payload: decoded.payload,
    txHash,
    url: sessionPublicUrl(id, origin),
  };
}

export function markSessionSigned(
  id: string,
  txHash: string
): PublicSessionView {
  const decoded = decodeSessionId(id);
  if (!decoded.ok) {
    return {
      id,
      status: "invalid",
      payload: null,
      error: decoded.error,
      url: sessionPublicUrl(id),
    };
  }
  const now = Math.floor(Date.now() / 1000);
  if (decoded.payload.expiry <= now) {
    return {
      id,
      status: "expired",
      payload: decoded.payload,
      error: "session expired",
      url: sessionPublicUrl(id),
    };
  }
  const hash = txHash.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return {
      id,
      status: "pending",
      payload: decoded.payload,
      error: "invalid txHash",
      url: sessionPublicUrl(id),
    };
  }
  statusById.set(id, { status: "signed", txHash: hash, at: now });
  return {
    id,
    status: "signed",
    payload: decoded.payload,
    txHash: hash,
    url: sessionPublicUrl(id),
  };
}

export function createSession(
  input: CreateSessionInput,
  origin?: string
): { ok: true; view: PublicSessionView } | { ok: false; error: string } {
  const built = buildPayload(input);
  if (!built.ok) return built;
  const id = encodeSessionId(built.payload);
  return {
    ok: true,
    view: {
      id,
      status: "pending",
      payload: built.payload,
      url: sessionPublicUrl(id, origin),
    },
  };
}
