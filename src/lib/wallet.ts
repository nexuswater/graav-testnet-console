"use client";

import { XRPL_EVM_TESTNET_ID, xrplEvmTestnet } from "./chain";

export type InjectedEth = {
  request: (args: {
    method: string;
    params?: unknown;
  }) => Promise<unknown>;
  isMetaMask?: boolean;
  providers?: InjectedEth[];
};

export function getInjectedEth(): InjectedEth | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { ethereum?: InjectedEth };
  const eth = w.ethereum;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length) {
    return eth.providers.find((p) => p.isMetaMask) || eth.providers[0];
  }
  return eth;
}

/** Poll until window.ethereum appears (MetaMask mobile in-app browser injects briefly after load). */
export async function waitForInjectedEth(
  timeoutMs = 3000
): Promise<InjectedEth | null> {
  const existing = getInjectedEth();
  if (existing) return existing;
  if (typeof window === "undefined") return null;

  const start = Date.now();
  const intervalMs = 100;
  return new Promise((resolve) => {
    const tick = () => {
      const eth = getInjectedEth();
      if (eth) {
        resolve(eth);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        resolve(null);
        return;
      }
      setTimeout(tick, intervalMs);
    };
    setTimeout(tick, intervalMs);
  });
}

export function shortAddr(a?: string) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Add / switch to XRPL EVM Testnet via injected wallet. Never throws — always returns {ok,error}. */
export async function ensureXrplEvmTestnet(): Promise<{
  ok: boolean;
  error?: string;
}> {
  try {
    const eth = getInjectedEth();
    if (!eth) {
      return { ok: false, error: "No injected wallet found. Install MetaMask." };
    }
    const hexId = "0x" + XRPL_EVM_TESTNET_ID.toString(16);
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hexId }],
      });
      return { ok: true };
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4902 || code === -32603) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: hexId,
                chainName: xrplEvmTestnet.name,
                nativeCurrency: xrplEvmTestnet.nativeCurrency,
                rpcUrls: [xrplEvmTestnet.rpcUrls.default.http[0]],
                blockExplorerUrls: [xrplEvmTestnet.blockExplorers.default.url],
              },
            ],
          });
          return { ok: true };
        } catch (addErr) {
          return { ok: false, error: `Add chain failed: ${String(addErr)}` };
        }
      }
      return { ok: false, error: `Switch chain failed: ${String(err)}` };
    }
  } catch (outer: unknown) {
    return {
      ok: false,
      error: `Chain ensure failed: ${outer instanceof Error ? outer.message : String(outer)}`,
    };
  }
}

export async function watchTokenAsset(params: {
  address: string;
  symbol: string;
  decimals?: number;
  image?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const eth = getInjectedEth();
  if (!eth) {
    return { ok: false, error: "No injected wallet found." };
  }
  try {
    await eth.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: {
          address: params.address,
          symbol: params.symbol.slice(0, 11),
          decimals: params.decimals ?? 18,
          image: params.image,
        },
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
