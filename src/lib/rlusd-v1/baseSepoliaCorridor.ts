import { RLUSD_V1 as C } from "./config";
import { SQUID_V2, type RlusdQuoteRequest } from "./ingress";

/**
 * Base Sepolia inbound corridor: USDC on 84532 → console quote asset (RLUSD display)
 * on XRPL EVM testnet 1449000. Read-only, quote-only, fail-closed. Nothing here signs,
 * submits, or returns executable transaction data. Buy opens only on a live PASS plus a
 * reviewed execution adapter; neither exists today.
 */
export const BASE_SEPOLIA_SOURCE = {
  key: "base-sepolia",
  label: "Base Sepolia",
  chainId: 84532,
  axelarId: "base-sepolia",
  rpc: "https://sepolia.base.org",
  /** Circle-issued testnet USDC, 6 decimals. */
  usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  usdcDecimals: 6,
} as const;

export const CORRIDOR_DESTINATION = {
  chainId: C.chainId,
  axelarId: "xrpl-evm",
  quoteAddress: C.quoteAddress,
  quoteSymbol: C.quoteSymbol,
  quoteDecimals: C.quoteDecimals,
} as const;

export const AXELAR_TESTNET = {
  chains: "https://testnet.api.axelarscan.io/api/getChains",
  its: "https://testnet.api.axelarscan.io/api/getITSAssets",
  assets: "https://testnet.api.axelarscan.io/api/getAssets",
} as const;

export const LIFI_V1 = { chains: "https://li.quest/v1/chains?chainTypes=EVM" } as const;

/** One USDC (6 decimals). Quote probes never move funds. */
export const PROBE_AMOUNT_USDC = "1000000";
export const PROBE_ADDRESS = "0x000000000000000000000000000000000000dEaD";

export type Verdict = "PASS" | "FAIL" | "HOLD";

export type GateId =
  | "source-chain"
  | "source-usdc"
  | "dest-chain"
  | "dest-rlusd"
  | "live-quote"
  | "native-bridge-asset"
  | "execution-adapter";

export type Gate = { id: GateId; label: string; verdict: Verdict; detail: string };

/** A catalog read is definitive only when the provider answered 2xx. */
export type Observation<T> =
  | { ok: true; status: number; value: T }
  | { ok: false; status: number; error: string };

export type SkippedObservation = { skipped: true; inherit: Exclude<Verdict, "PASS">; reason: string };

export type QuoteObservation =
  | { attempted: false; inherit: Exclude<Verdict, "PASS">; reason: string }
  | { attempted: true; ok: false; status: number; error: string; definitive: boolean }
  | { attempted: true; ok: true; status: number; toChain: string; toToken: string; toAmount: string; quoteId?: string };

export type SquidEvidence = {
  integrator: "env" | "public-probe";
  chains: Observation<string[]>;
  sourceTokens: Observation<string[]> | SkippedObservation;
  destTokens: Observation<string[]> | SkippedObservation;
  quote: QuoteObservation;
};

export type AxelarItsAsset = { symbol: string; name: string; chains: Record<string, string | null> };
export type AxelarGatewayAsset = { symbol: string; denom: string; chains: string[] };

export type AxelarEvidence = {
  chains: Observation<{ id: string; chainId: string | null }[]>;
  itsAssets: Observation<AxelarItsAsset[]>;
  gatewayAssets: Observation<AxelarGatewayAsset[]>;
};

export type LifiEvidence = { chains: Observation<number[]> };

export type CallRecord = {
  provider: "squid" | "axelar" | "lifi";
  method: "GET" | "POST";
  url: string;
  status: number;
  ok: boolean;
  note?: string;
};

export type CorridorEvidence = {
  fetchedAt: string;
  squid: SquidEvidence;
  axelar: AxelarEvidence;
  lifi: LifiEvidence;
  calls: CallRecord[];
};

export type ExecutionAdapter = { enabled: boolean; reason: string };

/** No reviewed destination adapter exists; this constant is the only wiring. */
export const EXECUTION_ADAPTER_UNCONFIGURED: ExecutionAdapter = {
  enabled: false,
  reason: "BUY_ADAPTER_NOT_CONFIGURED",
};

export type CorridorReport = {
  corridor: "base-sepolia-usdc->xrpl-evm-testnet-rlusd";
  fetchedAt: string;
  source: typeof BASE_SEPOLIA_SOURCE;
  destination: typeof CORRIDOR_DESTINATION;
  /** Route proof only. PASS requires every Squid gate to pass on live data. */
  verdict: Verdict;
  /** verdict PASS AND a reviewed execution adapter. Never true from catalogs alone. */
  buyEnabled: boolean;
  liveExecutionEnabled: false;
  executionAdapter: ExecutionAdapter;
  gates: Gate[];
  lanes: { squid: string; axelar: string; lifi: string };
  summary: string;
  calls: CallRecord[];
};

const ROUTE_GATES: GateId[] = ["source-chain", "source-usdc", "dest-chain", "dest-rlusd", "live-quote"];

function lower(value: string) {
  return value.toLowerCase();
}

function catalogGate<T>(
  obs: Observation<T>,
  hit: (value: T) => boolean,
  text: { pass: string; fail: (value: T) => string; hold: string }
): { verdict: Verdict; detail: string } {
  if (!obs.ok) return { verdict: "HOLD", detail: `${text.hold}: ${obs.error} (HTTP ${obs.status})` };
  return hit(obs.value) ? { verdict: "PASS", detail: text.pass } : { verdict: "FAIL", detail: text.fail(obs.value) };
}

function tokenGate(
  obs: Observation<string[]> | SkippedObservation,
  address: string,
  label: string
): { verdict: Verdict; detail: string } {
  if ("skipped" in obs) return { verdict: obs.inherit, detail: `Not queried: ${obs.reason}` };
  return catalogGate(obs, (tokens) => tokens.includes(lower(address)), {
    pass: `${label} ${address} listed by Squid.`,
    fail: (tokens) => `${label} ${address} absent from Squid token catalog (${tokens.length} tokens).`,
    hold: `Squid token catalog unavailable`,
  });
}

function quoteGate(q: QuoteObservation): { verdict: Verdict; detail: string } {
  if (!q.attempted) return { verdict: q.inherit, detail: `Quote not requested: ${q.reason}` };
  if (!q.ok) {
    return q.definitive
      ? { verdict: "FAIL", detail: `Squid rejected quote-only route: ${q.error} (HTTP ${q.status})` }
      : { verdict: "HOLD", detail: `Squid quote unavailable: ${q.error} (HTTP ${q.status})` };
  }
  const exactChain = q.toChain === String(CORRIDOR_DESTINATION.chainId);
  const exactToken = lower(q.toToken) === lower(CORRIDOR_DESTINATION.quoteAddress);
  let positive = false;
  try {
    positive = BigInt(q.toAmount) > 0n;
  } catch {
    positive = false;
  }
  if (exactChain && exactToken && positive) {
    return { verdict: "PASS", detail: `Live quote-only route lands ${q.toAmount} ${CORRIDOR_DESTINATION.quoteSymbol} units on ${q.toChain}.` };
  }
  return {
    verdict: "FAIL",
    detail: `Quote mismatch: toChain=${q.toChain} toToken=${q.toToken} toAmount=${q.toAmount}; expected ${CORRIDOR_DESTINATION.chainId} / ${CORRIDOR_DESTINATION.quoteAddress}.`,
  };
}

function nativeBridgeGate(a: AxelarEvidence): { verdict: Verdict; detail: string } {
  if (!a.chains.ok) return { verdict: "HOLD", detail: `Axelar testnet chains unavailable: ${a.chains.error}` };
  const dest = a.chains.value.find((c) => c.id === CORRIDOR_DESTINATION.axelarId);
  const src = a.chains.value.find((c) => c.id === BASE_SEPOLIA_SOURCE.axelarId);
  if (!dest || dest.chainId !== String(CORRIDOR_DESTINATION.chainId) || !src) {
    return {
      verdict: "FAIL",
      detail: `Axelar testnet catalog: xrpl-evm=${dest ? dest.chainId : "absent"} base-sepolia=${src ? "listed" : "absent"}.`,
    };
  }
  if (!a.itsAssets.ok || !a.gatewayAssets.ok) {
    return { verdict: "HOLD", detail: "Axelar testnet asset catalogs unavailable; both chains listed." };
  }
  const onBoth = (chains: string[]) =>
    chains.includes(CORRIDOR_DESTINATION.axelarId) && chains.includes(BASE_SEPOLIA_SOURCE.axelarId);
  const exact = a.itsAssets.value.find(
    (t) =>
      onBoth(Object.keys(t.chains)) &&
      lower(t.chains[CORRIDOR_DESTINATION.axelarId] ?? "") === lower(CORRIDOR_DESTINATION.quoteAddress)
  );
  if (exact) {
    return { verdict: "PASS", detail: `Axelar ITS ${exact.symbol} is the exact quote asset on xrpl-evm and exists on base-sepolia.` };
  }
  const candidates = [
    ...a.itsAssets.value.filter((t) => /usdc|rlusd/i.test(`${t.symbol} ${t.name}`) && onBoth(Object.keys(t.chains))).map((t) => `ITS ${t.symbol}`),
    ...a.gatewayAssets.value.filter((t) => /usdc|rlusd/i.test(`${t.symbol} ${t.denom}`) && onBoth(t.chains)).map((t) => `gateway ${t.symbol}`),
  ];
  const destIts = a.itsAssets.value.filter((t) => CORRIDOR_DESTINATION.axelarId in t.chains).map((t) => t.symbol);
  const destGateway = a.gatewayAssets.value.filter((t) => t.chains.includes(CORRIDOR_DESTINATION.axelarId)).map((t) => t.symbol);
  if (candidates.length) {
    return {
      verdict: "HOLD",
      detail: `Axelar lists ${candidates.join(", ")} on both chains but not the exact quote asset; a manual swap leg would be required.`,
    };
  }
  return {
    verdict: "FAIL",
    detail: `No USDC or RLUSD asset spans base-sepolia and xrpl-evm on Axelar testnet. ITS on xrpl-evm: [${destIts.join(", ") || "none"}]; gateway on xrpl-evm: [${destGateway.join(", ") || "none"}].`,
  };
}

function laneSummary(e: CorridorEvidence) {
  const s = e.squid;
  const squidChains = s.chains.ok
    ? `${s.chains.value.length} chains; 84532=${s.chains.value.includes(String(BASE_SEPOLIA_SOURCE.chainId)) ? "yes" : "no"} ${CORRIDOR_DESTINATION.chainId}=${s.chains.value.includes(String(CORRIDOR_DESTINATION.chainId)) ? "yes" : "no"}`
    : `chains unavailable (${s.chains.error})`;
  const lifi = e.lifi.chains.ok
    ? `${e.lifi.chains.value.length} chains; 84532=${e.lifi.chains.value.includes(BASE_SEPOLIA_SOURCE.chainId) ? "yes" : "no"} ${CORRIDOR_DESTINATION.chainId}=${e.lifi.chains.value.includes(CORRIDOR_DESTINATION.chainId) ? "yes" : "no"} (catalog only, no RLUSD lane)`
    : `chains unavailable (${e.lifi.chains.error})`;
  const axelar = e.axelar.chains.ok
    ? `${e.axelar.chains.value.length} chains; ITS assets ${e.axelar.itsAssets.ok ? e.axelar.itsAssets.value.length : "?"}; gateway assets ${e.axelar.gatewayAssets.ok ? e.axelar.gatewayAssets.value.length : "?"}`
    : `chains unavailable (${e.axelar.chains.error})`;
  return { squid: `${s.integrator}: ${squidChains}`, axelar, lifi };
}

/** Pure. Same evidence always yields the same verdict; PASS is impossible without a live exact quote. */
export function evaluateBaseSepoliaCorridor(
  evidence: CorridorEvidence,
  adapter: ExecutionAdapter = EXECUTION_ADAPTER_UNCONFIGURED
): CorridorReport {
  const s = evidence.squid;
  const gates: Gate[] = [];

  const sourceChain = catalogGate(s.chains, (ids) => ids.includes(String(BASE_SEPOLIA_SOURCE.chainId)), {
    pass: `Squid lists ${BASE_SEPOLIA_SOURCE.label} (${BASE_SEPOLIA_SOURCE.chainId}).`,
    fail: (ids) => `Squid /v2/chains does not list ${BASE_SEPOLIA_SOURCE.chainId} (${ids.length} chains, no testnets).`,
    hold: "Squid chain catalog unavailable",
  });
  gates.push({ id: "source-chain", label: `Source chain routable (${BASE_SEPOLIA_SOURCE.chainId})`, ...sourceChain });
  gates.push({ id: "source-usdc", label: "Source USDC allowlisted", ...tokenGate(s.sourceTokens, BASE_SEPOLIA_SOURCE.usdc, "USDC") });

  const destChain = catalogGate(s.chains, (ids) => ids.includes(String(CORRIDOR_DESTINATION.chainId)), {
    pass: `Squid lists XRPL EVM testnet (${CORRIDOR_DESTINATION.chainId}).`,
    fail: (ids) => `Squid /v2/chains does not list ${CORRIDOR_DESTINATION.chainId} (${ids.length} chains).`,
    hold: "Squid chain catalog unavailable",
  });
  gates.push({ id: "dest-chain", label: `Destination chain routable (${CORRIDOR_DESTINATION.chainId})`, ...destChain });
  gates.push({
    id: "dest-rlusd",
    label: `Destination ${CORRIDOR_DESTINATION.quoteSymbol} allowlisted`,
    ...tokenGate(s.destTokens, CORRIDOR_DESTINATION.quoteAddress, CORRIDOR_DESTINATION.quoteSymbol),
  });
  gates.push({ id: "live-quote", label: "Live quote-only route (exact destination asset)", ...quoteGate(s.quote) });

  const native = nativeBridgeGate(evidence.axelar);
  gates.push({ id: "native-bridge-asset", label: "Native bridge asset (Axelar testnet ITS / gateway)", ...native });
  gates.push({
    id: "execution-adapter",
    label: "Reviewed execution adapter",
    verdict: adapter.enabled ? "PASS" : "FAIL",
    detail: adapter.enabled ? "Adapter enabled." : `${adapter.reason}: no destination Buy adapter is deployed or reviewed.`,
  });

  const route = gates.filter((g) => ROUTE_GATES.includes(g.id));
  let verdict: Verdict;
  if (route.every((g) => g.verdict === "PASS")) verdict = "PASS";
  else if (native.verdict === "PASS") verdict = "HOLD";
  else if (route.some((g) => g.verdict === "FAIL")) verdict = "FAIL";
  else verdict = "HOLD";

  const buyEnabled = verdict === "PASS" && adapter.enabled;
  const failing = route.filter((g) => g.verdict !== "PASS").map((g) => `${g.id}=${g.verdict}`);
  const summary =
    verdict === "PASS"
      ? buyEnabled
        ? "Route proven and adapter enabled."
        : `Route proven on live data; Buy stays closed (${adapter.reason}).`
      : verdict === "FAIL"
        ? `No provider routes ${BASE_SEPOLIA_SOURCE.label} USDC to ${CORRIDOR_DESTINATION.quoteSymbol} on ${CORRIDOR_DESTINATION.chainId}. Fail-closed. [${failing.join(" ")}]`
        : `Corridor unproven; evidence incomplete or manual-only. Fail-closed. [${failing.join(" ")}]`;

  return {
    corridor: "base-sepolia-usdc->xrpl-evm-testnet-rlusd",
    fetchedAt: evidence.fetchedAt,
    source: BASE_SEPOLIA_SOURCE,
    destination: CORRIDOR_DESTINATION,
    verdict,
    buyEnabled,
    liveExecutionEnabled: false,
    executionAdapter: adapter,
    gates,
    lanes: laneSummary(evidence),
    summary,
    calls: evidence.calls,
  };
}

type FetchLike = typeof fetch;

type RawResponse = { ok: boolean; status: number; body: unknown; error?: string };

async function readJson(
  url: string,
  init: { method?: "GET" | "POST"; headers?: Record<string, string>; body?: string },
  fetchImpl: FetchLike,
  timeoutMs: number
): Promise<RawResponse> {
  try {
    const response = await fetchImpl(url, {
      method: init.method ?? "GET",
      headers: init.headers,
      body: init.body,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await response.json().catch(() => null);
    if (response.ok) return { ok: true, status: response.status, body };
    const message = (body as { message?: string } | null)?.message;
    return { ok: false, status: response.status, body, error: message ? `HTTP ${response.status} ${message}` : `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, status: 0, body: null, error: error instanceof Error ? error.message : String(error) };
  }
}

function asRows(body: unknown, key: string): Record<string, unknown>[] {
  const rows = (body as Record<string, unknown> | null)?.[key];
  return Array.isArray(rows) ? rows.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}

function asArray(body: unknown): Record<string, unknown>[] {
  return Array.isArray(body) ? body.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}

function observe<T>(res: RawResponse, map: (body: unknown) => T): Observation<T> {
  return res.ok ? { ok: true, status: res.status, value: map(res.body) } : { ok: false, status: res.status, error: res.error ?? "unknown" };
}

/** Squid schema/validation rejections are definitive; throttling and outages are not. */
function squidDefinitive(res: RawResponse): boolean {
  if (res.status === 429 || res.status >= 500 || res.status === 0) return false;
  return res.status >= 400;
}

function resolveIntegrator(explicit?: string): { id: string; kind: "env" | "public-probe" } {
  const fromEnv = explicit?.trim() || process.env.SQUID_INTEGRATOR_ID?.trim() || process.env.NEXT_PUBLIC_SQUID_INTEGRATOR_ID?.trim();
  return fromEnv ? { id: fromEnv, kind: "env" } : { id: "test", kind: "public-probe" };
}

/**
 * Collects live, read-only evidence and evaluates it. The quote-only request is sent
 * only after every catalog gate passes, so a missing corridor costs no route calls.
 */
export async function probeBaseSepoliaCorridor(
  options: { fetchImpl?: FetchLike; integratorId?: string; timeoutMs?: number; probeAddress?: string } = {}
): Promise<{ evidence: CorridorEvidence; report: CorridorReport }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12000;
  const probeAddress = options.probeAddress ?? PROBE_ADDRESS;
  const integrator = resolveIntegrator(options.integratorId);
  const squidHeaders = { "x-integrator-id": integrator.id, accept: "application/json" };
  const calls: CallRecord[] = [];
  const record = (provider: CallRecord["provider"], method: CallRecord["method"], url: string, res: RawResponse, note?: string) => {
    calls.push({ provider, method, url, status: res.status, ok: res.ok, note: note ?? res.error });
  };

  const [squidChainsRes, axelarChainsRes, axelarItsRes, axelarAssetsRes, lifiRes] = await Promise.all([
    readJson(SQUID_V2.chains, { headers: squidHeaders }, fetchImpl, timeoutMs),
    readJson(AXELAR_TESTNET.chains, {}, fetchImpl, timeoutMs),
    readJson(AXELAR_TESTNET.its, {}, fetchImpl, timeoutMs),
    readJson(AXELAR_TESTNET.assets, {}, fetchImpl, timeoutMs),
    readJson(LIFI_V1.chains, {}, fetchImpl, timeoutMs),
  ]);
  record("squid", "GET", SQUID_V2.chains, squidChainsRes);
  record("axelar", "GET", AXELAR_TESTNET.chains, axelarChainsRes);
  record("axelar", "GET", AXELAR_TESTNET.its, axelarItsRes);
  record("axelar", "GET", AXELAR_TESTNET.assets, axelarAssetsRes);
  record("lifi", "GET", LIFI_V1.chains, lifiRes);

  const squidChains = observe(squidChainsRes, (body) => asRows(body, "chains").map((c) => String(c.chainId ?? c.id ?? "")).filter(Boolean));

  const tokensFor = async (chainId: number): Promise<Observation<string[]> | SkippedObservation> => {
    if (!squidChains.ok) return { skipped: true, inherit: "HOLD", reason: "Squid chain catalog unavailable" };
    if (!squidChains.value.includes(String(chainId))) {
      return { skipped: true, inherit: "FAIL", reason: `chain ${chainId} absent from Squid /v2/chains` };
    }
    const url = `${SQUID_V2.tokens}?chainId=${chainId}`;
    const res = await readJson(url, { headers: squidHeaders }, fetchImpl, timeoutMs);
    record("squid", "GET", url, res);
    return observe(res, (body) => asRows(body, "tokens").map((t) => lower(String(t.address ?? ""))).filter(Boolean));
  };
  const [sourceTokens, destTokens] = await Promise.all([tokensFor(BASE_SEPOLIA_SOURCE.chainId), tokensFor(CORRIDOR_DESTINATION.chainId)]);

  const listed = (obs: Observation<string[]> | SkippedObservation, address: string) => !("skipped" in obs) && obs.ok && obs.value.includes(lower(address));
  const catalogsPass =
    squidChains.ok &&
    squidChains.value.includes(String(BASE_SEPOLIA_SOURCE.chainId)) &&
    squidChains.value.includes(String(CORRIDOR_DESTINATION.chainId)) &&
    listed(sourceTokens, BASE_SEPOLIA_SOURCE.usdc) &&
    listed(destTokens, CORRIDOR_DESTINATION.quoteAddress);

  let quote: QuoteObservation;
  if (!catalogsPass) {
    const unknown = !squidChains.ok || ("skipped" in sourceTokens && sourceTokens.inherit === "HOLD") || (!("skipped" in sourceTokens) && !sourceTokens.ok) || (!("skipped" in destTokens) && !destTokens.ok);
    quote = { attempted: false, inherit: unknown ? "HOLD" : "FAIL", reason: "catalog gates did not pass; no route request sent" };
  } else {
    const request: RlusdQuoteRequest = {
      fromAddress: probeAddress,
      toAddress: probeAddress,
      fromChain: String(BASE_SEPOLIA_SOURCE.chainId),
      fromToken: BASE_SEPOLIA_SOURCE.usdc,
      fromAmount: PROBE_AMOUNT_USDC,
      toChain: String(CORRIDOR_DESTINATION.chainId),
      toToken: CORRIDOR_DESTINATION.quoteAddress,
      quoteOnly: true,
    };
    const res = await readJson(
      SQUID_V2.route,
      { method: "POST", headers: { ...squidHeaders, "content-type": "application/json" }, body: JSON.stringify(request) },
      fetchImpl,
      timeoutMs
    );
    record("squid", "POST", SQUID_V2.route, res, res.ok ? "quoteOnly" : res.error);
    if (!res.ok) {
      quote = { attempted: true, ok: false, status: res.status, error: res.error ?? "unknown", definitive: squidDefinitive(res) };
    } else {
      const route = (res.body as { route?: { estimate?: Record<string, unknown>; params?: Record<string, unknown>; quoteId?: string } } | null)?.route;
      const est = route?.estimate ?? {};
      const toToken = (est.toToken as { address?: string; chainId?: string } | undefined) ?? {};
      quote = {
        attempted: true,
        ok: true,
        status: res.status,
        toChain: String(toToken.chainId ?? route?.params?.toChain ?? ""),
        toToken: String(toToken.address ?? ""),
        toAmount: String(est.toAmount ?? "0"),
        quoteId: typeof route?.quoteId === "string" ? route.quoteId : undefined,
      };
    }
  }

  const evidence: CorridorEvidence = {
    fetchedAt: new Date().toISOString(),
    squid: { integrator: integrator.kind, chains: squidChains, sourceTokens, destTokens, quote },
    axelar: {
      chains: observe(axelarChainsRes, (body) =>
        asArray(body).map((c) => ({ id: String(c.id ?? ""), chainId: c.chain_id == null ? null : String(c.chain_id) }))
      ),
      itsAssets: observe(axelarItsRes, (body) =>
        asArray(body).map((a) => {
          const chains = (a.chains ?? {}) as Record<string, { tokenAddress?: string } | null>;
          const mapped: Record<string, string | null> = {};
          for (const [k, v] of Object.entries(chains)) mapped[k] = v?.tokenAddress ? String(v.tokenAddress) : null;
          return { symbol: String(a.symbol ?? ""), name: String(a.name ?? ""), chains: mapped };
        })
      ),
      gatewayAssets: observe(axelarAssetsRes, (body) =>
        asArray(body).map((a) => ({
          symbol: String(a.symbol ?? ""),
          denom: String(a.denom ?? ""),
          chains: Object.keys((a.addresses ?? {}) as Record<string, unknown>),
        }))
      ),
    },
    lifi: { chains: observe(lifiRes, (body) => asRows(body, "chains").map((c) => Number(c.id)).filter((n) => Number.isFinite(n))) },
    calls,
  };

  return { evidence, report: evaluateBaseSepoliaCorridor(evidence) };
}
