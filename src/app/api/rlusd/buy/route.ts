import { NextResponse } from "next/server";

/** Mock financial-success sessions are closed. Wallet-signed Trade is the only buy path. */
export async function POST() {
  return NextResponse.json(
    {
      mock: true,
      executable: false,
      error: "MOCK_FINANCIAL_SUCCESS_CLOSED",
      message: "Mock buy sessions are closed. Review and sign on the Trade rail.",
    },
    { status: 409, headers: { "Cache-Control": "no-store" } },
  );
}
