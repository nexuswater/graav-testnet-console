import { NextResponse } from "next/server";
import { normalizeTicker, isValidTicker } from "@/lib/pfpTypes";
import { ensureProfile, readPfpBytes } from "@/lib/pfpStore";
import { rasterizeOg, generateDefaultPfp } from "@/lib/pfpGenerate";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ ticker: string }> };

/** GET /api/pfp/[ticker]/og — 1200×1200 JPEG for unfurl. */
export async function GET(_req: Request, ctx: Ctx) {
  const { ticker: raw } = await ctx.params;
  const ticker = normalizeTicker(decodeURIComponent(raw));
  if (!isValidTicker(ticker)) {
    return new NextResponse("invalid", { status: 400 });
  }
  try {
    const profile = await ensureProfile(ticker);
    let bytes = await readPfpBytes(profile);
    if (!bytes) {
      bytes = (await generateDefaultPfp(ticker)).buffer;
    }
    const og = await rasterizeOg(bytes);
    return new NextResponse(new Uint8Array(og), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
