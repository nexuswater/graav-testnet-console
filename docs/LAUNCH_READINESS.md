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

## Product surfaces

- **Markets** — searchable rows, quote assets, honest availability. Unavailable launches use a neutral status.
- **Trade** — pay / receive, fee, slippage, min received, distinct review → approve → sign. Review disabled until inputs and integration prerequisites pass.
- **Launch** — Post, repost, or DM on X creates the Moment; GRAAV hands off a `/s` link to review (optional Test RLUSD seed) and wallet-sign. Paste-link is a testnet fallback, not the lead. `createCoin(CreateParams, bytes)` only on the fallback rail. Authorization is never fabricated. No public X write. SoT: `docs/x/X_PRIMARY_ARCHITECTURE_2026-09-10.md`.
- **Attribution V1 (copy)** — 60 creator / 25 protocol / 15 distributor; the 15 decays depth-4 as 40/25/20/15; missing hop → protocol; creator = original poster; paid once. Kernel lab CODE READY `buyWithAttribution` `0xada7290b` (forge 20/20) is referenced only — no tip redeploy, no invented tip addresses.
- **Funding order** — XRPL EVM `1449000` + Test RLUSD home → Base Sepolia inbound first → Arbitrum Sepolia → Robinhood / Hyperliquid later. Fail-closed: no route = no Buy.
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
