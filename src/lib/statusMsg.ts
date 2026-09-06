/** Coerce anything into a safe alert string — never render [object Object]. */
export function asStatusText(msg: unknown): string | null {
  if (msg == null || msg === false) return null;
  if (typeof msg === "string") return msg;
  if (msg instanceof Error) return msg.message || String(msg);
  if (typeof msg === "object") {
    const o = msg as { message?: unknown; error?: unknown; shortMessage?: unknown };
    if (typeof o.message === "string") return o.message;
    if (typeof o.shortMessage === "string") return o.shortMessage;
    if (typeof o.error === "string") return o.error;
    try {
      return JSON.stringify(msg);
    } catch {
      return String(msg);
    }
  }
  return String(msg);
}

export type StatusSetter = (msg: unknown) => void;

export function makeStatusSetter(
  set: (s: string | null) => void
): StatusSetter {
  return (msg) => set(asStatusText(msg));
}
