# GRAAV Testnet Console

Tabbed GRAAV product shell on XRPL EVM Testnet (same Next.js app).

- **Public URL:** https://graav-testnet-console.vercel.app
- **Path:** `/workspace/sandbox-labs/graav/testnet-console/`
- **Signing sessions (S):** `https://graav-testnet-console.vercel.app/s/{id}`

## Tabs

| Tab | Status |
|-----|--------|
| Trade | Live — create/load/buy/sell/graduate on Factory (chain 1449000) |
| Portfolio | Live — native XRP + Factory ERC-20 balances |
| Cross-chain | Gated — no proven automated route; Buy-from-Base/Eth disabled. Base Sepolia USDC→RLUSD corridor verdict: `GET /api/crosschain/corridor/base-sepolia` (424 while FAIL/HOLD; see `docs/xchain/`) |
| Chat | Local intents only — handoff to Trade with Sign in wallet |
| X | Identity bind + capability matrix; mention bot scaffold; FEATURE_PUBLIC_X_WRITE=false |

## Signing session S

Chat / Grok / XBot **never** send txs. They mint a URL only:

`https://graav-testnet-console.vercel.app/s/{id}`

User opens the page → Connect MetaMask → switch to chainId **1449000** → wallet signs. Server holds **no** key. A tweet is not a buy.

### Allowlist (fail-closed)

See `docs/TESTNET_REGISTRY.md` and Protocol SoT `S_SESSION_BIND_ABI.md`:

| Role | Address |
|------|---------|
| M2 Factory (curve/memes/T589) | `0x72be5a300956f9dF0F4264a4211251dD17CA276B` |
| M2.2 Factory (post-grad / gSWAP) | `0x8f2D4E36ec0Ef2e55e0073830C22C8f863D89076` |
| TestDex V2 | `0xA3f6a5c32842FF045B5Eb628141210466E39ED83` |
| TestDex V1 (scar — never swap) | `0x60335a73798c4AA4fB6fB4b14C5ECa1263a4A874` |
| gSWAP market → **must bind M2.2** | `0x7a4bCfF97A33F408F356B9B54fd5709dCA34078a` |
| Attribution V1 Factory (tip · stack2 · TEMPLATE_VERSION 2) | `0x3d826B1495d517bA9fa1721b7e0CDB0513461e68` |
| Coin Soft Factory (RLUSD lane, separate) | `0xd2b7C9D3df75b081c4CB01F711D31D06263EbA20` |

- Dual-factory: reject gSWAP bound to M2 factory.
- Attribution V1 tip (stack2): Guardian `0x8c78Ff4462dBDDEeB4eEDdc92e739101e82217e0` · AttributionVerifier `0xE04763CdC4779deBc2293bacd4F98d5D7B82f322` · GraduationManager `0x5eD78c0ac98aEA25dd3f123a5654Ac5531220211` · LiquidityVault `0xF9E6E3D238a7AA4304229aB527a3e4c2d131bc49`. `buyWithAttribution` `0xada7290b`, depth-4 hops. No market pinned yet → buy/sell fail closed. Retired stack1 `0xc5D6…` is never pinned. See `docs/x/ATTRIBUTION_V1_TIP_PIN_STACK2_1449000.md`.
- Gate post-grad on `market.graduated()` (not Factory flag).
- Swap requires `graduated()==true` and `tokenToLpId(token)!=0` on V2 only.

### APIs

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/s` | Mint session → `{ id, url, status, payload }` |
| `GET` | `/api/s/{id}` | Status: pending / signed / expired / invalid (no keys) |
| `POST` | `/api/s/{id}` | Mark signed `{ txHash }` (best-effort) |

Sample create (gSWAP swap on M2.2):

```bash
curl -sS -X POST https://graav-testnet-console.vercel.app/api/s \
  -H 'content-type: application/json' \
  -d '{
    "chainId": 1449000,
    "factory": "0x8f2D4E36ec0Ef2e55e0073830C22C8f863D89076",
    "market": "0x7a4bCfF97A33F408F356B9B54fd5709dCA34078a",
    "dex": "0xA3f6a5c32842FF045B5Eb628141210466E39ED83",
    "token": "0x03411DfEB2CBaC4EEA48CE9Aa57c8F4B12EB7C0a",
    "action": "swap",
    "amount": "0.01",
    "minOut": "0",
    "swapSide": "xrpToToken",
    "ttlSec": 900
  }'
```

Open the returned `url` (`/s/{id}`) in MetaMask.

Optional env: `SESSION_SIGNING_SECRET` (falls back to `X_SESSION_SECRET` / local dev default). Never put keys in client code.

## X identity bind (OAuth 2.0)

Connect X / Sign in with X is **identity only**. It never posts, never DMs, never authorizes trades. Public X write stays CLOSED.

| Item | Value |
|------|-------|
| Flow | Authorization Code + PKCE (confidential client) |
| Scopes | `users.read tweet.read offline.access` |
| Start | `GET /api/auth/x` |
| Callback | `GET /api/auth/x/callback` |
| Session | `GET /api/auth/x/me` · logout `POST/GET /api/auth/x/logout` |
| Callback URL | `https://graav-testnet-console.vercel.app/api/auth/x/callback` |

Env (see `.env.example`):

- `NEXT_PUBLIC_X_CLIENT_ID` — public client id
- `X_CLIENT_SECRET` — server-only
- `NEXT_PUBLIC_APP_URL` — optional absolute origin for redirect_uri
- `X_SESSION_SECRET` — optional signing secret for identity cookie
- `SESSION_SIGNING_SECRET` — optional HMAC for `/s/{id}` opaque ids
- `NEXT_PUBLIC_X_PRODUCT_USER_ID` — optional numeric id of `@graav_xyz`; when set, DM CTAs deep-link the X compose sheet (otherwise they open the profile). Composer/DM CTAs only ever open x.com — the console never posts or sends.

Without credentials, Connect X stays an honest stub. Session cookie stores `{id, username, name}` only (httpOnly); access tokens are not exposed to client JS.

## Product @graav_xyz mention bot (scaffold)

Product operator identity is **`@graav_xyz`** — never personal `@Josh_XRPL`. Chat ≠ authorization; tweets never send txs; replies emit `https://graav-testnet-console.vercel.app/s/{id}` only.

### Spine status

| Path | Status |
|------|--------|
| Console Chat → `/api/s` | CONNECTED |
| Connect X identity OAuth | CONNECTED (env set) |
| X API read mentions | SCAFFOLD / BLOCKED on product keys |
| X bot `reply-session` | SCAFFOLD (dry-run mints `/s`; no public post) |
| Cron `x-auto-reply` | SCAFFOLD — auto dry-run while write is CLOSED (mints `/s`, no claim, no post); `?fixtures=1` matrix needs no X keys |
| Public X write | CLOSED (`FEATURE_PUBLIC_X_WRITE=false`) |

### Cron coverage matrix (buy / sell / create / MOMENT)

SoT: `docs/x/CRON_COVERAGE_MATRIX_2026-09-11.md` · live view: `GET /api/x/coverage` and the X tab.

| Intent | Status | Opens with |
|--------|--------|------------|
| buy `$g589` (M2 curve) · buy `$gSWAP` (V2 swap, M2.2) · sell `$g589` | READY — `/s` signable today | `FEATURE_PUBLIC_X_WRITE=true` + product token |
| create `launch $TICKER` | SOFT_READY — `/s` minted on the Coin V1 factory with `originTweetId` + `replyTweetId` + `originHash` bound; Sign closed | `/s` Coin V1 sign rail (LaunchAuthorizer), then the flag |
| MOMENT buy / sell | BLOCKED — coin/curve `null` | first signed `createCoin` + `/s` RLUSD approve+buy rail |
| two cashtags · missing `$` · percent sell · bad ticker | BLOCKED (fail-closed) | — |

Soft-ready bind: `replyTweetId` = the mention; `originTweetId` = quoted post › replied-to post › the mention itself; create adds `originHash = keccak256(utf8(originTweetId))` (= Coin V1 `sourcePostId`).

### Env checklist (Vercel Production)

| Key | State |
|-----|-------|
| `NEXT_PUBLIC_X_CLIENT_ID` | already set |
| `X_CLIENT_SECRET` | already set |
| `NEXT_PUBLIC_APP_URL` | already set |
| `FEATURE_PUBLIC_X_WRITE` | keep **false** until keys + explicit GO |
| `X_BEARER_TOKEN` | needed from Josh (app-only read) |
| `X_PRODUCT_USER_ID` | needed from Josh (`@graav_xyz` numeric id) |
| `X_BOT_USER_ACCESS_TOKEN` | needed from Josh (alias `X_PRODUCT_ACCESS_TOKEN`) |
| `X_PRODUCT_CLIENT_ID` / `X_PRODUCT_CLIENT_SECRET` | optional |
| `X_SESSION_SECRET` / `SESSION_SIGNING_SECRET` / `CONSOLE_PUBLIC_ORIGIN` | optional |

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/x/capabilities` | Capability matrix + spine + env checklist (`?probeMentions=1`) |
| `GET` | `/api/x/mentions` | Capability only; `?live=1` hits X mentions |
| `GET` | `/api/x/coverage` | Cron coverage matrix — canonical buy / sell / create / MOMENT fixtures through the cron path (no X read, no post; 60 s sessions) |
| `POST` | `/api/x/reply-session` | Parse mention intent → mint `/api/s`; returns `coverage`; posts only if feature+token+`dryRun:false`+signable rail (default `dryRun`) |
| `GET/POST` | `/api/cron/x-auto-reply` | `CRON_SECRET`. Auto dry-run while write is CLOSED; `?dryRun=1` forces; `?fixtures=1` runs the matrix without X keys; live posts READY rows only |

Intents match ChatTab allowlist (`buy $g589 0.1`, `buy $gSWAP 0.1`, …). Dual-factory unchanged. One cashtag per API post. Quote-post API is Enterprise.

## Safety

- Banner: TESTNET · not mainnet · chat ≠ authorization
- Fail-closed unless chainId === 1449000 for Trade / S txs
- Wallet signs only; chat never authorizes
- No invented Squid bridges; public X write env-gated (`FEATURE_PUBLIC_X_WRITE=false`)
- Connect X OAuth: no tweet.write / DM scopes (identity only); product bot uses separate token when opened
- Mock XChat (if any) is a separate URL
- No K2 kernel broadcast from this app

## MetaMask

| Field | Value |
|-------|-------|
| RPC | https://rpc.testnet.xrplevm.org |
| Chain ID | 1449000 |
| Symbol | XRP |
| Explorer | https://explorer.testnet.xrplevm.org |
| Faucet | https://faucet.xrplevm.org |
| M2 Factory | 0x72be5a300956f9dF0F4264a4211251dD17CA276B |
| M2.2 Factory | 0x8f2D4E36ec0Ef2e55e0073830C22C8f863D89076 |
| Attribution V1 Factory (tip · stack2) | 0x3d826B1495d517bA9fa1721b7e0CDB0513461e68 |

T589 market is graduated on v1 scar (no swap). Use gSWAP (M2.2 + V2) for post-grad swap prove, or a fresh meme ticker for curve buy/sell.
