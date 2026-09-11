/**
 * X-primary product locks (copy / framing). Never posts, DMs, or spends.
 * SoT: docs/x/X_PRIMARY_ARCHITECTURE_2026-09-10.md
 * FEATURE_PUBLIC_X_WRITE stays closed.
 */
import {
  ATTRIBUTION_HOP_DEPTH,
  ATTRIBUTION_V1_STACK,
  BUY_WITH_ATTRIBUTION_SELECTOR,
} from "@/lib/chain";

export const X_PRIMARY_SOT_PATH = "docs/x/X_PRIMARY_ARCHITECTURE_2026-09-10.md";
export const ATTRIBUTION_V1_TIP_PIN_PATH = "docs/x/ATTRIBUTION_V1_TIP_PIN_STACK2_1449000.md";
export const GRAAV_APP = "graav.xyz";

function shortHex(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

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

export const ATTRIBUTION_V1_RULE =
  "60 creator / 25 protocol / 15 distributor. The 15 decays over 4 hops 40/25/20/15. Missing hop → protocol. Creator = original poster. Paid once.";

export const ATTRIBUTION_V1_LINE = `RT/share attribution V1: ${ATTRIBUTION_V1_RULE}`;

/**
 * Attribution V1 tip — remint stack2 pinned (chain.ts ATTRIBUTION_V1_STACK).
 * Addresses come from the Exec deployment record, never invented here.
 * Exec smoke PASS on 1449000: createMarket + buy + buyWithAttribution (attributed=true).
 */
export const KERNEL_LAB_REF = {
  fn: "buyWithAttribution",
  selector: BUY_WITH_ATTRIBUTION_SELECTOR,
  forge: "20/20",
  status: "PINNED",
  stack: ATTRIBUTION_V1_STACK.stack,
  templateVersion: ATTRIBUTION_V1_STACK.templateVersion,
  chainId: ATTRIBUTION_V1_STACK.chainId,
  factory: ATTRIBUTION_V1_STACK.factory,
  hopDepth: ATTRIBUTION_HOP_DEPTH,
  smoke: "createMarket + buy + buyWithAttribution attributed=true PASS (Exec)",
} as const;

export const ATTRIBUTION_V1_TIP_LINE = `Attribution V1 tip pinned on ${KERNEL_LAB_REF.chainId}: Factory ${shortHex(KERNEL_LAB_REF.factory)} (stack${KERNEL_LAB_REF.stack}, TEMPLATE_VERSION ${KERNEL_LAB_REF.templateVersion}) · ${KERNEL_LAB_REF.fn} ${KERNEL_LAB_REF.selector} · depth-${KERNEL_LAB_REF.hopDepth} hops · Exec smoke PASS.`;

export const KERNEL_LAB_LINE = `${ATTRIBUTION_V1_TIP_LINE} Kernel lab forge ${KERNEL_LAB_REF.forge}. This console never signs attribution proofs.`;

export type CrossChainStage = "home" | "first" | "next" | "later";

/** Base Sepolia → RLUSD on XRPL EVM testnet first (Aggregated · Squid). Arb only after Base PASS. RH/HL later. */
export const CROSS_CHAIN_TESTNET_ORDER: readonly { id: string; stage: CrossChainStage; label: string }[] = [
  { id: "home", stage: "home", label: "XRPL EVM Testnet 1449000 · Test RLUSD" },
  { id: "base", stage: "first", label: "Base Sepolia inbound · USDC → RLUSD → XRPL EVM · Aggregated / Squid" },
  { id: "arb", stage: "next", label: "Arbitrum Sepolia — only after Base PASS" },
  { id: "rh-hl", stage: "later", label: "Robinhood · Hyperliquid — later" },
] as const;

export const CROSS_CHAIN_FAIL_CLOSED_LINE = "Fail-closed: no proven route = no Buy.";

export const X_DAILY_OPS_LINE =
  "Daily ops on X — posts, reposts, and DMs (same actions, privately). Launch, buy/sell/swap, portfolio, RT/share.";

export const APP_DESK_LINE =
  "graav.xyz is setup, account, and charts. In-app launch and trade are fallback / advanced.";
