import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const direct = req.headers.get("CRON_SECRET")?.trim();
  return bearer === secret || direct === secret;
}
function originFrom(req: NextRequest): string {
  const configured = process.env.CONSOLE_PUBLIC_ORIGIN?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "graav-testnet-console.vercel.app";
  return `${proto}://${host}`;
}

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "cron authorization required" }, { status: 401 });
  try {
    const [{ parseIntent }, { fetchProductMentions, PRODUCT_USER_ID }, { processReplySession }, { claimMention, markMentionFailed, markMentionPosted }, { maybeRefreshProductToken }] = await Promise.all([
      import("@/lib/chatIntent"), import("@/lib/xProductServer"), import("@/lib/xReplySessionServer"), import("@/lib/xAutoReplyStore"), import("@/lib/xTokenRefresh"),
    ]);
  if ((process.env.X_PRODUCT_USER_ID?.trim() || "") !== PRODUCT_USER_ID) {
    return NextResponse.json({ error: "X_PRODUCT_USER_ID must be the @graav_xyz id", expected: PRODUCT_USER_ID }, { status: 503 });
  }

  let refresh: { refreshed: boolean; reason?: string } = { refreshed: false };
  let refreshError: string | undefined;
  try {
    const result = await maybeRefreshProductToken();
    refresh = result.refreshed ? { refreshed: true } : { refreshed: false, reason: result.reason };
  } catch (error) { refreshError = error instanceof Error ? error.message : String(error); }

  let mentions = await fetchProductMentions({ maxResults: 5 });
  if (!mentions.ok && mentions.status === 401) {
    try {
      const result = await maybeRefreshProductToken(true);
      refresh = result.refreshed ? { refreshed: true } : { refreshed: false, reason: result.reason };
      mentions = await fetchProductMentions({ maxResults: 5 });
    } catch (error) { refreshError = error instanceof Error ? error.message : String(error); }
  }
  if (!mentions.ok) return NextResponse.json({ ok: false, error: mentions.error, status: mentions.status, refresh, refreshError }, { status: 502 });

  const summary = { fetched: mentions.mentions.length, claimed: 0, posted: 0, skipped: 0, failed: 0 };
  const errors: string[] = [];
  for (const mention of mentions.mentions.slice(0, 5)) {
    const plan = parseIntent(mention.text);
    const cashtags = mention.text.match(/\$[A-Za-z][A-Za-z0-9]{0,15}/g) || [];
    if (!plan.sessionBody || !["buy", "sell", "launch"].includes(plan.kind || "") || cashtags.length > 1) {
      summary.skipped += 1;
      continue;
    }
    if (!(await claimMention(mention.id))) { summary.skipped += 1; continue; }
    summary.claimed += 1;
    try {
      const result = await processReplySession({ mentionId: mention.id, text: mention.text, dryRun: false, originTweetId: mention.id }, originFrom(req));
      if (!result.xReply.posted || !result.xReply.tweetId || !result.session?.url) {
        throw new Error(result.xReply.reason || result.sessionError || "reply was not posted");
      }
      await markMentionPosted(mention.id, result.xReply.tweetId, result.session.url);
      summary.posted += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markMentionFailed(mention.id, message);
      summary.failed += 1;
      errors.push(`${mention.id}: ${message}`);
    }
  }
  return NextResponse.json({ ok: true, product: "@graav_xyz", refresh, refreshError, summary, errors }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
