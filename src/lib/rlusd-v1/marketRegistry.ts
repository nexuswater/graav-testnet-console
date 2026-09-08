import { RLUSD_V1 as C } from "./config";

export type RlusdMarketStatus = "fixture" | "not-wired";

export type RlusdMarket = {
  id: string;
  symbol: string;
  name: string;
  sourcePostId: string;
  description: string;
  status: RlusdMarketStatus;
  factoryAddress: string | null;
  marketAddress: string | null;
  coinAddress: string | null;
};

/** RLUSD Coin V1 registry; the new clone awaits its first signed Moment market. */
export const RLUSD_MARKET_REGISTRY: readonly RlusdMarket[] = [
  {
    id: "demo-moment-2026",
    symbol: "MOMENT",
    name: "Demo Moment",
    sourcePostId: "demo-moment-2026",
    description: "Moment awaiting the first signed market bind on the new clone",
    status: "not-wired",
    factoryAddress: C.factoryAddress,
    marketAddress: C.curveAddress,
    coinAddress: C.coinAddress,
  },
  {
    id: "demo-orbit-2026",
    symbol: "ORBIT",
    name: "Orbit",
    sourcePostId: "demo-orbit-2026",
    description: "Registry fixture awaiting a verified market bind",
    status: "not-wired",
    factoryAddress: null,
    marketAddress: null,
    coinAddress: null,
  },
  {
    id: "demo-signal-2026",
    symbol: "SIGNAL",
    name: "Signal",
    sourcePostId: "demo-signal-2026",
    description: "Registry fixture awaiting a verified market bind",
    status: "not-wired",
    factoryAddress: null,
    marketAddress: null,
    coinAddress: null,
  },
];

export function getRlusdMarket(sourcePostId: string) {
  return RLUSD_MARKET_REGISTRY.find((market) => market.sourcePostId === sourcePostId) ?? null;
}
