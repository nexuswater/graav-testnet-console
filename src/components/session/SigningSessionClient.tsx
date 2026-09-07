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
  M22_FACTORY_ADDRESS,
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
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;
  const walletConnectConnector = connectors.find((c) => c.id === "walletConnect" || c.name.toLowerCase().includes("walletconnect"));

  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState<string | null>(null);
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

  // Fail-closed gates
  useEffect(() => {
    if (!payload) {
      setBlockReason(view.error || "Invalid session");
      return;
    }
    if (view.status === "expired") {
      setBlockReason("Session expired");
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
      setBlockReason("gSWAP market must bind M2.2 factory");
      return;
    }
    // V1 never swap
    if (payload.action === "swap" && payload.dex && isV1Dex(payload.dex)) {
      setBlockReason("Fail-closed: TestDex V1 is scar-only (never swap)");
      return;
    }
    // SWAP: require market.graduated()==true AND tokenToLpId(token)!=0 (SoT)
    if (payload.action === "swap") {
      if (graduated === false) {
        setBlockReason(
          "Fail-closed: swap requires market.graduated()==true (use buy/sell on curve)"
        );
        return;
      }
      if (graduated === true && lpId !== null && lpId === BigInt(0)) {
        setBlockReason(
          "Fail-closed: tokenToLpId(token)==0 — no V2 pool (T589 scar or unwired)"
        );
        return;
      }
      if (
        tokenAddr &&
        tokenAddr.toLowerCase() === T589_TOKEN_ADDRESS.toLowerCase()
      ) {
        setBlockReason(
          "Fail-closed: T589 on TestDex V1 scar — never swap"
        );
        return;
      }
    }
    // BUY/SELL: gate on market.graduated() — curve only pre-grad
    if (
      (payload.action === "buy" || payload.action === "sell") &&
      graduated === true
    ) {
      setBlockReason(
        "Fail-closed: market.graduated()==true — use action=swap on TestDex V2"
      );
      return;
    }
    setBlockReason(null);
  }, [payload, view.status, view.error, graduated, tokenAddr, lpId]);

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
      setStatusMsg("WalletConnect is unavailable until NEXT_PUBLIC_WC_PROJECT_ID is configured.");
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


  const handleSwitch = async () => {
    const res = await ensureXrplEvmTestnet();
    if (!res.ok) {
      setStatusMsg(res.error ?? "Switch failed");
      return;
    }
    if (switchChain) {
      try {
        switchChain({ chainId: XRPL_EVM_TESTNET_ID });
      } catch {
        /* ensure handled */
      }
    }
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
      setStatusMsg("Wrong chain — switch to 1449000 first");
      return;
    }
    resetWrite();

    try {
      if (payload.action === "create") {
        const name = payload.createName || "";
        const symbol = payload.createSymbol || "";
        if (!name || !symbol) {
          setStatusMsg("createName/createSymbol missing");
          return;
        }
        const fac = (factoryAddr || FACTORY_ADDRESS) as Address;
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
        setStatusMsg("market required");
        return;
      }

      if (payload.action === "buy") {
        if (graduated === true) {
          setStatusMsg("Buy blocked — graduated");
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
          setStatusMsg("Sell blocked — graduated");
          return;
        }
        if (!tokenAddr || !address) {
          setStatusMsg("token/wallet not ready");
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
          setStatusMsg("token/dex not ready");
          return;
        }
        if (isV1Dex(dexAddr) || dexAddr.toLowerCase() !== TEST_DEX_V2_ADDRESS.toLowerCase()) {
          setStatusMsg("Fail-closed: V1 never swap — V2 only");
          return;
        }
        if (graduated !== true) {
          setStatusMsg("Fail-closed: swap requires market.graduated()==true");
          return;
        }
        if (lpId === null || lpId === BigInt(0)) {
          setStatusMsg("Fail-closed: tokenToLpId(token)==0");
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

  const expiryLabel = payload
    ? new Date(payload.expiry * 1000).toLocaleString("en-US", {
        timeZone: "America/Chicago",
        dateStyle: "short",
        timeStyle: "medium",
      }) + " CT"
    : "—";

  const expiresIn = useMemo(() => {
    if (!payload?.expiry) return null;
    const ms = payload.expiry * 1000 - Date.now();
    if (ms <= 0) return "expired";
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }, [payload?.expiry]);

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
      return `Create ${payload.createName || sym}`;
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
          <span className="g-pill">TESTNET</span>
        </div>
        <div className="g-top-actions">
          <AccountMenu onStatus={(msg) => setStatusMsg(asStatusText(msg))} />
          <PrimaryMenu />
        </div>
      </header>

      <p className="g-micro-warn px-4 pt-3">
        chat ≠ authorization · emit URL never auto-tx · server holds no key ·{" "}
        <a
          href={FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: "var(--accent)", fontWeight: 650 }}
        >
          faucet.xrplevm.org
        </a>
      </p>

      <main className="g-main" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <div className="xl" style={{ fontSize: 13, color: "var(--x)", marginBottom: 4 }}>
          From X / Chat
          {expiresIn && expiresIn !== "expired"
            ? ` · expires ${expiresIn}`
            : view.status === "expired" || expiresIn === "expired"
              ? " · expired"
              : ""}
        </div>

        <div className="g-sheet">
          <div className="g-status">
            {view.status === "signed"
              ? "Signed"
              : view.status === "expired"
                ? "Expired"
                : view.status === "invalid"
                  ? "Invalid"
                  : blockReason
                    ? "Blocked"
                    : "Grok asked you to confirm"}
          </div>

          {(payload?.action === "create" || payload?.action === "buy") &&
            (payload.createSymbol ||
              (typeof tokenSymbol === "string" && tokenSymbol)) && (
              <div style={{ marginBottom: 12 }}>
                <TokenPfp
                  ticker={
                    payload.createSymbol ||
                    (typeof tokenSymbol === "string" ? tokenSymbol : "TOKEN")
                  }
                  size="md"
                />
              </div>
            )}
          <h1 className="g-display" style={{ fontSize: 32 }}>
            {actionSummary}
          </h1>
          <p className="g-hint" style={{ marginTop: 8 }}>
            XRPL EVM Testnet · you sign · we never hold the key
          </p>
          <p className="g-sub" style={{ marginTop: 6 }}>
            Amount {amountDisplay}
            {" · "}
            {XRPL_EVM_TESTNET_ID} ({XRPL_EVM_TESTNET_HEX})
          </p>
          <p className="g-micro" style={{ marginTop: 4 }}>
            Expires{" "}
            {expiresIn && expiresIn !== "expired"
              ? `in ${expiresIn}`
              : expiryLabel}
          </p>
          <p className="g-micro" style={{ marginTop: 8 }}>
            Dual-factory: gSWAP→M2.2 · g589/T589-style→M2
          </p>

          {payload && (
            <div style={{ marginTop: 20 }}>
              <div className="g-kv">
                <span>Action</span>
                <span>{payload.action}</span>
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
                <span>minOut</span>
                <span>{payload.minOut || "0"}</span>
              </div>
              <div className="g-kv">
                <span>Chain</span>
                <span className="g-mono">
                  {payload.chainId} ({XRPL_EVM_TESTNET_HEX}) locked
                </span>
              </div>
              {graduated != null && (
                <div className="g-kv">
                  <span>graduated()</span>
                  <span style={{ color: graduated ? "var(--warn)" : "var(--good)" }}>
                    {String(graduated)}
                  </span>
                </div>
              )}
              {payload.action === "swap" && lpId !== null && (
                <div className="g-kv">
                  <span>tokenToLpId</span>
                  <span style={{ color: lpId === BigInt(0) ? "var(--bad)" : "var(--text)" }}>
                    {lpId === BigInt(0) ? "0 (no pool)" : String(lpId)}
                  </span>
                </div>
              )}
              {payload.action === "create" && (
                <>
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
                    <span>{payload.originTweetId || "—"}</span>
                  </div>
                  <div className="g-kv">
                    <span>Origin hash</span>
                    <span className="g-mono">{payload.originHash || zeroHash}</span>
                  </div>
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
              <strong>Wrong network</strong> (wallet {chainId || "—"}). In your wallet switch to{" "}
              <strong>XRPL EVM Testnet</strong>{" "}
              <span className="g-mono">
                {XRPL_EVM_TESTNET_ID} ({XRPL_EVM_TESTNET_HEX})
              </span>{" "}
              before Sign.
            </div>
          )}

          {!isConnected ? (
            <div style={{ display: "grid", gap: 8 }}>
              {walletConnectConnector ? (
                <button type="button" onClick={() => void handleWalletConnect()} disabled={isConnecting} className="g-btn g-wallet-pill g-session-wallet-pill">
                  <WalletConnectMark />
                  {isConnecting ? "Connecting…" : "WalletConnect"}
                </button>
              ) : (
                <p className="g-micro" role="status" style={{ color: "var(--muted)", textAlign: "center" }}>
                  WalletConnect unavailable — configure NEXT_PUBLIC_WC_PROJECT_ID to connect.
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
              {isSwitching
                ? "Switching…"
                : `Switch to XRPL EVM Testnet · ${XRPL_EVM_TESTNET_ID} (${XRPL_EVM_TESTNET_HEX})`}
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
                  : "Sign in wallet"}
            </button>
          )}

          <div className="g-alert" style={{ marginTop: 12 }}>
            Need testnet XRP / gas to sign?{" "}
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="link-x"
              style={{ fontWeight: 650 }}
            >
              faucet.xrplevm.org →
            </a>
          </div>
          <Link href="/" className="g-cta ghost" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>
            Reject
          </Link>
          <p className="g-hint">Wrong network or expired session cannot send.</p>
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

        <p className="g-micro" style={{ marginTop: 24, textAlign: "center" }}>
          <Link href="/" style={{ color: "var(--muted)" }}>
            ← Back to console
          </Link>
          {" · "}
          M2 {shortAddr(FACTORY_ADDRESS)} / M2.2 {shortAddr(M22_FACTORY_ADDRESS)} · V2{" "}
          {shortAddr(TEST_DEX_V2_ADDRESS)}
        </p>
      </main>
    </div>
  );
}
