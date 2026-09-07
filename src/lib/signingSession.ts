/**
 * Signing session (S) payload types — safe for client + server.
 * Crypto / store live in signingSessionServer.ts (Node only).
 */
import type { SessionAction } from "@/lib/sessionAllowlist";

export type { SessionAction };

/** Bound session fields (chat never signs; wallet does). */
export type SigningSessionPayload = {
  chainId: number;
  factory: string;
  market?: string;
  /** Optional; swap defaults to TestDex V2 */
  dex?: string;
  /** Token address when known (swap / sell path) */
  token?: string;
  action: SessionAction;
  /** Human decimal string (XRP for buy/swap-xrp, tokens for sell/swap-token) */
  amount: string;
  /** Human decimal minOut (0 allowed) */
  minOut: string;
  /** unix seconds */
  expiry: number;
  nonce: string;
  /** create only */
  createName?: string;
  createSymbol?: string;
  metadataURI?: string;
  /** swapExactXrpForTokens vs swapExactTokensForXrp */
  swapSide?: "xrpToToken" | "tokenToXrp";
  /**
   * Reply-track attribution (optional; chat ≠ auth).
   * Persist in HMAC payload so they survive serverless.
   * sessionId is the opaque id itself — not duplicated here.
   * verifiedBuyTx filled later by Protocol after on-chain confirm.
   */
  originTweetId?: string;
  replyTweetId?: string;
  /** Store field only — DM runtime CLOSED */
  dmConversationId?: string;
  buyerXUserId?: string;
  verifiedBuyTx?: string;
};

export type SessionStatus = "pending" | "signed" | "expired" | "invalid";

export type PublicSessionView = {
  id: string;
  status: SessionStatus;
  payload: SigningSessionPayload | null;
  txHash?: string;
  error?: string;
  url: string;
};

export const SESSION_DEFAULT_TTL_SEC = 15 * 60;
export const SESSION_MAX_TTL_SEC = 60 * 60;
export const CONSOLE_PUBLIC_ORIGIN =
  "https://graav.xyz";

export function sessionPublicUrl(id: string, origin?: string): string {
  const base = (origin || CONSOLE_PUBLIC_ORIGIN).replace(/\/$/, "");
  return `${base}/s/${id}`;
}

/** Hex chain id for MetaMask mobile copy (1449000). */
export const XRPL_EVM_TESTNET_HEX = "0x161c28";

/**
 * True for doc-template / garbage ids that must never look like a real session.
 * Fail-closed: do not invent a session; show help instead of search/404 thrash.
 */
export function isPlaceholderOrBogusSessionId(raw: string): boolean {
  const id = (raw ?? "").trim();
  if (!id) return true;

  const decoded = (() => {
    try {
      return decodeURIComponent(id);
    } catch {
      return id;
    }
  })();
  const candidates = [id, decoded].map((s) => s.trim());

  for (const c of candidates) {
    const lower = c.toLowerCase();
    if (
      c === "{id}" ||
      lower === "%7bid%7d" ||
      c === ":id" ||
      c === "<id>" ||
      c === "[id]" ||
      c === "{{id}}" ||
      lower === "null" ||
      lower === "undefined" ||
      lower === "example" ||
      lower === "session" ||
      c === "…" ||
      c === "..."
    ) {
      return true;
    }
    if (/[{}<>]/.test(c)) return true;
  }

  // Real opaque ids are s1.<payloadB64url>.<sigB64url>
  const check = candidates[candidates.length - 1] || id;
  if (!/^s1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(check)) {
    return true;
  }
  return false;
}
