"use client";

import { useState } from "react";
import { XMark } from "@/components/XMark";
import { copyToClipboard } from "@/lib/metaMaskDeepLink";
import {
  GRAAV_X_HANDLE_AT,
  graavXProfileUrl,
  isValidLaunchTicker,
  launchComposerText,
  launchPostIntentUrl,
  launchQuoteRtUrl,
  sanitizeLaunchTicker,
} from "@/lib/xLaunchComposer";

type Props = {
  ticker: string;
  onTicker: (ticker: string) => void;
  onPostedReview: () => void;
};

export function LaunchOnXCard({ ticker, onTicker, onPostedReview }: Props) {
  const [copied, setCopied] = useState(false);
  const clean = sanitizeLaunchTicker(ticker);
  const tickerOk = isValidLaunchTicker(clean);
  const draft = launchComposerText(clean);
  const postHref = launchPostIntentUrl(clean);

  const copyDraft = async () => {
    const ok = await copyToClipboard(draft);
    setCopied(ok);
  };

  return (
    <section className="g-launch-x" aria-labelledby="launch-on-x-title">
      <h2 id="launch-on-x-title" className="g-launch-x-kicker">
        Create on X
      </h2>
      <ol className="g-launch-path" aria-label="How launch works">
        <li>Post, repost, or DM with $TICKER</li>
        <li>Open the /s link GRAAV sends</li>
        <li>Review, optional seed, sign in wallet</li>
      </ol>

      <div className="g-field">
        <label className="g-field-label" htmlFor="launch-x-ticker">
          Ticker
        </label>
        <input
          id="launch-x-ticker"
          className="sm"
          value={ticker}
          onChange={(event) => onTicker(sanitizeLaunchTicker(event.target.value))}
          placeholder="TICKER"
          autoComplete="off"
          spellCheck={false}
          aria-describedby="launch-x-ticker-hint"
        />
        <p id="launch-x-ticker-hint" className="g-hint">
          Example: quote-RT a post → Launch $HORMUZ. DMs are the same action, privately.
        </p>
      </div>

      <pre className="g-launch-draft" aria-label="Composer draft">
        {draft}
      </pre>

      <a
        className="g-cta"
        href={postHref}
        aria-disabled={!tickerOk}
        tabIndex={tickerOk ? 0 : -1}
        onClick={(event) => {
          if (!tickerOk) event.preventDefault();
        }}
        target="_blank"
        rel="noopener noreferrer"
      >
        <XMark size={14} />
        {tickerOk ? `Post Launch $${clean} on X` : "Add a ticker to post on X"}
      </a>
      <a
        className="g-cta ghost"
        href={launchQuoteRtUrl()}
        target="_blank"
        rel="noopener noreferrer"
      >
        Repost / quote-RT on X
      </a>
      <div className="g-launch-cta-row">
        <button type="button" className="g-cta ghost" onClick={() => void copyDraft()}>
          {copied ? "Draft copied" : "Copy draft"}
        </button>
        <a
          className="g-cta ghost"
          href={graavXProfileUrl()}
          target="_blank"
          rel="noopener noreferrer"
        >
          {GRAAV_X_HANDLE_AT}
        </a>
      </div>
      <p className="g-hint">
        Composer / open X only. This console never posts, reposts, or sends DMs.
        Public X write stays closed. After you post, {GRAAV_X_HANDLE_AT} hands you
        a /s link — chat ≠ authorization. DMs are the same intents, privately.
      </p>
      <button
        type="button"
        className="g-cta"
        disabled={!tickerOk}
        onClick={onPostedReview}
      >
        I posted on X — review &amp; sign
      </button>
    </section>
  );
}
