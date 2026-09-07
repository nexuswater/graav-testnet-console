"use client";

import { http, createConfig } from "wagmi";
// Deep-import only walletConnect — barrel pulls @base-org/account → broken @x402/evm.
// @ts-expect-error deep entry avoids @wagmi/connectors barrel
import { walletConnect } from "../../node_modules/@wagmi/connectors/dist/esm/walletConnect.js";
import { xrplEvmTestnet, RPC_URL } from "./chain";

const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID?.trim();

const connectors = walletConnectProjectId
  ? [walletConnect({ projectId: walletConnectProjectId, showQrModal: true, metadata: { name: "GRAAV", description: "GRAAV XRPL EVM Testnet console", url: "https://graav.xyz", icons: ["https://graav.xyz/icon.png"] } })]
  : [];

export const wagmiConfig = createConfig({
  chains: [xrplEvmTestnet],
  connectors,
  transports: {
    [xrplEvmTestnet.id]: http(RPC_URL),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
