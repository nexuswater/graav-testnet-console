import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * @graav_xyz mention cron — spine: mention → intent → /s → wallet. Chat ≠ authorization.
 *
 * Modes (SoT: docs/x/CRON_COVERAGE_MATRIX_2026-09-11.md):
 *   live     — FEATURE_PUBLIC_X_WRITE=true + product token + no dryRun/fixtures flag.
 *              Posts a /s reply for READY rows only (buy / sell on M2 / M2.2 rails).
 *   dry-run  — automatic while the write gate is CLOSED, or forced with ?dryRun=1.
 *              Reads mentions, plans each row, mints /s, never claims or posts.
 *   fixtures — ?fixtures=1 runs the canonical buy / sell / create / MOMENT matrix
 *              through the same path with no X read at all.
 */
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
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "graav.xyz";
  return `${proto}://${host}`;
}
function flag(req: NextRequest, key: string): boolean {
  const v = (req.nextUrl.searchParams.get(key) || "").trim().toLowerCase();
  return v === "1" || v === "true";
}

const NO_STORE = { "Cache-Control": "no-store" } as const;

async function run(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "cron authorization required" }, { status: 401 });
  try {
    const [
      { fetchProductMentions, getPublicXWriteGate, PRODUCT_HANDLE_AT, PRODUCT_USER_ID },
      { coverageView, mintCoverageSession, processReplySession, runCoverageFixtures },
      { originTweetIdFor, planMentionCoverage, summarizeCoverage },
      { claimMention, markMentionFailed, markMentionPosted },
      { maybeRefreshProductToken },
    ] = await Promise.all([
      import("@/lib/xProductServer"), import("@/lib/xReplySessionServer"), import("@/lib/xCronCoverage"), import("@/lib/xAutoReplyStore"), import("@/lib/xTokenRefresh"),
    ]);

    const gate = getPublicXWriteGate();
    const writeGate = gate.ok
      ? { open: true as const }
      : { open: false as const, reason: gate.reason, featureFlag: gate.featureFlag, hasProductToken: gate.hasProductToken };
    const fixtures = flag(req, "fixtures");
    const forcedDryRun = flag(req, "dryRun");
    const dryRunWhy: string[] = [];
    if (forcedDryRun) dryRunWhy.push("dryRun=1 requested");
    if (fixtures) dryRunWhy.push("fixtures=1 — canonical matrix, no X read");
    if (!gate.ok) dryRunWhy.push(gate.reason);
    const dryRun = forcedDryRun || fixtures || !gate.ok;
    const mode = dryRun ? "dry-run" : "live";
    const origin = originFrom(req);
    const productIdLock = { expected: PRODUCT_USER_ID, ok: (process.env.X_PRODUCT_USER_ID?.trim() || "") === PRODUCT_USER_ID };

    if (fixtures) {
      const matrix = runCoverageFixtures(origin);
      return NextResponse.json({
        ok: true, product: PRODUCT_HANDLE_AT, mode, source: "fixtures", dryRunWhy, writeGate, productIdLock,
        summary: { fetched: matrix.rows.length, claimed: 0, posted: 0, skipped: matrix.rows.length, failed: 0, ...matrix.summary },
        allPass: matrix.allPass,
        rows: matrix.rows,
        errors: [],
        note: "Fixtures never touch X or the mention store. Sessions expire in 60s. Tweets never send txs; wallet signs on /s.",
      }, { headers: NO_STORE });
    }

    if (!productIdLock.ok) {
      return NextResponse.json({ error: "X_PRODUCT_USER_ID must be the @graav_xyz id", expected: PRODUCT_USER_ID, mode, writeGate }, { status: 503 });
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
    if (!mentions.ok) return NextResponse.json({ ok: false, mode, error: mentions.error, status: mentions.status, refresh, refreshError, writeGate }, { status: 502 });

    const summary = { fetched: mentions.mentions.length, claimed: 0, posted: 0, skipped: 0, failed: 0 };
    const errors: string[] = [];
    const rows: Record<string, unknown>[] = [];
    const planned: { status: "READY" | "SOFT_READY" | "BLOCKED" | "SKIP"; liveReady: boolean }[] = [];
    for (const mention of mentions.mentions.slice(0, 5)) {
      const originTweetId = originTweetIdFor(mention);
      const row = planMentionCoverage(mention.text, { mentionId: mention.id, originTweetId });
      planned.push({ status: row.status, liveReady: row.liveReady });
      const view = { mentionId: mention.id, authorId: mention.author_id, text: mention.text, ...coverageView(row) };

      if (dryRun) {
        const minted = mintCoverageSession(row, origin);
        summary.skipped += 1;
        rows.push({ ...view, ...minted, dryRun: true, posted: false, store: "not consulted" });
        continue;
      }

      if (row.status !== "READY" || !row.liveReady) {
        summary.skipped += 1;
        rows.push({ ...view, dryRun: false, posted: false, skipped: row.reason });
        continue;
      }
      if (!(await claimMention(mention.id))) {
        summary.skipped += 1;
        rows.push({ ...view, dryRun: false, posted: false, skipped: "already claimed / posted (store)" });
        continue;
      }
      summary.claimed += 1;
      try {
        const result = await processReplySession({ mentionId: mention.id, text: mention.text, dryRun: false, originTweetId, replyTweetId: mention.id }, origin);
        if (!result.xReply.posted || !result.xReply.tweetId || !result.session?.url) {
          throw new Error(result.xReply.reason || result.sessionError || "reply was not posted");
        }
        await markMentionPosted(mention.id, result.xReply.tweetId, result.session.url);
        summary.posted += 1;
        rows.push({ ...view, dryRun: false, posted: true, tweetId: result.xReply.tweetId, session: result.session });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markMentionFailed(mention.id, message);
        summary.failed += 1;
        errors.push(`${mention.id}: ${message}`);
        rows.push({ ...view, dryRun: false, posted: false, error: message });
      }
    }
    return NextResponse.json({
      ok: true, product: PRODUCT_HANDLE_AT, mode, source: "x-mentions", dryRunWhy, writeGate, productIdLock, refresh, refreshError,
      summary: { ...summary, ...summarizeCoverage(planned) },
      rows, errors,
    }, { headers: NO_STORE });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500, headers: NO_STORE });
  }
}

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }
