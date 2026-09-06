/**
 * Known testnet markets for /t/[ticker] + home rows.
 * Dual-factory: gSWAP → M2.2; g589/memes/T589 → M2.
 */
import type { Address } from "viem";
import {
  FACTORY_ADDRESS,
  M22_FACTORY_ADDRESS,
  GSWAP_MARKET_ADDRESS,
  GSWAP_TOKEN_ADDRESS,
  G589_MARKET_ADDRESS,
  G589_TOKEN_ADDRESS,
  T589_MARKET_ADDRESS,
  T589_TOKEN_ADDRESS,
  MEME_TESTNET_MARKETS,
  TEST_DEX_V2_ADDRESS,
} from "@/lib/chain";

export type KnownMarket = {
  ticker: string;
  name: string;
  market: Address;
  token: Address;
  factory: Address;
  /** graduated example (swap path) */
  graduatedHint?: boolean;
  /** T589 scar — never feature swap */
  scar?: boolean;
  tag?: string;
};

export const KNOWN_MARKETS: KnownMarket[] = [
  {
    ticker: "gSWAP",
    name: "GRAAV Swap",
    market: GSWAP_MARKET_ADDRESS,
    token: GSWAP_TOKEN_ADDRESS,
    factory: M22_FACTORY_ADDRESS,
    graduatedHint: true,
    tag: "Graduated · V2",
  },
  {
    ticker: "g589",
    name: "GRAAV 589",
    market: G589_MARKET_ADDRESS,
    token: G589_TOKEN_ADDRESS,
    factory: FACTORY_ADDRESS,
    graduatedHint: false,
    tag: "On curve · M2",
  },
  ...MEME_TESTNET_MARKETS.map((m) => ({
    ticker: m.symbol,
    name: m.name,
    market: m.market,
    token: m.token,
    factory: FACTORY_ADDRESS,
    graduatedHint: false,
    tag: "On curve · M2",
  })),
  {
    ticker: "T589",
    name: "T589 (scar)",
    market: T589_MARKET_ADDRESS,
    token: T589_TOKEN_ADDRESS,
    factory: FACTORY_ADDRESS,
    graduatedHint: true,
    scar: true,
    tag: "Scar · no swap",
  },
];

export function findKnownMarket(ticker: string): KnownMarket | undefined {
  const t = ticker.trim().replace(/^\$/, "");
  return KNOWN_MARKETS.find(
    (m) => m.ticker.toLowerCase() === t.toLowerCase()
  );
}

export function homeMarkets(): KnownMarket[] {
  // Design: 3–5 max; gSWAP + g589 featured; hide T589 from default list
  return KNOWN_MARKETS.filter((m) => !m.scar).slice(0, 5);
}

export const DEFAULT_DEX = TEST_DEX_V2_ADDRESS;
