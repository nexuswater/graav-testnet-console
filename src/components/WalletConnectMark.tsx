type WalletConnectMarkProps = { size?: number };
export function WalletConnectMark({ size = 16 }: WalletConnectMarkProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M6.1 9.1c3.26-3.26 8.54-3.26 11.8 0l.72.72a.9.9 0 0 1 0 1.27l-1.02 1.02a.45.45 0 0 1-.64 0l-.99-.99a5.63 5.63 0 0 0-7.94 0l-.99.99a.45.45 0 0 1-.64 0l-1.02-1.02a.9.9 0 0 1 0-1.27l.72-.72Z" fill="currentColor" /><path d="m6.1 14.9.72-.72a.9.9 0 0 1 1.27 0l.99.99a5.63 5.63 0 0 0 7.94 0l.99-.99a.45.45 0 0 1 .64 0l1.02 1.02a.9.9 0 0 1 0 1.27l-.72.72c-3.26 3.26-8.54 3.26-11.8 0l-.72-.72a.9.9 0 0 1 0-1.27Z" fill="currentColor" /></svg>;
}
