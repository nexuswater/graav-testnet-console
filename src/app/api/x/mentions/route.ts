import { NextRequest, NextResponse } from "next/server";
import {
  buildCapabilityMatrix,
  fetchProductMentions,
  PRODUCT_HANDLE_AT,
} from "@/lib/xProductServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/x/mentions — cron-friendly probe of mentions to @graav_xyz (read).
 * Does not write. Uses X_BEARER_TOKEN or product user token.
 * Query: ?max=5&live=1 (live=1 actually hits X; omit for capability-only)
 */
export async function GET(req: NextRequest) {
  const live = req.nextUrl.searchParams.get("live") === "1";
  const maxRaw = Number(req.nextUrl.searchParams.get("max") || "5");
  const maxResults = Number.isFinite(maxRaw) ? maxRaw : 5;

  if (!live) {
    const matrix = buildCapabilityMatrix();
    return NextResponse.json(
      {
        productHandle: PRODUCT_HANDLE_AT,
        live: false,
        message:
          "Pass ?live=1 to call X mentions API (costs quota). Capability matrix only.",
        capabilities: matrix,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const result = await fetchProductMentions({ maxResults });
  const matrix = buildCapabilityMatrix({
    mentionsProbe: result.ok
      ? {
          ok: true,
          detail: `Fetched ${result.mentions.length} mention(s) via ${result.tokenKind}`,
        }
      : { ok: false, detail: result.error },
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        productHandle: PRODUCT_HANDLE_AT,
        live: true,
        error: result.error,
        status: result.status,
        capabilities: matrix,
      },
      { status: result.status && result.status < 500 ? result.status : 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      productHandle: PRODUCT_HANDLE_AT,
      live: true,
      tokenKind: result.tokenKind,
      mentions: result.mentions,
      meta: result.meta,
      capabilities: matrix,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
