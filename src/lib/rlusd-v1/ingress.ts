import { RLUSD_V1 as C } from "./config";
export const SQUID_V2 = { chains: "https://v2.api.squidrouter.com/v2/chains", tokens: "https://v2.api.squidrouter.com/v2/tokens", route: "https://v2.api.squidrouter.com/v2/route" } as const;

export type SquidChain = { chainId: string; chainName?: string; networkName?: string; type?: string };
export type SquidToken = { chainId: string; address?: string; symbol?: string; name?: string; decimals?: number; type?: string };
export type IngressStatus = "ready" | "provider_gap";
export type SquidMetadata = {
  provider: "squid-v2"; fetchedAt: string; status: IngressStatus; reason?: string;
  chainCount: number; tokenCount: number; chains: SquidChain[]; tokens: SquidToken[];
  destination: { chainId: number; chainListed: boolean; quote: { address: string; symbol: string; decimals: number; listed: boolean } };
};
export type RlusdQuoteRequest = {
  fromAddress: string; toAddress: string; fromChain: string; fromToken: string; fromAmount: string;
  toChain: string; toToken: string; quoteOnly: true;
};
export type AllowlistedBuyAdapter = {
  kind: "allowlisted-buy-adapter"; provider: "squid-v2"; destinationChainId: 1440000;
  quoteToken: string; marketAddress: string; beneficiary: string; enabled: false;
  reason: "BUY_ADAPTER_NOT_CONFIGURED";
};

type FetchLike = typeof fetch;
function integratorId(explicit?: string) {
  return explicit?.trim() || process.env.SQUID_INTEGRATOR_ID?.trim() || process.env.NEXT_PUBLIC_SQUID_INTEGRATOR_ID?.trim() || "";
}
async function readJson(url: string, headers: Record<string, string>, fetchImpl: FetchLike) {
  try {
    const response = await fetchImpl(url, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
    const body = await response.json().catch(() => null);
    return response.ok ? { ok: true, status: response.status, body } : { ok: false, status: response.status, body, error: `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, status: 0, body: null, error: error instanceof Error ? error.message : String(error) };
  }
}
function chainsFrom(body: unknown): SquidChain[] {
  const rows = (body as { chains?: unknown } | null)?.chains;
  return Array.isArray(rows) ? rows.filter((x): x is Record<string, unknown> => !!x && typeof x === "object").map((x) => ({
    chainId: String(x.chainId ?? x.id ?? ""), chainName: typeof x.chainName === "string" ? x.chainName : undefined,
    networkName: typeof x.networkName === "string" ? x.networkName : undefined, type: typeof x.type === "string" ? x.type : undefined,
  })).filter((x) => x.chainId !== "") : [];
}
function tokensFrom(body: unknown): SquidToken[] {
  const rows = (body as { tokens?: unknown } | null)?.tokens;
  return Array.isArray(rows) ? rows.filter((x): x is Record<string, unknown> => !!x && typeof x === "object").map((x) => ({
    chainId: String(x.chainId ?? ""), address: typeof x.address === "string" ? x.address : undefined,
    symbol: typeof x.symbol === "string" ? x.symbol : undefined, name: typeof x.name === "string" ? x.name : undefined,
    decimals: typeof x.decimals === "number" ? x.decimals : undefined, type: typeof x.type === "string" ? x.type : undefined,
  })).filter((x) => x.chainId !== "") : [];
}

function makeMetadata(chains: SquidChain[], tokens: SquidToken[], fetchedAt: string, providerError?: string): SquidMetadata {
  const destinationTokens = tokens.filter((token) => token.chainId === String(C.chainId));
  const listed = destinationTokens.some((token) => token.address?.toLowerCase() === C.quoteAddress.toLowerCase() && token.symbol?.toUpperCase() === C.quoteSymbol && token.decimals === C.quoteDecimals);
  const chainListed = chains.some((chain) => chain.chainId === String(C.chainId));
  const reason = providerError || (!chainListed ? `DESTINATION_CHAIN_NOT_LISTED:${C.chainId}` : !listed ? "RLUSD_DESTINATION_TOKEN_NOT_LISTED" : undefined);
  return { provider: "squid-v2", fetchedAt, status: reason ? "provider_gap" : "ready", reason, chainCount: chains.length, tokenCount: tokens.length, chains, tokens,
    destination: { chainId: C.chainId, chainListed, quote: { address: C.quoteAddress, symbol: C.quoteSymbol, decimals: C.quoteDecimals, listed } } };
}

/** Fetches only supported Squid chain/token catalogs. No route transaction data is requested. */
export async function fetchSquidMetadata(options: { integratorId?: string; fetchImpl?: FetchLike } = {}): Promise<SquidMetadata> {
  const fetchedAt = new Date().toISOString();
  const id = integratorId(options.integratorId);
  if (!id) return makeMetadata([], [], fetchedAt, "SQUID_INTEGRATOR_ID_NOT_CONFIGURED");
  const fetchImpl = options.fetchImpl || fetch;
  const headers = { "x-integrator-id": id, accept: "application/json" };
  const [chainsResponse, tokensResponse] = await Promise.all([readJson(SQUID_V2.chains, headers, fetchImpl), readJson(SQUID_V2.tokens, headers, fetchImpl)]);
  const chains = chainsFrom(chainsResponse.body), tokens = tokensFrom(tokensResponse.body);
  const error = !chainsResponse.ok ? `SQUID_CHAINS_UNAVAILABLE:${chainsResponse.error || chainsResponse.status}` : !tokensResponse.ok ? `SQUID_TOKENS_UNAVAILABLE:${tokensResponse.error || tokensResponse.status}` : undefined;
  return makeMetadata(chains, tokens, fetchedAt, error);
}

/**
 * Creates a quote-only request after exact source/destination allowlisting. It has no
 * postHook and cannot be submitted for execution; a reviewed BUY adapter remains separate.
 */
export function buildRlusdQuoteRequest(metadata: SquidMetadata, input: Omit<RlusdQuoteRequest, "toToken" | "toChain" | "quoteOnly">): RlusdQuoteRequest {
  if (metadata.status !== "ready" || !metadata.destination.chainListed || !metadata.destination.quote.listed) throw new Error(`SQUID_RLUSD_DESTINATION_UNAVAILABLE:${metadata.reason || "UNKNOWN"}`);
  const sourceChain = metadata.chains.some((chain) => chain.chainId === input.fromChain);
  const sourceToken = metadata.tokens.some((token) => token.chainId === input.fromChain && token.address?.toLowerCase() === input.fromToken.toLowerCase());
  if (!sourceChain || !sourceToken) throw new Error("SQUID_SOURCE_ASSET_NOT_ALLOWLISTED");
  return { ...input, toChain: String(C.chainId), toToken: C.quoteAddress, quoteOnly: true };
}

/** Conceptual destination guard; cannot enable without reviewed market/hook deployment. */
export function allowlistedBuyAdapter(marketAddress: string, beneficiary: string): AllowlistedBuyAdapter {
  return { kind: "allowlisted-buy-adapter", provider: "squid-v2", destinationChainId: C.chainId, quoteToken: C.quoteAddress, marketAddress, beneficiary, enabled: false, reason: "BUY_ADAPTER_NOT_CONFIGURED" };
}
