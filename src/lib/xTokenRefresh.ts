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

export type VercelPersistStatus = {
  ok: boolean;
  updated?: string[];
  error?: string;
};

type VercelEnvironmentVariable = {
  id?: string;
  key?: string;
  target?: string | string[];
  type?: string;
};

const VERCEL_ENV_TYPES = new Set(["system", "encrypted", "plain", "sensitive"]);

function productClient(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.X_PRODUCT_CLIENT_ID?.trim() || process.env.X_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.X_PRODUCT_CLIENT_SECRET?.trim() || "";
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function productRefreshConfigured(): boolean {
  return Boolean(process.env.X_BOT_USER_REFRESH_TOKEN?.trim() && productClient());
}

export async function refreshProductUserToken(): Promise<RefreshedProductToken & { vercelPersist: VercelPersistStatus }> {
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

  const updateProductAlias = Boolean(process.env.X_PRODUCT_ACCESS_TOKEN?.trim());
  process.env.X_BOT_USER_ACCESS_TOKEN = data.access_token;
  if (updateProductAlias) process.env.X_PRODUCT_ACCESS_TOKEN = data.access_token;
  if (data.refresh_token) process.env.X_BOT_USER_REFRESH_TOKEN = data.refresh_token;
  persistLocalSecretStore(data);
  const vercelPersist = await persistVercelProductionEnv(data, updateProductAlias);
  return { ...data, vercelPersist };
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

/**
 * Persist the rotated product credentials in Vercel Production when the
 * runtime has a Vercel API token. This deliberately happens after the X
 * exchange and never makes a successful X refresh fail.
 */
async function persistVercelProductionEnv(data: RefreshedProductToken, updateProductAlias: boolean): Promise<VercelPersistStatus> {
  const token = process.env.VERCEL_TOKEN?.trim() || process.env.VERCEL_ACCESS_TOKEN?.trim();
  const projectId = process.env.VERCEL_PROJECT_ID?.trim();
  const teamId = process.env.VERCEL_TEAM_ID?.trim();
  if (!token || !projectId) {
    const missing = [!token && "VERCEL_TOKEN (or VERCEL_ACCESS_TOKEN)", !projectId && "VERCEL_PROJECT_ID"].filter(Boolean).join(", ");
    return { ok: false, error: `Vercel env persistence is not configured; missing ${missing}` };
  }

  const keys = ["X_BOT_USER_ACCESS_TOKEN", ...(updateProductAlias ? ["X_PRODUCT_ACCESS_TOKEN"] : []), ...(data.refresh_token ? ["X_BOT_USER_REFRESH_TOKEN"] : [])];
  const values: Record<string, string> = {
    X_BOT_USER_ACCESS_TOKEN: data.access_token,
    ...(updateProductAlias ? { X_PRODUCT_ACCESS_TOKEN: data.access_token } : {}),
    ...(data.refresh_token ? { X_BOT_USER_REFRESH_TOKEN: data.refresh_token } : {}),
  };
  const query = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const baseUrl = "https://api.vercel.com";
  const projectPath = `/v10/projects/${encodeURIComponent(projectId)}/env`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const updated: string[] = [];

  try {
    const listResponse = await fetch(`${baseUrl}${projectPath}${query}`, { headers, cache: "no-store" });
    if (!listResponse.ok) throw new Error(`Vercel env list failed (${listResponse.status})`);
    const listed = (await listResponse.json()) as { envs?: VercelEnvironmentVariable[] };
    const envs = Array.isArray(listed.envs) ? listed.envs : [];

    for (const key of keys) {
      const productionEnv = envs.find((env) => env.key === key && targetsProduction(env.target));
      const existingEnv = productionEnv || envs.find((env) => env.key === key);
      if (existingEnv?.id) {
        const target = uniqueTargets(existingEnv.target);
        if (!target.includes("production")) target.push("production");
        const type = existingEnv.type && VERCEL_ENV_TYPES.has(existingEnv.type) ? existingEnv.type : "encrypted";
        const response = await fetch(`${baseUrl}/v9/projects/${encodeURIComponent(projectId)}/env/${encodeURIComponent(existingEnv.id)}${query}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ key, value: values[key], type, target }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Vercel env update failed for ${key} (${response.status})`);
      } else {
        const response = await fetch(`${baseUrl}${projectPath}${query}`, {
          method: "POST",
          headers,
          body: JSON.stringify({ key, value: values[key], type: "encrypted", target: ["production"] }),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Vercel env create failed for ${key} (${response.status})`);
      }
      updated.push(key);
    }
    return { ok: true, updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[x-token-refresh] ${message}`);
    return { ok: false, updated, error: message };
  }
}

function uniqueTargets(target: string | string[] | undefined): string[] {
  const values = Array.isArray(target) ? target : target ? [target] : [];
  return [...new Set(values.filter((value) => value === "production" || value === "preview" || value === "development"))];
}

function targetsProduction(target: string | string[] | undefined): boolean {
  return uniqueTargets(target).includes("production");
}

let lastRefreshAt = 0;
const REFRESH_AFTER_MS = 90 * 60 * 1000;
export function shouldRefreshProductToken(now = Date.now()): boolean { return now - lastRefreshAt >= REFRESH_AFTER_MS; }

export async function maybeRefreshProductToken(force = false): Promise<
  | { refreshed: true; token: RefreshedProductToken & { vercelPersist: VercelPersistStatus } }
  | { refreshed: false; reason: string }
> {
  if (!force && !shouldRefreshProductToken()) return { refreshed: false, reason: "refresh not due" };
  if (!productRefreshConfigured()) return { refreshed: false, reason: "product refresh env is not configured" };
  const token = await refreshProductUserToken();
  lastRefreshAt = Date.now();
  return { refreshed: true, token };
}
