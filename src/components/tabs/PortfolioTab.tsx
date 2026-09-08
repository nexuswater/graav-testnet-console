"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
} from "wagmi";
import { formatEther, type Address } from "viem";
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
import {
  ensureXrplEvmTestnet,
  shortAddr,
  watchTokenAsset,
} from "@/lib/wallet";

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
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [address, publicClient, refetchNative]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addNetwork = async () => {
    const res = await ensureXrplEvmTestnet();
    if (!res.ok) setStatusMsg(res.error ?? "Add network failed");
    else setStatusMsg("XRPL EVM Testnet added / switched in wallet.");
  };

  const addToken = async (h: Holding) => {
    const res = await watchTokenAsset({
      address: h.token,
      symbol: h.symbol,
      decimals: 18,
    });
    if (!res.ok) setStatusMsg(res.error ?? "watchAsset failed");
    else
      setStatusMsg(
        `Asked wallet to watch ${h.symbol} (${shortAddr(h.token)}).`
      );
  };

  const withBalance = markets.filter((m) => m.balance !== null && m.balance > BigInt(0));
  const unknownBalances = markets.filter((m) => m.balance === null);

  return (
    <div className="space-y-5">
      <section>
        <h1 className="g-title">Wallet</h1>
        <p className="g-sub" style={{ marginTop: 8 }}>
          Balances on chain {XRPL_EVM_TESTNET_ID}. Empty state is a sentence +
          faucet.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => void addNetwork()} className="g-btn sm">
            Add XRPL EVM Testnet
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="g-btn sm"
            style={{
              background: "var(--x)",
              color: "#fff",
              border: 0,
              fontWeight: 650,
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>

      {!isConnected && (
        <div className="g-alert">
          Connect wallet to load native XRP and token balances. Markets still
          enumerate from Factory.
        </div>
      )}

      {isConnected && !onCorrectChain && (
        <div className="g-alert warn">
          Wallet chainId is {chainId}. Portfolio still reads XRPL EVM Testnet (
          {XRPL_EVM_TESTNET_ID}) via RPC.
        </div>
      )}

      <div className="g-sheet" style={{ marginTop: 0 }}>
        <div className="g-kv">
          <span>Native XRP</span>
          <span>
            {!address
              ? "—"
              : nativeBal
                ? `${formatEther(nativeBal.value)} XRP`
                : nativeFetching
                  ? "…"
                  : "—"}
          </span>
        </div>
        <div className="g-kv">
          <span>Factory markets</span>
          <span>{marketCount !== null ? String(marketCount) : "…"}</span>
        </div>
        <div className="g-kv">
          <span>Holdings &gt; 0</span>
          <span>{String(withBalance.length)}</span>
        </div>
        {!address && (
          <p className="g-hint">
            Connect a wallet. Need testnet XRP?{" "}
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="link-x"
            >
              Open faucet
            </a>
          </p>
        )}
      </div>

      {address && nativeBal && nativeBal.value === BigInt(0) && (
        <div className="g-alert warn">
          Wallet has 0 testnet XRP.{" "}
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            className="link-x"
            style={{ fontWeight: 650 }}
          >
            Open faucet →
          </a>
        </div>
      )}
      {error && <div className="g-alert bad">{error}</div>}

      <section>
        {unknownBalances.length > 0 && (
          <div className="g-alert warn">
            {unknownBalances.length} holding {unknownBalances.length === 1 ? "read" : "reads"} unknown — not treated as zero.
          </div>
        )}
        <h2 className="g-sub" style={{ marginBottom: 8 }}>
          Open positions
        </h2>
        {loading && markets.length === 0 ? (
          <p className="g-sub">Scanning Factory markets…</p>
        ) : markets.length === 0 ? (
          <div className="empty g-sub" style={{ padding: "48px 8px" }}>
            No markets found on Factory. Need testnet XRP?{" "}
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="link-x"
            >
              Open faucet
            </a>
          </div>
        ) : withBalance.length === 0 ? (
          <div className="empty g-sub" style={{ padding: "48px 8px" }}>
            No open positions yet. Get testnet XRP from the{" "}
            <a
              href={FAUCET_URL}
              target="_blank"
              rel="noreferrer"
              className="link-x"
            >
              faucet
            </a>
            , then buy on Trade.
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
                    {h.graduated ? (
                      <span className="g-sub" style={{ marginLeft: 8 }}>
                        <span className="g-dot grad" />
                        graduated
                      </span>
                    ) : (
                      <span className="g-sub" style={{ marginLeft: 8 }}>
                        <span className="g-dot" />
                        on curve
                      </span>
                    )}
                  </div>
                  <div className="g-sub">
                    {shortAddr(h.token)}
                    {" · "}
                    {!address
                      ? "—"
                      : h.balance === null
                        ? "Unknown"
                        : formatEther(h.balance)}
                  </div>
                </Link>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <Link
                    href={`/t/${encodeURIComponent(h.symbol)}`}
                    className="g-btn sm"
                    style={{
                      background: "var(--x)",
                      color: "#fff",
                      border: 0,
                      fontWeight: 650,
                      textDecoration: "none",
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
                    title="Watch in MetaMask"
                  >
                    Watch
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
