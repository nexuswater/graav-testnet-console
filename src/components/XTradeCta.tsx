"use client";

import { XMark } from "@/components/XMark";
import {
  GRAAV_X_HANDLE_AT,
  tradeCommandText,
  tradeDmUrl,
  tradePostIntentUrl,
  xDmDeepLinkAvailable,
  type XTradeSide,
} from "@/lib/xLaunchComposer";

type Props = {
  side: XTradeSide;
  ticker: string;
  amount: string;
};

/**
 * Primary trade path: opens X (post or DM) with the command prefilled.
 * The user finishes inside X; GRAAV replies with a signing link. Never posts.
 */
export function XTradeCta({ side, ticker, amount }: Props) {
  const command = tradeCommandText(side, ticker, amount);
  const dmDeepLink = xDmDeepLinkAvailable();
  return (
    <div className="g-x-cta">
      <a
        className="g-cta"
        href={tradePostIntentUrl(side, ticker, amount)}
        target="_blank"
        rel="noopener noreferrer"
      >
        <XMark size={14} />
        {side === "buy" ? "Buy" : "Sell"} on X
      </a>
      <a
        className="g-cta ghost"
        href={tradeDmUrl(side, ticker, amount)}
        target="_blank"
        rel="noopener noreferrer"
        title={
          dmDeepLink
            ? `Opens a DM to ${GRAAV_X_HANDLE_AT} with this command`
            : `Opens ${GRAAV_X_HANDLE_AT} — tap Message and paste the command`
        }
      >
        <XMark size={14} />
        DM {GRAAV_X_HANDLE_AT}
      </a>
      <p className="g-hint g-x-cta-draft">
        <code>{command}</code> · GRAAV replies with your signing link. Nothing is posted for you.
      </p>
    </div>
  );
}
