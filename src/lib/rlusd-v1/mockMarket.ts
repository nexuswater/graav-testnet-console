import { randomUUID } from "node:crypto";
import { RLUSD_V1 as C } from "./config";
import { getRlusdMarket } from "./marketRegistry";
import { buy, initializeCurve, sell, splitFees, type CurveState } from "./model";

export type MockSession = {
  id: string;
  action: "BUY";
  xPostId: string;
  grossQuote: bigint;
  minTokensOut: bigint;
  referralXId: string | null;
  status: "PENDING" | "COMPLETE";
  tokensOut: bigint;
  fee: bigint;
  referralCredit: bigint;
  state: CurveState;
  createdAt: number;
  executedAt?: number;
  sellQuoteOut?: bigint;
};

type Store = { curve: CurveState; sessions: Map<string, MockSession> };
const KEY = "__graav_rlusd_local_mock_v1__";
function store(): Store {
  const root = globalThis as typeof globalThis & { [KEY]?: Store };
  if (!root[KEY]) root[KEY] = { curve: initializeCurve(18), sessions: new Map() };
  return root[KEY];
}

export function mockMarketView(xPostId = "demo-moment-2026") {
  const s = store();
  const registry = getRlusdMarket(xPostId);
  const wired = registry?.marketAddress === C.curveAddress && registry?.coinAddress === C.coinAddress;
  return {
    label: registry ? "RLUSD MARKET" : "UNREGISTERED MARKET",
    symbol: registry?.symbol ?? null,
    name: registry?.name ?? "Unknown market",
    description: registry?.description ?? "This market is not in the RLUSD registry",
    status: registry?.status ?? "not-wired",
    wired,
    policyId: C.policyId,
    chainId: C.chainId,
    quoteSymbol: "RLUSD",
    quoteDecimals: C.quoteDecimals,
    quoteAddress: C.quoteAddress,
    factoryAddress: registry?.factoryAddress ?? null,
    coinAddress: registry?.coinAddress ?? null,
    curveAddress: registry?.marketAddress ?? null,
    xPostId,
    reserve: wired ? s.curve.realQuote.toString() : "—",
    threshold: wired ? s.curve.threshold.toString() : "—",
    graduated: wired ? s.curve.graduated : false,
  };
}

export function quoteMock(grossQuote: bigint) {
  const s = store();
  const fees = splitFees({ grossQuote, action: "BUY", referrerEligible: true, midwifeDistinct: true, lifetimeFeesBefore: 0n, referrerCreditsBefore: 0n });
  const preview = buy(s.curve, grossQuote, 1n);
  return { grossQuote, fee: fees.total, netQuote: fees.netQuote, tokensOut: preview.tokensOut, referralCredit: grossQuote * 20n / 10000n };
}

export function createMockBuy(xPostId: string, grossQuote: bigint, referralXId: string | null) {
  const registry = getRlusdMarket(xPostId);
  if (!registry || registry.marketAddress !== C.curveAddress || registry.coinAddress !== C.coinAddress) throw new Error("RLUSD_MARKET_NOT_WIRED");
  const q = quoteMock(grossQuote);
  const id = `rlusd_${randomUUID().replaceAll("-", "")}`;
  const s = store();
  const session: MockSession = { id, action: "BUY", xPostId, grossQuote, minTokensOut: q.tokensOut, referralXId, status: "PENDING", tokensOut: 0n, fee: q.fee, referralCredit: 0n, state: s.curve, createdAt: Date.now() };
  s.sessions.set(id, session);
  return publicSession(session);
}

export function getMockSession(id: string) { return publicSession(store().sessions.get(id)); }

export function executeMockBuy(id: string) {
  const s = store();
  const session = s.sessions.get(id);
  if (!session) throw new Error("MOCK_SESSION_NOT_FOUND");
  if (session.status === "COMPLETE") return publicSession(session);
  const result = buy(s.curve, session.grossQuote, session.minTokensOut);
  s.curve = result.state;
  session.status = "COMPLETE";
  session.tokensOut = result.tokensOut;
  session.fee = result.fee;
  session.referralCredit = session.referralXId ? session.grossQuote * 20n / 10000n : 0n;
  session.state = result.state;
  session.executedAt = Date.now();
  return publicSession(session);
}

export function executeMockSell(id: string) {
  const s = store();
  const session = s.sessions.get(id);
  if (!session || session.status !== "COMPLETE") throw new Error("MOCK_BUY_REQUIRED");
  if (session.sellQuoteOut !== undefined) return publicSession(session);
  const result = sell(s.curve, session.tokensOut, 1n);
  s.curve = result.state;
  session.sellQuoteOut = result.quoteOut;
  session.state = result.state;
  return publicSession(session);
}

function publicSession(session?: MockSession) {
  if (!session) return null;
  return { ...session, grossQuote: session.grossQuote.toString(), minTokensOut: session.minTokensOut.toString(), tokensOut: session.tokensOut.toString(), fee: session.fee.toString(), referralCredit: session.referralCredit.toString(), sellQuoteOut: session.sellQuoteOut?.toString(), state: { ...session.state, x: session.state.x.toString(), y: session.state.y.toString(), realQuote: session.state.realQuote.toString(), curveTokens: session.state.curveTokens.toString(), threshold: session.state.threshold.toString() } };
}
