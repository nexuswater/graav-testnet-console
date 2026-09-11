"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
};

function sanitizeSeed(raw: string): string {
  const next = raw.replace(/[^0-9.]/g, "");
  const dot = next.indexOf(".");
  if (dot === -1) return next.slice(0, 12);
  return `${next.slice(0, dot)}${next.slice(dot, dot + 7)}`.slice(0, 18);
}

/** Optional seed amount on review/sign. UI only — does not spend. */
export function SeedMarketField({ value, onChange, id = "seed-amount" }: Props) {
  return (
    <div className="g-field">
      <label className="g-field-label" htmlFor={id}>
        Seed the market (optional)
      </label>
      <input
        id={id}
        className="sm"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(sanitizeSeed(event.target.value))}
        placeholder="0"
        autoComplete="off"
        spellCheck={false}
      />
      <p className="g-hint">RLUSD. Nothing is spent until your wallet signs.</p>
    </div>
  );
}
