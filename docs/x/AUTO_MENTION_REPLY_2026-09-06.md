# @graav_xyz auto mention replies — 2026-09-06

## Scope

The local `testnet-console` tree now contains a protected OAuth2 refresh path and a Vercel cron at `/api/cron/x-auto-reply`. The cron runs every two minutes, reads the @graav_xyz mentions timeline, handles at most five actionable mentions per run, mints the existing signing-session `/s/{id}`, and posts the URL reply with `dryRun:false` only when the existing public-write gate is open.

No live X post was run as part of this change.

## Production environment

Required on Vercel Production:

- `CRON_SECRET` — protects both cron and refresh endpoints. Use `Authorization: Bearer <CRON_SECRET>` or a `CRON_SECRET: <CRON_SECRET>` header.
- `X_PRODUCT_USER_ID=2094147928965468160` — the numeric id for `@graav_xyz`.
- `X_BOT_USER_ACCESS_TOKEN` (or existing alias `X_PRODUCT_ACCESS_TOKEN`) — product user-context token with `tweet.write`.
- `X_BOT_USER_REFRESH_TOKEN` — OAuth2 offline refresh token for the product user.
- `X_PRODUCT_CLIENT_ID` (or existing `X_CLIENT_ID`) and `X_PRODUCT_CLIENT_SECRET` — the product X OAuth app credentials. The refresh path deliberately does not use the Connect-X `X_CLIENT_SECRET`.
- `VERCEL_TOKEN` (or `VERCEL_ACCESS_TOKEN`) — a Vercel API token allowed to edit this project's environment variables.
- `VERCEL_PROJECT_ID` — the Vercel project id (for example, `prj_...`).
- `VERCEL_TEAM_ID` — optional for personal projects; set it when the project belongs to a team.
- Existing `X_BEARER_TOKEN`, `FEATURE_PUBLIC_X_WRITE=true`, and session/origin variables as already configured.

The client secret and refresh token must be set by Exec before refresh can work. Do not use a Josh_XRPL token.

## Refresh behavior

`POST /api/x/refresh-token` refreshes at most when explicitly called and returns the new `access_token` plus a rotated `refresh_token` when X returns one. A warm instance updates its in-memory process environment. A local `.secrets` directory, when present, is updated best-effort; Vercel runtime files are not durable. When `VERCEL_TOKEN` (or `VERCEL_ACCESS_TOKEN`) and `VERCEL_PROJECT_ID` are set, the refresh path best-effort PATCHes or POSTs the Production values for `X_BOT_USER_ACCESS_TOKEN`, `X_PRODUCT_ACCESS_TOKEN` when that alias is in use, and the rotated `X_BOT_USER_REFRESH_TOKEN` through the official Vercel REST API. The response includes `vercelPersist: { ok, updated, error? }`; a Vercel failure never invalidates an otherwise successful X refresh. The auto-reply cron attempts refresh after roughly 90 minutes and retries once after a mentions 401.

Example (does not post a tweet):

```sh
curl -sS -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://graav-testnet-console.vercel.app/api/x/refresh-token
```

## Verify cron

This calls the live mentions read path and can post replies if the existing feature gate and product token are live. Run only as an authorized Exec verification:

```sh
curl -sS \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://graav-testnet-console.vercel.app/api/cron/x-auto-reply
```

The response reports fetched, claimed, posted, skipped, and failed counts without returning tokens. The endpoint is also available as POST for manual verification.

## Safety and idempotency locks

- Product identity is @graav_xyz only (`X_PRODUCT_USER_ID` is checked against `2094147928965468160`); no Josh_XRPL fallback exists.
- The route reads the mentions timeline only: no DM, quote-post, or cold path.
- Only existing `parseIntent` BUY/SELL/LAUNCH plans with an allowlisted session body are actionable.
- Source mentions with more than one cashtag are skipped; `replyAsProduct` retains its one-cashtag output guard.
- Replies are URL-only `/s/{id}` signing-session links. Chat never authorizes a transaction.
- `graav_x1.x_auto_replies` stores mention id, status, reply tweet id, and session URL. An atomic claim prevents duplicate concurrent replies; failed/stale work can be retried.
- Batch size is capped at five mentions per run.

## Local validation

From this directory:

```sh
npx tsc --noEmit
```

Do not invoke the cron against a live deployment during code validation unless live posting is explicitly authorized.
