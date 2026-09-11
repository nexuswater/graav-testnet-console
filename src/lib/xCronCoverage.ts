/**
 * Cron coverage matrix for @graav_xyz X intents.
 *
 * Spine: post / mention / DM → intent → /s → wallet. Chat ≠ authorization.
 * This module only PLANS a fail-closed /s mint for one X message. It never
 * posts, never signs, and never checks FEATURE_PUBLIC_X_WRITE — the caller
 * (xReplySessionServer / cron) owns the write gate. Pure: safe to unit test.
 *
 * SoT: docs/x/CRON_COVERAGE_MATRIX_2026-09-11.md
 */
import { parseIntent, resolveKnown } from "@/lib/chatIntent";
import { RLUSD_V1 as RLUSD } from "@/lib/rlusd-v1/config";
import { sourcePostIdFromInput } from "@/lib/rlusd-v1/createCoin";
import { isRlusdCloneFactory, SESSION_CHAIN_ID, type SessionAction } from "@/lib/sessionAllowlist";
import type { CreateSessionInput } from "@/lib/signingSessionServer";

export type CoverageIntent = "buy" | "sell" | "create" | "portfolio" | "help" | "unknown";

/**
 * READY      — /s mints and the wallet can sign it today (M2 curve buy/sell, V2 swap).
 * SOFT_READY — /s mints with bind fields, but the wallet rail is not signable yet
 *              (Coin V1 create needs the LaunchAuthorizer rail in /s). Dry-run only.
 * BLOCKED    — parsed intent, refused fail-closed (MOMENT unconfigured, bad ticker, …).
 * SKIP       — no mint intent (portfolio / help / garbage). Nothing emitted.
 */
export type CoverageStatus = "READY" | "SOFT_READY" | "BLOCKED" | "SKIP";

export type MentionContext = {
  /** The X message id GRAAV would reply to (mention / reply / DM message). */
  mentionId?: string;
  /**
   * Source post for attribution / create. Quoted post > replied-to post >
   * the mention itself ("the post is the Moment"). See originTweetIdFor().
   */
  originTweetId?: string;
  /** Store-only field — DM runtime stays CLOSED. */
  dmConversationId?: string;
};

export type CoverageBind = {
  originTweetId?: string;
  replyTweetId?: string;
  /** create only — keccak256(utf8(originTweetId)) == Coin V1 sourcePostId */
  originHash?: `0x${string}`;
};

export type CoverageRow = {
  intent: CoverageIntent;
  status: CoverageStatus;
  /** Wallet rail the /s page would use, or why there is none. */
  rail: string;
  /**
   * True only when a live @graav_xyz reply would hand the user a signable /s.
   * Stays false for SOFT_READY / BLOCKED / SKIP even after FEATURE_PUBLIC_X_WRITE opens.
   */
  liveReady: boolean;
  reason: string;
  symbol?: string;
  action?: SessionAction;
  cashtags: number;
  bind: CoverageBind;
  /** Fail-closed /s mint input (null unless READY / SOFT_READY). */
  sessionInput: CreateSessionInput | null;
  /** parseIntent preview copy (never a tx). */
  intentReply: string;
};

const CASHTAG_RE = /\$[A-Za-z][A-Za-z0-9]{0,15}/g;
const COIN_V1_ALIASES = new Set(["MOMENT", "MRLUSD", "COIN"]);

export function countCashtags(text: string): number {
  return (text.match(CASHTAG_RE) || []).length;
}

/** Minimal shape of an X API v2 tweet object the cron needs for the origin bind. */
export type OriginSource = {
  id: string;
  conversation_id?: string;
  referenced_tweets?: { type?: string; id?: string }[];
};

/**
 * Soft-ready origin bind rule (store-only until Protocol verifies on-chain):
 * quoted post > replied-to post > the mention itself.
 * conversation_id is not used as origin — a reply mid-thread binds the post it answers.
 */
export function originTweetIdFor(source: OriginSource): string {
  const refs = Array.isArray(source.referenced_tweets) ? source.referenced_tweets : [];
  const quoted = refs.find((r) => r.type === "quoted" && r.id);
  if (quoted?.id) return String(quoted.id);
  const replied = refs.find((r) => r.type === "replied_to" && r.id);
  if (replied?.id) return String(replied.id);
  return String(source.id);
}

function isCoinV1Alias(symbolRaw: string | undefined): boolean {
  return COIN_V1_ALIASES.has((symbolRaw || "").replace(/^\$/, "").toUpperCase());
}

function symbolFromPrefill(plan: ReturnType<typeof parseIntent>): string | undefined {
  return plan.handoff?.prefill?.symbol || plan.handoff?.prefill?.createSymbol;
}

/**
 * Map one X message to a fail-closed /s plan. Same parser as Chat (parseIntent),
 * plus X-only guards: exactly one cashtag for mint intents, Coin V1 trade refused,
 * create bound to the Coin V1 factory with the origin post hash.
 */
export function planMentionCoverage(text: string, ctx: MentionContext = {}): CoverageRow {
  const raw = String(text || "").trim();
  const plan = parseIntent(raw);
  const cashtags = countCashtags(raw);
  const mentionId = ctx.mentionId?.trim() || undefined;
  const originTweetId = ctx.originTweetId?.trim() || mentionId;
  const bind: CoverageBind = { originTweetId, replyTweetId: mentionId };
  const base = { cashtags, bind, sessionInput: null, liveReady: false, intentReply: plan.reply } as const;

  if (plan.kind === "portfolio") {
    return { ...base, intent: "portfolio", status: "SKIP", rail: "— (read-only)", reason: "Portfolio is a read intent: no /s mint, no reply while write is CLOSED." };
  }
  if (plan.kind === "help" || plan.kind === "unknown" || !plan.kind) {
    return { ...base, intent: plan.kind === "help" ? "help" : "unknown", status: "SKIP", rail: "—", reason: "No BUY / SELL / LAUNCH command parsed — fail-closed, nothing minted or posted." };
  }
  const intent: CoverageIntent = plan.kind === "launch" ? "create" : plan.kind;
  const symbol = symbolFromPrefill(plan);
  if (intent === "create" && !symbol) {
    return { ...base, intent, status: "BLOCKED", rail: "—", reason: plan.reply };
  }
  if (cashtags > 1) {
    return { ...base, intent, status: "BLOCKED", rail: "—", symbol, reason: `One cashtag per X post (found ${cashtags}) — fail-closed.` };
  }
  if (cashtags === 0) {
    return { ...base, intent, status: "BLOCKED", rail: "—", symbol, reason: "Missing $TICKER cashtag — X intents must tag exactly one $TICKER (Chat may omit it)." };
  }

  if (plan.kind === "buy" || plan.kind === "sell") {
    const body = plan.sessionBody;
    if (!body) {
      const known = symbol ? resolveKnown(symbol) : null;
      let reason: string;
      if (isCoinV1Alias(symbol)) {
        reason = "Coin V1 Moment market not configured (coin/curve null until the first signed createCoin) — fail-closed.";
      } else if (plan.kind === "sell" && known?.graduated) {
        reason = "Graduated market: sell is a V2 swap tokenToXrp — not minted from X; use Trade (fallback).";
      } else if (plan.kind === "sell" && /%/.test(raw)) {
        reason = "Percent sell needs a concrete token amount before a session can bind — fail-closed.";
      } else {
        reason = "Symbol not on the dual-factory allowlist — no session invented.";
      }
      return { ...base, intent: plan.kind, status: "BLOCKED", rail: "—", symbol, reason };
    }
    const factory = String(body.factory || "");
    const action = String(body.action || plan.kind) as SessionAction;
    if (isRlusdCloneFactory(factory)) {
      return {
        ...base, intent: plan.kind, status: "BLOCKED", symbol, action,
        rail: "Coin V1 curve (RLUSD approve + buy) — no /s rail",
        reason: "Coin V1 trade sessions are not minted from X: /s has no RLUSD approve+buy rail. Markets RLUSD wallet rail only (same lock as Chat).",
      };
    }
    const sessionInput: CreateSessionInput = {
      chainId: typeof body.chainId === "number" ? body.chainId : SESSION_CHAIN_ID,
      factory,
      market: body.market != null ? String(body.market) : undefined,
      dex: body.dex != null ? String(body.dex) : undefined,
      token: body.token != null ? String(body.token) : undefined,
      action,
      amount: body.amount != null ? String(body.amount) : undefined,
      minOut: body.minOut != null ? String(body.minOut) : "0",
      swapSide: body.swapSide === "tokenToXrp" || body.swapSide === "xrpToToken" ? body.swapSide : undefined,
      originTweetId,
      replyTweetId: mentionId,
      dmConversationId: ctx.dmConversationId?.trim() || undefined,
    };
    const rail = action === "swap"
      ? "TestDex V2 swapExactXrpForTokens (gSWAP · M2.2 · graduated()==true · tokenToLpId!=0)"
      : `M2 curve ${action} (graduated()==false)`;
    return { ...base, intent: plan.kind, status: "READY", liveReady: true, rail, symbol, action, sessionInput, reason: "Allowlisted dual-factory session; wallet signs on /s." };
  }

  // launch / create — the X post IS the Moment; bind it, keep Coin V1 sign closed.
  const ticker = symbol as string;
  if (!originTweetId) {
    return { ...base, intent: "create", status: "BLOCKED", rail: "Coin V1 createCoin", symbol: ticker, reason: "Create needs the X origin post id (the post is the Moment) — no session without it." };
  }
  if (RLUSD.profile !== "testnet-clone" || !RLUSD.factoryAddress) {
    return { ...base, intent: "create", status: "BLOCKED", rail: "Coin V1 createCoin", symbol: ticker, reason: "Coin V1 testnet-clone factory not configured — fail-closed." };
  }
  const originHash = sourcePostIdFromInput(originTweetId);
  const sessionInput: CreateSessionInput = {
    chainId: SESSION_CHAIN_ID,
    factory: RLUSD.factoryAddress,
    action: "create",
    createName: ticker,
    createSymbol: ticker,
    originHash,
    originTweetId,
    replyTweetId: mentionId,
    dmConversationId: ctx.dmConversationId?.trim() || undefined,
  };
  return {
    ...base,
    intent: "create",
    status: "SOFT_READY",
    symbol: ticker,
    action: "create",
    rail: "Coin V1 createCoin(CreateParams, sig) on the RLUSD clone factory — /s sign CLOSED until the LaunchAuthorizer rail lands",
    bind: { ...bind, originHash },
    sessionInput,
    reason: "Mints /s with originTweetId + replyTweetId + originHash bound; /s renders review + optional seed, Sign refuses without a real LaunchAuthorizer signature.",
  };
}

export type CoverageFixture = {
  id: string;
  /** Matrix row label from the task scope. */
  scope: "buy" | "sell" | "create" | "MOMENT" | "guard";
  text: string;
  mentionId: string;
  /** Simulated X API referenced_tweets entry (quote-RT or reply). */
  referenced?: { type: "quoted" | "replied_to"; id: string };
  expect: CoverageStatus;
  note: string;
};

/**
 * Canonical dry-run fixtures. Ids are deliberately non-numeric so a fixture
 * never renders as a link to a real X post.
 */
export const COVERAGE_FIXTURES: readonly CoverageFixture[] = [
  { id: "buy-curve", scope: "buy", text: "@graav_xyz buy $g589 0.1", mentionId: "fixture-buy-curve", expect: "READY", note: "M2 curve buy → READY" },
  { id: "buy-swap", scope: "buy", text: "@graav_xyz buy $gSWAP 0.1", mentionId: "fixture-buy-swap", expect: "READY", note: "graduated → V2 swap on M2.2 → READY" },
  { id: "buy-reply", scope: "buy", text: "@graav_xyz buy $g589 0.1", mentionId: "fixture-buy-reply", referenced: { type: "replied_to", id: "fixture-creator-post" }, expect: "READY", note: "reply under a creator post → originTweetId = creator post, replyTweetId = mention" },
  { id: "sell-curve", scope: "sell", text: "@graav_xyz sell 1 $g589", mentionId: "fixture-sell-curve", expect: "READY", note: "M2 curve sell (approve → sell) → READY" },
  { id: "sell-pct", scope: "sell", text: "@graav_xyz sell 50% $g589", mentionId: "fixture-sell-pct", expect: "BLOCKED", note: "percent sell → BLOCKED (needs concrete amount)" },
  { id: "create", scope: "create", text: "@graav_xyz launch $HORMUZ", mentionId: "fixture-create", expect: "SOFT_READY", note: "post is the Moment → SOFT_READY (Coin V1 sign closed)" },
  { id: "create-quote-rt", scope: "create", text: "Launch $HORMUZ @graav_xyz", mentionId: "fixture-create-qrt", referenced: { type: "quoted", id: "fixture-quoted-post" }, expect: "SOFT_READY", note: "quote-RT → origin = quoted post" },
  { id: "create-bad-ticker", scope: "create", text: "@graav_xyz launch $1bad", mentionId: "fixture-create-bad", expect: "BLOCKED", note: "bad ticker → BLOCKED" },
  { id: "moment-buy", scope: "MOMENT", text: "@graav_xyz buy $MOMENT 1", mentionId: "fixture-moment-buy", expect: "BLOCKED", note: "Coin V1 market null → BLOCKED" },
  { id: "moment-sell", scope: "MOMENT", text: "@graav_xyz sell 1 $MOMENT", mentionId: "fixture-moment-sell", expect: "BLOCKED", note: "Coin V1 market null → BLOCKED" },
  { id: "guard-two-cashtags", scope: "guard", text: "@graav_xyz buy $g589 0.1 $gSWAP", mentionId: "fixture-two-cashtags", expect: "BLOCKED", note: "two cashtags → BLOCKED" },
  { id: "guard-no-cashtag", scope: "guard", text: "@graav_xyz buy g589 0.1", mentionId: "fixture-no-cashtag", expect: "BLOCKED", note: "missing $ on X → BLOCKED (Chat may omit)" },
  { id: "guard-portfolio", scope: "guard", text: "@graav_xyz portfolio", mentionId: "fixture-portfolio", expect: "SKIP", note: "read intent → SKIP" },
  { id: "guard-garbage", scope: "guard", text: "@graav_xyz gm", mentionId: "fixture-garbage", expect: "SKIP", note: "no command → SKIP" },
] as const;

/** Shape a fixture like an X API v2 mention so the cron path is exercised end to end. */
export function fixtureAsMention(fixture: CoverageFixture): OriginSource & { text: string } {
  return {
    id: fixture.mentionId,
    text: fixture.text,
    referenced_tweets: fixture.referenced ? [{ type: fixture.referenced.type, id: fixture.referenced.id }] : undefined,
  };
}

export type CoverageSummary = Record<CoverageStatus, number> & { total: number; liveReady: number };

export function summarizeCoverage(rows: readonly Pick<CoverageRow, "status" | "liveReady">[]): CoverageSummary {
  const summary: CoverageSummary = { READY: 0, SOFT_READY: 0, BLOCKED: 0, SKIP: 0, total: rows.length, liveReady: 0 };
  for (const row of rows) {
    summary[row.status] += 1;
    if (row.liveReady) summary.liveReady += 1;
  }
  return summary;
}
