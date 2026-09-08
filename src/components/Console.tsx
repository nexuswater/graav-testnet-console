"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AppTab, TradePrefill } from "@/lib/tradePrefill";
import { TradeTab } from "@/components/tabs/TradeTab";
import { PortfolioTab } from "@/components/tabs/PortfolioTab";
import { CrossChainTab } from "@/components/tabs/CrossChainTab";
import { ChatTab } from "@/components/tabs/ChatTab";
import { XTab } from "@/components/tabs/XTab";
import { MarketsView } from "@/components/markets/MarketsView";
import { AppShell } from "@/components/shell/AppShell";
import { makeStatusSetter } from "@/lib/statusMsg";

const TABS: AppTab[] = ["Markets", "Trade", "Portfolio", "Cross-chain", "Chat", "X"];

function parseTab(raw: string | null): AppTab | null {
  if (!raw) return null;
  if (raw.toLowerCase() === "funding") return "Cross-chain";
  const hit = TABS.find((t) => t.toLowerCase() === raw.toLowerCase());
  return hit ?? null;
}

function sectionFor(tab: AppTab) {
  if (tab === "Markets" || tab === "Trade") return tab === "Trade" ? "trade" : "markets";
  if (tab === "Portfolio") return "portfolio";
  if (tab === "Chat") return "chat";
  if (tab === "Cross-chain") return "funding";
  return "x";
}

export function Console() {
  const search = useSearchParams();
  const [tab, setTab] = useState<AppTab>("Markets");
  const [statusMsg, setStatusMsgRaw] = useState<string | null>(null);
  const setStatusMsg = makeStatusSetter(setStatusMsgRaw);
  const [prefill, setPrefill] = useState<TradePrefill | null>(null);

  useEffect(() => {
    const fromUrl = parseTab(search.get("tab"));
    if (fromUrl) setTab(fromUrl);
  }, [search]);

  const goTrade = (nextPrefill?: TradePrefill) => {
    if (nextPrefill) setPrefill(nextPrefill);
    setTab("Trade");
  };

  const onHandoff = (nextTab: AppTab, nextPrefill?: TradePrefill) => {
    if (nextPrefill) setPrefill(nextPrefill);
    setTab(nextTab);
  };

  return (
    <AppShell
      active={sectionFor(tab)}
      activeTab={tab}
      onSelectTab={setTab}
      statusMsg={statusMsg}
      onStatus={(msg) => setStatusMsg(msg == null ? null : String(msg))}
    >
      <div className="g-main-pad">
        {tab === "Markets" && <MarketsView />}
        {tab === "Trade" && (
          <main className="g-main">
            <TradeTab
              prefill={prefill}
              onPrefillConsumed={() => setPrefill(null)}
              statusMsg={statusMsg}
              setStatusMsg={setStatusMsg}
            />
          </main>
        )}
        {tab === "Portfolio" && (
          <main className="g-main">
            <PortfolioTab setStatusMsg={setStatusMsg} />
          </main>
        )}
        {tab === "Cross-chain" && (
          <main className="g-main">
            <CrossChainTab onGoTrade={(pf) => goTrade(pf)} />
          </main>
        )}
        {tab === "Chat" && (
          <main className="g-main">
            <ChatTab onHandoff={onHandoff} />
          </main>
        )}
        {tab === "X" && (
          <main className="g-main">
            <XTab onGoTrade={() => goTrade()} />
          </main>
        )}
      </div>
    </AppShell>
  );
}
