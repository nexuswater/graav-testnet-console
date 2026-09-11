"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraavLogo } from "@/components/GraavLogo";
import { AccountMenu } from "@/components/AccountMenu";
import { PrimaryMenu } from "@/components/PrimaryMenu";
import { WalletConnectMark } from "@/components/WalletConnectMark";
import {
  useAccount,
  useConnect,
  useSwitchChain,
  useChainId,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  usePublicClient,
} from "wagmi";
import {
  parseEther,
  zeroHash,
  type Address,
  type Hex,
} from "viem";
import {
  FACTORY_ADDRESS,
  TEST_DEX_V2_ADDRESS,
  T589_TOKEN_ADDRESS,
  GSWAP_TOKEN_ADDRESS,
  EXPLORER_URL,
  FAUCET_URL,
  XRPL_EVM_TESTNET_ID,
  factoryAbi,
  marketAbi,
  erc20Abi,
  testDexV2Abi,
} from "@/lib/chain";
import {
  factoryShortLabel,
  isGswapMarket,
  isM22Factory,
  isRlusdCloneFactory,
  isV1Dex,
  swapDexAddress,
  validateAllowlist,
} from "@/lib/sessionAllowlist";
import type { PublicSessionView } from "@/lib/signingSession";
import { XRPL_EVM_TESTNET_HEX } from "@/lib/signingSession";
import {
  InvalidSessionHelp,
  isUnusableSessionId,
} from "@/components/session/InvalidSessionHelp";
import {
  ensureXrplEvmTestnet,
  shortAddr,
} from "@/lib/wallet";
import { TokenPfp } from "@/components/pfp/TokenPfp";
import { copyToClipboard } from "@/lib/metaMaskDeepLink";
import { asStatusText } from "@/lib/statusMsg";
import { SeedMarketField } from "@/components/launch/SeedMarketField";
import { XMark } from "@/components/XMark";
import { GRAAV_X_HANDLE_AT, seedAmountDisplay, sharePostIntentUrl, type XShareKind } from "@/lib/xLaunchComposer";

type Props = {
  initial: PublicSessionView;
};

export function SigningSessionClient({ initial }: Props) {
  const [view, setView] = useState(initial);
  const payload = view.payload;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const {
    connectAsync,
    connectors,
    isPending: isConnecting,
  } = useConnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;
  const walletConnectConnector = connectors.find((c) => c.id === "walletConnect" || c.name.toLowerCase().includes("walletconnect"));

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [seedAmount, setSeedAmount] = useState("");
  const [blockReason, setBlockReason] = useState<string | null>(null);
  // null until mounted: the countdown and the locale time label are client-only so SSR and hydration agree.
  const [nowSec, setNowSec] = useState<number | null>(null);
  const [tokenAddr, setTokenAddr] = useState<Address | null>(
    (payload?.token as Address) || null
  );
  const [graduated, setGraduated] = useState<boolean | null>(null);
  const [lpId, setLpId] = useState<bigint | null>(null);

  const {
    writeContractAsync,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const marketAddr = (payload?.market as Address) || undefined;
  const factoryAddr = (payload?.factory as Address) || undefined;
  const originPostId = payload?.originTweetId?.trim();
  const originPostUrl = originPostId && /^\d+$/.test(originPostId)
    ? "https://x.com/i/web/status/" + encodeURIComponent(originPostId)
    : undefined;

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/s/${encodeURIComponent(view.id)}`);
      const data = (await res.json()) as PublicSessionView;
      setView((prev) => ({ ...prev, ...data, id: prev.id }));
    } catch {
      /* keep local */
    }
  }, [view.id]);

  // Resolve token + market.graduated() (+ V2 tokenToLpId for swap) — SoT S_SESSION_BIND_ABI
  useEffect(() => {
    if (!publicClient || !marketAddr) return;
    let cancelled = false;
    (async () => {
      try {
        const [tok, grad] = await Promise.all([
          publicClient.readContract({
            address: marketAddr,
            abi: marketAbi,
            functionName: "token",
          }),
          publicClient.readContract({
            address: marketAddr,
            abi: marketAbi,
            functionName: "graduated",
          }),
        ]);
        if (cancelled) return;
        const token = tok as Address;
        setTokenAddr(token);
        setGraduated(grad as boolean);
        if (payload?.action === "swap") {
          try {
            const id = (await publicClient.readContract({
              address: TEST_DEX_V2_ADDRESS,
              abi: testDexV2Abi,
              functionName: "tokenToLpId",
              args: [token],
            })) as bigint;
            if (!cancelled) setLpId(id);
          } catch {
            if (!cancelled) setLpId(BigInt(0));
          }
        } else if (!cancelled) {
          setLpId(null);
        }
      } catch (e) {
        if (!cancelled) {
          setBlockReason(`Failed to read market: ${String(e)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicClient, marketAddr, payload?.action]);

  // Tick once a second while the request is pending so the countdown is live and
  // the page flips to Expired on its own instead of leaving Sign enabled.
  const pendingExpiry = view.status === "pending" ? payload?.expiry ?? null : null;
  useEffect(() => {
    const tick = () => setNowSec(Math.floor(Date.now() / 1000));
    tick();
    if (!pendingExpiry) return;
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [pendingExpiry]);
  const expiredLocally = pendingExpiry !== null && nowSec !== null && nowSec >= pendingExpiry;
  useEffect(() => {
    if (expiredLocally) void refreshStatus();
  }, [expiredLocally, refreshStatus]);

  // Fail-closed gates
  useEffect(() => {
    if (!payload) {
      setBlockReason(view.error || "Invalid session");
      return;
    }
    if (view.status === "expired" || expiredLocally) {
      setBlockReason("This request expired. Ask GRAAV for a new link or open Trade.");
      return;
    }
    if (view.status === "invalid") {
      setBlockReason(view.error || "Invalid session");
      return;
    }
    const allowErr = validateAllowlist({
      chainId: payload.chainId,
      factory: payload.factory,
      market: payload.market,
      dex: payload.dex,
      action: payload.action,
    });
    if (allowErr) {
      setBlockReason(allowErr);
      return;
    }
    // gSWAP must be M2.2 (reject gSWAP on M2)
    if (
      payload.market &&
      isGswapMarket(payload.market) &&
      !isM22Factory(payload.factory)
    ) {
      setBlockReason("This request pairs the market with the wrong factory. Ask GRAAV for a new link.");
      return;
    }
    // V1 never swap
    if (payload.action === "swap" && payload.dex && isV1Dex(payload.dex)) {
      setBlockReason("Swaps are not available on the legacy pool.");
      return;
    }
    // SWAP: require market.graduated()==true AND tokenToLpId(token)!=0 (SoT)
    if (payload.action === "swap") {
      if (graduated === false) {
        setBlockReason("This market has not graduated yet — use Buy or Sell on the curve instead.");
        return;
      }
      if (graduated === true && lpId !== null && lpId === BigInt(0)) {
        setBlockReason("No liquidity pool exists for this token yet, so it cannot be swapped.");
        return;
      }
      if (
        tokenAddr &&
        tokenAddr.toLowerCase() === T589_TOKEN_ADDRESS.toLowerCase()
      ) {
        setBlockReason("Swaps are not available for this legacy market.");
        return;
      }
    }
    // BUY/SELL: gate on market.graduated() — curve only pre-grad
    if (
      (payload.action === "buy" || payload.action === "sell") &&
      graduated === true
    ) {
      setBlockReason("This market graduated — ask GRAAV for a Swap link instead of Buy or Sell.");
      return;
    }
    setBlockReason(null);
  }, [payload, view.status, view.error, graduated, tokenAddr, lpId, expiredLocally]);

  useEffect(() => {
    if (isConfirmed && txHash) {
      setStatusMsg(`Confirmed: ${txHash}`);
      void (async () => {
        try {
          await fetch(`/api/s/${encodeURIComponent(view.id)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ txHash }),
          });
          await refreshStatus();
        } catch {
          /* best-effort */
        }
      })();
    }
  }, [isConfirmed, txHash, view.id, refreshStatus]);

  const { data: tokenSymbol } = useReadContract({
    address: tokenAddr ?? undefined,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!tokenAddr },
  });

  const dexAddr = useMemo(() => {
    if (!payload) return null;
    if (payload.action === "swap") return swapDexAddress(payload.dex);
    return null;
  }, [payload]);

  const canSign =
    isConnected &&
    onCorrectChain &&
    !blockReason &&
    view.status === "pending" &&
    !!payload &&
    !isWriting &&
    !isConfirming;

  const handleWalletConnect = async () => {
    setStatusMsg(null);
    if (!walletConnectConnector) {
      setStatusMsg("Wallet connection isn't available on this deployment yet.");
      return;
    }
    try {
      await connectAsync({ connector: walletConnectConnector });
      setStatusMsg("WalletConnect connected. Check the network before signing.");
    } catch (err: unknown) {
      setStatusMsg(`WalletConnect failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCopyLink = async () => {
    const copied = await copyToClipboard(typeof window === "undefined" ? "" : window.location.href);
    setStatusMsg(copied ? "Link copied." : "Could not copy link; copy the URL from the address bar.");
  };


  // Connected wallet first (works for WalletConnect); injected add/switch as the fallback.
  const handleSwitch = async () => {
    try {
      await switchChainAsync({ chainId: XRPL_EVM_TESTNET_ID });
      return;
    } catch {
      /* wallet may not know the chain yet — try the injected add-chain path */
    }
    const res = await ensureXrplEvmTestnet();
    if (!res.ok) setStatusMsg(res.error ?? "Could not switch network.");
  };

  const safeWrite = async (
    label: string,
    fn: () => Promise<`0x${string}`>
  ) => {
    try {
      setStatusMsg(`${label}…`);
      const hash = await fn();
      setStatusMsg(`${label} submitted: ${hash}`);
      return hash;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatusMsg(`${label} failed: ${msg}`);
      resetWrite();
      return null;
    }
  };

  const execute = async () => {
    if (!canSign || !payload) return;
    if (!onCorrectChain) {
      setStatusMsg("Switch your wallet to XRPL EVM first.");
      return;
    }
    resetWrite();

    try {
      if (payload.action === "create") {
        const name = payload.createName || "";
        const symbol = payload.createSymbol || "";
        if (!name || !symbol) {
          setStatusMsg("This request is missing the coin name or ticker.");
          return;
        }
        const fac = (factoryAddr || FACTORY_ADDRESS) as Address;
        if (isRlusdCloneFactory(fac)) {
          setStatusMsg("Coin V1 createCoin requires Launch review and a real LaunchAuthorizer signature. This session will not call createMarket or fabricate auth.");
          return;
        }
        await safeWrite("Create market", () =>
          writeContractAsync({
            address: fac,
            abi: factoryAbi,
            functionName: "createMarket",
            args: [
              name,
              symbol,
              payload.metadataURI || "",
              (payload.originHash || zeroHash) as Hex,
            ],
          })
        );
        return;
      }

      if (!marketAddr) {
        setStatusMsg("This request is missing the market.");
        return;
      }

      if (payload.action === "buy") {
        if (graduated === true) {
          setStatusMsg("This market graduated — Buy is not available.");
          return;
        }
        const value = parseEther(payload.amount || "0");
        const minOut = parseEther(payload.minOut || "0");
        await safeWrite(`Buy ${payload.amount} XRP`, () =>
          writeContractAsync({
            address: marketAddr,
            abi: marketAbi,
            functionName: "buy",
            args: [minOut],
            value,
          })
        );
        return;
      }

      if (payload.action === "sell") {
        if (graduated === true) {
          setStatusMsg("This market graduated — Sell is not available.");
          return;
        }
        if (!tokenAddr || !address) {
          setStatusMsg("Still reading the token and wallet — try again in a moment.");
          return;
        }
        const amount = parseEther(payload.amount || "0");
        const minOut = parseEther(payload.minOut || "0");
        // Approve then sell
        const allowance = (await publicClient?.readContract({
          address: tokenAddr,
          abi: erc20Abi,
          functionName: "allowance",
          args: [address, marketAddr],
        })) as bigint | undefined;
        if (allowance !== undefined && allowance < amount) {
          const ok = await safeWrite("Approve", () =>
            writeContractAsync({
              address: tokenAddr,
              abi: erc20Abi,
              functionName: "approve",
              args: [marketAddr, amount],
            })
          );
          if (!ok) return;
          setStatusMsg("Approve submitted — confirm, then press Sign again to sell");
          return;
        }
        await safeWrite(`Sell ${payload.amount}`, () =>
          writeContractAsync({
            address: marketAddr,
            abi: marketAbi,
            functionName: "sell",
            args: [amount, minOut],
          })
        );
        return;
      }

      if (payload.action === "swap") {
        if (!tokenAddr || !dexAddr) {
          setStatusMsg("Still reading the token and DEX — try again in a moment.");
          return;
        }
        if (isV1Dex(dexAddr) || dexAddr.toLowerCase() !== TEST_DEX_V2_ADDRESS.toLowerCase()) {
          setStatusMsg("Swaps run only on the current DEX.");
          return;
        }
        if (graduated !== true) {
          setStatusMsg("This market has not graduated yet.");
          return;
        }
        if (lpId === null || lpId === BigInt(0)) {
          setStatusMsg("No liquidity pool for this token yet.");
          return;
        }
        const amount = parseEther(payload.amount || "0");
        const minOut = parseEther(payload.minOut || "0");
        const side = payload.swapSide || "xrpToToken";
        if (side === "xrpToToken") {
          await safeWrite(`Swap ${payload.amount} XRP → token`, () =>
            writeContractAsync({
              address: dexAddr,
              abi: testDexV2Abi,
              functionName: "swapExactXrpForTokens",
              args: [tokenAddr, minOut],
              value: amount,
            })
          );
        } else {
          if (!address) return;
          const allowance = (await publicClient?.readContract({
            address: tokenAddr,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address, dexAddr],
          })) as bigint | undefined;
          if (allowance !== undefined && allowance < amount) {
            const ok = await safeWrite("Approve V2", () =>
              writeContractAsync({
                address: tokenAddr,
                abi: erc20Abi,
                functionName: "approve",
                args: [dexAddr, amount],
              })
            );
            if (!ok) return;
            setStatusMsg(
              "Approve submitted — confirm, then press Sign again to swap"
            );
            return;
          }
          await safeWrite(`Swap ${payload.amount} token → XRP`, () =>
            writeContractAsync({
              address: dexAddr,
              abi: testDexV2Abi,
              functionName: "swapExactTokensForXrp",
              args: [tokenAddr, amount, minOut],
            })
          );
        }
      }
    } catch (e) {
      setStatusMsg(`Execute failed: ${String(e)}`);
    }
  };

  // Shown in the visitor's own time zone once mounted; the countdown is the live cue.
  const expiryLabel = payload && nowSec !== null
    ? new Date(payload.expiry * 1000).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "…";

  const expiresIn = useMemo(() => {
    if (!payload?.expiry || nowSec === null) return null;
    const totalSec = payload.expiry - nowSec;
    if (totalSec <= 0) return "expired";
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [payload?.expiry, nowSec]);

  const actionSummary = useMemo(() => {
    if (!payload) return "Session";
    const sym =
      (typeof tokenSymbol === "string" && tokenSymbol) ||
      (tokenAddr &&
      tokenAddr.toLowerCase() === GSWAP_TOKEN_ADDRESS.toLowerCase()
        ? "gSWAP"
        : null) ||
      (payload.createSymbol ? payload.createSymbol : null) ||
      "token";
    if (payload.action === "create") {
      return `Launch $${sym}`;
    }
    if (payload.action === "buy") {
      return `Buy ${payload.amount || "?"} XRP of ${sym}`;
    }
    if (payload.action === "sell") {
      return `Sell ${payload.amount || "?"} ${sym}`;
    }
    if (payload.action === "swap") {
      const side = payload.swapSide || "xrpToToken";
      if (side === "xrpToToken") {
        return `Swap ${payload.amount || "?"} XRP → ${sym}`;
      }
      return `Swap ${payload.amount || "?"} ${sym} → XRP`;
    }
    return String(payload.action);
  }, [payload, tokenSymbol, tokenAddr]);

  const amountDisplay = useMemo(() => {
    if (!payload) return "—";
    if (payload.action === "create") return payload.createSymbol || "NEW";
    const payXrp =
      payload.action === "buy" ||
      (payload.action === "swap" &&
        (payload.swapSide || "xrpToToken") === "xrpToToken");
    if (payXrp) return `${payload.amount || "?"} XRP`;
    const sym =
      (typeof tokenSymbol === "string" && tokenSymbol) ||
      payload.createSymbol ||
      "token";
    return `${payload.amount || "?"} ${sym}`;
  }, [payload, tokenSymbol]);


  const signed = isConfirmed || view.status === "signed";
  // Blocked by a gate, expired, or invalid — nothing on this page can be signed.
  const unsignable = !signed && (Boolean(blockReason) || view.status === "expired" || expiredLocally);
  const shareSymbol =
    (typeof tokenSymbol === "string" && tokenSymbol) || payload?.createSymbol || "";
  const shareKind: XShareKind =
    payload?.action === "create"
      ? "launched"
      : payload?.action === "sell" || (payload?.action === "swap" && payload.swapSide === "tokenToXrp")
        ? "sold"
        : "bought";

  // Placeholder / malformed / unsigned session → clear help (never blank 404)
  const unusableId = isUnusableSessionId(view.id);
  const showInvalidHelp =
    unusableId ||
    view.status === "invalid" ||
    (!payload && view.status !== "pending");
  if (showInvalidHelp) {
    return <InvalidSessionHelp sessionId={view.id} />;
  }

  return (
    <div className="g-app">
      <header className="g-top">
        <div className="g-top-brand">
          <GraavLogo height={30} />
          <span className="g-pill g-testnet" title="XRPL EVM Testnet · test assets only">TESTNET</span>
        </div>
        <div className="g-top-actions">
          <AccountMenu onStatus={(msg) => setStatusMsg(asStatusText(msg))} />
          <PrimaryMenu />
        </div>
      </header>

      <main className="g-main" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <div className="g-sheet">
          <div className="g-status">
            {view.status === "signed"
              ? "Signed"
              : view.status === "expired" || expiredLocally
                ? "Expired"
                : view.status === "invalid"
                  ? "Invalid"
                  : blockReason
                    ? "Blocked"
                    : "Review and sign"}
          </div>

          {(payload?.action === "create" || payload?.action === "buy") &&
            (payload.createSymbol ||
              (typeof tokenSymbol === "string" && tokenSymbol)) && (
              <div style={{ marginBottom: 12 }}>
                {payload.action === "create" && payload.metadataURI ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={payload.metadataURI} alt={`$${payload.createSymbol || "TOKEN"}`} width={72} height={72} className="g-pfp md" />
                ) : (
                  <TokenPfp
                    ticker={
                      payload.createSymbol ||
                      (typeof tokenSymbol === "string" ? tokenSymbol : "TOKEN")
                    }
                    size="md"
                  />
                )}
              </div>
            )}
          <h1 className="g-display" style={{ fontSize: 32 }}>
            {actionSummary}
          </h1>
          <p className="g-hint" style={{ marginTop: 8 }}>
            {payload?.action === "create"
              ? `Requested from your post, repost, or DM to ${GRAAV_X_HANDLE_AT}.`
              : "Nothing is sent until you sign in your wallet."}{" "}
            GRAAV never holds your key.
          </p>
          <p className="g-sub" style={{ marginTop: 6 }}>
            {payload?.action === "create"
              ? `Seed ${seedAmountDisplay(seedAmount)} · quoted in RLUSD`
              : `Amount ${amountDisplay}`}
            {" · XRPL EVM "}
            {XRPL_EVM_TESTNET_ID}
          </p>
          <p className="g-micro" style={{ marginTop: 4 }} aria-live="polite">
            {nowSec === null
              ? "Checking expiry…"
              : signed
                ? `Signed · request was valid until ${expiryLabel}`
                : expiresIn && expiresIn !== "expired"
                  ? `Expires in ${expiresIn} · ${expiryLabel}`
                  : `Expired ${expiryLabel}`}
          </p>

          {payload && (
            <div style={{ marginTop: 20 }}>
              <div className="g-kv">
                <span>Action</span>
                <span style={{ textTransform: "capitalize" }}>{payload.action}</span>
              </div>
              <div className="g-kv">
                <span>Factory</span>
                <span className="g-mono">
                  {factoryShortLabel(payload.factory)} · {shortAddr(payload.factory)}
                </span>
              </div>
              <div className="g-kv">
                <span>Market</span>
                <span className="g-mono">
                  {payload.market ? shortAddr(payload.market) : "— (create)"}
                </span>
              </div>
              <div className="g-kv">
                <span>Token</span>
                <span className="g-mono">
                  {tokenAddr
                    ? `${tokenSymbol ? `${tokenSymbol} · ` : ""}${shortAddr(tokenAddr)}`
                    : payload.token
                      ? shortAddr(payload.token)
                      : "—"}
                </span>
              </div>
              <div className="g-kv">
                <span>Minimum received</span>
                <span>{payload.minOut || "0"}</span>
              </div>
              <div className="g-kv">
                <span>Chain</span>
                <span className="g-mono">
                  XRPL EVM {payload.chainId} ({XRPL_EVM_TESTNET_HEX})
                </span>
              </div>
              {graduated != null && (
                <div className="g-kv">
                  <span>Graduated</span>
                  <span>{graduated ? "yes" : "no"}</span>
                </div>
              )}
              {payload.action === "swap" && lpId !== null && (
                <div className="g-kv">
                  <span>Liquidity pool</span>
                  <span>{lpId === BigInt(0) ? "none" : `#${String(lpId)}`}</span>
                </div>
              )}
              {payload.action === "create" && (
                <>
                  {(payload.creatorProfileImageUrl || payload.creatorXUsername || payload.originTweetId) && (
                    <div className="g-alert" style={{ margin: "16px 0 4px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {payload.creatorProfileImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote X avatar; not on the image loader allowlist
                          <img src={payload.creatorProfileImageUrl} alt="" width={42} height={42} style={{ borderRadius: "50%", objectFit: "cover" }} />
                        ) : (
                          <span className="g-av" aria-hidden>{payload.creatorXUsername?.slice(0, 1).toUpperCase() || "X"}</span>
                        )}
                        <div>
                          <div className="g-micro">CREATE ORIGIN</div>
                          <div style={{ fontWeight: 650 }}>{payload.creatorXUsername ? "@" + payload.creatorXUsername : "X identity not bound"}</div>
                          <div className="g-hint" style={{ marginTop: 2 }}>
                            Origin post {originPostUrl ? <a href={originPostUrl} target="_blank" rel="noreferrer" className="link-x">{originPostId}</a> : <span className="g-mono">{originPostId || "—"}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="g-kv">
                    <span>Name</span>
                    <span>{payload.createName || "—"}</span>
                  </div>
                  <div className="g-kv">
                    <span>Symbol</span>
                    <span>{payload.createSymbol || "—"}</span>
                  </div>
                  <div className="g-kv">
                    <span>Source post</span>
                    <span>{originPostUrl ? <a href={originPostUrl} target="_blank" rel="noreferrer" className="link-x">{payload.originTweetId}</a> : payload.originTweetId || "—"}</span>
                  </div>
                  <div className="g-kv">
                    <span>Origin hash</span>
                    <span className="g-mono">{payload.originHash || zeroHash}</span>
                  </div>
                  <div className="g-kv">
                    <span>Token image</span>
                    <span className="g-mono" style={{ maxWidth: "65%", overflowWrap: "anywhere", textAlign: "right" }}>{payload.metadataURI || "—"}</span>
                  </div>
                  <div className="g-kv">
                    <span>Seed (optional)</span>
                    <span>{seedAmountDisplay(seedAmount)}</span>
                  </div>
                  <SeedMarketField value={seedAmount} onChange={setSeedAmount} id="session-seed" />
                  <p className="g-hint">
                    The seed is recorded for review; this signature creates the coin and does not spend it.
                  </p>
                </>
              )}
            </div>
          )}

          {!payload && (
            <p className="g-sub" style={{ marginTop: 16, color: "var(--bad)" }}>
              {view.error || "Session could not be loaded"}
            </p>
          )}

          {blockReason && (
            <div className="g-alert bad" style={{ marginTop: 16 }}>
              <strong>Blocked.</strong> {blockReason}
            </div>
          )}

          {!onCorrectChain && isConnected && (
            <div className="g-alert bad" style={{ marginTop: 16 }}>
              <strong>Wrong network.</strong> Switch your wallet to{" "}
              <strong>XRPL EVM</strong>{" "}
              <span className="g-mono">
                {XRPL_EVM_TESTNET_ID} ({XRPL_EVM_TESTNET_HEX})
              </span>{" "}
              before signing.
            </div>
          )}

          {/* A blocked or expired request cannot be signed; skip the wallet controls and point onward. */}
          {!unsignable && (
            !isConnected ? (
              <div style={{ display: "grid", gap: 8 }}>
                {walletConnectConnector ? (
                  <button type="button" onClick={() => void handleWalletConnect()} disabled={isConnecting} className="g-btn g-wallet-pill g-session-wallet-pill">
                    <WalletConnectMark />
                    {isConnecting ? "Connecting…" : "WalletConnect"}
                  </button>
                ) : (
                  <p className="g-micro" role="status" style={{ color: "var(--muted)", textAlign: "center" }}>
                    Wallet connection isn&apos;t available on this deployment yet.
                  </p>
                )}
                <button type="button" onClick={() => void handleCopyLink()} className="g-cta ghost">Copy link</button>
              </div>
            ) : !onCorrectChain ? (
              <button
                type="button"
                onClick={() => void handleSwitch()}
                disabled={isSwitching}
                className="g-cta danger"
              >
                {isSwitching ? "Switching…" : "Switch to XRPL EVM"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void execute()}
                disabled={!canSign}
                className="g-cta"
              >
                {view.status === "signed"
                  ? "Already signed"
                  : isWriting || isConfirming
                    ? "Confirm in wallet…"
                    : payload?.action === "create"
                      ? "Sign launch in wallet"
                      : "Sign in wallet"}
              </button>
            )
          )}

          {!unsignable && !signed && (
            <p className="g-hint">
              Need XRP for gas?{" "}
              <a
                href={FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className="link-x"
                style={{ fontWeight: 650 }}
              >
                Open faucet →
              </a>
            </p>
          )}
          {signed && shareSymbol && (
            <a
              className="g-cta ghost"
              href={sharePostIntentUrl(shareKind, shareSymbol)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <XMark size={14} /> Share on X
            </a>
          )}
          {unsignable && (
            <Link href="/?tab=Trade" className="g-cta" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
              Open Trade
            </Link>
          )}
          <Link href="/" className="g-cta ghost" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            {signed || unsignable ? "Back to Markets" : "Reject"}
          </Link>
        </div>

        {(statusMsg || txHash || view.txHash || writeError) && (
          <div className="g-card" style={{ marginTop: 16 }}>
            {statusMsg && <p className="g-sub" style={{ color: "var(--text)" }}>{statusMsg}</p>}
            {(txHash || view.txHash) && (
              <p className="g-sub" style={{ marginTop: 6 }}>
                Tx:{" "}
                <a
                  className="link-x"
                  href={`${EXPLORER_URL}/tx/${txHash || view.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddr(txHash || view.txHash)}
                </a>
                {isConfirming && " (confirming…)"}
                {(isConfirmed || view.status === "signed") && " ✓"}
              </p>
            )}
            {writeError && (
              <p className="g-sub" style={{ marginTop: 6, color: "var(--bad)", wordBreak: "break-all" }}>
                {String(writeError.message)}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
