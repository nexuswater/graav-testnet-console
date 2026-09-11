# GRAAV Testnet Console — Launch Readiness

Reviewable RC only. Mainnet CLOSED. M4 HOLD. Do not deploy, Production-push, broadcast, or send public-chain transactions from this document.

## Identity

| Item | Value |
| --- | --- |
| Profile | `testnet-clone` on XRPL EVM Testnet `1449000` |
| Factory / tip | `0xd2b7C9D3df75b081c4CB01F711D31D06263EbA20` |
| LaunchAuthorizer | `0xBA100b11adF478B3B96Ce2F2BebFBd8Cf2E4E336` |
| Quote | Display **RLUSD** (`0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F`) |
| Fee policy | `GRAAV_RLUSD_V1_40_35_20_5` (40 / 35 / 20 / 5) |
| gSWAP | Kept — M2.2 `0x8f2D4E36ec0Ef2e55e0073830C22C8f863D89076` · market `0x7a4bCfF97A33F408F356B9B54fd5709dCA34078a` |
| Coin / curve | `null` until the first signed `createCoin` |
| Attribution V1 tip (stack2, TEMPLATE_VERSION 2) | Factory `0x3d826B1495d517bA9fa1721b7e0CDB0513461e68` · Guardian `0x8c78Ff4462dBDDEeB4eEDdc92e739101e82217e0` · AttributionVerifier `0xE04763CdC4779deBc2293bacd4F98d5D7B82f322` · GraduationManager `0x5eD78c0ac98aEA25dd3f123a5654Ac5531220211` · LiquidityVault `0xF9E6E3D238a7AA4304229aB527a3e4c2d131bc49` — see `docs/x/ATTRIBUTION_V1_TIP_PIN_STACK2_1449000.md` |

## Product surfaces

- **Markets** — searchable rows, quote assets, honest availability. Unavailable launches use a neutral status.
- **Trade** — pay / receive, fee, slippage, min received, distinct review → approve → sign. Review disabled until inputs and integration prerequisites pass.
- **Launch** — Post, repost, or DM on X creates the Moment; GRAAV hands off a `/s` link to review (optional Test RLUSD seed) and wallet-sign. Paste-link is a testnet fallback, not the lead. `createCoin(CreateParams, bytes)` only on the fallback rail. Authorization is never fabricated. No public X write. SoT: `docs/x/X_PRIMARY_ARCHITECTURE_2026-09-10.md`.
- **Attribution V1 (copy)** — 60 creator / 25 protocol / 15 distributor; the 15 decays depth-4 as 40/25/20/15; missing hop → protocol; creator = original poster; paid once. Tip reminted as **stack2** (TEMPLATE_VERSION 2) and pinned from the Exec deployment record — Factory `0x3d82…1e68`, Guardian, AttributionVerifier, GraduationManager, LiquidityVault. `buyWithAttribution` `0xada7290b` (depth-4 `address[4]` hops, forge 20/20) is pinned in `attributionMarketAbi`; Exec smoke PASS (createMarket + buy + buyWithAttribution attributed=true). The console never signs attribution proofs. Retired stack1 `0xc5D6…` is not pinned; Coin Soft Factory `0xd2b7…` is untouched.
- **Funding corridor** — XRPL EVM `1449000` + Test RLUSD home. **Inbound order: Base Sepolia → RLUSD on XRPL EVM testnet first (Aggregated / Squid)**; it is the only corridor wired for route checks. `/api/crosschain/probe` returns a `corridor` gate (dest, source, USDC on Base, RLUSD ITS on dest, live Squid quote, tx rail) that reads FAIL-CLOSED until every check is OK — Buy is never enabled without a live quote. **Arbitrum only after Base PASS; Robinhood / Hyperliquid later** — none probed this slice. No live route = no Buy.
- **Portfolio** — readable holdings. Unknown reads stay unknown (not zero).
- **Chat** — concise intent previews. Wallet signing is a separate step.
- **Funding** — simple unavailability. Probe diagnostics behind Details.
- **Profile / Rewards** — existing bind rail, monochrome shell.

## Technical gates

### A — Market honesty

`null`, zero, and mismatched factory/quote/coin/curve addresses are **not configured**. Live UI states are `unconfigured | configured | loading | failed | tradable`. The false “RLUSD markets live” banner is removed. Mock buy/session routes cannot complete a financial-success session.

### B — Coin V1 create

Launch builds `CreateParams` from the integer model (1B allocation, virtual reserves, threshold). Flow is review → authorize → simulate → wallet sign → receipt → `CoinCreated`. `POST /api/rlusd/launch/authorize` signs a LaunchAuthorizer digest only when `LAUNCH_AUTHORIZER_PRIVATE_KEY` is set. Otherwise Sign stays disabled.

### C — RLUSD trade

Quotes use Solidity-matched integer math with ceiling division and the 1% / 40-35-20-5 split. Unknown balances render as `—`. Wallet path simulates, applies 0.5% minOut, and rejects duplicate submits. gSWAP remains on the XRP / M2.2 rail.

### D — This RC

See `docs/RELEASE_REPORT.md` for SHA, test results, blockers, and rollback.

## Explicit non-goals

- No Vercel / Production deploy
- No mainnet `1440000` broadcast
- No public X write
- No M4 tip-fold
