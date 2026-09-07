import Link from "next/link";
import { AppChrome } from "@/components/AppChrome";
import { RlusdTradePanel } from "@/components/rlusd/RlusdTradePanel";
import { RLUSD_V1 as C } from "@/lib/rlusd-v1/config";
import { getRlusdMarket } from "@/lib/rlusd-v1/marketRegistry";

export const dynamic = "force-dynamic";

export default async function MarketPage({ params }: { params: Promise<{ xPostId: string }> }) {
  const { xPostId } = await params;
  const market = getRlusdMarket(xPostId);
  const wired = market?.status === "fixture" && market.marketAddress === C.curveAddress && market.coinAddress === C.coinAddress;
  return (
    <AppChrome>
      <main className="g-main market-detail" style={{ maxWidth: 620, margin: "0 auto", width: "100%" }}>
        <Link href="/" className="g-micro">← Markets</Link>
        <div className="g-pill" style={{ display: "inline-block", marginTop: 18 }}>RLUSD MARKET</div>
        <h1 className="g-display" style={{ marginTop: 14 }}>{market?.symbol ? `$${market.symbol}` : "Market unavailable"}</h1>
        <p className="g-sub" style={{ marginTop: 8 }}>{market?.name ?? "Unknown market"} · <span className="g-mono">{xPostId}</span></p>
        <div className="g-card market-meta" style={{ marginTop: 20 }}>
          <div className="g-kv"><span>Status</span><span>{wired ? "Live clone market" : "Not wired"}</span></div>
          <div className="g-kv"><span>Quote</span><span>RLUSD · {C.quoteDecimals} decimals</span></div>
          <div className="g-kv"><span>Chain target</span><span>{C.chainId}</span></div>
          {market?.factoryAddress && <div className="g-kv"><span>Factory</span><span className="g-mono" title={market.factoryAddress}>{market.factoryAddress}</span></div>}
          {market?.coinAddress && <div className="g-kv"><span>Coin / curve</span><span className="g-mono" title={`${market.coinAddress} / ${market.marketAddress ?? ""}`}>{market.coinAddress} / {market.marketAddress}</span></div>}
        </div>
        {wired ? <RlusdTradePanel symbol={market.symbol} coinAddress={market.coinAddress} curveAddress={market.marketAddress} /> : <div className="g-alert warn" style={{ marginTop: 16 }}>This registry entry is not wired to a verified clone address. Trading is disabled.</div>}
        <div className="g-alert" style={{ marginTop: 16 }}>Wallet signs direct RLUSD clone calls. Chat is not authorization; no server-side success is shown.</div>
      </main>
    </AppChrome>
  );
}
