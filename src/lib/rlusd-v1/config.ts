/** Explicit RLUSD profile selector. Mainnet remains disabled by default; the
 * testnet clone is opt-in and never inherits the X1 bind domain. */
// Coin V1 is the public console default; mainnet is opt-in only.
const CLONE = process.env.NEXT_PUBLIC_RLUSD_TESTNET_CLONE !== '0' && process.env.RLUSD_TESTNET_CLONE !== '0';
const addressOr = (value: string | undefined, fallback: string) => /^0x[0-9a-fA-F]{40}$/.test(value || "") ? value! : fallback;
const CLONE_FACTORY = addressOr(process.env.NEXT_PUBLIC_RLUSD_FACTORY, '0x2E393cfabeC866a38632b8C486B942089644dE93');
const CLONE_QUOTE = addressOr(process.env.NEXT_PUBLIC_RLUSD_MOCK_ADDRESS, '0x9BCd84a6DbBE53FD5ACbC77b065c58F2eF753F6e');
const CLONE_COIN = addressOr(process.env.NEXT_PUBLIC_RLUSD_COIN_ADDRESS, '0xe6A44F18A8375A3a1F3d01904C6e3001D7958A8e');
const CLONE_CURVE = addressOr(process.env.NEXT_PUBLIC_RLUSD_CURVE_ADDRESS, '0x376D4e428E25A403A3fA5cC122D1910f97B2B712');

export const RLUSD_V1 = {
  profile: CLONE ? 'testnet-clone' : 'mainnet-target',
  policyId: 'GRAAV_RLUSD_V1_40_35_20_5',
  chainId: CLONE ? 1449000 : 1440000,
  quoteAddress: CLONE ? CLONE_QUOTE : '0x8d58c0c60b8d6b88fa98b291a646db34d0f98258',
  quoteSymbol: CLONE ? 'mRLUSD' : 'RLUSD',
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
