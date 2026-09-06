import { NextRequest, NextResponse } from "next/server";
import {
  COOKIE_STATE,
  COOKIE_VERIFIER,
  X_AUTHORIZE_URL,
  X_OAUTH_SCOPES,
  generatePkce,
  generateState,
  getCallbackUrl,
  getServerXCredentials,
  STATE_COOKIE_OPTS,
} from "@/lib/xAuthServer";

/**
 * GET /api/auth/x — start X OAuth 2.0 (Authorization Code + PKCE).
 * Identity bind only: users.read tweet.read offline.access (no write/DM).
 */
export async function GET(req: NextRequest) {
  const creds = getServerXCredentials();
  if (!creds) {
    const origin = new URL(req.url).origin;
    return NextResponse.redirect(
      `${origin}/?x_auth=missing_credentials`
    );
  }

  const { verifier, challenge } = generatePkce();
  const state = generateState();
  const redirectUri = getCallbackUrl(req);

  const url = new URL(X_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", X_OAUTH_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  const res = NextResponse.redirect(url.toString());
  const opts = STATE_COOKIE_OPTS();
  res.cookies.set(COOKIE_STATE, state, opts);
  res.cookies.set(COOKIE_VERIFIER, verifier, opts);
  return res;
}
