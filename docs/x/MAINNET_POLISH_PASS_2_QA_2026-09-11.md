# Polish pass 2/10 — QA checklist (2026-09-11)

Branch `cursor/polish-pass-2-a04f` on main `f6da3de` (#8 pass 1). Soft CODE READY. **No Production deploy. `FEATURE_PUBLIC_X_WRITE` CLOSED. No spend.**

Locks verified on every surface: one TESTNET cue (header pill only, now also on `/s` pages) · mock RLUSD `0x04B9…913F` displayed as **RLUSD** (never mRLUSD / Test RLUSD — `tests/rlusd-display.test.ts` still scans every UI file) · Base Sepolia corridor **FAIL / fail-closed** (0 of 7 gates at capture; `424` handled) · Attribution V1 stack2 Factory `0x3d826B…1e68` pinned (`tests/attribution-v1-pin.test.ts`) · Coin Soft `0xd2b7…bA20` untouched (display only on the Launch review) · no g589 / `$MOMENT` promote (examples stay `$HORMUZ` / gSWAP) · X-primary Launch preserved · every X CTA opens x.com (intent / DM compose) and nothing posts, sends, or spends.

Gates: `npm run check` ✓ · `npm run lint` ✓ **0 warnings** (the 3 pre-existing `no-img-element` remote-avatar tags now carry the same note the rest of the app uses) · `npm test` ✓ 91/91 · `npm run build` ✓ (pre-existing `pino-pretty` warning from WalletConnect).

Captures: `/opt/cursor/artifacts/screenshots/polish2-*.png` — dark + light × 390 / 1440 for every route below (`polish2-{dark,light}-{mobile,desktop}-*`), `polish2-{dark,light}-state-*` for empty / error / edge states, `polish2-dark-mobile-trade-scrolled` for the sticky header + nav. Taken against `next start` (production build). The walk also asserts: no horizontal overflow at 390, exactly one `TESTNET` cue per route, no `mRLUSD` / `Test RLUSD` in the DOM, the `/s` countdown ticks, and a short-TTL request flips to Expired on its own.

Legend: **✓** works · **⊘** disabled with a visible reason · **ℹ** informational (no action by design).

## Residual items from pass 1 — closed

| Pass 1 note | Pass 2 |
| --- | --- |
| `/you` Connect wallet: "honest error that WalletConnect signing for the link is not wired" | ✓ The identity link signs through the connected wagmi connector (`useSignTypedData` / `useSwitchChain`), so WalletConnect and injected wallets both work; the raw-provider path stays as the fallback. Wallet cancellations read "Cancelled in your wallet. Nothing was changed." instead of `BIND_ERROR`. |
| `/t/<ticker>` CTA "Connect wallet to sign here" printed "Connect your wallet first." | ✓ The CTA connects (WalletConnect) or switches network; ⊘ with the reason when no wallet connector is configured. |
| `/s/<id>` "expires in" never ticked; an expired request left **Sign in wallet** enabled | ✓ Live countdown; flips to **Expired** + "Blocked. This request expired…" on its own and refreshes status; wallet / copy / faucet controls hide; **Open Trade** · **Back to Markets** remain. Times render in the visitor's zone (was hardcoded Central). |
| `/new` "Origin (optional X URL)" was collected and dropped | ✓ Parsed (x.com link or numeric id) and bound as `originTweetId` + `originHash = keccak256(utf8(postId))` — the same rule the cron create path uses; invalid input ⊘ **Review and sign** with the reason. |
| Trade fired `GET /api/pfp/%3F` (400) while the symbol loaded | ✓ `TokenPfp` skips placeholder tickers. |
| 3 lint warnings | ✓ 0 |

## Shell (every page)

| Control | Behaviour |
| --- | --- |
| GRAAV lockup | ✓ → `/` |
| TESTNET pill | ℹ single cue; tooltip; `/s/<id>` and the invalid-session page now use the same pill |
| Desktop nav Markets · Launch · Portfolio · Chat | ✓ `aria-current` on the active item |
| Theme Light · Dark · Auto | ✓ persisted; no flash |
| Account ▾ | ✓ WalletConnect (⊘ muted + hint when the project id is not configured), Sign in with X (⊘ muted + hint when not configured — matches the wallet row now), wallet row → copy / Switch to XRPL EVM / Disconnect, X row → Sign out, **Account & rewards** → `/you`, **Trade on X ↗** once a wallet or X identity is present |
| Menu ≡ | ✓ Markets · Launch · Trade · Portfolio · Chat · Funding · X · Account · theme |
| Mobile bottom nav (4-up) | ✓ pinned on long pages (`polish2-dark-mobile-trade-scrolled`: header top 0, nav bottom = viewport) |
| Status banner | ✓ only when a status exists |

## Markets (`/`)

| Item | Behaviour |
| --- | --- |
| Hero + **Launch on X →** | ✓ → `/launch` |
| Network bar | ℹ `XRPL EVM · RLUSD / XRP` · `5 tradable · 8 listed` |
| Search | ✓ empty → "No coins match that search." (`polish2-*-state-markets-empty-search`) |
| All · New · Graduated | ✓ `role=tab` |
| Rows | ✓ XRP → `/t/<ticker>`, RLUSD → `/m/<id>`; tradable first; letter placeholder until the pfp loads |
| How it works | ℹ post → signing link → sign |

## Launch (`/launch`)

| Item | Behaviour |
| --- | --- |
| Hero | ✓ one line: "Post, repost, or DM **Launch $TICKER** to @graav_xyz. Quoted in RLUSD; your wallet signs." (the reply / sign flow lives once, in "What happens next") |
| Ticker | ✓ sanitised `[A-Z][A-Z0-9_]{0,14}`; `?ticker=` prefill |
| Draft preview | ✓ dimmed and labelled **Example draft** until a ticker is typed; **Your draft** after |
| Post to quote (optional) | ✓ invalid → "Paste a full x.com post link to quote-repost it." (`polish2-*-state-launch-bad-quote-link`) |
| **Post · Launch $TICKER** / **Quote-repost** / **DM @graav_xyz** / Copy draft | ✓ x.com intent / compose; ⊘ until the ticker is valid |
| Advanced · create from a post link | ✓ collapsed; Details → Review → Sign (`polish2-*-state-launch-advanced`, `-review`) |
| Review step | ✓ Name · Ticker · Source post · Quote RLUSD · Seed · Factory `0xd2b7…bA20` · Authorizer; the primary button is **Connect wallet** / **Switch to XRPL EVM** until the wallet is ready (it used to be a disabled "Continue to sign" with a hint); ⊘ with the reason when no wallet connector is configured |
| Sign step | ✓ **Sign in wallet** ⊘ until GRAAV authorization exists; `Coin created` + **Share on X** |

## Trade (`/?tab=Trade`)

| Item | Behaviour |
| --- | --- |
| Header | ✓ "Post or DM @graav_xyz and sign the link it sends, or sign here. Your wallet signs either way." (one custody statement; the two "never holds your key" hints under Buy / Swap are gone) |
| Ticker / address + **Load** | ✓ "Loading gSWAP…" then market; unknown → "No market found for "NOPE"." (`polish2-*-state-trade-not-found`) |
| Chips | ✓ `aria-pressed` on the loaded market |
| **Buy/Sell on X** + **DM** | ✓ bot-known markets; command preview |
| Wallet row | ✓ "Connect your wallet to sign here." + **Connect wallet**, or "Switch your wallet to XRPL EVM to sign here." + **Switch network**; honest "Wallet connection isn't available on this deployment yet — trade from X instead." when no connector (`polish2-*-state-trade-wallet-hint`) |
| Buy · Sell · Swap | ✓ real tabs (`role=tab` + `aria-selected`); graduated → Swap with Buy / Sell ⊘ explained |
| Forms · Details · Advanced · graduate · New market · Status card | ✓ unchanged from pass 1; **Share on X** once confirmed |

## Portfolio (`/?tab=Portfolio`)

| Item | Behaviour |
| --- | --- |
| Disconnected | ✓ "Holdings appear here once a wallet is connected." + **Connect wallet** (WalletConnect) or the honest unavailability line — no more "go to the account menu" |
| Wrong network | ✓ **Switch network** through the connected wallet first |
| XRP · **RLUSD** · Coins held · Markets | ✓ `—` / `…` / `Unknown`, never zero; RLUSD from `0x04B9…913F` |
| **Track** / **Track RLUSD in your wallet** | ✓ `wallet_watchAsset` through the connected connector (works over WalletConnect when the wallet supports it), injected fallback, honest error otherwise |
| Check from X | ✓ Post / DM |

## Funding (`/?tab=Funding`)

| Item | Behaviour |
| --- | --- |
| Header | ✓ one sentence; the gating rule lives on the corridor card |
| Base Sepolia → XRPL EVM | ✓ server verdict; **Not yet open**; 7 gates `—`; "0 of 7 checks pass" — **FAIL, fail-closed**; **Buy** ⊘ with tooltip; Re-check; NEXT / LATER; Details |
| Already on XRPL EVM? | ✓ **Buy on X** (primary) · **DM** · Open Trade · Get XRP (faucet) |
| Route diagnostics | ✓ unchanged (`polish2-*-state-funding-diagnostics`) |

## Chat (`/?tab=Chat`)

| Item | Behaviour |
| --- | --- |
| Header | ℹ "Chat previews only — it never signs or sends a transaction." (the welcome no longer repeats it) |
| LAUNCH / BUY / SELL / PORTFOLIO / help | ✓ same handoffs as pass 1 (`polish2-*-state-chat-replies`: Launch $HORMUZ on X + Post / DM; Swap gSWAP → Open signing link · Open Trade · Post / DM) |

## X (`/?tab=X`)

| Item | Behaviour |
| --- | --- |
| Commands ×4 | ✓ Post / DM |
| Sign in with X | ✓ OAuth when configured; ⊘ muted + hint when not (one "never posts / never authorizes" line, from the button block) |
| Share & earn · Integration status | ✓ unchanged; coverage `all as expected · ready 4 · soft 2 · blocked 6 · skip 2` (`polish2-*-state-x-integration`) |

## Account (`/you`)

| Item | Behaviour |
| --- | --- |
| Identity rows | ✓ X · Wallet · Bind with a one-line next step ("Sign in with X to start." → "Connect the wallet you trade with." → "Sign once to link…" → "Linked. Rewards earned on X credit this wallet.") |
| Sign in with X | ✓ OAuth when configured; the error now shows in the alert instead of throwing silently |
| Connect wallet | ✓ discovered injected wallet first, else WalletConnect; ⊘ honest error when neither exists |
| Sign to link / rebind / Revoke | ✓ signs through the connected connector; typed-data domain / identity checks intact; plain-language errors |
| **You're set — next on X** | ✓ once bound: Launch · Buy · Portfolio with Post / DM |
| Theme | ✓ `x1.css` colors resolve from tokens (alerts, borders, inputs, focus, headings) in dark and light |

## Market, session, and fallback routes

| Route | Behaviour |
| --- | --- |
| `/t/<ticker>` | ✓ CTA **Connect wallet** / **Switch to XRPL EVM** acts (⊘ with reason when no connector); Buy / Sell / Swap are real tabs; Sell shows 25 / 50 / 75 / 100 % of your balance (⊘ until a balance is known), Buy / Swap show XRP presets with `aria-pressed`; unlisted → alert + **Open Trade** (`polish2-*-state-market-unlisted`, `-sell-side`) |
| `/m/<id>` | ✓ not launched → **Launch a coin on X**; unknown → **Back to Markets** |
| `/s/<id>` | ✓ live countdown → Expired flip; **Open Trade** + **Back to Markets** when blocked / expired; WalletConnect / Copy link / Switch / Sign otherwise; **Share on X** once signed; bogus id → help page with **Ask @graav_xyz for a new link** + **Open Trade** (`polish2-*-state-session-pending`, `-expired`, `*-session-invalid`) |
| `/new` | ✓ small text inputs (a pasted URL no longer clips); origin post parsed and bound; disconnected copy is one sentence (**Connect wallet** when available, **Launch from X** otherwise); no raw session URL (`polish2-*-state-new-origin-invalid`, `-valid`) |
| `/coin` · 404 · error | ✓ unchanged |

## Known and honest

- `MarketChart` stays illustrative (no trade events to index); the label says so.
- Base Sepolia corridor reads FAIL/HOLD on live catalogs; Buy stays closed by design. The browser logs the `424` (pinned contract) and the deliberate 404 route as console errors — expected.
- Coin V1 Sign stays disabled until `LAUNCH_AUTHORIZER_PRIVATE_KEY` exists; RLUSD markets stay "Not launched" until the first signed create.
- The X1 0.1 XRP buy rail (`/s/<32-char id>`) still sends through the browser wallet (it pins the transaction nonce); it now says so plainly instead of "Connect your wallet first." when only WalletConnect is connected.
- This deployment has no `NEXT_PUBLIC_WC_PROJECT_ID` / `NEXT_PUBLIC_X_CLIENT_ID`, so the captures show the ⊘ states for wallet connection and Sign in with X.
