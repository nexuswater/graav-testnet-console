import { NextResponse } from "next/server";
import { mockMarketView, quoteMock } from "@/lib/rlusd-v1/mockMarket";

/** Integer-model reference only. Not a live market quote. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { grossQuote?: string };
    const gross = BigInt(body.grossQuote ?? "0");
    if (gross <= 0n) throw new Error("grossQuote must be positive");
    const quote = quoteMock(gross);
    return NextResponse.json(
      {
        mock: true,
        live: false,
        referenceOnly: true,
        market: mockMarketView(),
        quote: {
          ...quote,
          grossQuote: quote.grossQuote.toString(),
          fee: quote.fee.toString(),
          protocol: quote.protocol.toString(),
          creator: quote.creator.toString(),
          referrer: quote.referrer.toString(),
          midwife: quote.midwife.toString(),
          netQuote: quote.netQuote.toString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid quote" },
      { status: 400 },
    );
  }
}
