/**
 * Design-only X composer helpers for Launch.
 * Opens x.com intent/compose. Never posts. Never spends.
 * FEATURE_PUBLIC_X_WRITE stays closed — this is not a write rail.
 */

export const GRAAV_X_HANDLE = "graav_xyz";
export const GRAAV_X_HANDLE_AT = "@graav_xyz";
/** Example cashtag for copy only — not a Launch default market or CTA target. */
export const LAUNCH_EXAMPLE_TICKER = "HORMUZ";

const TICKER_RE = /^[A-Z][A-Z0-9_]{0,14}$/;

export function sanitizeLaunchTicker(raw: string): string {
  return raw.replace(/^\$/, "").toUpperCase().replace(/[^A-Z0-9_]/g, "").slice(0, 15);
}

export function isValidLaunchTicker(ticker: string): boolean {
  return TICKER_RE.test(ticker);
}

export function launchComposerText(ticker: string): string {
  const symbol = isValidLaunchTicker(sanitizeLaunchTicker(ticker))
    ? sanitizeLaunchTicker(ticker)
    : LAUNCH_EXAMPLE_TICKER;
  return `Launch $${symbol}\n${GRAAV_X_HANDLE_AT}`;
}

/** Prefills the X composer. Does not post. */
export function launchPostIntentUrl(ticker: string): string {
  return `https://x.com/intent/post?text=${encodeURIComponent(launchComposerText(ticker))}`;
}

/** Quote-RT starts on X — we cannot attach a target post without an id. */
export function launchQuoteRtUrl(): string {
  return "https://x.com";
}

export function graavXProfileUrl(): string {
  return `https://x.com/${GRAAV_X_HANDLE}`;
}

export function seedAmountDisplay(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "None (optional)";
  return `${trimmed} Test RLUSD`;
}
