# Full GRAAV consumer surface default

Date: 2026-09-07
Origin: graav.xyz

## What was hidden

- The root console rendered CoinHome unless legacy=1 was present.
- PrimaryMenu showed Launch, a demo Moment, Trade->demo, and You; the full tabbed surface was hidden.

## How it was restored

- Root now renders the existing tabbed consumer shell directly; legacy=1 is no longer required.
- PrimaryMenu exposes Markets, Launch / create from X, Trade buy/sell/swap, Portfolio, Cross-chain Aggregated (fail-closed), Chat session mint, X mention-bot status, and You bind.
- Existing Coin/mRLUSD landing remains available at /coin; the mRLUSD clone factory rail was not changed, and gSWAP was not made the default.
- FEATURE_PUBLIC_X_WRITE and X OAuth configuration were not changed. M4 tip remains HOLD. No deployment was performed.

## Verification

- Checks: TypeScript verification passes.
- Commit SHA is reported with the execution handoff.

## Inventory at CODE READY

| Surface | State | Evidence / gap |
|---|---|---|
| X post → market | BURIED + gap | Existing `/new` pfp/create + `/s` session path remains direct-url X1 code; Launch does not yet bind source-post CREATE on the Coin/mRLUSD rail. Coin/mRLUSD LaunchAuthorizer/provider ingress remains not built, so do not claim clone creation live. |
| @graav_xyz mention → `/s` | SHIPPED scaffold / CLOSED write | X tab, mentions probe, dry-run reply-session, and `/api/x/reply-session` exist. Reply posts remain gated by `FEATURE_PUBLIC_X_WRITE`; attribution is not complete. |
| Launch | BURIED existing | Launch is an existing Coin/mRLUSD draft surface; live source-post CREATE and its `/s` handoff remain a documented gap until LaunchAuthorizer/provider ingress is ready. |
| Markets | BURIED existing + gap | Default shell restores the existing Markets/Trade list beyond the demo fixture. A real indexed mRLUSD market list beyond the local Moment fixture is not built. |
| Trade | BURIED existing | Existing buy/sell/swap tab is restored without `legacy=1`; Coin/mRLUSD demo rail remains separate and unchanged. |
| Portfolio | BURIED existing | Existing wallet holdings tab is restored; faucet and empty states remain fail-closed. |
| Cross-chain Aggregated* | BURIED existing / FAIL-CLOSED | Existing probe tab is restored; buy stays OFF until measured settle + native-XRP PASS. |
| Chat → `/s` | BURIED existing / SHIPPED | Existing intent parser and `/api/s` handoff are restored in the default shell; chat never signs. |
| You bind | SHIPPED | `/you` and bind/auth surface remain intact; parallel pattern-error fix is preserved. |
| Account / WalletConnect / X | SHIPPED | AppChrome account menu exposes wallet/X identity; no OAuth env or secrets changed. |
| pfp / create | SHIPPED | `/new` upload/generate and allowlisted X1 create-session flow exist; source-post binding to the Coin/mRLUSD create path is not yet live. |
| Faucet | SHIPPED | Existing XRPL EVM testnet faucet links remain in shell and Portfolio. |
| M4 | HOLD | No tip-fold, deploy, or production rail change. |

## Recommended DEFAULT consumer build order

1. Keep the restored shell/menu as the default and smoke every primary entry point.
2. Add a truthful mRLUSD factory index/list beyond the demo Moment; never synthesize markets or revive gSWAP as default.
3. Finish clone LaunchAuthorizer + provider ingress evidence, then implement source-post CREATE on the clone rail and bind it to `/s` with wallet-only signing.
4. Complete X mention read/probe and dry-run attribution; only a separate explicit GO may open public write. Do not claim reply attribution complete.
5. Keep Chat → `/s`, Portfolio, and Cross-chain Aggregated* visible with their existing fail-closed behavior.
6. Run check/smoke, then Exec ONE Production redeploy; no M4 or XChat/DM work.
