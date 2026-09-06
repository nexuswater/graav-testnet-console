/**
 * Dual-factory allowlist for signing sessions (S).
 * SoT: S_SESSION_BIND_ABI.md · docs/TESTNET_REGISTRY.md · chain.ts
 * Do not collapse M2 / M2.2.
 */
import type { Address } from "viem";
import {
  FACTORY_ADDRESS,
  M22_FACTORY_ADDRESS,
  TEST_DEX_V1_ADDRESS,
  TEST_DEX_V2_ADDRESS,
  GSWAP_MARKET_ADDRESS,
  GSWAP_TOKEN_ADDRESS,
  G589_MARKET_ADDRESS,
  G589_TOKEN_ADDRESS,
  T589_MARKET_ADDRESS,
  MEME_TESTNET_MARKETS,
  XRPL_EVM_TESTNET_ID,
} from "@/lib/chain";

/** Coin V1 / mRLUSD testnet clone registry (chain 1449000). */
export const RLUSD_CLONE_FACTORY_ADDRESS = "0x2E393cfabeC866a38632b8C486B942089644dE93";
export const RLUSD_CLONE_CURVE_ADDRESS = "0x376D4e428E25A403A3fA5cC122D1910f97B2B712";
export const RLUSD_CLONE_COIN_ADDRESS = "0xe6A44F18A8375A3a1F3d01904C6e3001D7958A8e";

export const SESSION_CHAIN_ID = XRPL_EVM_TESTNET_ID;

export const ALLOWED_FACTORIES = [
  FACTORY_ADDRESS,
  M22_FACTORY_ADDRESS,
  RLUSD_CLONE_FACTORY_ADDRESS,
] as const;

/** V2 is the only swap target; V1 is allowlisted for scar detection only. */
export const ALLOWED_DEXES = [
  TEST_DEX_V2_ADDRESS,
  TEST_DEX_V1_ADDRESS,
] as const;

/**
 * Registry markets (optional field).
 * gSWAP → M2.2; g589 + meme g* → M2 (pre-grad curve); T589 scar stays M2-only.
 */
export const ALLOWED_MARKETS = [
  RLUSD_CLONE_CURVE_ADDRESS,
  GSWAP_MARKET_ADDRESS,
  G589_MARKET_ADDRESS,
  T589_MARKET_ADDRESS,
  ...MEME_TESTNET_MARKETS.map((m) => m.market),
] as const;

export const ALLOWED_TOKENS = [
  RLUSD_CLONE_COIN_ADDRESS,
  GSWAP_TOKEN_ADDRESS,
  G589_TOKEN_ADDRESS,
  ...MEME_TESTNET_MARKETS.map((m) => m.token),
] as const;

export type SessionAction = "buy" | "sell" | "swap" | "create";

export function normAddr(a: string): string {
  return a.trim().toLowerCase();
}

export function isAllowedFactory(addr: string): boolean {
  const n = normAddr(addr);
  return ALLOWED_FACTORIES.some((f) => normAddr(f) === n);
}

export function isAllowedDex(addr: string): boolean {
  const n = normAddr(addr);
  return ALLOWED_DEXES.some((d) => normAddr(d) === n);
}

export function isAllowedMarket(addr: string): boolean {
  const n = normAddr(addr);
  return ALLOWED_MARKETS.some((m) => normAddr(m) === n);
}

export function isM22Factory(addr: string): boolean {
  return normAddr(addr) === normAddr(M22_FACTORY_ADDRESS);
}

export function isM2Factory(addr: string): boolean {
  return normAddr(addr) === normAddr(FACTORY_ADDRESS);
}

export function isGswapMarket(addr: string): boolean {
  return normAddr(addr) === normAddr(GSWAP_MARKET_ADDRESS);
}

export function isRlusdCloneFactory(addr: string): boolean {
  return normAddr(addr) === normAddr(RLUSD_CLONE_FACTORY_ADDRESS);
}

export function isRlusdCloneMarket(addr: string): boolean {
  return normAddr(addr) === normAddr(RLUSD_CLONE_CURVE_ADDRESS);
}

export function isT589Market(addr: string): boolean {
  return normAddr(addr) === normAddr(T589_MARKET_ADDRESS);
}

export function isG589Market(addr: string): boolean {
  return normAddr(addr) === normAddr(G589_MARKET_ADDRESS);
}

export function isMemeMarket(addr: string): boolean {
  const n = normAddr(addr);
  return MEME_TESTNET_MARKETS.some((m) => normAddr(m.market) === n);
}

export function isV1Dex(addr: string): boolean {
  return normAddr(addr) === normAddr(TEST_DEX_V1_ADDRESS);
}

export function isV2Dex(addr: string): boolean {
  return normAddr(addr) === normAddr(TEST_DEX_V2_ADDRESS);
}

export function factoryShortLabel(factory: string): string {
  if (isM22Factory(factory)) return "M2.2";
  if (isM2Factory(factory)) return "M2";
  return "unknown";
}

export type AllowlistCheckInput = {
  chainId: number;
  factory: string;
  market?: string | null;
  dex?: string | null;
  action: SessionAction;
};

/**
 * Fail-closed allowlist + dual-factory binding (S_SESSION_BIND_ABI).
 * Returns null if OK, else a human error string.
 */
export function validateAllowlist(input: AllowlistCheckInput): string | null {
  if (input.chainId !== SESSION_CHAIN_ID) {
    return `chainId must be ${SESSION_CHAIN_ID} (got ${input.chainId})`;
  }
  if (!input.factory || !isAllowedFactory(input.factory)) {
    return "factory not on allowlist (M2, M2.2, or RLUSD clone)";
  }
  if (input.market) {
    if (!isAllowedMarket(input.market)) {
      return "market not on allowlist";
    }
    // gSWAP → must bind M2.2 factory (reject gSWAP on M2)
    if (isGswapMarket(input.market) && !isM22Factory(input.factory)) {
      return "gSWAP market must bind M2.2 factory (dual-factory rule)";
    }
    // Coin V1 / mRLUSD curve must bind its own clone factory, never X1/M22.
    if (isRlusdCloneMarket(input.market) && !isRlusdCloneFactory(input.factory)) {
      return "RLUSD Coin market must bind the testnet clone factory";
    }
    // g589 / T589 scar / meme g* → M2 factory (g589 is curve like meme, not gSWAP)
    if (
      (isG589Market(input.market) ||
        isT589Market(input.market) ||
        isMemeMarket(input.market)) &&
      !isM2Factory(input.factory)
    ) {
      return "g589/T589/meme markets must bind M2 factory (dual-factory rule)";
    }
  }
  if (input.dex) {
    if (!isAllowedDex(input.dex)) {
      return "dex not on allowlist (TestDex V2 or V1 scar only)";
    }
    // V1 never swap
    if (input.action === "swap" && isV1Dex(input.dex)) {
      return "swap rejected: TestDex V1 is scar-only (never swap)";
    }
    if (input.action === "swap" && !isV2Dex(input.dex)) {
      return "swap requires TestDex V2 only";
    }
  }
  if (input.action === "swap" && !input.market) {
    return "swap requires market";
  }
  if (
    (input.action === "buy" || input.action === "sell") &&
    !input.market
  ) {
    return `${input.action} requires market`;
  }
  return null;
}

/** Swap calldata always targets V2 — never V1. */
export function swapDexAddress(dex?: string | null): Address {
  if (dex && isV2Dex(dex)) return dex as Address;
  return TEST_DEX_V2_ADDRESS;
}
