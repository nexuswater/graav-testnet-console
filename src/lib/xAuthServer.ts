/**
 * Server-only X OAuth helpers (Node crypto). Do not import from client components.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import type { XIdentity } from "@/lib/xAuth";
import { X_OAUTH_SCOPES } from "@/lib/xAuth";

export { X_OAUTH_SCOPES };

export const X_AUTHORIZE_URL = "https://twitter.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
export const X_USERS_ME_URL = "https://api.twitter.com/2/users/me";

export const COOKIE_STATE = "x_oauth_state";
export const COOKIE_VERIFIER = "x_oauth_verifier";
export const COOKIE_IDENTITY = "x_identity";

const STATE_TTL_SEC = 600;
const IDENTITY_TTL_SEC = 60 * 60 * 24 * 7;

export function getServerXCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env.NEXT_PUBLIC_X_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.X_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function base64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function generateState(): string {
  return base64Url(randomBytes(24));
}

export function getCallbackUrl(req: NextRequest): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.X_OAUTH_CALLBACK_BASE?.trim();
  if (envUrl) {
    return `${envUrl.replace(/\/$/, "")}/api/auth/x/callback`;
  }
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "localhost:3000";
  return `${proto}://${host}/api/auth/x/callback`;
}

function sessionSecret(): string {
  return (
    process.env.X_SESSION_SECRET?.trim() ||
    process.env.X_CLIENT_SECRET?.trim() ||
    "graav-x-identity-dev-only"
  );
}

export function signIdentity(
  identity: XIdentity,
  maxAgeSec = IDENTITY_TTL_SEC
): string {
  const exp = Math.floor(Date.now() / 1000) + maxAgeSec;
  const payload = base64Url(
    Buffer.from(JSON.stringify({ ...identity, exp }), "utf8")
  );
  const sig = base64Url(
    createHmac("sha256", sessionSecret()).update(payload).digest()
  );
  return `${payload}.${sig}`;
}

export function verifyIdentityCookie(
  value: string | undefined
): XIdentity | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const expected = base64Url(
    createHmac("sha256", sessionSecret()).update(payload).digest()
  );
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = JSON.parse(
      Buffer.from(b64 + pad, "base64").toString("utf8")
    ) as XIdentity & { exp?: number };
    if (!json?.id || !json?.username) return null;
    if (
      typeof json.exp === "number" &&
      json.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return {
      id: String(json.id),
      username: String(json.username),
      name: String(json.name ?? ""),
    };
  } catch {
    return null;
  }
}

export function oauthCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export const STATE_COOKIE_OPTS = () => oauthCookieOptions(STATE_TTL_SEC);
export const IDENTITY_COOKIE_OPTS = () => oauthCookieOptions(IDENTITY_TTL_SEC);
export const CLEAR_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 0,
};

export async function exchangeCodeForTokens(params: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ access_token: string; refresh_token?: string; scope?: string }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
    client_id: params.clientId,
  });
  const basic = Buffer.from(
    `${params.clientId}:${params.clientSecret}`
  ).toString("base64");
  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        `Token exchange failed (${res.status})`
    );
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    scope: data.scope,
  };
}

export async function fetchXUserMe(accessToken: string): Promise<XIdentity> {
  const res = await fetch(`${X_USERS_ME_URL}?user.fields=id,name,username`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as {
    data?: { id?: string; username?: string; name?: string };
    detail?: string;
    title?: string;
  };
  if (!res.ok || !data.data?.id || !data.data?.username) {
    throw new Error(
      data.detail || data.title || `Failed to fetch X profile (${res.status})`
    );
  }
  return {
    id: data.data.id,
    username: data.data.username,
    name: data.data.name ?? data.data.username,
  };
}

/** Server adapter view used by X1; derives a stable session identity from the signed cookie. */
export function verifyIdentitySession(value: string | undefined): (XIdentity & { sessionId: string; expiresAt: number }) | null {
  const identity = verifyIdentityCookie(value);
  if (!identity || !value) return null;
  try {
    const [payload] = value.split(".");
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const decoded = JSON.parse(Buffer.from(b64 + pad, "base64").toString("utf8")) as { exp?: number };
    if (!Number.isSafeInteger(decoded.exp) || (decoded.exp as number) <= Math.floor(Date.now() / 1000)) return null;
    return { ...identity, sessionId: createHash("sha256").update(value).digest("hex"), expiresAt: decoded.exp as number };
  } catch {
    return null;
  }
}
