/**
 * Base Sepolia is the FIRST inbound cross-chain corridor:
 * USDC (Base Sepolia 84532) → RLUSD → XRPL EVM Testnet 1449000.
 * Fail-closed: no proven route = no Buy. Arb / RH / HL are deferred until Base PASS.
 * Pure helpers — safe for client and server. No routes are invented here.
 */

export const XRPL_EVM_TESTNET_DEST = 1449000;

export const BASE_SEPOLIA_CORRIDOR = {
  key: "base",
  label: "Base Sepolia",
  chainId: 84532,
  axelarId: "base-sepolia",
  sourceAsset: "USDC",
  settleAsset: "RLUSD",
  destChainId: XRPL_EVM_TESTNET_DEST,
  path: "USDC → RLUSD → XRPL EVM 1449000",
  via: "Aggregated · Squid",
} as const;

/** Only Base is wired / probed this slice. */
export const ACTIVE_CORRIDOR_KEYS: readonly string[] = [BASE_SEPOLIA_CORRIDOR.key];

export type DeferredStage = "after-base" | "later";

/** Arb only after Base PASS; Robinhood / Hyperliquid later. None are probed this slice. */
export const DEFERRED_CORRIDORS: readonly { key: string; label: string; stage: DeferredStage; reason: string }[] = [
  { key: "arbitrumSepolia", label: "Arbitrum Sepolia", stage: "after-base", reason: "Only after Base Sepolia PASS — not probed this slice." },
  { key: "robinhood", label: "Robinhood Chain Testnet", stage: "later", reason: "Later — after Base PASS and Arbitrum. Not probed this slice." },
  { key: "hyperliquid", label: "HyperEVM Testnet", stage: "later", reason: "Later — after Base PASS and Arbitrum. Not probed this slice." },
] as const;

export const DEFERRED_REASON = "Out of scope until Base Sepolia PASS — not probed this slice.";

export const CORRIDOR_ORDER_LINE =
  "Inbound order: Base Sepolia → RLUSD on XRPL EVM testnet first (Aggregated · Squid). Arbitrum only after Base PASS. Robinhood / Hyperliquid later.";

export const NO_LIVE_QUOTE_LINE = "Buy is never enabled without a live Squid USDC → RLUSD quote.";

export function isActiveCorridor(key: string): boolean {
  return ACTIVE_CORRIDOR_KEYS.includes(key);
}

export type CorridorCheckId =
  | "dest-listed"
  | "source-listed"
  | "usdc-on-source"
  | "rlusd-on-dest"
  | "live-quote"
  | "signed-tx-wired";

export type CorridorCheck = {
  id: CorridorCheckId;
  label: string;
  ok: boolean;
  detail: string;
};

export type CorridorSignals = {
  /** Squid /v2/chains lists 1449000 */
  squidHasDest: boolean;
  /** Squid /v2/chains lists Base Sepolia 84532 */
  squidHasSource: boolean;
  /** USDC token on Base Sepolia in Squid catalog */
  usdcOnSource: boolean;
  /** Axelar ITS lists RLUSD on xrpl-evm */
  rlusdOnDest: boolean;
  /** Axelar catalog lists Base Sepolia as a source */
  axelarHasSource: boolean;
  /** Live USDC→RLUSD quote with depth smoke — never true this slice */
  liveQuote: boolean;
  /** Signed quote + tx rail wired — never true this slice */
  signedTxWired: boolean;
};

export type CorridorGate = {
  corridor: typeof BASE_SEPOLIA_CORRIDOR;
  checks: CorridorCheck[];
  /** Catalog-only presence (source + dest + USDC + RLUSD). Not a route. */
  catalogReady: boolean;
  /** Buy gate. Requires every check including live quote and wired tx. */
  pass: boolean;
  status: "PASS" | "FAIL-CLOSED";
  reason: string;
  deferred: { key: string; label: string; stage: DeferredStage; reason: string }[];
};

/** Fail-closed gate for the Base Sepolia corridor. Pure; no network. */
export function baseCorridorGate(s: CorridorSignals): CorridorGate {
  const c = BASE_SEPOLIA_CORRIDOR;
  const checks: CorridorCheck[] = [
    {
      id: "dest-listed",
      label: "XRPL EVM listed as destination",
      ok: s.squidHasDest,
      detail: s.squidHasDest
        ? `Squid lists XRPL EVM ${c.destChainId}.`
        : `Squid does not list XRPL EVM ${c.destChainId} yet.`,
    },
    {
      id: "source-listed",
      label: `${c.label} listed as source`,
      ok: s.squidHasSource || s.axelarHasSource,
      detail: s.squidHasSource
        ? `Squid lists ${c.label}.`
        : s.axelarHasSource
          ? `Axelar lists ${c.label}; Squid does not yet.`
          : `${c.label} is not in the Squid or Axelar catalogs.`,
    },
    {
      id: "usdc-on-source",
      label: `USDC on ${c.label}`,
      ok: s.usdcOnSource,
      detail: s.usdcOnSource ? `USDC is cataloged on ${c.label}.` : `USDC is not cataloged on ${c.label} yet.`,
    },
    {
      id: "rlusd-on-dest",
      label: "RLUSD on XRPL EVM",
      ok: s.rlusdOnDest,
      detail: s.rlusdOnDest
        ? "Axelar ITS lists RLUSD on XRPL EVM."
        : "Axelar ITS does not list RLUSD on XRPL EVM yet.",
    },
    {
      id: "live-quote",
      label: "Live USDC → RLUSD quote with depth",
      ok: s.liveQuote,
      detail: s.liveQuote ? "Live quote confirmed." : "No live quote yet. Being listed is not a route.",
    },
    {
      id: "signed-tx-wired",
      label: "Signed quote and transaction rail",
      ok: s.signedTxWired,
      detail: s.signedTxWired ? "Rail wired." : "Not wired yet.",
    },
  ];
  const catalogReady = checks
    .filter((k) => k.id !== "live-quote" && k.id !== "signed-tx-wired")
    .every((k) => k.ok);
  const pass = checks.every((k) => k.ok);
  const missing = checks.filter((k) => !k.ok).map((k) => k.label);
  return {
    corridor: c,
    checks,
    catalogReady,
    pass,
    status: pass ? "PASS" : "FAIL-CLOSED",
    reason: pass
      ? `Base Sepolia corridor PASS: ${c.path}.`
      : `FAIL-CLOSED: ${c.path} — missing ${missing.join("; ")}. No Buy without a live Squid quote.`,
    deferred: DEFERRED_CORRIDORS.map((d) => ({ ...d })),
  };
}
