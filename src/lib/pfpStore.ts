/**
 * Testnet pfp storage.
 * Prefer Vercel Blob when BLOB_READ_WRITE_TOKEN is set;
 * else write under public/pfps + data/pfp-profiles.json (local / build).
 * On Vercel without Blob, also mirror into /tmp so the request can serve.
 */
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import {
  extForContentType,
  isOfficialSimple,
  isValidTicker,
  normalizeTicker,
  type PfpProfile,
} from "@/lib/pfpTypes";
import { generateDefaultPfp, processUploadImage } from "@/lib/pfpGenerate";

const PROFILE_REL = "data/pfp-profiles.json";
const PUBLIC_PFPS = "public/pfps";
const TMP_ROOT = "/tmp/graav-pfps";

/** Shipped official simple marks — never regenerate / overwrite. */
const OFFICIAL_SEED: Record<string, PfpProfile> = {
  gSWAP: {
    ticker: "gSWAP",
    pfpURI: "/pfps/gswap.5b579f7b9ab8.png",
    contentType: "image/png",
    sha256: "5b579f7b9ab8",
    generated: false,
    source: "official-simple",
    updatedAt: "2026-09-05T01:18:07Z",
  },
  g589: {
    ticker: "g589",
    pfpURI: "/pfps/g589.9d7023eb1f49.png",
    contentType: "image/png",
    sha256: "9d7023eb1f49",
    generated: false,
    source: "official-simple",
    updatedAt: "2026-09-05T01:18:07Z",
  },
};

function officialSeed(ticker: string): PfpProfile | null {
  const key = normalizeTicker(ticker);
  if (!key) return null;
  const hit =
    OFFICIAL_SEED[key] ||
    Object.values(OFFICIAL_SEED).find(
      (p) => p.ticker.toLowerCase() === key.toLowerCase()
    );
  return hit || null;
}


export type StorageMode = "blob" | "public";

export function storageMode(): StorageMode {
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "public";
}

function profilePaths(): string[] {
  return [
    path.join(process.cwd(), PROFILE_REL),
    path.join(TMP_ROOT, "pfp-profiles.json"),
  ];
}

function readProfiles(): Record<string, PfpProfile> {
  for (const p of profilePaths()) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        const parsed = JSON.parse(raw) as Record<string, PfpProfile>;
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      /* try next */
    }
  }
  return {};
}

function writeProfiles(map: Record<string, PfpProfile>): void {
  const json = JSON.stringify(map, null, 2);
  const primary = path.join(process.cwd(), PROFILE_REL);
  try {
    fs.mkdirSync(path.dirname(primary), { recursive: true });
    fs.writeFileSync(primary, json);
  } catch {
    /* cwd may be read-only on serverless */
  }
  try {
    fs.mkdirSync(TMP_ROOT, { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, "pfp-profiles.json"), json);
  } catch {
    /* ignore */
  }
}

export function getProfile(ticker: string): PfpProfile | null {
  const key = normalizeTicker(ticker);
  if (!key) return null;
  const map = readProfiles();
  const hit =
    map[key] ||
    map[key.toLowerCase()] ||
    Object.values(map).find(
      (p) => p.ticker.toLowerCase() === key.toLowerCase()
    );
  if (hit) {
    // Prefer on-disk official if map entry lost source flag somehow
    const seed = officialSeed(key);
    if (seed && isOfficialSimple(hit) === false && hit.pfpURI === seed.pfpURI) {
      return { ...hit, ...seed };
    }
    return hit;
  }
  return officialSeed(key);
}

export function listProfiles(): PfpProfile[] {
  return Object.values(readProfiles());
}

async function putBytes(
  ticker: string,
  buffer: Buffer,
  contentType: string,
  sha256: string
): Promise<string> {
  const ext = extForContentType(contentType);
  const filename = `${normalizeTicker(ticker)}.${sha256.slice(0, 12)}.${ext}`;

  if (storageMode() === "blob") {
    const { put } = await import("@vercel/blob");
    const blob = await put(`pfps/${filename}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return blob.url;
  }

  // public/ + /tmp mirror
  const rel = `/pfps/${filename}`;
  const pubPath = path.join(process.cwd(), PUBLIC_PFPS, filename);
  try {
    fs.mkdirSync(path.dirname(pubPath), { recursive: true });
    fs.writeFileSync(pubPath, buffer);
  } catch {
    /* read-only */
  }
  try {
    fs.mkdirSync(path.join(TMP_ROOT, "files"), { recursive: true });
    fs.writeFileSync(path.join(TMP_ROOT, "files", filename), buffer);
  } catch {
    /* ignore */
  }
  return rel;
}

export async function saveUpload(opts: {
  ticker: string;
  buffer: Buffer;
  contentType: string;
  creator?: string;
  generated?: boolean;
  /** internal escape hatch — default false */
  allowOfficialReplace?: boolean;
}): Promise<PfpProfile> {
  const ticker = normalizeTicker(opts.ticker);
  if (!isValidTicker(ticker)) {
    throw new Error("Invalid ticker");
  }

  let buffer = opts.buffer;
  let contentType = opts.contentType;
  let sha256: string;
  const generated = !!opts.generated;

  if (generated) {
    const g = await generateDefaultPfp(ticker);
    buffer = g.buffer;
    contentType = g.contentType;
    sha256 = g.sha256;
  } else {
    const processed = await processUploadImage(buffer, contentType);
    buffer = processed.buffer;
    contentType = processed.contentType;
    sha256 = processed.sha256;
  }

  const pfpURI = await putBytes(ticker, buffer, contentType, sha256);
  const profile: PfpProfile = {
    ticker,
    pfpURI,
    contentType,
    sha256,
    generated,
    updatedAt: new Date().toISOString(),
    creator: opts.creator?.toLowerCase(),
  };

  const map = readProfiles();
  const prior =
    map[ticker] ||
    map[ticker.toLowerCase()] ||
    Object.values(map).find((p) => p.ticker.toLowerCase() === ticker.toLowerCase()) ||
    officialSeed(ticker);
  if (isOfficialSimple(prior) && profile.generated) {
    // Never let ensure/generate clobber official-simple
    return prior!;
  }
  if (isOfficialSimple(prior) && !opts.allowOfficialReplace) {
    throw new Error("Official token image cannot be overwritten");
  }
  // replace any case-variant key
  for (const k of Object.keys(map)) {
    if (k.toLowerCase() === ticker.toLowerCase()) delete map[k];
  }
  map[ticker] = profile;
  writeProfiles(map);
  return profile;
}

export async function ensureProfile(
  ticker: string,
  creator?: string
): Promise<PfpProfile> {
  const existing = getProfile(ticker);
  if (existing) {
    // Never regenerate over official-simple
    if (isOfficialSimple(existing) || existing.generated === false && existing.source === "official-simple") {
      return existing;
    }
    return existing;
  }
  const seed = officialSeed(ticker);
  if (seed) return seed;
  return saveUpload({
    ticker,
    buffer: Buffer.alloc(0),
    contentType: "image/png",
    creator,
    generated: true,
  });
}

export async function replaceProfile(opts: {
  ticker: string;
  buffer: Buffer;
  contentType: string;
  creator: string;
}): Promise<PfpProfile> {
  const existing = getProfile(opts.ticker);
  if (isOfficialSimple(existing)) {
    throw new Error("Official token image cannot be replaced");
  }
  if (
    existing?.creator &&
    opts.creator &&
    existing.creator.toLowerCase() !== opts.creator.toLowerCase()
  ) {
    throw new Error("Only the creator wallet may replace this pfp");
  }
  return saveUpload({
    ticker: opts.ticker,
    buffer: opts.buffer,
    contentType: opts.contentType,
    creator: opts.creator,
    generated: false,
  });
}

/** Resolve bytes for a profile (local path, tmp, or fetch remote URI). */
export async function readPfpBytes(
  profile: PfpProfile
): Promise<Buffer | null> {
  const uri = profile.pfpURI;
  if (uri.startsWith("/pfps/")) {
    const name = path.basename(uri);
    const candidates = [
      path.join(process.cwd(), PUBLIC_PFPS, name),
      path.join(TMP_ROOT, "files", name),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return fs.readFileSync(c);
    }
    return null;
  }
  if (uri.startsWith("http://") || uri.startsWith("https://")) {
    const res = await fetch(uri);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
  return null;
}

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}
