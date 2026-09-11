'use client';

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  usePublicClient,
  useChainId,
} from "wagmi";
import {
  formatEther,
  parseEther,
  isAddress,
  type Address,
} from "viem";
import {
  ATTRIBUTION_V1_FACTORY_ADDRESS,
  FACTORY_ADDRESS,
  GRADUATION_MANAGER_ADDRESS,
  M22_FACTORY_ADDRESS,
  M22_GRADUATION_MANAGER_ADDRESS,
  T589_TOKEN_ADDRESS,
  GSWAP_TOKEN_ADDRESS,
  EXPLORER_URL,
  XRPL_EVM_TESTNET_ID,
  factoryAbi,
  marketAbi,
  graduationManagerAbi,
  erc20Abi,
  testDexV2Abi,
  TEST_DEX_V2_ADDRESS,
  isV2DexConfigured,
  ZERO_ADDRESS,
  type MarketInfo,
} from "@/lib/chain";
import { shortAddr } from "@/lib/wallet";
import type { TradePrefill } from "@/lib/tradePrefill";
import { formatPrice, formatTokenAmount, poolPrice } from "@/lib/formatNumber";
import { TokenPfp } from "@/components/pfp/TokenPfp";
import { XTradeCta } from "@/components/XTradeCta";
import { resolveKnown } from "@/lib/chatIntent";
import { homeMarkets } from "@/lib/marketsRegistry";
import { GRAAV_X_HANDLE_AT } from "@/lib/xLaunchComposer";

function explorerAddress(addr: string) {
  return `${EXPLORER_URL}/address/${addr}`;
}

type Props = {
  prefill: TradePrefill | null;
  onPrefillConsumed: () => void;
  statusMsg: string | null;
  setStatusMsg: (m: string | null) => void;
};

export function TradeTab({
  prefill,
  onPrefillConsumed,
  statusMsg,
  setStatusMsg,
}: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;
  const canTrade = isConnected && onCorrectChain;
  const v2Configured = isV2DexConfigured();

  const [loadQuery, setLoadQuery] = useState("gSWAP");
  const [marketAddr, setMarketAddr] = useState<Address | null>(null);
  const [tokenAddr, setTokenAddr] = useState<Address | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMarket, setLoadingMarket] = useState<string | null>(null);
  const [buyXrp, setBuyXrp] = useState("0.1");
  const [sellAmount, setSellAmount] = useState("1");
  const [swapSide, setSwapSide] = useState<"xrpToToken" | "tokenToXrp">(
    "xrpToToken"
  );
  const [swapAmount, setSwapAmount] = useState("0.1");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell" | "swap">("swap");

  const skipInitialLoad = useRef(false);

  const {
    writeContractAsync,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    resetWrite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketAddr]);

  useEffect(() => {
    if (isConfirmed && txHash) {
      setStatusMsg(`Confirmed: ${txHash}`);
    }
  }, [isConfirmed, txHash, setStatusMsg]);

  const loadMarketByQuery = useCallback(
    async (qRaw: string) => {
      setLoadError(null);
      if (!publicClient) {
        setLoadError("Network client not ready. Try again in a moment.");
        return;
      }
      const q = qRaw.trim();
      if (!q) {
        setLoadError("Enter a ticker or market address.");
        return;
      }
      setLoadingMarket(q);
      try {
        if (isAddress(q)) {
          const asAddr = q as Address;
          try {
            const tok = await publicClient.readContract({
              address: asAddr,
              abi: marketAbi,
              functionName: "token",
            });
            skipInitialLoad.current = true;
            setMarketAddr(asAddr);
            setTokenAddr(tok as Address);
            setStatusMsg(`Loaded market ${shortAddr(asAddr)}`);
            return;
          } catch {
            setLoadError("That address is not a GRAAV market.");
            return;
          }
        }

        // M2.2 (DEX-wired) first, then M2, then the Attribution V1 tip (stack2).
        let info: MarketInfo | null = null;
        for (const fac of [
          M22_FACTORY_ADDRESS,
          FACTORY_ADDRESS,
          ATTRIBUTION_V1_FACTORY_ADDRESS,
        ] as Address[]) {
          try {
            const cand = (await publicClient.readContract({
              address: fac,
              abi: factoryAbi,
              functionName: "getMarketBySymbol",
              args: [q],
            })) as MarketInfo;
            if (cand && cand.market !== ZERO_ADDRESS) {
              info = cand;
              break;
            }
          } catch {
            /* try next factory */
          }
        }

        if (!info || info.market === ZERO_ADDRESS) {
          setLoadError(`No market found for "${q}".`);
          setMarketAddr(null);
          setTokenAddr(null);
          return;
        }
        skipInitialLoad.current = true;
        setMarketAddr(info.market);
        setTokenAddr(info.token);
        setStatusMsg(null);
      } catch (e) {
        setLoadError(String(e));
      } finally {
        setLoadingMarket(null);
      }
    },
    [publicClient, setStatusMsg]
  );

  const loadMarket = useCallback(
    async (queryOverride?: string) => {
      setStatusMsg(null);
      await loadMarketByQuery(queryOverride ?? loadQuery);
    },
    [loadMarketByQuery, loadQuery, setStatusMsg]
  );

  // Apply Chat / deep-link prefill (fields only; never sends a tx).
  useEffect(() => {
    if (!prefill) return;
    if (prefill.buyXrp) {
      setBuyXrp(prefill.buyXrp);
      setSwapAmount(prefill.buyXrp);
      setSwapSide("xrpToToken");
    }
    if (prefill.sellAmount) {
      setSellAmount(prefill.sellAmount);
      setSwapAmount(prefill.sellAmount);
      setSwapSide("tokenToXrp");
    }
    if (prefill.side === "buy" || prefill.action === "buy") {
      setSwapSide("xrpToToken");
      setTradeSide("buy");
    }
    if (prefill.side === "sell" || prefill.action === "sell") {
      setSwapSide("tokenToXrp");
      setTradeSide("sell");
    }
    if (prefill.loadQuery || prefill.symbol) {
      const q = prefill.loadQuery || prefill.symbol || "";
      setLoadQuery(q);
      void loadMarketByQuery(q);
    }
    if (prefill.action === "buy" || prefill.action === "sell" || prefill.action === "swap") {
      setStatusMsg("Review the amount, then sign in your wallet. Graduated markets trade through Swap.");
    }
    onPrefillConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  useEffect(() => {
    if (publicClient && !marketAddr && !skipInitialLoad.current) {
      void loadMarketByQuery("gSWAP");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient]);

  const { data: realXrp, refetch: refetchReal } = useReadContract({
    address: marketAddr ?? undefined,
    abi: marketAbi,
    functionName: "realXrp",
    query: { enabled: !!marketAddr },
  });
  const { data: tokenReserve, refetch: refetchReserve } = useReadContract({
    address: marketAddr ?? undefined,
    abi: marketAbi,
    functionName: "tokenReserve",
    query: { enabled: !!marketAddr },
  });
  const { data: graduated, refetch: refetchGrad } = useReadContract({
    address: marketAddr ?? undefined,
    abi: marketAbi,
    functionName: "graduated",
    query: { enabled: !!marketAddr },
  });
  const { data: price, refetch: refetchPrice } = useReadContract({
    address: marketAddr ?? undefined,
    abi: marketAbi,
    functionName: "price",
    query: { enabled: !!marketAddr },
  });
  const { data: threshold } = useReadContract({
    address: marketAddr ?? undefined,
    abi: marketAbi,
    functionName: "graduationThresholdXrp",
    query: { enabled: !!marketAddr },
  });
  const { data: tokenBalance, refetch: refetchBal } = useReadContract({
    address: tokenAddr ?? undefined,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!tokenAddr && !!address },
  });
  const { data: allowance, refetch: refetchAllow } = useReadContract({
    address: tokenAddr ?? undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args: address && marketAddr ? [address, marketAddr] : undefined,
    query: { enabled: !!tokenAddr && !!address && !!marketAddr },
  });
  const { data: tokenSymbol } = useReadContract({
    address: tokenAddr ?? undefined,
    abi: erc20Abi,
    functionName: "symbol",
    query: { enabled: !!tokenAddr },
  });

  const { data: v2Reserves, refetch: refetchV2, isError: v2ReservesError } =
    useReadContract({
      address: v2Configured ? TEST_DEX_V2_ADDRESS : undefined,
      abi: testDexV2Abi,
      functionName: "getReserves",
      args: tokenAddr ? [tokenAddr] : undefined,
      query: { enabled: v2Configured && !!tokenAddr },
    });

  const { data: v2Allowance, refetch: refetchV2Allow } = useReadContract({
    address: tokenAddr ?? undefined,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && v2Configured ? [address, TEST_DEX_V2_ADDRESS] : undefined,
    query: { enabled: !!tokenAddr && !!address && v2Configured },
  });

  const isGraduated = graduated === true;
  const isT589 =
    !!tokenAddr &&
    tokenAddr.toLowerCase() === T589_TOKEN_ADDRESS.toLowerCase();

  const v2XrpReserve =
    v2Reserves && Array.isArray(v2Reserves)
      ? (v2Reserves[0] as bigint)
      : undefined;
  const v2TokReserve =
    v2Reserves && Array.isArray(v2Reserves)
      ? (v2Reserves[1] as bigint)
      : undefined;
  const hasProvenV2Pool =
    v2Configured &&
    !v2ReservesError &&
    v2XrpReserve !== undefined &&
    v2TokReserve !== undefined &&
    v2XrpReserve > BigInt(0) &&
    v2TokReserve > BigInt(0);

  const swapUnavailableReason = useMemo(() => {
    if (!isGraduated) return "Swap opens after this market graduates. Use Buy or Sell on the curve.";
    if (isT589 && !hasProvenV2Pool) {
      return "This market graduated to a legacy pool. Swaps are not available here.";
    }
    if (!v2Configured) {
      return "The DEX is not configured yet. Swaps are disabled.";
    }
    if (!hasProvenV2Pool) {
      return "No liquidity pool found for this token yet. Swaps are disabled.";
    }
    return null;
  }, [isGraduated, isT589, v2Configured, hasProvenV2Pool]);

  const swapEnabled = isGraduated && hasProvenV2Pool && canTrade;

  const quoteOut = useMemo(() => {
    if (!hasProvenV2Pool || v2XrpReserve === undefined || v2TokReserve === undefined)
      return null;
    try {
      const amt = parseEther(swapAmount || "0");
      if (amt <= BigInt(0)) return null;
      // Local CPMM quote (matches expected V2 getAmountOut) — display only
      if (swapSide === "xrpToToken") {
        return (amt * v2TokReserve) / (v2XrpReserve + amt);
      }
      return (amt * v2XrpReserve) / (v2TokReserve + amt);
    } catch {
      return null;
    }
  }, [hasProvenV2Pool, v2XrpReserve, v2TokReserve, swapAmount, swapSide]);

  const refreshMarket = () => {
    void refetchReal();
    void refetchReserve();
    void refetchGrad();
    void refetchPrice();
    void refetchBal();
    void refetchAllow();
    void refetchV2();
    void refetchV2Allow();
  };

  useEffect(() => {
    if (isConfirmed) refreshMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  // Graduated markets trade through Swap; keep the visible form consistent with that.
  useEffect(() => {
    if (graduated === true && tradeSide !== "swap") setTradeSide("swap");
    if (graduated === false && tradeSide === "swap") setTradeSide("buy");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graduated]);

  const buyDisabled =
    !canTrade || isWriting || isConfirming || !marketAddr || isGraduated;
  const sellDisabled =
    !canTrade || isWriting || isConfirming || !marketAddr || isGraduated;
  const tradeDisabled = !canTrade || isWriting || isConfirming;

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
      if (
        /user rejected|denied|already pending|request already/i.test(msg)
      ) {
        setStatusMsg(`${label} cancelled or wallet busy: ${msg}`);
      } else {
        setStatusMsg(`${label} failed: ${msg}`);
      }
      resetWrite();
      return null;
    }
  };

  const doBuy = async () => {
    if (!canTrade || !marketAddr) return;
    if (isGraduated) {
      setStatusMsg("This market graduated. Use Swap.");
      return;
    }
    resetWrite();
    let value: bigint;
    try {
      value = parseEther(buyXrp || "0");
    } catch {
      setStatusMsg("Invalid XRP amount");
      return;
    }
    if (value <= BigInt(0)) {
      setStatusMsg("Buy amount must be > 0");
      return;
    }
    await safeWrite(`Buying with ${buyXrp} XRP`, () =>
      writeContractAsync({
        address: marketAddr,
        abi: marketAbi,
        functionName: "buy",
        args: [BigInt(0)],
        value,
      })
    );
  };

  const doApprove = async () => {
    if (!canTrade || !tokenAddr || !marketAddr) return;
    resetWrite();
    let amount: bigint;
    try {
      amount = parseEther(sellAmount || "0");
    } catch {
      setStatusMsg("Invalid token amount");
      return;
    }
    await safeWrite(`Approving ${sellAmount}`, () =>
      writeContractAsync({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [marketAddr, amount],
      })
    );
  };

  const doSell = async () => {
    if (!canTrade || !marketAddr) return;
    if (isGraduated) {
      setStatusMsg("This market graduated. Use Swap.");
      return;
    }
    resetWrite();
    let amount: bigint;
    try {
      amount = parseEther(sellAmount || "0");
    } catch {
      setStatusMsg("Invalid token amount");
      return;
    }
    if (amount <= BigInt(0)) {
      setStatusMsg("Sell amount must be > 0");
      return;
    }
    await safeWrite(`Selling ${sellAmount}`, () =>
      writeContractAsync({
        address: marketAddr,
        abi: marketAbi,
        functionName: "sell",
        args: [amount, BigInt(0)],
      })
    );
  };

  const doApproveV2 = async () => {
    if (!canTrade || !tokenAddr || !v2Configured) return;
    resetWrite();
    let amount: bigint;
    try {
      amount = parseEther(swapAmount || "0");
    } catch {
      setStatusMsg("Invalid token amount");
      return;
    }
    await safeWrite(`Approving ${swapAmount} for swap`, () =>
      writeContractAsync({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "approve",
        args: [TEST_DEX_V2_ADDRESS, amount],
      })
    );
  };

  const doSwap = async () => {
    if (!swapEnabled || !tokenAddr) {
      setStatusMsg(swapUnavailableReason ?? "Swap not available");
      return;
    }
    resetWrite();
    let amount: bigint;
    try {
      amount = parseEther(swapAmount || "0");
    } catch {
      setStatusMsg("Invalid swap amount");
      return;
    }
    if (amount <= BigInt(0)) {
      setStatusMsg("Swap amount must be > 0");
      return;
    }
    const minOut = quoteOut ? (quoteOut * BigInt(995)) / BigInt(1000) : BigInt(0);
    if (swapSide === "xrpToToken") {
      await safeWrite(`Swap ${swapAmount} XRP → ${tokenSymbol || "token"}`, () =>
        writeContractAsync({
          address: TEST_DEX_V2_ADDRESS,
          abi: testDexV2Abi,
          functionName: "swapExactXrpForTokens",
          args: [tokenAddr, minOut],
          value: amount,
        })
      );
    } else {
      await safeWrite(`Swap ${swapAmount} ${tokenSymbol || "token"} → XRP`, () =>
        writeContractAsync({
          address: TEST_DEX_V2_ADDRESS,
          abi: testDexV2Abi,
          functionName: "swapExactTokensForXrp",
          args: [tokenAddr, amount, minOut],
        })
      );
    }
  };

  const doGraduate = async () => {
    if (!canTrade || !marketAddr || !publicClient) return;
    resetWrite();
    let gm: Address = GRADUATION_MANAGER_ADDRESS;
    try {
      const fromMarket = (await publicClient.readContract({
        address: marketAddr,
        abi: marketAbi,
        functionName: "graduationManager",
      })) as Address;
      if (fromMarket && fromMarket !== ZERO_ADDRESS) gm = fromMarket;
    } catch {
      if (
        tokenAddr &&
        tokenAddr.toLowerCase() === GSWAP_TOKEN_ADDRESS.toLowerCase()
      ) {
        gm = M22_GRADUATION_MANAGER_ADDRESS;
      }
    }
    await safeWrite("Graduate", () =>
      writeContractAsync({
        address: gm,
        abi: graduationManagerAbi,
        functionName: "graduate",
        args: [marketAddr],
      })
    );
  };

  const needsApprove = useMemo(() => {
    if (allowance === undefined) return true;
    try {
      const amt = parseEther(sellAmount || "0");
      return allowance < amt;
    } catch {
      return true;
    }
  }, [allowance, sellAmount]);

  const needsV2Approve = useMemo(() => {
    if (swapSide !== "tokenToXrp") return false;
    if (v2Allowance === undefined) return true;
    try {
      const amt = parseEther(swapAmount || "0");
      return v2Allowance < amt;
    } catch {
      return true;
    }
  }, [v2Allowance, swapAmount, swapSide]);

  const activeSide = tradeSide;
  const symbol = typeof tokenSymbol === "string" ? tokenSymbol : "";
  // Graduated markets price on the DEX pool; the curve price reads 0 after graduation.
  const displayPrice = isGraduated
    ? poolPrice(v2XrpReserve, v2TokReserve)
    : price !== undefined
      ? Number(formatEther(price))
      : null;
  const knownOnX = symbol ? resolveKnown(symbol) : null;
  const xSide: "buy" | "sell" =
    activeSide === "sell" || (activeSide === "swap" && swapSide === "tokenToXrp") ? "sell" : "buy";
  const xAmount =
    activeSide === "buy" ? buyXrp : activeSide === "sell" ? sellAmount : swapAmount;
  const quickPicks = homeMarkets();
  const walletHint = !isConnected
    ? "Connect your wallet to sign here."
    : !onCorrectChain
      ? "Switch your wallet to XRPL EVM to sign here."
      : null;

  return (
    <div className="space-y-5">
      <section>
        <h1 className="g-title">Trade</h1>
        <p className="g-sub" style={{ marginTop: 8 }}>
          Daily trading happens on X — post or DM {GRAAV_X_HANDLE_AT} and sign the link it sends.
          This in-app rail is the fallback. Your wallet signs either way.
        </p>
      </section>

      <section aria-label="Find a market">
        <div className="flex gap-2">
          <input
            className="g-search"
            value={loadQuery}
            onChange={(e) => setLoadQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadMarket();
            }}
            placeholder="Ticker or market address"
            aria-label="Ticker or market address"
          />
          <button
            type="button"
            onClick={() => void loadMarket()}
            className="g-btn"
            style={{ background: "var(--cta-bg)", color: "var(--cta-fg)", border: 0, fontWeight: 650, whiteSpace: "nowrap" }}
          >
            Load
          </button>
        </div>
        <div className="g-chip-row" aria-label="Listed markets">
          {quickPicks.map((m) => (
            <button
              key={m.ticker}
              type="button"
              className="g-btn sm"
              title={m.name}
              aria-pressed={symbol.toLowerCase() === m.ticker.toLowerCase()}
              style={symbol.toLowerCase() === m.ticker.toLowerCase() ? { borderColor: "var(--text)" } : undefined}
              onClick={() => {
                setLoadQuery(m.ticker);
                void loadMarketByQuery(m.ticker);
              }}
            >
              {m.ticker}
            </button>
          ))}
        </div>
        {loadError && (
          <p className="g-sub mt-2" role="alert" style={{ color: "var(--bad)" }}>
            {loadError}
          </p>
        )}
        {!loadError && loadingMarket && !marketAddr && (
          <p className="g-sub mt-2" aria-live="polite">Loading {loadingMarket}…</p>
        )}
      </section>

      {marketAddr && (
        <section aria-labelledby="trade-market-heading">
          <div className="g-trade-head" style={{ marginBottom: 12 }}>
            <TokenPfp ticker={symbol || "?"} size="md" />
            <div>
              <div className="g-sub">
                <span className={`g-dot${isGraduated ? " grad" : " live"}`} />
                {graduated === undefined ? "Loading…" : isGraduated ? "Graduated" : "On curve"}
              </div>
              <h2 id="trade-market-heading" className="g-display" style={{ marginTop: 4 }}>
                {symbol || "…"}
              </h2>
              <div className="g-sub" style={{ marginTop: 6 }}>
                {displayPrice !== null
                  ? `${formatPrice(displayPrice)} XRP / token`
                  : graduated === undefined || (isGraduated && v2Reserves === undefined && !v2ReservesError)
                    ? "Loading price…"
                    : "Price unavailable"}
              </div>
            </div>
          </div>

          {knownOnX && <XTradeCta side={xSide} ticker={knownOnX.symbol} amount={xAmount} />}

          <div className="g-or">{knownOnX ? "or sign here" : "sign here"}</div>

          {walletHint && <div className="g-alert" style={{ marginTop: 12 }}>{walletHint}</div>}

          <div className="g-seg" role="tablist" aria-label="Trade side">
            <button
              type="button"
              className={activeSide === "buy" ? "on" : undefined}
              onClick={() => setTradeSide("buy")}
            >
              Buy
            </button>
            <button
              type="button"
              className={activeSide === "sell" ? "on" : undefined}
              onClick={() => setTradeSide("sell")}
            >
              Sell
            </button>
            <button
              type="button"
              className={activeSide === "swap" ? "on" : undefined}
              onClick={() => setTradeSide("swap")}
            >
              Swap
            </button>
          </div>

          {activeSide === "buy" && (
            <>
              {isGraduated && (
                <div className="g-alert warn" style={{ marginBottom: 12 }}>
                  This market graduated. Buy through Swap.
                </div>
              )}
              <div className="g-field">
                <label>You pay</label>
                <input
                  value={buyXrp}
                  onChange={(e) => setBuyXrp(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.1"
                  aria-label="XRP to spend"
                />
                <div className="g-pct">
                  {["0.05", "0.1", "0.5", "1"].map((v) => (
                    <button key={v} type="button" className={buyXrp === v ? "on" : undefined} onClick={() => setBuyXrp(v)}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void doBuy()}
                disabled={buyDisabled}
                className="g-cta"
              >
                Buy {symbol || "token"}
              </button>
              <p className="g-hint">You sign in your wallet. GRAAV never holds your key.</p>
            </>
          )}

          {activeSide === "sell" && (
            <>
              {isGraduated && (
                <div className="g-alert warn" style={{ marginBottom: 12 }}>
                  This market graduated. Sell through Swap.
                </div>
              )}
              <div className="g-field">
                <label>You sell</label>
                <input
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="1"
                  aria-label="Tokens to sell"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void doApprove()}
                  disabled={tradeDisabled || !marketAddr || !needsApprove || isGraduated}
                  className="g-cta ghost"
                  style={{ marginTop: 0 }}
                >
                  {needsApprove ? "Approve" : "Approved"}
                </button>
                <button
                  type="button"
                  onClick={() => void doSell()}
                  disabled={sellDisabled || needsApprove}
                  className="g-cta"
                  style={{ marginTop: 0 }}
                >
                  Sell
                </button>
              </div>
              <p className="g-hint">
                Approved: {allowance === undefined ? "—" : `${formatTokenAmount(allowance)} ${symbol}`}
              </p>
            </>
          )}

          {activeSide === "swap" && (
            <>
              {swapUnavailableReason ? (
                <div className="g-alert warn">
                  <strong>Swap unavailable.</strong> {swapUnavailableReason}
                </div>
              ) : (
                <>
                  <div className="g-seg" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className={swapSide === "xrpToToken" ? "on" : undefined}
                      onClick={() => {
                        setSwapSide("xrpToToken");
                        setSwapAmount(buyXrp || "0.1");
                      }}
                    >
                      XRP → {symbol || "token"}
                    </button>
                    <button
                      type="button"
                      className={swapSide === "tokenToXrp" ? "on" : undefined}
                      onClick={() => {
                        setSwapSide("tokenToXrp");
                        setSwapAmount(sellAmount || "1");
                      }}
                    >
                      {symbol || "token"} → XRP
                    </button>
                  </div>
                  <div className="g-field">
                    <label>
                      {swapSide === "xrpToToken"
                        ? "You pay"
                        : `${symbol || "Token"} in`}
                    </label>
                    <input
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.1"
                      aria-label="Swap amount"
                    />
                  </div>
                  <p className="g-hint">
                    Estimated receive:{" "}
                    {quoteOut !== null
                      ? `${formatTokenAmount(quoteOut)} ${
                          swapSide === "xrpToToken"
                            ? symbol || "token"
                            : "XRP"
                        }`
                      : "—"}
                  </p>
                  {swapSide === "tokenToXrp" && (
                    <button
                      type="button"
                      onClick={() => void doApproveV2()}
                      disabled={tradeDisabled || !needsV2Approve || !swapEnabled}
                      className="g-cta ghost"
                    >
                      {needsV2Approve ? "Approve" : "Approved"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void doSwap()}
                    disabled={
                      !swapEnabled ||
                      isWriting ||
                      isConfirming ||
                      (swapSide === "tokenToXrp" && needsV2Approve)
                    }
                    className="g-cta"
                  >
                    Swap
                  </button>
                  <p className="g-hint">You sign in your wallet. GRAAV never holds your key.</p>
                </>
              )}
            </>
          )}

          <details className="g-details">
            <summary>Details</summary>
            <div className="g-kv">
              <span>Market</span>
              <span className="g-mono">
                <a
                  className="link-x"
                  href={explorerAddress(marketAddr)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {shortAddr(marketAddr)}
                </a>
              </span>
            </div>
            <div className="g-kv">
              <span>Token</span>
              <span className="g-mono">
                {tokenAddr ? (
                  <a
                    className="link-x"
                    href={explorerAddress(tokenAddr)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddr(tokenAddr)}
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="g-kv">
              <span>Curve reserve</span>
              <span>{realXrp !== undefined ? `${formatTokenAmount(realXrp)} XRP` : "…"}</span>
            </div>
            <div className="g-kv">
              <span>Tokens on curve</span>
              <span>{tokenReserve !== undefined ? formatTokenAmount(tokenReserve) : "…"}</span>
            </div>
            <div className="g-kv">
              <span>Graduation threshold</span>
              <span>{threshold !== undefined ? `${formatTokenAmount(threshold)} XRP` : "…"}</span>
            </div>
            <div className="g-kv">
              <span>Your balance</span>
              <span>
                {tokenBalance !== undefined
                  ? `${formatTokenAmount(tokenBalance)} ${symbol}`
                  : isConnected
                    ? "…"
                    : "Connect wallet"}
              </span>
            </div>
            <div className="g-kv">
              <span>DEX</span>
              <span className="g-mono">
                {v2Configured ? (
                  <a
                    className="link-x"
                    href={explorerAddress(TEST_DEX_V2_ADDRESS)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortAddr(TEST_DEX_V2_ADDRESS)}
                  </a>
                ) : (
                  "Not configured"
                )}
              </span>
            </div>
            {hasProvenV2Pool && (
              <>
                <div className="g-kv">
                  <span>Pool XRP</span>
                  <span>{formatTokenAmount(v2XrpReserve)}</span>
                </div>
                <div className="g-kv">
                  <span>Pool {symbol || "token"}</span>
                  <span>{formatTokenAmount(v2TokReserve)}</span>
                </div>
              </>
            )}
            <div className="g-kv">
              <span>Chain</span>
              <span className="g-mono">XRPL EVM · {XRPL_EVM_TESTNET_ID}</span>
            </div>
          </details>

          {!isGraduated && (
            <details className="g-details">
              <summary>Advanced · graduate</summary>
              <p className="g-sub" style={{ margin: "8px 0 0" }}>
                Graduation moves a market from its curve to the DEX once the threshold is met.
                Your wallet signs; the call reverts if the market is not ready.
              </p>
              <button
                type="button"
                onClick={() => void doGraduate()}
                disabled={tradeDisabled || !marketAddr || isGraduated}
                className="g-cta ghost"
              >
                Graduate market
              </button>
            </details>
          )}
        </section>
      )}

      <section className="g-card text-sm">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div style={{ fontWeight: 650 }}>New market</div>
            <p className="g-hint" style={{ marginTop: 4 }}>
              Launch from a post, repost, or DM on X. The in-app form is the fallback.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/launch" className="g-btn sm" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Launch on X
            </Link>
            <Link href="/new" className="g-btn sm" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              In-app form
            </Link>
          </div>
        </div>
      </section>

      {(statusMsg || txHash || writeError) && (
        <section className="g-card text-sm" aria-live="polite">
          <div className="g-micro" style={{ marginBottom: 8 }}>
            STATUS
          </div>
          {statusMsg && <p style={{ color: "var(--text)" }}>{statusMsg}</p>}
          {txHash && (
            <p className="mt-1">
              Tx:{" "}
              <a
                className="link-x"
                href={`${EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {shortAddr(txHash)}
              </a>
              {isConfirming && " (confirming…)"}
              {isConfirmed && " ✓"}
            </p>
          )}
          {writeError && (
            <p className="mt-2 break-all" style={{ color: "var(--bad)" }}>
              {String(writeError.message)}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
