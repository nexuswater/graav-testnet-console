"use client";

import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { keccak256, stringToHex } from "viem";
import { useAccount } from "wagmi";
import { AppChrome } from "@/components/AppChrome";
import { RLUSD_CLONE_FACTORY_ADDRESS, SESSION_CHAIN_ID } from "@/lib/sessionAllowlist";
import type { PfpProfile } from "@/lib/pfpTypes";

const shortFactory = `${RLUSD_CLONE_FACTORY_ADDRESS.slice(0, 6)}…${RLUSD_CLONE_FACTORY_ADDRESS.slice(-4)}`;

export default function LaunchPage() {
  const router = useRouter();
  const { address } = useAccount();
  const [sourcePostId, setSourcePostId] = useState("");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [profile, setProfile] = useState<PfpProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = (next: File | null) => {
    setFile(next);
    setProfile(null);
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : null);
  };

  const uploadOrGenerate = useCallback(async (selectedFile: File | null): Promise<PfpProfile> => {
    const cleanTicker = ticker.trim().toUpperCase();
    if (!cleanTicker) throw new Error("Add a ticker before preparing the image.");
    const form = new FormData();
    form.set("ticker", cleanTicker);
    if (address) form.set("creator", address);
    if (selectedFile) form.set("file", selectedFile);
    else form.set("generate", "true");
    const response = await fetch("/api/pfp", { method: "POST", body: form });
    const data = (await response.json()) as PfpProfile & { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not prepare the token image");
    return data;
  }, [address, ticker]);

  const prepareImage = async (selectedFile: File | null) => {
    setBusy(true);
    setError(null);
    try {
      const next = await uploadOrGenerate(selectedFile);
      setProfile(next);
      setPreview(next.pfpURI);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const prepareCoin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const post = sourcePostId.trim();
    const cleanName = name.trim();
    const cleanTicker = ticker.trim().toUpperCase();
    if (!post || !cleanName || !/^[A-Z][A-Z0-9_]{0,14}$/.test(cleanTicker)) {
      setError("Add an X post, name, and a ticker starting with a letter (1–15 characters).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let image = profile;
      if (!image) image = await uploadOrGenerate(file);
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
          metadataURI: image.pfpURI,
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

  const downloadHref = profile?.pfpURI || preview;

  return (
    <AppChrome>
      <main className="g-main" style={{ maxWidth: 620, margin: "0 auto", width: "100%" }}>
        <div className="g-pill" style={{ display: "inline-block" }}>TESTNET</div>
        <h1 className="g-display" style={{ marginTop: 16 }}>Create from an X post</h1>
        <p className="g-sub" style={{ marginTop: 10 }}>Choose a name, ticker, and image. We’ll carry the X post into your wallet review.</p>
        <form className="g-card" style={{ marginTop: 20 }} onSubmit={(event) => void prepareCoin(event)}>
          <div className="g-field">
            <label htmlFor="source-post">X post link or ID</label>
            <input id="source-post" className="sm" value={sourcePostId} onChange={(event) => setSourcePostId(event.target.value)} placeholder="https://x.com/… or post ID" required />
            <p className="g-hint" style={{ marginTop: 6 }}>The origin is recorded with this launch. Nothing is posted for you.</p>
            <label htmlFor="coin-name" style={{ marginTop: 16 }}>Name</label>
            <input id="coin-name" className="sm" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your coin name" required />
            <label htmlFor="coin-ticker" style={{ marginTop: 16 }}>Ticker</label>
            <input id="coin-ticker" className="sm" value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 15))} placeholder="TICKER" required />
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="g-sub" style={{ marginBottom: 8 }}>Token image · png / jpg / webp · 1:1 preferred · ≤ 2MB</div>
            <label className="g-upload" style={{ display: "block" }}>
              <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: "none" }} onChange={(event) => onPick(event.target.files?.[0] || null)} />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Token image preview" className="g-pfp lg" style={{ margin: "0 auto 12px" }} />
              ) : (
                <div className="g-sub" style={{ marginBottom: 8 }}>Upload an image or make a clean default</div>
              )}
              <span style={{ color: "var(--x)", fontWeight: 650, fontSize: 14 }}>{file ? file.name : "Choose image"}</span>
            </label>
            <div className="flex gap-2" style={{ marginTop: 12 }}>
              <button type="button" className="g-btn" disabled={busy || !ticker.trim()} onClick={() => { onPick(null); void prepareImage(null); }}>Make default</button>
              <button type="button" className="g-btn" disabled={busy || !file} onClick={() => void prepareImage(file)} style={{ borderColor: "var(--x)", color: "var(--x)" }}>Use image</button>
            </div>
          </div>
          {profile && (
            <div className="g-alert good" style={{ marginTop: 16 }}>
              <strong>Image ready.</strong> This is the token image on GRAAV; attach the same file when you post on X.
              {downloadHref && <a className="g-btn sm" href={downloadHref} download={`${ticker.trim().toUpperCase()}-graav-token.png`} style={{ display: "inline-block", marginTop: 10, background: "var(--x)", color: "#fff", border: 0, textDecoration: "none" }}>Download image</a>}
            </div>
          )}
          <button type="submit" className="g-cta" style={{ marginTop: 20 }} disabled={busy}>{busy ? "Preparing…" : "Review and sign"}</button>
          {error && <div className="g-alert bad" style={{ marginTop: 12 }} role="alert">{error}</div>}
        </form>
        <details className="g-details" style={{ marginTop: 16 }}>
          <summary>More info</summary>
          <div className="g-kv" style={{ marginTop: 12 }}><span>Quote</span><span>RLUSD</span></div>
          <div className="g-kv"><span>Network</span><span>XRPL EVM Testnet</span></div>
          <div className="g-kv"><span>Factory</span><span className="g-mono" title={RLUSD_CLONE_FACTORY_ADDRESS}>{shortFactory}</span></div>
          <p className="g-hint" style={{ marginTop: 10 }}>Chat and this form only prepare intent. Your wallet reviews and approves the transaction.</p>
        </details>
      </main>
    </AppChrome>
  );
}
