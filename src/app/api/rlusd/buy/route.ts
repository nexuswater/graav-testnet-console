import { NextResponse } from "next/server";
import { createMockBuy, mockMarketView } from "@/lib/rlusd-v1/mockMarket";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { xPostId?: string; grossQuote?: string; referralXId?: string };
    const gross = BigInt(body.grossQuote ?? "5000000000000000000");
    const session = createMockBuy(body.xPostId?.trim() || "demo-moment-2026", gross, body.referralXId?.trim() || null);
    return NextResponse.json({ mock: true, market: mockMarketView(), session }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid BUY" }, { status: 400 }); }
}
