import test from "node:test";
import assert from "node:assert/strict";
import { formatPrice, formatTokenAmount, poolPrice } from "../src/lib/formatNumber.js";

test("token amounts read cleanly and unknown stays unknown", () => {
  assert.equal(formatTokenAmount(undefined), "—");
  assert.equal(formatTokenAmount(null), "—");
  assert.equal(formatTokenAmount(0n), "0");
  assert.equal(formatTokenAmount(810805901643901763621062n), "810,805.9016");
  assert.equal(formatTokenAmount(1_500_000_000_000_000_000n), "1.5");
  assert.equal(formatTokenAmount(123_456_789_012_345n), "0.000123457");
});

test("prices never render a misleading 0.000", () => {
  assert.equal(formatPrice(0), "—");
  assert.equal(formatPrice(null), "—");
  assert.equal(formatPrice(Number.NaN), "—");
  assert.equal(formatPrice(0.00000012345), "0.0000001235");
  assert.equal(formatPrice(1.23456), "1.235");
});

test("pool price derives quote-per-token from reserves and refuses empty pools", () => {
  assert.equal(poolPrice(undefined, 1n), null);
  assert.equal(poolPrice(1n, 0n), null);
  const price = poolPrice(2_000_000_000_000_000_000n, 4_000_000_000_000_000_000n);
  assert.equal(price, 0.5);
});
