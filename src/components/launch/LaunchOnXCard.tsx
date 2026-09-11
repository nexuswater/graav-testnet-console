"use client";

import { useState } from "react";
import { XMark } from "@/components/XMark";
import { LinkIcon } from "@/components/shell/Icons";
import { copyToClipboard } from "@/lib/metaMaskDeepLink";
import {
  GRAAV_X_HANDLE_AT,
  isValidLaunchTicker,
  launchComposerText,
  launchDmUrl,
  launchPostIntentUrl,
  launchQuoteIntentUrl,
  parseXPostUrl,
  sanitizeLaunchTicker,
  xDmDeepLinkAvailable,
} from "@/lib/xLaunchComposer";

type Props = {
  ticker: string;
  onTicker: (ticker: string) => void;
};

/**
 * Primary launch path. Every CTA opens X (post, quote-repost, or DM) with the
 * draft prefilled — the user finishes inside X and nothing is posted for them.
 */
export function LaunchOnXCard({ ticker, onTicker }: Props) {
  const [copied, setCopied] = useState(false);
  const [quoteUrl, setQuoteUrl] = useState("");
  const clean = sanitizeLaunchTicker(ticker);
  const tickerOk = isValidLaunchTicker(clean);
  const draft = launchComposerText(clean);
  const quoted = parseXPostUrl(quoteUrl);
  const quoteInvalid = quoteUrl.trim().length > 0 && !quoted;
  const postHref = quoted ? launchQuoteIntentUrl(clean, quoted.url) : launchPostIntentUrl(clean);
  const dmHref = launchDmUrl(clean);
  const dmDeepLink = xDmDeepLinkAvailable();

  const copyDraft = async () => {
    const ok = await copyToClipboard(draft);
    setCopied(ok);
  };

  const blockUnlessReady = (event: React.MouseEvent) => {
    if (!tickerOk) event.preventDefault();
  };

  return (
    <section className="g-launch-x" aria-labelledby="launch-on-x-title">
      <h2 id="launch-on-x-title" className="g-launch-x-kicker">
        Create on X
      </h2>

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
          Letters, numbers, underscore · up to 15 · for example $HORMUZ
        </p>
      </div>

      <div className="g-field">
        <label className="g-field-label" htmlFor="launch-x-quote">
          Post to quote (optional)
        </label>
        <span className="g-input-icon">
          <LinkIcon />
          <input
            id="launch-x-quote"
            className="sm"
            value={quoteUrl}
            onChange={(event) => setQuoteUrl(event.target.value)}
            placeholder="https://x.com/…/status/…"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={quoteInvalid || undefined}
            aria-describedby="launch-x-quote-hint"
          />
        </span>
        <p id="launch-x-quote-hint" className="g-hint">
          {quoteInvalid
            ? "Paste a full x.com post link to quote-repost it."
            : "Leave empty to post fresh, or paste a post link to quote-repost it as the launch."}
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
        onClick={blockUnlessReady}
        target="_blank"
        rel="noopener noreferrer"
      >
        <XMark size={14} />
        {!tickerOk
          ? "Add a ticker to continue on X"
          : quoted
            ? `Quote-repost · Launch $${clean}`
            : `Post · Launch $${clean}`}
      </a>
      <div className="g-launch-cta-row">
        <a
          className="g-cta ghost"
          href={dmHref}
          aria-disabled={!tickerOk}
          tabIndex={tickerOk ? 0 : -1}
          onClick={blockUnlessReady}
          target="_blank"
          rel="noopener noreferrer"
          title={
            dmDeepLink
              ? `Opens a DM to ${GRAAV_X_HANDLE_AT} with your draft`
              : `Opens ${GRAAV_X_HANDLE_AT} — tap Message and paste your draft`
          }
        >
          <XMark size={14} />
          DM {GRAAV_X_HANDLE_AT}
        </a>
        <button type="button" className="g-cta ghost" onClick={() => void copyDraft()} disabled={!tickerOk}>
          {copied ? "Draft copied" : "Copy draft"}
        </button>
      </div>

      <ol className="g-launch-path" aria-label="What happens next">
        <li>Post, quote, or DM the draft</li>
        <li>{GRAAV_X_HANDLE_AT} replies with your signing link</li>
        <li>Review the seed and sign in your wallet</li>
      </ol>
      <p className="g-hint">
        Opens X with your draft — nothing is posted or sent for you.
        {!dmDeepLink && " For a DM, tap Message on the profile and paste the draft."}
      </p>
    </section>
  );
}
