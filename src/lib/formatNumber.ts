import { formatEther } from "viem";

const WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
const SMALL = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 6 });
const PRICE = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 4 });

/** 18-decimal amount → readable string. Unknown stays unknown ("—"), never zero. */
export function formatTokenAmount(wei: bigint | undefined | null): string {
  if (wei === undefined || wei === null) return "—";
  const n = Number(formatEther(wei));
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  return n >= 1 ? WHOLE.format(n) : SMALL.format(n);
}

/** Price per token. Non-positive or unknown renders "—" rather than a misleading 0.000. */
export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "—";
  return PRICE.format(value);
}

/** Spot price from pool reserves (quote per token), or null when the pool is empty/unknown. */
export function poolPrice(quoteReserve: bigint | undefined, tokenReserve: bigint | undefined): number | null {
  if (quoteReserve === undefined || tokenReserve === undefined || tokenReserve === 0n) return null;
  const price = Number(formatEther(quoteReserve)) / Number(formatEther(tokenReserve));
  return Number.isFinite(price) && price > 0 ? price : null;
}
