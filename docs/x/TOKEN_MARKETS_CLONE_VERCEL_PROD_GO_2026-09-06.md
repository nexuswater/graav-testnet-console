# Token Markets — Josh GO: Console + Vercel prod for testnet clone tip

**Authority:** Josh via Exec · Director stamp 2026-09-06  
**Active clone tip:** Factory `0x2E393cfabeC866a38632b8C486B942089644dE93` (1449000)

## GO
Update console + **vercel prod** to expose / bind the **testnet clone** profile.

## Required
- `RLUSD_TESTNET_CLONE=1` (or equivalent) on prod env — clone profile only
- Pin Factory / MockRLUSD / Coin / Curve to REVIEW PASS addresses
- Fresh bind domain `GRAAV_RLUSD_TESTNET_CLONE` verifying Factory — never X1 `0x72be…`
- Soft-ping Director with **dpl_*** id when tip updates for REVIEW
- Call out if overlapping prior create-scaffold tip `dpl_8X5Z…`

## Forbidden
- No 1440000 mainnet · no tweet.write / FEATURE write · **M4 tip-fold HOLD**
- Do not break X1 `/you` / GRAAVBind / native XRP `/s` paths

## Production GO result (2026-09-06 CT)

- **Deployed:** `dpl_4JA6VePSGwC6tKt4wo1MVLJusmXm`
- **URL:** https://graav-testnet-console.vercel.app
- Clone env and public address pins are set in Production; `FEATURE_PUBLIC_X_WRITE` was not changed.
- Live smoke passed: `/launch`, `/m/demo-moment-2026`, `/you`, and `/?tab=Trade` all returned HTTP 200; clone routes show the mock-labeled `1449000` tip.
- X1 bind domain and Trade implementation remain unchanged. No mainnet, tweet.write, circular flow, or M4 tip-fold enablement.
