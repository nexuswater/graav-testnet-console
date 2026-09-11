import test from "node:test";
import assert from "node:assert/strict";
import {
  COVERAGE_FIXTURES,
  countCashtags,
  fixtureAsMention,
  originTweetIdFor,
  planMentionCoverage,
  summarizeCoverage,
} from "../src/lib/xCronCoverage.js";
import { processReplySession, runCoverageFixtures } from "../src/lib/xReplySessionServer.js";
import { decodeSessionId } from "../src/lib/signingSessionServer.js";
import { sourcePostIdFromInput } from "../src/lib/rlusd-v1/createCoin.js";
import { RLUSD_CLONE_FACTORY_ADDRESS } from "../src/lib/sessionAllowlist.js";
import { FACTORY_ADDRESS, M22_FACTORY_ADDRESS, TEST_DEX_V2_ADDRESS } from "../src/lib/chain.js";

const ORIGIN = "https://graav.xyz";

test("buy $g589 from a mention is READY on the M2 curve with reply + origin bound", () => {
  const row = planMentionCoverage("@graav_xyz buy $g589 0.1", { mentionId: "1001" });
  assert.equal(row.intent, "buy");
  assert.equal(row.status, "READY");
  assert.equal(row.liveReady, true);
  assert.equal(row.sessionInput?.action, "buy");
  assert.equal(row.sessionInput?.factory, FACTORY_ADDRESS);
  assert.equal(row.sessionInput?.amount, "0.1");
  assert.equal(row.bind.replyTweetId, "1001");
  assert.equal(row.bind.originTweetId, "1001");
});

test("buy $gSWAP routes to the V2 swap on M2.2 (dual-factory unchanged)", () => {
  const row = planMentionCoverage("@graav_xyz buy $gSWAP 0.1", { mentionId: "1002" });
  assert.equal(row.status, "READY");
  assert.equal(row.sessionInput?.action, "swap");
  assert.equal(row.sessionInput?.factory, M22_FACTORY_ADDRESS);
  assert.equal(row.sessionInput?.dex, TEST_DEX_V2_ADDRESS);
  assert.equal(row.sessionInput?.swapSide, "xrpToToken");
  assert.match(row.rail, /V2/);
});

test("sell 1 $g589 is READY; percent sell and graduated sell stay BLOCKED", () => {
  const ok = planMentionCoverage("@graav_xyz sell 1 $g589", { mentionId: "1003" });
  assert.equal(ok.status, "READY");
  assert.equal(ok.sessionInput?.action, "sell");
  assert.equal(ok.sessionInput?.amount, "1");

  const pct = planMentionCoverage("@graav_xyz sell 50% $g589", { mentionId: "1004" });
  assert.equal(pct.status, "BLOCKED");
  assert.equal(pct.sessionInput, null);
  assert.match(pct.reason, /concrete/i);

  const grad = planMentionCoverage("@graav_xyz sell 1 $gSWAP", { mentionId: "1005" });
  assert.equal(grad.status, "BLOCKED");
  assert.match(grad.reason, /graduated/i);
});

test("launch $TICKER is SOFT_READY: Coin V1 factory, originHash == sourcePostId, never liveReady", () => {
  const row = planMentionCoverage("@graav_xyz launch $HORMUZ", { mentionId: "2001" });
  assert.equal(row.intent, "create");
  assert.equal(row.status, "SOFT_READY");
  assert.equal(row.liveReady, false);
  assert.equal(row.sessionInput?.action, "create");
  assert.equal(row.sessionInput?.factory, RLUSD_CLONE_FACTORY_ADDRESS);
  assert.equal(row.sessionInput?.createSymbol, "HORMUZ");
  assert.equal(row.sessionInput?.createName, "HORMUZ");
  assert.equal(row.bind.originTweetId, "2001");
  assert.equal(row.bind.replyTweetId, "2001");
  assert.equal(row.bind.originHash, sourcePostIdFromInput("2001"));
  assert.equal(row.sessionInput?.originHash, row.bind.originHash);
  assert.match(row.rail, /LaunchAuthorizer/);
});

test("create needs an origin post; bad tickers are refused with the parser reason", () => {
  const noOrigin = planMentionCoverage("launch $HORMUZ");
  assert.equal(noOrigin.status, "BLOCKED");
  assert.equal(noOrigin.sessionInput, null);
  assert.match(noOrigin.reason, /origin post/i);

  const bad = planMentionCoverage("@graav_xyz launch $1bad", { mentionId: "2002" });
  assert.equal(bad.intent, "create");
  assert.equal(bad.status, "BLOCKED");
  assert.match(bad.reason, /bad ticker/i);
});

test("MOMENT / mRLUSD / COIN stay BLOCKED until the first Moment market exists", () => {
  for (const text of ["@graav_xyz buy $MOMENT 1", "@graav_xyz sell 1 $MOMENT", "@graav_xyz buy $COIN 2", "@graav_xyz buy $MRLUSD 0.1"]) {
    const row = planMentionCoverage(text, { mentionId: "3001" });
    assert.equal(row.status, "BLOCKED", text);
    assert.equal(row.sessionInput, null, text);
    assert.equal(row.liveReady, false, text);
    assert.match(row.reason, /Coin V1 Moment market not configured/i, text);
  }
});

test("fail-closed on tags: exactly one cashtag on X; portfolio and garbage are SKIP", () => {
  const two = planMentionCoverage("@graav_xyz buy $g589 0.1 $gSWAP", { mentionId: "4001" });
  assert.equal(two.status, "BLOCKED");
  assert.equal(two.cashtags, 2);
  assert.equal(two.sessionInput, null);

  const none = planMentionCoverage("@graav_xyz buy g589 0.1", { mentionId: "4002" });
  assert.equal(none.status, "BLOCKED");
  assert.equal(none.cashtags, 0);
  assert.match(none.reason, /cashtag/i);

  assert.equal(planMentionCoverage("@graav_xyz portfolio", { mentionId: "4003" }).status, "SKIP");
  assert.equal(planMentionCoverage("@graav_xyz gm", { mentionId: "4004" }).status, "SKIP");
  assert.equal(planMentionCoverage("", { mentionId: "4005" }).status, "SKIP");
  assert.equal(countCashtags("$a $b $c"), 3);
});

test("origin bind rule: quoted > replied_to > self (conversation_id never used)", () => {
  assert.equal(originTweetIdFor({ id: "9", conversation_id: "1" }), "9");
  assert.equal(originTweetIdFor({ id: "9", conversation_id: "1", referenced_tweets: [{ type: "replied_to", id: "5" }] }), "5");
  assert.equal(originTweetIdFor({ id: "9", referenced_tweets: [{ type: "replied_to", id: "5" }, { type: "quoted", id: "7" }] }), "7");
  assert.equal(originTweetIdFor({ id: "9", referenced_tweets: [{ type: "retweeted", id: "5" }] }), "9");

  const reply = planMentionCoverage("@graav_xyz buy $g589 0.1", { mentionId: "9", originTweetId: originTweetIdFor({ id: "9", referenced_tweets: [{ type: "replied_to", id: "5" }] }) });
  assert.equal(reply.bind.originTweetId, "5");
  assert.equal(reply.bind.replyTweetId, "9");
  assert.equal(reply.sessionInput?.originTweetId, "5");
  assert.equal(reply.sessionInput?.replyTweetId, "9");
});

test("canonical fixtures cover buy / sell / create / MOMENT and all match expectations", () => {
  const scopes = new Set(COVERAGE_FIXTURES.map((f) => f.scope));
  for (const scope of ["buy", "sell", "create", "MOMENT"]) assert.equal(scopes.has(scope as never), true, scope);
  for (const fixture of COVERAGE_FIXTURES) assert.doesNotMatch(fixture.mentionId, /^\d+$/, "fixture ids must not look like real post ids");

  const matrix = runCoverageFixtures(ORIGIN);
  assert.equal(matrix.allPass, true, JSON.stringify(matrix.rows.filter((r) => !r.pass), null, 2));
  assert.equal(matrix.summary.total, COVERAGE_FIXTURES.length);
  assert.ok(matrix.summary.READY >= 4);
  assert.ok(matrix.summary.SOFT_READY >= 2);
  assert.ok(matrix.summary.BLOCKED >= 5);
  assert.ok(matrix.summary.SKIP >= 2);
  assert.equal(matrix.summary.liveReady, matrix.summary.READY);

  for (const row of matrix.rows) {
    if (row.status === "READY" || row.status === "SOFT_READY") {
      assert.ok(row.session?.url.startsWith(`${ORIGIN}/s/s1.`), row.fixture);
      const decoded = decodeSessionId(row.session!.id);
      assert.equal(decoded.ok, true, row.fixture);
      if (decoded.ok) {
        assert.equal(decoded.payload.replyTweetId, row.mentionId);
        assert.equal(decoded.payload.originTweetId, row.bind.originTweetId);
        assert.ok(decoded.payload.expiry - Math.floor(Date.now() / 1000) <= 60, "fixture TTL is short");
      }
    } else {
      assert.equal(row.session, null, row.fixture);
    }
  }
  const quoteRt = matrix.rows.find((r) => r.fixture === "create-quote-rt");
  assert.equal(quoteRt?.bind.originTweetId, "fixture-quoted-post");
  assert.equal(quoteRt?.bind.replyTweetId, "fixture-create-qrt");
  const replyBuy = matrix.rows.find((r) => r.fixture === "buy-reply");
  assert.equal(replyBuy?.bind.originTweetId, "fixture-creator-post");
});

test("fixture mentions carry referenced_tweets like the X API", () => {
  const qrt = COVERAGE_FIXTURES.find((f) => f.id === "create-quote-rt")!;
  const mention = fixtureAsMention(qrt);
  assert.equal(mention.referenced_tweets?.[0]?.type, "quoted");
  assert.equal(originTweetIdFor(mention), "fixture-quoted-post");
  assert.equal(summarizeCoverage([{ status: "READY", liveReady: true }, { status: "SKIP", liveReady: false }]).liveReady, 1);
});

test("reply-session dry-run never posts and reports coverage; create stays dry-run even with dryRun:false", async () => {
  delete process.env.FEATURE_PUBLIC_X_WRITE;
  const buy = await processReplySession({ mentionId: "5001", text: "@graav_xyz buy $g589 0.1" }, ORIGIN);
  assert.equal(buy.productHandle, "@graav_xyz");
  assert.equal(buy.featurePublicXWrite, false);
  assert.equal(buy.coverage.status, "READY");
  assert.ok(buy.session?.url.startsWith(`${ORIGIN}/s/`));
  assert.equal(buy.xReply.posted, false);
  assert.equal(buy.xReply.dryRun, true);
  assert.match(buy.xReply.reason || "", /dryRun/);
  assert.match(buy.replyText || "", /chat ≠ auth/);

  const create = await processReplySession({ mentionId: "5002", text: "@graav_xyz launch $HORMUZ", dryRun: false }, ORIGIN);
  assert.equal(create.coverage.status, "SOFT_READY");
  assert.equal(create.coverage.liveReady, false);
  assert.ok(create.session?.url);
  assert.equal(create.xReply.posted, false);
  assert.match(create.xReply.reason || "", /FEATURE_PUBLIC_X_WRITE/);
  assert.match(create.xReply.reason || "", /SOFT_READY/);

  const moment = await processReplySession({ mentionId: "5003", text: "@graav_xyz buy $MOMENT 1", dryRun: false }, ORIGIN);
  assert.equal(moment.coverage.status, "BLOCKED");
  assert.equal(moment.session, null);
  assert.match(moment.sessionError || "", /Moment market not configured/);
  assert.equal(moment.xReply.posted, false);
});

test("write stays closed by default even when a caller asks to post", async () => {
  delete process.env.FEATURE_PUBLIC_X_WRITE;
  delete process.env.X_BOT_USER_ACCESS_TOKEN;
  delete process.env.X_PRODUCT_ACCESS_TOKEN;
  const result = await processReplySession({ mentionId: "6001", text: "@graav_xyz buy $g589 0.1", dryRun: false }, ORIGIN);
  assert.equal(result.xReply.posted, false);
  assert.equal(result.xReply.dryRun, true);
  assert.match(result.xReply.reason || "", /FEATURE_PUBLIC_X_WRITE is false/);
});

test("with the gate simulated open, only READY rows reach X; SOFT_READY create and BLOCKED MOMENT never post", async () => {
  const realFetch = globalThis.fetch;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, body: JSON.parse(String(init?.body || "{}")) as Record<string, unknown> });
    return new Response(JSON.stringify({ data: { id: "reply-777" } }), { status: 201, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  process.env.FEATURE_PUBLIC_X_WRITE = "true";
  process.env.X_BOT_USER_ACCESS_TOKEN = "test-only-product-token";
  try {
    const create = await processReplySession({ mentionId: "7001", text: "@graav_xyz launch $HORMUZ", dryRun: false }, ORIGIN);
    assert.equal(create.coverage.status, "SOFT_READY");
    assert.equal(create.xReply.posted, false);
    assert.match(create.xReply.reason || "", /SOFT_READY/);
    assert.equal(calls.length, 0, "create must never hit X");

    const moment = await processReplySession({ mentionId: "7002", text: "@graav_xyz buy $MOMENT 1", dryRun: false }, ORIGIN);
    assert.equal(moment.xReply.posted, false);
    assert.equal(calls.length, 0, "MOMENT must never hit X");

    const dry = await processReplySession({ mentionId: "7003", text: "@graav_xyz buy $g589 0.1" }, ORIGIN);
    assert.equal(dry.xReply.posted, false);
    assert.equal(calls.length, 0, "default dryRun must never hit X");

    const buy = await processReplySession({ mentionId: "7004", text: "@graav_xyz buy $g589 0.1", dryRun: false, originTweetId: "7000" }, ORIGIN);
    assert.equal(buy.coverage.status, "READY");
    assert.equal(buy.xReply.posted, true);
    assert.equal(buy.xReply.tweetId, "reply-777");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/2\/tweets$/);
    assert.deepEqual(calls[0].body.reply, { in_reply_to_tweet_id: "7004" });
    const text = String(calls[0].body.text);
    assert.match(text, /^Sign here \(wallet only · chat ≠ auth\): https:\/\/graav\.xyz\/s\/s1\./);
    assert.equal(countCashtags(text), 0, "reply body is URL-only");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.FEATURE_PUBLIC_X_WRITE;
    delete process.env.X_BOT_USER_ACCESS_TOKEN;
  }
});
