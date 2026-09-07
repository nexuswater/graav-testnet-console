"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { keccak256, stringToHex } from "viem";
import { AppChrome } from "@/components/AppChrome";
import { RLUSD_CLONE_FACTORY_ADDRESS, SESSION_CHAIN_ID } from "@/lib/sessionAllowlist";

const shortFactory = `${RLUSD_CLONE_FACTORY_ADDRESS.slice(0, 6)}…${RLUSD_CLONE_FACTORY_ADDRESS.slice(-4)}`;

export default function LaunchPage() {
  const router = useRouter();
  const [sourcePostId, setSourcePostId] = useState("demo-moment-2026");
  const [name, setName] = useState("Moment Coin");
  const [ticker, setTicker] = useState("MOMENT");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const post = sourcePostId.trim();
    const cleanName = name.trim();
    const cleanTicker = ticker.trim().toUpperCase();
    if (!post || !cleanName || !/^[A-Z][A-Z0-9_]{0,14}$/.test(cleanTicker)) {
      setError("Add a source post, name, and a ticker starting with a letter (1–15 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const originHash = keccak256(stringToHex(post));
      const response = await fetch("/api/s/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          chainId: SESSION_CHAIN_ID,
          factory: RLUSD_CLONE_FACTORY_ADDRESS,
          amount: "0",
          minOut: "0",
          createName: cleanName,
          createSymbol: cleanTicker,
          metadataURI: "",
          originHash,
          originTweetId: post,
        }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Could not create signing session");
      router.push(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <AppChrome>
      <main className="g-main" style={{ maxWidth: 620, margin: "0 auto", width: "100%" }}>
        <div className="g-pill" style={{ display: "inline-block" }}>COIN V1</div>
        <h1 className="g-display" style={{ marginTop: 16 }}>Moment → Coin</h1>
        <p className="g-sub" style={{ marginTop: 10 }}>Draft a coin from an X Moment, then review and sign the CREATE_MARKET request in your wallet.</p>
        <form className="g-card" style={{ marginTop: 20 }} onSubmit={(event) => void createDraft(event)}>
          <div className="g-field">
            <label htmlFor="source-post">Source X post ID</label>
            <input id="source-post" className="sm" value={sourcePostId} onChange={(event) => setSourcePostId(event.target.value)} placeholder="post id" required />
            <p className="g-hint" style={{ marginTop: 6 }}>The post id is hashed into the factory request; no post is published here.</p>
            <label htmlFor="coin-name" style={{ marginTop: 16 }}>Coin name</label>
            <input id="coin-name" className="sm" value={name} onChange={(event) => setName(event.target.value)} required />
            <label htmlFor="coin-ticker" style={{ marginTop: 16 }}>Ticker</label>
            <input id="coin-ticker" className="sm" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 15))} required />
          </div>
          <div className="g-kv" style={{ marginTop: 18 }}><span>Quote</span><span>RLUSD</span></div>
          <div className="g-kv"><span>Network</span><span>XRPL EVM Testnet · {SESSION_CHAIN_ID}</span></div>
          <div className="g-kv"><span>Factory</span><span className="g-mono" title={RLUSD_CLONE_FACTORY_ADDRESS}>{shortFactory}</span></div>
          <button type="submit" className="g-cta" style={{ marginTop: 20 }} disabled={busy}>{busy ? "Opening signing session…" : "Review CREATE_MARKET"}</button>
          {error && <div className="g-alert bad" style={{ marginTop: 12 }} role="alert">{error}</div>}
        </form>
        <div className="g-alert" style={{ marginTop: 16 }}>Chat and this draft only prepare intent. The next screen is the signing session; only your wallet can approve and send the transaction.</div>
      </main>
    </AppChrome>
  );
}
