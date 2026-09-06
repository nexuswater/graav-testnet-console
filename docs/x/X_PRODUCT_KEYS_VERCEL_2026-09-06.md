# GRAAV product X keys → Vercel Production evidence — 2026-09-06

Scope: `graav-testnet-console` Production. Secret values are intentionally omitted.

## Production environment keys

The following Production Secret names are set:

- `X_BEARER_TOKEN`
- `X_BOT_USER_ACCESS_TOKEN`
- `X_PRODUCT_ACCESS_TOKEN` (alias)
- `X_PRODUCT_USER_ID`
- `FEATURE_PUBLIC_X_WRITE` = `false`

Source files were verified non-empty with mode `600`; the product user ID was verified as digits only. No secret values are recorded here.

## Deployment

- Deployment: `dpl_GBQbBAgV9MBptsBPVMPkTMLwbWMb` (READY, Production)
- Canonical URL: `https://graav-testnet-console.vercel.app`
- Deploy/build completed successfully.

## Capabilities smoke

GET `/api/x/capabilities` returned `featurePublicXWrite=false`, `writeGate.open=false`, and `envKeysNeeded=[]`.

| Capability | Status | Summary |
| --- | --- | --- |
| Chat → /api/s session mint | PASS | Connected |
| Connect X identity | PASS | Identity OAuth configuration present |
| X API read mentions | ERROR | Live probe reported credits depleted |
| X bot reply-session | SCAFFOLD | Parses intent and mints `/s`; posting remains gated |
| Public X write | CLOSED | `FEATURE_PUBLIC_X_WRITE` is false |

## Non-posting reply-session smoke

POST `/api/x/reply-session` with `@graav_xyz buy $g589 0.1` and `dryRun:true` returned `xReply.posted=false`, `xReply.dryRun=true`, and retained the feature gate closed. A session URL was minted for the dry-run response; it is intentionally not recorded.

## Review note

READY for Director keys review. This is not write green: public X write remains CLOSED and no post was attempted.

No secrets, tokens, signed session URLs, or credential values are included in this evidence note.
