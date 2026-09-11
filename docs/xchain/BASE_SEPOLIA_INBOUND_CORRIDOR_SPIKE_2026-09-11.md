# GRAAV Base Sepolia inbound corridor spike — 2026-09-11

## Result

**FAIL — fail-closed.** No provider routes Base Sepolia USDC (84532) to RLUSD on XRPL EVM testnet (1449000). Every lane returned a definitive negative on live data (all provider calls HTTP 200; Squid schema rejections HTTP 400). The path is now wired so that Buy can only open on a live exact quote plus a reviewed execution adapter; today `verdict=FAIL`, `buyEnabled=false`, endpoint answers `424`.

No Production deploy, no mainnet `1440000` transaction, no signed or broadcast transaction of any kind was performed. Arbitrum / Robinhood / Hyperliquid untouched.

Machine-readable evidence: [`BASE_SEPOLIA_INBOUND_CORRIDOR_EVIDENCE_2026-09-11.json`](./BASE_SEPOLIA_INBOUND_CORRIDOR_EVIDENCE_2026-09-11.json).

## Identity

| Item | Value |
| --- | --- |
| Source | Base Sepolia `84532` · Axelar `base-sepolia` · RPC `https://sepolia.base.org` |
| Source asset | USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` (6 dec; on-chain `USDC`/`USDC`, 1798 code bytes) |
| Destination | XRPL EVM Testnet `1449000` · Axelar `xrpl-evm` · RPC `https://rpc.testnet.xrplevm.org` |
| Destination asset (console quote) | RLUSD display · on-chain `MockRLUSD`/`mRLUSD` `0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F` (18 dec) |
| Other "Test RLUSD" on 1449000 | `0x61F16049EBdC3BB505b0dBeeb31DE09C3AEf53f7` — `RLUSD`/`RLUSD`, 18 dec, 100,000 fixed supply, plain `Token.sol`, no ITS / NTT hooks (`interchainTokenId()`, `interchainTokenService()`, `owner()`, `minter()` all revert). Not bridge-backed; not the console quote asset. |
| Profile | `testnet-clone` (`RLUSD_V1.chainId=1449000`, `liveExecutionEnabled=true` for the local rail only) |
| Squid integrator | not configured in this environment; probes used the public `test` id |

## Verdict matrix

| Lane | Verdict | Evidence |
| --- | --- | --- |
| **Squid v2** (RLUSD routing provider of record) | **FAIL** | `/v2/chains` 200 → 82 chains, zero testnets, no `84532`, no `1449000`, no `1440000` for the public id. `/v2/tokens?chainId=84532` → 400 `SCHEMA_VALIDATION_ERROR "chainId: 84532 unsupported chain id"`. `/v2/tokens?chainId=1449000` → 400 same. `POST /v2/route quoteOnly` 84532 USDC → 1449000 `0x04B9…` → 400 `"fromChain: 84532 unsupported chain id"`. Schema-level rejection is definitive regardless of integrator. |
| **Axelar testnet ITS / gateway** (native XRPL EVM bridge) | **FAIL** | `getChains` 200 → `base-sepolia` 84532 and `xrpl-evm` 1449000 both listed. `getITSAssets` 200 → 4 assets total: on `xrpl-evm` only `XRP` (xrpl↔xrpl-evm) and `SQD`; **no RLUSD, no USDC ITS anywhere; zero ITS assets on `base-sepolia`**. `getAssets` 200 → `uausdc` (aUSDC `0x254d06f3…`) exists on `base-sepolia` but **not on `xrpl-evm`**; no gateway asset on `xrpl-evm`. Catalog presence of both chains ≠ a deliverable asset. |
| **LI.FI** | **FAIL** | `/v1/chains` 200 → 70 chains; lists `84532` (`bast`, testnet) and USDC on it; no `1449000`/`1440000`. `/v1/quote` 84532 → 1449000 → 400 code 1011 `"/toChain must be equal to one of the allowed values"`. `/v1/connections?fromChain=84532` → 400, empty. |
| **deBridge DLN** | **FAIL** | `supported-chains-info` 200 → 17 chains; no `84532`, no `1449000`. |
| **Circle CCTP** | **FAIL** | Base is domain 6 (Sepolia included); XRPL EVM is not a CCTP domain. Cannot land native USDC on 1449000, and CCTP never yields RLUSD. |
| **Wormhole** | **FAIL** | SDK enumerates `XRPLEVM` (57) and `BaseSepolia` (10004); testnet Core `0xaBf89de7…` and Token Bridge `0x7d8eBc21…` have code on 1449000. Token Bridge would deliver *wrapped USDC*, not RLUSD; no public quote API; testnet NTT list → 501. Per policy, SDK enum alone is never PASS. |
| **Test RLUSD on 1449000** | **FAIL** | Neither `0x04B9…` (console MockRLUSD) nor `0x61F1…` is registered with Axelar ITS or Wormhole NTT. No bridge can mint or release either token, so no automated route can terminate in RLUSD on testnet. |
| **Execution adapter** | **FAIL** | `BUY_ADAPTER_NOT_CONFIGURED` — no reviewed destination Buy adapter exists (`allowlistedBuyAdapter().enabled === false`). Required in addition to a route PASS. |
| Squid mainnet lane `8453 → 1440000` RLUSD | **HOLD** (out of scope) | Context only, no execution: docs list `xrpl-evm 1440000` and XRPL RLUSD via Squid Intents, gated on an Intents-enabled integrator id. Public id: `/v2/tokens?chainId=1440000` → 200 `{}`; `POST /v2/route quoteOnly` 8453 USDC → 1440000 RLUSD `0x8d58…` → 500 `BAD_REQUEST "Low liquidity"`. Axelar mainnet ITS has no RLUSD (RLUSD on XRPL EVM mainnet is Wormhole NTT). Needs `SQUID_INTEGRATOR_ID` from Josh; No Production. |
| RLUSD NTT on testnet | **HOLD** (unknown) | Wormholescan testnet NTT list not implemented (501); no NTT-managed RLUSD found on 1449000 by contract inspection. |

Overall: **route FAIL, Buy closed.** HOLD items are informational and do not soften the testnet verdict.

## Repo investigation (Squid / RLUSD / aggregation)

| Surface | Finding |
| --- | --- |
| `src/app/api/crosschain/probe/route.ts` | Generic provider matrix (Squid, Axelar, LI.FI, deBridge, LZ, Wormhole, Socket, Skip) for 10 sources. Honest, but PASS is impossible by construction: `anyRealPass = false`, `squidQuoteLive = false`, `settleReady = false`, `buyEnabled = false` are constants. No live evidence can ever flip a leg; nothing corridor-specific for Base Sepolia. |
| `src/lib/rlusd-v1/ingress.ts` | Squid v2 metadata adapter (`fetchSquidMetadata`), exact-destination quote-only request builder (`buildRlusdQuoteRequest`, throws unless dest chain + exact quote token listed), and a permanently disabled `allowlistedBuyAdapter` (`BUY_ADAPTER_NOT_CONFIGURED`). Never called by any route for a quote. |
| `src/app/api/rlusd/ingress/metadata/route.ts` | Read-only catalog; 424 on `provider_gap`; requires `SQUID_INTEGRATOR_ID` (returns `SQUID_INTEGRATOR_ID_NOT_CONFIGURED` otherwise). |
| `src/lib/rlusd-v1/crosschain.ts` | Route state machine (`DRAFT → … → COMPLETE`) and `verifyDestinationBuy` proof checker; unused by any live path. |
| `src/components/tabs/CrossChainTab.tsx` | Funding tab: fail-closed copy, provider matrix behind Details, `Buy from <source>` always disabled. |
| `docs/RELEASE_REPORT.md` | Blocker 3: "Funding / Squid — no live USDC→RLUSD quote. Testnet Buy remains fail-closed." Consistent with this spike. |
| Tests | `tests/rlusd-ingress.test.ts` covers the adapter with fixtures; no test exercised a corridor verdict or the no-route-call invariant. |

Gap closed by this spike: the console had no evaluator that could turn *live* evidence into a PASS/FAIL/HOLD verdict for one corridor, with Buy chained to that verdict. It now does, and the verdict is FAIL.

## What was wired

- `src/lib/rlusd-v1/baseSepoliaCorridor.ts`
  - `evaluateBaseSepoliaCorridor(evidence, adapter)` — pure. Gates: `source-chain`, `source-usdc`, `dest-chain`, `dest-rlusd`, `live-quote`, `native-bridge-asset`, `execution-adapter`. Route verdict is PASS only when all five Squid gates PASS on live data; FAIL on any definitive negative; HOLD when evidence is incomplete (429 / 5xx / network) or when Axelar shows the exact quote asset on both chains (manual bridge, not automated). `buyEnabled = verdict === "PASS" && adapter.enabled`.
  - `probeBaseSepoliaCorridor()` — read-only collector: Squid `/v2/chains`, then `/v2/tokens` only for chains actually listed, then `POST /v2/route` **only after every catalog gate passes**, always `quoteOnly: true`, never surfacing `transactionRequest`. Axelar testnet chains/ITS/gateway and LI.FI chains are evidence lanes.
- `GET /api/crosschain/corridor/base-sepolia` — `200` on PASS, `424` on FAIL/HOLD, `Cache-Control: no-store`, `liveExecutionEnabled: false` always.
- Funding tab `BaseSepoliaCorridorCard` — verdict pill, summary, `buyEnabled`, adapter reason, gate list behind Details, **Buy from Base Sepolia** disabled unless the server report says `buyEnabled`.
- `tests/base-sepolia-corridor.test.ts` (8, in `npm test`): live-shaped evidence → FAIL with zero `/v2/route` and zero token calls; outage → HOLD; synthetic exact quote → route PASS but Buy closed without adapter (and `buyEnabled` true once an adapter is enabled, proving the chain); quote to `0x61F1…` or zero amount → FAIL; schema rejection FAIL vs throttling HOLD; exact Axelar ITS asset → HOLD not PASS; corridor identity pinned.

## Live run (this branch, `next dev`)

```
GET /api/crosschain/corridor/base-sepolia
HTTP/1.1 424 Failed Dependency
cache-control: no-store

verdict=FAIL buyEnabled=false liveExecutionEnabled=false
executionAdapter={enabled:false, reason:"BUY_ADAPTER_NOT_CONFIGURED"}
source-chain        FAIL  Squid /v2/chains does not list 84532 (82 chains, no testnets).
source-usdc         FAIL  Not queried: chain 84532 absent from Squid /v2/chains
dest-chain          FAIL  Squid /v2/chains does not list 1449000 (82 chains).
dest-rlusd          FAIL  Not queried: chain 1449000 absent from Squid /v2/chains
live-quote          FAIL  Quote not requested: catalog gates did not pass; no route request sent
native-bridge-asset FAIL  No USDC or RLUSD asset spans base-sepolia and xrpl-evm on Axelar testnet.
                          ITS on xrpl-evm: [XRP, SQD]; gateway on xrpl-evm: [none].
execution-adapter   FAIL  BUY_ADAPTER_NOT_CONFIGURED
lanes: squid "public-probe: 82 chains; 84532=no 1449000=no"
       axelar "77 chains; ITS assets 4; gateway assets 27"
       lifi "70 chains; 84532=yes 1449000=no (catalog only, no RLUSD lane)"
provider calls: 5 · all HTTP 200 · 0 route requests
```

Checks: `npm test` (chat 8 + rlusd 27 + rc 7 + corridor 8) PASS · `npm run check` PASS · `npm run lint` PASS (3 pre-existing `no-img-element` warnings) · `npm run build` PASS (pre-existing `pino-pretty` optional-dependency warning from wallet connectors).

## Reproduce

```bash
# Squid: schema-level rejection of both corridor chains
curl -s -H 'x-integrator-id: test' 'https://v2.api.squidrouter.com/v2/tokens?chainId=84532'
curl -s -H 'x-integrator-id: test' 'https://v2.api.squidrouter.com/v2/tokens?chainId=1449000'
curl -s -X POST 'https://v2.api.squidrouter.com/v2/route' -H 'x-integrator-id: test' -H 'content-type: application/json' \
  -d '{"fromAddress":"0x000000000000000000000000000000000000dEaD","fromChain":"84532","fromToken":"0x036CbD53842c5426634e7929541eC2318f3dCF7e","fromAmount":"1000000","toChain":"1449000","toToken":"0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F","toAddress":"0x000000000000000000000000000000000000dEaD","quoteOnly":true}'

# Axelar testnet: nothing spans base-sepolia and xrpl-evm
curl -s https://testnet.api.axelarscan.io/api/getITSAssets | jq '[.[] | select(.chains|has("xrpl-evm")) | .symbol]'
curl -s https://testnet.api.axelarscan.io/api/getAssets   | jq '.[] | select(.denom=="uausdc") | .addresses | has("xrpl-evm")'

# Console
npm run test:corridor
npm run dev   # then: curl -i http://localhost:3000/api/crosschain/corridor/base-sepolia   → 424
```

## What flips the verdict (no code change required)

1. Squid lists `84532` and `1449000` with USDC and the exact quote token → the collector sends the quote-only request automatically; an exact positive quote flips `verdict` to PASS on live data. A quote landing any other token or chain stays FAIL.
2. A reviewed destination execution adapter is deployed and enabled → `buyEnabled` becomes true only together with (1).

Anything else (a Squid Intents integrator id for the mainnet lane, an ITS- or NTT-linked test RLUSD on 1449000) is a separate product decision and remains out of scope for this spike. Until then the corridor stays closed by evidence, not by a constant.
