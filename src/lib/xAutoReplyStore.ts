import { getConsolePorts } from "@/lib/graav-x1/ports";
import type { Database } from "@/lib/graav-x1/core/types";

let tablePromise: Promise<Database> | undefined;
async function database(): Promise<Database> {
  if (!tablePromise) {
    tablePromise = getConsolePorts().then(async (ports) => {
      await ports.database.query(`CREATE TABLE IF NOT EXISTS graav_x1.x_auto_replies (
        mention_id text PRIMARY KEY,
        status text NOT NULL CHECK (status IN ('processing','posted','failed')),
        reply_tweet_id text, session_url text, error text,
        created_at double precision NOT NULL, updated_at double precision NOT NULL
      )`);
      return ports.database;
    });
  }
  return tablePromise;
}

export async function claimMention(mentionId: string): Promise<boolean> {
  const db = await database();
  const now = Date.now() / 1000;
  const result = await db.transaction((sql) => sql.query<{ mention_id: string }>(
    `INSERT INTO graav_x1.x_auto_replies (mention_id,status,created_at,updated_at)
     VALUES ($1,'processing',$2,$2)
     ON CONFLICT (mention_id) DO UPDATE SET status='processing', updated_at=$2, error=NULL
     WHERE graav_x1.x_auto_replies.status='failed'
        OR (graav_x1.x_auto_replies.status='processing' AND graav_x1.x_auto_replies.updated_at < $2 - 600)
     RETURNING mention_id`, [mentionId, now]
  ));
  return result.rows.length > 0;
}

export async function markMentionPosted(mentionId: string, replyTweetId: string, sessionUrl: string): Promise<void> {
  const db = await database();
  await db.query(`UPDATE graav_x1.x_auto_replies SET status='posted', reply_tweet_id=$2, session_url=$3, updated_at=$4, error=NULL WHERE mention_id=$1`, [mentionId, replyTweetId, sessionUrl, Date.now() / 1000]);
}
export async function markMentionFailed(mentionId: string, error: string): Promise<void> {
  const db = await database();
  await db.query(`UPDATE graav_x1.x_auto_replies SET status='failed', error=$2, updated_at=$3 WHERE mention_id=$1`, [mentionId, error.slice(0, 1000), Date.now() / 1000]);
}
