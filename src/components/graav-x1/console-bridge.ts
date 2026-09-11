"use client";
import type { Address, Hex, TypedDataDomain } from "viem";
import { useAccount, useConnect, useSignTypedData, useSwitchChain } from "wagmi";
import { XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import type { TypedData } from "@/lib/graav-x1/core/types";
import { WALLET_UNAVAILABLE_MSG } from "@/lib/useWalletActions";
import { ensureXrplEvmTestnet, getInjectedEth } from "@/lib/wallet";
import { getClientXAuthHint } from "@/lib/xAuth";
import type { WalletProps } from "./wallet";

/**
 * Bridge the X1 panels to the console's wagmi wallet (a discovered injected
 * wallet or WalletConnect) and the OAuth session. Signing and network switching
 * go through the connected connector, so WalletConnect users can link their
 * identity without a browser extension.
 */
export function useConsoleBridge(): WalletProps & { onXLogin(): void } {
  const { address } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();
  const hint = getClientXAuthHint();
  const injected = connectors.find((c) => c.id === "io.metamask") ?? connectors.find((c) => c.id === "injected");
  const walletConnect = connectors.find((c) => c.id === "walletConnect" || c.name.toLowerCase().includes("walletconnect"));

  async function switchToChain() {
    try {
      await switchChainAsync({ chainId: XRPL_EVM_TESTNET_ID });
      return;
    } catch {
      /* the wallet may not know the chain yet — try the injected add-chain path */
    }
    const res = await ensureXrplEvmTestnet();
    if (!res.ok) throw new Error(res.error ?? "Switch your wallet to XRPL EVM.");
  }

  return {
    connectedWallet: address ?? null,
    getProvider: getInjectedEth,
    async onConnect() {
      const connector = injected ?? walletConnect;
      if (!connector) throw new Error(WALLET_UNAVAILABLE_MSG);
      await connectAsync({ connector });
      await switchToChain();
    },
    async signTypedData(wallet, typedData: TypedData) {
      // viem derives EIP712Domain from `domain`; the wire copy carries it only for raw providers.
      const { EIP712Domain: _omit, ...types } = typedData.types as Record<string, unknown>;
      void _omit;
      // The typed data is shaped by the server at runtime, so the generic literal types cannot be inferred here.
      const variables = {
        account: wallet as Address,
        domain: typedData.domain as TypedDataDomain,
        types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      } as unknown as Parameters<typeof signTypedDataAsync>[0];
      return signTypedDataAsync(variables) as Promise<Hex>;
    },
    switchToChain,
    onXLogin() {
      if (!hint.configured) throw new Error(hint.message);
      window.location.assign("/api/auth/x");
    },
  };
}
