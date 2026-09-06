# GRAAV RLUSD local rails evidence — 2026-09-06

**Profile:** local-only B+C implementation, America/Chicago (CT). Not Squid, testnet, or mainnet evidence.

## Separation locks

- Policy: `GRAAV_RLUSD_V1_40_35_20_5`, chain target `1440000`, RLUSD quote, 18 decimals.
- X1 remains chain `1449000` with existing GRAAVBind, `/you`, `/s`, HMAC and reply-track. No X1 economics migrated.
- RLUSD mainnet bind verifying contract: **TBD**. Never borrow X1.
- GRAAV remains the product; no NexusWater assets or settlement added.

## Implemented

- `contracts-rlusd/src/RLUSDCoinV1.sol`: no-tax fixed-supply MomentToken, local TokenFactory source-post uniqueness, virtual/real-reserve RlusdCurve, direct-fee ProtocolPair, pull-only FeeEscrow, CreatorVault cliff primitive.
- `src/lib/rlusd-v1/{config,model,crosschain}.ts`: adapted model, fee split, curve rounding, graduation plan, referral evidence, and ingress reducer.
- `/launch`: launch-draft scaffolding. `/m/[xPostId]`: Moment to Coin card. Existing `/s/[id]` only branches `rlusd_` IDs to mock signing.
- `/api/rlusd/{quote,buy,session/[id]}`: in-memory mock quote/session loop. It creates 5-RLUSD gross BUY, executes mock destination BUY, credits 0.01 RLUSD referral base units, and sells against actual reserve. Responses/UI say `LOCAL MOCK - not Squid evidence`.

## Checks
- check: TypeScript pass
- lint: pass
- build: pass
- test:rlusd: 22 passed
- forge test: 2 passed
- HTTP smoke: 5 RLUSD gross BUY, 4.95 net reserve, 0.05 fee, 0.01 referral, positive SELL output

## Gaps and not run

- No live factory, K2/K3, Anvil broadcast, provider/Squid route, wallet signing, FeeVault attach, mainnet bind, public X post, or vercel --prod was run.
- The mock does not prove provider route support, destination hook authentication, wallet beneficiary signatures, persistent database ledger behavior, or on-chain addresses.
- LaunchAuthorizer, AttributionGuard, and provider-specific IngressAdapter remain deployment-bound integration work; the local API uses an explicit mock boundary.
- Graduation is covered by TypeScript model invariants; Solidity covers pre-graduation BUY/SELL and pair fee plumbing. Future work: on-chain graduation rollback/fuzz and full signed launch/ingress attestations.

## Controlled later steps (not executed)

1. Freeze launch and attestation typed data plus policy hash.
2. Select and verify fresh 1440000 bind domain; never reuse 1449000.
3. Deploy only to separately approved local or test environment and verify bytecode and quote metadata.
4. Obtain provider route and destination-hook evidence before enabling ingress.
5. Run wallet/browser acceptance with gas and refund behavior before any authorized release.
