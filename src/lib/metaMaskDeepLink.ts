/** Build a MetaMask mobile dapp deep link without duplicating a URL scheme. */
export function metaMaskDappUrl(href?: string): string {
  const source = href ?? (typeof window !== "undefined" ? window.location.href : "");
  const base = typeof window !== "undefined" ? window.location.origin : "https://graav.xyz";
  try {
    const url = new URL(source || base, base);
    return `https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "https://metamask.app.link/dapp/";
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
