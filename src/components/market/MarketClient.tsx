"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
} from "wagmi";
import { formatEther, type Address } from "viem";
import { AppChrome } from "@/components/AppChrome";
import { TokenPfp } from "@/components/pfp/TokenPfp";
import {
  XRPL_EVM_TESTNET_ID,
  EXPLORER_URL,
  marketAbi,
  erc20Abi,
  TEST_DEX_V2_ADDRESS,
} from "@/lib/chain";
import { findKnownMarket } from "@/lib/marketsRegistry";
import { shortAddr } from "@/lib/wallet";
import { MarketChart } from "@/components/market/MarketChart";
import { XTradeCta } from "@/components/XTradeCta";
import { resolveKnown } from "@/lib/chatIntent";

type Props = { ticker: string };

const PRESETS = ["0.05", "0.1", "0.5", "1"] as const;
const PCT = [25, 50, 75, 100] as const;

export function MarketClient({ ticker }: Props) {
  const known = findKnownMarket(ticker);
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const router = useRouter();
  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;

  const marketAddr = known?.market as Address | undefined;
  const factoryAddr = known?.factory;
  const scar = !!known?.scar;

  const [graduated, setGraduated] = useState<boolean | null>(
    known?.graduatedHint ?? null
  );
  const [side, setSide] = useState<"buy" | "sell" | "swap">(
    known?.graduatedHint && !scar ? "swap" : "buy"
  );
  const [amount, setAmount] = useState("0.1");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!publicClient || !marketAddr) return;
    let cancelled = false;
    void publicClient
      .readContract({
        address: marketAddr,
        abi: marketAbi,
        functionName: "graduated",
      })
      .then((g) => {
        if (!cancelled) {
          setGraduated(g as boolean);
          if (g && !scar) setSide("swap");
          if (!g) setSide("buy");
        }
      })
      .catch(() => {
        /* keep hint */
      });
    return () => {
      cancelled = true;
    };
  }, [publicClient, marketAddr, scar]);

  // lazy ensure pfp
  useEffect(() => {
    void fetch(`/api/pfp/${encodeURIComponent(ticker)}?ensure=1`);
  }, [ticker]);

  const { data: price } = useReadContract({
    address: marketAddr,
    abi: marketAbi,
    functionName: "price",
    query: { enabled: !!marketAddr },
  });

  const { data: tokenBal } = useReadContract({
    address: known?.token,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!known?.token && !!address },
  });

  const buyEnabled = graduated === false && !scar;
  const sellEnabled = graduated === false && !scar;
  // T589 scar: no swap even if graduated
  const swapEnabled = graduated === true && !scar;

  useEffect(() => {
    if (side === "buy" && !buyEnabled && sellEnabled) setSide("sell");
    if (side === "buy" && !buyEnabled && swapEnabled) setSide("swap");
    if (side === "swap" && !swapEnabled && buyEnabled) setSide("buy");
    if (side === "sell" && !sellEnabled && swapEnabled) setSide("swap");
  }, [side, buyEnabled, sellEnabled, swapEnabled]);

  const applyPct = (p: number) => {
    if (side === "sell" || (side === "swap" && amount)) {
      if (tokenBal != null) {
        const full = Number(formatEther(tokenBal as bigint));
        setAmount(String(+(full * (p / 100)).toPrecision(6)));
        return;
      }
    }
    // XRP presets map roughly
    const map: Record<number, string> = {
      25: "0.05",
      50: "0.1",
      75: "0.5",
      100: "1",
    };
    setAmount(map[p] || "0.1");
  };

  const mintSession = useCallback(async () => {
    setErr(null);
    if (!known || !factoryAddr || !marketAddr) {
      setErr("This market isn't listed here. Open Trade and load it by symbol.");
      return;
    }
    if (!isConnected) {
      setErr("Connect your wallet first.");
      return;
    }
    if (!onCorrectChain) {
      setErr("Switch your wallet to XRPL EVM.");
      return;
    }
    if (side === "swap" && !swapEnabled) {
      setErr(scar ? "Swaps are not available for this legacy pool." : "Swap opens after graduation.");
      return;
    }
    if ((side === "buy" || side === "sell") && graduated === true) {
      setErr("This market graduated. Use Swap.");
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        action: side,
        chainId: XRPL_EVM_TESTNET_ID,
        factory: factoryAddr,
        market: marketAddr,
        token: known.token,
        amount,
        minOut: "0",
      };
      if (side === "swap") {
        body.dex = TEST_DEX_V2_ADDRESS;
        body.swapSide = "xrpToToken";
      }
      const res = await fetch("/api/s", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "session mint failed");
      router.push(`/s/${encodeURIComponent(data.id)}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [
    known,
    factoryAddr,
    marketAddr,
    isConnected,
    onCorrectChain,
    side,
    swapEnabled,
    scar,
    graduated,
    amount,
    router,
  ]);

  const priceLabel = useMemo(() => {
    if (price === undefined) return "—";
    try {
      return `${Number(formatEther(price as bigint)).toPrecision(4)} XRP`;
    } catch {
      return "—";
    }
  }, [price]);

  const ctaLabel = !isConnected
    ? "Connect wallet to sign here"
    : !onCorrectChain
      ? "Switch to XRPL EVM"
      : busy
        ? "Opening signing session…"
        : side === "buy"
          ? `Buy with ${amount} XRP`
          : side === "sell"
            ? `Sell ${amount} $${ticker}`
            : `Swap ${amount} XRP`;

  const knownOnX = resolveKnown(ticker);
  const statusLabel = scar
    ? "Graduated · legacy pool"
    : graduated === true
      ? "Graduated"
      : graduated === false
        ? "On curve"
        : "";

  return (
    <AppChrome active="trade">
      <main className="g-main" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
        <Link href="/" className="g-back">← Markets</Link>
        <div className="flex items-center gap-4">
          <TokenPfp ticker={ticker} size="md" />
          <div>
            <div className="g-sub">{known?.name || "Market"}</div>
            <h1 className="g-display" style={{ fontSize: 32 }}>
              ${ticker}
            </h1>
            {statusLabel && (
              <div className="g-sub" style={{ marginTop: 4 }}>
                <span className={`g-dot${graduated === true ? " grad" : " live"}`} />
                {statusLabel}
              </div>
            )}
          </div>
        </div>

        <div className="g-display" style={{ marginTop: 20, fontSize: 34 }}>
          {priceLabel}
        </div>
        <div className="g-sub">per token</div>

        <MarketChart
          ticker={ticker}
          priceXrp={
            price !== undefined
              ? Number(formatEther(price as bigint))
              : null
          }
        />

        {!known && (
          <div className="g-alert warn" style={{ marginTop: 16 }}>
            This ticker isn&apos;t listed here.{" "}
            <Link href={`/?tab=Trade&q=${encodeURIComponent(ticker)}`} className="link-x">
              Open Trade
            </Link>{" "}
            to load it by symbol or address.
          </div>
        )}

        {knownOnX && !scar && (
          <>
            <XTradeCta side={side === "sell" ? "sell" : "buy"} ticker={knownOnX.symbol} amount={amount} />
            <div className="g-or">or sign here</div>
          </>
        )}

        <div className="g-seg" role="tablist" aria-label="Trade side">
          <button
            type="button"
            className={side === "buy" ? "on" : undefined}
            disabled={!buyEnabled}
            title={!buyEnabled ? (graduated ? "Graduated — use Swap" : "Unavailable") : "Buy on the curve"}
            onClick={() => setSide("buy")}
          >
            Buy
          </button>
          <button
            type="button"
            className={side === "sell" ? "on" : undefined}
            disabled={!sellEnabled}
            title={!sellEnabled ? (graduated ? "Graduated — use Swap" : "Unavailable") : "Sell on the curve"}
            onClick={() => setSide("sell")}
          >
            Sell
          </button>
          <button
            type="button"
            className={side === "swap" ? "on" : undefined}
            disabled={!swapEnabled}
            title={
              scar
                ? "Legacy pool — swaps unavailable"
                : !swapEnabled
                  ? "Available after graduation"
                  : "Swap on the DEX"
            }
            onClick={() => setSide("swap")}
          >
            Swap
          </button>
        </div>

        {scar && (
          <div className="g-alert" style={{ marginTop: 8 }}>
            This market graduated to a legacy pool. Trading is not available here.
          </div>
        )}

        <div className="g-field" style={{ marginTop: 12 }}>
          <label>{side === "sell" ? "You sell" : "You pay"}</label>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="0.1"
          />
          <div className="g-pct">
            {PRESETS.map((v) => (
              <button key={v} type="button" onClick={() => setAmount(v)}>
                {v}
              </button>
            ))}
          </div>
          <div className="g-pct" style={{ marginTop: 8 }}>
            {PCT.map((p) => (
              <button key={p} type="button" onClick={() => applyPct(p)}>
                {p}%
              </button>
            ))}
          </div>
        </div>

        {err && (
          <div className="g-alert bad" style={{ marginTop: 12 }}>
            {err}
          </div>
        )}

        <button
          type="button"
          className="g-cta"
          disabled={busy || !known || (side === "swap" ? !swapEnabled : !buyEnabled && !sellEnabled) || (side === "buy" && !buyEnabled) || (side === "sell" && !sellEnabled)}
          onClick={() => void mintSession()}
        >
          {ctaLabel}
        </button>
        <p className="g-hint">
          Opens a signing session. You sign in your wallet; GRAAV never holds your key.
        </p>

        {known && (
          <div className="g-card" style={{ marginTop: 20 }}>
            <div className="g-kv">
              <span>Market</span>
              <a className="g-mono link-x" href={`${EXPLORER_URL}/address/${known.market}`} target="_blank" rel="noreferrer">
                {shortAddr(known.market)}
              </a>
            </div>
            <div className="g-kv">
              <span>Token</span>
              <a className="g-mono link-x" href={`${EXPLORER_URL}/address/${known.token}`} target="_blank" rel="noreferrer">
                {shortAddr(known.token)}
              </a>
            </div>
            <div className="g-kv">
              <span>Factory</span>
              <span className="g-mono">{shortAddr(known.factory)}</span>
            </div>
          </div>
        )}

        <p className="g-micro" style={{ marginTop: 24, textAlign: "center" }}>
          <Link href="/launch" style={{ color: "var(--muted)" }}>
            Launch a coin
          </Link>
          {" · "}
          <Link href="/" style={{ color: "var(--muted)" }}>
            Markets
          </Link>
        </p>
      </main>
    </AppChrome>
  );
}
