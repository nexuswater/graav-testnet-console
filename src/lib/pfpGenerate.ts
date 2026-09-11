import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";

function whiteMarkPath(): string {
  const candidates = [
    path.join(process.cwd(), "public/brand/graav-orbit-g-white-1024.png"),
    path.join(process.cwd(), "public/brand/graav-orbit-g-1024.png"),
    path.join(process.cwd(), "public/brand/graav-mark.png"),
    "/workspace/graav/brand/graav-x-app-icon-1024.png",
    "/workspace/graav/brand/graav-logo-source.png",
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("No GRAAV brand mark found for default pfp");
}

/**
 * Default token image: 1024×1024 Deep Space #0B0F14, white orbit-G, $TICKER.
 * No Earth. generated=true.
 */
export async function generateDefaultPfp(
  ticker: string
): Promise<{ buffer: Buffer; contentType: "image/png"; sha256: string }> {
  const sym = ticker.replace(/^\$/, "").trim() || "TOKEN";
  const label = `$${sym}`;
  const markPath = whiteMarkPath();
  const mark = await sharp(markPath)
    .resize(440, 440, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const svg = Buffer.from(
    `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <rect width="1024" height="1024" fill="#0B0F14"/>
      <text x="512" y="860" text-anchor="middle"
        font-family="-apple-system, SF Pro Text, Helvetica, Arial, sans-serif"
        font-size="64" font-weight="650" fill="#FFFFFF" letter-spacing="-1">${escapeXml(label)}</text>
    </svg>`
  );

  const buffer = await sharp(svg)
    .composite([{ input: mark, top: 240, left: 292 }])
    .png()
    .toBuffer();

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return { buffer, contentType: "image/png", sha256 };
}

/** Center-crop to 1:1, max edge 1024, ≤2MB in. */
export async function processUploadImage(
  input: Buffer,
  contentType: string
): Promise<{ buffer: Buffer; contentType: string; sha256: string }> {
  const img = sharp(input, { failOn: "none" });
  const meta = await img.metadata();
  const w = meta.width || 1;
  const h = meta.height || 1;
  const side = Math.min(w, h);
  const left = Math.floor((w - side) / 2);
  const top = Math.floor((h - side) / 2);

  const pipeline = sharp(input, { failOn: "none" })
    .extract({ left, top, width: side, height: side })
    .resize(1024, 1024, { fit: "fill" });

  let outType = contentType;
  let buffer: Buffer;
  if (contentType === "image/webp") {
    buffer = await pipeline.webp({ quality: 90 }).toBuffer();
  } else if (contentType === "image/jpeg") {
    buffer = await pipeline.jpeg({ quality: 92 }).toBuffer();
  } else {
    outType = "image/png";
    buffer = await pipeline.png().toBuffer();
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return { buffer, contentType: outType, sha256 };
}

/** Rasterize any pfp to 1200×1200 PNG for OG. */
/** 1200×1200 JPEG for social unfurls — a lossless PNG at this size was ~2.6 MB. */
export async function rasterizeOg(input: Buffer): Promise<Buffer> {
  return sharp(input, { failOn: "none" })
    .resize(1200, 1200, { fit: "cover" })
    .flatten({ background: "#050505" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
