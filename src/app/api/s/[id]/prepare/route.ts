import { getX1Handler } from "@/lib/graav-x1/runtime";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return getX1Handler()(request); }
