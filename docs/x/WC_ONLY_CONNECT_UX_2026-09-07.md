# WalletConnect-only connect UX — 2026-09-07

- Disconnected wallet CTAs on `/s` and AccountMenu now expose WalletConnect only.
- MetaMask deep-link and injected/browser-wallet connect CTAs are removed from those surfaces.
- WalletConnect and X marks are inline SVG components.
- Missing `NEXT_PUBLIC_WC_PROJECT_ID` fails closed with a muted WalletConnect-unavailable message.

No deployment or origin changes. M4 untouched.
