import test from "node:test";
import assert from "node:assert/strict";
import { RLUSD_V1 as C } from "../src/lib/rlusd-v1/config.js";
import { SQUID_V2 } from "../src/lib/rlusd-v1/ingress.js";
import {
  AXELAR_TESTNET,
  BASE_SEPOLIA_SOURCE,
  LIFI_V1,
  evaluateBaseSepoliaCorridor,
  probeBaseSepoliaCorridor,
  type CorridorEvidence,
  type Gate,
} from "../src/lib/rlusd-v1/baseSepoliaCorridor.js";

const DEST = String(C.chainId);
const SRC = String(BASE_SEPOLIA_SOURCE.chainId);
const OTHER_TEST_RLUSD = "0x61F16049EBdC3BB505b0dBeeb31DE09C3AEf53f7";

type Handler = (init?: RequestInit) => { status: number; body: unknown } | Error;
type Seen = { url: string; method: string; body?: unknown };

function json(status: number, body: unknown) {
  return { status, body };
}

function mockFetch(routes: [string, Handler][], seen: Seen[]): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const match = routes.find(([prefix]) => url.startsWith(prefix));
    if (!match) return new Response("{}", { status: 404 });
    const out = match[1](init);
    if (out instanceof Error) throw out;
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

/** Shapes captured live on 2026-09-11 (see docs/xchain evidence JSON). */
const LIVE_SQUID_CHAINS = json(200, { chains: [{ chainId: "1" }, { chainId: "8453", networkName: "Base" }, { chainId: "42161" }] });
const LIVE_AXELAR_CHAINS = json(200, [
  { id: "base-sepolia", chain_id: 84532 },
  { id: "xrpl", chain_id: null },
  { id: "xrpl-evm", chain_id: 1449000 },
  { id: "ethereum-sepolia", chain_id: 11155111 },
]);
const LIVE_AXELAR_ITS = json(200, [
  { symbol: "XRP", name: "XRP", chains: { xrpl: {}, "xrpl-evm": { tokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" } } },
  { symbol: "SQD", name: "Squid", chains: { "ethereum-sepolia": {}, flow: {}, sui: {}, xrpl: {}, "xrpl-evm": { tokenAddress: "0xd5e67bFbFfE0A6439be6738587B115053f77aB3b" } } },
  { symbol: "TEST", name: "Test", chains: { "ethereum-sepolia": {}, sui: {}, xrpl: {} } },
  { symbol: "YSLC", name: "Slime Coin", chains: { fantom: {}, kava: {}, moonbeam: {} } },
]);
const LIVE_AXELAR_ASSETS = json(200, [
  { denom: "uausdc", symbol: "aUSDC", addresses: { "base-sepolia": { address: "0x254d06f33bDc5b8ee05b2ea472107E300226659A" }, "ethereum-sepolia": {}, base: {} } },
  { denom: "uaxl", symbol: "AXL", addresses: { "base-sepolia": {}, "ethereum-sepolia": {} } },
]);
const LIVE_LIFI = json(200, { chains: [{ id: 8453, mainnet: true }, { id: 84532, mainnet: false }, { id: 1 }] });

function gate(gates: Gate[], id: Gate["id"]) {
  const g = gates.find((x) => x.id === id);
  assert.ok(g, `gate ${id} present`);
  return g;
}

test("live 2026-09-11 evidence shape → FAIL, Buy closed, no route request sent", async () => {
  const seen: Seen[] = [];
  const { report, evidence } = await probeBaseSepoliaCorridor({
    integratorId: "fixture",
    fetchImpl: mockFetch(
      [
        [SQUID_V2.chains, () => LIVE_SQUID_CHAINS],
        [SQUID_V2.tokens, () => json(400, { message: "chainId: 84532 unsupported chain id", type: "SCHEMA_VALIDATION_ERROR" })],
        [SQUID_V2.route, () => json(400, { message: "fromChain: 84532 unsupported chain id", type: "SCHEMA_VALIDATION_ERROR" })],
        [AXELAR_TESTNET.chains, () => LIVE_AXELAR_CHAINS],
        [AXELAR_TESTNET.its, () => LIVE_AXELAR_ITS],
        [AXELAR_TESTNET.assets, () => LIVE_AXELAR_ASSETS],
        [LIFI_V1.chains, () => LIVE_LIFI],
      ],
      seen
    ),
  });

  assert.equal(report.verdict, "FAIL");
  assert.equal(report.buyEnabled, false);
  assert.equal(report.liveExecutionEnabled, false);
  assert.equal(report.executionAdapter.reason, "BUY_ADAPTER_NOT_CONFIGURED");
  assert.equal(gate(report.gates, "source-chain").verdict, "FAIL");
  assert.equal(gate(report.gates, "source-usdc").verdict, "FAIL");
  assert.equal(gate(report.gates, "dest-chain").verdict, "FAIL");
  assert.equal(gate(report.gates, "dest-rlusd").verdict, "FAIL");
  assert.equal(gate(report.gates, "live-quote").verdict, "FAIL");
  assert.equal(gate(report.gates, "native-bridge-asset").verdict, "FAIL");
  assert.match(gate(report.gates, "native-bridge-asset").detail, /XRP, SQD/);
  assert.equal(gate(report.gates, "execution-adapter").verdict, "FAIL");
  assert.equal(evidence.squid.integrator, "env");
  assert.equal(evidence.squid.quote.attempted, false);
  assert.ok(seen.every((s) => !s.url.startsWith(SQUID_V2.route)), "no /v2/route call when catalogs fail");
  assert.ok(seen.every((s) => !s.url.startsWith(SQUID_V2.tokens)), "no token lookups for unlisted chains");
  assert.ok(seen.filter((s) => s.url.startsWith("https://v2.api.squidrouter.com")).length === 1);
  assert.match(report.summary, /Fail-closed/);
});

test("provider outage → HOLD, still closed", async () => {
  const { report } = await probeBaseSepoliaCorridor({
    integratorId: "fixture",
    fetchImpl: mockFetch(
      [
        [SQUID_V2.chains, () => json(429, { message: "Too many requests", type: "RATE_LIMIT" })],
        [AXELAR_TESTNET.chains, () => new Error("fetch failed")],
        [AXELAR_TESTNET.its, () => new Error("fetch failed")],
        [AXELAR_TESTNET.assets, () => new Error("fetch failed")],
        [LIFI_V1.chains, () => json(503, {})],
      ],
      []
    ),
  });
  assert.equal(report.verdict, "HOLD");
  assert.equal(report.buyEnabled, false);
  assert.equal(gate(report.gates, "source-chain").verdict, "HOLD");
  assert.equal(gate(report.gates, "live-quote").verdict, "HOLD");
  assert.equal(gate(report.gates, "native-bridge-asset").verdict, "HOLD");
  assert.match(report.lanes.squid, /unavailable/);
});

function passingRoutes(routeBody: unknown): [string, Handler][] {
  return [
    [SQUID_V2.chains, () => json(200, { chains: [{ chainId: SRC }, { chainId: DEST }, { chainId: "8453" }] })],
    [
      SQUID_V2.tokens,
      (init) => {
        void init;
        return json(200, {
          tokens: [
            { chainId: SRC, address: BASE_SEPOLIA_SOURCE.usdc.toLowerCase(), symbol: "USDC", decimals: 6 },
            { chainId: DEST, address: C.quoteAddress.toLowerCase(), symbol: "RLUSD", decimals: 18 },
          ],
        });
      },
    ],
    [SQUID_V2.route, () => json(200, routeBody)],
    [AXELAR_TESTNET.chains, () => LIVE_AXELAR_CHAINS],
    [AXELAR_TESTNET.its, () => LIVE_AXELAR_ITS],
    [AXELAR_TESTNET.assets, () => LIVE_AXELAR_ASSETS],
    [LIFI_V1.chains, () => LIVE_LIFI],
  ];
}

test("synthetic exact quote → route PASS, Buy still closed without adapter; request is quote-only", async () => {
  const seen: Seen[] = [];
  const { report, evidence } = await probeBaseSepoliaCorridor({
    integratorId: "fixture",
    fetchImpl: mockFetch(
      passingRoutes({
        route: {
          estimate: { toAmount: "990000000000000000", toToken: { address: C.quoteAddress, chainId: DEST } },
          params: { toChain: DEST },
          quoteId: "q-1",
          transactionRequest: { data: "0xdead" },
        },
      }),
      seen
    ),
  });
  assert.equal(report.verdict, "PASS");
  assert.equal(report.buyEnabled, false);
  assert.equal(gate(report.gates, "live-quote").verdict, "PASS");
  assert.equal(gate(report.gates, "execution-adapter").verdict, "FAIL");
  assert.match(report.summary, /Buy stays closed/);

  const routeCall = seen.find((s) => s.url === SQUID_V2.route);
  assert.ok(routeCall, "route requested once catalogs pass");
  assert.equal(routeCall.method, "POST");
  assert.deepEqual(routeCall.body, {
    fromAddress: "0x000000000000000000000000000000000000dEaD",
    toAddress: "0x000000000000000000000000000000000000dEaD",
    fromChain: SRC,
    fromToken: BASE_SEPOLIA_SOURCE.usdc,
    fromAmount: "1000000",
    toChain: DEST,
    toToken: C.quoteAddress,
    quoteOnly: true,
  });
  assert.ok(!JSON.stringify(report).includes("0xdead"), "transactionRequest never leaks into the report");
  assert.equal(evidence.squid.quote.attempted, true);

  const reviewed = evaluateBaseSepoliaCorridor(evidence, { enabled: true, reason: "REVIEWED_FIXTURE" });
  assert.equal(reviewed.buyEnabled, true);
  assert.equal(reviewed.verdict, "PASS");
});

test("quote landing a different RLUSD contract never passes", async () => {
  const { report } = await probeBaseSepoliaCorridor({
    integratorId: "fixture",
    fetchImpl: mockFetch(
      passingRoutes({ route: { estimate: { toAmount: "1", toToken: { address: OTHER_TEST_RLUSD, chainId: DEST } } } }),
      []
    ),
  });
  assert.equal(gate(report.gates, "live-quote").verdict, "FAIL");
  assert.match(gate(report.gates, "live-quote").detail, /Quote mismatch/);
  assert.equal(report.verdict, "FAIL");
  assert.equal(report.buyEnabled, false);
});

test("zero-amount quote never passes", async () => {
  const { report } = await probeBaseSepoliaCorridor({
    integratorId: "fixture",
    fetchImpl: mockFetch(passingRoutes({ route: { estimate: { toAmount: "0", toToken: { address: C.quoteAddress, chainId: DEST } } } }), []),
  });
  assert.equal(report.verdict, "FAIL");
});

function catalogPassEvidence(quote: CorridorEvidence["squid"]["quote"], its: CorridorEvidence["axelar"]["itsAssets"] = { ok: true, status: 200, value: [] }): CorridorEvidence {
  return {
    fetchedAt: new Date(0).toISOString(),
    squid: {
      integrator: "public-probe",
      chains: { ok: true, status: 200, value: [SRC, DEST] },
      sourceTokens: { ok: true, status: 200, value: [BASE_SEPOLIA_SOURCE.usdc.toLowerCase()] },
      destTokens: { ok: true, status: 200, value: [C.quoteAddress.toLowerCase()] },
      quote,
    },
    axelar: {
      chains: { ok: true, status: 200, value: [{ id: "base-sepolia", chainId: SRC }, { id: "xrpl-evm", chainId: DEST }] },
      itsAssets: its,
      gatewayAssets: { ok: true, status: 200, value: [] },
    },
    lifi: { chains: { ok: true, status: 200, value: [84532] } },
    calls: [],
  };
}

test("Squid schema rejection is definitive FAIL; throttling is HOLD", () => {
  const rejected = evaluateBaseSepoliaCorridor(
    catalogPassEvidence({ attempted: true, ok: false, status: 400, error: "HTTP 400 fromChain: 84532 unsupported chain id", definitive: true })
  );
  assert.equal(rejected.verdict, "FAIL");
  const throttled = evaluateBaseSepoliaCorridor(
    catalogPassEvidence({ attempted: true, ok: false, status: 429, error: "HTTP 429 Too many requests", definitive: false })
  );
  assert.equal(throttled.verdict, "HOLD");
  assert.equal(throttled.buyEnabled, false);
});

test("exact Axelar ITS asset on both chains is a HOLD (manual bridge), not a PASS", () => {
  const report = evaluateBaseSepoliaCorridor(
    catalogPassEvidence({ attempted: true, ok: false, status: 400, error: "rejected", definitive: true }, {
      ok: true,
      status: 200,
      value: [{ symbol: "RLUSD", name: "Ripple USD", chains: { "base-sepolia": "0x1111111111111111111111111111111111111111", "xrpl-evm": C.quoteAddress } }],
    })
  );
  assert.equal(gate(report.gates, "native-bridge-asset").verdict, "PASS");
  assert.equal(report.verdict, "HOLD");
  assert.equal(report.buyEnabled, false);
});

test("corridor identity is pinned to the console profile", () => {
  assert.equal(BASE_SEPOLIA_SOURCE.chainId, 84532);
  assert.equal(BASE_SEPOLIA_SOURCE.usdc, "0x036CbD53842c5426634e7929541eC2318f3dCF7e");
  assert.equal(C.chainId, 1449000);
  assert.equal(C.quoteAddress, "0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F");
});
