# GRAAV Token Markets final review — X1 + RLUSD

**Date:** 2026-09-06 (America/Chicago)
**Branch:** `feat/x1-rlusd-token-markets`
**Reviewed commits:** `cda374e` X1 foundation; `9739c88` RLUSD local Coin V1 rails.
**Scope:** local review and read-only provider metadata only. No live deploy, bridge, wallet signing, or broadcast.

## Executive result

- **PASS — product boundary:** GRAAV Coin V1 remains Moment → Coin, RLUSD quote, with Drop/Call later. No NexusWater or binary-market changes were introduced.
- **PASS — profile separation:** X1 stays on chain `1449000`, native XRP, existing GRAAVBind and X1 economics. RLUSD is separately configured for chain `1440000`, RLUSD, 18 decimals, policy `GRAAV_RLUSD_V1_40_35_20_5`; `bindVerifyingContract` remains `null` and live execution remains disabled.
- **PASS — local model/UI loop:** local mock quote/session, destination-buy state, referral accounting, and reserve-backed SELL remain explicitly labelled `LOCAL MOCK` / `not Squid evidence`.
- **PASS — provider fail-closed behavior:** added a Squid v2 read-only chains/tokens adapter and metadata endpoint. It never requests transaction data, signs, broadcasts, or enables a BUY. A quote builder is `quoteOnly: true` and requires exact source metadata plus the RLUSD destination identity.
- **BLOCKED BY NAMED DEPENDENCY — ingress:** live Squid destination support is not proven. With public `x-integrator-id: test`, live metadata returned 82 chains and 4,678 tokens, but no chain `1440000`; result was `provider_gap / DESTINATION_CHAIN_NOT_LISTED:1440000`. No route quote was requested because the exact destination was absent.

## Solidity review

A quick in-scope hardening pass was made in `contracts-rlusd/src/RLUSDCoinV1.sol`:

- `FeeEscrow.claim` now has an actual reentrancy guard; the prior modifier was a no-op.
- `RlusdCurve.graduate` burns both unused curve inventory and reserved-LP leftovers, matching the reference model inventory accounting.

The Solidity scaffold still does **not** claim production readiness. Factory launch authorization, source-post attestation, attribution guard, creator/scout entitlement, full referral policy enforcement, deployment addresses, fuzz/invariants, and independent-connection persistence remain unresolved.
## Test matrix
Kit 86 tests: PASS
Console model 22 tests: PASS
Console model plus ingress 26 tests: PASS
TypeScript, lint, Next build: PASS
Local Solidity 2 tests: PASS
Full Solidity fuzz and invariant suite: NOT RUN
Browser wallet acceptance: NOT RUN
Independent PostgreSQL race test: NOT RUN

## Ingress D implementation

Added `src/lib/rlusd-v1/ingress.ts`, `src/app/api/rlusd/ingress/metadata/route.ts`, and `tests/rlusd-ingress.test.ts`. The adapter reads Squid v2 chains and tokens with the configured integrator header, pins destination RLUSD to chain 1440000 / `0x8d58c0c60b8d6b88fa98b291a646db34d0f98258` / 18 decimals, and returns a provider gap when absent. The quote builder is `quoteOnly: true`, has no postHook or transaction path, and requires exact source metadata.

The conceptual destination BUY adapter is disabled until market address, hook caller, LaunchAuthorizer, AttributionGuard, beneficiary/order proof, and measured RLUSD/token-delta verifier exist. No NTT manager, ETH hop, universal route, or invented fixture was added. Existing X1 `/api/crosschain/probe` remains on testnet 1449000.

## Solidity review

Quick in-scope fixes in `contracts-rlusd/src/RLUSDCoinV1.sol`: `FeeEscrow.claim` now has an actual reentrancy guard; `RlusdCurve.graduate` burns unused curve inventory plus reserved-LP leftovers. Local forge tests pass 2/2. This is not a production audit: launch authorization, source attestation, attribution, entitlement, deployment addresses, fuzz/invariants and independent-connection persistence remain unresolved.

## Hash and evidence limits

No Solidity/client golden hash was generated. The TypeScript economic model is a reference model, not bytecode equivalence, and no RLUSD deployment or approved artifact hash exists. X1 golden/signature artifacts remain bounded to 1449000 and must not be reused for RLUSD.

## Review categories

- Product/repository separation: **PASS**.
- X1 history/domain/ledger: **PASS for bounded regression; fresh live X1 T+ NOT RUN**.
- RLUSD identity: **PASS locally; bind verifier TBD; NOT LIVE**.
- Real server X source-author/scout launch: **BLOCKED BY LaunchAuthorizer and AttributionGuard**.
- Fixed 1B supply, allocation, cliff, cap, no tax: **PASS in model/local scaffold; production factory integration NOT RUN**.
- Curve solvency and graduation: **PASS for model/local smoke; full fuzz, rollback and vault histories NOT RUN**.
- Atomic official Pair fee path: **PARTIAL; production authorization and proof remain**.
- 40/35/20/5 policy: **PASS in model; Solidity eligibility wiring PARTIAL**.
- Creator escrow and claims: **PARTIAL; blocked by entitlement service**.
- Last-touch attribution: **PASS in reference tests; RLUSD persistence NOT LIVE**.
- Squid/NTT/sponsor route: **BLOCKED BY Squid provider gap**.
- Destination proof: **PASS as model guard; live hook caller NOT CONFIGURED**.
- Pending hashes/refunds/resume: **PARTIAL; persistent provider ledger NOT LIVE**.
- `/launch`, `/m`, `/s`, `/you`: **PASS for local build presence; browser acceptance NOT RUN**.
- Bot/no custody/no writes: **PASS**.
- Migration/PG/build/golden/fuzz/route gates: **PARTIAL**.
- Unauthorized deployment boundary: **PASS; none executed**.

## Live steps NOT RUN

No `vercel --prod`, wallet signature, RLUSD transfer, bridge, Squid execution, postHook, status tracking, factory deployment, K2/K3 or Anvil broadcast, FeeVault attachment, live BUY/SELL, X post, private X message, or `tweet.write` request. Circular/Nexus remains out of scope.

## Remaining blockers and release runbook

1. Implement LaunchAuthorizer for signed source-post launch, nonce/deadline/idempotency and source uniqueness.
2. Implement AttributionGuard for coin-scoped last-touch, bind snapshot/rebind/revoke, eligibility evidence and fee-backed immutable events.
3. Select and verify a fresh RLUSD 1440000 bind domain; never borrow X1's 1449000 verifier.
4. Obtain a real Squid integrator ID and re-run chains/tokens metadata. Require exact destination chain plus exact RLUSD token before a quote-only route.
5. Separately audit and allowlist a deployed destination BUY adapter/hook; verify caller, order, beneficiary and measured deltas before credit.
6. Add PostgreSQL locks/migrations, pending/refund recovery, sponsor limits and browser wallet acceptance without automatic respend.
7. Add Solidity fuzz/invariant/rollback/vault tests and approved artifacts before controlled deployment.

**Release state: HOLD / NOT RELEASED.** Local review evidence is ready; RLUSD ingress and live release remain blocked.
