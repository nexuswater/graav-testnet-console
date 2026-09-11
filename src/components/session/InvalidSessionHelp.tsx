"use client";


import Link from "next/link";
import { XRPL_EVM_TESTNET_ID } from "@/lib/chain";
import { AccountMenu } from "@/components/AccountMenu";
import { PrimaryMenu } from "@/components/PrimaryMenu";
import { GraavLogo } from "@/components/GraavLogo";
import { XMark } from "@/components/XMark";
import {
  isPlaceholderOrBogusSessionId,
  XRPL_EVM_TESTNET_HEX,
} from "@/lib/signingSession";
import { GRAAV_X_HANDLE_AT, xDmDeepLinkAvailable, xDmUrl } from "@/lib/xLaunchComposer";

type Props = {
  sessionId?: string;
};

/**
 * Fail-closed help when /s/{id} is a doc placeholder or not a real opaque session.
 */
export function InvalidSessionHelp({ sessionId }: Props) {
  const shown =
    sessionId && sessionId.length > 0 && sessionId.length < 64
      ? sessionId
      : sessionId
        ? `${sessionId.slice(0, 24)}…`
        : null;

  return (
    <div className="g-app">
      <header className="g-top">
        <div className="g-top-brand">
          <GraavLogo height={30} />
          <span className="g-pill g-testnet" title="XRPL EVM Testnet · test assets only">TESTNET</span>
        </div>
        <div className="g-top-actions">
          <AccountMenu />
          <PrimaryMenu />
        </div>
      </header>

      <main
        className="g-main"
        style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}
      >
        <div className="g-sheet">
          <div className="g-status">Not a signing request</div>
          <h1 className="g-display" style={{ fontSize: 28 }}>
            This isn’t a signing link
          </h1>
          <p className="g-sub" style={{ marginTop: 12, lineHeight: 1.5 }}>
            Ask GRAAV on X for a new signing link, or open Trade to sign in-app. Placeholder
            links like <span className="g-mono">/s/{"{id}"}</span> cannot be signed.
          </p>
          {shown && (
            <p className="g-hint" style={{ marginTop: 10 }}>
              Received id: <span className="g-mono">{shown}</span>
            </p>
          )}

          <div className="g-kv" style={{ marginTop: 16 }}>
            <span>Chain</span>
            <span className="g-mono">
              XRPL EVM {XRPL_EVM_TESTNET_ID} ({XRPL_EVM_TESTNET_HEX})
            </span>
          </div>

          <a
            href={xDmUrl("")}
            target="_blank"
            rel="noopener noreferrer"
            className="g-cta"
            style={{ textDecoration: "none" }}
            title={xDmDeepLinkAvailable() ? `Opens a DM to ${GRAAV_X_HANDLE_AT}` : `Opens ${GRAAV_X_HANDLE_AT} — tap Message`}
          >
            <XMark size={14} /> Ask {GRAAV_X_HANDLE_AT} for a new link
          </a>
          <Link
            href="/?tab=Trade"
            className="g-cta ghost"
            style={{ display: "block", textAlign: "center", textDecoration: "none" }}
          >
            Open Trade
          </Link>
          <p className="g-hint">
            No signing request was created from this link, and nothing was sent.
          </p>
        </div>
      </main>
    </div>
  );
}

/** @deprecated prefer isPlaceholderOrBogusSessionId — kept for call sites */
export function isUnusableSessionId(id: string | undefined | null): boolean {
  return isPlaceholderOrBogusSessionId(id ?? "");
}
