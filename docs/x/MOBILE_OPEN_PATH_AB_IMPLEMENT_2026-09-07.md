# Mobile open path A+B implementation — 2026-09-07
Shipped: /s exposes Open in MetaMask and Copy link after injected-wallet detection fails.
WalletConnect is optional and fail-closed behind NEXT_PUBLIC_WC_PROJECT_ID.
Verification: run typecheck and exercise the mobile session fallback.
Domain hold: current Vercel origin remains until Exec confirms DNS is live; Exec must provide the WalletConnect project ID in production.
