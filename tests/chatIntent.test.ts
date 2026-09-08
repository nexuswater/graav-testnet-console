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
    assert.equal(plan.sessionBody, undefined);
    assert.match(plan.reply, /not configured/i);
  });
}

test("Coin aliases stay unavailable until the new clone has a Moment market", () => {
  for (const alias of ["MOMENT", "MRLUSD", "COIN"]) {
    const known = resolveKnown(alias);
    assert.equal(known, null);
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
