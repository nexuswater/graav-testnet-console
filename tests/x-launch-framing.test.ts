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
