"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits, parseUnits, zeroAddress, zeroHash, type Address } from "viem";
import { XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import { RLUSD_V1 as C } from "@/lib/rlusd-v1/config";
import { rlusdCurveAbi, rlusdErc20Abi, rlusdPairAbi } from "@/lib/rlusd-v1/contracts";

type Side = "buy" | "sell" | "swap";
type SwapDirection = "quoteToCoin" | "coinToQuote";
type Props = { coinAddress?: string | null; curveAddress?: string | null; symbol?: string };

const SLIPPAGE_BPS = 995n;
const ZERO = zeroAddress as Address;

function asAddress(value: string | null | undefined): Address | undefined {
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : undefined;
}
function ceilDiv(n: bigint, d: bigint) { return (n + d - 1n) / d; }
function amountLabel(value: bigint | undefined) { return value === undefined ? "—" : formatUnits(value, C.quoteDecimals); }

/** Direct wallet-signed RLUSD Coin V1 execution. No server session is involved. */
export function RlusdTradePanel({ coinAddress, curveAddress, symbol = "MOMENT" }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync, data: txHash, isPending: isWriting, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });
  const [side, setSide] = useState<Side>("buy");
  const [swapDirection, setSwapDirection] = useState<SwapDirection>("quoteToCoin");
  const [amount, setAmount] = useState("5");
  const [referrerInput, setReferrerInput] = useState("");
  const [midwifeInput, setMidwifeInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const quote = asAddress(C.quoteAddress);
  const coin = asAddress(coinAddress ?? C.coinAddress);
  const curve = asAddress(curveAddress ?? C.curveAddress);
  const referrerAddress = referrerInput.trim() ? asAddress(referrerInput.trim()) : undefined;
  const referrer = referrerAddress ?? ZERO;
  const midwifeAddress = midwifeInput.trim() ? asAddress(midwifeInput.trim()) : undefined;
  const midwife = midwifeAddress ?? ZERO;
  const attributionInputError =
    (referrerInput.trim() && !referrerAddress) || (midwifeInput.trim() && !midwifeAddress);
  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;
  const cloneConfigured = C.profile === "testnet-clone" && C.liveExecutionEnabled && !!C.factoryAddress && !!quote && !!coin && !!curve;

  const { data: graduated, isError: curveReadError } = useReadContract({ address: curve, abi: rlusdCurveAbi, functionName: "graduated", query: { enabled: cloneConfigured } });
  const { data: pair } = useReadContract({ address: curve, abi: rlusdCurveAbi, functionName: "pair", query: { enabled: cloneConfigured && graduated === true } });
  const pairAddress = asAddress(pair as string | undefined);
  const { data: realQuote } = useReadContract({ address: curve, abi: rlusdCurveAbi, functionName: "realQuote", query: { enabled: cloneConfigured } });
  const { data: threshold } = useReadContract({ address: curve, abi: rlusdCurveAbi, functionName: "threshold", query: { enabled: cloneConfigured } });
  const { data: curveInventory } = useReadContract({ address: curve, abi: rlusdCurveAbi, functionName: "curveInventory", query: { enabled: cloneConfigured } });
  const { data: virtualX } = useReadContract({ address: curve, abi: rlusdCurveAbi, functionName: "virtualX", query: { enabled: cloneConfigured && graduated === false } });
  const { data: virtualY } = useReadContract({ address: curve, abi: rlusdCurveAbi, functionName: "virtualY", query: { enabled: cloneConfigured && graduated === false } });
  const { data: reserveToken } = useReadContract({ address: pairAddress as Address, abi: rlusdPairAbi, functionName: "reserveToken", query: { enabled: !!pairAddress && graduated === true } });
  const { data: reserveQuote } = useReadContract({ address: pairAddress as Address, abi: rlusdPairAbi, functionName: "reserveQuote", query: { enabled: !!pairAddress && graduated === true } });
  const { data: quoteBalance } = useReadContract({ address: quote, abi: rlusdErc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!quote && !!address } });
  const { data: coinBalance } = useReadContract({ address: coin, abi: rlusdErc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, query: { enabled: !!coin && !!address } });

  const spender = graduated === true ? pairAddress : curve;
  const { data: quoteAllowance } = useReadContract({ address: quote, abi: rlusdErc20Abi, functionName: "allowance", args: address && spender ? [address, spender] : undefined, query: { enabled: !!quote && !!address && !!spender } });
  const { data: coinAllowance } = useReadContract({ address: coin, abi: rlusdErc20Abi, functionName: "allowance", args: address && spender ? [address, spender] : undefined, query: { enabled: !!coin && !!address && !!spender } });

  const parsedAmount = useMemo(() => {
    try { const value = parseUnits(amount || "0", C.quoteDecimals); return value > 0n ? value : null; } catch { return null; }
  }, [amount]);

  const quoteOut = useMemo(() => {
    if (!parsedAmount) return null;
    try {
      if (graduated === false && virtualX !== undefined && virtualY !== undefined) {
        if (side === "buy") {
          const net = parsedAmount - parsedAmount / 100n;
          if (net <= 0n) return null;
          const nextX = ceilDiv(virtualX * virtualY + virtualY + net - 1n, virtualY + net);
          return virtualX > nextX ? virtualX - nextX : null;
        }
        const nextY = ceilDiv(virtualX * virtualY + virtualX + parsedAmount - 1n, virtualX + parsedAmount);
        const gross = virtualY > nextY ? virtualY - nextY : 0n;
        return gross > 0n ? gross - gross / 100n : null;
      }
      if (graduated === true && reserveToken !== undefined && reserveQuote !== undefined && side === "swap") {
        if (swapDirection === "quoteToCoin") {
          const net = parsedAmount - parsedAmount / 100n;
          if (net <= 0n) return null;
          const nextToken = ceilDiv(reserveToken * reserveQuote + reserveQuote + net - 1n, reserveQuote + net);
          return reserveToken > nextToken ? reserveToken - nextToken : null;
        }
        const nextQuote = ceilDiv(reserveToken * reserveQuote + reserveToken + parsedAmount - 1n, reserveToken + parsedAmount);
        const gross = reserveQuote > nextQuote ? reserveQuote - nextQuote : 0n;
        return gross > 0n ? gross - gross / 100n : null;
      }
    } catch { return null; }
    return null;
  }, [graduated, parsedAmount, reserveQuote, reserveToken, side, swapDirection, virtualX, virtualY]);

  const minOut = quoteOut ? (quoteOut * SLIPPAGE_BPS) / 1000n : null;
  const readReady = cloneConfigured && !curveReadError && graduated !== undefined && (graduated === false || (!!pairAddress && reserveToken !== undefined && reserveQuote !== undefined));
  const actionModeReady = (graduated === false && (side === "buy" || side === "sell")) || (graduated === true && side === "swap" && !!pairAddress);
  const isReady = readReady && isConnected && onCorrectChain && !!address && !!parsedAmount && !!minOut && !isWriting && !isConfirming && actionModeReady && !attributionInputError;
  const quoteNeedsApproval = (side === "buy" || (side === "swap" && swapDirection === "quoteToCoin")) && (quoteAllowance === undefined || !parsedAmount || quoteAllowance < parsedAmount);
  const coinNeedsApproval = (side === "sell" || (side === "swap" && swapDirection === "coinToQuote")) && (coinAllowance === undefined || !parsedAmount || coinAllowance < parsedAmount);
  const needsApproval = quoteNeedsApproval || coinNeedsApproval;
  const actionEnabled = isReady && !needsApproval;

  const approve = async (token: Address | undefined, label: string) => {
    if (!token || !spender || !parsedAmount || !isConnected || !onCorrectChain) return;
    reset();
    try {
      setStatus(`Approve ${label} in wallet…`);
      const hash = await writeContractAsync({ address: token, abi: rlusdErc20Abi, functionName: "approve", args: [spender, parsedAmount] });
      setStatus(`Approval submitted: ${hash}`);
    } catch (error) {
      setStatus(`Approval cancelled or failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const execute = async () => {
    if (!address || !curve || !coin || (side === "swap" && !pairAddress) || !parsedAmount || !minOut || !actionEnabled) {
      setStatus("RLUSD trade unavailable — connect wallet, verify chain, approvals, and live clone reads.");
      return;
    }
    reset();
    try {
      setStatus(`${side === "buy" ? "Buy" : side === "sell" ? "Sell" : "Swap"} ${symbol}… sign in wallet.`);
      const hash = side === "buy"
        ? await writeContractAsync({ address: curve, abi: rlusdCurveAbi, functionName: "buy", args: [parsedAmount, minOut, address, referrer, midwife, zeroHash] })
        : side === "sell"
          ? await writeContractAsync({ address: curve, abi: rlusdCurveAbi, functionName: "sell", args: [parsedAmount, minOut, address, zeroHash] })
          : swapDirection === "quoteToCoin"
            ? await writeContractAsync({ address: pairAddress as Address, abi: rlusdPairAbi, functionName: "swapQuoteForToken", args: [parsedAmount, minOut, address, referrer, midwife, zeroHash] })
            : await writeContractAsync({ address: pairAddress as Address, abi: rlusdPairAbi, functionName: "swapTokenForQuote", args: [parsedAmount, minOut, address, zeroHash] });
      setStatus(`Submitted: ${hash}`);
    } catch (error) {
      setStatus(`${side.toUpperCase()} cancelled or failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const stateReason = attributionInputError
    ? "Referrer and midwife must be valid wallet addresses."
    : !C.liveExecutionEnabled || C.profile !== "testnet-clone" ? "RLUSD clone execution is not configured." : !isConnected ? "Connect wallet to sign RLUSD transactions." : !onCorrectChain ? `Switch to XRPL EVM Testnet (${XRPL_EVM_TESTNET_ID}).` : curveReadError ? "Live clone market read failed; trading is disabled." : graduated === true && !pairAddress ? "Graduated market has no verified pair; swap is disabled." : graduated === undefined ? "Reading the live clone market…" : null;
  const displayIn = side === "sell" || (side === "swap" && swapDirection === "coinToQuote") ? symbol : "RLUSD";
  const displayOut = displayIn === symbol ? "RLUSD" : symbol;

  return (
    <section className="g-card" aria-labelledby="rlusd-trade-panel" style={{ marginTop: 16 }}>
      <div className="g-micro">WALLET-SIGNED RLUSD MARKET</div>
      <h2 id="rlusd-trade-panel" className="g-title" style={{ marginTop: 6 }}>${symbol}</h2>
      <p className="g-hint" style={{ marginTop: 6 }}>Quote: RLUSD · chain {C.chainId} · direct clone calls</p>
      {stateReason && <div className="g-alert warn" style={{ marginTop: 12 }}>{stateReason}</div>}
      {graduated === true && <div className="g-alert" style={{ marginTop: 12 }}>Graduated: only the verified RLUSD pair swap path is enabled.</div>}
      <div className="g-seg" role="tablist" aria-label="RLUSD trade action" style={{ marginTop: 14 }}>
        <button type="button" className={side === "buy" ? "on" : undefined} onClick={() => setSide("buy")}>Buy</button>
        <button type="button" className={side === "sell" ? "on" : undefined} onClick={() => setSide("sell")}>Sell</button>
        <button type="button" className={side === "swap" ? "on" : undefined} onClick={() => setSide("swap")}>Swap</button>
      </div>
      {side === "swap" && <div className="g-seg" role="tablist" aria-label="RLUSD swap direction" style={{ marginTop: 8 }}>
        <button type="button" className={swapDirection === "quoteToCoin" ? "on" : undefined} onClick={() => setSwapDirection("quoteToCoin")}>RLUSD → ${symbol}</button>
        <button type="button" className={swapDirection === "coinToQuote" ? "on" : undefined} onClick={() => setSwapDirection("coinToQuote")}>${symbol} → RLUSD</button>
      </div>}
      <div className="g-field" style={{ marginTop: 12 }}>
        <label>{displayIn} in</label>
        <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="5" />
      </div>
      {(side === "buy" || (side === "swap" && swapDirection === "quoteToCoin")) && (
        <details className="g-details" style={{ marginTop: 12 }}>
          <summary>Share &amp; Earn attribution (optional)</summary>
          <p className="g-hint" style={{ marginTop: 8 }}>Use the wallets from a signed Touch. The console never mints Touch records; invalid or expired attribution fails closed on-chain.</p>
          <div className="g-field" style={{ marginTop: 10 }}>
            <label>Referrer wallet</label>
            <input value={referrerInput} onChange={(event) => setReferrerInput(event.target.value)} inputMode="text" placeholder="0x…" autoComplete="off" spellCheck={false} />
          </div>
          <div className="g-field" style={{ marginTop: 10 }}>
            <label>Midwife wallet</label>
            <input value={midwifeInput} onChange={(event) => setMidwifeInput(event.target.value)} inputMode="text" placeholder="0x…" autoComplete="off" spellCheck={false} />
          </div>
        </details>
      )}
      <p className="g-hint">Estimated out: {quoteOut ? amountLabel(quoteOut) : "—"} {displayOut}</p>
      {needsApproval && <button type="button" className="g-cta ghost" disabled={!isReady || !spender} onClick={() => void approve(coinNeedsApproval ? coin : quote, coinNeedsApproval ? symbol : "RLUSD")}>Approve {coinNeedsApproval ? symbol : "RLUSD"}</button>}
      <button type="button" className="g-cta" disabled={!actionEnabled} onClick={() => void execute()}>{side === "buy" ? `Buy ${symbol} with RLUSD` : side === "sell" ? `Sell ${symbol} for RLUSD` : `Swap ${displayIn} → ${displayOut}`}</button>
      <p className="g-hint">Wallet signs every approval and trade. Chat never authorizes or sends transactions.</p>
      <div className="g-kv" style={{ marginTop: 14 }}><span>RLUSD balance</span><span>{amountLabel(quoteBalance as bigint | undefined)}</span></div>
      <div className="g-kv"><span>${symbol} balance</span><span>{amountLabel(coinBalance as bigint | undefined)}</span></div>
      <div className="g-kv"><span>Curve RLUSD reserve</span><span>{amountLabel(realQuote as bigint | undefined)} / {amountLabel(threshold as bigint | undefined)}</span></div>
      {graduated === false && <div className="g-kv"><span>Curve inventory</span><span>{amountLabel(curveInventory as bigint | undefined)}</span></div>}
      {status && <div className="g-alert" style={{ marginTop: 12 }}>{status}{isConfirmed ? " · confirmed" : isConfirming ? " · confirming…" : ""}</div>}
      {txHash && <p className="g-micro" style={{ marginTop: 8 }}>Transaction submitted: {txHash}</p>}
    </section>
  );
}
