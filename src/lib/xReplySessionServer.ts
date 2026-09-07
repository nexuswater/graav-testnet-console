import { parseIntent } from "@/lib/chatIntent";
import { createSession } from "@/lib/signingSessionServer";
import type { SessionAction } from "@/lib/sessionAllowlist";
import { getPublicXWriteGate, isPublicXWriteEnabled, PRODUCT_HANDLE_AT, replyAsProduct } from "@/lib/xProductServer";

export type ReplySessionInput = {
  mentionId?: string; text?: string; intent?: string; dryRun?: boolean;
  originTweetId?: string; replyTweetId?: string; dmConversationId?: string;
  buyerXUserId?: string; verifiedBuyTx?: string;
};
export type ReplySessionResult = {
  productHandle: string; featurePublicXWrite: boolean;
  intent: { kind: string | undefined; reply: string };
  session: { id: string; url: string } | null; sessionError?: string;
  replyText: string | null;
  xReply: { posted: boolean; tweetId?: string; dryRun: boolean; reason?: string };
};

export async function processReplySession(body: ReplySessionInput, origin: string): Promise<ReplySessionResult> {
  const mentionId = String(body.mentionId || "").trim();
  const rawText = String(body.intent || body.text || "").trim();
  const plan = parseIntent(rawText);
  let session: { id: string; url: string } | null = null;
  let sessionError: string | undefined;
  if (plan.sessionBody) {
    const b = plan.sessionBody;
    const result = createSession({
      chainId: typeof b.chainId === "number" ? b.chainId : b.chainId != null ? Number(b.chainId) : undefined,
      factory: String(b.factory || ""), market: b.market != null ? String(b.market) : undefined,
      dex: b.dex != null ? String(b.dex) : undefined, token: b.token != null ? String(b.token) : undefined,
      action: String(b.action || "") as SessionAction, amount: b.amount != null ? String(b.amount) : undefined,
      minOut: b.minOut != null ? String(b.minOut) : undefined,
      swapSide: b.swapSide === "tokenToXrp" || b.swapSide === "xrpToToken" ? b.swapSide : undefined,
      createName: b.createName != null ? String(b.createName) : undefined,
      createSymbol: b.createSymbol != null ? String(b.createSymbol) : undefined,
      metadataURI: b.metadataURI != null ? String(b.metadataURI) : undefined,
      originTweetId: body.originTweetId != null ? String(body.originTweetId) : undefined,
      replyTweetId: body.replyTweetId != null ? String(body.replyTweetId) : mentionId || undefined,
      dmConversationId: body.dmConversationId != null ? String(body.dmConversationId) : undefined,
      buyerXUserId: body.buyerXUserId != null ? String(body.buyerXUserId) : undefined,
      verifiedBuyTx: body.verifiedBuyTx != null ? String(body.verifiedBuyTx) : undefined,
    }, origin);
    if (result.ok) session = { id: result.view.id, url: result.view.url };
    else sessionError = result.error;
  }
  const replyText = session ? `Sign here (wallet only · chat ≠ auth): ${session.url}` : null;
  const gate = getPublicXWriteGate();
  const wantPost = body.dryRun === false;
  const canPost = wantPost && gate.ok && Boolean(mentionId) && Boolean(replyText) && isPublicXWriteEnabled();
  let xReply: ReplySessionResult["xReply"];
  if (!canPost) {
    const reasons: string[] = [];
    if (!wantPost) reasons.push("dryRun (default true — pass dryRun:false to attempt post)");
    if (!gate.ok) reasons.push(gate.reason);
    if (!mentionId) reasons.push("mentionId required to reply");
    if (!replyText) reasons.push(sessionError || "no session URL to emit (unknown symbol or non-mint intent)");
    xReply = { posted: false, dryRun: true, reason: reasons.join("; ") };
  } else {
    const posted = await replyAsProduct({ inReplyToTweetId: mentionId, text: replyText! });
    xReply = posted.ok ? { posted: true, tweetId: posted.tweetId, dryRun: false } : { posted: false, dryRun: Boolean(posted.dryRun), reason: posted.error };
  }
  return { productHandle: PRODUCT_HANDLE_AT, featurePublicXWrite: isPublicXWriteEnabled(), intent: { kind: plan.kind, reply: plan.reply }, session, sessionError, replyText, xReply };
}
