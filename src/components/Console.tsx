"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AppTab, TradePrefill } from "@/lib/tradePrefill";
import { FAUCET_URL } from "@/lib/chain";
import { TradeTab } from "@/components/tabs/TradeTab";
import { PortfolioTab } from "@/components/tabs/PortfolioTab";
import { CrossChainTab } from "@/components/tabs/CrossChainTab";
import { ChatTab } from "@/components/tabs/ChatTab";
import { XTab } from "@/components/tabs/XTab";
import { AccountMenu } from "@/components/AccountMenu";
import { PrimaryMenu } from "@/components/PrimaryMenu";
import { GraavLogo } from "@/components/GraavLogo";
import { makeStatusSetter } from "@/lib/statusMsg";

const TABS: AppTab[] = ["Trade", "Portfolio", "Cross-chain", "Chat", "X"];

function parseTab(raw: string | null): AppTab | null {
  if (!raw) return null;
  const hit = TABS.find((t) => t.toLowerCase() === raw.toLowerCase());
  return hit ?? null;
}

export function Console() {
  const search = useSearchParams();
  const [tab, setTab] = useState<AppTab>("Trade");
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
    <div className="g-app">
      <header className="g-top">
        <div className="g-top-brand">
          <GraavLogo height={30} />
          <span className="g-pill">TESTNET</span>
        </div>
        <div className="g-top-actions">
          <PrimaryMenu activeTab={tab} onSelectTab={setTab} />
          <AccountMenu onStatus={setStatusMsg} />
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

      {statusMsg && (
        <div className="px-4 pt-3">
          <div className="g-alert warn">{statusMsg}</div>
        </div>
      )}

      <main className="g-main">
        {tab === "Trade" && (
          <TradeTab
            prefill={prefill}
            onPrefillConsumed={() => setPrefill(null)}
            statusMsg={statusMsg}
            setStatusMsg={setStatusMsg}
          />
        )}
        {tab === "Portfolio" && (
          <PortfolioTab setStatusMsg={setStatusMsg} />
        )}
        {tab === "Cross-chain" && (
          <CrossChainTab onGoTrade={(pf) => goTrade(pf)} />
        )}
        {tab === "Chat" && <ChatTab onHandoff={onHandoff} />}
        {tab === "X" && <XTab onGoTrade={() => goTrade()} />}
      </main>

      <footer className="g-note">
        Standalone signing desk · X stays the social layer · not mainnet · chain
        1449000
      </footer>
    </div>
  );
}
