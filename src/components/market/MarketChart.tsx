"use client";

import { useMemo, useState } from "react";

const RANGES = ["1H", "4H", "1D", "1W", "1M"] as const;
type Range = (typeof RANGES)[number];

type Props = {
  ticker: string;
  /** current price in XRP as number, or null */
  priceXrp?: number | null;
};

function seededSeries(seed: string, n: number, base: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const out: number[] = [];
  let v = base > 0 ? base : 0.0001;
  for (let i = 0; i < n; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const r = (h >>> 0) / 0xffffffff;
    v = Math.max(1e-12, v * (0.97 + r * 0.06));
    out.push(v);
  }
  if (base > 0) out[out.length - 1] = base;
  return out;
}

export function MarketChart({ ticker, priceXrp = null }: Props) {
  const [range, setRange] = useState<Range>("1D");
  const n = range === "1H" ? 24 : range === "4H" ? 48 : range === "1D" ? 96 : range === "1W" ? 84 : 60;
  const series = useMemo(
    () => seededSeries(`${ticker}:${range}`, n, priceXrp ?? 0.0001),
    [ticker, range, priceXrp, n]
  );
  const min = Math.min(...series);
  const max = Math.max(...series);
  const w = 320;
  const h = 120;
  const pad = 8;
  const pts = series
    .map((v, i) => {
      const x = pad + (i / Math.max(1, series.length - 1)) * (w - pad * 2);
      const y =
        pad + (1 - (v - min) / Math.max(1e-18, max - min)) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const up = series[series.length - 1] >= series[0];
  const stroke = up ? "var(--good)" : "var(--nebula)";

  return (
    <div className="g-sheet" style={{ marginTop: 16, padding: 12 }}>
      <div
        className="g-pct"
        role="tablist"
        aria-label="Chart timeframe"
        style={{ marginBottom: 8 }}
      >
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            className={range === r ? "on" : undefined}
            aria-pressed={range === r}
            onClick={() => setRange(r)}
            style={
              range === r
                ? {
                    background: "var(--nebula-deep)",
                    color: "#fff",
                    borderColor: "var(--nebula-deep)",
                  }
                : undefined
            }
          >
            {r}
          </button>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        role="img"
        aria-label={`$${ticker} ${range} chart (illustrative testnet)`}
      >
        <polyline
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pts}
        />
      </svg>
      <p className="g-hint" style={{ marginTop: 4, marginBottom: 0 }}>
        Illustrative · live OHLC feed not wired yet · timeframe switches work
      </p>
    </div>
  );
}
