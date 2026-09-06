import { NextRequest, NextResponse } from "next/server";
import {
  CLEAR_COOKIE_OPTS,
  COOKIE_IDENTITY,
  COOKIE_STATE,
  COOKIE_VERIFIER,
  IDENTITY_COOKIE_OPTS,
  exchangeCodeForTokens,
  fetchXUserMe,
  getCallbackUrl,
  getServerXCredentials,
  signIdentity,
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

/**
 * GET /api/auth/x/callback — exchange code, bind identity, set httpOnly session.
 * Access tokens are used once for profile fetch; session cookie holds identity only.
 */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const fail = (reason: string) =>
    NextResponse.redirect(`${origin}/?x_auth=error&reason=${encodeURIComponent(reason)}`);

  const creds = getServerXCredentials();
  if (!creds) return fail("missing_credentials");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) {
    return fail(oauthError);
  }
  if (!code || !state) return fail("missing_code_or_state");

  const cookieState = req.cookies.get(COOKIE_STATE)?.value;
  const codeVerifier = req.cookies.get(COOKIE_VERIFIER)?.value;
  if (!cookieState || cookieState !== state) return fail("state_mismatch");
  if (!codeVerifier) return fail("missing_verifier");

  try {
    const redirectUri = getCallbackUrl(req);
    const tokens = await exchangeCodeForTokens({
      code,
      codeVerifier,
      redirectUri,
      clientId: creds.clientId,
      clientSecret: creds.clientSecret,
    });

    // Reject if X somehow granted write scopes we never requested
    const scope = (tokens.scope ?? "").toLowerCase();
    if (scope.includes("tweet.write") || scope.includes("dm.write") || scope.includes("dm.read")) {
      return fail("unexpected_write_scope");
    }

    const identity = await fetchXUserMe(tokens.access_token);
    // Do not persist access/refresh tokens — identity bind only.
    const signed = signIdentity(identity);

    const res = NextResponse.redirect(`${origin}/?x_auth=ok`);
    res.cookies.set(COOKIE_IDENTITY, signed, IDENTITY_COOKIE_OPTS());
    res.cookies.set(COOKIE_STATE, "", CLEAR_COOKIE_OPTS);
    res.cookies.set(COOKIE_VERIFIER, "", CLEAR_COOKIE_OPTS);
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "exchange_failed";
    return fail(msg.slice(0, 120));
  }
}
