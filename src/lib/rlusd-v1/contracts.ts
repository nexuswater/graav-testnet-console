import { parseAbi } from "viem";

/** ABI for the deployed Coin V1 clone. These calls never leave the wallet path. */
export const rlusdErc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function symbol() view returns (string)",
]);

export const rlusdCurveAbi = parseAbi([
  "function graduated() view returns (bool)",
  "function pair() view returns (address)",
  "function realQuote() view returns (uint256)",
  "function threshold() view returns (uint256)",
  "function curveInventory() view returns (uint256)",
  "function virtualX() view returns (uint256)",
  "function virtualY() view returns (uint256)",
  "function buy(uint256 gross, uint256 minOut, address recipient, address referrer, address midwife, bytes32 orderId) returns (uint256 out)",
  "function sell(uint256 amount, uint256 minOut, address recipient, bytes32 orderId) returns (uint256 out)",
]);

export const rlusdPairAbi = parseAbi([
  "function reserveToken() view returns (uint256)",
  "function reserveQuote() view returns (uint256)",
  "function swapQuoteForToken(uint256 gross, uint256 minOut, address recipient, address referrer, address midwife, bytes32 orderId) returns (uint256 out)",
  "function swapTokenForQuote(uint256 amount, uint256 minOut, address recipient, bytes32 orderId) returns (uint256 out)",
]);

export const rlusdFactoryAbi = parseAbi([
  "function quote() view returns (address)",
  "function launchAuthorizer() view returns (address)",
  "function coinBySourcePost(bytes32 sourcePostId) view returns (address)",
  "function createCoin((bytes32 sourcePostId, string name_, string symbol_, address issuer, uint256 curveTokens, uint256 lpTokens, uint256 threshold, uint256 virtualX, uint256 virtualY, uint256 nonce, uint256 deadline) p, bytes signature) returns (address token, address curve, address escrow)",
  "event CoinCreated(bytes32 indexed sourcePostId, address indexed token, address indexed curve, address escrow, address issuer, bytes32 policyHash)",
]);

export const launchAuthorizerAbi = parseAbi([
  "function signer() view returns (address)",
  "function digest((bytes32 sourcePostId, address issuer, bytes32 nameHash, bytes32 symbolHash, uint256 curveTokens, uint256 lpTokens, uint256 threshold, uint256 virtualX, uint256 virtualY, uint256 nonce, uint256 deadline) a) view returns (bytes32)",
  "function usedNonce(address issuer, uint256 nonce) view returns (bool)",
]);
