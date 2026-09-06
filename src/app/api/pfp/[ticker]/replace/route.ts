import { NextRequest, NextResponse } from "next/server";
import {
  PFP_ACCEPT,
  PFP_MAX_BYTES,
  isValidTicker,
  normalizeTicker,
} from "@/lib/pfpTypes";
import { replaceProfile, storageMode } from "@/lib/pfpStore";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ ticker: string }> };

/**
 * POST /api/pfp/[ticker]/replace
 * Body: multipart file + creator address, or JSON imageBase64 + creator.
 * Light wallet gate: require creator in body; must match stored creator if set.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { ticker: raw } = await ctx.params;
  const ticker = normalizeTicker(decodeURIComponent(raw));
  if (!isValidTicker(ticker)) {
    return NextResponse.json({ error: "invalid ticker" }, { status: 400 });
  }

  try {
    const ct = req.headers.get("content-type") || "";
    let creator = "";
    let buffer: Buffer | null = null;
    let contentType = "image/png";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      creator = String(form.get("creator") || "");
      const file = form.get("file");
      if (file && typeof file !== "string" && "arrayBuffer" in file) {
        const f = file as File;
        contentType = f.type || "image/png";
        buffer = Buffer.from(await f.arrayBuffer());
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      creator = String(body.creator || "");
      if (body.imageBase64) {
        const rawB = String(body.imageBase64).replace(
          /^data:[^;]+;base64,/,
          ""
        );
        buffer = Buffer.from(rawB, "base64");
        contentType = String(body.contentType || "image/png");
      }
    }

    if (!creator || !/^0x[a-fA-F0-9]{40}$/.test(creator)) {
      return NextResponse.json(
        { error: "creator wallet address required" },
        { status: 400 }
      );
    }
    if (!buffer || buffer.length === 0) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    if (buffer.length > PFP_MAX_BYTES) {
      return NextResponse.json({ error: "max 2MB" }, { status: 400 });
    }
    if (!PFP_ACCEPT.includes(contentType as (typeof PFP_ACCEPT)[number])) {
      if (buffer[0] === 0x89) contentType = "image/png";
      else if (buffer[0] === 0xff) contentType = "image/jpeg";
      else if (buffer[0] === 0x52) contentType = "image/webp";
      else {
        return NextResponse.json(
          { error: "accept png / jpg / webp" },
          { status: 400 }
        );
      }
    }

    const profile = await replaceProfile({
      ticker,
      buffer,
      contentType,
      creator,
    });
    return NextResponse.json({ ...profile, storageMode: storageMode() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.includes("creator") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
