"use client";

import { useState, type ReactNode } from "react";
import { FAUCET_URL } from "@/lib/chain";
import { AccountMenu } from "@/components/AccountMenu";
import { PrimaryMenu } from "@/components/PrimaryMenu";
import { GraavLogo } from "@/components/GraavLogo";
import { makeStatusSetter, asStatusText } from "@/lib/statusMsg";

export function AppChrome({
  children,
  showTabsNav = true,
}: {
  children: ReactNode;
  /** @deprecated pill nav removed — PrimaryMenu is always shown */
  showTabsNav?: boolean;
}) {
  const [msg, setMsgRaw] = useState<string | null>(null);
  const setMsg = makeStatusSetter(setMsgRaw);
  void showTabsNav;

  return (
    <div className="g-app">
      <header className="g-top">
        <div className="g-top-brand">
          <GraavLogo height={30} />
          <span className="g-pill">TESTNET</span>
        </div>
        <div className="g-top-actions">
          <AccountMenu onStatus={setMsg} />
          <PrimaryMenu />
        </div>
      </header>
      <p className="g-micro-warn g-micro-warn-quiet px-4 pt-2">
        chat ≠ authorization · you sign · we never hold the key ·{" "}
        <a
          href={FAUCET_URL}
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: "var(--muted)" }}
        >
          faucet
        </a>
      </p>
      {msg && (
        <div className="px-4 pt-3">
          <div className="g-alert warn">{asStatusText(msg)}</div>
        </div>
      )}
      {children}
    </div>
  );
}
