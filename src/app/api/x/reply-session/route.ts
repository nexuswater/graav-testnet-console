import { NextRequest, NextResponse } from "next/server";
import { consolePublicOrigin } from "@/lib/xProductServer";
import { processReplySession, type ReplySessionInput } from "@/lib/xReplySessionServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function originFrom(req: NextRequest): string {
  return consolePublicOrigin((() => {
    const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (env) return env.replace(/\/$/, "");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "graav-testnet-console.vercel.app";
    return `${proto}://${host}`;
  })());
}

/** POST /api/x/reply-session — parses intent and emits only a /s URL reply. */
export async function POST(req: NextRequest) {
  let body: ReplySessionInput;
  try { body = (await req.json()) as ReplySessionInput; }
  catch { return NextResponse.json({ error: "invalid JSON body" }, { status: 400 }); }
  const rawText = String(body.intent || body.text || "").trim();
  if (!rawText) return NextResponse.json({ error: "text or intent required (e.g. '@graav_xyz buy $g589 0.1')" }, { status: 400 });
  const result = await processReplySession(body, originFrom(req));
  return NextResponse.json({ ...result, note: "Tweets never send txs. Only /s/{id} URLs. No DM or cold path." }, { headers: { "Cache-Control": "no-store" } });
}
