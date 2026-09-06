import { NextRequest, NextResponse } from "next/server";
import {
  CLEAR_COOKIE_OPTS,
  COOKIE_IDENTITY,
  COOKIE_STATE,
  COOKIE_VERIFIER,
} from "@/lib/xAuthServer";

function appOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "localhost:3000";
  return `${proto}://${host}`;
}

/** GET|POST /api/auth/x/logout — clear identity session cookie. */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(`${appOrigin(req)}/?x_auth=signed_out`);
  res.cookies.set(COOKIE_IDENTITY, "", CLEAR_COOKIE_OPTS);
  res.cookies.set(COOKIE_STATE, "", CLEAR_COOKIE_OPTS);
  res.cookies.set(COOKIE_VERIFIER, "", CLEAR_COOKIE_OPTS);
  return res;
}

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_IDENTITY, "", CLEAR_COOKIE_OPTS);
  res.cookies.set(COOKIE_STATE, "", CLEAR_COOKIE_OPTS);
  res.cookies.set(COOKIE_VERIFIER, "", CLEAR_COOKIE_OPTS);
  return res;
}
