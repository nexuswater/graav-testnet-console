import "server-only";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import { createPublicClient, http } from "viem";
import { xrplEvmTestnet, RPC_URL } from "@/lib/chain";
import { COOKIE_IDENTITY, verifyIdentitySession } from "@/lib/xAuthServer";
import type { ConsolePorts } from "./assemble";
import { existingV2Codec } from "./live-v2-codec";
import { viemGateway } from "./core/viem-gateway";
import type { Database, Identity, Sql } from "./core/types";
import { activeBind } from "./core/binds";
import { X1Error } from "./core/security";

const MIGRATION = readFileSync("src/lib/graav-x1/001_x1.sql", "utf8");
let databasePromise: Promise<Database> | undefined;

function pgliteDatabase(db: PGlite): Database {
  const query = async <T>(text: string, values: unknown[] = []) => ({ rows: (await db.query<T>(text, values)).rows as T[] });
  return {
    query,
    async transaction<T>(work: (sql: Sql) => Promise<T>) {
      await db.exec("BEGIN");
      try { const out = await work({ query }); await db.exec("COMMIT"); return out; }
      catch (e) { await db.exec("ROLLBACK"); throw e; }
    },
  };
}
function postgresDatabase(pool: Pool): Database {
  return {
    async query<T>(text: string, values: unknown[] = []) { const r = await pool.query(text, values); return { rows: r.rows as T[] }; },
    async transaction<T>(work: (sql: Sql) => Promise<T>) { const client = await pool.connect(); try { await client.query("BEGIN"); const out = await work({ query: async <R>(text: string, values: unknown[] = []) => ({ rows: (await client.query(text, values)).rows as R[] }) }); await client.query("COMMIT"); return out; } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); } },
  };
}
async function getDatabase(): Promise<Database> {
  if (!databasePromise) databasePromise = (async () => {
    const connection = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (connection) {
      const pool = new Pool({ connectionString: connection, ssl: process.env.PGSSL_DISABLE === "true" ? false : undefined });
      const db = postgresDatabase(pool);
      await db.query(MIGRATION);
      await db.query("CREATE TABLE IF NOT EXISTS graav_x1.rate_limits (key text NOT NULL, window_start bigint NOT NULL, count integer NOT NULL, PRIMARY KEY(key,window_start))");
      return db;
    }
    const dir = process.env.GRAAV_X1_PGLITE_DIR || ".data/graav-x1";
    const pglite = new PGlite(dir);
    await pglite.exec(MIGRATION);
    const db = pgliteDatabase(pglite);
    await db.query("CREATE TABLE IF NOT EXISTS graav_x1.rate_limits (key text NOT NULL, window_start bigint NOT NULL, count integer NOT NULL, PRIMARY KEY(key,window_start))");
    return db;
  })();
  return databasePromise;
}
function cookie(req: Request, name: string): string | undefined {
  return req.headers.get("cookie")?.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`))?.slice(name.length + 1);
}
function identityFromRequest(req: Request): Identity | null {
  const x = verifyIdentitySession(cookie(req, COOKIE_IDENTITY)); return x ? { xUserId: x.id, handle: x.username, sessionId: x.sessionId, expiresAt: x.expiresAt } : null;
}
function origin(): string {
  return (process.env.CONSOLE_PUBLIC_ORIGIN || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function getConsolePorts(): Promise<ConsolePorts> {
  const database = await getDatabase();
  const client = createPublicClient({ chain: xrplEvmTestnet, transport: http(process.env.GRAAV_X1_RPC_URL || RPC_URL) });
  return {
    database,
    gateway: viemGateway(client, existingV2Codec),
    origin: origin(),
    visitorSecret: process.env.GRAAV_X1_VISITOR_SECRET || process.env.X_SESSION_SECRET || "local-x1-visitor-secret-change-me-32chars",
    now: () => Math.floor(Date.now() / 1000),
    readXSession: async (req) => identityFromRequest(req),
    readBotOperator: async (req) => {
      const expected = process.env.GRAAV_X1_BOT_TOKEN?.trim();
      const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
      const xUserId = process.env.GRAAV_X1_BOT_X_USER_ID?.trim();
      if (!expected || !supplied || !xUserId || supplied !== expected) return null;
      const row = await activeBind(database, "x_user_id", xUserId);
      if (!row) return null;
      return { xUserId, handle: row.handle, sessionId: `bot:${createHash("sha256").update(expected).digest("hex")}`, expiresAt: Number.MAX_SAFE_INTEGER };
    },
    rateLimit: async (_req, key, operation) => {
      const limits: Record<string, number> = { "/api/bind/challenge": 5, "/api/bind/confirm": 10, "/api/s": 20, "/api/s/touch": 60, "/api/s/prepare": 20, "/api/orders": 30, "/api/bot/s": 20 };
      const max = limits[operation] || 60;
      const windowStart = Math.floor(Date.now() / 60000);
      return database.transaction(async (sql) => {
        await sql.query("INSERT INTO graav_x1.locks(key) VALUES($1) ON CONFLICT DO NOTHING", [`rate:${key}:${windowStart}`]);
        await sql.query("SELECT key FROM graav_x1.locks WHERE key=$1 FOR UPDATE", [`rate:${key}:${windowStart}`]);
        const row = (await sql.query<{ count: number }>("SELECT count FROM graav_x1.rate_limits WHERE key=$1 AND window_start=$2", [key, windowStart])).rows[0];
        if (row && row.count >= max) return false;
        await sql.query("INSERT INTO graav_x1.rate_limits(key,window_start,count) VALUES($1,$2,1) ON CONFLICT(key,window_start) DO UPDATE SET count=graav_x1.rate_limits.count+1", [key, windowStart]);
        return true;
      });
    },
    reportInternalError: (error) => { console.error("[graav-x1] service failure", error instanceof X1Error ? error.code : "UNEXPECTED_ERROR"); },
  };
}
