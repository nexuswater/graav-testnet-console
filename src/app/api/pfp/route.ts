import { NextRequest, NextResponse } from "next/server";
import {
  PFP_ACCEPT,
  PFP_MAX_BYTES,
  isValidTicker,
  normalizeTicker,
} from "@/lib/pfpTypes";
import { saveUpload, storageMode } from "@/lib/pfpStore";

export const runtime = "nodejs";

/**
 * POST /api/pfp — upload or generate default token image.
 * multipart: ticker, file?, generate?=true, creator?
 * OR JSON: { ticker, generate?: true, creator?, imageBase64?, contentType? }
 */
export async function POST(req: NextRequest) {
  try {
    const ct = req.headers.get("content-type") || "";
    let ticker = "";
    let creator: string | undefined;
    let generate = false;
    let buffer: Buffer | null = null;
    let contentType = "image/png";

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      ticker = normalizeTicker(String(form.get("ticker") || ""));
      creator = form.get("creator")
        ? String(form.get("creator"))
        : undefined;
      generate =
        String(form.get("generate") || "") === "true" ||
        String(form.get("generate") || "") === "1";
      const file = form.get("file");
      if (file && typeof file !== "string" && "arrayBuffer" in file) {
        const f = file as File;
        contentType = f.type || "image/png";
        const ab = await f.arrayBuffer();
        buffer = Buffer.from(ab);
      }
    } else {
      const body = (await req.json()) as Record<string, unknown>;
      ticker = normalizeTicker(String(body.ticker || ""));
      creator = body.creator != null ? String(body.creator) : undefined;
      generate = body.generate === true || body.generate === "true";
      if (body.imageBase64) {
        const raw = String(body.imageBase64).replace(/^data:[^;]+;base64,/, "");
        buffer = Buffer.from(raw, "base64");
        contentType = String(body.contentType || "image/png");
      }
    }

    if (!isValidTicker(ticker)) {
      return NextResponse.json({ error: "invalid ticker" }, { status: 400 });
    }

    if (!generate) {
      if (!buffer || buffer.length === 0) {
        return NextResponse.json(
          { error: "file required (or set generate=true)" },
          { status: 400 }
        );
      }
      if (buffer.length > PFP_MAX_BYTES) {
        return NextResponse.json(
          { error: "file too large (max 2MB)" },
          { status: 400 }
        );
      }
      if (!PFP_ACCEPT.includes(contentType as (typeof PFP_ACCEPT)[number])) {
        // sniff
        if (buffer[0] === 0x89 && buffer[1] === 0x50) contentType = "image/png";
        else if (buffer[0] === 0xff && buffer[1] === 0xd8)
          contentType = "image/jpeg";
        else if (buffer[0] === 0x52 && buffer[1] === 0x49)
          contentType = "image/webp";
        else {
          return NextResponse.json(
            { error: "accept png / jpg / webp only" },
            { status: 400 }
          );
        }
      }
    }

    const profile = await saveUpload({
      ticker,
      buffer: buffer || Buffer.alloc(0),
      contentType,
      creator,
      generated: generate,
    });

    return NextResponse.json({
      ...profile,
      storageMode: storageMode(),
      message:
        "This is the token image on GRAAV. Attach this same file when you Post on X.",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
