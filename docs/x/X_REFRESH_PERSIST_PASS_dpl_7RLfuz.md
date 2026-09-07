# X refresh persist PASS — dpl_7RLfuz

**Status:** REVIEW PASS (Sandbox Labs Director)  
**Date:** 2026-09-06 (America/Chicago) / 2026-09-07 UTC  
**Tip:** `dpl_7RLfuzHadWHLV3UQMSHhP2br5AfM`  
**Commit:** `784b95f` — omit `key` on Vercel Sensitive env PATCH  
**Prior tip:** `dpl_3YQzZoET6VL6iqLjrncZPEv1feUZ` (`3731d26` persist scaffold)

## Result

- Remint PASS as `@graav_xyz` (product OAuth User Context, offline.access).
- `POST /api/x/refresh-token` (CRON_SECRET): `ok=true`
- **`vercelPersist.ok=true`**
- Updated: `X_BOT_USER_ACCESS_TOKEN`, `X_PRODUCT_ACCESS_TOKEN`, `X_BOT_USER_REFRESH_TOKEN`

## Root cause (persist 400)

Vercel Sensitive Environment Variables reject PATCH bodies that include `key`  
(`You cannot change the key of a Sensitive Environment Variable.`).  
Fix: PATCH `{ value, type, target }` only; POST create may still send `key`.

## Ops

- Auto-reply cron path durable through refresh rotation.
- M4 tip attribution: **HOLD**

## Console

https://graav-testnet-console.vercel.app
