# GRAAV Testnet Console RC — Release Report

Reviewable RC only. Do not merge, publish, deploy, or broadcast.

## Identity

| Field | Value |
| --- | --- |
| Branch | `cursor/graav-testnet-console-rc-d549` |
| SHA | _filled after commit_ |
| Factory | `0xd2b7C9D3df75b081c4CB01F711D31D06263EbA20` |
| Chain | `1449000` XRPL EVM Testnet |
| Quote | RLUSD `0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F` |
| Authorizer | `0xBA100b11adF478B3B96Ce2F2BebFBd8Cf2E4E336` |
| Fee split | 40 / 35 / 20 / 5 |
| gSWAP | retained |
| Coin / curve | `null` (first create pending) |

## Visual

Monochrome light / dark / system tokens from the attached SoT. Existing GRAAV header lockup preserved (inverted in light theme). Responsive Markets / Trade / Launch / Portfolio / Chat / Funding / Profile.

## Tests

| Check | Result |
| --- | --- |
| `npm test` (chat + rlusd + rc honesty) | pending |
| `npm run check` (tsc) | pending |
| `npm run lint` | pending |
| `npm run build` | pending |

## Blockers

1. **LaunchAuthorizer key** — `LAUNCH_AUTHORIZER_PRIVATE_KEY` is not in this environment. Sign on Launch stays disabled. No fabricated auth.
2. **First Moment market** — coin and curve remain `null`. RLUSD Trade review stays disabled.
3. **Funding / Squid** — no live USDC→RLUSD quote. Testnet Buy remains fail-closed.
4. **Mainnet / M4 / public X write** — CLOSED by policy.

## Rollback

```
git revert <SHA>
```

Keep factory pin `0xd2b7…` and gSWAP bindings if a later commit must be dropped. Do not point the console at mainnet `1440000`.

## Screenshots

Captured after local production build. Paths:

- `/opt/cursor/artifacts/screenshots/` (filled after verification)
