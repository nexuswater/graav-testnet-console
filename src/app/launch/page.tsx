"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { decodeEventLog, type Address, type Hex, type Log } from "viem";
import { useAccount, useChainId, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { AppChrome } from "@/components/AppChrome";
import { LinkIcon, UploadIcon } from "@/components/shell/Icons";
import { XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import { tipMarketAvailability } from "@/lib/rlusd-v1/availability";
import { RLUSD_CLONE_INFRA, RLUSD_V1 as C } from "@/lib/rlusd-v1/config";
import { rlusdFactoryAbi } from "@/lib/rlusd-v1/contracts";
import { buildCreateCoinParams } from "@/lib/rlusd-v1/createCoin";
import type { PfpProfile } from "@/lib/pfpTypes";

type Step = "details" | "review" | "sign";

const shortFactory = C.factoryAddress
  ? `${C.factoryAddress.slice(0, 6)}…${C.factoryAddress.slice(-4)}`
  : "Not configured";

export default function LaunchPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });
  const submitting = useRef(false);

  const [step, setStep] = useState<Step>("details");
  const [sourcePostId, setSourcePostId] = useState("");
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [profile, setProfile] = useState<PfpProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<"idle" | "unavailable" | "ready">("idle");
  const [signature, setSignature] = useState<Hex | null>(null);
  const [created, setCreated] = useState<{ token: string; curve: string } | null>(null);

  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;
  const factory = C.factoryAddress as Address | null;
  const cleanName = name.trim();
  const cleanTicker = ticker.trim().toUpperCase();
  const post = sourcePostId.trim();
  const tickerOk = /^[A-Z][A-Z0-9_]{0,14}$/.test(cleanTicker);
  const detailsReady = Boolean(post && cleanName && tickerOk);
  const tip = tipMarketAvailability();

  const params = useMemo(() => {
    if (!detailsReady || !address) return null;
    return buildCreateCoinParams({
      sourcePost: post,
      name: cleanName,
      symbol: cleanTicker,
      issuer: address,
    });
  }, [address, cleanName, cleanTicker, detailsReady, post]);

  const onPick = (next: File | null) => {
    setFile(next);
    setProfile(null);
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : null);
  };

  const prepareImage = async (): Promise<PfpProfile> => {
    if (!cleanTicker) throw new Error("Add a ticker before preparing the image.");
    const form = new FormData();
    form.set("ticker", cleanTicker);
    if (address) form.set("creator", address);
    if (file) form.set("file", file);
    else form.set("generate", "true");
    const response = await fetch("/api/pfp", { method: "POST", body: form });
    const data = (await response.json()) as PfpProfile & { error?: string };
    if (!response.ok) throw new Error(data.error || "Could not prepare the token image");
    return data;
  };

  const goReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!detailsReady || busy) return;
    setBusy(true);
    setError(null);
    try {
      const image = profile ?? await prepareImage();
      setProfile(image);
      setPreview(image.pfpURI);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const requestAuth = async () => {
    if (!params || submitting.current) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rlusd/launch/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourcePostId: params.sourcePostId,
          name_: params.name_,
          symbol_: params.symbol_,
          issuer: params.issuer,
          curveTokens: params.curveTokens.toString(),
          lpTokens: params.lpTokens.toString(),
          threshold: params.threshold.toString(),
          virtualX: params.virtualX.toString(),
          virtualY: params.virtualY.toString(),
          nonce: params.nonce.toString(),
          deadline: params.deadline.toString(),
        }),
      });
      const data = (await response.json()) as { available?: boolean; signature?: Hex; message?: string; error?: string };
      if (!response.ok || !data.available || !data.signature) {
        setAuthState("unavailable");
        setSignature(null);
        setError(data.message || data.error || "Launch authorization is not available.");
        return;
      }
      setSignature(data.signature);
      setAuthState("ready");
      setStep("sign");
    } catch (err) {
      setAuthState("unavailable");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const signCreate = async () => {
    if (!params || !signature || !factory || !address || !publicClient || submitting.current) return;
    if (!isConnected || !onCorrectChain) {
      setError("Connect wallet on XRPL EVM Testnet before signing.");
      return;
    }
    submitting.current = true;
    reset();
    setBusy(true);
    setError(null);
    try {
      setError(null);
      await publicClient.simulateContract({
        address: factory,
        abi: rlusdFactoryAbi,
        functionName: "createCoin",
        args: [params, signature],
        account: address,
      });
      const hash = await writeContractAsync({
        address: factory,
        abi: rlusdFactoryAbi,
        functionName: "createCoin",
        args: [params, signature],
      });
      setError(null);
      void hash;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isConfirmed || !receipt || created) return;
    for (const log of receipt.logs as Log[]) {
      try {
        const decoded = decodeEventLog({ abi: rlusdFactoryAbi, data: log.data, topics: log.topics });
        if (decoded.eventName === "CoinCreated") {
          const args = decoded.args as { token?: Address; curve?: Address };
          if (args.token && args.curve) {
            setCreated({ token: args.token, curve: args.curve });
            return;
          }
        }
      } catch {
        /* not this event */
      }
    }
  }, [created, isConfirmed, receipt]);

  const reviewDisabled = !detailsReady || busy;
  const signDisabled =
    !params ||
    !signature ||
    !factory ||
    !isConnected ||
    !onCorrectChain ||
    busy ||
    isWriting ||
    isConfirming ||
    authState !== "ready";

  return (
    <AppChrome active="launch">
      <main className="g-main g-launch">
        <Link href="/" className="g-back">← Markets</Link>
        <h1 className="g-hero-title">Make your moment.</h1>
        <p className="g-hero-sub">Create a coin from an X post.</p>

        <ol className="g-stepper" aria-label="Launch steps">
          <li className={step === "details" ? "on" : undefined}><span>1</span> Details</li>
          <li className={step === "review" ? "on" : undefined}><span>2</span> Review</li>
          <li className={step === "sign" ? "on" : undefined}><span>3</span> Sign</li>
        </ol>

        {step === "details" && (
          <form onSubmit={(event) => void goReview(event)} className="g-launch-form">
            <div className="g-field">
              <label className="g-field-label" htmlFor="launch-x-post">X post</label>
              <span className="g-input-icon">
                <LinkIcon />
                <input
                  id="launch-x-post"
                  className="sm"
                  value={sourcePostId}
                  onChange={(event) => setSourcePostId(event.target.value)}
                  placeholder="Paste a link or post ID"
                  autoComplete="off"
                  required
                />
              </span>
            </div>
            <div className="g-field">
              <label className="g-field-label" htmlFor="launch-name">Name</label>
              <input
                id="launch-name"
                className="sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Coin name"
                autoComplete="off"
                required
              />
            </div>
            <div className="g-field">
              <label className="g-field-label" htmlFor="launch-ticker">Ticker</label>
              <input
                id="launch-ticker"
                className="sm"
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 15))}
                placeholder="TICKER"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <div className="g-field">
              <span className="g-field-label" id="launch-image-label">Image</span>
              <label className="g-upload" aria-labelledby="launch-image-label">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={(event) => onPick(event.target.files?.[0] || null)}
                />
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Token image preview" className="g-pfp lg" style={{ margin: "0 auto 12px" }} />
                ) : (
                  <span className="g-upload-cta"><UploadIcon /> Upload image</span>
                )}
                <span className="g-hint" style={{ marginTop: 8 }}>
                  {file ? file.name : "Optional. A default mark is prepared if you skip this."}
                </span>
              </label>
            </div>
            <div className="g-field">
              <label className="g-field-label" htmlFor="launch-quote">Quoted in</label>
              <input id="launch-quote" className="sm" value="Test RLUSD" readOnly />
            </div>
            <button type="submit" className="g-cta" disabled={reviewDisabled}>
              {busy ? "Preparing…" : "Review launch"}
            </button>
            <p className="g-hint">Wallet signing happens after review.</p>
          </form>
        )}

        {step !== "details" && (
          <section className="g-review">
            <div className="g-kv"><span>Name</span><span>{cleanName}</span></div>
            <div className="g-kv"><span>Ticker</span><span>{cleanTicker}</span></div>
            <div className="g-kv"><span>X post</span><span className="g-mono">{post}</span></div>
            <div className="g-kv"><span>Quote</span><span>Test RLUSD</span></div>
            <div className="g-kv"><span>Factory</span><span className="g-mono">{shortFactory}</span></div>
            <div className="g-kv"><span>Authorizer</span><span className="g-mono">{RLUSD_CLONE_INFRA.launchAuthorizer.slice(0, 6)}…{RLUSD_CLONE_INFRA.launchAuthorizer.slice(-4)}</span></div>
            <div className="g-kv"><span>Existing tip market</span><span>{tip.state === "unconfigured" ? "Awaiting first create" : tip.state}</span></div>
            {step === "review" && (
              <>
                <button type="button" className="g-cta" disabled={!params || busy || !isConnected || !onCorrectChain} onClick={() => void requestAuth()}>
                  {busy ? "Requesting authorization…" : "Continue to sign"}
                </button>
                <button type="button" className="g-cta ghost" onClick={() => setStep("details")}>Back to details</button>
                <p className="g-hint">Authorization is requested from the LaunchAuthorizer. A missing operator key keeps Sign disabled.</p>
              </>
            )}
            {step === "sign" && (
              <>
                {authState === "unavailable" && (
                  <div className="g-alert warn">Launch authorization is unavailable. The console will not fabricate a signature.</div>
                )}
                <button type="button" className="g-cta" disabled={signDisabled} onClick={() => void signCreate()}>
                  {isWriting || isConfirming ? "Waiting for wallet…" : "Sign createCoin"}
                </button>
                <button type="button" className="g-cta ghost" onClick={() => setStep("review")}>Back to review</button>
              </>
            )}
          </section>
        )}

        {created && (
          <div className="g-alert" style={{ marginTop: 16 }}>
            CoinCreated · token {created.token} · curve {created.curve}
          </div>
        )}
        {txHash && <p className="g-mono" style={{ marginTop: 12 }}>{txHash}{isConfirmed ? " · confirmed" : isConfirming ? " · pending" : ""}</p>}
        {error && <div className="g-alert bad" style={{ marginTop: 12 }} role="alert">{error}</div>}
      </main>
    </AppChrome>
  );
}
