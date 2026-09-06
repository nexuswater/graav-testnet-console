# GRAAV RLUSD Coin V1 — testnet clone evidence (2026-09-06)

## Result

**READY FOR DIRECTOR REVIEW** — clone broadcast and smoke completed on XRPL EVM testnet `1449000` only. No `1440000` transaction, mainnet RLUSD bind, `tweet.write`, or M4 tip-fold was used.

SoT before implementation: `a71fbe1` (`feat/x1-rlusd-token-markets`). Full machine-readable record: [`RLUSD_TESTNET_CLONE_DEPLOY_1449000.json`](./RLUSD_TESTNET_CLONE_DEPLOY_1449000.json).

## Profile and addresses

- RPC: `https://rpc.testnet.xrplevm.org`; explorer: `https://explorer.testnet.xrplevm.org`
- Deployer: `0x64FADF4D3FDe272EE100C1D1988b84149fd08DE3`
- Policy: `GRAAV_RLUSD_V1_40_35_20_5` (40/35/20/5 bps, 100 bps total)
- Mock quote: `MockRLUSD` / `mRLUSD`, 18 decimals — `0x9BCd84a6DbBE53FD5ACbC77b065c58F2eF753F6e`
- FeeEscrow: `0xba078e035D8b421152155dF1699264b2a1B5bfeB`
- CreatorVault: `0x864A039a6c66dfCAEC01a2704f831f05677F7eF6`
- LaunchAuthorizer: `0x00A6292c7C75463DcAf81aB74F6779a580E4BBDF`
- AttributionGuard: `0x37B104817BaDdE46ae5f301ebB5920B827d94C0c`
- TokenFactory: `0x2E393cfabeC866a38632b8C486B942089644dE93`
- Created coin: `0xe6A44F18A8375A3a1F3d01904C6e3001D7958A8e`; curve `0x376D4e428E25A403A3fA5cC122D1910f97B2B712`; market escrow `0x5357582778fbbceC8407c357c10045734DBBd801`
- Fresh bind domain: `GRAAV_RLUSD_TESTNET_CLONE` / `1` / `1449000` / verifying contract `0x2E393cfabeC866a38632b8C486B942089644dE93`. This is not X1 `0x72be5a300956f9dF0F4264a4211251dD17CA276B`.

## Transactions

Deployment CREATE tx hashes are in the JSON record. Factory launch create: `0xc2be44b3afe2e7869dfe5f30d9f8123ab7a641a57f80ee9794d3976bea9cf193` (confirmed, block `8499580`).

Smoke BUY: `0x37210457ddb3f35a6acc70aacf6411b0ecc415fc145b05add38204fb51f5a4fc` — 5 MockRLUSD gross, `989998774876516090311` coin units out.

Smoke SELL: `0x82b5fa7ebd82bb1b601dc2470fdda62d6807d2da63b443feec50cdb5cb33e978` — same coin units in, `4900990099009900000` MockRLUSD out.

## Guard implementation and validation

- `LaunchAuthorizer`: source-post uniqueness remains factory-scoped; EIP-191 signed launch digest includes chain, authorizer address, source post, issuer, allocation/curve parameters, nonce, and deadline; nonce/digest replay and expired launch fail closed.
- `AttributionGuard`: signed coin-scoped last-touch records include source post, coin, buyer, referrer, nonce, deadline; curve BUY rejects missing/expired/mismatched referrer or midwife evidence.
- Foundry: `forge test --root contracts-rlusd` — 2 passed, 0 failed.
- TypeScript: `npx tsc --noEmit` — passed.
- Console clone profile is explicit `RLUSD_TESTNET_CLONE=1`; default target remains mainnet-target and disabled. X1 paths/config remain on chain `1449000` with the existing X1 bind domain.
