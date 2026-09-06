import { decodeFunctionData, encodeFunctionData, parseAbi, type PublicClient } from "viem";
import { X1 } from "./core/config";
import { address, need, X1Error } from "./core/security";
import type { BuyCodec } from "./core/viem-gateway";
import type { Address, Quote } from "./core/types";

const v2Abi = parseAbi([
  "function getAmountOutXrpForTokens(address token, uint256 xrpIn) view returns (uint256 tokensOut)",
  "function swapExactXrpForTokens(address token, uint256 minTokensOut) payable returns (uint256 tokensOut)",
]);
const factoryAbi = parseAbi([
  "function getMarketBySymbol(string symbol) view returns ((address token, address market, address creator, bytes32 originHash, uint64 createdAt, uint32 templateVersion, bool graduated))",
]);

/** Real TestDexAdapterV2 ABI adapter reused from the console's chain ABI. */
export const existingV2Codec: BuyCodec = {
  async quoteBuy(client: PublicClient, _wallet: Address, now: number) {
    const amount = BigInt(X1.amountWei);
    const out = await client.readContract({
      address: X1.v2 as Address,
      abi: v2Abi,
      functionName: "getAmountOutXrpForTokens",
      args: [X1.token as Address, amount],
    });
    const quoted = BigInt(out as bigint);
    need(quoted > 1n, "LIVE_V2_NO_POSITIVE_QUOTE", 503);
    const minOut = (quoted * 99n) / 100n;
    need(minOut > 0n, "LIVE_V2_NO_POSITIVE_MIN_OUT", 503);
    const data = encodeFunctionData({
      abi: v2Abi,
      functionName: "swapExactXrpForTokens",
      args: [X1.token as Address, minOut],
    });
    return {
      to: X1.v2 as Address,
      data,
      minOut: minOut.toString(),
      expiresAt: now + X1.orderTtl,
      creator: null,
    };
  },
  assertBuyCall(quote: Quote, wallet: Address) {
    void wallet;
    need(address(quote.to) === address(X1.v2), "WRONG_DESTINATION", 503);
    need(BigInt(quote.minOut) > 0n, "NON_POSITIVE_MIN_OUT", 503);
    try {
      const decoded = decodeFunctionData({ abi: v2Abi, data: quote.data });
      need(decoded.functionName === "swapExactXrpForTokens", "WRONG_V2_METHOD", 503);
      need(address(String(decoded.args[0])) === address(X1.token), "WRONG_V2_TOKEN", 503);
      need(BigInt(String(decoded.args[1])) === BigInt(quote.minOut), "MIN_OUT_MISMATCH", 503);
    } catch (error) {
      if (error instanceof X1Error) throw error;
      throw new X1Error("LIVE_V2_CALL_DECODE_FAILED", 503);
    }
  },
  async creatorAt(client: PublicClient, blockNumber: bigint) {
    try {
      const info = await client.readContract({
        address: X1.factory as Address,
        abi: factoryAbi,
        functionName: "getMarketBySymbol",
        args: ["gSWAP"],
        blockNumber,
      });
      const row = info as { token: Address; market: Address; creator: Address };
      if (address(row.market) !== address(X1.market) || address(row.token) !== address(X1.token)) return null;
      return address(row.creator);
    } catch {
      return null;
    }
  },
};

