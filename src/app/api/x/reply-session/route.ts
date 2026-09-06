import { NextRequest, NextResponse } from "next/server";
import { parseIntent } from "@/lib/chatIntent";
import { createSession } from "@/lib/signingSessionServer";
import type { SessionAction } from "@/lib/sessionAllowlist";
import {
  consolePublicOrigin,
  getPublicXWriteGate,
  isPublicXWriteEnabled,
  PRODUCT_HANDLE_AT,
  replyAsProduct,
} from "@/lib/xProductServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFrom(req: NextRequest): string {
  return consolePublicOrigin(
    (() => {
      const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
      if (env) return env.replace(/\/$/, "");
      const proto = req.headers.get("x-forwarded-proto") ?? "https";
      const host =
        req.headers.get("x-forwarded-host") ??
        req.headers.get("host") ??
        "graav-testnet-console.vercel.app";
      return `${proto}://${host}`;
    })()
  );
}

/**
 * POST /api/x/reply-session
 * Body: { mentionId, text, dryRun?: boolean }
 * - Always parses intent + can mint /api/s session server-side
 * - Replies on X ONLY when FEATURE_PUBLIC_X_WRITE=true AND product token present
 * - Default / dryRun: never posts (fail-closed)
 */
export async function POST(req: NextRequest) {
  let body: {
    mentionId?: string;
    text?: string;
    intent?: string;
    dryRun?: boolean;
    /** Reply-track attribution (optional; store only) */
    originTweetId?: string;
    replyTweetId?: string;
    dmConversationId?: string;
    buyerXUserId?: string;
    verifiedBuyTx?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const mentionId = String(body.mentionId || "").trim();
  const rawText = String(body.intent || body.text || "").trim();
  if (!rawText) {
    return NextResponse.json(
      { error: "text or intent required (e.g. '@graav_xyz buy $g589 0.1')" },
      { status: 400 }
    );
  }

  const plan = parseIntent(rawText);
  const origin = originFrom(req);
  let session: { id: string; url: string } | null = null;
  let sessionError: string | undefined;

  if (plan.sessionBody) {
    const b = plan.sessionBody;
    const result = createSession(
      {
        chainId:
          typeof b.chainId === "number"
            ? b.chainId
            : b.chainId != null
              ? Number(b.chainId)
              : undefined,
        factory: String(b.factory || ""),
        market: b.market != null ? String(b.market) : undefined,
        dex: b.dex != null ? String(b.dex) : undefined,
        token: b.token != null ? String(b.token) : undefined,
        action: String(b.action || "") as SessionAction,
        amount: b.amount != null ? String(b.amount) : undefined,
        minOut: b.minOut != null ? String(b.minOut) : undefined,
        swapSide:
          b.swapSide === "tokenToXrp" || b.swapSide === "xrpToToken"
            ? b.swapSide
            : undefined,
        createName:
          b.createName != null ? String(b.createName) : undefined,
        createSymbol:
          b.createSymbol != null ? String(b.createSymbol) : undefined,
        metadataURI:
          b.metadataURI != null ? String(b.metadataURI) : undefined,
        // Attribution: explicit body fields; mentionId → replyTweetId when unset
        originTweetId:
          body.originTweetId != null
            ? String(body.originTweetId)
            : undefined,
        replyTweetId:
          body.replyTweetId != null
            ? String(body.replyTweetId)
            : mentionId || undefined,
        dmConversationId:
          body.dmConversationId != null
            ? String(body.dmConversationId)
            : undefined,
        buyerXUserId:
          body.buyerXUserId != null
            ? String(body.buyerXUserId)
            : undefined,
        verifiedBuyTx:
          body.verifiedBuyTx != null
            ? String(body.verifiedBuyTx)
            : undefined,
      },
      origin
    );
    if (result.ok) {
      session = { id: result.view.id, url: result.view.url };
    } else {
      sessionError = result.error;
    }
  }

  // Reply text: session URL only (no tx, no keys). Chat ≠ authorization.
  const replyText = session
    ? `Sign here (wallet only · chat ≠ auth): ${session.url}`
    : null;

  const gate = getPublicXWriteGate();

  // Explicit: only post when dryRun===false AND write gate open AND we have mention + URL
  // Default dryRun (undefined) stays fail-closed — never posts.
  const wantPost = body.dryRun === false;
  const canPost =
    wantPost &&
    gate.ok &&
    Boolean(mentionId) &&
    Boolean(replyText) &&
    isPublicXWriteEnabled();

  let xReply: {
    posted: boolean;
    tweetId?: string;
    dryRun: boolean;
    reason?: string;
  };

  if (!canPost) {
    const reasons: string[] = [];
    if (!wantPost) reasons.push("dryRun (default true — pass dryRun:false to attempt post)");
    if (!gate.ok) reasons.push(gate.reason);
    if (!mentionId) reasons.push("mentionId required to reply");
    if (!replyText)
      reasons.push(sessionError || "no session URL to emit (unknown symbol or non-mint intent)");
    xReply = {
      posted: false,
      dryRun: true,
      reason: reasons.join("; "),
    };
  } else {
    const posted = await replyAsProduct({
      inReplyToTweetId: mentionId,
      text: replyText!,
    });
    if (posted.ok) {
      xReply = { posted: true, tweetId: posted.tweetId, dryRun: false };
    } else {
      xReply = {
        posted: false,
        dryRun: Boolean(posted.dryRun),
        reason: posted.error,
      };
    }
  }

  return NextResponse.json(
    {
      productHandle: PRODUCT_HANDLE_AT,
      featurePublicXWrite: isPublicXWriteEnabled(),
      intent: { kind: plan.kind, reply: plan.reply },
      session,
      sessionError,
      replyText,
      xReply,
      note: "Tweets never send txs. Only /s/{id} URLs. Quote-post API is Enterprise — use composer/link if needed.",
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    }
  );
}
