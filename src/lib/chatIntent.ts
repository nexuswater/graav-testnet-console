/**
 * Shared Chat / X-mention intent parser.
 * Chat ≠ authorization — never sends txs; only plans session mint + handoff.
 */
import type { AppTab, TradePrefill } from "@/lib/tradePrefill";
import { RLUSD_V1 as RLUSD } from "@/lib/rlusd-v1/config";
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
  if (upper === "MOMENT" || upper === "MRLUSD" || upper === "COIN") {
    if (RLUSD.profile !== "testnet-clone" || !RLUSD.factoryAddress || !RLUSD.curveAddress || !RLUSD.coinAddress) return null;
    return { symbol: "MOMENT", factory: RLUSD.factoryAddress, market: RLUSD.curveAddress, token: RLUSD.coinAddress, graduated: false };
  }
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
 * Strip @graav_xyz (and bare @graav) wherever it appears so mention noise does
 * not prevent the same command from working in Chat or from an X reply.
 */
export function stripProductMention(raw: string): string {
  return raw
    .replace(/@graav_xyz\b|@graav\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}


const tickerPattern = String.raw`\$?[A-Za-z][A-Za-z0-9_]{0,14}`;
const amountPattern = String.raw`\d+(?:\.\d+)?`;

/** Pull a strict command out of prose while keeping garbage fail-closed. */
function extractCommand(text: string): string {
  const patterns = [
    new RegExp(`\\bBUY\\s+${tickerPattern}\\s+${amountPattern}\\b`, "i"),
    new RegExp(`\\bSELL\\s+${amountPattern}%?\\s+${tickerPattern}\\b`, "i"),
    new RegExp(`\\b(?:LAUNCH|CREATE)\\s+${tickerPattern}\\b`, "i"),
    /\bPORTFOLIO\b/i,
  ];
  const matches = patterns.map((pattern) => pattern.exec(text)).filter((match): match is RegExpExecArray => match !== null).sort((a, b) => a.index - b.index);
  return matches[0]?.[0] ?? text;
}

/**
 * Parse buy/sell/portfolio/launch intents (same allowlist as ChatTab).
 * Accepts @graav_xyz/@graav anywhere, with natural-language noise around the command.
 */
export function parseIntent(raw: string): IntentPlan {
  const text = extractCommand(stripProductMention(raw.trim()));
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
      ? `${action === "swap" ? "Swap" : "Buy"} ${known.symbol}. Preview only — wallet signing stays on Trade.`
      : `Buy ${symbol} parsed. Market not configured for a session. Open Trade to review.`;
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
        ? `Sell ${amtOrPct} of ${symbol}. Enter a concrete amount on Trade before signing.`
        : `Sell ${sellAmount} ${symbol}. Preview only — wallet signing stays on Trade.`,
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
      reply: `Launch ${ticker}. Open Launch to review details. Chat never authorizes createCoin.`,
      handoff: {
        tab: "Markets",
        label: `Open Launch · ${ticker}`,
        prefill: {
          action: "launch",
          createName: ticker,
          createSymbol: ticker,
        },
      },
    };
  }
  return {
    kind: text ? "unknown" : "help",
    reply:
      "Intents: BUY <coin> <amount> · SELL <amount> <coin> · LAUNCH <ticker>. Chat previews only. Your wallet signs.",
  };
}
