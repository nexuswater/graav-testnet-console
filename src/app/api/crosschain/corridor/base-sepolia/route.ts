import { NextResponse } from "next/server";
import { probeBaseSepoliaCorridor } from "@/lib/rlusd-v1/baseSepoliaCorridor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Base Sepolia USDC → RLUSD (XRPL EVM testnet) corridor verdict. Read-only and
 * quote-only; 200 only on a live PASS, 424 while the corridor is FAIL or HOLD.
 * Never returns executable transaction data.
 */
export async function GET() {
  const { report } = await probeBaseSepoliaCorridor();
  return NextResponse.json(report, {
    status: report.verdict === "PASS" ? 200 : 424,
    headers: { "Cache-Control": "no-store" },
  });
}
