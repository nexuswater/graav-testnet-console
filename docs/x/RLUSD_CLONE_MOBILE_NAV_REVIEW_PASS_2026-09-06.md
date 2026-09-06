# RLUSD clone mobile navigation — REVIEW PASS (2026-09-06)

**Production deployment:** `dpl_31xum2vHgq7cKyU8jepQBKpZBDUK`
**URL:** https://graav-testnet-console.vercel.app

## Changes
- Added visible Connect wallet CTA and MetaMask mobile deep link.
- Added Launch Coin, Coin demo, and You links.
- Added RLUSD clone banner above home Markets; X1 Trade remains XRP.
## Verification
check pass
lint pass
production smoke: / 200, /launch 200, /you 200

## Locks
No tweet.write, no mainnet, X1 Trade stays XRP, M4 tip-fold remains HOLD.
NEXT_PUBLIC_RLUSD_TESTNET_CLONE=1 verified in Vercel Production.
RLUSD_TESTNET_CLONE is present in Vercel Production as a secret; value not printed.
