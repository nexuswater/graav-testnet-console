"use client";

import type { ReactNode } from "react";

export function Info({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <div className="g-micro" style={{ letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm break-all text-[var(--text)]">
        {value}
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  large,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  large?: boolean;
}) {
  return (
    <label className="g-field block">
      <span>{label}</span>
      <input
        className={large ? undefined : "sm"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
