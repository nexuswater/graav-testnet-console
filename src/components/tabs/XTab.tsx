"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectX } from "@/components/ConnectX";
import { XMark } from "@/components/XMark";
import { ATTRIBUTION_V1_RULE } from "@/lib/xPrimary";
import {
  GRAAV_X_HANDLE_AT,
  LAUNCH_EXAMPLE_TICKER,
  launchComposerText,
  portfolioCommandText,
  tradeCommandText,
  xDmDeepLinkAvailable,
  xDmUrl,
  xPostIntentUrl,
} from "@/lib/xLaunchComposer";

type CapRow = {
  id: string;
  label: string;
  status: string;
  detail: string;
};

type EnvItem = {
  key: string;
  purpose: string;
  state: string;
  present: boolean;
};

type CapResponse = {
  productHandle?: string;
  featurePublicXWrite?: boolean;
  writeClosedWhy?: string | null;
  envKeysNeeded?: string[];
  envChecklist?: EnvItem[];
  spine?: {
    chatToSession?: string;
    connectXIdentity?: string;
    xApiReadMentions?: string;
    xBotReplySession?: string;
    publicXWrite?: string;
  };
  rows?: CapRow[];
  writeGate?: {
    open?: boolean;
    reason?: string;
    featureFlag?: boolean;
    hasProductToken?: boolean;
  };
  probedAt?: string;
  error?: string;
};

type CoverageRowView = {
  fixture: string;
  scope: string;
  text: string;
  status: string;
  liveReady: boolean;
  rail: string;
  reason: string;
  pass: boolean;
  bind?: { originTweetId?: string; replyTweetId?: string; originHash?: string };
  session?: { id: string; url: string } | null;
};

type CoverageResponse = {
  summary?: Record<string, number>;
  allPass?: boolean;
  rows?: CoverageRowView[];
  error?: string;
};

function statusColor(status: string): string {
  switch (status) {
    case "PASS":
    case "READY":
      return "var(--good)";
    case "SCAFFOLD":
    case "SOFT_READY":
      return "var(--x)";
    case "CLOSED":
    case "SKIP":
      return "var(--dim)";
    case "MISSING_ENV":
    case "BLOCKED":
    case "ERROR":
      return "var(--warn)";
    default:
      return "var(--muted)";
  }
}

function envStateLabel(state: string): string {
  switch (state) {
    case "already_set":
      return "set";
    case "needed_from_josh":
      return "needed";
    case "keep_false_until_go":
      return "closed";
    default:
      return state.replace(/_/g, " ");
  }
}

const EXAMPLES: { label: string; text: string; display: string }[] = [
  { label: "Launch", text: launchComposerText(LAUNCH_EXAMPLE_TICKER), display: launchComposerText(LAUNCH_EXAMPLE_TICKER).replace("\n", " ") },
  { label: "Buy", text: tradeCommandText("buy", "gSWAP", "0.1"), display: tradeCommandText("buy", "gSWAP", "0.1") },
  { label: "Sell", text: tradeCommandText("sell", "gSWAP", "10"), display: tradeCommandText("sell", "gSWAP", "10") },
  { label: "Portfolio", text: portfolioCommandText(), display: portfolioCommandText() },
];

export function XTab() {
  const [caps, setCaps] = useState<CapResponse | null>(null);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [dryRun, setDryRun] = useState<string | null>(null);
  const dmDeepLink = xDmDeepLinkAvailable();

  const loadCaps = useCallback(async (probeMentions: boolean) => {
    setBusy(true);
    try {
      const q = probeMentions ? "?probeMentions=1" : "";
      const res = await fetch(`/api/x/capabilities${q}`, { cache: "no-store" });
      const data = (await res.json()) as CapResponse;
      setCaps(data);
    } catch (e) {
      setCaps({ error: String(e), rows: [] });
    } finally {
      setBusy(false);
    }
  }, []);

  const loadCoverage = useCallback(async () => {
    try {
      const res = await fetch("/api/x/coverage", { cache: "no-store" });
      setCoverage((await res.json()) as CoverageResponse);
    } catch (e) {
      setCoverage({ error: String(e), rows: [] });
    }
  }, []);

  useEffect(() => {
    void loadCaps(false);
    void loadCoverage();
  }, [loadCaps, loadCoverage]);

  const runDryReply = async () => {
    setBusy(true);
    setDryRun(null);
    try {
      const res = await fetch("/api/x/reply-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentionId: "dry-run-mention",
          text: tradeCommandText("buy", "gSWAP", "0.1"),
          dryRun: true,
        }),
      });
      const data = await res.json();
      setDryRun(JSON.stringify(data, null, 2));
    } catch (e) {
      setDryRun(String(e));
    } finally {
      setBusy(false);
    }
  };

  const writeOpen = caps?.featurePublicXWrite === true;
  const writeWhy =
    caps?.writeClosedWhy ||
    caps?.writeGate?.reason ||
    "Public replies are closed by policy.";
  const summary = coverage?.summary;
  const coverageLine = summary
    ? `${coverage?.allPass ? "all as expected" : "check"} · ready ${summary.READY ?? 0} · soft ${summary.SOFT_READY ?? 0} · blocked ${summary.BLOCKED ?? 0} · skip ${summary.SKIP ?? 0}`
    : coverage?.error
      ? "coverage unavailable"
      : "loading coverage…";

  return (
    <div className="space-y-5">
      <section>
        <h1 className="g-title">X</h1>
        <p className="g-sub" style={{ marginTop: 8 }}>
          Launch, buy, sell, and check your portfolio from a post, repost, or DM to{" "}
          <span style={{ color: "var(--text)" }}>{caps?.productHandle || GRAAV_X_HANDLE_AT}</span>.
          GRAAV replies with a signing link; your wallet signs. Nothing is posted for you.
        </p>
      </section>

      <section className="g-card" aria-labelledby="x-commands">
        <div id="x-commands" style={{ fontWeight: 650 }}>Commands</div>
        <p className="g-hint" style={{ marginTop: 4 }}>
          Tap to open X with the command prefilled. DMs are the same actions, privately.
          {!dmDeepLink && ` For a DM, tap Message on ${GRAAV_X_HANDLE_AT} and paste it.`}
        </p>
        <ul className="space-y-2" style={{ marginTop: 12, listStyle: "none", padding: 0 }}>
          {EXAMPLES.map((ex) => (
            <li
              key={ex.label}
              className="flex items-center justify-between gap-3 flex-wrap rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
            >
              <div style={{ minWidth: 0 }}>
                <div className="g-micro">{ex.label}</div>
                <code className="text-sm" style={{ color: "var(--text)", overflowWrap: "anywhere" }}>{ex.display}</code>
              </div>
              <div className="flex gap-2" style={{ flexShrink: 0 }}>
                <a className="g-btn sm" href={xPostIntentUrl(ex.text)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <XMark size={12} /> Post
                </a>
                <a className="g-btn sm" href={xDmUrl(ex.text)} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <XMark size={12} /> DM
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="g-sheet" style={{ marginTop: 0 }}>
        <h3 className="text-sm font-semibold">Sign in with X</h3>
        <p className="g-hint">
          Links your X identity for creator and share rewards. It never posts for you and never
          authorizes a trade.
        </p>
        <div className="mt-3">
          <ConnectX />
        </div>
      </div>

      <section className="g-card">
        <div style={{ fontWeight: 650 }}>Share &amp; earn</div>
        <p className="g-sub" style={{ marginTop: 6 }}>{ATTRIBUTION_V1_RULE}</p>
        <p className="g-hint">Rewards are earned on X — posts, reposts, and DMs. Payouts are not live yet.</p>
      </section>

      <details className="g-details">
        <summary>
          Integration status <span className="g-micro" style={{ marginLeft: 8 }}>{coverageLine}</span>
        </summary>

        <section className="g-card" style={{ marginTop: 12 }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Reply coverage</div>
              <p className="g-hint">
                Canonical buy / sell / create / MOMENT commands run through the reply path as a dry run — nothing is read from or posted to X.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {summary && (
                <span className="g-micro" style={{ color: coverage?.allPass ? "var(--good)" : "var(--warn)" }}>
                  {coverage?.allPass ? "ALL AS EXPECTED" : "CHECK"} · READY {summary.READY ?? 0} · SOFT {summary.SOFT_READY ?? 0} · BLOCKED {summary.BLOCKED ?? 0} · SKIP {summary.SKIP ?? 0}
                </span>
              )}
              <button type="button" className="g-btn sm" disabled={busy} onClick={() => void loadCoverage()}>
                Re-run
              </button>
            </div>
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {(coverage?.rows || []).map((row) => (
              <li key={row.fixture} className="g-card" style={{ margin: 0 }}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="g-micro" style={{ color: "var(--muted)" }}>{row.scope}</span>
                  <code className="font-mono" style={{ color: "var(--text)", overflowWrap: "anywhere" }}>{row.text}</code>
                  <span className="g-micro" style={{ color: statusColor(row.status) }}>{row.status}</span>
                  <span className="g-micro" style={{ color: row.liveReady ? "var(--good)" : "var(--dim)" }}>
                    {row.liveReady ? "live when replies open" : "dry-run only"}
                  </span>
                  {!row.pass && (
                    <span className="g-micro" style={{ color: "var(--warn)" }}>unexpected</span>
                  )}
                </div>
                <p className="g-hint" style={{ marginTop: 4 }}>{row.rail !== "—" ? `${row.rail} · ` : ""}{row.reason}</p>
                {row.session?.url && (
                  <p className="g-micro" style={{ marginTop: 4, overflowWrap: "anywhere" }}>
                    signing link minted (60s) · origin {row.bind?.originTweetId || "—"} · reply {row.bind?.replyTweetId || "—"}
                    {row.bind?.originHash ? ` · originHash ${row.bind.originHash.slice(0, 10)}…` : ""}
                  </p>
                )}
              </li>
            ))}
            {!coverage?.rows?.length && (
              <li className="g-hint">{coverage?.error || "Loading…"}</li>
            )}
          </ul>
          <p className="g-hint" style={{ marginTop: 8 }}>
            Public replies stay closed. READY rows post only after the write flag and product token are set;
            SOFT_READY create waits for the Coin V1 sign rail; MOMENT waits for the first Moment market.
          </p>
        </section>

        <section className="g-card" style={{ marginTop: 12 }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">Capabilities</div>
              <p className="g-hint">Identity · read mentions · public replies</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="g-btn sm"
                disabled={busy}
                onClick={() => void loadCaps(false)}
              >
                Refresh
              </button>
              <button
                type="button"
                className="g-btn sm"
                disabled={busy}
                onClick={() => void loadCaps(true)}
                title="Reads mentions from X (uses API quota)"
              >
                Check mentions
              </button>
            </div>
          </div>

          <ul className="mt-3 space-y-2 text-sm">
            {(caps?.rows || []).map((row) => (
              <li key={row.id} className="g-card" style={{ margin: 0 }}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span>{row.label}</span>
                  <span className="g-micro" style={{ color: statusColor(row.status) }}>
                    {row.status}
                  </span>
                </div>
                <p className="g-hint" style={{ marginTop: 4 }}>
                  {row.detail}
                </p>
              </li>
            ))}
            {!caps?.rows?.length && (
              <li className="g-hint">{busy ? "Loading…" : caps?.error || "—"}</li>
            )}
          </ul>

          <div
            className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
            style={{ color: "var(--muted)" }}
          >
            <span className="g-micro" style={{ color: writeOpen ? "var(--good)" : "var(--dim)" }}>
              PUBLIC REPLIES {writeOpen ? "OPEN" : "CLOSED"}
            </span>
            {!writeOpen && <p style={{ marginTop: 6 }}>{writeWhy}</p>}
            {!writeOpen && !!caps?.envKeysNeeded?.length && (
              <p className="g-hint" style={{ marginTop: 8 }}>
                Env keys: <code>{caps.envKeysNeeded.join(", ")}</code>
              </p>
            )}
          </div>

          {caps?.spine && (
            <div className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
              <div className="g-micro" style={{ marginBottom: 6 }}>
                SPINE
              </div>
              <ul className="space-y-1 g-hint" style={{ margin: 0 }}>
                <li>Chat → signing link · {caps.spine.chatToSession}</li>
                <li>Sign in with X · {caps.spine.connectXIdentity}</li>
                <li>Read mentions · {caps.spine.xApiReadMentions}</li>
                <li>Reply with signing link · {caps.spine.xBotReplySession}</li>
                <li>Public replies · {caps.spine.publicXWrite}</li>
              </ul>
            </div>
          )}

          {!!caps?.envChecklist?.length && (
            <div className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
              <div className="g-micro" style={{ marginBottom: 6 }}>
                ENV
              </div>
              <ul className="space-y-1" style={{ margin: 0 }}>
                {caps.envChecklist.map((e) => (
                  <li key={e.key} className="g-hint">
                    <code>{e.key}</code>{" "}
                    <span
                      className="g-micro"
                      style={{ color: e.state === "already_set" ? "var(--good)" : "var(--muted)" }}
                    >
                      {envStateLabel(e.state)}
                    </span>
                    <span className="g-micro"> · {e.purpose}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runDryReply()}
              className="g-btn sm"
              disabled={busy}
              title="Parses a sample mention and mints a signing link without posting"
            >
              Dry-run a reply
            </button>
          </div>
          {dryRun && (
            <pre
              className="mt-3 max-h-64 overflow-auto rounded-[10px] border border-[var(--line)] bg-[var(--bg)] p-3 text-xs"
              style={{ color: "var(--muted)" }}
            >
              {dryRun}
            </pre>
          )}
          {caps?.probedAt && (
            <p className="g-micro" style={{ marginTop: 8 }}>
              checked {caps.probedAt}
            </p>
          )}
        </section>
      </details>
    </div>
  );
}
