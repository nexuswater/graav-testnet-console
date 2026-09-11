import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { RLUSD_CLONE_INFRA, RLUSD_V1 } from "../src/lib/rlusd-v1/config.js";
import { displayQuoteSymbol } from "../src/lib/rlusd-v1/availability.js";

/** Exec pin (2026-09-11): Mock RLUSD live on XRPL EVM testnet 1449000. On-chain symbol is mRLUSD; the UI shows RLUSD. */
const PINNED_MOCK_RLUSD = "0x04b9ef8fa40e6336e8404a18cc4f6a5a852e913f";

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.tsx$/.test(entry)) out.push(path);
  }
  return out;
}

test("quote pin: Mock RLUSD 0x04B9…913F on 1449000, displayed as RLUSD", () => {
  assert.equal(RLUSD_V1.chainId, 1449000);
  assert.equal(RLUSD_V1.quoteAddress.toLowerCase(), PINNED_MOCK_RLUSD);
  assert.equal(RLUSD_CLONE_INFRA.mockRlusd.toLowerCase(), PINNED_MOCK_RLUSD);
  assert.equal(RLUSD_V1.quoteDecimals, 18);
  assert.equal(RLUSD_V1.quoteSymbol, "RLUSD");
  assert.equal(displayQuoteSymbol(), "RLUSD");
});

test("no UI surface renders mRLUSD or Test RLUSD", () => {
  const files = [...walk(join(process.cwd(), "src/components")), ...walk(join(process.cwd(), "src/app"))];
  assert.ok(files.length > 20, "expected UI files to scan");
  const offenders = files.filter((file) => /mRLUSD|Test RLUSD|MockRLUSD/.test(readFileSync(file, "utf8")));
  assert.deepEqual(offenders, []);
});
