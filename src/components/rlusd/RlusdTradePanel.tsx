"use client";

import { useMemo, useRef, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { parseUnits, zeroAddress, zeroHash, type Address } from "viem";
import { XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import { SwapIcon } from "@/components/shell/Icons";
import { TokenPfp } from "@/components/pfp/TokenPfp";
import { advanceLiveState, registryRowAvailability, tipMarketAvailability } from "@/lib/rlusd-v1/availability";
import { RLUSD_V1 as C } from "@/lib/rlusd-v1/config";
import { rlusdCurveAbi, rlusdErc20Abi, rlusdPairAbi } from "@/lib/rlusd-v1/contracts";
import { formatKnownAmount } from "@/lib/rlusd-v1/format";
import { getRlusdMarket } from "@/lib/rlusd-v1/marketRegistry";
import { previewBuyOut, previewSellOut, splitFees } from "@/lib/rlusd-v1/model";

type Side = "buy" | "sell";
type Phase = "edit" | "review";
type Props = {
  coinAddress?: string | null;
  curveAddress?: string | null;
  symbol?: string;
  name?: string;
  sourcePostId?: string;
};

const SLIPPAGE_BPS = 50n;
const ZERO = zeroAddress as Address;

function asAddress(value: string | null | undefined): Address | undefined {
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : undefined;
}

export function RlusdTradePanel({
  coinAddress,
  curveAddress,
  symbol,
  name,
  sourcePostId,
}: Props) {
  const market = sourcePostId ? getRlusdMarket(sourcePostId) : null;
  const ticker = symbol || market?.symbol || "COIN";
  const title = name || market?.name || ticker;
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [side, setSide] = useState<Side>("buy");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<Phase>("edit");
  const [referrerInput, setReferrerInput] = useState("");
  const [midwifeInput, setMidwifeInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const submitting = useRef(false);

  const availabilityBase = market
    ? registryRowAvailability(market)
    : tipMarketAvailability();
  const coin = asAddress(coinAddress ?? (availabilityBase.state === "unconfigured" ? null : availabilityBase.ids.coin));
  const curve = asAddress(curveAddress ?? (availabilityBase.state === "unconfigured" ? null : availabilityBase.ids.curve));
  const quote = asAddress(C.quoteAddress);
  const configured = availabilityBase.state !== "unconfigured" && !!coin && !!curve && !!quote;

  const { data: graduated, isError: curveReadError, isLoading: curveLoading } = useReadContract({
    address: curve,
    abi: rlusdCurveAbi,
    functionName: "graduated",
    query: { enabled: configured },
  });
  const { data: pair } = useReadContract({
    address: curve,
    abi: rlusdCurveAbi,
    functionName: "pair",
    query: { enabled: configured && graduated === true },
  });
  const pairAddress = asAddress(pair as string | undefined);
  const { data: realQuote } = useReadContract({
    address: curve,
    abi: rlusdCurveAbi,
    functionName: "realQuote",
    query: { enabled: configured },
  });
  const { data: threshold } = useReadContract({
    address: curve,
    abi: rlusdCurveAbi,
    functionName: "threshold",
    query: { enabled: configured },
  });
  const { data: virtualX } = useReadContract({
    address: curve,
    abi: rlusdCurveAbi,
    functionName: "virtualX",
    query: { enabled: configured && graduated === false },
  });
  const { data: virtualY } = useReadContract({
    address: curve,
    abi: rlusdCurveAbi,
    functionName: "virtualY",
    query: { enabled: configured && graduated === false },
  });
  const { data: reserveToken } = useReadContract({
    address: pairAddress as Address,
    abi: rlusdPairAbi,
    functionName: "reserveToken",
    query: { enabled: !!pairAddress && graduated === true },
  });
  const { data: reserveQuote } = useReadContract({
    address: pairAddress as Address,
    abi: rlusdPairAbi,
    functionName: "reserveQuote",
    query: { enabled: !!pairAddress && graduated === true },
  });
  const { data: quoteBalance, isFetched: quoteBalFetched } = useReadContract({
    address: quote,
    abi: rlusdErc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!quote && !!address },
  });
  const { data: coinBalance, isFetched: coinBalFetched } = useReadContract({
    address: coin,
    abi: rlusdErc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!coin && !!address },
  });
  const spender = graduated === true ? pairAddress : curve;
  const { data: quoteAllowance } = useReadContract({
    address: quote,
    abi: rlusdErc20Abi,
    functionName: "allowance",
    args: address && spender ? [address, spender] : undefined,
    query: { enabled: !!quote && !!address && !!spender },
  });
  const { data: coinAllowance } = useReadContract({
    address: coin,
    abi: rlusdErc20Abi,
    functionName: "allowance",
    args: address && spender ? [address, spender] : undefined,
    query: { enabled: !!coin && !!address && !!spender },
  });

  const availability = advanceLiveState(availabilityBase, {
    loading: configured && (curveLoading || graduated === undefined),
    failed: configured && curveReadError,
    graduated: graduated as boolean | undefined,
  });

  const parsedAmount = useMemo(() => {
    try {
      const value = parseUnits(amount || "0", C.quoteDecimals);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  }, [amount]);

  const quoteOut = useMemo(() => {
    if (!parsedAmount) return null;
    try {
      if (graduated === false && virtualX !== undefined && virtualY !== undefined) {
        return side === "buy"
          ? previewBuyOut(virtualX, virtualY, parsedAmount)
          : previewSellOut(virtualX, virtualY, parsedAmount);
      }
      if (graduated === true && reserveToken !== undefined && reserveQuote !== undefined) {
        return side === "buy"
          ? previewBuyOut(reserveToken, reserveQuote, parsedAmount)
          : previewSellOut(reserveToken, reserveQuote, parsedAmount);
      }
    } catch {
      return null;
    }
    return null;
  }, [graduated, parsedAmount, reserveQuote, reserveToken, side, virtualX, virtualY]);

  const fees = parsedAmount
    ? splitFees({
        grossQuote: parsedAmount,
        action: side === "buy" ? "BUY" : "SELL",
        referrerEligible: false,
        midwifeDistinct: false,
        lifetimeFeesBefore: 0n,
        referrerCreditsBefore: 0n,
      })
    : null;
  const minOut = quoteOut ? (quoteOut * (10000n - SLIPPAGE_BPS)) / 10000n : null;
  const referrerAddress = referrerInput.trim() ? asAddress(referrerInput.trim()) : undefined;
  const midwifeAddress = midwifeInput.trim() ? asAddress(midwifeInput.trim()) : undefined;
  const attributionInputError =
    (referrerInput.trim() && !referrerAddress) || (midwifeInput.trim() && !midwifeAddress);

  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;
  const tradable = availability.state === "tradable" && (availability.graduated === false || !!pairAddress);
  const paySymbol = side === "buy" ? "Test RLUSD" : ticker;
  const receiveSymbol = side === "buy" ? ticker : "Test RLUSD";
  const quoteNeedsApproval = side === "buy" && (quoteAllowance === undefined || !parsedAmount || quoteAllowance < parsedAmount);
  const coinNeedsApproval = side === "sell" && (coinAllowance === undefined || !parsedAmount || coinAllowance < parsedAmount);
  const needsApproval = quoteNeedsApproval || coinNeedsApproval;
  const reviewReady =
    tradable &&
    isConnected &&
    onCorrectChain &&
    !!address &&
    !!parsedAmount &&
    !!minOut &&
    !attributionInputError &&
    !isWriting &&
    !isConfirming &&
    !submitting.current;

  const stateReason =
    availability.state === "unconfigured"
      ? "This launch is not wired to a live coin and curve. Review stays disabled."
      : availability.state === "loading"
        ? "Reading the live market…"
        : availability.state === "failed"
          ? "Live market read failed. Trading is disabled."
          : availability.state === "configured"
            ? "Market addresses are present but live state is not confirmed."
            : !isConnected
              ? "Connect wallet to review and sign."
              : !onCorrectChain
                ? `Switch to XRPL EVM Testnet (${XRPL_EVM_TESTNET_ID}).`
                : attributionInputError
                  ? "Referrer and midwife must be valid wallet addresses."
                  : null;

  const approve = async () => {
    if (!reviewReady || !spender || submitting.current) return;
    submitting.current = true;
    reset();
    try {
      setStatus(`Approve ${needsApproval && coinNeedsApproval ? ticker : "RLUSD"} in wallet…`);
      const token = coinNeedsApproval ? coin : quote;
      if (!token || !parsedAmount) return;
      const hash = await writeContractAsync({
        address: token,
        abi: rlusdErc20Abi,
        functionName: "approve",
        args: [spender, parsedAmount],
      });
      setStatus(`Approval submitted: ${hash}`);
    } catch (error) {
      setStatus(`Approval cancelled or failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      submitting.current = false;
    }
  };

  const execute = async () => {
    if (!reviewReady || !address || !curve || !parsedAmount || !minOut || submitting.current) return;
    submitting.current = true;
    reset();
    try {
      setStatus("Simulating…");
      const referrer = referrerAddress ?? ZERO;
      const midwife = midwifeAddress ?? ZERO;
      if (!publicClient) throw new Error("RPC client not ready");
      if (side === "buy") {
        await publicClient.simulateContract({
          address: curve,
          abi: rlusdCurveAbi,
          functionName: "buy",
          args: [parsedAmount, minOut, address, referrer, midwife, zeroHash],
          account: address,
        });
        setStatus("Sign buy in wallet…");
        const hash = await writeContractAsync({
          address: curve,
          abi: rlusdCurveAbi,
          functionName: "buy",
          args: [parsedAmount, minOut, address, referrer, midwife, zeroHash],
        });
        setStatus(`Submitted: ${hash}`);
      } else if (graduated === true && pairAddress) {
        await publicClient.simulateContract({
          address: pairAddress,
          abi: rlusdPairAbi,
          functionName: "swapTokenForQuote",
          args: [parsedAmount, minOut, address, zeroHash],
          account: address,
        });
        setStatus("Sign sell in wallet…");
        const hash = await writeContractAsync({
          address: pairAddress,
          abi: rlusdPairAbi,
          functionName: "swapTokenForQuote",
          args: [parsedAmount, minOut, address, zeroHash],
        });
        setStatus(`Submitted: ${hash}`);
      } else {
        await publicClient.simulateContract({
          address: curve,
          abi: rlusdCurveAbi,
          functionName: "sell",
          args: [parsedAmount, minOut, address, zeroHash],
          account: address,
        });
        setStatus("Sign sell in wallet…");
        const hash = await writeContractAsync({
          address: curve,
          abi: rlusdCurveAbi,
          functionName: "sell",
          args: [parsedAmount, minOut, address, zeroHash],
        });
        setStatus(`Submitted: ${hash}`);
      }
    } catch (error) {
      setStatus(`Cancelled or failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      submitting.current = false;
    }
  };

  const payBalance = side === "buy"
    ? (address && quoteBalFetched ? quoteBalance : undefined)
    : (address && coinBalFetched ? coinBalance : undefined);

  return (
    <section className="g-trade" aria-labelledby="trade-heading">
      <div className="g-trade-head">
        <TokenPfp ticker={ticker} size="md" />
        <div>
          <h1 id="trade-heading" className="g-display">{ticker}</h1>
          <p className="g-sub">{title}</p>
        </div>
      </div>

      <div className="g-underline-tabs" role="tablist" aria-label="Trade side">
        <button type="button" className={side === "buy" ? "on" : undefined} onClick={() => { setSide("buy"); setPhase("edit"); }}>Buy</button>
        <button type="button" className={side === "sell" ? "on" : undefined} onClick={() => { setSide("sell"); setPhase("edit"); }}>Sell</button>
      </div>

      {stateReason && <div className="g-alert warn" style={{ marginTop: 16 }}>{stateReason}</div>}

      <div className="g-swap-field">
        <div className="g-swap-label">
          <span>You pay</span>
          <span>Balance: {formatKnownAmount(payBalance)}</span>
        </div>
        <div className="g-swap-row">
          <input
            value={amount}
            onChange={(event) => { setAmount(event.target.value); setPhase("edit"); }}
            inputMode="decimal"
            placeholder="0.00"
            aria-label="You pay"
          />
          <span className="g-asset-chip">{paySymbol}</span>
        </div>
      </div>

      <div className="g-swap-mid" aria-hidden="true"><SwapIcon /></div>

      <div className="g-swap-field g-swap-out">
        <div className="g-swap-label"><span>Estimated receive</span></div>
        <div className="g-swap-row">
          <span className="g-swap-out-value">{formatKnownAmount(quoteOut ?? undefined)}</span>
          <span className="g-asset-chip">{receiveSymbol}</span>
        </div>
      </div>

      <dl className="g-trade-meta">
        <div><dt>Fee (1%)</dt><dd>{fees ? formatKnownAmount(fees.total) : "—"} {side === "buy" ? "RLUSD" : ticker}</dd></div>
        <div><dt>Slippage (0.5%)</dt><dd>0.5%</dd></div>
        <div><dt>Min. received</dt><dd>{minOut ? formatKnownAmount(minOut) : "—"} {receiveSymbol}</dd></div>
      </dl>

      {phase === "review" && (
        <div className="g-alert" style={{ marginTop: 12 }}>
          Review this {side} then approve or sign. Chat is not authorization.
        </div>
      )}

      {phase === "edit" ? (
        <button
          type="button"
          className="g-cta"
          disabled={!reviewReady}
          onClick={() => setPhase("review")}
        >
          {side === "buy" ? "Review buy" : "Review sell"}
        </button>
      ) : needsApproval ? (
        <button type="button" className="g-cta" disabled={!reviewReady || !spender} onClick={() => void approve()}>
          Approve {coinNeedsApproval ? ticker : "RLUSD"}
        </button>
      ) : (
        <button type="button" className="g-cta" disabled={!reviewReady} onClick={() => void execute()}>
          Sign {side} in wallet
        </button>
      )}

      <p className="g-hint">Approval may be required. Your wallet signs every transaction.</p>

      <details className="g-details">
        <summary>Details</summary>
        <div className="g-kv"><span>Fee split</span><span>40 / 35 / 20 / 5</span></div>
        <div className="g-kv"><span>Quote</span><span>RLUSD</span></div>
        <div className="g-kv"><span>Availability</span><span>{availability.state}</span></div>
        <div className="g-kv"><span>Curve reserve</span><span>{formatKnownAmount(realQuote as bigint | undefined)} / {formatKnownAmount(threshold as bigint | undefined)}</span></div>
        {(side === "buy") && (
          <>
            <label className="g-field" style={{ marginTop: 12 }}>
              <span>Referrer wallet</span>
              <input className="sm" value={referrerInput} onChange={(event) => setReferrerInput(event.target.value)} placeholder="Optional 0x…" />
            </label>
            <label className="g-field" style={{ marginTop: 12 }}>
              <span>Midwife wallet</span>
              <input className="sm" value={midwifeInput} onChange={(event) => setMidwifeInput(event.target.value)} placeholder="Optional 0x…" />
            </label>
          </>
        )}
      </details>

      {status && <div className="g-alert" style={{ marginTop: 12 }}>{status}{isConfirmed ? " · confirmed" : isConfirming ? " · confirming…" : ""}</div>}
    </section>
  );
}
