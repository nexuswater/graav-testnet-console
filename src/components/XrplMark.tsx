type XrplMarkProps = { size?: number };

/** Minimal white XRPL-style mark for wallet identity surfaces. */
export function XrplMark({ size = 28 }: XrplMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M5 7h5.6l5.4 5.3L21.4 7H27l-8.2 8 8.2 8h-5.6L16 17.7 10.6 23H5l8.2-8L5 7Z" fill="currentColor" />
      <path d="M5 9.5h3.8l7.2 6.9 7.2-6.9H27l-11 10.6L5 9.5Z" fill="#111113" />
    </svg>
  );
}
