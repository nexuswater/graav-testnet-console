import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent, resolveKnown, stripProductMention } from "../src/lib/chatIntent.js";

test("strips product mentions anywhere in the text", () => {
  assert.equal(
    stripProductMention("first ping @graav_xyz — buy $gSWAP 0.1"),
    "first ping — buy $gSWAP 0.1"
  );
  assert.equal(stripProductMention("@graav BUY $MOMENT 1"), "BUY $MOMENT 1");
});

for (const text of [
  "first ping @graav_xyz BUY $MOMENT 1 please",
  "@graav_xyz BUY $MRLUSD 0.1",
  "hey @graav_xyz BUY $COIN 2",
]) {
  test(`parses prose-wrapped buy: ${text}`, () => {
    const plan = parseIntent(text);
    assert.equal(plan.kind, "buy");
    assert.ok(plan.sessionBody);
    assert.equal(plan.sessionBody?.action, "buy");
    assert.equal(plan.sessionBody?.factory, "0x2E393cfabeC866a38632b8C486B942089644dE93");
    assert.equal(plan.sessionBody?.market, "0x376D4e428E25A403A3fA5cC122D1910f97B2B712");
    assert.equal(plan.sessionBody?.token, "0xe6A44F18A8375A3a1F3d01904C6e3001D7958A8e");
  });
}

test("Coin aliases resolve to the RLUSD clone, not X1/M22", () => {
  for (const alias of ["MOMENT", "MRLUSD", "COIN"]) {
    const known = resolveKnown(alias);
    assert.ok(known);
    assert.equal(known?.symbol, "MOMENT");
    assert.equal(known?.graduated, false);
    assert.equal(known?.factory, "0x2E393cfabeC866a38632b8C486B942089644dE93");
  }
});

test("legacy gSWAP remains explicit graduated swap", () => {
  const plan = parseIntent("BUY $gSWAP 0.1");
  assert.equal(plan.sessionBody?.action, "swap");
  assert.equal(plan.sessionBody?.factory, "0x8f2D4E36ec0Ef2e55e0073830C22C8f863D89076");
});

test("does not invent a session for malformed or garbage text", () => {
  assert.equal(parseIntent("@graav_xyz BUY $gSWAP").kind, "unknown");
  assert.equal(parseIntent("some unrelated garbage").kind, "unknown");
  assert.equal(parseIntent("BUY $not-known 0.1").sessionBody, undefined);
});

test("extracts other commands from surrounding prose", () => {
  assert.equal(parseIntent("hey @graav_xyz, portfolio please").kind, "portfolio");
  assert.equal(parseIntent("please CREATE $newcoin when ready").kind, "launch");
});
