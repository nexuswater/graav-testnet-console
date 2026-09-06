"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AppTab } from "@/lib/tradePrefill";

const TABS: AppTab[] = ["Trade", "Portfolio", "Cross-chain", "Chat", "X"];

type Props = { activeTab?: AppTab; onSelectTab?: (tab: AppTab) => void; };

export function PrimaryMenu({ activeTab, onSelectTab }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [legacy, setLegacy] = useState(false);
  const onHome = pathname === "/" && legacy;

  useEffect(() => {
    setLegacy(new URLSearchParams(window.location.search).get("legacy") === "1");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | TouchEvent) => { const el = rootRef.current; if (el && e.target instanceof Node && !el.contains(e.target)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointer); document.addEventListener("touchstart", onPointer); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("touchstart", onPointer); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const goTab = (tab: AppTab) => {
    setOpen(false);
    if (onHome && onSelectTab) { onSelectTab(tab); return; }
    router.push(`/?legacy=1&tab=${encodeURIComponent(tab)}`);
  };

  return <div className="g-menu" ref={rootRef}>
    <button type="button" className="g-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-label="Menu" onClick={() => setOpen((v) => !v)}><span className="g-menu-bars" aria-hidden><span /><span /><span /></span><span className="g-menu-word">Menu</span></button>
    {open && <div className="g-menu-panel" role="menu">
      <Link href="/launch" role="menuitem" className={`g-menu-item${pathname.startsWith("/launch") ? " on" : ""}`} onClick={() => setOpen(false)}>Launch Coin</Link>
      <Link href="/m/demo-moment-2026" role="menuitem" className={`g-menu-item${pathname.startsWith("/m/") ? " on" : ""}`} onClick={() => setOpen(false)}>Moments / Markets</Link>
      <Link href="/m/demo-moment-2026" role="menuitem" className={`g-menu-item${pathname.startsWith("/t/") ? " on" : ""}`} onClick={() => setOpen(false)}>Trade</Link>
      <Link href="/you" role="menuitem" className={`g-menu-item${pathname.startsWith("/you") ? " on" : ""}`} onClick={() => setOpen(false)}>You</Link>
      {legacy && <><div className="g-menu-divider" /><div className="g-menu-label">Legacy surfaces</div>{TABS.map((t) => <button key={t} type="button" role="menuitem" className={`g-menu-item${onHome && activeTab === t ? " on" : ""}`} onClick={() => goTab(t)}>{t}</button>)}</>}
    </div>}
  </div>;
}
