import Link from "next/link";
import { AppChrome } from "@/components/AppChrome";
import { RlusdTradePanel } from "@/components/rlusd/RlusdTradePanel";
import { registryRowAvailability } from "@/lib/rlusd-v1/availability";
import { getRlusdMarket } from "@/lib/rlusd-v1/marketRegistry";

export const dynamic = "force-dynamic";

export default async function MarketPage({ params }: { params: Promise<{ xPostId: string }> }) {
  const { xPostId } = await params;
  const market = getRlusdMarket(xPostId);
  const availability = market ? registryRowAvailability(market) : { state: "unconfigured" as const, reason: "unregistered" };
  const tradable = availability.state === "tradable" || availability.state === "configured";

  return (
    <AppChrome active="trade">
      <main className="g-main market-detail" style={{ maxWidth: 620, margin: "0 auto", width: "100%" }}>
        <Link href="/" className="g-back">← Markets</Link>
        <RlusdTradePanel
          symbol={market?.symbol}
          name={market?.name}
          sourcePostId={xPostId}
          coinAddress={market?.coinAddress}
          curveAddress={market?.marketAddress}
        />
        {!tradable && (
          <div className="g-alert warn" style={{ marginTop: 16 }}>
            This market is listed but not launched. Quotes, balances, and success states are not invented.
          </div>
        )}
      </main>
    </AppChrome>
  );
}
