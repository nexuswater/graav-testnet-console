# Token Markets — Josh GO: Testnet Clone (2026-09-06)

**Authority:** Josh via Exec COS · Director stamp  
**SoT tip:** `a71fbe1` on `feat/x1-rlusd-token-markets`

## GO
Finish remaining (LaunchAuthorizer / AttributionGuard **enough for testnet tip**) and **run clone on testnet** — **not mainnet**.

## Allowed
- Deploy RLUSD Coin V1 **clone** to **XRPL EVM Testnet `1449000`** (or a named test profile explicitly documented)
- Console tip bind to that clone if needed (preview / non-prod OK; soft: do not race `dpl_8X5Z…` without callout)
- Use existing GRAAV testnet keystore/RPC path if present
- Soft-ping Director with deploy evidence (addresses, chainId, tx hashes, forge/smoke) when READY for REVIEW

## Forbidden
- **No `1440000` mainnet** deploy / broadcast / live RLUSD mainnet bind
- **No tweet.write** / public X write / `FEATURE_PUBLIC_X_WRITE` unless separate Josh+Director GO
- **No M4 tip-fold** into `packages/contracts` (still HOLD) unless Director re-GO
- Do **not** borrow X1 GRAAVBind verifyingContract `0x72be…276B` for RLUSD clone domain — mint a **fresh** test bind domain for the clone profile
- No Circular / Nexus mixing · no custody · no Squid execution claimed as PASS if provider still gaps

## Profile note
This is a **testnet clone** of Coin V1 architecture on `1449000` for proving rails — it does **not** redefine X1 native-XRP markets or promote the clone to mainnet RLUSD identity.

## Execution update — READY FOR REVIEW

Clone completed on XRPL EVM testnet `1449000`; no mainnet broadcast. Evidence: `RLUSD_TESTNET_CLONE_EVIDENCE_2026-09-06.md`; deployment record: `RLUSD_TESTNET_CLONE_DEPLOY_1449000.json`. MockRLUSD, signed factory launch, and confirmed BUY/SELL smoke are recorded there. Fresh clone bind uses TokenFactory `0x2E393cfabeC866a38632b8C486B942089644dE93`; X1 bind remains untouched.
