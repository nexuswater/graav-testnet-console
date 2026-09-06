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
  zeroHash,
  decodeEventLog,
  type Address,
  type Hex,
  type Log,
} from "viem";
import {
  FACTORY_ADDRESS,
  GRADUATION_MANAGER_ADDRESS,
  M22_FACTORY_ADDRESS,
  M22_GRADUATION_MANAGER_ADDRESS,
  T589_MARKET_ADDRESS,
  T589_TOKEN_ADDRESS,
  MARKET2_ADDRESS,
  GSWAP_MARKET_ADDRESS,
  GSWAP_TOKEN_ADDRESS,
  G589_MARKET_ADDRESS,
  MEME_TESTNET_MARKETS,
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
import { Field } from "@/components/ui";
import { TokenPfp } from "@/components/pfp/TokenPfp";

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

  const [createName, setCreateName] = useState("");
  const [createSymbol, setCreateSymbol] = useState("");
  const [createUri, setCreateUri] = useState("");
  const [loadQuery, setLoadQuery] = useState("gSWAP");
  const [marketAddr, setMarketAddr] = useState<Address | null>(null);
  const [tokenAddr, setTokenAddr] = useState<Address | null>(null);
  const [factoryGraduated, setFactoryGraduated] = useState<boolean | null>(
    null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [buyXrp, setBuyXrp] = useState("0.1");
  const [sellAmount, setSellAmount] = useState("1");
  const [swapSide, setSwapSide] = useState<"xrpToToken" | "tokenToXrp">(
    "xrpToToken"
  );
  const [swapAmount, setSwapAmount] = useState("0.1");
  const [tradeSide, setTradeSide] = useState<"buy" | "sell" | "swap">("swap");
  const [showSearchExtras, setShowSearchExtras] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);

  const skipInitialT589 = useRef(false);

  const {
    writeContractAsync,
    data: txHash,
    isPending: isWriting,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receipt } =
    useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    resetWrite();
    setPendingCreate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketAddr]);

  useEffect(() => {
    if (isConfirmed && txHash) {
      setStatusMsg(`Confirmed: ${txHash}`);
    }
  }, [isConfirmed, txHash, setStatusMsg]);

  useEffect(() => {
    if (!pendingCreate || !isConfirmed || !receipt || !publicClient) return;
    setPendingCreate(false);
    try {
      for (const log of receipt.logs as Log[]) {
        try {
          const decoded = decodeEventLog({
            abi: factoryAbi,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === "MarketCreated") {
            const args = decoded.args as {
              marketId?: bigint;
              token?: Address;
              market?: Address;
              symbol?: string;
            };
            if (args.market && args.token) {
              skipInitialT589.current = true;
              setMarketAddr(args.market);
              setTokenAddr(args.token);
              setFactoryGraduated(false);
              const sym = args.symbol || createSymbol.trim() || "NEW";
              setLoadQuery(args.market);
              setStatusMsg(
                `Created market #${args.marketId ?? "?"} ${sym} → ${args.market}. Staying on this market (not T589).`
              );
              return;
            }
          }
        } catch {
          /* not this event */
        }
      }
      const sym = createSymbol.trim();
      if (sym) {
        skipInitialT589.current = true;
        void loadMarketByQuery(sym);
        setStatusMsg(`Create confirmed — loaded by symbol ${sym}.`);
      }
    } catch (e) {
      setStatusMsg(`Create confirmed but parse failed: ${String(e)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCreate, isConfirmed, receipt]);

  const loadMarketByQuery = useCallback(
    async (qRaw: string) => {
      setLoadError(null);
      if (!publicClient) {
        setLoadError("RPC client not ready");
        return;
      }
      const q = qRaw.trim();
      if (!q) {
        setLoadError("Enter a symbol or market address");
        return;
      }
      try {
        if (isAddress(q)) {
          const asAddr = q as Address;
          try {
            const tok = await publicClient.readContract({
              address: asAddr,
              abi: marketAbi,
              functionName: "token",
            });
            skipInitialT589.current = true;
            setMarketAddr(asAddr);
            setTokenAddr(tok as Address);
            setFactoryGraduated(null);
            setStatusMsg(`Loaded market ${asAddr}`);
            return;
          } catch {
            setLoadError("Address is not a GRAAV market (token() failed)");
            return;
          }
        }

        // Dual-factory: M22 (V2 swap path) first, then M2 meme/T589 factory.
        let info: MarketInfo | null = null;
        let factoryUsed: Address = M22_FACTORY_ADDRESS;
        for (const fac of [M22_FACTORY_ADDRESS, FACTORY_ADDRESS] as Address[]) {
          try {
            const cand = (await publicClient.readContract({
              address: fac,
              abi: factoryAbi,
              functionName: "getMarketBySymbol",
              args: [q],
            })) as MarketInfo;
            if (cand && cand.market !== ZERO_ADDRESS) {
              info = cand;
              factoryUsed = fac;
              break;
            }
          } catch {
            /* try next factory */
          }
        }

        if (!info || info.market === ZERO_ADDRESS) {
          setLoadError(`No market found for symbol "${q}"`);
          setMarketAddr(null);
          setTokenAddr(null);
          return;
        }
        skipInitialT589.current = true;
        setMarketAddr(info.market);
        setTokenAddr(info.token);
        setFactoryGraduated(info.graduated);
        const facTag =
          factoryUsed.toLowerCase() === M22_FACTORY_ADDRESS.toLowerCase()
            ? "M22"
            : "M2";
        setStatusMsg(`Loaded ${q} → ${info.market} (${facTag} factory)`);
      } catch (e) {
        setLoadError(String(e));
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

  // Apply Chat → Trade prefill (fields only; never sends tx)
  useEffect(() => {
    if (!prefill) return;
    if (prefill.createName) setCreateName(prefill.createName);
    if (prefill.createSymbol) setCreateSymbol(prefill.createSymbol);
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
    if (prefill.side === "buy") setSwapSide("xrpToToken");
    if (prefill.side === "sell") setSwapSide("tokenToXrp");
    if (prefill.loadQuery || prefill.symbol) {
      const q = prefill.loadQuery || prefill.symbol || "";
      setLoadQuery(q);
      void loadMarketByQuery(q);
    }
    if (prefill.action === "launch" && prefill.createSymbol) {
      setStatusMsg(
        `Chat handed off LAUNCH ${prefill.createSymbol} — review fields, then sign in wallet on Trade.`
      );
    } else if (prefill.action === "buy" || prefill.action === "swap") {
      setStatusMsg(
        `Chat handed off ${prefill.action.toUpperCase()} — review amount/symbol on Trade. If graduated, use Swap (DEX/LP); wallet still signs.`
      );
    } else if (prefill.action === "sell") {
      setStatusMsg(
        `Chat handed off SELL — review amount on Trade. If graduated, use Swap (token→XRP); Approve if needed, then sign in wallet.`
      );
    }
    onPrefillConsumed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefill]);

  useEffect(() => {
    if (publicClient && !marketAddr && !skipInitialT589.current) {
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
  const { data: marketCount } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: factoryAbi,
    functionName: "marketCount",
  });

  // V2 pool reserves — only when V2 address configured
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

  const swapScarReason = useMemo(() => {
    if (!isGraduated) return null;
    if (isT589 && !hasProvenV2Pool) {
      return "TestDex v1 has no swap — LP accounting only. T589 reserves sit on v1 (0x6033…A874). No migrate/withdraw in this slice. Protocol must deploy V2 + new graduation (or approved migrate) before Swap is enabled.";
    }
    if (!v2Configured) {
      return "TestDex V2 address not configured yet (Protocol deploy pending). Swap disabled fail-closed — no fake routes.";
    }
    if (!hasProvenV2Pool) {
      return "No proven V2 pool/reserves for this token. Swap disabled fail-closed. New graduations need GM→V2 wiring after Protocol ships V2.";
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
        const out = (amt * v2TokReserve) / (v2XrpReserve + amt);
        return out;
      }
      const out = (amt * v2XrpReserve) / (v2TokReserve + amt);
      return out;
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

  const createMarket = async () => {
    if (!canTrade) return;
    const name = createName.trim();
    const symbol = createSymbol.trim();
    if (!name || !symbol) {
      setStatusMsg("Name and symbol required");
      return;
    }
    resetWrite();
    setPendingCreate(true);
    const hash = await safeWrite("Creating market", () =>
      writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "createMarket",
        args: [name, symbol, createUri.trim(), zeroHash as Hex],
      })
    );
    if (!hash) setPendingCreate(false);
  };

  const doBuy = async () => {
    if (!canTrade || !marketAddr) return;
    if (isGraduated) {
      setStatusMsg(
        "Buy disabled — market graduated. Use Swap (DEX/LP) when a proven V2 pool exists."
      );
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
      setStatusMsg(
        "Sell disabled — market graduated. Use Swap (DEX/LP) when a proven V2 pool exists."
      );
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
    await safeWrite(`Approve V2 for ${swapAmount}`, () =>
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
      setStatusMsg(swapScarReason ?? "Swap not available");
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
      await safeWrite(`Swap ${swapAmount} XRP → token`, () =>
        writeContractAsync({
          address: TEST_DEX_V2_ADDRESS,
          abi: testDexV2Abi,
          functionName: "swapExactXrpForTokens",
          args: [tokenAddr, minOut],
          value: amount,
        })
      );
    } else {
      await safeWrite(`Swap ${swapAmount} token → XRP`, () =>
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
      // fallback: M22 if loading gSWAP path else M2
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

  // Prefer swap UI when graduated, buy on curve otherwise
  const activeSide =
    isGraduated && tradeSide !== "swap"
      ? "swap"
      : !isGraduated && tradeSide === "swap"
        ? "buy"
        : tradeSide;

  return (
    <div className="space-y-5">
      {!onCorrectChain && isConnected && (
        <div className="g-alert bad">
          Fail-closed: create / buy / sell / swap / graduate disabled until
          chainId === {XRPL_EVM_TESTNET_ID}.
        </div>
      )}

      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <h1 className="g-title">Markets</h1>
        <Link
          href="/new"
          className="g-btn sm"
          style={{ background: "var(--x)", color: "#fff", border: 0, fontWeight: 650, textDecoration: "none" }}
        >
          New market
        </Link>
      </div>
      {/* Search markets — meme quick-picks hidden behind Search */}
      <section>
        <div className="flex gap-2">
          <input
            className="g-search"
            value={loadQuery}
            onChange={(e) => setLoadQuery(e.target.value)}
            onFocus={() => setShowSearchExtras(true)}
            placeholder="Search markets"
          />
          <button
            type="button"
            onClick={() => void loadMarket()}
            className="g-btn"
            style={{
              background: "var(--x)",
              color: "#fff",
              border: 0,
              fontWeight: 650,
              whiteSpace: "nowrap",
            }}
          >
            Load
          </button>
        </div>
        <p className="g-hint" style={{ marginTop: 12 }}>
          Trending on testnet
        </p>
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 8 }}>
          <Link href="/t/gSWAP" className="g-mkt" style={{ textDecoration: "none", color: "inherit" }}>
            <TokenPfp ticker="gSWAP" size="sm" />
            <div>
              <div className="g-tick">gSWAP</div>
              <div className="g-sub">
                <span className="g-dot grad" />
                Graduated · V2
              </div>
            </div>
            <div className="g-sub">Open →</div>
          </Link>
          <Link href="/t/g589" className="g-mkt" style={{ textDecoration: "none", color: "inherit" }}>
            <TokenPfp ticker="g589" size="sm" />
            <div>
              <div className="g-tick">g589</div>
              <div className="g-sub">
                <span className="g-dot" />
                On curve · M2
              </div>
            </div>
            <div className="g-sub">Open →</div>
          </Link>
        </div>

        {showSearchExtras && (
          <details className="g-details" open>
            <summary>More markets (search)</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setLoadQuery(GSWAP_MARKET_ADDRESS);
                  void loadMarketByQuery(GSWAP_MARKET_ADDRESS);
                }}
                className="g-btn sm"
              >
                gSWAP
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoadQuery(G589_MARKET_ADDRESS);
                  void loadMarketByQuery(G589_MARKET_ADDRESS);
                }}
                className="g-btn sm"
                title="Preferred M2 bonding-curve (over T589 scar)"
              >
                g589
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoadQuery(MARKET2_ADDRESS);
                  void loadMarketByQuery(MARKET2_ADDRESS);
                }}
                className="g-btn sm"
              >
                Market #2
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoadQuery(T589_MARKET_ADDRESS);
                  void loadMarketByQuery(T589_MARKET_ADDRESS);
                }}
                className="g-btn sm"
                style={{ color: "var(--dim)" }}
                title="Scar · v1 no swap — not featured"
              >
                T589 · scar
              </button>
              {MEME_TESTNET_MARKETS.map((m) => (
                <button
                  key={m.symbol}
                  type="button"
                  onClick={() => {
                    setLoadQuery(m.symbol);
                    void loadMarketByQuery(m.symbol);
                  }}
                  className="g-btn sm"
                  title={m.name}
                >
                  {m.symbol}
                </button>
              ))}
            </div>
          </details>
        )}
        {loadError && (
          <p className="g-sub mt-2" style={{ color: "var(--bad)" }}>
            {loadError}
          </p>
        )}
      </section>

      {marketAddr && (
        <section>
          <div className="g-sub">
            Market · {isGraduated ? "graduated" : "on curve"}
            {isT589 ? " · scar" : ""}
          </div>
          <h1 className="g-display" style={{ marginTop: 4 }}>
            {tokenSymbol || "…"}
          </h1>
          <div className="g-sub" style={{ marginTop: 6 }}>
            {price !== undefined
              ? `${Number(formatEther(price)).toPrecision(4)} XRP / token`
              : "—"}
          </div>

          <div className="g-seg" role="tablist" aria-label="Trade side">
            <button
              type="button"
              className={activeSide === "buy" ? "on" : undefined}
              disabled={isGraduated}
              onClick={() => setTradeSide("buy")}
            >
              Buy
            </button>
            <button
              type="button"
              className={activeSide === "sell" ? "on" : undefined}
              disabled={isGraduated}
              onClick={() => setTradeSide("sell")}
            >
              Sell
            </button>
            <button
              type="button"
              className={activeSide === "swap" ? "on" : undefined}
              disabled={!isGraduated}
              onClick={() => setTradeSide("swap")}
            >
              Swap
            </button>
          </div>

          {activeSide === "buy" && !isGraduated && (
            <>
              <div className="g-field">
                <label>You pay</label>
                <input
                  value={buyXrp}
                  onChange={(e) => setBuyXrp(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.1"
                />
                <div className="g-pct">
                  {["0.05", "0.1", "0.5", "1"].map((v) => (
                    <button key={v} type="button" onClick={() => setBuyXrp(v)}>
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
                Buy {tokenSymbol || "token"}
              </button>
              <p className="g-hint">You sign in wallet. GRAAV never holds the key.</p>
            </>
          )}

          {activeSide === "sell" && !isGraduated && (
            <>
              <div className="g-field">
                <label>You sell</label>
                <input
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="1"
                />
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void doApprove()}
                  disabled={tradeDisabled || !marketAddr || !needsApprove}
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
                Allowance: {allowance !== undefined ? formatEther(allowance) : "—"}
              </p>
            </>
          )}

          {activeSide === "swap" && isGraduated && (
            <>
              {swapScarReason ? (
                <div className="g-alert warn">
                  <strong>Swap disabled.</strong> {swapScarReason}
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
                      XRP → {tokenSymbol || "token"}
                    </button>
                    <button
                      type="button"
                      className={swapSide === "tokenToXrp" ? "on" : undefined}
                      onClick={() => {
                        setSwapSide("tokenToXrp");
                        setSwapAmount(sellAmount || "1");
                      }}
                    >
                      {tokenSymbol || "token"} → XRP
                    </button>
                  </div>
                  <div className="g-field">
                    <label>
                      {swapSide === "xrpToToken"
                        ? "You pay"
                        : `${tokenSymbol || "Token"} in`}
                    </label>
                    <input
                      value={swapAmount}
                      onChange={(e) => setSwapAmount(e.target.value)}
                      inputMode="decimal"
                      placeholder="0.1"
                    />
                  </div>
                  <p className="g-hint">
                    Est. out:{" "}
                    {quoteOut !== null
                      ? `${formatEther(quoteOut)} ${
                          swapSide === "xrpToToken"
                            ? tokenSymbol || "token"
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
                      {needsV2Approve ? "Approve V2" : "V2 approved"}
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
                    Swap (wallet signs)
                  </button>
                  <p className="g-hint">You sign in wallet. GRAAV never holds the key.</p>
                </>
              )}
            </>
          )}

          <details className="g-details">
            <summary>Details</summary>
            <div className="g-kv">
              <span>Chain</span>
              <span className="g-mono">{XRPL_EVM_TESTNET_ID}</span>
            </div>
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
              <span>realXrp</span>
              <span>
                {realXrp !== undefined ? formatEther(realXrp) + " XRP" : "…"}
              </span>
            </div>
            <div className="g-kv">
              <span>tokenReserve</span>
              <span>
                {tokenReserve !== undefined ? formatEther(tokenReserve) : "…"}
              </span>
            </div>
            <div className="g-kv">
              <span>Your balance</span>
              <span>
                {tokenBalance !== undefined
                  ? formatEther(tokenBalance)
                  : isConnected
                    ? "…"
                    : "connect wallet"}
              </span>
            </div>
            <div className="g-kv">
              <span>TestDex V2</span>
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
                  "not wired"
                )}
              </span>
            </div>
            {hasProvenV2Pool && (
              <>
                <div className="g-kv">
                  <span>V2 XRP</span>
                  <span>
                    {v2XrpReserve !== undefined
                      ? formatEther(v2XrpReserve)
                      : "…"}
                  </span>
                </div>
                <div className="g-kv">
                  <span>V2 token</span>
                  <span>
                    {v2TokReserve !== undefined
                      ? formatEther(v2TokReserve)
                      : "…"}
                  </span>
                </div>
              </>
            )}
            <div className="g-kv">
              <span>Factory.graduated</span>
              <span>
                {factoryGraduated === null
                  ? "n/a"
                  : String(factoryGraduated)}
              </span>
            </div>
            <div className="g-kv">
              <span>threshold</span>
              <span>
                {threshold !== undefined
                  ? formatEther(threshold) + " XRP"
                  : "…"}
              </span>
            </div>
            <div className="g-kv">
              <span>Factory markets</span>
              <span>{String(marketCount ?? "…")}</span>
            </div>
          </details>
        </section>
      )}

      <details className="g-details">
        <summary>New market</summary>
        <p className="g-sub" style={{ margin: "8px 0 12px" }}>
          Origin optional. Signature required. Chat is not authorization.
        </p>
        <div className="space-y-2">
          <Field
            label="Name"
            value={createName}
            onChange={setCreateName}
            placeholder="GRAAV"
          />
          <Field
            label="Ticker · one cashtag"
            value={createSymbol}
            onChange={setCreateSymbol}
            placeholder="MYTK"
          />
          <Field
            label="metadataURI (optional)"
            value={createUri}
            onChange={setCreateUri}
            placeholder="ipfs://… or https://x.com/…"
          />
        </div>
        <button
          type="button"
          onClick={() => void createMarket()}
          disabled={tradeDisabled}
          className="g-cta"
        >
          Create on testnet
        </button>
        <p className="g-hint">Creates on M2 factory. gSWAP never on M2.</p>
      </details>

      <details className="g-details">
        <summary>Graduate</summary>
        <button
          type="button"
          onClick={() => void doGraduate()}
          disabled={tradeDisabled || !marketAddr || isGraduated}
          className="g-cta ghost"
        >
          Graduate market
        </button>
        <p className="g-hint">
          M2 GM → TestDex v1 (scar). M22 GM → TestDex V2 (gSWAP). Prefer gSWAP then
          g589 (M2 curve). T589 is a scar — do not feature.
        </p>
      </details>

      <section className="g-card text-sm">
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
        {!statusMsg && !txHash && !writeError && (
          <p style={{ color: "var(--dim)" }}>Ready.</p>
        )}
      </section>
    </div>
  );
}
