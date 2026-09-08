# CODE READY — Soft clone tip (1449000)

**Status:** broadcast complete; console pinned to the new Soft CODE READY clone tip.

## Active tip

| Contract | Address |
| --- | --- |
| Factory | `0xd2b7C9D3df75b081c4CB01F711D31D06263EbA20` |
| AttributionGuard | `0x3d1aACAcfFff6B96Adf732E0bd2D5c19B4F7e951` |
| MockRLUSD / RLUSD | `0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F` |
| FeeEscrow | `0x4811a4a325Fa87D61DAE8272a3a3e8F014e93771` |
| CreatorVault | `0xdd1B9Fb597FbE2F684850145d3C717EcAaa89F42` |
| LaunchAuthorizer | `0xBA100b11adF478B3B96Ce2F2BebFBd8Cf2E4E336` |

The bind domain remains `GRAAV_RLUSD_TESTNET_CLONE`, version `1`, on chain `1449000`, with the new Factory as verifying contract.

## Market state

Coin and Curve are intentionally `null`: this factory is awaiting its first Moment create. Launch/create remains the wallet-reviewed path for that first create; market reads, BUY/SELL mention sessions, and direct trading stay fail-closed until the resulting Coin and Curve addresses are recorded in the tip config.

The retired Factory, Guard, MockRLUSD, Coin, and Curve are listed in [`COIN_TIP_CLONE_REDEPLOY_1449000.json`](./COIN_TIP_CLONE_REDEPLOY_1449000.json) for audit context only and are not active defaults.

No Vercel deploy was run.
