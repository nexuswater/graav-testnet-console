import { NextRequest, NextResponse } from "next/server";
import { normalizeTicker, isValidTicker } from "@/lib/pfpTypes";
import { ensureProfile, getProfile, storageMode } from "@/lib/pfpStore";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ ticker: string }> };

/** GET /api/pfp/[ticker]?ensure=1 — profile; lazy-generate default if missing. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { ticker: raw } = await ctx.params;
  const ticker = normalizeTicker(decodeURIComponent(raw));
  if (!isValidTicker(ticker)) {
    return NextResponse.json({ error: "invalid ticker" }, { status: 400 });
  }
  const ensure = req.nextUrl.searchParams.get("ensure") === "1";
  try {
    const profile = ensure
      ? await ensureProfile(ticker)
      : getProfile(ticker);
    if (!profile) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ ...profile, storageMode: storageMode() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
