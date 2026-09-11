/**
 * X-primary product locks (copy / framing). Never posts, DMs, or spends.
 * SoT: docs/x/X_PRIMARY_ARCHITECTURE_2026-09-10.md
 * FEATURE_PUBLIC_X_WRITE stays closed.
 */

export const X_PRIMARY_SOT_PATH = "docs/x/X_PRIMARY_ARCHITECTURE_2026-09-10.md";
export const GRAAV_APP = "graav.xyz";

/** 60 creator / 25 protocol / 15 distributor. Not a live splitter in this console. */
export const ATTRIBUTION_V1 = {
  creator: 60,
  protocol: 25,
  distributor: 15,
  /** Of the distributor 15, depth-4 decay. */
  hopOfDistributor: [40, 25, 20, 15] as const,
  depth: 4,
  missingHop: "protocol",
  creatorIs: "original poster",
  payOnce: true,
} as const;

export const ATTRIBUTION_V1_LINE =
  "RT/share attribution V1: 60 creator / 25 protocol / 15 distributor. The 15 decays over 4 hops 40/25/20/15. Missing hop → protocol. Creator = original poster. Paid once.";

/** Reference only. No tip redeploy in this PR; no tip addresses invented here. */
export const KERNEL_LAB_REF = {
  fn: "buyWithAttribution",
  selector: "0xada7290b",
  forge: "20/20",
  status: "CODE READY",
} as const;

export const KERNEL_LAB_LINE = `Kernel lab ${KERNEL_LAB_REF.status}: ${KERNEL_LAB_REF.fn} ${KERNEL_LAB_REF.selector} · forge ${KERNEL_LAB_REF.forge} · no tip redeploy in this PR.`;

export type CrossChainStage = "home" | "first" | "next" | "later";

export const CROSS_CHAIN_TESTNET_ORDER: readonly { id: string; stage: CrossChainStage; label: string }[] = [
  { id: "home", stage: "home", label: "XRPL EVM Testnet 1449000 · Test RLUSD" },
  { id: "base", stage: "first", label: "Base Sepolia inbound" },
  { id: "arb", stage: "next", label: "Arbitrum Sepolia" },
  { id: "rh-hl", stage: "later", label: "Robinhood · Hyperliquid" },
] as const;

export const CROSS_CHAIN_FAIL_CLOSED_LINE = "Fail-closed: no proven route = no Buy.";

export const X_DAILY_OPS_LINE =
  "Daily ops on X — posts, reposts, and DMs (same actions, privately). Launch, buy/sell/swap, portfolio, RT/share.";

export const APP_DESK_LINE =
  "graav.xyz is setup, account, and charts. In-app launch and trade are fallback / advanced.";
