import test from "node:test";
import assert from "node:assert/strict";
import { getAbiItem, getAddress, toEventSelector, toFunctionSelector } from "viem";
import {
  ATTRIBUTION_HOP_DEPTH,
  ATTRIBUTION_V1_FACTORY_ADDRESS,
  ATTRIBUTION_V1_STACK,
  BUY_WITH_ATTRIBUTION_SELECTOR,
  FACTORY_ADDRESS,
  GSWAP_MARKET_ADDRESS,
  G589_MARKET_ADDRESS,
  M22_FACTORY_ADDRESS,
  attributionFactoryAbi,
  attributionMarketAbi,
  factoryAbi,
  marketAbi,
} from "../src/lib/chain.js";
import {
  ALLOWED_FACTORIES,
  RLUSD_CLONE_FACTORY_ADDRESS,
  factoryShortLabel,
  isAttributionV1Factory,
  validateAllowlist,
} from "../src/lib/sessionAllowlist.js";
import { RLUSD_CLONE_INFRA, RLUSD_V1 } from "../src/lib/rlusd-v1/config.js";
import {
  ATTRIBUTION_V1,
  ATTRIBUTION_V1_TIP_LINE,
  CROSS_CHAIN_FAIL_CLOSED_LINE,
  KERNEL_LAB_LINE,
  KERNEL_LAB_REF,
} from "../src/lib/xPrimary.js";

/** Exec deployment record — Attribution V1 tip remint stack2 (1449000). */
const STACK2 = {
  factory: "0x3d826B1495d517bA9fa1721b7e0CDB0513461e68",
  guardian: "0x8c78Ff4462dBDDEeB4eEDdc92e739101e82217e0",
  attributionVerifier: "0xE04763CdC4779deBc2293bacd4F98d5D7B82f322",
  graduationManager: "0x5eD78c0ac98aEA25dd3f123a5654Ac5531220211",
  vault: "0xF9E6E3D238a7AA4304229aB527a3e4c2d131bc49",
} as const;

/** Separate lane — must stay exactly as pinned before this change. */
const COIN_SOFT_FACTORY = "0xd2b7C9D3df75b081c4CB01F711D31D06263EbA20";
/** Orphan / retired stack1 — must never appear in any pin or allowlist. */
const RETIRED_STACK1_FACTORY = "0xc5D6eb56A0776C6215589Be49DD100763C4346EF";

const lower = (a: string) => a.toLowerCase();

test("stack2 addresses are pinned exactly, checksummed, on 1449000 with TEMPLATE_VERSION 2", () => {
  for (const [role, expected] of Object.entries(STACK2)) {
    const pinned = ATTRIBUTION_V1_STACK[role as keyof typeof STACK2];
    assert.equal(pinned, expected, `${role} pin`);
    assert.equal(getAddress(pinned), pinned, `${role} checksum`);
  }
  assert.equal(ATTRIBUTION_V1_STACK.stack, 2);
  assert.equal(ATTRIBUTION_V1_STACK.templateVersion, 2);
  assert.equal(ATTRIBUTION_V1_STACK.chainId, 1449000);
  assert.equal(ATTRIBUTION_V1_FACTORY_ADDRESS, STACK2.factory);
  const unique = new Set(Object.values(STACK2).map(lower));
  assert.equal(unique.size, 5, "five distinct contracts");
});

test("buyWithAttribution ABI matches selector 0xada7290b with depth-4 hops", () => {
  const item = getAbiItem({ abi: attributionMarketAbi, name: "buyWithAttribution" });
  assert.equal(toFunctionSelector(item), "0xada7290b");
  assert.equal(BUY_WITH_ATTRIBUTION_SELECTOR, "0xada7290b");
  assert.equal(KERNEL_LAB_REF.selector, BUY_WITH_ATTRIBUTION_SELECTOR);
  assert.equal(item.type, "function");
  if (item.type !== "function") return;
  assert.equal(item.stateMutability, "payable");
  const attribution = item.inputs[1];
  assert.equal(attribution?.type, "tuple");
  const components: readonly { name?: string; type: string }[] =
    attribution && "components" in attribution ? attribution.components : [];
  assert.equal(components.find((c) => c.name === "hops")?.type, `address[${ATTRIBUTION_HOP_DEPTH}]`);
  assert.deepEqual(
    components.map((c) => c.type),
    ["bytes32", "address", "address[4]", "address", "uint64", "uint64"],
  );
  assert.equal(ATTRIBUTION_HOP_DEPTH, 4);
  assert.equal(ATTRIBUTION_V1.depth, ATTRIBUTION_HOP_DEPTH);
  assert.equal(ATTRIBUTION_V1.hopOfDistributor.length, ATTRIBUTION_HOP_DEPTH);
  // Exec smoke evidence: attributed=true surfaces as AttributionApplied(postId, distributor).
  const applied = getAbiItem({ abi: attributionMarketAbi, name: "AttributionApplied" });
  assert.equal(
    toEventSelector(applied),
    "0x0e0c19690de9a2c7ae58126e234ebb1a7fff576a06e41dbf97bb585dfa5db145",
  );
});

test("template v2 factory ABI keeps the M2 createMarket surface and its own MarketCreated", () => {
  for (const name of ["createMarket", "getMarket", "getMarketBySymbol", "marketCount"] as const) {
    assert.equal(
      toFunctionSelector(getAbiItem({ abi: attributionFactoryAbi, name })),
      toFunctionSelector(getAbiItem({ abi: factoryAbi, name })),
      `${name} selector unchanged`,
    );
  }
  for (const name of ["buy", "sell", "graduated", "token", "price", "realXrp", "graduationManager"] as const) {
    assert.equal(
      toFunctionSelector(getAbiItem({ abi: attributionMarketAbi, name })),
      toFunctionSelector(getAbiItem({ abi: marketAbi, name })),
      `${name} selector unchanged`,
    );
  }
  assert.equal(toFunctionSelector(getAbiItem({ abi: attributionFactoryAbi, name: "TEMPLATE_VERSION" })), "0x2e23efce");
  // Smoke createMarket log topic0 on stack2 (marketId, market, creator indexed; token, name, symbol, originHash).
  assert.equal(
    toEventSelector(getAbiItem({ abi: attributionFactoryAbi, name: "MarketCreated" })),
    "0x6d3acc852a3534345730966344acb1cb72db165c80722aae68899b9942bde5bb",
  );
});

test("Coin Soft Factory 0xd2b7… lane is untouched and still displays RLUSD", () => {
  assert.equal(RLUSD_V1.factoryAddress, COIN_SOFT_FACTORY);
  assert.equal(RLUSD_CLONE_FACTORY_ADDRESS, COIN_SOFT_FACTORY);
  assert.equal(RLUSD_CLONE_INFRA.factory, COIN_SOFT_FACTORY);
  assert.equal(RLUSD_CLONE_INFRA.attributionGuard, "0x3d1aACAcfFff6B96Adf732E0bd2D5c19B4F7e951");
  assert.equal(RLUSD_CLONE_INFRA.launchAuthorizer, "0xBA100b11adF478B3B96Ce2F2BebFBd8Cf2E4E336");
  assert.equal(RLUSD_V1.quoteAddress, "0x04B9eF8Fa40E6336e8404a18cC4F6a5a852e913F");
  assert.equal(RLUSD_V1.quoteSymbol, "RLUSD");
  assert.equal(RLUSD_V1.policyId, "GRAAV_RLUSD_V1_40_35_20_5");
  assert.equal(RLUSD_V1.coinAddress, null);
  assert.equal(RLUSD_V1.curveAddress, null);
  assert.notEqual(lower(ATTRIBUTION_V1_FACTORY_ADDRESS), lower(COIN_SOFT_FACTORY));
  assert.equal(isAttributionV1Factory(COIN_SOFT_FACTORY), false);
  assert.equal(factoryShortLabel(COIN_SOFT_FACTORY), "Coin");
});

test("orphan / retired stack1 factory 0xc5D6… is never pinned or allowlisted", () => {
  const pins = Object.values(ATTRIBUTION_V1_STACK)
    .filter((v): v is `0x${string}` => typeof v === "string")
    .map((v) => lower(v));
  assert.equal(pins.includes(lower(RETIRED_STACK1_FACTORY)), false);
  assert.equal(ALLOWED_FACTORIES.map(lower).includes(lower(RETIRED_STACK1_FACTORY)), false);
  assert.equal(isAttributionV1Factory(RETIRED_STACK1_FACTORY), false);
  assert.equal(factoryShortLabel(RETIRED_STACK1_FACTORY), "unknown");
  assert.match(
    validateAllowlist({ chainId: 1449000, factory: RETIRED_STACK1_FACTORY, action: "create" }) ?? "",
    /not on allowlist/,
  );
});

test("Attribution V1 factory is allowlisted fail-closed beside M2 / M2.2 / Coin", () => {
  assert.deepEqual(ALLOWED_FACTORIES.map(lower), [
    lower(FACTORY_ADDRESS),
    lower(M22_FACTORY_ADDRESS),
    lower(STACK2.factory),
    lower(COIN_SOFT_FACTORY),
  ]);
  assert.equal(isAttributionV1Factory(STACK2.factory), true);
  assert.equal(isAttributionV1Factory(STACK2.factory.toLowerCase()), true);
  assert.equal(factoryShortLabel(STACK2.factory), "Attribution V1");
  // create on the tip is allowed on 1449000 only
  assert.equal(validateAllowlist({ chainId: 1449000, factory: STACK2.factory, action: "create" }), null);
  assert.match(validateAllowlist({ chainId: 1440000, factory: STACK2.factory, action: "create" }) ?? "", /chainId must be 1449000/);
  // no market is recorded for the tip yet → buy/sell stay fail-closed
  assert.match(validateAllowlist({ chainId: 1449000, factory: STACK2.factory, action: "buy" }) ?? "", /requires market/);
  // existing dual-factory bindings never re-home onto the tip
  assert.match(
    validateAllowlist({ chainId: 1449000, factory: STACK2.factory, market: GSWAP_MARKET_ADDRESS, action: "swap" }) ?? "",
    /must bind M2.2/,
  );
  assert.match(
    validateAllowlist({ chainId: 1449000, factory: STACK2.factory, market: G589_MARKET_ADDRESS, action: "buy" }) ?? "",
    /must bind M2/,
  );
  // other roles in the stack are not factories
  for (const role of ["guardian", "attributionVerifier", "graduationManager", "vault"] as const) {
    assert.match(validateAllowlist({ chainId: 1449000, factory: STACK2[role], action: "create" }) ?? "", /not on allowlist/);
  }
});

test("tip copy references the pinned stack2, shows RLUSD, and keeps corridor + X-primary locks", () => {
  assert.equal(KERNEL_LAB_REF.status, "PINNED");
  assert.equal(KERNEL_LAB_REF.factory, STACK2.factory);
  assert.equal(KERNEL_LAB_REF.stack, 2);
  assert.equal(KERNEL_LAB_REF.templateVersion, 2);
  assert.equal(KERNEL_LAB_REF.forge, "20/20");
  assert.match(KERNEL_LAB_REF.smoke, /createMarket \+ buy \+ buyWithAttribution attributed=true PASS/);
  assert.match(ATTRIBUTION_V1_TIP_LINE, /0x3d82…1e68/);
  assert.match(ATTRIBUTION_V1_TIP_LINE, /TEMPLATE_VERSION 2/);
  assert.match(ATTRIBUTION_V1_TIP_LINE, /0xada7290b/);
  assert.match(ATTRIBUTION_V1_TIP_LINE, /depth-4/);
  assert.doesNotMatch(KERNEL_LAB_LINE, /no tip redeploy/i);
  assert.doesNotMatch(KERNEL_LAB_LINE, /mRLUSD/);
  assert.doesNotMatch(KERNEL_LAB_LINE, /0xc5D6/i);
  assert.doesNotMatch(KERNEL_LAB_LINE, /0xd2b7/i);
  assert.match(KERNEL_LAB_LINE, /never signs attribution proofs/);
  assert.equal(CROSS_CHAIN_FAIL_CLOSED_LINE, "Fail-closed: no proven route = no Buy.");
});
