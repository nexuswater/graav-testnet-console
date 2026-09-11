import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVE_CORRIDOR_KEYS,
  BASE_SEPOLIA_CORRIDOR,
  DEFERRED_CORRIDORS,
  baseCorridorGate,
  isActiveCorridor,
  type CorridorSignals,
} from "../src/lib/crosschain/corridor.js";

const allCatalog: CorridorSignals = {
  squidHasDest: true,
  squidHasSource: true,
  usdcOnSource: true,
  rlusdOnDest: true,
  axelarHasSource: true,
  liveQuote: false,
  signedTxWired: false,
};

test("Base Sepolia is the only active corridor; Arb/RH/HL deferred", () => {
  assert.deepEqual([...ACTIVE_CORRIDOR_KEYS], ["base"]);
  assert.equal(BASE_SEPOLIA_CORRIDOR.chainId, 84532);
  assert.equal(BASE_SEPOLIA_CORRIDOR.destChainId, 1449000);
  assert.equal(BASE_SEPOLIA_CORRIDOR.path, "USDC → RLUSD → XRPL EVM 1449000");
  assert.equal(isActiveCorridor("base"), true);
  for (const d of DEFERRED_CORRIDORS) assert.equal(isActiveCorridor(d.key), false);
  assert.deepEqual(
    DEFERRED_CORRIDORS.map((d) => d.key),
    ["arbitrumSepolia", "robinhood", "hyperliquid"],
  );
});

test("catalog presence alone never passes the Base corridor (fail-closed)", () => {
  const gate = baseCorridorGate(allCatalog);
  assert.equal(gate.catalogReady, true);
  assert.equal(gate.pass, false);
  assert.equal(gate.status, "FAIL-CLOSED");
  assert.match(gate.reason, /No Buy/);
  assert.match(gate.reason, /Live USDC → RLUSD quote/);
  assert.equal(gate.deferred.length, 3);
});

test("missing RLUSD on dest or USDC on source blocks the corridor", () => {
  const noRlusd = baseCorridorGate({ ...allCatalog, rlusdOnDest: false });
  assert.equal(noRlusd.catalogReady, false);
  assert.equal(noRlusd.checks.find((c) => c.id === "rlusd-on-dest")?.ok, false);

  const noUsdc = baseCorridorGate({ ...allCatalog, usdcOnSource: false });
  assert.equal(noUsdc.catalogReady, false);
  assert.equal(noUsdc.pass, false);
});

test("PASS requires every check including live quote and wired tx", () => {
  const gate = baseCorridorGate({ ...allCatalog, liveQuote: true, signedTxWired: true });
  assert.equal(gate.pass, true);
  assert.equal(gate.status, "PASS");
  assert.equal(gate.checks.every((c) => c.ok), true);
});
