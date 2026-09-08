import { RLUSD_V1 as C } from "./config";
import type { RlusdMarket } from "./marketRegistry";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export type MarketLifecycle = "unconfigured" | "configured" | "loading" | "failed" | "tradable";

export type ConfiguredMarketIds = {
  factory: `0x${string}`;
  quote: `0x${string}`;
  coin: `0x${string}`;
  curve: `0x${string}`;
};

export type MarketAvailability =
  | { state: "unconfigured"; reason: string }
  | { state: "configured"; ids: ConfiguredMarketIds }
  | { state: "loading"; ids: ConfiguredMarketIds }
  | { state: "failed"; ids: ConfiguredMarketIds; reason: string }
  | { state: "tradable"; ids: ConfiguredMarketIds; graduated: boolean };

export function isConfiguredAddress(value: string | null | undefined): value is `0x${string}` {
  if (!value) return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) return false;
  return value.toLowerCase() !== ZERO_ADDRESS;
}

function sameAddr(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

export function resolveConfiguredMarket(input: {
  factoryAddress?: string | null;
  quoteAddress?: string | null;
  coinAddress?: string | null;
  curveAddress?: string | null;
}): { ok: true; ids: ConfiguredMarketIds } | { ok: false; reason: string } {
  if (!isConfiguredAddress(input.factoryAddress)) return { ok: false, reason: "factory_unconfigured" };
  if (!isConfiguredAddress(input.quoteAddress)) return { ok: false, reason: "quote_unconfigured" };
  if (!isConfiguredAddress(input.coinAddress)) return { ok: false, reason: "coin_unconfigured" };
  if (!isConfiguredAddress(input.curveAddress)) return { ok: false, reason: "curve_unconfigured" };
  if (sameAddr(input.coinAddress, input.curveAddress)) return { ok: false, reason: "coin_curve_mismatch" };
  if (sameAddr(input.coinAddress, input.quoteAddress)) return { ok: false, reason: "coin_quote_mismatch" };
  if (sameAddr(input.curveAddress, input.quoteAddress)) return { ok: false, reason: "curve_quote_mismatch" };
  if (sameAddr(input.factoryAddress, input.coinAddress) || sameAddr(input.factoryAddress, input.curveAddress)) {
    return { ok: false, reason: "factory_market_mismatch" };
  }
  return {
    ok: true,
    ids: {
      factory: input.factoryAddress,
      quote: input.quoteAddress,
      coin: input.coinAddress,
      curve: input.curveAddress,
    },
  };
}

/** Tip config is configured only when factory + quote + coin + curve are real and distinct. */
export function tipMarketAvailability(): MarketAvailability {
  if (C.profile !== "testnet-clone" || !C.liveExecutionEnabled) {
    return { state: "unconfigured", reason: "clone_execution_disabled" };
  }
  const resolved = resolveConfiguredMarket({
    factoryAddress: C.factoryAddress,
    quoteAddress: C.quoteAddress,
    coinAddress: C.coinAddress,
    curveAddress: C.curveAddress,
  });
  if (!resolved.ok) return { state: "unconfigured", reason: resolved.reason };
  return { state: "configured", ids: resolved.ids };
}

export function registryRowAvailability(market: RlusdMarket): MarketAvailability {
  const resolved = resolveConfiguredMarket({
    factoryAddress: market.factoryAddress,
    quoteAddress: C.quoteAddress,
    coinAddress: market.coinAddress,
    curveAddress: market.marketAddress,
  });
  if (!resolved.ok) return { state: "unconfigured", reason: resolved.reason };
  if (C.factoryAddress && !sameAddr(resolved.ids.factory, C.factoryAddress)) {
    return { state: "unconfigured", reason: "factory_mismatch" };
  }
  return { state: "configured", ids: resolved.ids };
}

export function advanceLiveState(
  availability: MarketAvailability,
  live: { loading: boolean; failed: boolean; graduated?: boolean },
): MarketAvailability {
  if (availability.state === "unconfigured") return availability;
  const ids = availability.ids;
  if (live.failed) return { state: "failed", ids, reason: "market_read_failed" };
  if (live.loading || live.graduated === undefined) return { state: "loading", ids };
  return { state: "tradable", ids, graduated: live.graduated };
}

export function isTradable(availability: MarketAvailability): availability is Extract<MarketAvailability, { state: "tradable" }> {
  return availability.state === "tradable";
}

export function displayQuoteSymbol() {
  return C.quoteSymbol;
}
