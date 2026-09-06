/**
 * Shared Chat / X-mention intent parser.
 * Chat ≠ authorization — never sends txs; only plans session mint + handoff.
 */
import type { AppTab, TradePrefill } from "@/lib/tradePrefill";
import {
  FACTORY_ADDRESS,
  M22_FACTORY_ADDRESS,
  GSWAP_MARKET_ADDRESS,
  GSWAP_TOKEN_ADDRESS,
  G589_MARKET_ADDRESS,
  G589_TOKEN_ADDRESS,
  TEST_DEX_V2_ADDRESS,
  MEME_TESTNET_MARKETS,
} from "@/lib/chain";

export type IntentHandoff = {
  tab: AppTab;
  prefill?: TradePrefill;
  label: string;
};

export type IntentPlan = {
  reply: string;
  handoff?: IntentHandoff;
  /** Body for POST /api/s when known allowlisted market */
  sessionBody?: Record<string, unknown>;
  /** Normalized verb for logging */
  kind?: "portfolio" | "buy" | "sell" | "launch" | "help" | "unknown";
};

export type KnownMarket = {
  symbol: string;
  factory: string;
  market: string;
  token: string;
  dex?: string;
  graduated: boolean;
};

export function resolveKnown(symbolRaw: string): KnownMarket | null {
  const symbol = symbolRaw.replace(/^\$/, "");
  const upper = symbol.toUpperCase();
  if (upper === "GSWAP") {
    return {
      symbol: "gSWAP",
      factory: M22_FACTORY_ADDRESS,
      market: GSWAP_MARKET_ADDRESS,
      token: GSWAP_TOKEN_ADDRESS,
      dex: TEST_DEX_V2_ADDRESS,
      graduated: true,
    };
  }
  if (upper === "G589") {
    return {
      symbol: "g589",
      factory: FACTORY_ADDRESS,
      market: G589_MARKET_ADDRESS,
      token: G589_TOKEN_ADDRESS,
      graduated: false,
    };
  }
  const meme = MEME_TESTNET_MARKETS.find(
    (m) => m.symbol.toUpperCase() === upper
  );
  if (meme) {
    return {
      symbol: meme.symbol,
      factory: FACTORY_ADDRESS,
      market: meme.market,
      token: meme.token,
      graduated: false,
    };
  }
  return null;
}

/**
 * Strip leading @graav_xyz (and bare @graav) so mention text matches Chat commands.
 */
export function stripProductMention(raw: string): string {
  return raw
    .replace(/^@graav_xyz\b/i, "")
    .replace(/^@graav\b/i, "")
    .trim();
}

/**
 * Parse buy/sell/portfolio/launch intents (same allowlist as ChatTab).
 * Accepts optional leading @graav_xyz.
 */
export function parseIntent(raw: string): IntentPlan {
  const text = stripProductMention(raw.trim());
  const upper = text.toUpperCase();

  if (upper === "PORTFOLIO" || upper.startsWith("PORTFOLIO ")) {
    return {
      kind: "portfolio",
      reply:
        "Opening Portfolio. Chat never authorizes trades — balances are read on-chain from your connected wallet.",
      handoff: { tab: "Portfolio", label: "Open Portfolio" },
    };
  }

  const buy = text.match(/^BUY\s+(\S+)\s+(\S+)\s*$/i);
  if (buy) {
    const symbol = buy[1];
    const xrp = buy[2];
    const known = resolveKnown(symbol);
    const action = known?.graduated ? "swap" : "buy";
    const reply = known
      ? `${action === "swap" ? "Swap" : "Buy"} intent for ${xrp} XRP of ${known.symbol}. Chat ≠ authorization. Minting a signing session URL — wallet signs on /s/{id}.`
      : `Buy intent parsed: ${xrp} XRP of ${symbol}. Unknown symbol for session mint — hand off to Trade search. Chat ≠ authorization.`;
    const plan: IntentPlan = {
      kind: "buy",
      reply,
      handoff: {
        tab: "Trade",
        label: "Open Trade",
        prefill: {
          action: "buy",
          symbol: known?.symbol || symbol,
          loadQuery: known?.symbol || symbol,
          buyXrp: xrp,
        },
      },
    };
    if (known) {
      plan.sessionBody = {
        chainId: 1449000,
        factory: known.factory,
        market: known.market,
        token: known.token,
        action,
        amount: xrp,
        minOut: "0",
        ...(action === "swap"
          ? { dex: known.dex, swapSide: "xrpToToken" }
          : {}),
      };
    }
    return plan;
  }

  const sell = text.match(/^SELL\s+(\S+)\s+(\S+)\s*$/i);
  if (sell) {
    const amtOrPct = sell[1];
    const symbol = sell[2];
    const isPct = amtOrPct.endsWith("%");
    const sellAmount = isPct ? "1" : amtOrPct;
    const known = resolveKnown(symbol);
    const plan: IntentPlan = {
      kind: "sell",
      reply: isPct
        ? `Sell intent parsed: ${amtOrPct} of ${symbol}. Percent sells need a concrete token amount on Trade.`
        : `Sell intent parsed: ${sellAmount} ${symbol}. Chat ≠ authorization. ${known ? "Minting signing session." : "Hand off to Trade."}`,
      handoff: {
        tab: "Trade",
        label: "Open Trade",
        prefill: {
          action: "sell",
          symbol: known?.symbol || symbol,
          loadQuery: known?.symbol || symbol,
          sellAmount,
        },
      },
    };
    if (known && !known.graduated && !isPct) {
      plan.sessionBody = {
        chainId: 1449000,
        factory: known.factory,
        market: known.market,
        token: known.token,
        action: "sell",
        amount: sellAmount,
        minOut: "0",
      };
    }
    return plan;
  }

  // LAUNCH / CREATE <ticker> — mint create /s (M2 factory). Chat ≠ authorization.
  // X post stays fail-closed until FEATURE + keys + Director green (dryRun default).
  const launch = text.match(/^(?:LAUNCH|CREATE)\s+(\S+)\s*$/i);
  if (launch) {
    const tickerRaw = launch[1].replace(/^\$/, "");
    // Symbol hygiene: 1–15 alnum/underscore (X-safe); reject garbage fail-closed
    const ticker = tickerRaw.slice(0, 15);
    const okSym = /^[A-Za-z][A-Za-z0-9_]{0,14}$/.test(ticker);
    if (!okSym) {
      return {
        kind: "launch",
        reply: `Create-market rejected: bad ticker "${tickerRaw}". Use 1–15 letters/digits/underscore starting with a letter. Chat ≠ auth.`,
      };
    }
    return {
      kind: "launch",
      reply: `Create-market intent: ${ticker}. Chat ≠ authorization. Minting create /s/{id} on M2 — wallet signs. X write fail-closed until Director green.`,
      handoff: {
        tab: "Trade",
        label: `Trade · create ${ticker}`,
        prefill: {
          action: "launch",
          createName: ticker,
          createSymbol: ticker,
        },
      },
      sessionBody: {
        chainId: 1449000,
        factory: FACTORY_ADDRESS, // M2 — new memes; no new Factory
        action: "create",
        amount: "0",
        minOut: "0",
        createName: ticker,
        createSymbol: ticker,
        metadataURI: "",
      },
    };
  }
  return {
    kind: text ? "unknown" : "help",
    reply:
      "Local intents only (@graav_xyz · X write fail-closed): PORTFOLIO · BUY <symbol> <xrp> · SELL <pct|amount> <symbol> · LAUNCH|CREATE <ticker> (create → /s mint). Aggregated Pay-with-USDC OFF until settle PASS. Chat ≠ auth. Known: gSWAP, g589, meme g*.",
  };
}
