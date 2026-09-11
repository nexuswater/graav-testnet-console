"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { FAUCET_URL, XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import { shortAddr } from "@/lib/wallet";
import type { TradePrefill } from "@/lib/tradePrefill";
import {
  DEFERRED_REASON,
  isActiveCorridor,
  type CorridorGate,
} from "@/lib/crosschain/corridor";
import { BaseSepoliaCorridorCard } from "@/components/tabs/BaseSepoliaCorridorCard";

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
  return "var(--warn)";
}

function hopStatusColor(s: string): string {
  if (s === "ready" || s === "pass") return "var(--good)";
  if (s === "planned" || s === "partial" || s === "candidate") return "var(--warn)";
  return "var(--muted)";
}

export function CrossChainTab({ onGoTrade }: Props) {
  const { address, isConnected } = useAccount();
  const [probe, setProbe] = useState<ProbeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

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
        setErr(data.error || `Route check failed (HTTP ${res.status})`);
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
  const providers = probe?.providers ?? [];
  const path = probe?.path;
  const corridor = probe?.corridor ?? null;
  const gateOpen = !!(probe?.anyPass && path?.buyEnabled && corridor?.pass);
  const checks = corridor?.checks ?? [];
  const okCount = checks.filter((k) => k.ok).length;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="g-title">Funding</h1>
        <p className="g-sub" style={{ marginTop: 8 }}>
          Bring USDC in from another chain and land as RLUSD on XRPL EVM. Buying through a
          corridor opens only once its live route checks pass.
        </p>
      </section>

      <BaseSepoliaCorridorCard />

      <div className="g-card">
        <div style={{ fontWeight: 650 }}>Already on XRPL EVM?</div>
        <p className="g-sub" style={{ marginTop: 4 }}>
          You only need XRP for gas. Then trade from a post or DM on X, or in the in-app rail.
        </p>
        <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            className="g-btn sm"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}
          >
            Get XRP (faucet)
          </a>
          <button
            type="button"
            onClick={() => onGoTrade()}
            className="g-btn sm"
            style={{ background: "var(--cta-bg)", color: "var(--cta-fg)", border: 0, fontWeight: 650 }}
          >
            Open Trade
          </button>
        </div>
      </div>

      <details className="g-details">
        <summary>Route diagnostics</summary>

        <div className="g-card" style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 650 }}>Catalog checks</div>
          <p className="g-hint" style={{ marginTop: 4 }}>
            Provider catalogs only — being listed is not a route. The card above is the live verdict.
          </p>
          <ol className="g-route-order g-corridor-checks" aria-label="Catalog checks" style={{ marginTop: 8 }}>
            {checks.map((k) => (
              <li key={k.id}>
                <span className="g-micro">{k.ok ? "OK" : "—"}</span>
                <span>
                  <strong>{k.label}</strong>
                  <em>{k.detail}</em>
                </span>
              </li>
            ))}
            {!corridor && (
              <li>
                <span className="g-micro">{loading ? "…" : "—"}</span>
                <strong>{loading ? "Checking catalogs…" : err || "Catalog check unavailable"}</strong>
              </li>
            )}
          </ol>
          {checks.length > 0 && (
            <p className="g-micro" style={{ marginTop: 8, color: "var(--muted)" }}>
              {okCount} of {checks.length} catalog checks pass.
            </p>
          )}
        </div>

        <div className="g-card" style={{ marginTop: 12 }}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div style={{ fontWeight: 650 }}>
              Aggregated path
              {path?.kind && (
                <span className="g-micro" style={{ marginLeft: 8 }}>
                  {path.kind}
                </span>
              )}
            </div>
            <button
              type="button"
              className="g-btn sm"
              disabled={loading}
              onClick={() => void runProbe()}
            >
              {loading ? "Checking…" : "Re-check"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 items-stretch" style={{ margin: "10px 0 8px" }}>
            {(path?.hops ?? []).map((h, i) => (
              <div key={h.id} className="flex items-center gap-2" style={{ flex: "1 1 140px" }}>
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
            <span>Buy enabled</span>
            <span>{path?.buyEnabled ? "yes" : "no"}</span>
          </div>
          <div className="g-kv">
            <span>Settle ready</span>
            <span>{path?.settleReady ? "yes" : "no"}</span>
          </div>
          <div className="g-kv">
            <span>Swap ready</span>
            <span>{path?.swapReady ? "yes" : "no"}</span>
          </div>
          <div className="g-kv">
            <span>Live quote</span>
            <span>{path?.squidQuoteLive ? "yes" : "no"}</span>
          </div>
          {path?.axelarItsOnDest && (
            <div className="g-kv">
              <span>Axelar ITS on XRPL EVM</span>
              <span>
                XRP {path.axelarItsOnDest.xrp ? "yes" : "no"} · RLUSD{" "}
                {path.axelarItsOnDest.rlusd ? "yes" : "no"} · USDC{" "}
                {path.axelarItsOnDest.usdc ? "yes" : "no"}
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
          {probe?.note && (
            <p className="g-hint" style={{ marginTop: 8 }}>
              {probe.note}
            </p>
          )}
        </div>

        {path?.hopFamilies && path.hopFamilies.length > 0 && (
          <div className="g-card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 650, marginBottom: 8 }}>Routing lanes</div>
            <div className="space-y-2">
              {path.hopFamilies.map((f) => (
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
          </div>
        )}

        <div className="g-card" style={{ marginTop: 12 }}>
          <div className="g-sub">Destination wallet</div>
          <div className="g-mono" style={{ marginTop: 6, color: "var(--text)" }}>
            {isConnected && dest ? dest : "Connect a wallet to set the destination"}
          </div>
          {isConnected && dest && (
            <div className="g-micro" style={{ marginTop: 4 }}>
              {shortAddr(dest)}
            </div>
          )}
        </div>

        {err && (
          <div className="g-alert warn" style={{ marginTop: 12 }}>
            {err}
          </div>
        )}

        {probe && (
          <div className="g-card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 650 }}>Providers</div>
            <div className="g-micro" style={{ marginTop: 2 }}>
              Axelar · Squid · LI.FI · deBridge · LayerZero · Wormhole · Socket · Skip
            </div>
            {providers.length > 0 && (
              <div className="space-y-2" style={{ marginTop: 12 }}>
                {providers.map((p) => (
                  <ProviderCard key={p.id} row={p} />
                ))}
              </div>
            )}

            <div style={{ fontWeight: 650, marginTop: 16 }}>Source chains</div>
            <div className="space-y-2" style={{ marginTop: 8 }}>
              {active.map((leg) => (
                <SourceCard key={leg.key} leg={leg} gateOpen={gateOpen} />
              ))}
            </div>
            {deferred.length > 0 && (
              <p className="g-micro" style={{ marginTop: 10, color: "var(--muted)" }}>
                Not checked yet: {deferred.map((leg) => leg.label).join(" · ")} — {DEFERRED_REASON}
              </p>
            )}
          </div>
        )}
      </details>
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
        <span>Lists XRPL EVM {XRPL_EVM_TESTNET_ID}</span>
        <span>{row.hasDest ? "yes" : "no"}</span>
      </div>
      <div className="g-kv">
        <span>USDC on destination</span>
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

function SourceCard({ leg, gateOpen }: { leg: ProbeLeg; gateOpen: boolean }) {
  const buyOk = gateOpen && leg.ok;
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
          {leg.label}{" "}
          <span className="g-micro">
            ({leg.fromChainId ?? "—"}) → {leg.toChainId ?? XRPL_EVM_TESTNET_ID}
          </span>
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
        <span>USDC on source</span>
        <span>{leg.hasUsdc ? "yes" : "no"}</span>
      </div>
      {leg.providers && leg.providers.length > 0 && (
        <div className="g-micro" style={{ marginTop: 6, color: "var(--muted)" }}>
          {leg.providers
            .filter((p) => ["squid", "axelar", "lifi", "debridge"].includes(p.id))
            .map((p) => `${p.id}: ${p.result}`)
            .join(" · ")}
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
      <button
        type="button"
        className="g-cta"
        style={{ marginTop: 10, width: "auto", padding: "8px 14px" }}
        disabled={!buyOk}
        title={buyOk ? `Buy with USDC from ${leg.label}` : "Opens once the live route checks pass"}
      >
        Buy from {leg.label}
      </button>
    </div>
  );
}
