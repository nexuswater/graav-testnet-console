import test from "node:test";
import assert from "node:assert/strict";
import { RLUSD_V1 as C } from "../src/lib/rlusd-v1/config.js";
import { allowlistedBuyAdapter, buildRlusdQuoteRequest, fetchSquidMetadata, type SquidMetadata } from "../src/lib/rlusd-v1/ingress.js";

const MOCK_SOURCE = "0x1111111111111111111111111111111111111111";
const MOCK_WALLET = "0x2222222222222222222222222222222222222222";
function response(body: unknown): Response { return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }); }

test("Squid metadata adapter uses exact RLUSD destination identity", async () => {
  const seen: string[] = [];
  const metadata = await fetchSquidMetadata({ integratorId: "fixture-integrator", fetchImpl: async (input, init) => {
    seen.push(`${String(input)}:${String((init?.headers as Record<string, string>)["x-integrator-id"])}`);
    return String(input).endsWith("/chains")
      ? response({ chains: [{ chainId: "1440000", chainName: "XRPL EVM" }, { chainId: "1" }] })
      : response({ tokens: [{ chainId: "1", address: MOCK_SOURCE, symbol: "USDC", decimals: 6 }, { chainId: "1440000", address: C.quoteAddress, symbol: "RLUSD", decimals: 18 }] });
  } });
  assert.equal(metadata.status, "ready");
  assert.equal(metadata.destination.chainListed, true);
  assert.equal(metadata.destination.quote.listed, true);
  assert.equal(seen.length, 2);
  assert.ok(seen.every((value) => value.endsWith(":fixture-integrator")));
});

test("missing integrator is a provider gap, not a mock route", async () => {
  const metadata = await fetchSquidMetadata({ integratorId: "" });
  assert.equal(metadata.status, "provider_gap");
  assert.equal(metadata.reason, "SQUID_INTEGRATOR_ID_NOT_CONFIGURED");
  assert.equal(metadata.destination.chainListed, false);
});

test("quote request is exact-destination and quote-only", () => {
  const metadata: SquidMetadata = {
    provider: "squid-v2", fetchedAt: new Date(0).toISOString(), status: "ready", chainCount: 2, tokenCount: 2,
    chains: [{ chainId: "1" }, { chainId: "1440000" }],
    tokens: [{ chainId: "1", address: MOCK_SOURCE, symbol: "USDC", decimals: 6 }, { chainId: "1440000", address: C.quoteAddress, symbol: "RLUSD", decimals: 18 }],
    destination: { chainId: C.chainId, chainListed: true, quote: { address: C.quoteAddress, symbol: "RLUSD", decimals: 18, listed: true } },
  };
  assert.deepEqual(buildRlusdQuoteRequest(metadata, { fromAddress: MOCK_WALLET, toAddress: MOCK_WALLET, fromChain: "1", fromToken: MOCK_SOURCE, fromAmount: "1000000" }), {
    fromAddress: MOCK_WALLET, toAddress: MOCK_WALLET, fromChain: "1", fromToken: MOCK_SOURCE, fromAmount: "1000000", toChain: "1440000", toToken: C.quoteAddress, quoteOnly: true,
  });
  assert.throws(() => buildRlusdQuoteRequest({ ...metadata, destination: { ...metadata.destination, quote: { ...metadata.destination.quote, listed: false } }, status: "provider_gap", reason: "gap" }, { fromAddress: MOCK_WALLET, toAddress: MOCK_WALLET, fromChain: "1", fromToken: MOCK_SOURCE, fromAmount: "1" }), /DESTINATION_UNAVAILABLE/);
});

test("BUY adapter remains disabled until market hook and authorizer are deployed", () => {
  const adapter = allowlistedBuyAdapter("0x3333333333333333333333333333333333333333", MOCK_WALLET);
  assert.equal(adapter.destinationChainId, 1440000);
  assert.equal(adapter.quoteToken, C.quoteAddress);
  assert.equal(adapter.enabled, false);
  assert.equal(adapter.reason, "BUY_ADAPTER_NOT_CONFIGURED");
});
