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
