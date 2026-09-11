"use client";

import { useCallback } from "react";
import type { Address } from "viem";
import { useConnect, useSwitchChain, useWatchAsset } from "wagmi";
import { XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import { ensureXrplEvmTestnet, watchTokenAsset } from "@/lib/wallet";

export type WalletActionResult = { ok: boolean; error?: string };

export const WALLET_UNAVAILABLE_MSG = "Wallet connection isn't available on this deployment yet.";

function errText(err: unknown): string {
  if (err instanceof Error) {
    const short = (err as { shortMessage?: string }).shortMessage;
    return short || err.message;
  }
  return String(err);
}

/**
 * Wallet actions that go through the connected wagmi connector first
 * (so WalletConnect users are never told to install a browser wallet), with the
 * injected-provider path as the fallback. Every call resolves to {ok,error};
 * nothing here signs a transaction.
 */
export function useWalletActions() {
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { watchAssetAsync } = useWatchAsset();

  const walletConnectConnector = connectors.find(
    (c) => c.id === "walletConnect" || c.name.toLowerCase().includes("walletconnect"),
  );

  const connect = useCallback(async (): Promise<WalletActionResult> => {
    if (!walletConnectConnector) return { ok: false, error: WALLET_UNAVAILABLE_MSG };
    try {
      await connectAsync({ connector: walletConnectConnector });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: `WalletConnect failed: ${errText(err)}` };
    }
  }, [connectAsync, walletConnectConnector]);

  const switchToXrplEvm = useCallback(async (): Promise<WalletActionResult> => {
    try {
      await switchChainAsync({ chainId: XRPL_EVM_TESTNET_ID });
      return { ok: true };
    } catch {
      /* the wallet may not know the chain yet — try the injected add-chain path */
    }
    return ensureXrplEvmTestnet();
  }, [switchChainAsync]);

  const trackToken = useCallback(
    async (params: { address: Address | string; symbol: string; decimals?: number; image?: string }): Promise<WalletActionResult> => {
      try {
        const ok = await watchAssetAsync({
          type: "ERC20",
          options: {
            address: params.address,
            symbol: params.symbol.slice(0, 11),
            decimals: params.decimals ?? 18,
            image: params.image,
          },
        });
        if (ok) return { ok: true };
      } catch {
        /* not connected, or the wallet does not support wallet_watchAsset — try injected */
      }
      return watchTokenAsset(params);
    },
    [watchAssetAsync],
  );

  return { walletConnectConnector, connect, switchToXrplEvm, trackToken, isConnecting, isSwitching };
}
