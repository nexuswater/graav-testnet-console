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

- Dual-factory: reject gSWAP bound to M2 factory.
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
| Public X write | CLOSED (`FEATURE_PUBLIC_X_WRITE=false`) |

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
| `POST` | `/api/x/reply-session` | Parse mention intent → mint `/api/s`; post reply only if feature+token (default `dryRun`) |

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

T589 market is graduated on v1 scar (no swap). Use gSWAP (M2.2 + V2) for post-grad swap prove, or a fresh meme ticker for curve buy/sell.
