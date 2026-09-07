"use client";

import { useState, type FormEvent } from "react";
import type { AppTab, TradePrefill } from "@/lib/tradePrefill";
import { parseIntent } from "@/lib/chatIntent";
import { RLUSD_V1 as RLUSD } from "@/lib/rlusd-v1/config";

type Msg = {
  id: string;
  role: "user" | "bot";
  text: string;
  handoff?: { tab: AppTab; prefill?: TradePrefill; label: string };
  sessionUrl?: string;
};

type Props = {
  onHandoff: (tab: AppTab, prefill?: TradePrefill) => void;
};

export function ChatTab({ onHandoff }: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: "welcome",
      role: "bot",
      text: "GRAAV chat · Coin V1 intents. Try: BUY MOMENT 0.1 · SELL 1 MOMENT · LAUNCH MYCOIN. Wallet approval is required; chat never signs or sends a transaction.",
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
      reply += "\n\nUse the Markets RLUSD wallet rail to review and sign. Chat never creates a trade session.";
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
          reply += `\n\nSession: ${data.url}`;
        } else {
          reply += `\n\nSession mint failed: ${data.error || res.status}. Use Trade handoff.`;
        }
      } catch (err) {
        reply += `\n\nSession mint error: ${String(err)}. Use Trade handoff.`;
      }
    }
    const botMsg: Msg = {
      id: `b-${Date.now()}`,
      role: "bot",
      text: reply,
      handoff: parsed.handoff,
      sessionUrl,
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
            <div className="g-micro">@graav_xyz · local intents</div>
          </div>
        </div>
        <p className="g-micro-warn mt-2">
          chat ≠ authorization — messages never sign or send txs
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
                      background: "var(--x)",
                      color: "#fff",
                    }
                  : {
                      background: "#111113",
                      color: "var(--text)",
                      border: "1px solid var(--line)",
                    }
              }
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              {m.sessionUrl && (
                <a
                  href={m.sessionUrl}
                  className="g-cta"
                  style={{
                    marginTop: 10,
                    padding: "10px",
                    fontSize: 13,
                    display: "block",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Open signing session
                </a>
              )}
              {m.handoff && (
                <button
                  type="button"
                  onClick={() => onHandoff(m.handoff!.tab, m.handoff!.prefill)}
                  className={m.sessionUrl ? "g-cta ghost" : "g-cta"}
                  style={{
                    marginTop: 10,
                    padding: "10px",
                    fontSize: 13,
                  }}
                >
                  {m.handoff.label}
                </button>
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
          className="g-search"
          disabled={busy}
        />
        <button
          type="submit"
          className="g-btn"
          style={{ fontWeight: 650 }}
          disabled={busy}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
