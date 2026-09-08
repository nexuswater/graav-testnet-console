/** Explicit RLUSD profile selector. Mainnet remains disabled by default; the
 * testnet clone is opt-in and never inherits the X1 bind domain. */
// Coin V1 is the public console default; mainnet is opt-in only.
const CLONE = process.env.NEXT_PUBLIC_RLUSD_TESTNET_CLONE !== '0' && process.env.RLUSD_TESTNET_CLONE !== '0';
const CLONE_FACTORY = "0xd2b7C9D3df75b081c4CB01F711D31D06263EbA20";
const CLONE_QUOTE = "0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F";
// The new factory has not created its first Moment yet. Keep market addresses
// null so reads, trades, and mention sessions fail closed until then.
const CLONE_COIN: string | null = null;
const CLONE_CURVE: string | null = null;

/** CODE READY infrastructure addresses for the 1449000 clone tip. */
export const RLUSD_CLONE_INFRA = {
  factory: CLONE_FACTORY,
  mockRlusd: CLONE_QUOTE,
  attributionGuard: "0x3d1aACAcfFff6B96Adf732E0bd2D5c19B4F7e951",
  feeEscrow: "0x4811a4a325Fa87D61DAE8272a3a3e8F014e93771",
  creatorVault: "0xdd1B9Fb597FbE2F684850145d3C717EcAaa89F42",
  launchAuthorizer: "0xBA100b11adF478B3B96Ce2F2BebFBd8Cf2E4E336",
} as const;

export const RLUSD_V1 = {
  profile: CLONE ? 'testnet-clone' : 'mainnet-target',
  policyId: 'GRAAV_RLUSD_V1_40_35_20_5',
  chainId: CLONE ? 1449000 : 1440000,
  quoteAddress: CLONE ? CLONE_QUOTE : '0x8d58c0c60b8d6b88fa98b291a646db34d0f98258',
  quoteSymbol: 'RLUSD',
  gasSymbol: 'XRP',
  rpc: CLONE ? 'https://rpc.testnet.xrplevm.org' : 'https://rpc.xrplevm.org',
  explorer: CLONE ? 'https://explorer.testnet.xrplevm.org' : 'https://explorer.xrplevm.org',
  bindVerifyingContract: CLONE ? CLONE_FACTORY : null,
  factoryAddress: CLONE ? CLONE_FACTORY : null,
  coinAddress: CLONE ? CLONE_COIN : null,
  curveAddress: CLONE ? CLONE_CURVE : null,
  quoteDecimals: 18,
  liveExecutionEnabled: CLONE,
  totalSupplyTokens: 1_000_000_000n,
  tokenDecimals: 18,
  reservedLpTokens: 200_000_000n,
  maxCreatorVaultBps: 1500,
  creatorVaultCliffSeconds: 30 * 86400,
  graduationRlusd: 25_000n,
  createFeeRlusd: 2n,
  waiveCreateAtGrossFirstBuyRlusd: 20n,
  maxLaunchesPerAccountPerDay: 3,
  minLauncherAgeSeconds: 7 * 86400,
  minReferrerAgeSeconds: 30 * 86400,
  attributionWindowSeconds: 7 * 86400,
  authorClaimWindowSeconds: 7 * 86400,
  unclaimedFeeWindowSeconds: 90 * 86400,
  totalFeeBps: 100,
  protocolBps: 40,
  creatorBps: 35,
  referrerBps: 20,
  midwifeBps: 5,
  lifetimeReferrerCapBpsOfFees: 3000,
} as const;
