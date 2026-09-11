import test from "node:test";
import assert from "node:assert/strict";
import {
  GRAAV_X_HANDLE_AT,
  LAUNCH_EXAMPLE_TICKER,
  isValidLaunchTicker,
  launchComposerText,
  launchPostIntentUrl,
  launchQuoteRtUrl,
  sanitizeLaunchTicker,
  seedAmountDisplay,
} from "../src/lib/xLaunchComposer.js";
import {
  ATTRIBUTION_V1,
  ATTRIBUTION_V1_LINE,
  CROSS_CHAIN_TESTNET_ORDER,
  KERNEL_LAB_REF,
} from "../src/lib/xPrimary.js";

test("attribution V1 copy sums and locks", () => {
  assert.equal(ATTRIBUTION_V1.creator + ATTRIBUTION_V1.protocol + ATTRIBUTION_V1.distributor, 100);
  assert.equal(ATTRIBUTION_V1.hopOfDistributor.reduce((a, b) => a + b, 0), 100);
  assert.equal(ATTRIBUTION_V1.hopOfDistributor.length, ATTRIBUTION_V1.depth);
  assert.equal(ATTRIBUTION_V1.missingHop, "protocol");
  assert.equal(ATTRIBUTION_V1.payOnce, true);
  assert.match(ATTRIBUTION_V1_LINE, /original poster/);
  assert.match(KERNEL_LAB_REF.selector, /^0x[0-9a-f]{8}$/);
  assert.equal(KERNEL_LAB_REF.forge, "20/20");
});

test("cross-chain testnet order is home first, Base only wired, rest deferred", () => {
  assert.equal(CROSS_CHAIN_TESTNET_ORDER[0]?.stage, "home");
  assert.match(CROSS_CHAIN_TESTNET_ORDER[0]?.label ?? "", /1449000/);
  assert.equal(CROSS_CHAIN_TESTNET_ORDER[1]?.stage, "first");
  assert.match(CROSS_CHAIN_TESTNET_ORDER[1]?.label ?? "", /Base Sepolia/);
  assert.match(CROSS_CHAIN_TESTNET_ORDER[2]?.label ?? "", /Arbitrum/);
  assert.equal(CROSS_CHAIN_TESTNET_ORDER[2]?.stage, "deferred");
  assert.equal(CROSS_CHAIN_TESTNET_ORDER[3]?.stage, "deferred");
});

test("Launch composer is X-first and never promotes g589 or MOMENT", () => {
  assert.equal(LAUNCH_EXAMPLE_TICKER, "HORMUZ");
  assert.equal(GRAAV_X_HANDLE_AT, "@graav_xyz");
  const text = launchComposerText("hormuz");
  assert.match(text, /Launch \$HORMUZ/);
  assert.match(text, /@graav_xyz/);
  assert.doesNotMatch(text, /g589/i);
  assert.doesNotMatch(text, /MOMENT/i);
});

test("Launch composer URL is intent-only (no write rail)", () => {
  const url = launchPostIntentUrl("hormuz");
  assert.equal(url.startsWith("https://x.com/intent/post?text="), true);
  assert.equal(launchQuoteRtUrl(), "https://x.com");
  assert.equal(url.includes("tweet.write"), false);
});

test("ticker hygiene matches Launch input", () => {
  assert.equal(sanitizeLaunchTicker("$hormuz!!"), "HORMUZ");
  assert.equal(isValidLaunchTicker("HORMUZ"), true);
  assert.equal(isValidLaunchTicker(""), false);
  assert.equal(isValidLaunchTicker("1BAD"), false);
});

test("optional seed is review copy only", () => {
  assert.equal(seedAmountDisplay(""), "None (optional)");
  assert.equal(seedAmountDisplay("25"), "25 Test RLUSD");
});
