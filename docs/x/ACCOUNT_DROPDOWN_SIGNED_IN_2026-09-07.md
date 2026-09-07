# Signed-in Account dropdown: XRPL wallet + X identity

**Date:** 2026-09-07

- When the wallet is connected, the first Account row is a black XRPL-mark pill with the truncated address and a right chevron.
- When X identity is bound, the second row is a black avatar pill with the `@handle` and a right chevron.
- X `profile_image_url` is requested and carried through the signed identity session; a letter avatar is used when unavailable.
- Clicking the wallet pill copies the address and opens wallet actions; clicking the X pill opens the sign-out details.
- Signed-out rows remain WalletConnect and Login to X provider pills. WalletConnect stays fail-closed without `NEXT_PUBLIC_WC_PROJECT_ID`.
