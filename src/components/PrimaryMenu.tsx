"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import type { AppTab } from "@/lib/tradePrefill";

type Props = { activeTab?: AppTab; onSelectTab?: (tab: AppTab) => void };

export function PrimaryMenu({ activeTab, onSelectTab }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() || "/";
  const router = useRouter();
  const onHome = pathname === "/";

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const goTab = (tab: AppTab) => {
    setOpen(false);
    if (onHome && onSelectTab) {
      onSelectTab(tab);
      return;
    }
    router.push(`/?tab=${encodeURIComponent(tab)}`);
  };

  return (
    <div className="g-menu" ref={rootRef}>
      <button
        type="button"
        className="g-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="g-menu-bars" aria-hidden>
          <span />
          <span />
          <span />
        </span>
        <span className="g-menu-word">Menu</span>
      </button>
      {open && (
        <div className="g-menu-panel" role="menu">
          <button type="button" role="menuitem" className={`g-menu-item${onHome && activeTab === "Markets" ? " on" : ""}`} onClick={() => goTab("Markets")}>Markets</button>
          <Link href="/launch" role="menuitem" className={`g-menu-item${pathname.startsWith("/launch") ? " on" : ""}`} onClick={() => setOpen(false)}>Launch</Link>
          <button type="button" role="menuitem" className={`g-menu-item${onHome && activeTab === "Trade" ? " on" : ""}`} onClick={() => goTab("Trade")}>Trade</button>
          <button type="button" role="menuitem" className={`g-menu-item${onHome && activeTab === "Portfolio" ? " on" : ""}`} onClick={() => goTab("Portfolio")}>Portfolio</button>
          <button type="button" role="menuitem" className={`g-menu-item${onHome && activeTab === "Chat" ? " on" : ""}`} onClick={() => goTab("Chat")}>Chat</button>
          <div className="g-menu-divider" />
          <button type="button" role="menuitem" className={`g-menu-item${onHome && activeTab === "Cross-chain" ? " on" : ""}`} onClick={() => goTab("Cross-chain")}>Funding</button>
          <button type="button" role="menuitem" className={`g-menu-item${onHome && activeTab === "X" ? " on" : ""}`} onClick={() => goTab("X")}>X</button>
          <Link href="/you" role="menuitem" className={`g-menu-item${pathname.startsWith("/you") ? " on" : ""}`} onClick={() => setOpen(false)}>Account</Link>
          <div className="g-menu-divider" />
          <div style={{ padding: "8px 10px 6px" }}><ThemeToggle /></div>
        </div>
      )}
    </div>
  );
}
