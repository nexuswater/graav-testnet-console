"use client";

import { useCallback, useEffect, useState } from "react";
import type { CorridorReport, GateId, Verdict } from "@/lib/rlusd-v1/baseSepoliaCorridor";
import { BASE_SEPOLIA_CORRIDOR, DEFERRED_CORRIDORS } from "@/lib/crosschain/corridor";

/** Plain labels for the server gate ids; the lib keeps its own SoT wording. */
const GATE_LABEL: Record<GateId, string> = {
  "source-chain": "Base Sepolia routable",
  "source-usdc": "USDC on Base Sepolia",
  "dest-chain": "XRPL EVM routable",
  "dest-rlusd": "RLUSD on XRPL EVM",
  "live-quote": "Live USDC → RLUSD quote",
  "native-bridge-asset": "Native bridge asset (Axelar)",
  "execution-adapter": "Reviewed execution adapter",
};

function verdictMark(v: Verdict): string {
  return v === "PASS" ? "OK" : v === "HOLD" ? "HOLD" : "—";
}

/**
 * Base Sepolia USDC → RLUSD (XRPL EVM) corridor. The verdict comes from the
 * server report only; Buy is enabled solely by `report.buyEnabled`.
 */
export function BaseSepoliaCorridorCard() {
  const [report, setReport] = useState<CorridorReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/crosschain/corridor/base-sepolia", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as (CorridorReport & { error?: string }) | null;
      if (!data || !data.verdict) {
        setErr(data?.error || `Route check failed (HTTP ${res.status})`);
        setReport(null);
        return;
      }
      setReport(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const buyOk = !!(report && report.verdict === "PASS" && report.buyEnabled);
  const gates = report?.gates ?? [];
  const okCount = gates.filter((g) => g.verdict === "PASS").length;
  const pillLabel = loading && !report ? "Checking" : buyOk ? "Open" : "Not yet open";
  const next = DEFERRED_CORRIDORS.filter((d) => d.stage === "after-base").map((d) => d.label).join(" · ");
  const later = DEFERRED_CORRIDORS.filter((d) => d.stage === "later").map((d) => d.label).join(" · ");

  return (
    <div className="g-card g-corridor" aria-labelledby="base-corridor-title">
      <div className="flex items-center justify-between gap-2 flex-wrap" style={{ marginBottom: 8 }}>
        <div>
          <div id="base-corridor-title" style={{ fontWeight: 650 }}>
            {BASE_SEPOLIA_CORRIDOR.label} → XRPL EVM
          </div>
          <div className="g-micro" style={{ marginTop: 2 }}>
            USDC → RLUSD · quote-only route check
          </div>
        </div>
        <span className="g-pill g-corridor-status" data-pass={buyOk ? "true" : "false"}>
          {pillLabel}
        </span>
      </div>

      {err && (
        <div className="g-alert warn" style={{ marginBottom: 10 }}>
          {err}
        </div>
      )}

      <ol className="g-route-order g-corridor-checks" aria-label="Route checks">
        {gates.map((g) => (
          <li key={g.id}>
            <span className="g-micro">{verdictMark(g.verdict)}</span>
            <span>
              <strong>{GATE_LABEL[g.id] ?? g.label}</strong>
              <em>{g.detail}</em>
            </span>
          </li>
        ))}
        {!report && (
          <li>
            <span className="g-micro">{loading ? "…" : "—"}</span>
            <strong>{loading ? "Checking route catalogs and quotes…" : "Route check unavailable"}</strong>
          </li>
        )}
      </ol>

      <p className="g-hint">
        {gates.length > 0 ? `${okCount} of ${gates.length} checks pass. ` : ""}
        Buy opens only once every check passes on live data and a reviewed execution adapter exists.
      </p>

      <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
        <button
          type="button"
          className="g-cta ghost"
          style={{ marginTop: 0, width: "auto", padding: "8px 14px" }}
          disabled={!buyOk}
          title={buyOk ? "Buy with USDC from Base Sepolia" : "Opens once the live route checks pass"}
        >
          Buy from {BASE_SEPOLIA_CORRIDOR.label}
        </button>
        <button type="button" className="g-btn sm" disabled={loading} onClick={() => void run()}>
          {loading ? "Checking…" : "Re-check"}
        </button>
      </div>

      <div className="g-corridor-deferred">
        <span className="g-micro">NEXT</span>
        <span>{next} — after {BASE_SEPOLIA_CORRIDOR.label} opens.</span>
      </div>
      <div className="g-corridor-deferred" style={{ marginTop: 6, paddingTop: 6 }}>
        <span className="g-micro">LATER</span>
        <span>{later}</span>
      </div>

      {report && (
        <details className="g-details" style={{ marginTop: 12 }}>
          <summary>Provider lanes</summary>
          <div className="g-kv">
            <span>Squid</span>
            <span>{report.lanes.squid}</span>
          </div>
          <div className="g-kv">
            <span>Axelar testnet</span>
            <span>{report.lanes.axelar}</span>
          </div>
          <div className="g-kv">
            <span>LI.FI</span>
            <span>{report.lanes.lifi}</span>
          </div>
          <div className="g-kv">
            <span>Execution adapter</span>
            <span>{report.executionAdapter.enabled ? "enabled" : report.executionAdapter.reason}</span>
          </div>
          <p className="g-micro" style={{ marginTop: 8, color: "var(--muted)" }}>
            {report.summary}
          </p>
          <p className="g-micro" style={{ color: "var(--muted)" }}>
            checked {report.fetchedAt} · {report.calls.length} provider calls · {report.calls.filter((c) => c.ok).length} ok
          </p>
        </details>
      )}
    </div>
  );
}
