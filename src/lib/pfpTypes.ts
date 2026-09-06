/** GRAAV token image profile (one file IS the token image). */

export type PfpProfile = {
  ticker: string;
  pfpURI: string;
  contentType: string;
  sha256: string;
  generated: boolean;
  /** official-simple = shipped brand asset; never overwrite via ensureProfile */
  source?: string;
  updatedAt?: string;
  creator?: string;
};

export const PFP_MAX_BYTES = 2 * 1024 * 1024;
export const PFP_ACCEPT = ["image/png", "image/jpeg", "image/webp"] as const;
export type PfpContentType = (typeof PFP_ACCEPT)[number];

export function normalizeTicker(raw: string): string {
  return (raw || "").trim().replace(/^\$/, "");
}

export function isValidTicker(t: string): boolean {
  return /^[A-Za-z0-9_.-]{1,32}$/.test(t);
}

export function extForContentType(ct: string): string {
  if (ct === "image/jpeg") return "jpg";
  if (ct === "image/webp") return "webp";
  return "png";
}

export function isOfficialSimple(p: PfpProfile | null | undefined): boolean {
  if (!p) return false;
  if (p.source === "official-simple") return true;
  return Boolean(p.source && p.source.startsWith("official") && p.generated === false);
}
