"use client";
import { useAccount, useConnect } from "wagmi";
import { getInjectedEth, ensureXrplEvmTestnet } from "@/lib/wallet";
import { getClientXAuthHint } from "@/lib/xAuth";
import type { WalletProps } from "./wallet";

/** Bridge the X1 panels to the console's existing wagmi/injected wallet and OAuth session. */
export function useConsoleBridge(): WalletProps & { onXLogin(): void } {
  const { address } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const hint = getClientXAuthHint();
  return {
    connectedWallet: address ?? null,
    getProvider: getInjectedEth,
    async onConnect() {
      const eth = getInjectedEth();
      if (!eth) throw new Error("Linking needs a browser wallet such as MetaMask. WalletConnect signing for the identity link is not wired yet.");
      await eth.request({ method: "eth_requestAccounts" });
      const connector = connectors.find((c) => c.id === "io.metamask") ?? connectors.find((c) => c.id === "injected") ?? connectors[0];
      if (connector) await connectAsync({ connector });
      const chain = await ensureXrplEvmTestnet();
      if (!chain.ok) throw new Error(chain.error ?? "Switch your wallet to XRPL EVM.");
    },
    onXLogin() {
      if (!hint.configured) throw new Error(hint.message);
      window.location.assign("/api/auth/x");
    },
  };
}
