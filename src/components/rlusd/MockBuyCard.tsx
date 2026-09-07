"use client";
import { useState } from "react";
import Link from "next/link";

export function MockBuyCard({ xPostId }: { xPostId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [state, setState] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function begin() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/rlusd/buy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ xPostId, grossQuote: "5000000000000000000", referralXId: "10001" }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error || "Unable to create session");
      setSessionId(json.session.id); setState(json.session);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function execute(action = "BUY") {
    if (!sessionId) return; setBusy(true); setError(null);
    try { const res = await fetch(`/api/rlusd/session/${sessionId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }); const json = await res.json(); if (!res.ok) throw new Error(json.error || "Execution failed"); setState(json.session); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const complete = state?.status === "COMPLETE";
  const sellDone = state?.sellQuoteOut !== undefined;
  return <div className="g-card rlusd-buy-card" style={{ marginTop: 20 }}>
    <div className="g-status">BUY RLUSD</div>
    <h2 className="g-display" style={{ fontSize: 25, marginTop: 8 }}>Buy 5 RLUSD</h2>
    <p className="g-sub" style={{ marginTop: 8 }}>RLUSD quote · preview the market before your wallet signs</p>
    {!sessionId ? <button className="g-cta rlusd-primary-cta" onClick={() => void begin()} disabled={busy}>{busy ? "Preparing…" : "Prepare 5 RLUSD session"}</button> : <>
      <div className="g-kv" style={{ marginTop: 16 }}><span>Session</span><span className="g-mono">{sessionId.slice(0, 24)}…</span></div>
      <div className="g-kv"><span>State</span><span>{complete ? "destination BUY verified" : "awaiting execution"}</span></div>
      {state?.tokensOut && <div className="g-kv"><span>Tokens out</span><span className="g-mono">{String(state.tokensOut)}</span></div>}
      {state?.referralCredit && <div className="g-kv"><span>Referral credit</span><span>{String(state.referralCredit)} base units</span></div>}
      {!complete && <button className="g-cta" onClick={() => void execute()} disabled={busy}>{busy ? "Executing…" : "Execute destination BUY"}</button>}
      {complete && !sellDone && <button className="g-cta" onClick={() => void execute("SELL")} disabled={busy}>{busy ? "Selling…" : "SELL tokens against actual reserve"}</button>}
      {sellDone && <div className="g-alert good" style={{ marginTop: 12 }}>SELL complete against actual reserve: {String(state.sellQuoteOut)} RLUSD base units out.</div>}
      <Link href={`/s/${sessionId}`} className="g-cta ghost" style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 12 }}>Open signing-session view</Link>
    </>}
    {error && <div className="g-alert bad" style={{ marginTop: 12 }}>{error}</div>}
  </div>;
}
