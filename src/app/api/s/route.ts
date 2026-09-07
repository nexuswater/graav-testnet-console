import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/signingSessionServer";
import type { SessionAction } from "@/lib/sessionAllowlist";
import { getX1Handler } from "@/lib/graav-x1/runtime";

export const runtime = "nodejs";

function originFrom(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "graav-testnet-console.vercel.app";
  return `${proto}://${host}`;
}

/**
 * POST /api/s — mint a short-lived signing session URL.
 * Chat / Grok / XBot only mint URLs; they never send txs.
 */
export async function POST(req: NextRequest) {
  try { const probe = (await req.clone().json()) as Record<string, unknown>; if (probe.action === "BUY" && probe.market && probe.amountWei) return getX1Handler()(new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(probe) })); } catch { /* legacy parser below */ }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const action = String(body.action || "") as SessionAction;
  const result = createSession(
    {
      chainId:
        typeof body.chainId === "number"
          ? body.chainId
          : body.chainId != null
            ? Number(body.chainId)
            : undefined,
      factory: String(body.factory || ""),
      market: body.market != null ? String(body.market) : undefined,
      dex: body.dex != null ? String(body.dex) : undefined,
      token: body.token != null ? String(body.token) : undefined,
      action,
      amount: body.amount != null ? String(body.amount) : undefined,
      minOut: body.minOut != null ? String(body.minOut) : undefined,
      expiry:
        body.expiry != null && body.expiry !== ""
          ? Number(body.expiry)
          : undefined,
      ttlSec:
        body.ttlSec != null && body.ttlSec !== ""
          ? Number(body.ttlSec)
          : undefined,
      nonce: body.nonce != null ? String(body.nonce) : undefined,
      createName:
        body.createName != null ? String(body.createName) : undefined,
      createSymbol:
        body.createSymbol != null ? String(body.createSymbol) : undefined,
      metadataURI:
        body.metadataURI != null ? String(body.metadataURI) : undefined,
      originHash:
        body.originHash != null ? String(body.originHash) : undefined,
      swapSide:
        body.swapSide === "tokenToXrp" || body.swapSide === "xrpToToken"
          ? body.swapSide
          : undefined,
      originTweetId:
        body.originTweetId != null ? String(body.originTweetId) : undefined,
      replyTweetId:
        body.replyTweetId != null ? String(body.replyTweetId) : undefined,
      dmConversationId:
        body.dmConversationId != null
          ? String(body.dmConversationId)
          : undefined,
      buyerXUserId:
        body.buyerXUserId != null ? String(body.buyerXUserId) : undefined,
      verifiedBuyTx:
        body.verifiedBuyTx != null ? String(body.verifiedBuyTx) : undefined,
    },
    originFrom(req)
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    id: result.view.id,
    url: result.view.url,
    status: result.view.status,
    payload: result.view.payload,
  });
}
