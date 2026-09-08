# REVIEW PASS — WC-only + logos

**Date:** 2026-09-07
**Tip:** `dpl_HggZxquFFvmMfdFVGXzhvnwYqqa4`
**Commit:** `d7685c8` (supersedes `994644c`)
**URL:** https://graav-testnet-console.vercel.app

## Verified
- Production READY / aliased
- `/api/x/capabilities` 200 · `NEXT_PUBLIC_WC_PROJECT_ID` present
- Home + `/s` HTTP 200
- Local tip: WC-only CTAs + `WalletConnectMark` / `XMark`; no MetaMask / Connect wallet CTAs
- Origin envs: `CONSOLE_PUBLIC_ORIGIN` unset; keep vercel.app until www HTTPS clean
- Soft: apex `https://graav.xyz` returned 200 from this probe; `www` still TLS fail — **origin flip still HOLD** per Exec until both clean

## Status
**REVIEW PASS** — WC-only + logos closed.
M4 HOLD.
