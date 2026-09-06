import test from "node:test";
import assert from "node:assert/strict";
import { parseIntent, stripProductMention } from "../src/lib/chatIntent.js";

test("strips product mentions anywhere in the text", () => {
  assert.equal(
    stripProductMention("first ping @graav_xyz — buy $gSWAP 0.1"),
    "first ping — buy $gSWAP 0.1"
  );
  assert.equal(stripProductMention("@graav BUY $MOMENT 1"), "BUY $MOMENT 1");
});

for (const text of [
  "@graav_xyz BUY $gSWAP 0.1",
  "hey @graav_xyz BUY $gSWAP 0.1",
  "@graav_xyz first ping. Attention moves markets — BUY $gSWAP 0.1",
  "first ping @graav_xyz BUY $MOMENT 1 please",
]) {
  test(`parses prose-wrapped buy: ${text}`, () => {
    const plan = parseIntent(text);
    assert.equal(plan.kind, "buy");
    assert.ok(plan.sessionBody);
    assert.equal(plan.sessionBody?.action, text.includes("$MOMENT") ? "buy" : "swap");
  });
}

test("does not invent a session for malformed or garbage text", () => {
  assert.equal(parseIntent("@graav_xyz BUY $gSWAP").kind, "unknown");
  assert.equal(parseIntent("some unrelated garbage").kind, "unknown");
  assert.equal(parseIntent("BUY $not-known 0.1").sessionBody, undefined);
});

test("extracts other commands from surrounding prose", () => {
  assert.equal(parseIntent("hey @graav_xyz, portfolio please").kind, "portfolio");
  assert.equal(parseIntent("please CREATE $newcoin when ready").kind, "launch");
});
