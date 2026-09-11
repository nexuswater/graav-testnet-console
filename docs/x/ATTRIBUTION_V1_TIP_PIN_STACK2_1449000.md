# Attribution V1 tip — remint stack2 pinned (1449000)

**Status:** Soft CODE READY — console pinned to the Attribution V1 remint stack2. Exec on-chain smoke PASS. Reviewable PR only; no Production deploy.

## Active tip (stack2, TEMPLATE_VERSION 2)

| Contract | Address |
| --- | --- |
| Factory | `0x3d826B1495d517bA9fa1721b7e0CDB0513461e68` |
| Guardian | `0x8c78Ff4462dBDDEeB4eEDdc92e739101e82217e0` |
| AttributionVerifier | `0xE04763CdC4779deBc2293bacd4F98d5D7B82f322` |
| GraduationManager | `0x5eD78c0ac98aEA25dd3f123a5654Ac5531220211` |
| Vault | `0xF9E6E3D238a7AA4304229aB527a3e4c2d131bc49` |

Code pin: `src/lib/chain.ts` (`ATTRIBUTION_V1_STACK`). Machine-readable record: [`ATTRIBUTION_V1_TIP_PIN_STACK2_1449000.json`](./ATTRIBUTION_V1_TIP_PIN_STACK2_1449000.json).

## Wiring (public RPC reads)

- `Factory.TEMPLATE_VERSION()` → `2`
- `Factory.guardian()` → Guardian · `Factory.attributionVerifier()` → AttributionVerifier · `Factory.graduationManager()` → GraduationManager
- `GraduationManager.factory()` → Factory
- `Vault.factory()` → Factory · `Vault.graduationManager()` → GraduationManager

## Exec smoke — PASS

| Step | Tx | Result |
| --- | --- | --- |
| `createMarket` | `0xc7af058c1a4f0631502fbb154952c4ec0e1cd539e3a9be5a64f0976d307e6f70` | market #1 `0x5243…63C1`, templateVersion 2 |
| `buy` | `0x7862e0ea2b4a1c7607573cf1c7eaa4076bcc656b07ad84cbc3eb8303c1038299` | ok |
| `buyWithAttribution` | `0x2f916ad81c57fa07e8fb2cec3ce34cc769d6aaa777603d6261313c47d06a661f` | ok · `AttributionApplied(postId, distributor)` emitted → **attributed=true** |

The smoke market is Exec's test market only. It is **not** a product market and is **not** allowlisted.

## ABI

- `buyWithAttribution(uint256,(bytes32,address,address[4],address,uint64,uint64),bytes)` → selector **`0xada7290b`** (Attribution V1 multi-hop, depth-4 `address[4]` hops; unfilled hops are zero). Pinned in `attributionMarketAbi`.
- Template v2 `MarketCreated(uint256 indexed marketId, address indexed market, address indexed creator, address token, string name, string symbol, bytes32 originHash)` differs from M2 and is pinned in `attributionFactoryAbi`. `createMarket` / `getMarket` / `getMarketBySymbol` / `marketCount` selectors are unchanged from M2.
- Tuple field labels are console-side; the selector and calldata layout were verified against the smoke tx. The console never signs attribution proofs (`AttributionVerifier.signer` does).

## Console surface

- `/s/{id}` sessions accept the Attribution V1 Factory (`create`). Buy / sell stay fail-closed until a market is recorded — no market is pinned yet.
- Trade fallback resolves symbols on M2.2 → M2 → Attribution V1; existing dual-factory bindings (gSWAP → M2.2, g589 / T589 / memes → M2) never re-home.
- Rewards identity copy references the pinned tip instead of “no tip redeploy”.

## Rules honored

- Coin Soft Factory `0xd2b7C9D3df75b081c4CB01F711D31D06263EbA20` **UNTOUCHED** (separate RLUSD lane).
- Orphan / retired stack1 Factory `0xc5D6eb56A0776C6215589Be49DD100763C4346EF` **not pinned** (audit context only).
- Display **RLUSD**, never mRLUSD.
- Base Sepolia corridor stays **FAIL-CLOSED**.
- No Production. Reviewable PR only.
- X-primary Launch framing preserved: Launch on X → `/s` handoff → wallet signs. Chat ≠ authorization.

## Open observation for Exec (no copy changed)

Smoke fee buckets on 1e14 wei total fee: attributed buy (1 hop) `25e12 / 69e12 / 6e12`; `previewBuy(0.01 XRP)` unattributed `25e12 / 75e12 / 0`. The unfilled-hop remainder lands in the 60-side bucket. Please confirm against the SoT line “missing hop → protocol” before any econ copy changes.
