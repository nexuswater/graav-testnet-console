import { NextRequest, NextResponse } from "next/server";
import { COOKIE_IDENTITY, verifyIdentityCookie } from "@/lib/xAuthServer";

/** GET /api/auth/x/me — bound X identity from httpOnly session (no tokens). */
export async function GET(req: NextRequest) {
  const identity = verifyIdentityCookie(req.cookies.get(COOKIE_IDENTITY)?.value);
  if (!identity) {
    return NextResponse.json({ bound: false }, { status: 200 });
  }
  return NextResponse.json({
    bound: true,
    id: identity.id,
    username: identity.username,
    name: identity.name,
    profileImageUrl: identity.profileImageUrl,
  });
}
