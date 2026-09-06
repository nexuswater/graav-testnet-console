"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AppTab } from "@/lib/tradePrefill";
import { RLUSD_V1 as RLUSD } from "@/lib/rlusd-v1/config";

const TABS: AppTab[] = ["Trade", "Portfolio", "Cross-chain", "Chat", "X"];

type Props = {
  /** When on home console, switch tabs in-place instead of full navigation. */
  activeTab?: AppTab;
  onSelectTab?: (tab: AppTab) => void;
};

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
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
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
          <Link href="/launch" role="menuitem" className={`g-menu-item${pathname.startsWith("/launch") ? " on" : ""}`} onClick={() => setOpen(false)}>
            {RLUSD.profile === "testnet-clone" ? "Launch Coin (mRLUSD)" : "Launch Coin"}
          </Link>
          <Link href="/m/demo-moment-2026" role="menuitem" className={`g-menu-item${pathname.startsWith("/m/") ? " on" : ""}`} onClick={() => setOpen(false)}>
            Coin demo
          </Link>
          <Link href="/you" role="menuitem" className={`g-menu-item${pathname.startsWith("/you") ? " on" : ""}`} onClick={() => setOpen(false)}>
            You
          </Link>
          <div className="g-menu-divider" />
          <Link
            href="/new"
            role="menuitem"
            className={`g-menu-item${pathname.startsWith("/new") ? " on" : ""}`}
            onClick={() => setOpen(false)}
          >
            New market
          </Link>
          <div className="g-menu-divider" />
          {TABS.map((t) => {
            const on = onHome && activeTab === t;
            return (
              <button
                key={t}
                type="button"
                role="menuitem"
                className={`g-menu-item${on ? " on" : ""}`}
                onClick={() => goTab(t)}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
