"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { GraavLogo } from "@/components/GraavLogo";
import { PrimaryMenu } from "@/components/PrimaryMenu";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ChatIcon, LaunchIcon, MarketsIcon, PortfolioIcon } from "@/components/shell/Icons";
import { makeStatusSetter } from "@/lib/statusMsg";
import type { AppTab } from "@/lib/tradePrefill";

export type ShellSection = "markets" | "portfolio" | "chat" | "launch" | "you" | "funding" | "trade" | "x";

type NavItem = { href: string; tab?: AppTab; id: ShellSection; label: string; Icon: ComponentType<{ size?: number }> };

const PRIMARY: NavItem[] = [
  { href: "/", tab: "Markets", id: "markets", label: "Markets", Icon: MarketsIcon },
  { href: "/launch", id: "launch", label: "Launch", Icon: LaunchIcon },
  { href: "/?tab=Portfolio", tab: "Portfolio", id: "portfolio", label: "Portfolio", Icon: PortfolioIcon },
  { href: "/?tab=Chat", tab: "Chat", id: "chat", label: "Chat", Icon: ChatIcon },
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

  const go = (item: NavItem) => {
    if (item.tab && onHome && onSelectTab) {
      onSelectTab(item.tab);
      return;
    }
    router.push(item.href);
  };

  const isOn = (id: ShellSection) => {
    if (active) return active === id || (id === "markets" && active === "trade");
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
          <span className="g-pill g-testnet" title="XRPL EVM Testnet · test assets only">TESTNET</span>
        </div>
        <nav className="g-desktop-nav" aria-label="Primary">
          {PRIMARY.map((item) => (
            <button
              key={item.id}
              type="button"
              className={isOn(item.id) ? "on" : undefined}
              aria-current={isOn(item.id) ? "page" : undefined}
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

      {message && (
        <div className="g-status-msg">
          <div className="g-alert warn">{message}</div>
        </div>
      )}

      {children}

      <nav className="g-bottom-nav" aria-label="Primary">
        {PRIMARY.map((item) => (
          <button
            key={item.id}
            type="button"
            className={isOn(item.id) ? "on" : undefined}
            aria-current={isOn(item.id) ? "page" : undefined}
            onClick={() => go(item)}
          >
            <item.Icon />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
