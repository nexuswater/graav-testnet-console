import test from "node:test";
import assert from "node:assert/strict";
import { resolveTheme } from "../src/lib/theme.js";
import {
  resolveConfiguredMarket,
  tipMarketAvailability,
  registryRowAvailability,
} from "../src/lib/rlusd-v1/availability.js";
import { RLUSD_V1 as C } from "../src/lib/rlusd-v1/config.js";
import { buildCreateCoinParams, launchDigest, LAUNCH_TYPEHASH } from "../src/lib/rlusd-v1/createCoin.js";
import { formatKnownAmount } from "../src/lib/rlusd-v1/format.js";
import { RLUSD_MARKET_REGISTRY } from "../src/lib/rlusd-v1/marketRegistry.js";
import { createMockBuy, executeMockBuy, quoteMock } from "../src/lib/rlusd-v1/mockMarket.js";
import { supplyAllocation } from "../src/lib/rlusd-v1/model.js";

test("null zero and mismatched addresses are not configured", () => {
  assert.equal(resolveConfiguredMarket({}).ok, false);
  assert.equal(resolveConfiguredMarket({
    factoryAddress: C.factoryAddress,
    quoteAddress: C.quoteAddress,
    coinAddress: null,
    curveAddress: null,
  }).ok, false);
  assert.equal(resolveConfiguredMarket({
    factoryAddress: C.factoryAddress,
    quoteAddress: C.quoteAddress,
    coinAddress: "0x0000000000000000000000000000000000000000",
    curveAddress: "0x1111111111111111111111111111111111111111",
  }).ok, false);
  assert.equal(resolveConfiguredMarket({
    factoryAddress: C.factoryAddress,
    quoteAddress: C.quoteAddress,
    coinAddress: C.quoteAddress,
    curveAddress: "0x1111111111111111111111111111111111111111",
  }).ok, false);
});

test("tip market stays unconfigured until coin and curve exist", () => {
  const tip = tipMarketAvailability();
  assert.equal(tip.state, "unconfigured");
  assert.equal(C.coinAddress, null);
  assert.equal(C.curveAddress, null);
});

test("registry rows are not launched and never look live", () => {
  for (const market of RLUSD_MARKET_REGISTRY) {
    assert.notEqual(market.status, "fixture");
    const availability = registryRowAvailability(market);
    assert.equal(availability.state, "unconfigured");
  }
});

test("unknown amounts stay unknown", () => {
  assert.equal(formatKnownAmount(undefined), "—");
  assert.equal(formatKnownAmount(null), "—");
  assert.equal(formatKnownAmount(0n), "0");
});

test("mock financial success is closed", () => {
  assert.equal(quoteMock(100n).live, false);
  assert.equal(quoteMock(100n).tokensOut, null);
  assert.throws(() => createMockBuy("demo-moment-2026", 1n, null), /MOCK_FINANCIAL_SUCCESS_CLOSED/);
  assert.throws(() => executeMockBuy("x"), /MOCK_FINANCIAL_SUCCESS_CLOSED/);
});

test("createCoin params conserve 1B allocation and hash a digest", () => {
  const params = buildCreateCoinParams({
    sourcePost: "https://x.com/graav/status/1",
    name: "Moment",
    symbol: "MOMENT",
    issuer: "0x1111111111111111111111111111111111111111",
    nowSec: 1_700_000_000,
  });
  const alloc = supplyAllocation(0);
  assert.equal(params.curveTokens + params.lpTokens, alloc.total);
  assert.equal(LAUNCH_TYPEHASH.startsWith("0x"), true);
  assert.equal(launchDigest(params).length, 66);
});

test("theme resolution honors system preference", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("dark", true), "dark");
  assert.equal(resolveTheme("system", true), "light");
  assert.equal(resolveTheme("system", false), "dark");
});
