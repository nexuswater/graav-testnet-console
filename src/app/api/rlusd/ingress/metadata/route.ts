import { NextResponse } from "next/server";
import { fetchSquidMetadata } from "@/lib/rlusd-v1/ingress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Read-only provider catalog. It never requests a route quote or transaction data. */
export async function GET() {
  const metadata = await fetchSquidMetadata();
  return NextResponse.json({ ...metadata, liveExecutionEnabled: false }, {
    status: metadata.status === "ready" ? 200 : 424,
    headers: { "Cache-Control": "no-store" },
  });
}
