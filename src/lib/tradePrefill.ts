/** Shared trade prefill when Chat (or other UI) hands off to Trade — never sends a tx. */
export type TradePrefill = {
  action?: "buy" | "sell" | "launch" | "load" | "swap";
  /** For swap: buy = XRP→token, sell = token→XRP */
  side?: "buy" | "sell";
  symbol?: string;
  buyXrp?: string;
  sellAmount?: string;
  createName?: string;
  createSymbol?: string;
  loadQuery?: string;
};

export type AppTab = "Markets" | "Trade" | "Portfolio" | "Cross-chain" | "Chat" | "X";
