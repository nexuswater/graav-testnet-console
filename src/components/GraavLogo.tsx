"use client";

import Link from "next/link";

type Props = {
  href?: string;
  /** rendered height in px — default 30 for thicker HD mark */
  height?: number;
};

/** Official thickened mark + wordmark lockup (HD, not plain text). */
export function GraavLogo({ href = "/", height = 30 }: Props) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/graav-header-lockup.png"
      srcSet="/brand/graav-header-lockup.png 1x, /brand/graav-header-lockup@2x.png 2x, /brand/graav-header-lockup@3x.png 3x"
      alt="GRAAV"
      height={height}
      width={Math.round(height * 6.9)}
      style={{
        height,
        width: "auto",
        maxWidth: "min(168px, 42vw)",
        display: "block",
        objectFit: "contain",
        flexShrink: 1,
      }}
      decoding="async"
    />
  );
  if (!href) return img;
  return (
    <Link
      href={href}
      className="g-mark"
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 0,
        flexShrink: 1,
        minWidth: 0,
      }}
      aria-label="GRAAV home"
    >
      {img}
    </Link>
  );
}
