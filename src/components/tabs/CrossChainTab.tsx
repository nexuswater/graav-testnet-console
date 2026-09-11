"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { FAUCET_URL, XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import { shortAddr } from "@/lib/wallet";
import type { TradePrefill } from "@/lib/tradePrefill";
import { homeMarkets } from "@/lib/marketsRegistry";
import { CROSS_CHAIN_FAIL_CLOSED_LINE } from "@/lib/xPrimary";
import {
  BASE_SEPOLIA_CORRIDOR,
  CORRIDOR_ORDER_LINE,
  DEFERRED_CORRIDORS,
  DEFERRED_REASON,
  NO_LIVE_QUOTE_LINE,
  isActiveCorridor,
  type CorridorGate,
} from "@/lib/crosschain/corridor";

type ProbeStatus = "ok" | "blocked" | "unsupported";

type ProviderRow = {
  id: string;
  label: string;
  queried: boolean;
  result: "PASS" | "FAIL" | "PARTIAL";
  hasDest: boolean;
  hasUsdcOnDest: boolean;
  detail: string;
  chainCount?: number;
  notes?: string;
};

type ProbeLeg = {
  key: string;
  label: string;
  ok: boolean;
  result: "PASS" | "FAIL";
  status: ProbeStatus;
  reason: string;
  provider?: string;
  providers?: { id: string; result: "PASS" | "FAIL" | "PARTIAL"; detail: string }[];
  fromChainId?: number;
  toChainId?: number;
  hasUsdc: boolean;
  usdcAddress?: string | null;
  substitute?: {
    label: string;
    chainId: number;
    inSquid: boolean;
    hasUsdc: boolean;
    usdcAddress?: string | null;
  };
  nextStep?: string;
  group: "priority3" | "top7";
};

type AggregatedHop = {
  id: string;
  label: string;
  status: "planned" | "ready" | "blocked";
  detail: string;
};

type HopFamily = {
  id: "A" | "B";
  label: string;
  status: "candidate" | "partial" | "blocked" | "pass";
  legs: string[];
  detail: string;
};

type AggregatedPath = {
  kind: "aggregated-usdc-to-rlusd";
  hops: AggregatedHop[];
  hopFamilies?: HopFamily[];
  buyEnabled: boolean;
  settleReady: boolean;
  swapReady: boolean;
  preferredSettleAsset?: string;
  preferredDestinationAsset?: string;
  squidQuoteLive?: boolean;
  mainnetTargetChainId?: number;
  axelarItsOnDest?: {
    xrp: boolean;
    rlusd: boolean;
    usdc: boolean;
    symbols: string[];
  };
};

type ProbeResponse = {
  destChainId: number;
  destLabel: string;
  faucet: string;
  note?: string;
  anyPass?: boolean;
  buyEnabledCount?: number;
  corridor?: CorridorGate;
  path?: AggregatedPath;
  providers?: ProviderRow[];
  squid: {
    queried: boolean;
    integrator: string;
    chainCount?: number;
    hasDest: boolean;
    notedMainnetXrplEvm?: string;
  };
  sources: ProbeLeg[];
  dest?: string | null;
};

type Props = {
  onGoTrade: (prefill?: TradePrefill) => void;
};

function resultColor(r: "PASS" | "FAIL" | "PARTIAL"): string {
  if (r === "PASS") return "var(--good)";
  if (r === "PARTIAL") return "var(--warn)";
  return "var(--warn)";
}

function hopStatusColor(s: string): string {
  if (s === "ready" || s === "pass") return "var(--good)";
  if (s === "planned" || s === "partial" || s === "candidate") return "var(--warn)";
  return "var(--muted)";
}

const DEFAULT_TICKER = "g589";

export function CrossChainTab({ onGoTrade }: Props) {
  const { address, isConnected } = useAccount();
  const [probe, setProbe] = useState<ProbeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [ticker, setTicker] = useState(DEFAULT_TICKER);

  const runProbe = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/crosschain/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dest: address || undefined }),
      });
      const data = (await res.json()) as ProbeResponse & { error?: string };
      if (!res.ok) {
        setErr(data.error || `Probe HTTP ${res.status}`);
        setProbe(null);
        return;
      }
      setProbe(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setProbe(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    void runProbe();
  }, [runProbe]);

  const dest = address || null;
  const sources = probe?.sources ?? [];
  const active = sources.filter((s) => isActiveCorridor(s.key));
  const deferred = sources.filter((s) => !isActiveCorridor(s.key));
  const enabled = sources.filter((s) => s.ok && s.result === "PASS");
  const providers = probe?.providers ?? [];
  const path = probe?.path;
  const corridor = probe?.corridor ?? null;
  const anyPass = !!(probe?.anyPass && path?.buyEnabled && corridor?.pass);
  const selected = sources.find((s) => s.key === selectedKey && isActiveCorridor(s.key)) ?? null;
  const featured = homeMarkets();

  const handoffTrade = (sym: string) => {
    onGoTrade({
      action: "buy",
      side: "buy",
      symbol: sym,
      loadQuery: sym,
    });
  };

  return (
    <div className="space-y-5">
      <section>
        <h1 className="g-title">Funding</h1>
        <p className="g-sub" style={{ marginTop: 8 }}>
          Home is XRPL EVM Testnet {XRPL_EVM_TESTNET_ID} with Test RLUSD. Testnet funding stays fail-closed. Mainnet Buy is closed.
        </p>
        <p className="g-hint" style={{ marginTop: 8 }}>
          {CORRIDOR_ORDER_LINE} Probe diagnostics stay behind Details. Daily ops stay on X.
        </p>
      </section>

      <div className="g-card g-corridor" aria-labelledby="base-corridor-title">
        <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginBottom: 8 }}>
          <div>
            <div id="base-corridor-title" style={{ fontWeight: 650 }}>
              First corridor · {BASE_SEPOLIA_CORRIDOR.label}
            </div>
            <div className="g-micro" style={{ marginTop: 2 }}>
              {BASE_SEPOLIA_CORRIDOR.path} · {BASE_SEPOLIA_CORRIDOR.via}
            </div>
          </div>
          <span className="g-pill g-corridor-status" data-pass={corridor?.pass ? "true" : "false"}>
            {loading && !corridor ? "PROBING" : corridor?.status ?? "FAIL-CLOSED"}
          </span>
        </div>
        <ol className="g-route-order g-corridor-checks" aria-label="Base Sepolia route checks">
          {(corridor?.checks ?? []).map((k) => (
            <li key={k.id}>
              <span className="g-micro">{k.ok ? "OK" : "BLOCK"}</span>
              <span>
                <strong>{k.label}</strong>
                <em>{k.detail}</em>
              </span>
            </li>
          ))}
          {!corridor && (
            <li>
              <span className="g-micro">{loading ? "…" : "—"}</span>
              <strong>{loading ? "Probing Base Sepolia catalogs…" : err || "Probe unavailable — fail-closed"}</strong>
            </li>
          )}
        </ol>
        <p className="g-hint">
          {CROSS_CHAIN_FAIL_CLOSED_LINE} {NO_LIVE_QUOTE_LINE} Buy stays disabled until every
          check is OK on Base. Catalog presence ≠ live quote.
        </p>
        <div className="g-corridor-deferred">
          <span className="g-micro">NEXT</span>
          <span>
            {DEFERRED_CORRIDORS.filter((d) => d.stage === "after-base").map((d) => d.label).join(" · ")} — only after Base Sepolia PASS.
          </span>
        </div>
        <div className="g-corridor-deferred" style={{ marginTop: 6, paddingTop: 6 }}>
          <span className="g-micro">LATER</span>
          <span>
            {DEFERRED_CORRIDORS.filter((d) => d.stage === "later").map((d) => d.label).join(" · ")} — {DEFERRED_REASON}
          </span>
        </div>
      </div>

      <div className="g-alert">
        Availability: testnet Buy is disabled. {NO_LIVE_QUOTE_LINE} Base Sepolia is the only corridor under check.
      </div>

      <details className="g-details">
        <summary>Details</summary>

      {/* Primary story: step strip */}
      <div className="g-card">
        <div style={{ fontWeight: 650, marginBottom: 10 }}>
          Aggregated path
          {path?.kind && (
            <span className="g-micro" style={{ marginLeft: 8 }}>
              {path.kind}
            </span>
          )}
        </div>
        <div
          className="flex flex-wrap gap-2 items-stretch"
          style={{ marginBottom: 8 }}
        >
          {(path?.hops ?? [
            {
              id: "source-usdc",
              label: "USDC source",
              status: "planned" as const,
              detail: "",
            },
            {
              id: "squid-quote",
              label: "Squid quote: USDC → RLUSD",
              status: "blocked" as const,
              detail: "",
            },
            {
              id: "rlusd-mainnet",
              label: "RLUSD on XRPL EVM 1440000",
              status: "blocked" as const,
              detail: "",
            },
          ]).map((h, i) => (
            <div
              key={h.id}
              className="flex items-center gap-2"
              style={{ flex: "1 1 140px" }}
            >
              {i > 0 && (
                <span className="g-micro" style={{ color: "var(--muted)" }}>
                  →
                </span>
              )}
              <div
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1px solid ${hopStatusColor(h.status)}`,
                  background: "var(--bg-2)",
                }}
              >
                <div className="g-micro" style={{ color: hopStatusColor(h.status) }}>
                  {h.status.toUpperCase()}
                </div>
                <div style={{ fontWeight: 650, fontSize: 13, marginTop: 2 }}>
                  {h.label}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="g-kv">
          <span>buyEnabled</span>
          <span>{path?.buyEnabled ? "true" : "false"} (count {probe?.buyEnabledCount ?? 0})</span>
        </div>
        <div className="g-kv">
          <span>settleReady</span>
          <span>{path?.settleReady ? "yes" : "no"}</span>
        </div>
        <div className="g-kv">
          <span>swapReady</span>
          <span>{path?.swapReady ? "yes" : "no"}</span>
        </div>
        <div className="g-kv">
          <span>policy target</span>
          <span>USDC → RLUSD · XRPL EVM 1440000</span>
        </div>
        <div className="g-kv">
          <span>Squid live quote</span>
          <span>{path?.squidQuoteLive ? "yes" : "no — Buy fail-closed"}</span>
        </div>
        <div className="g-kv">
          <span>testnet Buy (1449000)</span>
          <span>OFF — fail-closed</span>
        </div>
        <div className="g-kv">
          <span>display asset</span>
          <span>RLUSD only</span>
        </div>
        <p className="g-hint" style={{ marginTop: 8 }}>
          Squid is the preferred USDC→RLUSD lane for mainnet 1440000. Buy stays off until a live quote + depth smoke proves the corridor.
        </p>
        {path?.axelarItsOnDest && (
          <div className="g-kv">
            <span>Axelar ITS on xrpl-evm</span>
            <span>
              XRP={path.axelarItsOnDest.xrp ? "yes" : "no"} · RLUSD=
              {path.axelarItsOnDest.rlusd ? "yes" : "no"} · USDC=
              {path.axelarItsOnDest.usdc ? "yes" : "no"}
              {path.axelarItsOnDest.symbols?.length
                ? ` · [${path.axelarItsOnDest.symbols.join(", ")}]`
                : ""}
            </span>
          </div>
        )}
        {path?.hops?.map((h) =>
          h.detail ? (
            <p key={`d-${h.id}`} className="g-micro" style={{ marginTop: 6, color: "var(--muted)" }}>
              {h.label}: {h.detail}
            </p>
          ) : null
        )}
      </div>

      {/* Hop families A / B */}
      <div className="g-card">
        <div style={{ fontWeight: 650, marginBottom: 8 }}>
          Aggregated* routing policy lanes
        </div>
        <div className="space-y-2">
          {(path?.hopFamilies ?? [
            {
              id: "A" as const,
              label: "A — Squid Intents USDC→RLUSD",
              status: "blocked" as const,
              legs: ["USDC source", "live Squid quote", "RLUSD XRPL EVM 1440000"],
              detail: "Probe loading…",
            },
            {
              id: "B" as const,
              label: "B — Native RLUSD peers",
              status: "candidate" as const,
              legs: ["RLUSD", "Wormhole NTT / Axelar ITS", "RLUSD peer"],
              detail: "Probe loading…",
            },
          ]).map((f) => (
            <div
              key={f.id}
              style={{
                padding: 12,
                borderRadius: 10,
                border: `1px solid ${hopStatusColor(f.status)}`,
                background: "var(--bg-2)",
              }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div style={{ fontWeight: 650 }}>{f.label}</div>
                <span
                  className="g-pill"
                  style={{
                    background: "transparent",
                    border: `1px solid ${hopStatusColor(f.status)}`,
                    color: hopStatusColor(f.status),
                    fontSize: 11,
                  }}
                >
                  {f.status.toUpperCase()}
                </span>
              </div>
              <div className="g-micro" style={{ marginTop: 6, color: "var(--text)" }}>
                {f.legs.join(" → ")}
              </div>
              <p className="g-micro" style={{ marginTop: 6, color: "var(--muted)" }}>
                {f.detail}
              </p>
            </div>
          ))}
        </div>
        <p className="g-hint" style={{ marginTop: 8 }}>
          Catalog presence ≠ live quote. Buy stays OFF until Squid proves USDC→RLUSD.
        </p>
      </div>

      <div className="g-card">
        <div className="g-sub">Destination wallet</div>
        <div className="g-mono" style={{ marginTop: 6, color: "var(--text)" }}>
          {isConnected && dest ? dest : "Connect wallet to set destination 0x"}
        </div>
        {isConnected && dest && (
          <div className="g-micro" style={{ marginTop: 4 }}>
            short {shortAddr(dest)}
          </div>
        )}
      </div>

      {/* Source select + honest handoff — Base only this slice */}
      <div className="g-card">
        <div style={{ fontWeight: 650 }}>Source USDC → RLUSD (Base Sepolia first)</div>
        <p className="g-micro" style={{ marginTop: 4, color: "var(--muted)" }}>
          Only Base Sepolia is wired for route checks. Testnet Buy is fail-closed.
        </p>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
          {active.map((s) => (
            <button
              key={s.key}
              type="button"
              className="g-btn sm"
              style={{
                opacity: selectedKey === s.key ? 1 : 0.75,
                outline:
                  selectedKey === s.key ? "2px solid var(--good)" : undefined,
              }}
              onClick={() => setSelectedKey(s.key)}
            >
              {s.label}
            </button>
          ))}
          {deferred.map((s) => (
            <button
              key={s.key}
              type="button"
              className="g-btn sm"
              disabled
              title={DEFERRED_REASON}
              style={{ opacity: 0.4, cursor: "not-allowed" }}
            >
              {s.label} · deferred
            </button>
          ))}
        </div>
        {selected && (
          <div style={{ marginTop: 12 }}>
            <div className="g-alert warn">
              No live Squid USDC→RLUSD quote from Base Sepolia. Testnet Buy on 1449000 stays disabled.
            </div>
            <div className="flex flex-wrap gap-2 items-center" style={{ marginTop: 10 }}>
              <label className="g-micro">
                Ticker{" "}
                <select
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  style={{
                    marginLeft: 6,
                    background: "var(--bg-2)",
                    color: "var(--text)",
                    border: "1px solid var(--line-2)",
                    borderRadius: 6,
                    padding: "4px 8px",
                  }}
                >
                  {featured.map((m) => (
                    <option key={m.ticker} value={m.ticker}>
                      ${m.ticker}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="g-cta"
                style={{ marginTop: 0, width: "auto", padding: "8px 14px" }}
                onClick={() => handoffTrade(ticker)}
              >
                Local Trade rail ${ticker} (not Aggregated* Buy)
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="g-card">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div style={{ fontWeight: 650 }}>Provider matrix</div>
            <div className="g-micro" style={{ marginTop: 2 }}>
              Axelar · Squid · LI.FI · deBridge · LZ · Wormhole · Socket · Skip
            </div>
          </div>
          <button
            type="button"
            className="g-btn sm"
            disabled={loading}
            onClick={() => void runProbe()}
          >
            {loading ? "Probing…" : "Re-probe"}
          </button>
        </div>

        {err && (
          <div className="g-alert warn" style={{ marginTop: 12 }}>
            {err}
          </div>
        )}

        {probe && (
          <div className="space-y-3" style={{ marginTop: 12 }}>
            <div className="g-kv">
              <span>Verified-enabled Buy</span>
              <span>
                {probe.buyEnabledCount ?? enabled.length
                  ? enabled.map((e) => e.label).join(", ")
                  : "none (0)"}
              </span>
            </div>
            {probe.note && (
              <p className="g-hint" style={{ marginTop: 0 }}>
                {probe.note}
              </p>
            )}

            {providers.length > 0 && (
              <div className="space-y-2">
                {providers.map((p) => (
                  <ProviderCard key={p.id} row={p} />
                ))}
              </div>
            )}

            <div style={{ fontWeight: 650, marginTop: 8 }}>
              First corridor — Base Sepolia
            </div>
            {active.map((leg) => (
              <SourceCard
                key={leg.key}
                leg={leg}
                anyPass={anyPass}
                onSelect={() => setSelectedKey(leg.key)}
                selected={selectedKey === leg.key}
              />
            ))}

            <div style={{ fontWeight: 650, marginTop: 8 }}>
              Deferred — not probed this slice
            </div>
            <p className="g-micro" style={{ color: "var(--muted)" }}>
              Arbitrum Sepolia only after Base PASS · Robinhood / Hyperliquid later ·{" "}
              {deferred.filter((leg) => !DEFERRED_CORRIDORS.some((d) => d.key === leg.key)).map((leg) => leg.label).join(" · ")}
            </p>
          </div>
        )}
      </div>

      {probe && !anyPass && (
        <p className="g-hint">
          No Buy CTAs enabled — Base Sepolia has not proven E2E USDC → RLUSD → {XRPL_EVM_TESTNET_ID}.
          Use faucet + Trade on destination.
        </p>
      )}
      </details>

      <div className="g-card">
        <p className="g-sub">Get testnet XRP on XRPL EVM, then trade locally.</p>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            className="g-btn sm"
            style={{
              background: "var(--x)",
              color: "#fff",
              border: 0,
              fontWeight: 650,
              textDecoration: "none",
            }}
          >
            Open faucet
          </a>
          <button
            type="button"
            onClick={() => handoffTrade(ticker)}
            className="g-cta"
            style={{ marginTop: 0, width: "auto", padding: "8px 16px" }}
          >
            Trade on {XRPL_EVM_TESTNET_ID}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProviderCard({ row }: { row: ProviderRow }) {
  return (
    <div
      className="g-card"
      style={{
        marginTop: 0,
        padding: 12,
        borderColor: "var(--line-2)",
        background: "var(--bg-2)",
      }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div style={{ fontWeight: 650 }}>
          {row.label}
          {row.chainCount != null && (
            <span className="g-micro"> · {row.chainCount} chains</span>
          )}
        </div>
        <span
          className="g-pill"
          style={{
            background: "transparent",
            border: `1px solid ${resultColor(row.result)}`,
            color: resultColor(row.result),
            fontSize: 11,
          }}
        >
          {row.result}
        </span>
      </div>
      <div className="g-kv" style={{ marginTop: 8 }}>
        <span>Has dest {XRPL_EVM_TESTNET_ID}</span>
        <span>{row.hasDest ? "yes" : "no"}</span>
      </div>
      <div className="g-kv">
        <span>USDC on dest</span>
        <span>{row.hasUsdcOnDest ? "yes" : "no"}</span>
      </div>
      <p className="g-micro" style={{ marginTop: 8, color: "var(--muted)" }}>
        {row.detail}
      </p>
      {row.notes && (
        <p className="g-hint" style={{ marginTop: 6 }}>
          {row.notes}
        </p>
      )}
    </div>
  );
}

function SourceCard({
  leg,
  anyPass,
  onSelect,
  selected,
}: {
  leg: ProbeLeg;
  anyPass: boolean;
  onSelect: () => void;
  selected: boolean;
}) {
  const buyOk = anyPass && leg.ok;
  return (
    <div
      className="g-card"
      style={{
        marginTop: 0,
        padding: 12,
        borderColor: selected ? "var(--good)" : "var(--line-2)",
        background: "var(--bg-2)",
        cursor: "pointer",
      }}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div style={{ fontWeight: 650 }}>
            {leg.label}{" "}
            <span className="g-micro">
              ({leg.fromChainId ?? "—"}) → {leg.toChainId ?? XRPL_EVM_TESTNET_ID}
            </span>
          </div>
        </div>
        <span
          className="g-pill"
          style={{
            background: "transparent",
            border: `1px solid ${resultColor(leg.result)}`,
            color: resultColor(leg.result),
            fontSize: 11,
          }}
        >
          {leg.result}
        </span>
      </div>
      <div className="g-kv" style={{ marginTop: 8 }}>
        <span>USDC on source (Squid catalog)</span>
        <span>{leg.hasUsdc ? "yes" : "no"}</span>
      </div>
      {leg.providers && leg.providers.length > 0 && (
        <div className="g-micro" style={{ marginTop: 6, color: "var(--muted)" }}>
          {leg.providers
            .filter((p) =>
              ["squid", "axelar", "lifi", "debridge"].includes(p.id)
            )
            .map((p) => `${p.id}:${p.result}`)
            .join(" · ")}
        </div>
      )}
      {leg.substitute && (
        <div className="g-micro" style={{ marginTop: 6, color: "var(--muted)" }}>
          Substitute {leg.substitute.label} ({leg.substitute.chainId}): Squid{" "}
          {leg.substitute.inSquid ? "yes" : "no"} · USDC{" "}
          {leg.substitute.hasUsdc ? "yes" : "no"}
          {" — does not invent PASS to 1449000"}
        </div>
      )}
      <p className="g-micro" style={{ marginTop: 8, color: "var(--muted)" }}>
        {leg.reason}
      </p>
      {leg.nextStep && !leg.ok && (
        <p className="g-hint" style={{ marginTop: 6 }}>
          Next: {leg.nextStep}
        </p>
      )}
      <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="g-cta"
          style={{
            marginTop: 0,
            width: "auto",
            padding: "8px 14px",
            opacity: buyOk ? 1 : 0.45,
          }}
          disabled={!buyOk}
          title={
            buyOk
              ? `Buy with USDC from ${leg.label}`
              : leg.reason || "No proven USDC route"
          }
          onClick={(e) => {
            e.stopPropagation();
            if (!buyOk) return;
          }}
        >
          Buy from {leg.label}
        </button>
      </div>
    </div>
  );
}
