"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useReadContract,
} from "wagmi";
import type { Address } from "viem";
import { formatTokenAmount } from "@/lib/formatNumber";
import { RLUSD_V1 } from "@/lib/rlusd-v1/config";
import { rlusdErc20Abi } from "@/lib/rlusd-v1/contracts";
import {
  FACTORY_ADDRESS,
  FAUCET_URL,
  XRPL_EVM_TESTNET_ID,
  factoryAbi,
  marketAbi,
  erc20Abi,
  ZERO_ADDRESS,
  type MarketInfo,
} from "@/lib/chain";
import { shortAddr } from "@/lib/wallet";
import { useWalletActions } from "@/lib/useWalletActions";
import { XMark } from "@/components/XMark";
import { portfolioCommandText, xDmUrl, xPostIntentUrl } from "@/lib/xLaunchComposer";

type Holding = {
  marketId: bigint;
  symbol: string;
  name: string;
  token: Address;
  market: Address;
  balance: bigint | null;
  graduated: boolean;
};

type Props = {
  setStatusMsg: (m: string | null) => void;
};

export function PortfolioTab({ setStatusMsg }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: XRPL_EVM_TESTNET_ID });
  const { connect, switchToXrplEvm, trackToken, walletConnectConnector, isConnecting } = useWalletActions();
  const onCorrectChain = chainId === XRPL_EVM_TESTNET_ID;

  const {
    data: nativeBal,
    refetch: refetchNative,
    isFetching: nativeFetching,
  } = useBalance({
    address,
    chainId: XRPL_EVM_TESTNET_ID,
    query: { enabled: !!address },
  });

  // Quote balance from the pinned RLUSD token (displayed as RLUSD; the on-chain symbol is not used).
  const quoteAddress = RLUSD_V1.quoteAddress as Address;
  const {
    data: rlusdBal,
    isFetching: rlusdFetching,
    isError: rlusdError,
    refetch: refetchRlusd,
  } = useReadContract({
    address: quoteAddress,
    abi: rlusdErc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: XRPL_EVM_TESTNET_ID,
    query: { enabled: !!address },
  });

  const [markets, setMarkets] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketCount, setMarketCount] = useState<bigint | null>(null);

  const refresh = useCallback(async () => {
    if (!publicClient) {
      setMarkets([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const count = (await publicClient.readContract({
        address: FACTORY_ADDRESS,
        abi: factoryAbi,
        functionName: "marketCount",
      })) as bigint;
      setMarketCount(count);

      const next: Holding[] = [];
      for (let i = 1n; i <= count; i++) {
        let info: MarketInfo;
        try {
          info = (await publicClient.readContract({
            address: FACTORY_ADDRESS,
            abi: factoryAbi,
            functionName: "getMarket",
            args: [i],
          })) as MarketInfo;
        } catch {
          continue;
        }
        if (!info?.token || info.token === ZERO_ADDRESS) continue;

        let bal: bigint | null = null;
        if (address) {
          try {
            bal = (await publicClient.readContract({
              address: info.token,
              abi: erc20Abi,
              functionName: "balanceOf",
              args: [address],
            })) as bigint;
          } catch {
            bal = null;
          }
        }

        let symbol = `M${i}`;
        let name = symbol;
        try {
          symbol = (await publicClient.readContract({
            address: info.token,
            abi: erc20Abi,
            functionName: "symbol",
          })) as string;
        } catch {
          /* keep fallback */
        }
        try {
          name = (await publicClient.readContract({
            address: info.token,
            abi: erc20Abi,
            functionName: "name",
          })) as string;
        } catch {
          /* keep fallback */
        }

        let graduated = info.graduated;
        if (info.market && info.market !== ZERO_ADDRESS) {
          try {
            graduated = (await publicClient.readContract({
              address: info.market,
              abi: marketAbi,
              functionName: "graduated",
            })) as boolean;
          } catch {
            /* keep factory flag */
          }
        }

        next.push({
          marketId: i,
          symbol,
          name,
          token: info.token,
          market: info.market,
          balance: bal,
          graduated,
        });
      }
      setMarkets(next);
      void refetchNative();
      void refetchRlusd();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [address, publicClient, refetchNative, refetchRlusd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connectWallet = async () => {
    const res = await connect();
    if (!res.ok) setStatusMsg(res.error ?? "Could not connect a wallet.");
  };

  const addNetwork = async () => {
    const res = await switchToXrplEvm();
    if (!res.ok) setStatusMsg(res.error ?? "Could not switch network.");
    else setStatusMsg("XRPL EVM is set in your wallet.");
  };

  const addToken = async (h: Holding) => {
    const res = await trackToken({ address: h.token, symbol: h.symbol, decimals: 18 });
    if (!res.ok) setStatusMsg(res.error ?? "Your wallet declined to track this token.");
    else setStatusMsg(`Asked your wallet to track ${h.symbol} (${shortAddr(h.token)}).`);
  };

  const trackRlusd = async () => {
    const res = await trackToken({ address: quoteAddress, symbol: RLUSD_V1.quoteSymbol, decimals: RLUSD_V1.quoteDecimals });
    if (!res.ok) setStatusMsg(res.error ?? "Your wallet declined to track RLUSD.");
    else setStatusMsg(`Asked your wallet to track RLUSD (${shortAddr(quoteAddress)}).`);
  };

  const withBalance = markets.filter((m) => m.balance !== null && m.balance > BigInt(0));
  const unknownBalances = address ? markets.filter((m) => m.balance === null) : [];
  const zeroXrp = !!address && !!nativeBal && nativeBal.value === BigInt(0);

  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="g-title">Portfolio</h1>
            <p className="g-sub" style={{ marginTop: 8 }}>
              {address
                ? `Holdings for ${shortAddr(address)} on XRPL EVM.`
                : "Connect a wallet to see your XRP and coin balances."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="g-btn sm"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </section>

      {isConnected && !onCorrectChain && (
        <div className="g-alert warn">
          Your wallet is on another network. Balances shown are for XRPL EVM.{" "}
          <button type="button" className="link-x" style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontWeight: 650 }} onClick={() => void addNetwork()}>
            Switch network
          </button>
        </div>
      )}

      <div className="g-sheet" style={{ marginTop: 0 }}>
        <div className="g-kv inline">
          <span>XRP</span>
          <span>
            {!address
              ? "—"
              : nativeBal
                ? `${formatTokenAmount(nativeBal.value)} XRP`
                : nativeFetching
                  ? "…"
                  : "—"}
          </span>
        </div>
        <div className="g-kv inline">
          <span>RLUSD</span>
          <span>
            {!address
              ? "—"
              : rlusdBal !== undefined
                ? `${formatTokenAmount(rlusdBal as bigint)} RLUSD`
                : rlusdFetching
                  ? "…"
                  : rlusdError
                    ? "Unknown"
                    : "—"}
          </span>
        </div>
        <div className="g-kv inline">
          <span>Coins held</span>
          <span>{address ? String(withBalance.length) : "—"}</span>
        </div>
        <div className="g-kv inline">
          <span>Markets</span>
          <span>{marketCount !== null ? String(marketCount) : "…"}</span>
        </div>
        {zeroXrp && (
          <p className="g-hint">
            You need XRP for gas.{" "}
            <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="link-x" style={{ fontWeight: 650 }}>
              Open faucet →
            </a>
          </p>
        )}
        {address && (
          <p className="g-hint">
            RLUSD is the quote for new coins.{" "}
            <button
              type="button"
              className="link-x"
              style={{ background: "none", border: 0, padding: 0, cursor: "pointer", fontWeight: 650 }}
              onClick={() => void trackRlusd()}
            >
              Track RLUSD in your wallet
            </button>
          </p>
        )}
      </div>

      {error && <div className="g-alert bad">{error}</div>}

      <section>
        {unknownBalances.length > 0 && (
          <div className="g-alert warn" style={{ marginBottom: 12 }}>
            {unknownBalances.length} balance{unknownBalances.length === 1 ? "" : "s"} could not be read and{" "}
            {unknownBalances.length === 1 ? "is" : "are"} not shown as zero.
          </div>
        )}
        <h2 className="g-sub" style={{ marginBottom: 8 }}>
          Holdings
        </h2>
        {loading && markets.length === 0 ? (
          <p className="g-sub">Scanning markets…</p>
        ) : !address ? (
          <div className="empty g-sub" style={{ padding: "32px 8px", display: "grid", gap: 12, justifyItems: "start" }}>
            <span>Connect a wallet to see your holdings.</span>
            {walletConnectConnector ? (
              <button type="button" className="g-cta" style={{ width: "auto", marginTop: 0 }} disabled={isConnecting} onClick={() => void connectWallet()}>
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            ) : (
              <span className="g-hint" style={{ marginTop: 0 }}>Wallet connection isn&apos;t available on this deployment yet.</span>
            )}
          </div>
        ) : markets.length === 0 ? (
          <div className="empty g-sub" style={{ padding: "40px 8px" }}>
            No markets found yet.
          </div>
        ) : withBalance.length === 0 ? (
          <div className="empty g-sub" style={{ padding: "40px 8px" }}>
            No coins held yet. Buy from a post or DM on X, or open{" "}
            <Link href="/?tab=Trade" className="link-x">Trade</Link>.
          </div>
        ) : (
          <div style={{ borderTop: "1px solid var(--line)" }}>
            {withBalance.map((h) => (
              <div
                key={`${h.marketId}-${h.token}`}
                className="g-mkt"
                style={{ gridTemplateColumns: "1fr auto", gap: 12 }}
              >
                <Link
                  href={`/t/${encodeURIComponent(h.symbol)}`}
                  style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}
                >
                  <div className="g-tick">
                    {h.symbol}
                    <span className="g-sub" style={{ marginLeft: 8 }}>
                      <span className={`g-dot${h.graduated ? " grad" : " live"}`} />
                      {h.graduated ? "Graduated" : "On curve"}
                    </span>
                  </div>
                  <div className="g-sub">
                    {h.balance === null ? "Balance unknown" : `${formatTokenAmount(h.balance)} ${h.symbol}`}
                    {" · "}
                    {h.name}
                  </div>
                </Link>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <Link
                    href={`/t/${encodeURIComponent(h.symbol)}`}
                    className="g-btn sm"
                    style={{
                      background: "var(--cta-bg)",
                      color: "var(--cta-fg)",
                      border: 0,
                      fontWeight: 650,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    Open
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void addToken(h);
                    }}
                    className="g-btn sm"
                    title="Track this token in your wallet"
                  >
                    Track
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="g-card text-sm">
        <div style={{ fontWeight: 650 }}>Check from X</div>
        <p className="g-hint" style={{ marginTop: 4 }}>
          <code>{portfolioCommandText()}</code> — post it or send it as a DM and GRAAV replies with your holdings.
        </p>
        <div className="g-x-cta">
          <a className="g-cta ghost" href={xPostIntentUrl(portfolioCommandText())} target="_blank" rel="noopener noreferrer">
            <XMark size={14} /> Post
          </a>
          <a className="g-cta ghost" href={xDmUrl(portfolioCommandText())} target="_blank" rel="noopener noreferrer">
            <XMark size={14} /> DM
          </a>
        </div>
      </section>
    </div>
  );
}
