import { formatUnits } from "viem";

export type KnownAmount = { kind: "known"; value: bigint } | { kind: "unknown" };

export function knownAmount(value: bigint | undefined | null): KnownAmount {
  return value === undefined || value === null ? { kind: "unknown" } : { kind: "known", value };
}

/** Unknown reads stay unknown. Never coerce a failed/pending read to 0. */
export function formatKnownAmount(
  amount: KnownAmount | bigint | undefined | null,
  decimals = 18,
  empty = "—",
): string {
  const known = typeof amount === "bigint" || amount === undefined || amount === null
    ? knownAmount(amount)
    : amount;
  if (known.kind === "unknown") return empty;
  return formatUnits(known.value, decimals);
}

export function formatKnownAmountWithSymbol(
  amount: KnownAmount | bigint | undefined | null,
  symbol: string,
  decimals = 18,
): string {
  const formatted = formatKnownAmount(amount, decimals);
  return formatted === "—" ? "—" : `${formatted} ${symbol}`;
}
