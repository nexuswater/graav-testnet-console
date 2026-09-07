/**
 * Product @graav_xyz X credentials + FEATURE_PUBLIC_X_WRITE gate.
 * Separate from Connect-X user identity OAuth (NEXT_PUBLIC_X_CLIENT_ID).
 * Server-only — do not import from client components.
 *
 * Fail-closed: write never runs unless FEATURE_PUBLIC_X_WRITE=true AND
 * product user-context token is present. Do not invent secrets.
 */
import { CONSOLE_PUBLIC_ORIGIN } from "@/lib/signingSession";

export const PRODUCT_HANDLE = "graav_xyz";
export const PRODUCT_HANDLE_AT = "@graav_xyz";
export const PRODUCT_USER_ID = "2094147928965468160";

const X_API = "https://api.twitter.com/2";

/** Env truthy: "true" | "1" | "yes" (case-insensitive). Default false. */
export function isPublicXWriteEnabled(): boolean {
  const v = (process.env.FEATURE_PUBLIC_X_WRITE ?? "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export type ProductXCreds = {
  /** App-only bearer — prefer for mentions read (cheap). */
  bearerToken: string | null;
  /** User-context token for @graav_xyz (needs tweet.write for replies). */
  productAccessToken: string | null;
  /** Numeric user id for @graav_xyz (mentions path). */
  productUserId: string | null;
  /** Optional product app client id (document only; not used for identity OAuth). */
  productClientIdPresent: boolean;
  productClientSecretPresent: boolean;
};

/**
 * Product bot credentials — NEVER the personal @Josh_XRPL Connect-X session.
 * Env keys Josh must set on Vercel (see .env.example):
 *   X_BEARER_TOKEN
 *   X_BOT_USER_ACCESS_TOKEN   (alias: X_PRODUCT_ACCESS_TOKEN)
 *   X_PRODUCT_USER_ID
 *   X_PRODUCT_CLIENT_ID / X_PRODUCT_CLIENT_SECRET (optional; separate app)
 *   FEATURE_PUBLIC_X_WRITE=false until Phase 2 open
 */
export function getProductXCredentials(): ProductXCreds {
  const bearerToken = process.env.X_BEARER_TOKEN?.trim() || null;
  const productAccessToken =
    process.env.X_BOT_USER_ACCESS_TOKEN?.trim() ||
    process.env.X_PRODUCT_ACCESS_TOKEN?.trim() ||
    null;
  const productUserId = process.env.X_PRODUCT_USER_ID?.trim() || null;
  return {
    bearerToken,
    productAccessToken,
    productUserId,
    productClientIdPresent: Boolean(
      process.env.X_PRODUCT_CLIENT_ID?.trim() ||
        process.env.X_CLIENT_ID?.trim()
    ),
    productClientSecretPresent: Boolean(
      process.env.X_PRODUCT_CLIENT_SECRET?.trim()
    ),
  };
}

/** Token used for read (mentions). Prefer app bearer; fall back to product user token. */
export function getProductReadToken(): {
  token: string;
  kind: "bearer" | "user";
} | null {
  const c = getProductXCredentials();
  if (c.bearerToken) return { token: c.bearerToken, kind: "bearer" };
  if (c.productAccessToken)
    return { token: c.productAccessToken, kind: "user" };
  return null;
}

export type WriteGate =
  | { ok: true; token: string }
  | {
      ok: false;
      reason: string;
      featureFlag: boolean;
      hasProductToken: boolean;
    };

export function getPublicXWriteGate(): WriteGate {
  const featureFlag = isPublicXWriteEnabled();
  const c = getProductXCredentials();
  const hasProductToken = Boolean(c.productAccessToken);
  if (!featureFlag) {
    return {
      ok: false,
      reason:
        "FEATURE_PUBLIC_X_WRITE is false (Director soft lock / Phase 2 not open)",
      featureFlag,
      hasProductToken,
    };
  }
  if (!c.productAccessToken) {
    return {
      ok: false,
      reason:
        "Missing X_BOT_USER_ACCESS_TOKEN (or X_PRODUCT_ACCESS_TOKEN) for @graav_xyz — set on Vercel; fail-closed",
      featureFlag,
      hasProductToken,
    };
  }
  return { ok: true, token: c.productAccessToken };
}

export function consolePublicOrigin(reqOrigin?: string): string {
  const env =
    process.env.CONSOLE_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  if (reqOrigin) return reqOrigin.replace(/\/$/, "");
  return CONSOLE_PUBLIC_ORIGIN;
}

export type CapabilityRow = {
  id: string;
  label: string;
  /** PASS = live; SCAFFOLD = code ready fail-closed; CLOSED = policy; MISSING_ENV / ERROR / NOT_PROBED */
  status:
    | "PASS"
    | "SCAFFOLD"
    | "CLOSED"
    | "MISSING_ENV"
    | "ERROR"
    | "NOT_PROBED";
  detail: string;
};

export type EnvChecklistItem = {
  key: string;
  purpose: string;
  /** already_set | needed_from_josh | keep_false_until_go | optional */
  state: "already_set" | "needed_from_josh" | "keep_false_until_go" | "optional";
  present: boolean;
};

export type CapabilityMatrix = {
  productHandle: string;
  featurePublicXWrite: boolean;
  rows: CapabilityRow[];
  /** High-level spine: CONNECTED | SCAFFOLD | BLOCKED_ON_KEYS | CLOSED */
  spine: {
    chatToSession: "CONNECTED";
    connectXIdentity: "CONNECTED" | "BLOCKED_ON_KEYS";
    xApiReadMentions: "CONNECTED" | "SCAFFOLD" | "BLOCKED_ON_KEYS" | "ERROR";
    xBotReplySession: "SCAFFOLD" | "CONNECTED" | "CLOSED";
    publicXWrite: "CLOSED" | "BLOCKED_ON_KEYS" | "CONNECTED";
  };
  writeClosedWhy: string | null;
  /** Product keys still needed before a future write-open (never invent). */
  envKeysNeeded: string[];
  envChecklist: EnvChecklistItem[];
  probedAt: string;
};

export function buildCapabilityMatrix(opts?: {
  identityConfigured?: boolean;
  mentionsProbe?: { ok: boolean; detail: string };
}): CapabilityMatrix {
  const c = getProductXCredentials();
  const write = getPublicXWriteGate();
  const identityConfigured =
    opts?.identityConfigured ??
    Boolean(
      process.env.NEXT_PUBLIC_X_CLIENT_ID?.trim() &&
        process.env.X_CLIENT_SECRET?.trim()
    );
  const readToken = getProductReadToken();
  const readReady = Boolean(readToken && c.productUserId);
  const appUrlPresent = Boolean(
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.CONSOLE_PUBLIC_ORIGIN?.trim()
  );

  const readStatus: CapabilityRow["status"] = !readToken
    ? "MISSING_ENV"
    : !c.productUserId
      ? "MISSING_ENV"
      : opts?.mentionsProbe
        ? opts.mentionsProbe.ok
          ? "PASS"
          : "ERROR"
        : "NOT_PROBED";

  const rows: CapabilityRow[] = [
    {
      id: "chat_to_s",
      label: "Chat → /api/s session mint",
      status: "PASS",
      detail:
        "Console Chat + reply-session share parseIntent → allowlisted /s/{id}. Chat ≠ authorization.",
    },
    {
      id: "identity",
      label: "Connect X identity (user OAuth)",
      status: identityConfigured ? "PASS" : "MISSING_ENV",
      detail: identityConfigured
        ? "NEXT_PUBLIC_X_CLIENT_ID + X_CLIENT_SECRET present (identity only — not @graav_xyz write)"
        : "Set NEXT_PUBLIC_X_CLIENT_ID + X_CLIENT_SECRET for user Sign-in with X",
    },
    {
      id: "read_mentions",
      label: "X API read mentions (@graav_xyz)",
      status: readStatus,
      detail: !readToken
        ? "BLOCKED on keys — need X_BEARER_TOKEN (preferred) or X_BOT_USER_ACCESS_TOKEN"
        : !c.productUserId
          ? "BLOCKED on keys — need X_PRODUCT_USER_ID (numeric id for @graav_xyz)"
          : opts?.mentionsProbe?.detail ||
            "Keys present — call GET /api/x/mentions?live=1 or ?probeMentions=1 to live-probe (quota)",
    },
    {
      id: "reply_session",
      label: "X bot reply-session (mention → /s)",
      status: "SCAFFOLD",
      detail:
        "POST /api/x/reply-session parses intent + mints /s; posts only when FEATURE_PUBLIC_X_WRITE=true AND product token AND dryRun:false. Default fail-closed.",
    },
    {
      id: "write",
      label: "Public X write (reply with /s/{id})",
      status: write.ok ? "PASS" : write.featureFlag ? "MISSING_ENV" : "CLOSED",
      detail: write.ok
        ? "FEATURE_PUBLIC_X_WRITE=true + product token present"
        : write.reason,
    },
  ];

  // Keys Josh must supply before write can ever open — NOT the feature flag itself.
  const envKeysNeeded: string[] = [];
  if (!c.bearerToken) envKeysNeeded.push("X_BEARER_TOKEN");
  if (!c.productUserId) envKeysNeeded.push("X_PRODUCT_USER_ID");
  if (!c.productAccessToken) envKeysNeeded.push("X_BOT_USER_ACCESS_TOKEN");

  const featurePresent = (process.env.FEATURE_PUBLIC_X_WRITE ?? "").trim() !== "";

  const envChecklist: EnvChecklistItem[] = [
    {
      key: "NEXT_PUBLIC_X_CLIENT_ID",
      purpose: "Connect X OAuth client id (identity only)",
      state: identityConfigured ? "already_set" : "needed_from_josh",
      present: Boolean(process.env.NEXT_PUBLIC_X_CLIENT_ID?.trim()),
    },
    {
      key: "X_CLIENT_SECRET",
      purpose: "Connect X OAuth client secret (server)",
      state: identityConfigured ? "already_set" : "needed_from_josh",
      present: Boolean(process.env.X_CLIENT_SECRET?.trim()),
    },
    {
      key: "NEXT_PUBLIC_APP_URL",
      purpose: "Canonical origin / OAuth callback base",
      state: appUrlPresent ? "already_set" : "needed_from_josh",
      present: appUrlPresent,
    },
    {
      key: "FEATURE_PUBLIC_X_WRITE",
      purpose: "Public reply gate — MUST stay false until keys + explicit GO",
      state: "keep_false_until_go",
      present: featurePresent || !isPublicXWriteEnabled(),
    },
    {
      key: "X_BEARER_TOKEN",
      purpose: "App-only bearer for GET mentions (preferred read)",
      state: c.bearerToken ? "already_set" : "needed_from_josh",
      present: Boolean(c.bearerToken),
    },
    {
      key: "X_PRODUCT_USER_ID",
      purpose: "Numeric user id for @graav_xyz mentions path",
      state: c.productUserId ? "already_set" : "needed_from_josh",
      present: Boolean(c.productUserId),
    },
    {
      key: "X_BOT_USER_ACCESS_TOKEN",
      purpose: "@graav_xyz user-context token (tweet.write) for replies when write opens",
      state: c.productAccessToken ? "already_set" : "needed_from_josh",
      present: Boolean(c.productAccessToken),
    },
    {
      key: "X_PRODUCT_CLIENT_ID",
      purpose: "Optional separate product X app client id",
      state: "optional",
      present: c.productClientIdPresent,
    },
    {
      key: "X_PRODUCT_CLIENT_SECRET",
      purpose: "Optional separate product X app secret",
      state: "optional",
      present: c.productClientSecretPresent,
    },
    {
      key: "X_SESSION_SECRET",
      purpose: "Optional identity cookie HMAC (falls back to X_CLIENT_SECRET)",
      state: "optional",
      present: Boolean(process.env.X_SESSION_SECRET?.trim()),
    },
    {
      key: "SESSION_SIGNING_SECRET",
      purpose: "Optional /s/{id} HMAC (falls back to X_SESSION_SECRET)",
      state: "optional",
      present: Boolean(process.env.SESSION_SIGNING_SECRET?.trim()),
    },
    {
      key: "CONSOLE_PUBLIC_ORIGIN",
      purpose: "Optional public origin override for session URLs",
      state: "optional",
      present: Boolean(process.env.CONSOLE_PUBLIC_ORIGIN?.trim()),
    },
  ];

  let xApiRead: CapabilityMatrix["spine"]["xApiReadMentions"];
  if (!readReady) xApiRead = "BLOCKED_ON_KEYS";
  else if (opts?.mentionsProbe) {
    xApiRead = opts.mentionsProbe.ok ? "CONNECTED" : "ERROR";
  } else {
    xApiRead = "SCAFFOLD";
  }

  const spine: CapabilityMatrix["spine"] = {
    chatToSession: "CONNECTED",
    connectXIdentity: identityConfigured ? "CONNECTED" : "BLOCKED_ON_KEYS",
    xApiReadMentions: xApiRead,
    xBotReplySession: write.ok ? "CONNECTED" : "SCAFFOLD",
    publicXWrite: write.ok
      ? "CONNECTED"
      : write.featureFlag
        ? "BLOCKED_ON_KEYS"
        : "CLOSED",
  };

  return {
    productHandle: PRODUCT_HANDLE_AT,
    featurePublicXWrite: isPublicXWriteEnabled(),
    rows,
    spine,
    writeClosedWhy: write.ok ? null : write.reason,
    envKeysNeeded,
    envChecklist,
    probedAt: new Date().toISOString(),
  };
}

export type XMention = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
};

export async function fetchProductMentions(params?: {
  maxResults?: number;
}): Promise<
  | { ok: true; mentions: XMention[]; meta?: unknown; tokenKind: string }
  | { ok: false; error: string; status?: number }
> {
  const read = getProductReadToken();
  const c = getProductXCredentials();
  if (!read) {
    return {
      ok: false,
      error:
        "No product read token — set X_BEARER_TOKEN (app-only) or X_BOT_USER_ACCESS_TOKEN",
    };
  }
  if (!c.productUserId) {
    return {
      ok: false,
      error: "Missing X_PRODUCT_USER_ID (numeric @graav_xyz user id)",
    };
  }
  const max = Math.min(Math.max(params?.maxResults ?? 5, 5), 100);
  const url = new URL(`${X_API}/users/${c.productUserId}/mentions`);
  url.searchParams.set("max_results", String(max));
  url.searchParams.set("tweet.fields", "created_at,author_id,conversation_id");
  // Prefer not to spend paid search credits — mentions timeline is enough.
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${read.token}` },
    cache: "no-store",
  });
  const data = (await res.json()) as {
    data?: XMention[];
    meta?: unknown;
    detail?: string;
    title?: string;
    errors?: { detail?: string; title?: string }[];
  };
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error:
        data.detail ||
        data.title ||
        data.errors?.[0]?.detail ||
        data.errors?.[0]?.title ||
        `X mentions HTTP ${res.status}`,
    };
  }
  return {
    ok: true,
    mentions: data.data ?? [],
    meta: data.meta,
    tokenKind: read.kind,
  };
}

/**
 * Reply as @graav_xyz with session URL text only.
 * Fail-closed unless write gate passes. One cashtag max is caller's duty.
 */
export async function replyAsProduct(params: {
  inReplyToTweetId: string;
  text: string;
}): Promise<
  | { ok: true; tweetId: string }
  | { ok: false; error: string; status?: number; dryRun?: boolean }
> {
  const gate = getPublicXWriteGate();
  if (!gate.ok) {
    return { ok: false, error: gate.reason, dryRun: true };
  }
  // Soft cashtag guard: at most one $TICKER in reply body
  const cashtags = params.text.match(/\$[A-Za-z][A-Za-z0-9]{0,15}/g) || [];
  if (cashtags.length > 1) {
    return {
      ok: false,
      error: `One cashtag per API post (found ${cashtags.length})`,
    };
  }
  const res = await fetch(`${X_API}/tweets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gate.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: params.text,
      reply: { in_reply_to_tweet_id: params.inReplyToTweetId },
    }),
  });
  const data = (await res.json()) as {
    data?: { id?: string };
    detail?: string;
    title?: string;
    errors?: { detail?: string; title?: string }[];
  };
  if (!res.ok || !data.data?.id) {
    return {
      ok: false,
      status: res.status,
      error:
        data.detail ||
        data.title ||
        data.errors?.[0]?.detail ||
        data.errors?.[0]?.title ||
        `X reply HTTP ${res.status}`,
    };
  }
  return { ok: true, tweetId: data.data.id };
}
