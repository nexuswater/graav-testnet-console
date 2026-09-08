#!/usr/bin/env python3
"""PKCE remint for @graav_xyz product bot. Never prints token values."""
from __future__ import annotations
import base64, hashlib, json, os, secrets, threading, time, urllib.parse, urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / ".secrets"
REDIRECT = "http://127.0.0.1:8765/callback"
# product write scopes (bot) — not identity-only Connect X
SCOPES = "tweet.read tweet.write users.read offline.access"
AUTH = "https://twitter.com/i/oauth2/authorize"
TOKEN = "https://api.twitter.com/2/oauth2/token"
ME = "https://api.twitter.com/2/users/me"

def read_secret(name: str) -> str:
    p = SECRETS / name
    return p.read_text().strip()

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def main() -> None:
    client_id = read_secret("x-product-client-id.txt")
    client_secret = read_secret("x-product-client-secret.txt")
    expected_uid = read_secret("x-product-user-id.txt")

    verifier = b64url(secrets.token_bytes(32))
    challenge = b64url(hashlib.sha256(verifier.encode()).digest())
    state = secrets.token_urlsafe(24)

    (SECRETS / "oauth-pkce-verifier.txt").write_text(verifier + "\n")
    (SECRETS / "oauth-pkce-state.txt").write_text(state + "\n")

    q = urllib.parse.urlencode({
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": REDIRECT,
        "scope": SCOPES,
        "state": state,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
    })
    auth_url = f"{AUTH}?{q}"
    (SECRETS / "oauth-auth-url.txt").write_text(auth_url + "\n")

    box: dict = {}
    done = threading.Event()

    class H(BaseHTTPRequestHandler):
        def log_message(self, *args):
            return
        def do_GET(self):
            u = urllib.parse.urlparse(self.path)
            if u.path != "/callback":
                self.send_response(404); self.end_headers(); return
            qs = urllib.parse.parse_qs(u.query)
            box["qs"] = {k: v[0] for k, v in qs.items()}
            body = b"<html><body><h1>GRAAV OAuth catcher OK</h1><p>You can close this tab.</p></body></html>"
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            done.set()

    httpd = HTTPServer(("127.0.0.1", 8765), H)
    t = threading.Thread(target=httpd.serve_forever, daemon=True)
    t.start()
    print("CATCHER_READY http://127.0.0.1:8765/callback")
    print("AUTH_URL_FILE", SECRETS / "oauth-auth-url.txt")
    print("AUTH_URL_LEN", len(auth_url))
    print("WAITING_FOR_CALLBACK max 1800s — approve as @graav_xyz")

    if not done.wait(1800):
        httpd.shutdown()
        raise SystemExit("TIMEOUT waiting for OAuth callback")

    httpd.shutdown()
    qs = box.get("qs") or {}
    if qs.get("error"):
        raise SystemExit(f"OAUTH_ERROR {qs.get('error')} {qs.get('error_description')}")
    if qs.get("state") != state:
        raise SystemExit("STATE_MISMATCH")
    code = qs.get("code")
    if not code:
        raise SystemExit("NO_CODE")
    (SECRETS / "oauth-returned-state.txt").write_text(qs.get("state", "") + "\n")

    basic = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
    body = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": REDIRECT,
        "code_verifier": verifier,
    }).encode()
    req = urllib.request.Request(TOKEN, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    req.add_header("Authorization", f"Basic {basic}")
    with urllib.request.urlopen(req, timeout=60) as resp:
        tok = json.loads(resp.read().decode())

    access = tok.get("access_token")
    refresh = tok.get("refresh_token")
    if not access or not refresh:
        raise SystemExit("MISSING_TOKENS_IN_RESPONSE")

    # verify user
    ureq = urllib.request.Request(ME + "?user.fields=username")
    ureq.add_header("Authorization", f"Bearer {access}")
    with urllib.request.urlopen(ureq, timeout=30) as resp:
        me = json.loads(resp.read().decode())
    uid = str(me.get("data", {}).get("id") or "")
    username = me.get("data", {}).get("username") or ""
    print("USER", username, "id", uid)
    if uid != expected_uid:
        raise SystemExit(f"WRONG_USER expected {expected_uid} got {uid} @{username}")
    if username.lower() != "graav_xyz":
        raise SystemExit(f"WRONG_HANDLE @{username}")

    (SECRETS / "x-bot-user-access-token.txt").write_text(access + "\n")
    (SECRETS / "x-bot-user-refresh-token.txt").write_text(refresh + "\n")
    # product access alias
    (SECRETS / "x-product-access-token.txt").write_text(access + "\n")
    print("SECRETS_WRITTEN access+refresh (+ product access alias)")
    print("REMINT_PASS")

if __name__ == "__main__":
    main()
