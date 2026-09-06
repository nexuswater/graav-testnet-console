import { NextRequest, NextResponse } from "next/server";
import {
  buildCapabilityMatrix,
  fetchProductMentions,
  getPublicXWriteGate,
} from "@/lib/xProductServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/x/capabilities — live capability matrix for XTab.
 * Optional ?probeMentions=1 to hit X read (still no write).
 */
export async function GET(req: NextRequest) {
  const probe = req.nextUrl.searchParams.get("probeMentions") === "1";
  let mentionsProbe: { ok: boolean; detail: string } | undefined;
  if (probe) {
    const r = await fetchProductMentions({ maxResults: 5 });
    mentionsProbe = r.ok
      ? {
          ok: true,
          detail: `OK · ${r.mentions.length} mention(s) · token=${r.tokenKind}`,
        }
      : { ok: false, detail: r.error };
  }
  const matrix = buildCapabilityMatrix({ mentionsProbe });
  const write = getPublicXWriteGate();
  return NextResponse.json(
    {
      ...matrix,
      writeGate: write.ok
        ? { open: true }
        : {
            open: false,
            reason: write.reason,
            featureFlag: write.featureFlag,
            hasProductToken: write.hasProductToken,
          },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
