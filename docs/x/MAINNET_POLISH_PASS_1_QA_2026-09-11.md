# Polish pass 1/10 — QA checklist (2026-09-11)

Branch `cursor/mainnet-polish-pass-1-c034` on main `9ff0764` (#6 cron coverage, #7 Attribution V1 tip pin). Soft CODE READY. **No Production deploy. `FEATURE_PUBLIC_X_WRITE` CLOSED. No spend.**

Locks verified on every surface: one TESTNET cue (header pill only) · mock RLUSD `0x04B9…913F` displayed as **RLUSD** (never mRLUSD / Test RLUSD) · no g589 / `$MOMENT` promote (g589 appears only as a listed row / chip, MOMENT only as a not-launched row) · every X CTA opens x.com (post / quote / DM compose) and nothing posts, sends, or spends · Base-first fail-closed Funding preserved from #4/#5/#6 · X-primary Launch preserved from #4.

Gates: `npm run check` ✓ · `npm run lint` ✓ (3 pre-existing `no-img-element`) · `npm test` ✓ 89/89 · `npm run build` ✓ (pre-existing `pino-pretty` warning from WalletConnect).

Captures: `/opt/cursor/artifacts/screenshots/polish1-*.png` — dark + light × 390 / 1440 for every surface below, scrolled mobile views (sticky header + nav), `/s/{id}` for a minted session, and `polish1-state-*` for the empty / error / edge states listed here.

Legend: **✓** works · **⊘** disabled with a visible reason · **ℹ** informational (no action by design).

## Shell (every page)

| Control | Behaviour |
| --- | --- |
| GRAAV lockup | ✓ → `/` |
| TESTNET pill | ℹ the single testnet cue; tooltip "XRPL EVM Testnet · test assets only" |
| Desktop nav Markets · Launch · Portfolio · Chat | ✓ switch tab on `/`, route elsewhere; `aria-current` on the active item |
| Theme Light · Dark · Auto | ✓ persists in `localStorage`; no flash on boot |
| Account ▾ | ✓ opens panel: WalletConnect (⊘ + hint when the project id is not configured), Sign in with X (⊘ hint when not configured), wallet row → copy address / Switch to XRPL EVM / Disconnect, X row → Sign out, **Account & rewards** → `/you` |
| Menu ≡ | ✓ Markets · Launch · Trade · Portfolio · Chat · Funding · X · Account · theme |
| Mobile bottom nav (4-up) | ✓ sticks to the viewport bottom on long pages (`polish1-dark-mobile-*-scrolled`) |
| Status banner | ✓ appears only when a status is set (wallet / network messages) |

## Markets (`/`)

| Item | Behaviour |
| --- | --- |
| Hero copy + **Launch on X →** | ✓ → `/launch`; one line on desktop |
| Network bar | ℹ `XRPL EVM · RLUSD / XRP` · `n tradable · m listed` |
| Search coins | ✓ filters ticker / name / quote / status; empty → "No coins match that search." (`polish1-state-markets-empty-search`) |
| All · New · Graduated | ✓ `role=tab` filters |
| Rows (pfp, ticker, name, quote, status, →) | ✓ XRP rows → `/t/<ticker>`; RLUSD rows → `/m/<id>`; tradable rows lead; pfp shows a letter placeholder until the image loads |
| How it works | ℹ three steps: post / repost / DM → signing link → sign |

## Launch (`/launch`)

| Item | Behaviour |
| --- | --- |
| ← Markets | ✓ |
| Ticker | ✓ sanitised to `[A-Z][A-Z0-9_]{0,14}`; hint with format |
| Post to quote (optional) | ✓ accepts x.com / twitter.com status links; invalid input → "Paste a full x.com post link to quote-repost it." (`polish1-state-launch-bad-quote-link`) |
| Draft preview | ℹ `Launch $TICKER` + `@graav_xyz` |
| **Post · Launch $TICKER** / **Quote-repost · Launch $TICKER** | ✓ `x.com/intent/post` (+ `url=` when quoting); ⊘ "Add a ticker to continue on X" until valid |
| **DM @graav_xyz** | ✓ compose deep link when `NEXT_PUBLIC_X_PRODUCT_USER_ID` is set, else the profile (hint says to tap Message); ⊘ until ticker valid |
| Copy draft | ✓ → "Draft copied"; ⊘ until ticker valid |
| What happens next | ℹ post → reply with signing link → review seed and sign |
| Advanced · create from a post link | ✓ collapsed by default (`polish1-state-launch-advanced`): stepper Details → Review → Sign; X post, Name, Ticker, Image upload (label opens the picker; default mark if skipped); **Review** ⊘ with "Add the post, a name, and a ticker to review." until ready; "Preparing…" while the image is prepared; errors in a `role=alert` |
| Review step | ✓ KVs Name · Ticker · Source post · Quote RLUSD · Seed · Factory · Authorizer; Seed field ("RLUSD. Nothing is spent until your wallet signs."); **Continue to sign** ⊘ with reason (connect / switch network / authorizer); Back |
| Sign step | ✓ **Sign in wallet** ⊘ until GRAAV authorization exists ("Launch authorization is unavailable right now. Sign stays disabled."); Back to review; tx hash + confirmation; `Coin created · token · curve` on success |

## Trade (`/?tab=Trade`)

| Item | Behaviour |
| --- | --- |
| Ticker / address + **Load** (Enter works) | ✓ M2.2 → M2 → Attribution V1 factories; "Loading <q>…" while reading; unknown → "No market found for "NOPE"." (`polish1-state-trade-not-found`); non-market address → "That address is not a GRAAV market." |
| Listed-market chips gSWAP · g589 · gPEPE · gDOGE · gFUZZY | ✓ load by symbol; `aria-pressed` on the loaded one |
| Market head | ✓ pfp, Graduated / On curve / Loading…, DEX-pool price for graduated markets ("Loading price…" / "Price unavailable" when unknown) |
| **Buy on X / Sell on X** + **DM @graav_xyz** | ✓ shown only for markets the mention bot resolves; command preview under the buttons |
| or sign here | ℹ divider |
| Wallet hint | ℹ "Connect your wallet to sign here." / "Switch your wallet to XRPL EVM to sign here." |
| Buy · Sell · Swap | ✓ graduated markets land on Swap; Buy / Sell show "This market graduated. Buy/Sell through Swap." with controls ⊘ |
| Buy form | ✓ amount + presets (`aria-pressed`), **Buy** ⊘ until wallet ready |
| Sell form | ✓ amount, **Approve** / **Approved**, **Sell** ⊘ until approved; "Approved: —" while unknown |
| Swap form | ✓ side toggle, amount, "Estimated receive", **Approve** for token → XRP, **Swap**; ⊘ with reason when swap unavailable (not graduated · legacy pool · DEX not configured · no pool) |
| Details | ✓ Market / Token explorer links, Curve reserve, Tokens on curve, Graduation threshold, Your balance ("Connect wallet" when disconnected), DEX, Pool XRP / Pool token, Chain |
| Advanced · graduate | ✓ hidden once graduated; **Graduate market** ⊘ until wallet ready; plain explanation |
| New market card | ✓ **Launch on X** → `/launch`, **In-app form** → `/new` |
| Status card | ✓ shown only when there is a status / tx / error; explorer link for the tx |

## Portfolio (`/?tab=Portfolio`)

| Item | Behaviour |
| --- | --- |
| Heading copy | ✓ "Connect a wallet to see your XRP and coin balances." / "Holdings for 0x… on XRPL EVM." |
| Refresh | ✓ "Refreshing…" while scanning |
| Wrong-network alert | ✓ **Switch network** (connected wallet first, injected fallback) |
| Summary XRP · Coins held · Markets | ✓ `—` while disconnected / unknown, never zero; faucet hint only when XRP is 0 |
| Holdings | ✓ "Scanning markets…" → "Connect a wallet from the account menu…" / "No markets found yet." / "No coins held yet. Buy from a post or DM on X, or open Trade." / rows with **Open** (→ `/t/<ticker>`) and **Track** (wallet `watchAsset`; honest error without a browser wallet) |
| Unreadable balances | ✓ "n balance(s) could not be read and are not shown as zero." |
| Check from X | ✓ `@graav_xyz portfolio` **Post** / **DM** |

## Funding (`/?tab=Funding`)

| Item | Behaviour |
| --- | --- |
| Heading copy | ✓ "Bring USDC in from another chain and land as RLUSD on XRPL EVM…" |
| Base Sepolia → XRPL EVM card | ✓ server verdict from `/api/crosschain/corridor/base-sepolia` (424 while FAIL/HOLD is handled); pill Checking / Open / Not yet open; 7 gate rows with OK / HOLD / —; "n of 7 checks pass…" |
| **Buy from Base Sepolia** | ⊘ until `report.buyEnabled` (tooltip "Opens once the live route checks pass") |
| Re-check | ✓ re-runs the probe |
| NEXT / LATER | ℹ Arbitrum Sepolia after Base opens · Robinhood Chain Testnet · HyperEVM Testnet |
| Details | ✓ per-gate detail, provider lanes (Squid · Axelar testnet · LI.FI), execution adapter, summary, call counts |
| Already on XRPL EVM? | ✓ **Get XRP (faucet)** (external), **Open Trade** |
| Route diagnostics | ✓ catalog checks (probe), aggregated path hops + KVs, routing lanes, destination wallet, providers, source chains with ⊘ Buy and reasons (`polish1-state-funding-diagnostics-desktop`); probe errors shown in a warn alert |

## Chat (`/?tab=Chat`)

| Item | Behaviour |
| --- | --- |
| Header | ℹ GRAAV · `@graav_xyz` · "Chat previews only — it never signs or sends a transaction." |
| Welcome | ℹ commands + examples (HORMUZ / gSWAP; no g589 / MOMENT) |
| Input + **Send** | ✓ Send ⊘ while empty or busy |
| BUY / SELL known market | ✓ preview + **Open signing link** (minted `/s`), **Open Trade**, **Post on X** / **DM**; mint failure → "Couldn't create a signing link (…). Use Trade instead." |
| BUY unknown market | ✓ "…not configured for a signing link yet. Open Trade to review." + Open Trade |
| LAUNCH <ticker> | ✓ **Launch $TICKER on X** (→ `/launch?ticker=`), Post on X / DM (`polish1-state-chat-launch`); bad ticker → "Bad ticker "…" — use 1–15 letters…" |
| PORTFOLIO | ✓ **Open Portfolio** + Post / DM |
| Anything else | ✓ help reply listing the commands (`polish1-state-chat-help`) |

## X (`/?tab=X`)

| Item | Behaviour |
| --- | --- |
| Commands Launch · Buy · Sell · Portfolio | ✓ each row **Post** / **DM** opens x.com prefilled |
| Sign in with X | ✓ OAuth start when configured; honest hint when not |
| Share & earn | ℹ attribution V1 rule; "Payouts are not live yet." |
| Integration status (collapsed; summary shows coverage counts) | ✓ Reply coverage matrix (#6) with **Re-run**; Capabilities with **Refresh** / **Check mentions**; PUBLIC REPLIES CLOSED with reason and env keys; spine; env checklist (set / needed / closed); **Dry-run a reply** (`polish1-state-x-integration-desktop`) |

## Account (`/you`)

| Item | Behaviour |
| --- | --- |
| Identity rows X · Wallet · Bind | ✓ Not signed in / Not connected / Not bound until linked |
| Sign in with X | ✓ OAuth when configured; error text when not |
| Connect wallet | ✓ browser wallet; honest error that WalletConnect signing for the link is not wired |
| Sign to link / Sign to rebind / Revoke bind | ⊘ until X + wallet are present; typed-data domain checks stay |
| Attribution V1 + Share rewards | ℹ rule text; rewards list only after a verified shared buy |

## Market pages

| Page | Behaviour |
| --- | --- |
| `/t/<ticker>` | ✓ name + status, DEX-pool price for graduated markets ("—" / "price unavailable" otherwise), illustrative chart labelled as such, **Buy/Sell on X** + **DM** for bot-known markets, Buy · Sell · Swap ⊘ with tooltips, presets / percentages, CTA label reflects connect / switch / action, explorer links, Launch a coin · Markets; unlisted ticker → alert with **Open Trade** that loads it (`polish1-state-market-unlisted`) |
| `/m/<id>` | ✓ tradable → RLUSD panel (RLUSD labels, plain reasons); not launched → clean state with **Launch a coin on X**; unknown id → "Market not found" + **Back to Markets** (`polish1-state-market-not-found`) |
| `/s/<id>` | ✓ Review and sign / Signed / Expired / Invalid / Blocked; action, factory, market, token, minimum received, chain, graduated, liquidity pool; create requests show origin + seed; **WalletConnect** (⊘ hint when unavailable) / **Copy link** / **Switch to XRPL EVM** / **Sign in wallet** / **Reject**; block reasons in plain language; bogus id → help page (`polish1-state-session-invalid`) |
| `/new` | ✓ in-app fallback for an XRP market: Generate default / Upload image / **Review and sign** (connect-wallet alert until connected); download exact file |
| `/coin` | ✓ Launch on X · Browse markets · contract details |
| Any unknown route | ✓ branded 404 (`not-found.tsx`) with **Back to Markets** · **Launch on X** (`polish1-dark-*-not-found`) |
| Render error | ✓ branded boundary (`error.tsx`): "Nothing was sent or signed", **Try again** · **Back to Markets**, digest shown when present |

## After-action X CTAs

| Where | Behaviour |
| --- | --- |
| `/s/<id>` once signed / confirmed | ✓ **Share on X** (`Bought / Sold / Launched $TICKER on @graav_xyz`, composer only); Reject becomes **Back to Markets** |
| Trade status card once confirmed | ✓ **Share on X** for the side just traded |
| Launch once `Coin created` | ✓ **Share on X** (`Launched $TICKER …`) |

## Images and metadata

| Item | Behaviour |
| --- | --- |
| Header lockup (`/brand/graav-header-lockup*.png`, 1x/2x/3x) | ✓ inverted in light theme; links home |
| Token pfps (`/api/pfp/<ticker>`) | ✓ letter placeholder until loaded; official marks for gSWAP / g589 / memes / MOMENT / ORBIT / SIGNAL |
| Unfurl image (`/api/pfp/<ticker>/og`) | ✓ 1200×1200 JPEG ≈ 157 KB (was a 2.6 MB PNG) |
| Root metadata | ✓ title template `%s · GRAAV`, description, OpenGraph + Twitter card with the lockup, `metadataBase` from `NEXT_PUBLIC_APP_URL` |
| `/t/<ticker>` metadata | ✓ `$TICKER · GRAAV`, plain description, pfp unfurl |
| Favicon | ✓ |
| Unused Next.js template SVGs (`file / globe / next / vercel / window.svg`) | removed |

## Not changed (known, honest)

- `MarketChart` is an illustrative shape anchored to the live price; the market ABI exposes no trade events to index, and the label says so.
- Base Sepolia corridor reads FAIL/HOLD on live catalogs; Buy stays closed by design.
- Coin V1 launch Sign stays disabled until `LAUNCH_AUTHORIZER_PRIVATE_KEY` exists on the deployment; RLUSD markets stay "Not launched" until the first signed create.
