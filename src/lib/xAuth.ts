/**
 * X (Twitter) identity bind — client-safe helpers.
 * NO tweet/DM write scopes. Secrets stay server-side / env only.
 * Server OAuth helpers live in xAuthServer.ts (Node crypto).
 */

export type XAuthConfig = {
  configured: boolean;
  clientIdPresent: boolean;
  /** Public flag only — never expose secret to client */
  message: string;
};

export type XIdentity = {
  id: string;
  username: string;
  name: string;
  /** Public X avatar URL returned by users/me when available. */
  profileImageUrl?: string;
};

/** Scopes: identity only. tweet.read required by X for GET /2/users/me; no write/DM. */
export const X_OAUTH_SCOPES = "users.read tweet.read offline.access";

/** Client-safe check: only NEXT_PUBLIC_X_CLIENT_ID is readable in browser. */
export function getClientXAuthHint(): XAuthConfig {
  const clientId =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_X_CLIENT_ID?.trim()
      : "";
  const clientIdPresent = Boolean(clientId);
  if (!clientIdPresent) {
    return {
      configured: false,
      clientIdPresent: false,
      message:
        "Sign in with X isn't available on this deployment yet. It links your X identity for rewards and never authorizes a trade.",
    };
  }
  return {
    configured: true,
    clientIdPresent: true,
    message:
      "Sign in with X links your identity for rewards. It never posts for you and never authorizes a trade.",
  };
}
