import type { Metadata } from "next";
import { MarketClient } from "@/components/market/MarketClient";
import { findKnownMarket } from "@/lib/marketsRegistry";
import { normalizeTicker } from "@/lib/pfpTypes";
import { CONSOLE_PUBLIC_ORIGIN } from "@/lib/signingSession";

type Props = { params: Promise<{ ticker: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(decodeURIComponent(raw));
  const known = findKnownMarket(ticker);
  const dollar = "$" + ticker;
  const title = dollar;
  const description = known
    ? `${known.name} on GRAAV · XRPL EVM. Buy from a post or DM to @graav_xyz; your wallet signs.`
    : `${dollar} on GRAAV · XRPL EVM`;
  const og = `${CONSOLE_PUBLIC_ORIGIN}/api/pfp/${encodeURIComponent(ticker)}/og`;
  return {
    title,
    description,
    openGraph: {
      title: `${dollar} · GRAAV`,
      description,
      images: [{ url: og, width: 1200, height: 1200, alt: dollar }],
    },
    twitter: {
      card: "summary",
      title: `${dollar} · GRAAV`,
      description,
      images: [og],
    },
  };
}

export default async function MarketPage({ params }: Props) {
  const { ticker: raw } = await params;
  const ticker = normalizeTicker(decodeURIComponent(raw));
  return <MarketClient ticker={ticker} />;
}
