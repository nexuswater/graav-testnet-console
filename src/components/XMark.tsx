type XMarkProps = { size?: number };
export function XMark({ size = 16 }: XMarkProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 3.5h4.05l4.1 5.47 4.74-5.47h2.7l-6.18 7.13 6.55 8.87h-4.05l-4.38-5.94-5.15 5.94h-2.7l6.59-7.6L4.2 3.5Zm3.39 1.82 8.75 12.35h1.91L9.5 5.32H7.59Z" fill="currentColor" /></svg>;
}
