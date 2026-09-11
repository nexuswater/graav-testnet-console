import { NextRequest, NextResponse } from "next/server";
import { consolePublicOrigin, getPublicXWriteGate, isPublicXWriteEnabled, PRODUCT_HANDLE_AT } from "@/lib/xProductServer";
import { COVERAGE_FIXTURE_TTL_SEC, runCoverageFixtures } from "@/lib/xReplySessionServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFrom(req: NextRequest): string {
  return consolePublicOrigin((() => {
    const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (env) return env.replace(/\/$/, "");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "graav-testnet-console.vercel.app";
    return `${proto}://${host}`;
  })());
}

/**
 * GET /api/x/coverage — cron coverage matrix for @graav_xyz X intents.
 * Runs the canonical buy / sell / create / MOMENT fixtures through the exact
 * cron path (origin bind → parseIntent → fail-closed /s mint). No X read, no
 * post, no store writes. FEATURE_PUBLIC_X_WRITE is reported, never changed.
 */
export async function GET(req: NextRequest) {
  const gate = getPublicXWriteGate();
  const matrix = runCoverageFixtures(originFrom(req));
  return NextResponse.json(
    {
      productHandle: PRODUCT_HANDLE_AT,
      featurePublicXWrite: isPublicXWriteEnabled(),
      writeGate: gate.ok ? { open: true } : { open: false, reason: gate.reason, featureFlag: gate.featureFlag, hasProductToken: gate.hasProductToken },
      legend: {
        READY: "/s mints and the wallet can sign it today (M2 curve buy/sell, V2 swap). Live reply once FEATURE_PUBLIC_X_WRITE opens.",
        SOFT_READY: "/s mints with originTweetId + replyTweetId (+ originHash) bound; wallet rail not signable yet — dry-run only even after the flag opens.",
        BLOCKED: "Parsed, refused fail-closed (MOMENT unconfigured, bad ticker, cashtag rule, Coin V1 trade rail).",
        SKIP: "No mint intent (portfolio / help / garbage). Nothing minted or posted.",
      },
      fixtureTtlSec: COVERAGE_FIXTURE_TTL_SEC,
      summary: matrix.summary,
      allPass: matrix.allPass,
      rows: matrix.rows,
      sot: "docs/x/CRON_COVERAGE_MATRIX_2026-09-11.md",
      note: "Tweets never send txs. Replies emit /s/{id} only. Product identity is @graav_xyz — never @Josh_XRPL.",
      probedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
