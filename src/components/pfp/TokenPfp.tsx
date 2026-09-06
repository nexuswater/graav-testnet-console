"use client";

import { useEffect, useState } from "react";
import type { PfpProfile } from "@/lib/pfpTypes";

type Props = {
  ticker: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  ensure?: boolean;
};

export function TokenPfp({
  ticker,
  size = "sm",
  className = "",
  ensure = true,
}: Props) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = ensure ? "?ensure=1" : "";
    void fetch(`/api/pfp/${encodeURIComponent(ticker)}${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p: PfpProfile | null) => {
        if (!cancelled && p?.pfpURI) setUri(p.pfpURI);
      })
      .catch(() => {
        /* leave placeholder */
      });
    return () => {
      cancelled = true;
    };
  }, [ticker, ensure]);

  const dim =
    size === "lg" ? 96 : size === "md" ? 72 : 40;

  if (!uri) {
    return (
      <div
        className={`g-pfp ${size} ${className}`}
        style={{
          width: dim,
          height: dim,
          display: "grid",
          placeItems: "center",
          fontSize: size === "sm" ? 11 : 16,
          color: "var(--muted)",
          fontWeight: 650,
        }}
        aria-label={ticker}
      >
        {ticker.slice(0, 1).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={uri}
      alt={`$${ticker}`}
      width={dim}
      height={dim}
      className={`g-pfp ${size} ${className}`}
    />
  );
}
