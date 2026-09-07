# Account dropdown: WalletConnect + X

**Date:** 2026-09-07

- The global header keeps only the Account dropdown and hamburger menu on the right.
- WalletConnect and Login to X are full-width dark provider pills inside Account, with marks on the left and chevrons on the right.
- WalletConnect remains the only wallet connector; injected/MetaMask connection paths are not exposed.
- Without `NEXT_PUBLIC_WC_PROJECT_ID`, the WalletConnect row is disabled and muted (fail-closed).
- The `/s` body retains its WalletConnect CTA for signing, but the signing-session header uses the shared Account/Menu chrome.
