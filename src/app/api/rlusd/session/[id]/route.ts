import { NextResponse } from "next/server";
import { executeMockBuy, executeMockSell, getMockSession } from "@/lib/rlusd-v1/mockMarket";

type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) { const { id } = await params; const session = getMockSession(id); return session ? NextResponse.json({ mock: true, session }) : NextResponse.json({ error: "Not found" }, { status: 404 }); }
export async function POST(request: Request, { params }: Context) {
  const { id } = await params;
  try { const body = await request.json().catch(() => ({})) as { action?: string }; const session = body.action === "SELL" ? executeMockSell(id) : executeMockBuy(id); return NextResponse.json({ mock: true, session }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Execution failed" }, { status: 400 }); }
}
