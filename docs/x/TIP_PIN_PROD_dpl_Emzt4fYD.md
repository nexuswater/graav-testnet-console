# Tip pin Production — dpl_Emzt4fYD

- When: 2026-09-08 ~00:40Z
- Commit: `9cce707` feat(tip): pin Soft CODE READY clone factory 0xd2b7…
- Parent: `4a381a6` Squid Aggregated* / Buy fail-closed
- Deployment: `dpl_Emzt4fYDJLMGcjPSTPzoredfGLPK`
- Alias: https://graav.xyz
- Inspect URL: https://graav-testnet-console-dufx7cim3-sandbox-labs.vercel.app

## Addresses (1449000)

| Role | Address |
|---|---|
| Factory | `0xd2b7C9D3df75b081c4CB01F711D31D06263EbA20` |
| AttributionGuard | `0x3d1aACAcfFff6B96Adf732E0bd2D5c19B4F7e951` |
| MockRLUSD | `0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F` |

Fees: 40/35/20/5. Mainnet: closed.

## Smoke

- GET https://graav.xyz/ → 200
- GET https://graav.xyz/launch → 200; HTML contains Factory `0xd2b7…`; no `0x2E39…`
- Coin/Curve remain null until first Moment create
