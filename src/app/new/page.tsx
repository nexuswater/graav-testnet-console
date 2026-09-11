"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { AppChrome } from "@/components/AppChrome";
import { FACTORY_ADDRESS, XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import type { PfpProfile } from "@/lib/pfpTypes";
import { sourcePostIdFromInput } from "@/lib/rlusd-v1/createCoin";
import { useWalletActions } from "@/lib/useWalletActions";
import { parseXPostUrl } from "@/lib/xLaunchComposer";

/** Accepts an x.com status link or a bare numeric post id; empty means no origin. */
function originPostId(raw: string): { id: string | null; invalid: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { id: null, invalid: false };
  if (/^\d{5,25}$/.test(trimmed)) return { id: trimmed, invalid: false };
  const parsed = parseXPostUrl(trimmed);
  return parsed ? { id: parsed.id, invalid: false } : { id: null, invalid: true };
}

export default function NewMarketPage() {
  const { address, isConnected } = useAccount();
  const { connect, walletConnectConnector, isConnecting } = useWalletActions();
  const router = useRouter();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [originInput, setOriginInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [profile, setProfile] = useState<PfpProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ticker = useMemo(
    () => symbol.trim().replace(/^\$/, ""),
    [symbol]
  );
  const origin = useMemo(() => originPostId(originInput), [originInput]);

  const onPick = (f: File | null) => {
    setFile(f);
    setProfile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const uploadOrGenerate = useCallback(async (): Promise<PfpProfile> => {
    if (!ticker) throw new Error("Symbol / ticker required");
    const form = new FormData();
    form.set("ticker", ticker);
    if (address) form.set("creator", address);
    if (file) {
      form.set("file", file);
    } else {
      form.set("generate", "true");
    }
    const res = await fetch("/api/pfp", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "upload failed");
    return data as PfpProfile;
  }, [ticker, address, file]);

  const handlePrepareImage = async () => {
    setErr(null);
    setBusy(true);
    try {
      const p = await uploadOrGenerate();
      setProfile(p);
      setPreview(p.pfpURI);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSession = async () => {
    setErr(null);
    setBusy(true);
    try {
      let p = profile;
      if (!p) {
        p = await uploadOrGenerate();
        setProfile(p);
        setPreview(p.pfpURI);
      }
      if (!name.trim() || !ticker) {
        throw new Error("Name and symbol required");
      }
      if (origin.invalid) {
        throw new Error("Paste a full x.com post link or its numeric id for the origin, or leave it empty.");
      }
      // CREATE on M2 factory (meme / curve). gSWAP never on M2 — new markets use M2.
      // The origin post binds into calldata as originHash = keccak256(utf8(postId)); it is never the image.
      const res = await fetch("/api/s", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          chainId: XRPL_EVM_TESTNET_ID,
          factory: FACTORY_ADDRESS,
          createName: name.trim(),
          createSymbol: ticker,
          metadataURI: p.pfpURI,
          amount: "0",
          minOut: "0",
          ...(origin.id
            ? { originTweetId: origin.id, originHash: sourcePostIdFromInput(origin.id) }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "session failed");
      router.push(`/s/${encodeURIComponent(data.id)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadHref = profile?.pfpURI || preview;

  return (
    <AppChrome>
      <main className="g-main" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <h1 className="g-display" style={{ fontSize: 28 }}>New market</h1>
        <p className="g-sub" style={{ marginTop: 8 }}>
          In-app fallback for creating an XRP-quoted market. Daily launches happen from a post,
          repost, or DM on X — see <Link href="/launch" className="link-x">Launch</Link>. You sign the
          create in your wallet.
        </p>

        <div className="g-sheet">
          <label className="g-field block">
            <span>Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="GRAAV Example"
            />
          </label>
          <label className="g-field block" style={{ marginTop: 12 }}>
            <span>Symbol / ticker</span>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="gEXAMPLE"
            />
          </label>
          <label className="g-field block" style={{ marginTop: 12 }}>
            <span>Origin post (optional)</span>
            <input
              value={originInput}
              onChange={(e) => setOriginInput(e.target.value)}
              placeholder="https://x.com/…/status/…"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={origin.invalid || undefined}
            />
          </label>
          <p className="g-hint" style={{ marginTop: 6 }}>
            {origin.invalid
              ? "Paste a full x.com post link or its numeric id, or leave it empty."
              : origin.id
                ? `Post ${origin.id} is recorded as the origin of this market.`
                : "The post this coin comes from. Recorded on the market; never used as the image."}
          </p>

          <div style={{ marginTop: 16 }}>
            <div className="g-sub" style={{ marginBottom: 8 }}>
              Token image · png / jpg / webp · 1:1 preferred · ≤ 2MB
            </div>
            <label className="g-upload" style={{ display: "block" }}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: "none" }}
                onChange={(e) => onPick(e.target.files?.[0] || null)}
              />
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview}
                  alt="preview"
                  className="g-pfp lg"
                  style={{ margin: "0 auto 12px" }}
                />
              ) : (
                <div className="g-sub" style={{ marginBottom: 8 }}>
                  Drop or click to upload, or generate the default mark
                </div>
              )}
              <span style={{ color: "var(--x)", fontWeight: 650, fontSize: 14 }}>
                {file ? file.name : "Choose image"}
              </span>
            </label>
            <p className="g-hint">
              X cannot receive the file from a link — download it below and attach it when you post.
            </p>
          </div>

          <div className="flex gap-2" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="g-btn"
              disabled={busy || !ticker}
              onClick={() => {
                onPick(null);
                void handlePrepareImage();
              }}
            >
              Generate default
            </button>
            <button
              type="button"
              className="g-btn"
              disabled={busy || !ticker || !file}
              onClick={() => void handlePrepareImage()}
              style={{ borderColor: "var(--x)", color: "var(--x)" }}
            >
              Upload image
            </button>
          </div>

          {profile && (
            <div className="g-alert good" style={{ marginTop: 16 }}>
              <strong>This is the token image on GRAAV. Attach this same file when you Post on X.</strong>
              <div style={{ marginTop: 10 }}>
                {downloadHref && (
                  <a
                    className="g-btn sm"
                    href={downloadHref}
                    download={`${ticker}-graav-token.png`}
                    style={{
                      display: "inline-block",
                      background: "var(--cta-bg)",
                      color: "var(--cta-fg)",
                      border: 0,
                      textDecoration: "none",
                    }}
                  >
                    Download exact file
                  </a>
                )}
              </div>
              <p className="g-hint" style={{ marginTop: 8 }}>
                Download first, then attach it to your post on X.
              </p>
            </div>
          )}

          {!isConnected && (
            <div className="g-alert" style={{ marginTop: 16 }}>
              You can connect on the signing page, or{" "}
              {walletConnectConnector ? (
                <button
                  type="button"
                  className="link-x"
                  style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontWeight: 650 }}
                  disabled={isConnecting}
                  onClick={() => void connect().then((r) => { if (!r.ok) setErr(r.error ?? "Could not connect a wallet."); })}
                >
                  {isConnecting ? "connecting…" : "connect your wallet now"}
                </button>
              ) : (
                <span>connect a wallet once it is available on this deployment</span>
              )}
              . Your signature creates the market.
            </div>
          )}

          {err && (
            <div className="g-alert bad" style={{ marginTop: 16 }}>
              {err}
            </div>
          )}

          <button
            type="button"
            className="g-cta"
            disabled={busy || !name.trim() || !ticker || origin.invalid}
            onClick={() => void handleCreateSession()}
          >
            {busy ? "Preparing…" : "Review and sign"}
          </button>
          <p className="g-hint">
            Opens a signing request for the create. Nothing is created until your wallet signs.
          </p>
        </div>
      </main>
    </AppChrome>
  );
}
