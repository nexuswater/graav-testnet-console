"use client";

import { useState, type FormEvent } from "react";
import type { AppTab, TradePrefill } from "@/lib/tradePrefill";
import { parseIntent, type IntentPlan } from "@/lib/chatIntent";
import { RLUSD_V1 as RLUSD } from "@/lib/rlusd-v1/config";
import { XMark } from "@/components/XMark";
import {
  GRAAV_X_HANDLE_AT,
  launchComposerText,
  portfolioCommandText,
  tradeCommandText,
  xDmUrl,
  xPostIntentUrl,
} from "@/lib/xLaunchComposer";

type Msg = {
  id: string;
  role: "user" | "bot";
  text: string;
  handoff?: { tab: AppTab; prefill?: TradePrefill; label: string };
  href?: string;
  sessionUrl?: string;
  /** Same command, ready to post or DM on X. */
  xText?: string;
};

type Props = {
  onHandoff: (tab: AppTab, prefill?: TradePrefill) => void;
};

/** Rebuild the canonical X command for a parsed intent so the user can send it from X instead. */
function xCommandFor(plan: IntentPlan): string | undefined {
  const prefill = plan.handoff?.prefill;
  if (plan.kind === "portfolio") return portfolioCommandText();
  if (plan.kind === "buy" && prefill?.symbol) return tradeCommandText("buy", prefill.symbol, prefill.buyXrp ?? "");
  if (plan.kind === "sell" && prefill?.symbol) return tradeCommandText("sell", prefill.symbol, prefill.sellAmount ?? "");
  if (plan.kind === "launch" && prefill?.createSymbol) return launchComposerText(prefill.createSymbol);
  return undefined;
}

const CTA_STYLE = {
  marginTop: 10,
  padding: "10px",
  fontSize: 13,
  display: "flex",
  textAlign: "center" as const,
  textDecoration: "none",
};

export function ChatTab({ onHandoff }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "welcome",
      role: "bot",
      text: `Ask me to launch, buy, sell, or show your portfolio. The same commands work in posts, reposts, and DMs to ${GRAAV_X_HANDLE_AT}.\n\nTry: LAUNCH HORMUZ · BUY gSWAP 0.1 · PORTFOLIO`,
    },
  ]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const userMsg: Msg = {
      id: `u-${Date.now()}`,
      role: "user",
      text,
    };
    const parsed = parseIntent(text);
    setInput("");
    setBusy(true);
    let sessionUrl: string | undefined;
    let reply = parsed.reply;
    if ((parsed.kind === "buy" || parsed.kind === "sell") && parsed.sessionBody && String(parsed.sessionBody.factory || "").toLowerCase() === String(RLUSD.factoryAddress || "").toLowerCase()) {
      reply += "\n\nOpen the market page to review and sign.";
    } else if (parsed.sessionBody) {
      try {
        const res = await fetch("/api/s", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.sessionBody),
        });
        const data = (await res.json()) as {
          url?: string;
          error?: string;
          id?: string;
        };
        if (res.ok && data.url) {
          sessionUrl = data.url;
          reply += "\n\nYour signing link is ready — open it and sign in your wallet.";
        } else {
          reply += `\n\nCouldn't create a signing link (${data.error || res.status}). Use Trade instead.`;
        }
      } catch (err) {
        reply += `\n\nCouldn't create a signing link (${String(err)}). Use Trade instead.`;
      }
    }
    const botMsg: Msg = {
      id: `b-${Date.now()}`,
      role: "bot",
      text: reply,
      handoff: parsed.handoff,
      href: parsed.kind === "launch"
        ? `/launch${parsed.handoff?.prefill?.createSymbol ? `?ticker=${encodeURIComponent(parsed.handoff.prefill.createSymbol)}` : ""}`
        : undefined,
      sessionUrl,
      xText: xCommandFor(parsed),
    };
    setMsgs((m) => [...m, userMsg, botMsg]);
    setBusy(false);
  };

  return (
    <div className="flex min-h-[480px] flex-col overflow-hidden rounded-[16px] border border-[var(--line-2)] bg-[var(--bg-2)]">
      <div className="border-b border-[var(--line)] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="g-av" style={{ width: 32, height: 32, fontSize: 13 }}>
            G
          </div>
          <div>
            <div className="text-sm font-semibold">GRAAV</div>
            <div className="g-micro">{GRAAV_X_HANDLE_AT}</div>
          </div>
        </div>
        <p className="g-micro-warn mt-2">
          Chat previews only — it never signs or sends a transaction.
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
              style={
                m.role === "user"
                  ? {
                      background: "var(--cta-bg)",
                      color: "var(--cta-fg)",
                    }
                  : {
                      background: "var(--surface)",
                      color: "var(--text)",
                      border: "1px solid var(--border)",
                    }
              }
            >
              <p className="whitespace-pre-wrap" style={{ overflowWrap: "anywhere" }}>{m.text}</p>
              {m.sessionUrl && (
                <a href={m.sessionUrl} className="g-cta" style={CTA_STYLE}>
                  Open signing link
                </a>
              )}
              {m.href && (
                <a href={m.href} className="g-cta" style={CTA_STYLE}>
                  {m.handoff?.label || "Open Launch"}
                </a>
              )}
              {m.handoff && !m.href && (
                <button
                  type="button"
                  onClick={() => onHandoff(m.handoff!.tab, m.handoff!.prefill)}
                  className={m.sessionUrl ? "g-cta ghost" : "g-cta"}
                  style={{ marginTop: 10, padding: "10px", fontSize: 13 }}
                >
                  {m.handoff.label}
                </button>
              )}
              {m.xText && (
                <div className="flex gap-2">
                  <a
                    href={xPostIntentUrl(m.xText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="g-cta ghost"
                    style={{ ...CTA_STYLE, flex: 1 }}
                    title="Opens X with this command prefilled"
                  >
                    <XMark size={12} /> Post on X
                  </a>
                  <a
                    href={xDmUrl(m.xText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="g-cta ghost"
                    style={{ ...CTA_STYLE, flex: 1 }}
                    title={`DM ${GRAAV_X_HANDLE_AT}`}
                  >
                    <XMark size={12} /> DM
                  </a>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => void send(e)}
        className="flex gap-2 border-t border-[var(--line)] px-3 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message GRAAV…"
          aria-label="Message GRAAV"
          className="g-search"
          disabled={busy}
        />
        <button
          type="submit"
          className="g-btn"
          style={{ fontWeight: 650 }}
          disabled={busy || !input.trim()}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
