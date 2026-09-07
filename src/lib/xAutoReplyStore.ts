import { Pool } from "pg";

type MentionStatus = "processing" | "posted" | "failed";
type MemoryMention = {
  status: MentionStatus;
  replyTweetId?: string;
  sessionUrl?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS public.graav_x_auto_replies (
  mention_id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('processing','posted','failed')),
  reply_tweet_id text,
  session_url text,
  error text,
  created_at double precision NOT NULL,
  updated_at double precision NOT NULL
)`;

let databasePromise: Promise<Pool | undefined> | undefined;
// This fallback is intentionally process-local and is not durable across serverless isolates.
const memoryMentions = new Map<string, MemoryMention>();

async function database(): Promise<Pool | undefined> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const connection = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      if (!connection) return undefined;

      const pool = new Pool({
        connectionString: connection,
        ssl: process.env.PGSSL_DISABLE === "true" ? false : undefined,
      });
      await pool.query(CREATE_TABLE);
      return pool;
    })();
  }
  return databasePromise;
}

export async function claimMention(mentionId: string): Promise<boolean> {
  const now = Date.now() / 1000;
  const pool = await database();

  if (pool) {
    const result = await pool.query<{ mention_id: string }>(
      `INSERT INTO public.graav_x_auto_replies (mention_id,status,created_at,updated_at)
       VALUES ($1,'processing',$2,$2)
       ON CONFLICT (mention_id) DO UPDATE SET status='processing', updated_at=$2, error=NULL
       WHERE public.graav_x_auto_replies.status='failed'
          OR (public.graav_x_auto_replies.status='processing' AND public.graav_x_auto_replies.updated_at < $2 - 600)
       RETURNING mention_id`,
      [mentionId, now],
    );
    return result.rows.length > 0;
  }

  const existing = memoryMentions.get(mentionId);
  if (existing && existing.status !== "failed" && !(existing.status === "processing" && existing.updatedAt < now - 600)) {
    return false;
  }
  memoryMentions.set(mentionId, {
    status: "processing",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  return true;
}

export async function markMentionPosted(mentionId: string, replyTweetId: string, sessionUrl: string): Promise<void> {
  const pool = await database();
  const now = Date.now() / 1000;
  if (pool) {
    await pool.query(
      `UPDATE public.graav_x_auto_replies
       SET status='posted', reply_tweet_id=$2, session_url=$3, updated_at=$4, error=NULL
       WHERE mention_id=$1`,
      [mentionId, replyTweetId, sessionUrl, now],
    );
    return;
  }

  const existing = memoryMentions.get(mentionId);
  if (existing) {
    memoryMentions.set(mentionId, { ...existing, status: "posted", replyTweetId, sessionUrl, error: undefined, updatedAt: now });
  }
}

export async function markMentionFailed(mentionId: string, error: string): Promise<void> {
  const pool = await database();
  const now = Date.now() / 1000;
  const message = error.slice(0, 1000);
  if (pool) {
    await pool.query(
      `UPDATE public.graav_x_auto_replies
       SET status='failed', error=$2, updated_at=$3
       WHERE mention_id=$1`,
      [mentionId, message, now],
    );
    return;
  }

  const existing = memoryMentions.get(mentionId);
  if (existing) memoryMentions.set(mentionId, { ...existing, status: "failed", error: message, updatedAt: now });
}
