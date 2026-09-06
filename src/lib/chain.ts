import { defineChain, parseAbi, type Address } from "viem";

export const XRPL_EVM_TESTNET_ID = 1449000;

export const xrplEvmTestnet = defineChain({
  id: XRPL_EVM_TESTNET_ID,
  name: "XRPL EVM Testnet",
  nativeCurrency: { name: "XRP", symbol: "XRP", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.xrplevm.org"] },
  },
  blockExplorers: {
    default: {
      name: "XRPL EVM Explorer",
      url: "https://explorer.testnet.xrplevm.org",
    },
  },
  testnet: true,
});

export const FACTORY_ADDRESS =
  "0x72be5a300956f9dF0F4264a4211251dD17CA276B" as Address;
export const GRADUATION_MANAGER_ADDRESS =
  "0x99d4b78Fc613FfdC8E1e7e794D686A62F1F99992" as Address;
export const T589_MARKET_ADDRESS =
  "0xA24798bE0ff8b0444885d060f78141979c6Dd0a2" as Address;
export const T589_TOKEN_ADDRESS =
  "0x9Ec538172F188C92250a11D921A39D97755E9c8E" as Address;
/** Josh live market #2 (NXS / creator 0xe3D8…) */
export const MARKET2_ADDRESS =
  "0x3Adc0082F3751077fD9D9a6b14F4e5bbD2BA3CD5" as Address;
export const MARKET2_TOKEN =
  "0xdcD481d77D57490a0Dd7E36004B0691Fdd29B9f5" as Address;

/** Josh demo bonding-curve meme markets (g-prefixed). Load by symbol also works. */
export const MEME_TESTNET_MARKETS = [
  { symbol: "gPEPE", name: "GRAAV Pepe", market: "0x05B122209e1e08b8E1BDC622bfCCE473848CaC05" as Address, token: "0x7dCC2806A0903c0E192D35362C7F889Cd181Ddd4" as Address },
  { symbol: "gDOGE", name: "GRAAV Doge", market: "0x0db789c8b8eA2a57e06fEda17d7F2e4E4f0A4fce" as Address, token: "0x40DcAcD8C2E81430DA77c6f1047DC195Fd0ce921" as Address },
  { symbol: "gFUZZY", name: "GRAAV Fuzzy", market: "0x1eB74EC8D387bAA674557c8D9ABAF8517a25F1b0" as Address, token: "0xA756beF882915ddd65De3e9d6282e7AfEFA66295" as Address },
  { symbol: "gSHIB", name: "GRAAV Shib", market: "0x1E432F761DAeB2D6e83fA5099fe95901b3885150" as Address, token: "0xD3bCACC1fDCF1fBA1Aa71955E1eAAE4a383053c1" as Address },
  { symbol: "gWIF", name: "GRAAV Wif", market: "0xD2F34C87E4CBAa7f23618232d2650d6715a1aa80" as Address, token: "0x71bD85279b4b07BC0874b2696eb3aedf5fb736bE" as Address },
  { symbol: "gBONK", name: "GRAAV Bonk", market: "0xA8fd9E5E22dF4C060784aEB8e7C8b985aC77B640" as Address, token: "0x2f4Ae7a39748933ec259ab8AEE5f80050042b7b9" as Address },
] as const;

/** Live TestDex v1 — seedLiquidity / LP receipts only; NO swap. T589 LP sits here. */
export const TEST_DEX_V1_ADDRESS =
  "0x60335a73798c4AA4fB6fB4b14C5ECa1263a4A874" as Address;

/** M2.2 live TestDexAdapterV2 — swapExact* + getReserves. T589 still on v1 scar. */
export const TEST_DEX_V2_ADDRESS =
  "0xA3f6a5c32842FF045B5Eb628141210466E39ED83" as Address;

/** M2.2 Factory (V2-wired). Meme/T589 stay on FACTORY_ADDRESS (M2). Dual-factory. */
export const M22_FACTORY_ADDRESS =
  "0x8f2D4E36ec0Ef2e55e0073830C22C8f863D89076" as Address;
export const M22_GRADUATION_MANAGER_ADDRESS =
  "0x1367C773942900c1a913221D508BdB9232908e0a" as Address;

/** Fresh post-grad prove market on M22 (gSWAP). Swap enabled via V2. */
export const GSWAP_MARKET_ADDRESS =
  "0x7a4bCfF97A33F408F356B9B54fd5709dCA34078a" as Address;
export const GSWAP_TOKEN_ADDRESS =
  "0x03411DfEB2CBaC4EEA48CE9Aa57c8F4B12EB7C0a" as Address;

/** Fresh M2 bonding-curve market (g589). Preferred live curve over T589 scar. */
export const G589_MARKET_ADDRESS =
  "0x1808D7c28962a33D7d5578F1663A04D9F865814c" as Address;
export const G589_TOKEN_ADDRESS =
  "0x2C255Aa2DE80f1ed213F223CaBb71f4c5a56DC5e" as Address;

export const FAUCET_URL = "https://faucet.xrplevm.org";
export const EXPLORER_URL = "https://explorer.testnet.xrplevm.org";
export const RPC_URL = "https://rpc.testnet.xrplevm.org";

export const factoryAbi = parseAbi([
  "event MarketCreated(uint256 indexed marketId, address indexed token, address indexed market, address creator, string symbol, bytes32 originHash)",
  "function createMarket(string name, string symbol, string metadataURI, bytes32 originHash) returns (uint256 marketId, address token, address market)",
  "function getMarket(uint256 marketId) view returns ((address token, address market, address creator, bytes32 originHash, uint64 createdAt, uint32 templateVersion, bool graduated))",
  "function getMarketBySymbol(string symbol) view returns ((address token, address market, address creator, bytes32 originHash, uint64 createdAt, uint32 templateVersion, bool graduated))",
  "function marketCount() view returns (uint256)",
]);

export const marketAbi = parseAbi([
  "function buy(uint256 minTokensOut) payable returns (uint256 tokensOut)",
  "function sell(uint256 tokenAmount, uint256 minXrpOut) returns (uint256 xrpOut)",
  "function realXrp() view returns (uint256)",
  "function tokenReserve() view returns (uint256)",
  "function graduated() view returns (bool)",
  "function token() view returns (address)",
  "function price() view returns (uint256)",
  "function previewBuy(uint256 xrpIn) view returns (uint256 tokensOut, uint256 creatorFee, uint256 protocolFee, uint256 distributorFee)",
  "function previewSell(uint256 tokenAmount) view returns (uint256 xrpOut, uint256 creatorFee, uint256 protocolFee, uint256 distributorFee)",
  "function graduationThresholdXrp() view returns (uint256)",
  "function virtualXrp() view returns (uint256)",
  "function graduationManager() view returns (address)",
]);

export const graduationManagerAbi = parseAbi([
  "function graduate(address market)",
  "function tryGraduate(address market)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
]);

/**
 * Expected TestDexAdapterV2 surface (Protocol SoT).
 * Console only calls these when TEST_DEX_V2_ADDRESS is set and reserves prove a pool.
 */
export const testDexV2Abi = parseAbi([
  "function seedLiquidity(address token, uint256 tokenAmount, uint256 xrpAmount) payable returns (address lpToken, uint256 lpAmount)",
  "function getReserves(address token) view returns (uint256 xrpReserve, uint256 tokenReserve)",
  "function getAmountOut(uint256 amountIn, uint256 reserveIn, uint256 reserveOut) pure returns (uint256 amountOut)",
  "function getAmountOutXrpForTokens(address token, uint256 xrpIn) view returns (uint256 tokensOut)",
  "function getAmountOutTokensForXrp(address token, uint256 tokenIn) view returns (uint256 xrpOut)",
  "function swapExactXrpForTokens(address token, uint256 minTokensOut) payable returns (uint256 tokensOut)",
  "function swapExactTokensForXrp(address token, uint256 tokenAmountIn, uint256 minXrpOut) returns (uint256 xrpOut)",
  "function tokenToLpId(address token) view returns (uint256)",
  "function LABEL() view returns (string)",
]);

/** v1 read-only scar helpers (never call swap on v1) */
export const testDexV1Abi = parseAbi([
  "function LABEL() view returns (string)",
  "function nextLpId() view returns (uint256)",
  "function lpMarketToken(uint256 id) view returns (address)",
  "function lpTokenAmount(uint256 id) view returns (uint256)",
  "function lpXrpAmount(uint256 id) view returns (uint256)",
]);

export type MarketInfo = {
  token: Address;
  market: Address;
  creator: Address;
  originHash: `0x${string}`;
  createdAt: bigint;
  templateVersion: number;
  graduated: boolean;
};

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as Address;

export function isV2DexConfigured(): boolean {
  return (
    !!TEST_DEX_V2_ADDRESS &&
    TEST_DEX_V2_ADDRESS.toLowerCase() !== ZERO_ADDRESS.toLowerCase()
  );
}
