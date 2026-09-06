"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getClientXAuthHint } from "@/lib/xAuth";

type Props = {
  compact?: boolean;
};

type MeResponse = {
  bound: boolean;
  id?: string;
  username?: string;
  name?: string;
};

/**
 * Sign in with X / Connect X — identity bind only.
 * Never posts tweets, never sends DMs, never authorizes trades.
 */
export function ConnectX({ compact }: Props) {
  const hint = useMemo(() => getClientXAuthHint(), []);
  const [notice, setNotice] = useState<string | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);

  const refreshMe = useCallback(async () => {
    if (!hint.configured) return;
    setLoadingMe(true);
    try {
      const res = await fetch("/api/auth/x/me", { credentials: "same-origin" });
      if (res.ok) {
        setMe((await res.json()) as MeResponse);
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingMe(false);
    }
  }, [hint.configured]);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const onClick = () => {
    if (!hint.configured) {
      setNotice(hint.message);
      return;
    }
    window.location.href = "/api/auth/x";
  };

  const onSignOut = async () => {
    try {
      await fetch("/api/auth/x/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      setMe({ bound: false });
      setNotice(null);
    } catch {
      window.location.href = "/api/auth/x/logout";
    }
  };

  if (me?.bound && me.username) {
    if (compact) {
      return (
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="g-chip g-x-chip"
          title={`@${me.username} · Sign out`}
          aria-label={`@${me.username}, sign out of X`}
        >
          <span className="g-av" style={{ background: "var(--x)" }}>
            X
          </span>
          <span className="g-x-handle">@{me.username}</span>
        </button>
      );
    }
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="g-sub" style={{ color: "var(--text)" }}>
            @{me.username}
          </span>
          <button
            type="button"
            onClick={() => void onSignOut()}
            className="g-btn sm"
          >
            Sign out
          </button>
        </div>
        <p className="g-micro">
          Identity bound · no tweet/DM scopes · X login ≠ trade authorization ·
          chat ≠ authorization
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? "inline-flex flex-col items-end gap-1" : "space-y-2"}>
      <button
        type="button"
        onClick={onClick}
        disabled={loadingMe && hint.configured}
        className="g-btn sm"
        style={compact ? undefined : { borderColor: "var(--x)", color: "var(--x)" }}
      >
        {hint.configured ? "Sign in with X" : "Connect X"}
      </button>
      {(notice || !hint.configured) && (
        <p
          className={
            compact
              ? "max-w-[220px] text-right g-micro leading-snug"
              : "max-w-md g-hint"
          }
        >
          {notice || hint.message}
        </p>
      )}
      {!compact && (
        <p className="g-micro">
          Identity bind only · no tweet/DM write scopes · X login ≠ trade
          authorization · chat ≠ authorization
        </p>
      )}
    </div>
  );
}
