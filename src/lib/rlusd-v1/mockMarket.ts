import { RLUSD_V1 as C } from "./config";
import { registryRowAvailability } from "./availability";
import { getRlusdMarket } from "./marketRegistry";
import { initializeCurve, splitFees, type CurveState } from "./model";

export type MockSession = {
  id: string;
  action: "BUY";
  xPostId: string;
  grossQuote: bigint;
  minTokensOut: bigint;
  referralXId: string | null;
  status: "REFERENCE_ONLY";
  tokensOut: bigint;
  fee: bigint;
  referralCredit: bigint;
  state: CurveState;
  createdAt: number;
};

const CLOSED = "MOCK_FINANCIAL_SUCCESS_CLOSED";

export function mockMarketView(xPostId = "demo-moment-2026") {
  const registry = getRlusdMarket(xPostId);
  const availability = registry ? registryRowAvailability(registry) : { state: "unconfigured" as const, reason: "unregistered" };
  const configured = availability.state !== "unconfigured";
  return {
    label: registry ? "RLUSD MARKET" : "UNREGISTERED MARKET",
    symbol: registry?.symbol ?? null,
    name: registry?.name ?? "Unknown market",
    description: registry?.description ?? "This market is not in the RLUSD registry",
    status: registry?.status ?? "unconfigured",
    availability: availability.state,
    wired: false,
    configured,
    policyId: C.policyId,
    chainId: C.chainId,
    quoteSymbol: "RLUSD",
    quoteDecimals: C.quoteDecimals,
    quoteAddress: C.quoteAddress,
    factoryAddress: registry?.factoryAddress ?? null,
    coinAddress: registry?.coinAddress ?? null,
    curveAddress: registry?.marketAddress ?? null,
    xPostId,
    reserve: "—",
    threshold: "—",
    graduated: false,
    live: false,
  };
}

/** Integer-model reference only. Not a live quote and not a tradable session. */
export function quoteMock(grossQuote: bigint) {
  const fees = splitFees({
    grossQuote,
    action: "BUY",
    referrerEligible: true,
    midwifeDistinct: true,
    lifetimeFeesBefore: 0n,
    referrerCreditsBefore: 0n,
  });
  return {
    live: false,
    referenceOnly: true,
    grossQuote,
    fee: fees.total,
    protocol: fees.protocol,
    creator: fees.creator,
    referrer: fees.referrer,
    midwife: fees.midwife,
    netQuote: fees.netQuote,
    tokensOut: null,
    referralCredit: null,
  };
}

export function createMockBuy(_xPostId: string, _grossQuote: bigint, _referralXId: string | null): never {
  throw new Error(CLOSED);
}

export function getMockSession(_id: string) {
  return null;
}

export function executeMockBuy(_id: string): never {
  throw new Error(CLOSED);
}

export function executeMockSell(_id: string): never {
  throw new Error(CLOSED);
}

export function referenceCurve() {
  return initializeCurve(C.quoteDecimals);
}
