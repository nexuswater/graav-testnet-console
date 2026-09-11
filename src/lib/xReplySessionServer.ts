import { createSession } from "@/lib/signingSessionServer";
import {
  COVERAGE_FIXTURES,
  fixtureAsMention,
  originTweetIdFor,
  planMentionCoverage,
  summarizeCoverage,
  type CoverageFixture,
  type CoverageRow,
  type CoverageSummary,
} from "@/lib/xCronCoverage";
import { getPublicXWriteGate, isPublicXWriteEnabled, PRODUCT_HANDLE_AT, replyAsProduct } from "@/lib/xProductServer";

export type ReplySessionInput = {
  mentionId?: string; text?: string; intent?: string; dryRun?: boolean;
  originTweetId?: string; replyTweetId?: string; dmConversationId?: string;
  buyerXUserId?: string; verifiedBuyTx?: string;
  /** Optional short TTL for fixture / matrix dry-runs (seconds). */
  ttlSec?: number;
};
export type ReplySessionCoverage = Pick<CoverageRow, "intent" | "status" | "rail" | "liveReady" | "reason" | "symbol" | "action" | "cashtags" | "bind">;
export type ReplySessionResult = {
  productHandle: string; featurePublicXWrite: boolean;
  intent: { kind: string | undefined; reply: string };
  /** Cron coverage row for this text (SoT: docs/x/CRON_COVERAGE_MATRIX_2026-09-11.md). */
  coverage: ReplySessionCoverage;
  session: { id: string; url: string } | null; sessionError?: string;
  replyText: string | null;
  xReply: { posted: boolean; tweetId?: string; dryRun: boolean; reason?: string };
};

export type MintedCoverage = { session: { id: string; url: string } | null; sessionError?: string };

/** Mint the fail-closed /s for a coverage row (READY / SOFT_READY only). Never posts. */
export function mintCoverageSession(
  row: CoverageRow,
  origin: string,
  extra?: { buyerXUserId?: string; verifiedBuyTx?: string; ttlSec?: number },
): MintedCoverage {
  if (!row.sessionInput) return { session: null, sessionError: row.reason };
  const result = createSession({
    ...row.sessionInput,
    buyerXUserId: extra?.buyerXUserId?.trim() || undefined,
    verifiedBuyTx: extra?.verifiedBuyTx?.trim() || undefined,
    ttlSec: extra?.ttlSec,
  }, origin);
  return result.ok ? { session: { id: result.view.id, url: result.view.url } } : { session: null, sessionError: result.error };
}

export function coverageView(row: CoverageRow): ReplySessionCoverage {
  return { intent: row.intent, status: row.status, rail: row.rail, liveReady: row.liveReady, reason: row.reason, symbol: row.symbol, action: row.action, cashtags: row.cashtags, bind: row.bind };
}

export type CoverageFixtureRow = ReplySessionCoverage & MintedCoverage & {
  fixture: string;
  scope: CoverageFixture["scope"];
  text: string;
  mentionId: string;
  expect: CoverageFixture["expect"];
  /** planMentionCoverage status matched the fixture expectation. */
  pass: boolean;
  note: string;
};

/** Fixture TTL keeps matrix dry-run sessions from lingering. */
export const COVERAGE_FIXTURE_TTL_SEC = 60;

/**
 * Run the canonical fixtures through the exact cron path (origin bind → plan →
 * dry-run /s mint). No X read, no post, no store writes.
 */
export function runCoverageFixtures(origin: string): { rows: CoverageFixtureRow[]; summary: CoverageSummary; allPass: boolean } {
  const rows = COVERAGE_FIXTURES.map((fixture) => {
    const mention = fixtureAsMention(fixture);
    const row = planMentionCoverage(mention.text, { mentionId: mention.id, originTweetId: originTweetIdFor(mention) });
    const minted = mintCoverageSession(row, origin, { ttlSec: COVERAGE_FIXTURE_TTL_SEC });
    return {
      fixture: fixture.id,
      scope: fixture.scope,
      text: fixture.text,
      mentionId: fixture.mentionId,
      expect: fixture.expect,
      pass: row.status === fixture.expect && (row.sessionInput ? Boolean(minted.session) : !minted.session),
      note: fixture.note,
      ...coverageView(row),
      ...minted,
    };
  });
  return { rows, summary: summarizeCoverage(rows), allPass: rows.every((row) => row.pass) };
}

export async function processReplySession(body: ReplySessionInput, origin: string): Promise<ReplySessionResult> {
  const mentionId = String(body.mentionId || "").trim();
  const rawText = String(body.intent || body.text || "").trim();
  const row = planMentionCoverage(rawText, {
    mentionId: body.replyTweetId != null && String(body.replyTweetId).trim() ? String(body.replyTweetId) : mentionId || undefined,
    originTweetId: body.originTweetId != null ? String(body.originTweetId) : undefined,
    dmConversationId: body.dmConversationId != null ? String(body.dmConversationId) : undefined,
  });
  const ttlSec = typeof body.ttlSec === "number" && Number.isFinite(body.ttlSec) ? body.ttlSec : undefined;
  const { session, sessionError } = mintCoverageSession(row, origin, { buyerXUserId: body.buyerXUserId, verifiedBuyTx: body.verifiedBuyTx, ttlSec });
  const replyText = session ? `Sign here (wallet only · chat ≠ auth): ${session.url}` : null;
  const gate = getPublicXWriteGate();
  const wantPost = body.dryRun === false;
  const canPost = wantPost && gate.ok && Boolean(mentionId) && Boolean(replyText) && row.liveReady && isPublicXWriteEnabled();
  let xReply: ReplySessionResult["xReply"];
  if (!canPost) {
    const reasons: string[] = [];
    if (!wantPost) reasons.push("dryRun (default true — pass dryRun:false to attempt post)");
    if (!gate.ok) reasons.push(gate.reason);
    if (!mentionId) reasons.push("mentionId required to reply");
    if (!replyText) reasons.push(sessionError || "no session URL to emit (unknown symbol or non-mint intent)");
    if (replyText && !row.liveReady) reasons.push(`${row.status}: /s rail not wallet-signable yet — dry-run only (${row.rail})`);
    xReply = { posted: false, dryRun: true, reason: reasons.join("; ") };
  } else {
    const posted = await replyAsProduct({ inReplyToTweetId: mentionId, text: replyText! });
    xReply = posted.ok ? { posted: true, tweetId: posted.tweetId, dryRun: false } : { posted: false, dryRun: Boolean(posted.dryRun), reason: posted.error };
  }
  return {
    productHandle: PRODUCT_HANDLE_AT,
    featurePublicXWrite: isPublicXWriteEnabled(),
    intent: { kind: row.intent, reply: row.intentReply },
    coverage: coverageView(row),
    session,
    sessionError: session ? undefined : sessionError,
    replyText,
    xReply,
  };
}
