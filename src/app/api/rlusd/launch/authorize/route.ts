import { NextResponse } from "next/server";
import { privateKeyToAccount } from "viem/accounts";
import { RLUSD_CLONE_INFRA, RLUSD_V1 as C } from "@/lib/rlusd-v1/config";
import { launchDigest, parseCreateParams, serializeCreateParams } from "@/lib/rlusd-v1/createCoin";

function authorizerKey() {
  const raw = process.env.LAUNCH_AUTHORIZER_PRIVATE_KEY?.trim();
  if (!raw) return null;
  return raw.startsWith("0x") ? (raw as `0x${string}`) : (`0x${raw}` as `0x${string}`);
}

/** Signs a LaunchAuthorizer digest only when the operator key is configured. Never fabricates. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const params = parseCreateParams(body);
    const key = authorizerKey();
    if (!key) {
      return NextResponse.json(
        {
          available: false,
          error: "AUTH_UNAVAILABLE",
          message: "Launch authorization is not configured. Sign stays disabled.",
          factory: C.factoryAddress,
          authorizer: RLUSD_CLONE_INFRA.launchAuthorizer,
          chainId: C.chainId,
          params: serializeCreateParams(params),
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    const digest = launchDigest(params);
    const account = privateKeyToAccount(key);
    const signature = await account.signMessage({ message: { raw: digest } });
    return NextResponse.json(
      {
        available: true,
        signature,
        digest,
        signer: account.address,
        factory: C.factoryAddress,
        authorizer: RLUSD_CLONE_INFRA.launchAuthorizer,
        chainId: C.chainId,
        params: serializeCreateParams(params),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        available: false,
        error: "AUTH_INVALID_REQUEST",
        message: error instanceof Error ? error.message : "Invalid launch authorization request",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      available: Boolean(authorizerKey()),
      factory: C.factoryAddress,
      authorizer: RLUSD_CLONE_INFRA.launchAuthorizer,
      chainId: C.chainId,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
