# @graav_xyz cron coverage matrix — 2026-09-11

Origin SoT for `josh-xrpl/graav-testnet-console` · Josh/Exec OVERNIGHT slice. Extends `AUTO_MENTION_REPLY_2026-09-06.md` and preserves the X-primary framing in `X_PRIMARY_ARCHITECTURE_2026-09-10.md` (main / PR #4).

**No live X write. `FEATURE_PUBLIC_X_WRITE` stays CLOSED. No Production deploy. No tip remint. No invented cross-chain routes.**

## Spine

```
X post / mention / DM  →  parseIntent  →  planMentionCoverage  →  /api/s (HMAC /s/{id})  →  wallet signs
                              ↑ same parser as Chat            ↑ fail-closed dual-factory allowlist
```

- Chat ≠ authorization. Tweets, reposts, and DMs never send txs. GRAAV only ever hands back a `/s/{id}` URL.
- Write identity is **`@graav_xyz`** (`X_PRODUCT_USER_ID` must equal `2094147928965468160`). There is no `@Josh_XRPL` fallback anywhere in the cron.
- The cron never claims, never posts, and never touches the mention store while the write gate is CLOSED.

## Cron modes (`/api/cron/x-auto-reply`, Vercel schedule `*/2 * * * *`, `CRON_SECRET` required)

| Mode | Trigger | X read | /s mint | Claim store | Post reply |
| --- | --- | --- | --- | --- | --- |
| **dry-run (auto)** | write gate CLOSED (`FEATURE_PUBLIC_X_WRITE` false **or** no product token) | yes (mentions, max 5) | yes — every READY / SOFT_READY row | no | **no** |
| **dry-run (forced)** | `?dryRun=1` | yes | yes | no | **no** |
| **fixtures** | `?fixtures=1` | **no** — canonical buy / sell / create / MOMENT rows | yes, TTL 60 s | no | **no** |
| **live** | gate OPEN and neither flag set | yes | READY rows only | atomic claim | yes — READY rows only (`liveReady`) |

Before this slice the cron ran `dryRun:false` unconditionally: with the gate closed it claimed each actionable mention and marked it `failed` every two minutes. Now the gate decides the mode, so nothing is claimed or marked while write is CLOSED.

Response (all modes): `mode`, `source`, `dryRunWhy[]`, `writeGate`, `productIdLock`, `summary` (`fetched / claimed / posted / skipped / failed` + `READY / SOFT_READY / BLOCKED / SKIP / liveReady`), `rows[]` (per-mention coverage view + dry-run `session` when minted), `errors[]`. Tokens are never returned.

Unauthenticated matrix (no X read, no post): `GET /api/x/coverage`. The X tab renders the same rows under **Cron coverage matrix**.

## Status legend

| Status | Meaning | Live reply once the flag opens? |
| --- | --- | --- |
| `READY` | `/s` mints and the wallet can sign it today (M2 curve buy / sell, TestDex V2 swap) | **yes** (`liveReady=true`) |
| `SOFT_READY` | `/s` mints with `originTweetId` + `replyTweetId` (+ `originHash`) bound; the wallet rail is not signable yet | **no** — dry-run mint only |
| `BLOCKED` | parsed intent refused fail-closed | no |
| `SKIP` | no mint intent (portfolio / help / garbage) | no |

## Coverage matrix

| Scope | X text (fixture) | Intent → `/s` action | Rail | Status | Bind (`originTweetId` / `replyTweetId`) | Opens with |
| --- | --- | --- | --- | --- | --- | --- |
| **buy** | `@graav_xyz buy $g589 0.1` | buy → `buy` | M2 `0x72be…276B` curve `buy(minOut)` payable, `graduated()==false` | `READY` | mention / mention | `FEATURE_PUBLIC_X_WRITE=true` + `X_BOT_USER_ACCESS_TOKEN` |
| **buy** | `@graav_xyz buy $gSWAP 0.1` | buy → `swap` (`xrpToToken`) | M2.2 `0x8f2D…9076` + TestDex V2 `0xA3f6…ED83`, `graduated()==true`, `tokenToLpId!=0` | `READY` | mention / mention | same |
| **buy** (reply under a creator post) | `@graav_xyz buy $g589 0.1` as a reply | buy → `buy` | M2 curve | `READY` | **creator post** / mention | same |
| **sell** | `@graav_xyz sell 1 $g589` | sell → `sell` | M2 curve approve → `sell(amount, minOut)` | `READY` | mention / mention | same |
| **sell** | `@graav_xyz sell 50% $g589` | sell (percent) | — | `BLOCKED` | — | concrete amount (Trade fallback) |
| **sell** | `@graav_xyz sell 1 $gSWAP` | sell on graduated | — | `BLOCKED` | — | V2 `tokenToXrp` swap from Trade (not minted from X) |
| **create** | `@graav_xyz launch $HORMUZ` | launch → `create` | Coin V1 `createCoin(CreateParams, sig)` on RLUSD clone factory `0xd2b7…BA20` | `SOFT_READY` | **the post itself** / mention · `originHash = keccak256(utf8(originTweetId))` = Coin V1 `sourcePostId` | `/s` Coin V1 sign rail (LaunchAuthorizer signature via `/api/rlusd/launch/authorize`, `LAUNCH_AUTHORIZER_PRIVATE_KEY`) **then** the flag |
| **create** (quote-RT) | `Launch $HORMUZ @graav_xyz` quoting a post | launch → `create` | Coin V1 | `SOFT_READY` | **quoted post** / mention | same |
| **create** | `@graav_xyz launch $1bad` | bad ticker | — | `BLOCKED` | — | never (ticker hygiene: 1–15 alnum/underscore, letter first) |
| **create** | `launch $HORMUZ` with no post id (Chat / API without `mentionId`) | launch | — | `BLOCKED` | — | an X origin post — the post is the Moment |
| **MOMENT** | `@graav_xyz buy $MOMENT 1` | buy | Coin V1 curve (RLUSD approve + buy) | `BLOCKED` | — | (1) first signed `createCoin` sets coin/curve (`RLUSD_V1.coinAddress / curveAddress` are `null`) **and** (2) an `/s` RLUSD approve+buy rail. Until then: Markets RLUSD wallet rail only (same lock as Chat) |
| **MOMENT** | `@graav_xyz sell 1 $MOMENT` / `$COIN` / `$MRLUSD` | sell | Coin V1 curve | `BLOCKED` | — | same two gates |
| guard | `@graav_xyz buy $g589 0.1 $gSWAP` | buy | — | `BLOCKED` | — | never — one cashtag per X post |
| guard | `@graav_xyz buy g589 0.1` | buy without `$` | — | `BLOCKED` | — | never on X — exactly one `$TICKER` (Chat may omit the `$`) |
| guard | `@graav_xyz portfolio` | portfolio | — (read) | `SKIP` | — | reply copy needs write open; no `/s` |
| guard | `@graav_xyz gm` | none | — | `SKIP` | — | never |

Chat (`ChatTab`) keeps the shared `parseIntent` and its own handoffs (Trade / Launch on X). The X-only guards above (cashtag rule, Coin V1 trade refusal, create bound to the origin post) live in `src/lib/xCronCoverage.ts` and apply to mentions, `POST /api/x/reply-session`, and the cron.

## Soft-ready bind fields

Persisted inside the HMAC `/s` payload (`SigningSessionPayload`) so they survive serverless; store-only until Protocol verifies on-chain. Nothing here authorizes a trade.

| Field | Source | Rule |
| --- | --- | --- |
| `replyTweetId` | the mention / reply / DM message GRAAV would answer | always the mention id |
| `originTweetId` | `referenced_tweets` on the mention (`tweet.fields=…,referenced_tweets`) | **quoted** post › **replied_to** post › the mention itself. `conversation_id` is not used — a reply mid-thread binds the post it answers. Creator = original poster (Attribution V1). |
| `originHash` (create only) | `originTweetId` | `keccak256(utf8(originTweetId))` — identical to `sourcePostIdFromInput()` used by the Launch paste-link fallback, so both rails hash the same source post |
| `dmConversationId` | passthrough | store field only — DM runtime stays CLOSED |
| `buyerXUserId`, `verifiedBuyTx` | passthrough on `POST /api/x/reply-session` | **not bound by the cron this slice** (author_id is fetched but not written); filled later by Protocol |

`/s` renders `originTweetId` as a link only when it is numeric (a real post id). Fixture ids are deliberately non-numeric.

## Dry-run paths (how to verify without X keys or posting)

```sh
# 1. Matrix — no auth, no X read, no post; fixture sessions expire in 60 s
curl -sS https://graav-testnet-console.vercel.app/api/x/coverage | jq '{summary, allPass, rows: [.rows[] | {fixture, status, liveReady, bind}]}'

# 2. Cron fixtures mode — CRON_SECRET only; proves the cron path end to end
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://graav-testnet-console.vercel.app/api/cron/x-auto-reply?fixtures=1" | jq '{mode, writeGate, productIdLock, summary, allPass}'

# 3. Cron dry-run against live mentions — reads X (quota), mints /s, never claims or posts
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://graav-testnet-console.vercel.app/api/cron/x-auto-reply?dryRun=1" | jq '{mode, dryRunWhy, summary, rows: [.rows[] | {mentionId, status, liveReady, bind, session}]}'

# 4. Single intent dry-run (default dryRun:true)
curl -sS -X POST https://graav-testnet-console.vercel.app/api/x/reply-session \
  -H 'content-type: application/json' \
  -d '{"mentionId":"dry-run-mention","text":"@graav_xyz launch $HORMUZ"}' | jq '{coverage, session, xReply}'
```

Local: `npm run test:x-cron` (13 tests, incl. a stubbed-fetch proof that only READY rows ever reach `POST /2/tweets` with the gate simulated open) and `npm test` (73). `npm run check`, `npm run lint` (0 errors, 3 pre-existing `img` warnings), `npm run build` PASS on this branch. Local `next start` smoke: `/api/x/coverage` ALL PASS (READY 4 · SOFT_READY 2 · BLOCKED 6 · SKIP 2), cron `?fixtures=1` → `mode: dry-run`, cron without X keys → 503 `X_PRODUCT_USER_ID` lock, `/s/{id}` for the create fixture renders Launch $HORMUZ with CREATE ORIGIN + origin hash and no Sign path.

## Live-mode locks (unchanged or tightened)

- `CRON_SECRET` required; `X_PRODUCT_USER_ID` must be the `@graav_xyz` id (503 otherwise) for any mode that reads X.
- Product token refresh (`maybeRefreshProductToken`) behaves as before in live and dry-run-against-mentions modes; fixtures mode never refreshes.
- Only `READY` + `liveReady` rows are claimed and posted. `SOFT_READY` create is **never** posted, even with the flag open, until the `/s` Coin V1 sign rail exists.
- `replyAsProduct` keeps the one-cashtag output guard; the reply body is URL-only: `Sign here (wallet only · chat ≠ auth): https://…/s/{id}`.
- Reads use `X_BEARER_TOKEN` first; writes require `X_BOT_USER_ACCESS_TOKEN` (alias `X_PRODUCT_ACCESS_TOKEN`).
- Batch stays capped at five mentions per run. The read has no `since_id`; a burst of more than five actionable mentions inside one two-minute window can be missed (pre-existing).

## What still needs FEATURE open (and what does not)

| Row | Needs `FEATURE_PUBLIC_X_WRITE=true` + product token | Needs more than the flag |
| --- | --- | --- |
| buy `$g589` / `$gSWAP`, sell `$g589` | yes → live `/s` reply | — |
| create `$TICKER` | yes, later | `/s` Coin V1 sign rail: LaunchAuthorizer signature (`LAUNCH_AUTHORIZER_PRIVATE_KEY` on the server, `/api/rlusd/launch/authorize`) wired into `SigningSessionClient` for `action=create` on the RLUSD clone factory. Until then the row stays `SOFT_READY` and is never posted. |
| MOMENT buy / sell | yes, later | first signed `createCoin` (coin/curve non-null) **and** an `/s` RLUSD approve+buy rail. Until then `BLOCKED`; Markets RLUSD wallet rail only. |
| portfolio | reply copy only | no `/s` — out of scope for the cron |

Opening the flag is an Exec decision after keys are set (`X_BEARER_TOKEN`, `X_PRODUCT_USER_ID`, `X_BOT_USER_ACCESS_TOKEN`, `X_BOT_USER_REFRESH_TOKEN`, product client id/secret). This document and PR do not open it.

## Explicit non-goals

- No `FEATURE_PUBLIC_X_WRITE` open, no Production deploy, no live post or DM.
- No tip remint, no econ / ABI change, no new tip addresses.
- No cross-chain routes invented (Base Sepolia corridor stays FAIL-CLOSED per PR #5).
- No M2 `createMarket` fallback for X launches — the X-first create is Coin V1 (Test RLUSD), matching the Launch page.
