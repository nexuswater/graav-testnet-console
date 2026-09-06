import { NextResponse } from "next/server";
import { quoteMock, mockMarketView } from "@/lib/rlusd-v1/mockMarket";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { grossQuote?: string };
    const gross = BigInt(body.grossQuote ?? "5000000000000000000");
    if (gross <= 0n) throw new Error("grossQuote must be positive");
    return NextResponse.json({ mock: true, market: mockMarketView(), quote: quoteMock(gross) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid quote" }, { status: 400 }); }
}
