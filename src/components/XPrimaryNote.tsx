import { APP_DESK_LINE, X_DAILY_OPS_LINE } from "@/lib/xPrimary";

type Props = { className?: string };

/** Shared X-primary lock. Copy only — never posts or spends. */
export function XPrimaryNote({ className }: Props) {
  return (
    <p className={className ? `g-hint ${className}` : "g-hint"}>
      {X_DAILY_OPS_LINE} {APP_DESK_LINE} Chat ≠ authorization · signature or nothing via /s.
    </p>
  );
}
