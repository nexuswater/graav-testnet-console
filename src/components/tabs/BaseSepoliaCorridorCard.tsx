"use client";

import { useCallback, useEffect, useState } from "react";
import type { CorridorReport, Verdict } from "@/lib/rlusd-v1/baseSepoliaCorridor";

function verdictColor(v: Verdict): string {
  return v === "PASS" ? "var(--good)" : "var(--warn)";
}

/** Base Sepolia USDC → RLUSD (1449000) verdict. Buy is enabled only by the server report. */
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
        setErr(data?.error || `Corridor probe HTTP ${res.status}`);
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
  const verdict: Verdict | null = report?.verdict ?? null;

  return (
    <div className="g-card">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div style={{ fontWeight: 650 }}>Base Sepolia → XRPL EVM testnet</div>
          <div className="g-micro" style={{ marginTop: 2 }}>
            USDC (84532) → RLUSD (1449000) · read-only, quote-only probe
          </div>
        </div>
        <span
          className="g-pill"
          style={{
            background: "transparent",
            border: `1px solid ${verdict ? verdictColor(verdict) : "var(--line-2)"}`,
            color: verdict ? verdictColor(verdict) : "var(--muted)",
            fontSize: 11,
          }}
        >
          {loading ? "PROBING" : verdict ?? "ERROR"}
        </span>
      </div>

      {err && (
        <div className="g-alert warn" style={{ marginTop: 10 }}>
          {err}
        </div>
      )}

      {report && (
        <>
          <p className="g-micro" style={{ marginTop: 8, color: "var(--muted)" }}>
            {report.summary}
          </p>
          <div className="g-kv" style={{ marginTop: 8 }}>
            <span>buyEnabled</span>
            <span>{report.buyEnabled ? "true" : "false"}</span>
          </div>
          <div className="g-kv">
            <span>execution adapter</span>
            <span>{report.executionAdapter.enabled ? "enabled" : report.executionAdapter.reason}</span>
          </div>
          <details className="g-details" style={{ marginTop: 8 }}>
            <summary>Gates ({report.gates.filter((g) => g.verdict === "PASS").length}/{report.gates.length} pass)</summary>
            <div className="space-y-2" style={{ marginTop: 8 }}>
              {report.gates.map((g) => (
                <div key={g.id}>
                  <div className="g-kv">
                    <span>{g.label}</span>
                    <span style={{ color: verdictColor(g.verdict) }}>{g.verdict}</span>
                  </div>
                  <p className="g-micro" style={{ marginTop: 2, color: "var(--muted)" }}>
                    {g.detail}
                  </p>
                </div>
              ))}
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
              <p className="g-micro" style={{ color: "var(--muted)" }}>
                probed {report.fetchedAt} · {report.calls.length} provider calls · {report.calls.filter((c) => c.ok).length} ok
              </p>
            </div>
          </details>
        </>
      )}

      <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="g-cta"
          style={{ marginTop: 0, width: "auto", padding: "8px 14px", opacity: buyOk ? 1 : 0.45 }}
          disabled={!buyOk}
          title={buyOk ? "Buy with USDC from Base Sepolia" : report?.summary || "Corridor not proven"}
        >
          Buy from Base Sepolia
        </button>
        <button type="button" className="g-btn sm" disabled={loading} onClick={() => void run()}>
          {loading ? "Probing…" : "Re-probe corridor"}
        </button>
      </div>
    </div>
  );
}
