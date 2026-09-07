/** Server-only OAuth2 refresh for the @graav_xyz user token. */
import { writeFileSync, statSync } from "node:fs";
import { X_TOKEN_URL } from "@/lib/xAuthServer";

export type RefreshedProductToken = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
};

function productClient(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.X_PRODUCT_CLIENT_ID?.trim() || process.env.X_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.X_PRODUCT_CLIENT_SECRET?.trim() || "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function productRefreshConfigured(): boolean {
  return Boolean(process.env.X_BOT_USER_REFRESH_TOKEN?.trim() && productClient());
}

export async function refreshProductUserToken(): Promise<RefreshedProductToken> {
  const refreshToken = process.env.X_BOT_USER_REFRESH_TOKEN?.trim();
  const client = productClient();
  if (!refreshToken) throw new Error("Missing X_BOT_USER_REFRESH_TOKEN");
  if (!client) throw new Error("Missing product OAuth client id or secret");
  const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: client.clientId });
  const basic = Buffer.from(`${client.clientId}:${client.clientSecret}`).toString("base64");
  const response = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: body.toString(),
    cache: "no-store",
  });
  const data = (await response.json()) as RefreshedProductToken & { error?: string; error_description?: string };
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || `Product token refresh failed (${response.status})`);
  process.env.X_BOT_USER_ACCESS_TOKEN = data.access_token;
  process.env.X_PRODUCT_ACCESS_TOKEN = data.access_token;
  if (data.refresh_token) process.env.X_BOT_USER_REFRESH_TOKEN = data.refresh_token;
  persistLocalSecretStore(data);
  return data;
}

function persistLocalSecretStore(data: RefreshedProductToken): void {
  const dir = process.env.X_LOCAL_SECRET_STORE_DIR?.trim() || ".secrets";
  try {
    statSync(dir);
    writeFileSync(`${dir}/x-bot-user-access-token.txt`, `${data.access_token}\n`, { mode: 0o600 });
    if (data.refresh_token) writeFileSync(`${dir}/x-bot-user-refresh-token.txt`, `${data.refresh_token}\n`, { mode: 0o600 });
  } catch {
    // Vercel's read-only filesystem has no durable local store.
  }
}

let lastRefreshAt = 0;
const REFRESH_AFTER_MS = 90 * 60 * 1000;
export function shouldRefreshProductToken(now = Date.now()): boolean { return now - lastRefreshAt >= REFRESH_AFTER_MS; }

export async function maybeRefreshProductToken(force = false): Promise<
  | { refreshed: true; token: RefreshedProductToken }
  | { refreshed: false; reason: string }
> {
  if (!force && !shouldRefreshProductToken()) return { refreshed: false, reason: "refresh not due" };
  if (!productRefreshConfigured()) return { refreshed: false, reason: "product refresh env is not configured" };
  const token = await refreshProductUserToken();
  lastRefreshAt = Date.now();
  return { refreshed: true, token };
}
