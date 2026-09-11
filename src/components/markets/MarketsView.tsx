"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TokenPfp } from "@/components/pfp/TokenPfp";
import { ArrowRightIcon, SearchIcon } from "@/components/shell/Icons";
import { homeMarkets } from "@/lib/marketsRegistry";
import { registryRowAvailability } from "@/lib/rlusd-v1/availability";
import { RLUSD_MARKET_REGISTRY } from "@/lib/rlusd-v1/marketRegistry";
import { GRAAV_X_HANDLE_AT } from "@/lib/xLaunchComposer";

type Filter = "all" | "new" | "graduated";

type Row = {
  key: string;
  href: string;
  ticker: string;
  name: string;
  quote: string;
  statusLabel: "Graduated" | "On curve" | "Configured" | "Not launched";
  tradable: boolean;
  group: "new" | "graduated";
};

function rows(): Row[] {
  const rlusd: Row[] = RLUSD_MARKET_REGISTRY.map((market) => {
    const availability = registryRowAvailability(market);
    const launched = availability.state === "tradable" || availability.state === "configured";
    return {
      key: market.id,
      href: `/m/${encodeURIComponent(market.sourcePostId)}`,
      ticker: market.symbol,
      name: market.name,
      quote: "RLUSD",
      statusLabel: launched ? "Configured" : "Not launched",
      tradable: launched,
      group: "new",
    };
  });
  const xrp: Row[] = homeMarkets().map((market) => ({
    key: market.ticker,
    href: `/t/${encodeURIComponent(market.ticker)}`,
    ticker: market.ticker,
    name: market.name,
    quote: "XRP",
    statusLabel: market.graduatedHint ? "Graduated" : "On curve",
    tradable: true,
    group: market.graduatedHint ? "graduated" : "new",
  }));
  // Tradable markets lead; listings that have not launched follow.
  return [...rlusd, ...xrp].sort((a, b) => Number(b.tradable) - Number(a.tradable));
}

export function MarketsView() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const all = useMemo(() => rows(), []);
  const tradableCount = all.filter((row) => row.tradable).length;
  const visible = all.filter((row) => {
    const hay = `${row.ticker} ${row.name} ${row.quote} ${row.statusLabel}`.toLowerCase();
    const matchesQuery = !query.trim() || hay.includes(query.trim().toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "new" && row.group === "new") ||
      (filter === "graduated" && row.group === "graduated");
    return matchesQuery && matchesFilter;
  });

  return (
    <main className="g-main g-markets">
      <section className="g-hero">
        <div>
          <h1 className="g-hero-title">Ideas become markets.</h1>
          <p className="g-hero-sub">
            Launch, trade, and share from a post, repost, or DM to {GRAAV_X_HANDLE_AT}.
            Charts, portfolio, and account live here. Your wallet signs every transaction.
          </p>
        </div>
        <Link href="/launch" className="g-cta g-cta-inline">
          Launch on X →
        </Link>
      </section>

      <div className="g-network-bar">
        <span>XRPL EVM · RLUSD / XRP</span>
        <span className="g-network-status">
          <span className="g-dot live" />
          {tradableCount} tradable · {all.length} listed
        </span>
      </div>

      <div className="g-search-row">
        <label className="g-search-wrap">
          <SearchIcon />
          <input
            className="g-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search coins"
            aria-label="Search coins"
          />
        </label>
        <div className="g-filters" role="tablist" aria-label="Market filters">
          {(["all", "new", "graduated"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              className={filter === value ? "on" : undefined}
              onClick={() => setFilter(value)}
            >
              {value === "all" ? "All" : value === "new" ? "New" : "Graduated"}
            </button>
          ))}
        </div>
      </div>

      <div className="g-table" role="table" aria-label="Markets">
        <div className="g-table-head" role="row">
          <span>Coin</span>
          <span>Quote</span>
          <span>Status</span>
          <span className="g-sr-only">Open</span>
        </div>
        {visible.length === 0 ? (
          <div className="g-empty">No coins match that search.</div>
        ) : (
          visible.map((row) => (
            <Link key={row.key} href={row.href} className="g-table-row" role="row">
              <span className="g-table-coin">
                <TokenPfp ticker={row.ticker} size="sm" />
                <span>
                  <strong>{row.ticker}</strong>
                  <em>{row.name}</em>
                </span>
              </span>
              <span className="g-table-quote">{row.quote}</span>
              <span className="g-table-status">
                <span className={`g-dot${row.tradable ? " live" : ""}`} />
                {row.statusLabel}
              </span>
              <span className="g-table-go" aria-hidden="true">
                <ArrowRightIcon />
              </span>
            </Link>
          ))
        )}
      </div>

      <footer className="g-launch-progress">
        <span>How it works</span>
        <ol>
          <li>Post, repost, or DM {GRAAV_X_HANDLE_AT}</li>
          <li>Open your signing link</li>
          <li>Sign in your wallet</li>
        </ol>
      </footer>
    </main>
  );
}
