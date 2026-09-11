"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { GraavLogo } from "@/components/GraavLogo";
import { PrimaryMenu } from "@/components/PrimaryMenu";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ChatIcon, MarketsIcon, PortfolioIcon } from "@/components/shell/Icons";
import { makeStatusSetter } from "@/lib/statusMsg";
import type { AppTab } from "@/lib/tradePrefill";

export type ShellSection = "markets" | "portfolio" | "chat" | "launch" | "you" | "funding" | "trade" | "x";

const PRIMARY: { href: string; tab?: AppTab; id: ShellSection; label: string }[] = [
  { href: "/", id: "markets", label: "Markets" },
  { href: "/?tab=Portfolio", tab: "Portfolio", id: "portfolio", label: "Portfolio" },
  { href: "/?tab=Chat", tab: "Chat", id: "chat", label: "Chat" },
];

type Props = {
  children: ReactNode;
  active?: ShellSection;
  activeTab?: AppTab;
  onSelectTab?: (tab: AppTab) => void;
  statusMsg?: string | null;
  onStatus?: (msg: unknown) => void;
};

export function AppShell({
  children,
  active,
  activeTab,
  onSelectTab,
  statusMsg,
  onStatus,
}: Props) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const setStatus = onStatus ?? makeStatusSetter(setLocalStatus);
  const message = statusMsg ?? localStatus;
  const onHome = pathname === "/";

  const go = (item: (typeof PRIMARY)[number]) => {
    if (item.tab && onHome && onSelectTab) {
      onSelectTab(item.tab);
      return;
    }
    if (item.id === "markets" && onHome && onSelectTab) {
      onSelectTab("Markets");
      return;
    }
    router.push(item.href);
  };

  const isOn = (id: ShellSection) => {
    if (active) return active === id;
    if (onHome && activeTab) {
      if (id === "markets") return activeTab === "Markets" || activeTab === "Trade";
      if (id === "portfolio") return activeTab === "Portfolio";
      if (id === "chat") return activeTab === "Chat";
    }
    if (id === "markets") return pathname === "/";
    if (id === "launch") return pathname.startsWith("/launch");
    if (id === "you") return pathname.startsWith("/you");
    return false;
  };

  return (
    <div className="g-app">
      <header className="g-top">
        <div className="g-top-brand">
          <GraavLogo height={30} />
          <span className="g-pill g-testnet">TESTNET</span>
        </div>
        <nav className="g-desktop-nav" aria-label="Primary">
          {PRIMARY.map((item) => (
            <button
              key={item.id}
              type="button"
              className={isOn(item.id) ? "on" : undefined}
              onClick={() => go(item)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="g-top-actions">
          <ThemeToggle compact />
          <AccountMenu onStatus={setStatus} />
          <PrimaryMenu activeTab={activeTab} onSelectTab={onSelectTab} />
        </div>
      </header>

      <div className="g-secondary-nav" aria-label="graav.xyz — setup, charts, account">
        <Link href="/launch" className={isOn("launch") ? "on" : undefined}>Setup</Link>
        <span aria-hidden="true">→</span>
        <Link href="/" className={isOn("markets") ? "on" : undefined}>Charts</Link>
        <span aria-hidden="true">→</span>
        <Link href="/you" className={isOn("you") ? "on" : undefined}>Account</Link>
      </div>
      <p className="g-lock-bar">Daily ops on X · this desk is setup, charts, and account</p>

      {message && (
        <div className="g-status-msg">
          <div className="g-alert warn">{message}</div>
        </div>
      )}

      {children}

      <nav className="g-bottom-nav" aria-label="Mobile">
        {PRIMARY.map((item) => {
          const Icon = item.id === "markets" ? MarketsIcon : item.id === "portfolio" ? PortfolioIcon : ChatIcon;
          return (
            <button
              key={item.id}
              type="button"
              className={isOn(item.id) ? "on" : undefined}
              onClick={() => go(item)}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
