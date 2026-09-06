"use client";

import { http, createConfig } from "wagmi";
import { injected } from "@wagmi/core";
import { xrplEvmTestnet, RPC_URL } from "./chain";

export const wagmiConfig = createConfig({
  chains: [xrplEvmTestnet],
  connectors: [
    injected({
      shimDisconnect: true,
    }),
  ],
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
