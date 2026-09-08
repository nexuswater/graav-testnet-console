"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TokenPfp } from "@/components/pfp/TokenPfp";
import { ArrowRightIcon, SearchIcon } from "@/components/shell/Icons";
import { homeMarkets } from "@/lib/marketsRegistry";
import { registryRowAvailability } from "@/lib/rlusd-v1/availability";
import { RLUSD_MARKET_REGISTRY } from "@/lib/rlusd-v1/marketRegistry";

type Filter = "all" | "new" | "graduated";

type Row = {
  key: string;
  href: string;
  ticker: string;
  name: string;
  description: string;
  quote: string;
  statusLabel: string;
  statusKind: "neutral" | "live";
  group: "new" | "graduated";
};

function rows(): Row[] {
  const rlusd = RLUSD_MARKET_REGISTRY.map((market) => {
    const availability = registryRowAvailability(market);
    const launched = availability.state === "tradable" || availability.state === "configured";
    return {
      key: market.id,
      href: `/m/${encodeURIComponent(market.sourcePostId)}`,
      ticker: market.symbol,
      name: market.name,
      description: market.description,
      quote: "Test RLUSD",
      statusLabel: launched ? "Configured" : "Not launched",
      statusKind: "neutral" as const,
      group: "new" as const,
    };
  });
  const xrp = homeMarkets().map((market) => ({
    key: market.ticker,
    href: `/t/${encodeURIComponent(market.ticker)}`,
    ticker: market.ticker,
    name: market.name,
    description: market.tag || "XRPL EVM Testnet market",
    quote: "XRP",
    statusLabel: market.graduatedHint ? "Graduated" : "On curve",
    statusKind: market.graduatedHint ? ("live" as const) : ("neutral" as const),
    group: market.graduatedHint ? ("graduated" as const) : ("new" as const),
  }));
  return [...rlusd, ...xrp];
}

export function MarketsView() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const all = useMemo(() => rows(), []);
  const visible = all.filter((row) => {
    const hay = `${row.ticker} ${row.name} ${row.description} ${row.quote}`.toLowerCase();
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
          <p className="g-hero-sub">Discover coins born from posts.</p>
        </div>
        <Link href="/launch" className="g-cta g-cta-inline">
          Launch coin →
        </Link>
      </section>

      <div className="g-network-bar">
        <span>XRPL EVM Testnet · Test assets only</span>
        <span className="g-network-status">
          <span className="g-dot" />
          New coin launches are being connected
        </span>
      </div>

      <div className="g-search-row">
        <label className="g-search-wrap">
          <SearchIcon />
          <input
            className="g-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search coins or paste an X post"
            aria-label="Search coins or paste an X post"
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
          <span>Quote asset</span>
          <span>Status</span>
          <span className="g-sr-only">Open</span>
        </div>
        {visible.length === 0 ? (
          <div className="g-empty">No markets match that search.</div>
        ) : (
          visible.map((row) => (
            <Link key={row.key} href={row.href} className="g-table-row" role="row">
              <span className="g-table-coin">
                <TokenPfp ticker={row.ticker} size="sm" />
                <span>
                  <strong>{row.ticker}</strong>
                  <em>{row.description}</em>
                </span>
              </span>
              <span className="g-table-quote">{row.quote}</span>
              <span className="g-table-status">
                <span className={`g-dot${row.statusKind === "live" ? " live" : ""}`} />
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
        <span>Create from a post</span>
        <ol>
          <li>Choose a post</li>
          <li>Review details</li>
          <li>Sign in wallet</li>
        </ol>
      </footer>
    </main>
  );
}
