"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { FAUCET_URL, XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import { shortAddr } from "@/lib/wallet";
import type { TradePrefill } from "@/lib/tradePrefill";
import { homeMarkets } from "@/lib/marketsRegistry";

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
  kind: "aggregated-usdc-to-graav";
  hops: AggregatedHop[];
  hopFamilies?: HopFamily[];
  buyEnabled: boolean;
  settleReady: boolean;
  swapReady: boolean;
  preferredSettleAsset?: string;
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
  const priority = sources.filter((s) => s.group === "priority3");
  const top7 = sources.filter((s) => s.group === "top7");
  const enabled = sources.filter((s) => s.ok && s.result === "PASS");
  const providers = probe?.providers ?? [];
  const path = probe?.path;
  const anyPass = !!(probe?.anyPass && path?.buyEnabled);
  const selected = sources.find((s) => s.key === selectedKey) ?? null;
  const settleBlocked = !path?.settleReady;
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
        <h1 className="g-title">Aggregated (*) Pay-with-USDC → market token</h1>
        <p className="g-sub" style={{ marginTop: 8 }}>
          Source USDC → multi-provider settle onto XRPL EVM{" "}
          {XRPL_EVM_TESTNET_ID} → swap market token via /s. Not hold-USDC-on-dest.
          Not single-bridge. Prefer native XRP land.
        </p>
        <p className="g-hint" style={{ marginTop: 8 }}>
          SoT: AGGREGATED_USDC_SETTLE_SOT · fail-closed · Buy only on live E2E
          PASS · never invent.
        </p>
      </section>

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
              id: "aggregator-settle",
              label: "Settle 1449000",
              status: "blocked" as const,
              detail: "",
            },
            {
              id: "swap-market",
              label: "Swap via /s",
              status: "ready" as const,
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
          <span>preferred settle</span>
          <span>native XRP only (msg.value) — never USDC/RLUSD into Market/V2</span>
        </div>
        <div className="g-kv">
          <span>swapReady ≠ buyEnabled</span>
          <span>
            swap {path?.swapReady ? "ready" : "no"} · buy{" "}
            {path?.buyEnabled ? "ON" : "OFF"}
          </span>
        </div>
        <p className="g-hint" style={{ marginTop: 8 }}>
          Kernel: Hop A blocked · Hop B must land native XRP on 1449000 ·
          dual-factory M2 vs M2.2 · T589 scar · buyEnabled only on settleReady +
          live XRP-land PASS.
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
          Josh hop families (candidates)
        </div>
        <div className="space-y-2">
          {(path?.hopFamilies ?? [
            {
              id: "A" as const,
              label: "A — RLUSD corridor",
              status: "blocked" as const,
              legs: ["USDC", "RLUSD ETH", "RLUSD xrpl-evm", "XRP EVM", "market /s"],
              detail: "Probe loading…",
            },
            {
              id: "B" as const,
              label: "B — XRP corridor",
              status: "partial" as const,
              legs: ["USDC", "XRP other chains", "XRP xrpl-evm", "market /s"],
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
          Catalog ≠ E2E PASS. buyEnabled stays 0 until live quote+tx.
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

      {/* Source select + honest handoff */}
      <div className="g-card">
        <div style={{ fontWeight: 650 }}>Source → then swap $TICKER via /s</div>
        <p className="g-micro" style={{ marginTop: 4, color: "var(--muted)" }}>
          Select a source to plan hop 3 even if settle is blocked.
        </p>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
          {sources.map((s) => (
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
        </div>
        {selected && (
          <div style={{ marginTop: 12 }}>
            {settleBlocked ? (
              <div className="g-alert warn">
                Path planned, settle blocked — {selected.label} → 1449000 has no
                live E2E PASS. You can still open Trade /s for ${ticker} (faucet
                gas).
              </div>
            ) : (
              <div className="g-alert" style={{ borderColor: "var(--good)" }}>
                Settle ready for {selected.label}. Continue to Trade /s.
              </div>
            )}
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
                Then swap to ${ticker} via /s
              </button>
              <button
                type="button"
                className="g-cta"
                style={{
                  marginTop: 0,
                  width: "auto",
                  padding: "8px 14px",
                  opacity: anyPass && selected.ok ? 1 : 0.45,
                }}
                disabled={!anyPass || !selected.ok}
                title={
                  anyPass && selected.ok
                    ? `Buy with USDC from ${selected.label}`
                    : "Buy disabled until settle PASS"
                }
              >
                Buy from {selected.label}
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
              Priority 3 — Base · Hyperliquid · Robinhood
            </div>
            {priority.map((leg) => (
              <SourceCard
                key={leg.key}
                leg={leg}
                anyPass={anyPass}
                onSelect={() => setSelectedKey(leg.key)}
                selected={selectedKey === leg.key}
              />
            ))}

            <div style={{ fontWeight: 650, marginTop: 8 }}>
              Top 7 v1 testnets
            </div>
            {top7.map((leg) => (
              <SourceCard
                key={leg.key}
                leg={leg}
                anyPass={anyPass}
                onSelect={() => setSelectedKey(leg.key)}
                selected={selectedKey === leg.key}
              />
            ))}
          </div>
        )}
      </div>

      {probe && !anyPass && (
        <p className="g-hint">
          No Buy CTAs enabled — no provider proves E2E USDC → {XRPL_EVM_TESTNET_ID}.
          Axelar lists dest but USDC ITS not registered. Use faucet + Trade on
          destination.
        </p>
      )}

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
