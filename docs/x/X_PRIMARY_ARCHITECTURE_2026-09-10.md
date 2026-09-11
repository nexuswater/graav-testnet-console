# GRAAV X-primary architecture — 2026-09-10

Origin SoT for `josh-xrpl/graav-testnet-console`. UI / copy / framing + this document. **No live X write. No spend. No Production.**

Josh FULL SEND GO + AUTHORIZE (Exec) 2026-09-11. Elevated locks folded the same day.

## Locks

### 1. Daily ops are fully X

Posts, **reposts**, and **DMs**. DMs are the **same actions, privately**.

On X (public or DM to `@graav_xyz`):

- Launch `$ticker`
- Buy / sell / swap
- Portfolio
- RT / share attribution rewards

Chat ≠ authorization. Tweets and DMs never send txs. GRAAV replies with a `/s/{id}` signing link only.

Public X write stays **CLOSED** (`FEATURE_PUBLIC_X_WRITE` unchanged). This console does not post, repost, or send DMs. Composer / open-X and dry-run remain design-only.

### 2. graav.xyz is the product desk — not throwaway

The app is **setup, account, and charts** — polished, not a paste box.

After setup, **daily ops = X**.

In-app Launch (paste-link) and in-app Trade are **fallback / advanced** only (testnet).

### 3. Post-create handoff

After Launch `$ticker` on X → GRAAV hands a `/s` link → wallet sign.

Optional: how much Test RLUSD to seed the market (review-only on this desk; nothing spends until the wallet signs). Signature or nothing.

### 4. Attribution V1 (copy / SoT — not a live splitter here)

Fee SoT: **60 creator / 25 protocol / 15 distributor**.

The distributor **15** decays multi-hop, **depth 4**: **40 / 25 / 20 / 15 of that 15**.

- **Missing hop → protocol.** An unfilled hop is not re-spread; it accrues to protocol.
- **Creator = original poster.** The creator share follows the original post, not the repost.
- **Pay once.** One credit per verified buy; no double-pay across hops or reposts.

Kernel lab **CODE READY**: `buyWithAttribution` selector `0xada7290b`, forge **20/20**. The console may reference it. **No tip redeploy in this PR. Do not invent tip addresses.**

> **2026-09-11 addendum (Exec remint, separate PR):** the Attribution V1 tip was reminted as **stack2** (TEMPLATE_VERSION 2) and pinned from the Exec deployment record — Factory `0x3d826B1495d517bA9fa1721b7e0CDB0513461e68`, Guardian `0x8c78Ff…17e0`, AttributionVerifier `0xE04763…f322`, GraduationManager `0x5eD78c…0211`, LiquidityVault `0xF9E6E3…bc49`. Exec smoke PASS (createMarket + buy + buyWithAttribution attributed=true). Retired stack1 `0xc5D6…` is not pinned; Coin Soft Factory `0xd2b7…` is untouched. The 60 / 25 / 15 SoT copy above is unchanged. Record: `docs/x/ATTRIBUTION_V1_TIP_PIN_STACK2_1449000.md`.

RT / share rewards are X-native. Bind on graav.xyz (account) is identity for those rewards — it never authorizes a trade.

RLUSD **quote display** on Coin V1 remains Test RLUSD. Do not mix the 60/25/15 attribution SoT with the Coin V1 `40/35/20/5` quote-fee policy.

### 5. Cross-chain testnet corridor (Funding)

Home is **XRPL EVM Testnet `1449000` + Test RLUSD**.

**Inbound corridor order: Base Sepolia → RLUSD on XRPL EVM testnet FIRST (Aggregated / Squid).** It is the only corridor wired for route checks this slice. **Arbitrum only after Base PASS. Robinhood / Hyperliquid later.**

Route checks (all must be OK before any Buy): dest listed · source listed · USDC on Base Sepolia · RLUSD on xrpl-evm (ITS) · live Squid USDC→RLUSD quote + depth smoke · signed quote + tx rail wired. Live quote and tx rail are **not** wired this slice, so the gate reads **FAIL-CLOSED**. **Buy is never enabled without a live quote.**

**Not probed this slice:** Arbitrum Sepolia (next, only after Base PASS) · Robinhood · Hyperliquid (later).

**Fail-closed:** no live route = no Buy. Catalog presence ≠ live quote. No corridor is invented. Funding is the only cross-chain story; daily ops stay on X.

### 6. Paste-link Launch

Secondary / advanced / testnet fallback. Primary create is post, repost, or DM on X.

### 7. Surface hygiene

- MetaMask / Base / OKX stay monochrome-clean
- No g589 or `$MOMENT` as primary Launch/CTA promote
- Chat ≠ authorization

### 8. Explicit non-goals

- No `FEATURE_PUBLIC_X_WRITE` open
- No new write rails, remint, Production, or live DM/XChat spine
- No econ/ABI mutation or tip redeploy from this document
