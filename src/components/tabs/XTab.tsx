"use client";

import { useCallback, useEffect, useState } from "react";
import { ConnectX } from "@/components/ConnectX";
import { ATTRIBUTION_V1_LINE, X_DAILY_OPS_LINE } from "@/lib/xPrimary";

type Props = {
  onGoTrade: () => void;
};

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
      return "var(--warn)";
    case "ERROR":
      return "var(--nebula)";
    default:
      return "var(--muted)";
  }
}

export function XTab({ onGoTrade }: Props) {
  const [caps, setCaps] = useState<CapResponse | null>(null);
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [dryRun, setDryRun] = useState<string | null>(null);

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
          text: "@graav_xyz buy $g589 0.1",
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
    "FEATURE_PUBLIC_X_WRITE=false";

  return (
    <div className="space-y-5">
      <section>
        <h1 className="g-title">X · daily ops</h1>
        <p className="g-sub" style={{ marginTop: 8 }}>
          Product handle{" "}
          <span style={{ color: "var(--x)" }}>
            {caps?.productHandle || "@graav_xyz"}
          </span>
          . {X_DAILY_OPS_LINE} User Connect X is identity only. Public write
          stays env-gated — posts and DMs never send txs; replies emit{" "}
          <code className="g-micro">/s/&#123;id&#125;</code> only.
        </p>
      </section>

      <div className="g-sheet" style={{ marginTop: 0 }}>
        <h3 className="text-sm font-semibold">Sign in with X</h3>
        <p className="g-hint">
          OAuth identity only · no tweet/DM send scopes · X login ≠ trade
          authorization · not the product bot
        </p>
        <div className="mt-3">
          <ConnectX />
        </div>
      </div>

      <section className="g-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Capability matrix</div>
            <p className="g-hint">
              Live probe · identity / read mentions / write
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="g-btn"
              disabled={busy}
              onClick={() => void loadCaps(false)}
            >
              Refresh
            </button>
            <button
              type="button"
              className="g-btn"
              disabled={busy}
              onClick={() => void loadCaps(true)}
              title="Hits X mentions API (uses quota)"
            >
              Probe mentions
            </button>
          </div>
        </div>

        <ul className="mt-3 space-y-2 text-sm">
          {(caps?.rows || []).map((row) => (
            <li key={row.id} className="g-card" style={{ margin: 0 }}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span>{row.label}</span>
                <span
                  className="g-micro"
                  style={{ color: statusColor(row.status) }}
                >
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

        {!writeOpen && (
          <div
            className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
            style={{ color: "var(--muted)" }}
          >
            <span className="g-micro" style={{ color: "var(--dim)" }}>
              WRITE CLOSED
            </span>
            <p style={{ marginTop: 6 }}>{writeWhy}</p>
            {!!caps?.envKeysNeeded?.length && (
              <p className="g-hint" style={{ marginTop: 8 }}>
                Vercel env keys (Josh):{" "}
                <code>{caps.envKeysNeeded.join(", ")}</code>
              </p>
            )}
          </div>
        )}
        {caps?.spine && (
          <div className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
            <div className="g-micro" style={{ marginBottom: 6 }}>
              PRODUCT SPINE
            </div>
            <ul className="space-y-1 g-hint" style={{ margin: 0 }}>
              <li>Chat → /s · {caps.spine.chatToSession}</li>
              <li>Connect X identity · {caps.spine.connectXIdentity}</li>
              <li>X API read mentions · {caps.spine.xApiReadMentions}</li>
              <li>X bot reply-session · {caps.spine.xBotReplySession}</li>
              <li>Public X write · {caps.spine.publicXWrite}</li>
            </ul>
          </div>
        )}

        {!!caps?.envChecklist?.length && (
          <div className="mt-3 rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
            <div className="g-micro" style={{ marginBottom: 6 }}>
              ENV CHECKLIST
            </div>
            <ul className="space-y-1" style={{ margin: 0 }}>
              {caps.envChecklist.map((e) => (
                <li key={e.key} className="g-hint">
                  <code>{e.key}</code>{" "}
                  <span
                    className="g-micro"
                    style={{
                      color:
                        e.state === "already_set"
                          ? "var(--good)"
                          : e.state === "needed_from_josh"
                            ? "var(--warn)"
                            : e.state === "keep_false_until_go"
                              ? "var(--dim)"
                              : "var(--muted)",
                    }}
                  >
                    {e.state}
                  </span>
                  <span className="g-micro"> · {e.purpose}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {caps?.probedAt && (
          <p className="g-micro" style={{ marginTop: 8 }}>
            probed {caps.probedAt}
          </p>
        )}
      </section>

      <section className="g-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">Cron coverage matrix</div>
            <p className="g-hint">
              buy / sell / create / MOMENT · dry-run mint of /s · no X read, no post
            </p>
          </div>
          <div className="flex items-center gap-2">
            {coverage?.summary && (
              <span className="g-micro" style={{ color: coverage.allPass ? "var(--good)" : "var(--warn)" }}>
                {coverage.allPass ? "ALL PASS" : "CHECK"} · READY {coverage.summary.READY ?? 0} · SOFT {coverage.summary.SOFT_READY ?? 0} · BLOCKED {coverage.summary.BLOCKED ?? 0} · SKIP {coverage.summary.SKIP ?? 0}
              </span>
            )}
            <button type="button" className="g-btn" disabled={busy} onClick={() => void loadCoverage()}>
              Re-run
            </button>
          </div>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {(coverage?.rows || []).map((row) => (
            <li key={row.fixture} className="g-card" style={{ margin: 0 }}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="g-micro" style={{ color: "var(--muted)" }}>{row.scope}</span>
                <code className="font-mono" style={{ color: "var(--text)" }}>{row.text}</code>
                <span className="g-micro" style={{ color: statusColor(row.status) }}>{row.status}</span>
                <span className="g-micro" style={{ color: row.liveReady ? "var(--good)" : "var(--dim)" }}>
                  {row.liveReady ? "live when flag opens" : "dry-run only"}
                </span>
                {!row.pass && (
                  <span className="g-micro" style={{ color: "var(--warn)" }}>unexpected</span>
                )}
              </div>
              <p className="g-hint" style={{ marginTop: 4 }}>{row.rail !== "—" ? `${row.rail} · ` : ""}{row.reason}</p>
              {row.session?.url && (
                <p className="g-micro" style={{ marginTop: 4, overflowWrap: "anywhere" }}>
                  /s minted (60s) · origin {row.bind?.originTweetId || "—"} · reply {row.bind?.replyTweetId || "—"}
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
          Write stays CLOSED. READY rows post only after FEATURE_PUBLIC_X_WRITE + product token;
          SOFT_READY create waits for the /s Coin V1 sign rail; MOMENT waits for the first Moment market.
          SoT: docs/x/CRON_COVERAGE_MATRIX_2026-09-11.md
        </p>
      </section>

      <ul className="space-y-2 text-sm">
        <li className="g-card">
          <span style={{ color: writeOpen ? "var(--good)" : "var(--dim)" }}>
            Public X write-intent
          </span>
          <span className="g-micro ml-2">
            {writeOpen ? "OPEN (env)" : "CLOSED"}
          </span>
        </li>
        <li className="g-card">
          <span>Launch $ticker on X</span>
          <span className="g-micro ml-2">
            post / repost / DM → /s review · optional seed · wallet sign · X write fail-closed · Aggregated USDC OFF
          </span>
        </li>
        <li className="g-card">
          <span style={{ color: "var(--warn)" }}>Share &amp; Earn</span>
          <span className="g-micro ml-2">not live · {ATTRIBUTION_V1_LINE}</span>
        </li>
        <li className="g-card">
          <span>Bot Factory</span>
          <span className="g-micro ml-2">read-only stub</span>
        </li>
      </ul>

      <section className="g-card">
        <div className="g-micro" style={{ marginBottom: 8 }}>
          EXAMPLE COMMANDS{" "}
          {writeOpen ? "(live when summoned)" : "(docs until write open)"}
        </div>
        <div
          className="space-y-2 font-mono text-sm"
          style={{ color: "var(--muted)" }}
        >
          <p className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
            @graav_xyz launch $HORMUZ
          </p>
          <p className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
            @graav_xyz buy $g589 0.1
          </p>
          <p className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
            @graav_xyz buy $gSWAP 0.1
          </p>
          <p className="rounded-[10px] border border-[var(--line)] bg-[var(--bg)] px-3 py-2">
            @graav_xyz portfolio
          </p>
        </div>
        <p className="g-hint">
          Same commands work in a DM to @graav_xyz (private). Mentions and DMs
          mint the same dual-factory allowlist sessions as Chat. One cashtag per
          API post. Quote-post is Enterprise — use composer/link.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runDryReply()}
            className="g-btn"
            disabled={busy}
          >
            Dry-run reply-session
          </button>
          <button type="button" onClick={onGoTrade} className="g-cta">
            Go to Trade
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
      </section>
    </div>
  );
}
