# RLUSD Testnet Clone — Vercel Production Evidence

**Date:** 2026-09-06 (CT)  
**Branch base:** `feat/x1-rlusd-token-markets` at `7b49da4` plus clone UI/config update

## Deployment

- **Deployment:** `dpl_4JA6VePSGwC6tKt4wo1MVLJusmXm`
- **Production URL:** https://graav-testnet-console.vercel.app
- **Inspect:** https://vercel.com/sandbox-labs/graav-testnet-console/4JA6VePSGwC6tKt4wo1MVLJusmXm
- **Result:** READY / aliased to the canonical production URL

## Production env keys set

Public/config keys (values intentionally omitted here):

- `RLUSD_TESTNET_CLONE`
- `NEXT_PUBLIC_RLUSD_TESTNET_CLONE`
- `NEXT_PUBLIC_RLUSD_FACTORY`
- `NEXT_PUBLIC_RLUSD_MOCK_ADDRESS`
- `NEXT_PUBLIC_RLUSD_COIN_ADDRESS`
- `NEXT_PUBLIC_RLUSD_CURVE_ADDRESS`

The active tip is pinned to chain `1449000`, Factory `0x2E393cfabeC866a38632b8C486B942089644dE93`, MockRLUSD `0x9BCd84a6DbBE53FD5ACbC77b065c58F2eF753F6e`, Coin `0xe6A44F18A8375A3a1F3d01904C6e3001D7958A8e`, and Curve `0x376D4e428E25A403A3fA5cC122D1910f97B2B712`. The clone bind domain remains `GRAAV_RLUSD_TESTNET_CLONE`; the X1 bind domain was not changed.

Existing `FEATURE_PUBLIC_X_WRITE` configuration was not changed, and no tweet.write or bearer value was added.

## Live smoke

| Route | Result | Evidence |
|---|---|---|
| `/launch` | PASS, HTTP 200 | Shows `RLUSD TESTNET CLONE`, chain `1449000`, and `mRLUSD` |
| `/m/demo-moment-2026` | PASS, HTTP 200 | Shows clone label, chain `1449000`, `mRLUSD`, and Factory address |
| `/you` | PASS, HTTP 200 | Existing GRAAV / TESTNET / Connect UI loads |
| `/?tab=Trade` | PASS, HTTP 200 | Existing TESTNET console shell loads; Trade path remains unchanged |

No overlap with the prior create-scaffold `dpl_8X5Z…` tip was used; this is the fresh production deployment.

M4 tip-fold remains HOLD; no mainnet or circular flow was enabled.
