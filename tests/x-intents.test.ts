import test from "node:test";
import assert from "node:assert/strict";
import {
  launchDmUrl,
  parseXPostUrl,
  portfolioCommandText,
  tradeCommandText,
  tradeDmUrl,
  tradePostIntentUrl,
  xDmDeepLinkAvailable,
  xDmUrl,
  xPostIntentUrl,
  xQuoteIntentUrl,
  xReplyIntentUrl,
} from "../src/lib/xLaunchComposer.js";
import { parseIntent } from "../src/lib/chatIntent.js";

test("every X CTA is an x.com composer URL — never an API write", () => {
  for (const url of [
    xPostIntentUrl("hello"),
    xQuoteIntentUrl("hello", "https://x.com/a/status/1"),
    xReplyIntentUrl("hello", "1"),
    xDmUrl("hello", "42"),
    xDmUrl("hello", ""),
    tradePostIntentUrl("buy", "gSWAP", "0.1"),
    tradeDmUrl("sell", "gSWAP", "10"),
    launchDmUrl("hormuz"),
  ]) {
    assert.match(url, /^https:\/\/x\.com\//);
    assert.doesNotMatch(url, /api\.x\.com|api\.twitter\.com|tweet\.write|dm\.write/);
  }
});

test("reply and quote intents target the given post", () => {
  assert.equal(
    xReplyIntentUrl("@graav_xyz buy $gSWAP 0.1", "1234"),
    "https://x.com/intent/post?in_reply_to=1234&text=%40graav_xyz%20buy%20%24gSWAP%200.1",
  );
  assert.match(xQuoteIntentUrl("x", "https://x.com/a/status/9"), /&url=https%3A%2F%2Fx\.com%2Fa%2Fstatus%2F9$/);
});

test("DM CTA deep-links only with a numeric product id, otherwise opens the profile", () => {
  assert.equal(xDmDeepLinkAvailable("123"), true);
  assert.equal(xDmDeepLinkAvailable(""), false);
  assert.equal(xDmDeepLinkAvailable("not-a-number"), false);
  assert.equal(xDmUrl("hi there", "123"), "https://x.com/messages/compose?recipient_id=123&text=hi%20there");
  assert.equal(xDmUrl("hi there", ""), "https://x.com/graav_xyz");
});

test("trade commands use the grammar Chat and the mention bot already parse", () => {
  assert.equal(tradeCommandText("buy", "$gSWAP", "0.1"), "@graav_xyz buy $gSWAP 0.1");
  assert.equal(tradeCommandText("sell", "gSWAP", "10"), "@graav_xyz sell 10 $gSWAP");
  assert.equal(tradeCommandText("buy", "gSWAP", ""), "@graav_xyz buy $gSWAP 0.1");
  assert.equal(portfolioCommandText(), "@graav_xyz portfolio");

  const buy = parseIntent(tradeCommandText("buy", "gSWAP", "0.1"));
  assert.equal(buy.kind, "buy");
  assert.equal(buy.handoff?.prefill?.buyXrp, "0.1");
  const sell = parseIntent(tradeCommandText("sell", "gSWAP", "10"));
  assert.equal(sell.kind, "sell");
  assert.equal(sell.handoff?.prefill?.sellAmount, "10");
  assert.equal(parseIntent(portfolioCommandText()).kind, "portfolio");
});

test("X post links parse to a numeric id; anything else is rejected", () => {
  assert.deepEqual(parseXPostUrl("https://x.com/graav_xyz/status/1234567890?s=20"), {
    url: "https://x.com/graav_xyz/status/1234567890",
    id: "1234567890",
  });
  assert.equal(parseXPostUrl("https://twitter.com/a_b/status/42")?.id, "42");
  assert.equal(parseXPostUrl("1234567890"), null);
  assert.equal(parseXPostUrl("https://example.com/status/1"), null);
  assert.equal(parseXPostUrl(""), null);
});
