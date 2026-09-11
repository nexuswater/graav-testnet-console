"use client";
import Link from "next/link";
import { AppChrome } from "@/components/AppChrome";
import { RLUSD_V1 as C } from "@/lib/rlusd-v1/config";
import { GRAAV_X_HANDLE_AT } from "@/lib/xLaunchComposer";

function shortAddress(value: string | null) {
  return value ? value.slice(0, 6) + "…" + value.slice(-4) : "Not yet";
}

export function CoinHome() {
  return (
    <AppChrome>
      <main className="g-main coin-home">
        <section className="coin-hero">
          <div className="g-pill coin-kicker">COIN V1</div>
          <h1 className="g-display coin-title">Turn an idea into a coin.</h1>
          <p className="g-sub coin-lede">
            Post, quote-repost, or DM {GRAAV_X_HANDLE_AT} to create. Quoted in RLUSD on XRPL EVM.
            Your wallet signs every transaction.
          </p>
          <div className="coin-actions">
            <Link href="/launch" className="g-cta coin-primary">Launch on X</Link>
            <Link href="/" className="g-btn coin-secondary">Browse markets</Link>
          </div>
        </section>
        <section className="coin-rail g-card" aria-labelledby="market-rail">
          <div className="g-micro" id="market-rail">MARKET RAIL</div>
          <div className="coin-rail-grid">
            <div><span className="g-micro">Quote</span><strong>RLUSD</strong></div>
            <div><span className="g-micro">Chain</span><strong>XRPL EVM · {C.chainId}</strong></div>
            <div><span className="g-micro">Factory</span><strong className="g-mono">{shortAddress(C.factoryAddress)}</strong></div>
          </div>
          <details className="g-details coin-details">
            <summary>Contract details</summary>
            <div className="g-kv"><span>RLUSD</span><span className="g-mono">{shortAddress(C.quoteAddress)}</span></div>
            <div className="g-kv"><span>First coin</span><span className="g-mono">{shortAddress(C.coinAddress)}</span></div>
          </details>
        </section>
      </main>
    </AppChrome>
  );
}
