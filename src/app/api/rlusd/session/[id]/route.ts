import { NextResponse } from "next/server";

const closed = {
  mock: true,
  executable: false,
  error: "MOCK_FINANCIAL_SUCCESS_CLOSED",
  message: "Mock financial sessions cannot complete. Wallet signing is required.",
};

export async function GET() {
  return NextResponse.json(closed, { status: 409, headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  return NextResponse.json(closed, { status: 409, headers: { "Cache-Control": "no-store" } });
}
