/**
 * X composer helpers for Launch and Trade CTAs.
 * Every URL opens x.com (post / quote / reply / DM compose) with a prefilled draft.
 * The user finishes the action inside X. Nothing here posts, DMs, or spends —
 * FEATURE_PUBLIC_X_WRITE stays closed; this is not a write rail.
 */

export const GRAAV_X_HANDLE = "graav_xyz";
export const GRAAV_X_HANDLE_AT = "@graav_xyz";
/** Example cashtag for copy only — not a Launch default market or CTA target. */
export const LAUNCH_EXAMPLE_TICKER = "HORMUZ";

/**
 * Optional numeric X user id for @graav_xyz. When present, DM CTAs deep-link the
 * compose sheet; when absent they open the profile (which has a Message button).
 */
export const GRAAV_X_PRODUCT_USER_ID =
  (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_X_PRODUCT_USER_ID?.trim() : "") || "";

const TICKER_RE = /^[A-Z][A-Z0-9_]{0,14}$/;
const X_POST_URL_RE = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/status\/(\d+)/i;

export function sanitizeLaunchTicker(raw: string): string {
  return raw.replace(/^\$/, "").toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 15);
}

export function isValidLaunchTicker(ticker: string): boolean {
  return TICKER_RE.test(ticker);
}

export function graavXProfileUrl(): string {
  return `https://x.com/${GRAAV_X_HANDLE}`;
}

/** Opens the X composer prefilled with `text`. Does not post. */
export function xPostIntentUrl(text: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

/** Quote-repost: X composer with the target post attached. Does not post. */
export function xQuoteIntentUrl(text: string, postUrl: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(postUrl)}`;
}

/** Reply: X composer targeting a post id. Does not post. */
export function xReplyIntentUrl(text: string, postId: string): string {
  return `https://x.com/intent/post?in_reply_to=${encodeURIComponent(postId)}&text=${encodeURIComponent(text)}`;
}

/**
 * DM @graav_xyz with `text`. Deep-links the compose sheet when the product id is
 * known; otherwise opens the profile so the user can tap Message. Does not send.
 */
export function xDmUrl(text: string, productUserId: string = GRAAV_X_PRODUCT_USER_ID): string {
  if (/^\d+$/.test(productUserId)) {
    return `https://x.com/messages/compose?recipient_id=${productUserId}&text=${encodeURIComponent(text)}`;
  }
  return graavXProfileUrl();
}

/** True when the DM CTA can open the compose sheet directly. */
export function xDmDeepLinkAvailable(productUserId: string = GRAAV_X_PRODUCT_USER_ID): boolean {
  return /^\d+$/.test(productUserId);
}

/** Accepts an x.com / twitter.com status link and returns the numeric post id, or null. */
export function parseXPostUrl(raw: string): { url: string; id: string } | null {
  const trimmed = raw.trim();
  const match = X_POST_URL_RE.exec(trimmed);
  if (!match) return null;
  return { url: trimmed.split(/[?#]/)[0], id: match[1] };
}

export function launchComposerText(ticker: string): string {
  const symbol = isValidLaunchTicker(sanitizeLaunchTicker(ticker))
    ? sanitizeLaunchTicker(ticker)
    : LAUNCH_EXAMPLE_TICKER;
  return `Launch $${symbol}\n${GRAAV_X_HANDLE_AT}`;
}

/** Prefills the X composer with the launch draft. Does not post. */
export function launchPostIntentUrl(ticker: string): string {
  return xPostIntentUrl(launchComposerText(ticker));
}

/** Quote-repost a specific post with the launch draft. Does not post. */
export function launchQuoteIntentUrl(ticker: string, postUrl: string): string {
  return xQuoteIntentUrl(launchComposerText(ticker), postUrl);
}

/** DM the launch draft to @graav_xyz. Does not send. */
export function launchDmUrl(ticker: string): string {
  return xDmUrl(launchComposerText(ticker));
}

export type XTradeSide = "buy" | "sell";

/** Same grammar Chat and the X mention bot parse: `buy $TICKER amount` · `sell amount $TICKER`. */
export function tradeCommandText(side: XTradeSide, ticker: string, amount: string): string {
  const symbol = ticker.trim().replace(/^\$/, "");
  const amt = amount.trim() || "0.1";
  return side === "buy"
    ? `${GRAAV_X_HANDLE_AT} buy $${symbol} ${amt}`
    : `${GRAAV_X_HANDLE_AT} sell ${amt} $${symbol}`;
}

export function portfolioCommandText(): string {
  return `${GRAAV_X_HANDLE_AT} portfolio`;
}

export function tradePostIntentUrl(side: XTradeSide, ticker: string, amount: string): string {
  return xPostIntentUrl(tradeCommandText(side, ticker, amount));
}

export function tradeDmUrl(side: XTradeSide, ticker: string, amount: string): string {
  return xDmUrl(tradeCommandText(side, ticker, amount));
}

export type XShareKind = "bought" | "sold" | "launched";

/** Post-action share draft. Opens the composer only; the user decides whether to post. */
export function shareText(kind: XShareKind, ticker: string): string {
  const symbol = ticker.trim().replace(/^\$/, "");
  const verb = kind === "bought" ? "Bought" : kind === "sold" ? "Sold" : "Launched";
  return `${verb} $${symbol} on ${GRAAV_X_HANDLE_AT}`;
}

export function sharePostIntentUrl(kind: XShareKind, ticker: string): string {
  return xPostIntentUrl(shareText(kind, ticker));
}

export function seedAmountDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "None (optional)";
  return `${trimmed} RLUSD`;
}
