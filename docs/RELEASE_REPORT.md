# GRAAV Testnet Console RC — Release Report

Reviewable RC only. Do not merge, publish, deploy, or broadcast.

## Identity

| Field | Value |
| --- | --- |
| Branch | `cursor/graav-testnet-console-rc-d549` |
| SHA | `fe12a06dce908889e98e720f4ccd2c8b3cfd5c1b` |
| Factory | `0xd2b7C9D3df75b081c4CB01F711D31D06263EbA20` |
| Chain | `1449000` XRPL EVM Testnet |
| Quote | RLUSD `0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F` |
| Authorizer | `0xBA100b11adF478B3B96Ce2F2BebFBd8Cf2E4E336` |
| Fee split | 40 / 35 / 20 / 5 |
| gSWAP | retained (`0x7a4bCfF97A33F408F356B9B54fd5709dCA34078a`) |
| Coin / curve | `null` (first create pending) |

## Visual

Monochrome light / dark / system tokens from the attached SoT. Existing GRAAV header lockup preserved (inverted in light theme). Responsive Markets / Trade / Launch / Portfolio / Chat / Funding / Profile. Theme preference persists in `localStorage` (`graav-theme`); boot script prevents flash.

## Tests (local)

| Check | Result |
| --- | --- |
| `npm test` (chat 8 + rlusd 27 + rc honesty 7) | PASS |
| `npm run check` (tsc) | PASS |
| `npm run lint` | PASS (3 pre-existing `@next/next/no-img-element` warnings) |
| `npm run build` | PASS |

## Blockers

1. **LaunchAuthorizer key** — `LAUNCH_AUTHORIZER_PRIVATE_KEY` is not configured here. Launch Sign stays disabled. No fabricated auth.
2. **First Moment market** — coin and curve remain `null`. RLUSD Trade review stays disabled.
3. **Funding / Squid** — no live USDC→RLUSD quote. Testnet Buy remains fail-closed.
4. **Mainnet / M4 / public X write** — CLOSED by policy.

## Rollback

```
git revert <this-branch-SHA>
```

Keep factory pin `0xd2b7…` and gSWAP bindings if a later commit must be dropped. Do not point the console at mainnet `1440000`.

## Screenshots

Actual implemented-app captures (light + dark × 390 / 768 / 1440):

- `/opt/cursor/artifacts/screenshots/rc-light-1440-markets.png`
- `/opt/cursor/artifacts/screenshots/rc-dark-1440-markets.png`
- `/opt/cursor/artifacts/screenshots/rc-light-390-markets.png`
- `/opt/cursor/artifacts/screenshots/rc-dark-390-launch.png`
- `/opt/cursor/artifacts/screenshots/rc-dark-390-trade-moment.png`
- `/opt/cursor/artifacts/screenshots/rc-dark-390-trade-gswap.png`
- Full set: `/opt/cursor/artifacts/screenshots/rc-{light,dark}-{390,768,1440}-{markets,launch,trade-gswap,trade-moment,portfolio,chat,funding,you}.png`
