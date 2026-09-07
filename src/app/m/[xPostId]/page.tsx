import Link from "next/link";
import { AppChrome } from "@/components/AppChrome";
import { MockBuyCard } from "@/components/rlusd/MockBuyCard";
import { mockMarketView } from "@/lib/rlusd-v1/mockMarket";
export const dynamic = "force-dynamic";

export default async function MarketPage({ params }: { params: Promise<{ xPostId: string }> }) {
  const { xPostId } = await params;
  const market = mockMarketView(xPostId);
  return <AppChrome><main className="g-main market-detail" style={{ maxWidth: 620, margin: "0 auto", width: "100%" }}>
    <Link href="/" className="g-micro">← Markets</Link>
    <div className="g-pill" style={{ display: "inline-block", marginTop: 18 }}>{market.label}</div>
    <h1 className="g-display" style={{ marginTop: 14 }}>{market.symbol ? `$${market.symbol}` : "Market unavailable"}</h1>
    <p className="g-sub" style={{ marginTop: 8 }}>{market.name} · <span className="g-mono">{xPostId}</span></p>
    <div className="g-card market-meta" style={{ marginTop: 20 }}>
      <div className="g-kv"><span>Status</span><span>{market.status === "fixture" ? "Registry fixture" : "Not wired"}</span></div>
      <div className="g-kv"><span>Quote</span><span>{market.quoteSymbol} · {market.quoteDecimals} decimals</span></div>
      <div className="g-kv"><span>Chain target</span><span>{market.chainId}</span></div>
      {market.factoryAddress && <div className="g-kv"><span>Factory</span><span className="g-mono" title={market.factoryAddress}>{market.factoryAddress}</span></div>}
      {market.coinAddress && <div className="g-kv"><span>Coin / curve</span><span className="g-mono" title={market.coinAddress + " / " + market.curveAddress}>{market.coinAddress} / {market.curveAddress}</span></div>}
      {market.wired && <><div className="g-kv"><span>Reserve / threshold</span><span>{market.reserve} / {market.threshold} base units</span></div><div className="g-kv"><span>Policy</span><span className="g-mono" title={market.policyId}>{market.policyId}</span></div><div className="g-kv"><span>Graduated</span><span>{String(market.graduated)}</span></div></>}
    </div>
    {market.wired ? <MockBuyCard xPostId={xPostId} /> : <div className="g-alert" style={{ marginTop: 16 }}>This RLUSD registry entry is a fixture only. Trading stays disabled until its factory, coin, and market addresses are verified.</div>}
    <div className="g-alert" style={{ marginTop: 16 }}>{market.description}. This preview does not connect a wallet, call Squid, or broadcast.</div>
  </main></AppChrome>;
}
