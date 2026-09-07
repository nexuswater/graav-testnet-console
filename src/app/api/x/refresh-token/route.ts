import { NextRequest, NextResponse } from "next/server";
import { refreshProductUserToken } from "@/lib/xTokenRefresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return bearer === secret || req.headers.get("CRON_SECRET")?.trim() === secret;
}

/** Protected Exec/Vercel endpoint; never expose product tokens without CRON_SECRET. */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "cron authorization required" }, { status: 401 });
  try {
    const token = await refreshProductUserToken();
    return NextResponse.json({
      ok: true,
      access_token: token.access_token,
      ...(token.refresh_token ? { refresh_token: token.refresh_token } : {}),
      token_type: token.token_type,
      scope: token.scope,
      expires_in: token.expires_in,
      note: "Applied in-memory for this instance. Exec must update Vercel Production env; rotated refresh_token replaces the old value.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error), note: "Set X_PRODUCT_CLIENT_SECRET and X_BOT_USER_REFRESH_TOKEN on Vercel before retrying." }, { status: 502 });
  }
}
