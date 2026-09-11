import Link from "next/link";
import { AppChrome } from "@/components/AppChrome";
import { TokenPfp } from "@/components/pfp/TokenPfp";
import { RlusdTradePanel } from "@/components/rlusd/RlusdTradePanel";
import { registryRowAvailability } from "@/lib/rlusd-v1/availability";
import { getRlusdMarket } from "@/lib/rlusd-v1/marketRegistry";
import { GRAAV_X_HANDLE_AT } from "@/lib/xLaunchComposer";

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
        {market && tradable ? (
          <RlusdTradePanel
            symbol={market.symbol}
            name={market.name}
            sourcePostId={xPostId}
            coinAddress={market.coinAddress}
            curveAddress={market.marketAddress}
          />
        ) : market ? (
          <section className="g-trade" aria-labelledby="market-heading">
            <div className="g-trade-head">
              <TokenPfp ticker={market.symbol} size="md" />
              <div>
                <h1 id="market-heading" className="g-display">{market.symbol}</h1>
                <p className="g-sub">{market.name}</p>
              </div>
            </div>
            <div className="g-sub" style={{ marginTop: 4 }}>
              <span className="g-dot" />
              Not launched · RLUSD
            </div>
            <div className="g-sheet">
              <p className="g-sub" style={{ lineHeight: 1.5 }}>
                This coin is listed but has not launched yet. Price, balances, and trading
                appear here after the first signed launch.
              </p>
              <Link href="/launch" className="g-cta" style={{ textDecoration: "none" }}>
                Launch a coin on X
              </Link>
              <p className="g-hint">
                Post, repost, or DM {GRAAV_X_HANDLE_AT}. GRAAV replies with a signing link; your wallet signs.
              </p>
            </div>
          </section>
        ) : (
          <section className="g-sheet" aria-labelledby="market-missing">
            <h1 id="market-missing" className="g-title">Market not found</h1>
            <p className="g-sub" style={{ marginTop: 8 }}>
              This link does not match a listed coin.
            </p>
            <Link href="/" className="g-cta ghost" style={{ textDecoration: "none" }}>
              Back to Markets
            </Link>
          </section>
        )}
      </main>
    </AppChrome>
  );
}
