import { encodeAbiParameters, keccak256, stringToHex, toBytes, type Address, type Hex } from "viem";
import { RLUSD_CLONE_INFRA, RLUSD_V1 as C } from "./config";
import { initializeCurve, supplyAllocation } from "./model";

export const LAUNCH_TYPEHASH = keccak256(
  stringToHex(
    "Launch(bytes32 sourcePostId,address issuer,bytes32 nameHash,bytes32 symbolHash,uint256 curveTokens,uint256 lpTokens,uint256 threshold,uint256 virtualX,uint256 virtualY,uint256 nonce,uint256 deadline)",
  ),
);

export type CreateCoinParams = {
  sourcePostId: Hex;
  name_: string;
  symbol_: string;
  issuer: Address;
  curveTokens: bigint;
  lpTokens: bigint;
  threshold: bigint;
  virtualX: bigint;
  virtualY: bigint;
  nonce: bigint;
  deadline: bigint;
};

export function sourcePostIdFromInput(raw: string): Hex {
  return keccak256(stringToHex(raw.trim()));
}

export function nameHash(name: string): Hex {
  return keccak256(toBytes(name));
}

export function buildCreateCoinParams(input: {
  sourcePost: string;
  name: string;
  symbol: string;
  issuer: Address;
  nonce?: bigint;
  deadline?: bigint;
  nowSec?: number;
}): CreateCoinParams {
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const alloc = supplyAllocation(0);
  const curve = initializeCurve(C.quoteDecimals, 0, 5000n);
  return {
    sourcePostId: sourcePostIdFromInput(input.sourcePost),
    name_: input.name,
    symbol_: input.symbol,
    issuer: input.issuer,
    curveTokens: alloc.curve,
    lpTokens: alloc.lp,
    threshold: curve.threshold,
    virtualX: curve.x,
    virtualY: curve.y,
    nonce: input.nonce ?? BigInt(now),
    deadline: input.deadline ?? BigInt(now + 3600),
  };
}

export function launchDigest(params: CreateCoinParams, authorizer = RLUSD_CLONE_INFRA.launchAuthorizer as Address): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "bytes32" },
        { type: "address" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [
        LAUNCH_TYPEHASH,
        BigInt(C.chainId),
        authorizer,
        params.sourcePostId,
        params.issuer,
        nameHash(params.name_),
        nameHash(params.symbol_),
        params.curveTokens,
        params.lpTokens,
        params.threshold,
        params.virtualX,
        params.virtualY,
        params.nonce,
        params.deadline,
      ],
    ),
  );
}

export function serializeCreateParams(params: CreateCoinParams) {
  return {
    sourcePostId: params.sourcePostId,
    name_: params.name_,
    symbol_: params.symbol_,
    issuer: params.issuer,
    curveTokens: params.curveTokens.toString(),
    lpTokens: params.lpTokens.toString(),
    threshold: params.threshold.toString(),
    virtualX: params.virtualX.toString(),
    virtualY: params.virtualY.toString(),
    nonce: params.nonce.toString(),
    deadline: params.deadline.toString(),
  };
}

export function parseCreateParams(body: Record<string, unknown>): CreateCoinParams {
  const req = (key: string) => {
    const value = body[key];
    if (value === undefined || value === null || value === "") throw new Error(`missing_${key}`);
    return value;
  };
  return {
    sourcePostId: String(req("sourcePostId")) as Hex,
    name_: String(req("name_")),
    symbol_: String(req("symbol_")),
    issuer: String(req("issuer")) as Address,
    curveTokens: BigInt(String(req("curveTokens"))),
    lpTokens: BigInt(String(req("lpTokens"))),
    threshold: BigInt(String(req("threshold"))),
    virtualX: BigInt(String(req("virtualX"))),
    virtualY: BigInt(String(req("virtualY"))),
    nonce: BigInt(String(req("nonce"))),
    deadline: BigInt(String(req("deadline"))),
  };
}

export const CREATE_COIN_FACTORY = C.factoryAddress;
export const CREATE_COIN_AUTHORIZER = RLUSD_CLONE_INFRA.launchAuthorizer;
export const CREATE_COIN_QUOTE = C.quoteAddress;
