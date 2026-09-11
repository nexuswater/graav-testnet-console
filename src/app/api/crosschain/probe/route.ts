import { NextResponse } from "next/server";
import { XRPL_EVM_TESTNET_ID, FAUCET_URL } from "@/lib/chain";
import {
  BASE_SEPOLIA_CORRIDOR,
  DEFERRED_REASON,
  baseCorridorGate,
  isActiveCorridor,
  type CorridorGate,
} from "@/lib/crosschain/corridor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEST = XRPL_EVM_TESTNET_ID; // 1449000 — local testnet Buy gate
const MAINNET_DEST = 1440000; // Squid-first Aggregated* policy target
const SQUID_CHAINS = "https://v2.api.squidrouter.com/v2/chains";
const SQUID_TOKENS = "https://v2.api.squidrouter.com/v2/tokens";
const AXELAR_CHAINS = "https://testnet.api.axelarscan.io/api/getChains";
const AXELAR_ITS = "https://testnet.api.axelarscan.io/api/getITSAssets";
const AXELAR_ASSETS = "https://testnet.api.axelarscan.io/api/getAssets";
const LIFI_CHAINS = "https://li.quest/v1/chains";
const DEBRIDGE_CHAINS = "https://api.dln.trade/v1.0/supported-chains-info";
const LZ_META = "https://metadata.layerzero-api.com/v1/metadata";
const SKIP_CHAINS = "https://api.skip.money/v2/info/chains";

type SourceDef = {
  key: string;
  label: string;
  chainId: number;
  group: "priority3" | "top7";
  /** Axelar scan id when known (testnet) */
  axelarId?: string;
  substitute?: { label: string; chainId: number; axelarId?: string };
};

/** Spend-USDC sources → settle 1449000. Never invent routes.
 * Only ACTIVE corridors (Base Sepolia) are probed this slice; others are deferred. */
const SOURCES: SourceDef[] = [
  {
    key: "base",
    label: "Base Sepolia",
    chainId: 84532,
    group: "priority3",
    axelarId: "base-sepolia",
    substitute: { label: "Base", chainId: 8453, axelarId: "base" },
  },
  {
    key: "hyperliquid",
    label: "HyperEVM Testnet (Hype)",
    chainId: 998,
    group: "priority3",
    axelarId: "hyperliquid",
    substitute: { label: "HyperEVM", chainId: 999 },
  },
  {
    key: "robinhood",
    label: "Robinhood Chain Testnet (Hood)",
    chainId: 46630,
    group: "priority3",
  },
  {
    key: "ethereumSepolia",
    label: "Ethereum Sepolia",
    chainId: 11155111,
    group: "top7",
    axelarId: "ethereum-sepolia",
    substitute: { label: "Ethereum", chainId: 1, axelarId: "ethereum" },
  },
  {
    key: "arbitrumSepolia",
    label: "Arbitrum Sepolia",
    chainId: 421614,
    group: "top7",
    axelarId: "arbitrum-sepolia",
    substitute: { label: "Arbitrum One", chainId: 42161, axelarId: "arbitrum" },
  },
  {
    key: "optimismSepolia",
    label: "Optimism Sepolia",
    chainId: 11155420,
    group: "top7",
    axelarId: "optimism-sepolia",
    substitute: { label: "Optimism", chainId: 10, axelarId: "optimism" },
  },
  {
    key: "polygonAmoy",
    label: "Polygon Amoy",
    chainId: 80002,
    group: "top7",
    axelarId: "polygon-sepolia",
    substitute: { label: "Polygon", chainId: 137, axelarId: "polygon" },
  },
  {
    key: "avalancheFuji",
    label: "Avalanche Fuji",
    chainId: 43113,
    group: "top7",
    axelarId: "avalanche",
    substitute: { label: "Avalanche C-Chain", chainId: 43114 },
  },
  {
    key: "bnbTestnet",
    label: "BNB Testnet",
    chainId: 97,
    group: "top7",
    axelarId: "binance",
    substitute: { label: "BNB Smart Chain", chainId: 56 },
  },
  {
    key: "lineaSepolia",
    label: "Linea Sepolia",
    chainId: 59141,
    group: "top7",
    axelarId: "linea-sepolia",
    substitute: { label: "Linea", chainId: 59144, axelarId: "linea" },
  },
];

export type ProbeStatus = "ok" | "blocked" | "unsupported";

export type ProviderRow = {
  id: string;
  label: string;
  queried: boolean;
  result: "PASS" | "FAIL" | "PARTIAL";
  hasDest: boolean;
  hasUsdcOnDest: boolean;
  detail: string;
  chainCount?: number;
  notes?: string;
};

export type ProbeLeg = {
  key: string;
  label: string;
  ok: boolean;
  result: "PASS" | "FAIL";
  status: ProbeStatus;
  reason: string;
  provider?: string;
  providers?: { id: string; result: "PASS" | "FAIL" | "PARTIAL"; detail: string }[];
  fromChainId?: number;
  toChainId?: number;
  hasUsdc: boolean;
  usdcAddress?: string | null;
  substitute?: {
    label: string;
    chainId: number;
    inSquid: boolean;
    hasUsdc: boolean;
    usdcAddress?: string | null;
  };
  nextStep?: string;
  group: "priority3" | "top7";
};

export type AggregatedHopStatus = "planned" | "ready" | "blocked";

export type AggregatedHop = {
  id: "source-usdc" | "aggregator-settle" | "swap-market";
  label: string;
  status: AggregatedHopStatus;
  detail: string;
};

export type HopFamilyStatus = "candidate" | "partial" | "blocked" | "pass";

export type HopFamily = {
  id: "A" | "B";
  label: string;
  status: HopFamilyStatus;
  legs: string[];
  detail: string;
};

/** Locked policy path: source USDC → Squid quote → RLUSD on mainnet 1440000; testnet Buy remains fail-closed. */
export type AggregatedPath = {
  kind: "aggregated-usdc-to-rlusd";
  hops: AggregatedHop[];
  hopFamilies: HopFamily[];
  buyEnabled: boolean;
  settleReady: boolean;
  swapReady: boolean;
  /** Preferred RLUSD destination asset for the Squid mainnet policy lane. */
  preferredSettleAsset: "rlusd";
  squidQuoteLive: boolean;
  mainnetTargetChainId: number;
  axelarItsOnDest: {
    xrp: boolean;
    rlusd: boolean;
    usdc: boolean;
    symbols: string[];
  };
};

export type ProbeResponse = {
  destChainId: number;
  destLabel: string;
  faucet: string;
  note: string;
  anyPass: boolean;
  buyEnabledCount: number;
  /** Base Sepolia first corridor gate (USDC → RLUSD → 1449000). Fail-closed. */
  corridor: CorridorGate;
  /** Aggregated USDC→GRAAV path (SoT). Never invent PASS. */
  path: AggregatedPath;
  providers: ProviderRow[];
  squid: {
    queried: boolean;
    integrator: string;
    chainCount?: number;
    hasDest: boolean;
    notedMainnetXrplEvm?: string;
  };
  sources: ProbeLeg[];
  base: ProbeLeg;
  hyperliquid: ProbeLeg;
  robinhood: ProbeLeg;
  ethereumSepolia: ProbeLeg;
  arbitrumSepolia: ProbeLeg;
  optimismSepolia: ProbeLeg;
  polygonAmoy: ProbeLeg;
  avalancheFuji: ProbeLeg;
  bnbTestnet: ProbeLeg;
  lineaSepolia: ProbeLeg;
};

const NEXT_FAUCET_TRADE =
  "Get XRPL EVM testnet XRP via faucet, then Trade on 1449000.";

function pickIntegrator(): string {
  return (
    process.env.SQUID_INTEGRATOR_ID?.trim() ||
    process.env.NEXT_PUBLIC_SQUID_INTEGRATOR_ID?.trim() ||
    "test"
  );
}

async function fetchJson(
  url: string,
  opts?: { headers?: Record<string, string>; timeoutMs?: number }
): Promise<{ ok: boolean; status: number; json: unknown; error?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 18000);
    const res = await fetch(url, {
      headers: opts?.headers,
      cache: "no-store",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        json,
        error: `HTTP ${res.status}`,
      };
    }
    return { ok: true, status: res.status, json };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      json: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function chainIdOf(c: Record<string, unknown>): string {
  return String(c.chainId ?? c.id ?? "");
}

async function probeSquid(integrator: string) {
  const chainsRes = await fetchJson(SQUID_CHAINS, {
    headers: { "x-integrator-id": integrator },
  });
  const chains = (
    (chainsRes.json as { chains?: Record<string, unknown>[] })?.chains ?? []
  ) as Record<string, unknown>[];
  const ids = new Set(chains.map(chainIdOf));
  const hasDest = ids.has(String(DEST));

  const usdcByChain = new Map<number, { hasUsdc: boolean; address: string | null }>();
  const needIds = new Set<number>();
  for (const s of SOURCES) {
    if (!isActiveCorridor(s.key)) continue;
    needIds.add(s.chainId);
    if (s.substitute) needIds.add(s.substitute.chainId);
  }
  await Promise.all(
    [...needIds].map(async (id) => {
      if (!ids.has(String(id))) {
        usdcByChain.set(id, { hasUsdc: false, address: null });
        return;
      }
      const tok = await fetchJson(`${SQUID_TOKENS}?chainId=${id}`, {
        headers: { "x-integrator-id": integrator },
        timeoutMs: 12000,
      });
      const tokens =
        ((tok.json as { tokens?: { symbol?: string; address?: string }[] })
          ?.tokens ?? []) as { symbol?: string; address?: string }[];
      const hit = tokens.find(
        (t) => String(t.symbol || "").toUpperCase() === "USDC"
      );
      usdcByChain.set(id, {
        hasUsdc: !!hit,
        address: hit?.address ? String(hit.address) : null,
      });
    })
  );

  return {
    ok: chainsRes.ok,
    error: chainsRes.error,
    chainCount: chains.length,
    hasDest,
    ids,
    usdcByChain,
  };
}

async function probeAxelar() {
  const [chainsRes, itsRes, assetsRes] = await Promise.all([
    fetchJson(AXELAR_CHAINS),
    fetchJson(AXELAR_ITS),
    fetchJson(AXELAR_ASSETS),
  ]);

  const chains = (Array.isArray(chainsRes.json) ? chainsRes.json : []) as {
    id?: string;
    chain_id?: number | string;
    chain_name?: string;
  }[];
  const byId = new Map(chains.map((c) => [c.id || "", c]));
  const byChainId = new Map(
    chains
      .filter((c) => c.chain_id != null)
      .map((c) => [String(c.chain_id), c])
  );
  const dest = byId.get("xrpl-evm") || byChainId.get(String(DEST));
  const hasDest = !!dest && String(dest.chain_id) === String(DEST);

  const its = (Array.isArray(itsRes.json) ? itsRes.json : []) as {
    symbol?: string;
    name?: string;
    native_chain?: string;
    chains?: Record<string, { tokenAddress?: string }>;
  }[];
  const itsOnDest = its.filter((a) => a.chains && "xrpl-evm" in a.chains);
  const usdcIts = its.filter((a) =>
    /usdc/i.test(`${a.symbol || ""} ${a.name || ""}`)
  );
  const usdcOnDest = usdcIts.some(
    (a) => a.chains && "xrpl-evm" in a.chains
  );
  const xrpOnDest = itsOnDest.some(
    (a) => String(a.symbol || "").toUpperCase() === "XRP"
  );
  const rlusdOnDest = itsOnDest.some((a) =>
    /rlusd|ripple.?usd/i.test(`${a.symbol || ""} ${a.name || ""}`)
  );
  const rlusdAnywhere = its.some((a) =>
    /rlusd|ripple.?usd/i.test(`${a.symbol || ""} ${a.name || ""}`)
  );
  const itsSymbolsOnDest = itsOnDest.map((a) => a.symbol || "?").join(", ");
  const itsSymbolsOnDestList = itsOnDest.map((a) => a.symbol || "?");

  const assets = (Array.isArray(assetsRes.json) ? assetsRes.json : []) as {
    symbol?: string;
    denom?: string;
    addresses?: Record<string, unknown>;
  }[];
  const uausdc = assets.find(
    (a) =>
      String(a.denom || "").toLowerCase() === "uausdc" ||
      String(a.symbol || "").toLowerCase() === "ausdc"
  );
  const uausdcOnDest = !!(
    uausdc?.addresses && "xrpl-evm" in uausdc.addresses
  );

  // Source presence on Axelar testnet catalog
  const sourceIds = new Set(chains.map((c) => c.id || ""));
  const sourceChainIds = new Set(chains.map((c) => String(c.chain_id ?? "")));

  return {
    ok: chainsRes.ok,
    error: chainsRes.error,
    chainCount: chains.length,
    hasDest,
    hasUsdcOnDest: usdcOnDest || uausdcOnDest,
    hasXrpOnDest: xrpOnDest,
    hasRlusdOnDest: rlusdOnDest,
    hasRlusdAnywhere: rlusdAnywhere,
    itsSymbolsOnDest,
    itsSymbolsOnDestList,
    itsOnDestCount: itsOnDest.length,
    uausdcOnDest,
    uausdcExists: !!uausdc,
    sourceIds,
    sourceChainIds,
    itsOk: itsRes.ok,
    assetsOk: assetsRes.ok,
  };
}

async function probeLifi() {
  const res = await fetchJson(LIFI_CHAINS);
  const chains = (
    (res.json as { chains?: { id?: number; name?: string }[] })?.chains ?? []
  ) as { id?: number; name?: string }[];
  const hasDest = chains.some((c) => String(c.id) === String(DEST));
  const xrplish = chains.filter((c) =>
    /xrpl/i.test(String(c.name || ""))
  );
  return {
    ok: res.ok,
    error: res.error,
    chainCount: chains.length,
    hasDest,
    hasUsdcOnDest: false,
    xrplish: xrplish.map((c) => ({ id: c.id, name: c.name })),
  };
}

async function probeDebridge() {
  const res = await fetchJson(DEBRIDGE_CHAINS);
  const chains = (
    (res.json as { chains?: { chainId?: number; chainName?: string }[] })
      ?.chains ?? []
  ) as { chainId?: number; chainName?: string }[];
  const hasDest = chains.some((c) => String(c.chainId) === String(DEST));
  return {
    ok: res.ok,
    error: res.error,
    chainCount: chains.length,
    hasDest,
    hasUsdcOnDest: false,
  };
}

async function probeLayerZero() {
  const res = await fetchJson(LZ_META, { timeoutMs: 20000 });
  const text = JSON.stringify(res.json ?? "").toLowerCase();
  const hasXrpl = text.includes("xrpl");
  const hasDest =
    text.includes("1449000") || text.includes('"xrpl-evm"') || text.includes("xrplevm");
  return {
    ok: res.ok,
    error: res.error,
    hasDest,
    hasXrpl,
    hasUsdcOnDest: false,
  };
}

async function probeSkip() {
  const res = await fetchJson(SKIP_CHAINS);
  const text = JSON.stringify(res.json ?? "").toLowerCase();
  const hasMainnetXrplEvm =
    text.includes("xrplevm_1440000") || text.includes('"chain_id":"xrplevm_1440000');
  const hasDest =
    text.includes("1449000") ||
    text.includes("xrplevm_1449000") ||
    text.includes('"chain_id":"xrplevm_1449000');
  return {
    ok: res.ok,
    error: res.error,
    hasDest,
    hasMainnetXrplEvm,
    hasXrpl: text.includes("xrpl"),
    hasUsdcOnDest: false,
    chainCount: Array.isArray((res.json as { chains?: unknown[] })?.chains)
      ? ((res.json as { chains: unknown[] }).chains.length)
      : undefined,
  };
}

function buildProviderMatrix(p: {
  squid: Awaited<ReturnType<typeof probeSquid>>;
  axelar: Awaited<ReturnType<typeof probeAxelar>>;
  lifi: Awaited<ReturnType<typeof probeLifi>>;
  debridge: Awaited<ReturnType<typeof probeDebridge>>;
  layerzero: Awaited<ReturnType<typeof probeLayerZero>>;
  skip: Awaited<ReturnType<typeof probeSkip>>;
}): ProviderRow[] {
  const { squid, axelar, lifi, debridge, layerzero, skip } = p;

  return [
    {
      id: "squid",
      label: "Squid",
      queried: true,
      result: "FAIL",
      hasDest: squid.hasDest,
      hasUsdcOnDest: false,
      chainCount: squid.ok ? squid.chainCount : undefined,
      detail: squid.error
        ? `Probe error: ${squid.error}`
        : squid.hasDest
          ? `Lists mainnet policy metadata, but no live USDC→RLUSD quote+tx is wired.`
          : `/v2/chains does not list ${DEST} (${squid.chainCount} chains).`,
    },
    {
      id: "axelar",
      label: "Axelar (testnet ITS)",
      queried: true,
      result: axelar.hasDest && axelar.hasUsdcOnDest ? "PASS" : axelar.hasDest ? "PARTIAL" : "FAIL",
      hasDest: axelar.hasDest,
      hasUsdcOnDest: axelar.hasUsdcOnDest,
      chainCount: axelar.ok ? axelar.chainCount : undefined,
      detail: axelar.error
        ? `Probe error: ${axelar.error}`
        : !axelar.hasDest
          ? `getChains missing xrpl-evm / ${DEST}.`
          : axelar.hasUsdcOnDest
            ? `xrpl-evm ${DEST} listed AND USDC on dest — verify live transfer before Buy.`
            : `Lists xrpl-evm (${DEST}) but USDC/uausdc NOT on xrpl-evm. ITS on dest: ${
                axelar.itsSymbolsOnDest || "none"
              } (XRP=${axelar.hasXrpOnDest} RLUSD=${axelar.hasRlusdOnDest}). uausdc exists=${axelar.uausdcExists} onDest=${axelar.uausdcOnDest}. Keep Buy disabled until E2E quote+tx PASS.`,
      notes:
        "Native XRPL EVM bridge path is Axelar ITS/GMP. Catalog presence ≠ USDC spend route.",
    },
    {
      id: "lifi",
      label: "LI.FI",
      queried: true,
      result: "FAIL",
      hasDest: lifi.hasDest,
      hasUsdcOnDest: false,
      chainCount: lifi.ok ? lifi.chainCount : undefined,
      detail: lifi.error
        ? `Probe error: ${lifi.error}`
        : `li.quest/v1/chains: no ${DEST} (${lifi.chainCount} chains).`,
    },
    {
      id: "debridge",
      label: "deBridge DLN",
      queried: true,
      result: "FAIL",
      hasDest: debridge.hasDest,
      hasUsdcOnDest: false,
      chainCount: debridge.ok ? debridge.chainCount : undefined,
      detail: debridge.error
        ? `Probe error: ${debridge.error}`
        : `supported-chains-info: no ${DEST} (${debridge.chainCount} chains).`,
    },
    {
      id: "layerzero",
      label: "LayerZero",
      queried: true,
      result: "FAIL",
      hasDest: layerzero.hasDest,
      hasUsdcOnDest: false,
      detail: layerzero.error
        ? `Probe error: ${layerzero.error}`
        : layerzero.hasXrpl
          ? "Metadata mentions xrpl-ish — no proven USDC→1449000."
          : "metadata.layerzero-api.com: no XRPL / 1449000.",
    },
    {
      id: "wormhole",
      label: "Wormhole",
      queried: true,
      result: "FAIL",
      hasDest: false,
      hasUsdcOnDest: false,
      detail:
        "XRPL EVM docs: Wormhole is integrating (not live product route). SDK lists XRPLEVM/Xrpl chain ids — no public USDC→1449000 quote/tx API verified. BLOCKED.",
      notes: "Do not invent PASS from SDK enum alone.",
    },
    {
      id: "socket",
      label: "Socket / Bungee",
      queried: true,
      result: "FAIL",
      hasDest: false,
      hasUsdcOnDest: false,
      detail:
        "Socket v2 deprecated (401); Bungee public endpoint Gone (410). No catalog for 1449000.",
    },
    {
      id: "skip",
      label: "Skip (Cosmos)",
      queried: true,
      result: "FAIL",
      hasDest: skip.hasDest,
      hasUsdcOnDest: false,
      chainCount: skip.chainCount,
      detail: skip.error
        ? `Probe error: ${skip.error}`
        : skip.hasDest
          ? `Lists testnet 1449000 but no proven USDC EVM spend path — BLOCKED.`
          : skip.hasMainnetXrplEvm
            ? `Catalog has mainnet xrplevm_1440000 only — not GRAAV dest 1449000. BLOCKED.`
            : "api.skip.money: no XRPL EVM / 1449000 in chains catalog. BLOCKED for EVM USDC→1449000.",
    },
  ];
}

function buildLeg(
  def: SourceDef,
  ctx: {
    providers: ProviderRow[];
    squid: Awaited<ReturnType<typeof probeSquid>>;
    axelar: Awaited<ReturnType<typeof probeAxelar>>;
  }
): ProbeLeg {
  const squidFrom = ctx.squid.ids.has(String(def.chainId));
  const squidUsdc = ctx.squid.usdcByChain.get(def.chainId) ?? {
    hasUsdc: false,
    address: null,
  };
  const axelarFrom =
    (def.axelarId && ctx.axelar.sourceIds.has(def.axelarId)) ||
    ctx.axelar.sourceChainIds.has(String(def.chainId));

  let substitute: ProbeLeg["substitute"] | undefined;
  if (def.substitute) {
    const subUsdc = ctx.squid.usdcByChain.get(def.substitute.chainId) ?? {
      hasUsdc: false,
      address: null,
    };
    substitute = {
      label: def.substitute.label,
      chainId: def.substitute.chainId,
      inSquid: ctx.squid.ids.has(String(def.substitute.chainId)),
      hasUsdc: subUsdc.hasUsdc,
      usdcAddress: subUsdc.address,
    };
  }

  const perProvider = ctx.providers.map((pr) => {
    if (pr.id === "squid") {
      return {
        id: pr.id,
        result: "FAIL" as const,
        detail: !ctx.squid.hasDest
          ? `Dest ${DEST} absent`
          : !squidFrom
            ? `Source ${def.chainId} absent`
            : !squidUsdc.hasUsdc
              ? "USDC absent on source"
              : "Listed but no signed quote+tx wired",
      };
    }
    if (pr.id === "axelar") {
      if (!ctx.axelar.hasDest) {
        return {
          id: pr.id,
          result: "FAIL" as const,
          detail: `Dest xrpl-evm/${DEST} absent`,
        };
      }
      if (!ctx.axelar.hasUsdcOnDest) {
        return {
          id: pr.id,
          result: "PARTIAL" as const,
          detail: axelarFrom
            ? `Source ok; dest listed; USDC/uausdc NOT on xrpl-evm (ITS: ${
                ctx.axelar.itsSymbolsOnDest || "none"
              })`
            : `Dest listed; source ${def.label} not in Axelar testnet catalog; USDC still missing on dest`,
        };
      }
      return {
        id: pr.id,
        result: "FAIL" as const,
        detail: "USDC on dest cataloged but live transfer not proven — fail-closed",
      };
    }
    return {
      id: pr.id,
      result: "FAIL" as const,
      detail: pr.hasDest ? "Dest listed; USDC path unproven" : "Dest absent",
    };
  });

  // PASS only if some provider proves dest + USDC on dest + we would wire quote+tx.
  // Today: never — Axelar PARTIAL without USDC cannot enable Buy.
  const anyRealPass = false;

  const axelarNote = ctx.axelar.hasDest
    ? `Axelar lists xrpl-evm ${DEST} but USDC/uausdc not registered on dest (ITS tokens: ${
        ctx.axelar.itsSymbolsOnDest || "none"
      }).`
    : "Axelar missing dest.";
  const squidNote = ctx.squid.hasDest
    ? "Squid lists dest."
    : "Squid /v2/chains missing dest.";

  const subNote = substitute?.inSquid
    ? ` Squid lists substitute ${substitute.label} (${substitute.chainId})${
        substitute.hasUsdc ? " with USDC" : ""
      } — does not invent PASS to testnet ${DEST}.`
    : "";

  return {
    key: def.key,
    label: def.label,
    fromChainId: def.chainId,
    toChainId: DEST,
    provider: "multi",
    providers: perProvider,
    nextStep: NEXT_FAUCET_TRADE,
    group: def.group,
    hasUsdc: squidUsdc.hasUsdc,
    usdcAddress: squidUsdc.address,
    substitute,
    ok: anyRealPass,
    result: "FAIL",
    status: "blocked",
    reason: `FAIL: No verified USDC→${DEST} route for ${def.label} (${def.chainId}). ${squidNote} ${axelarNote}${subNote} LI.FI/deBridge/LZ/Wormhole/Socket/Skip: no live USDC path. Use faucet + Trade.`,
  };
}

/** Deferred sources are not probed. Fail-closed placeholder, never a route. */
function deferredLeg(def: SourceDef): ProbeLeg {
  return {
    key: def.key,
    label: def.label,
    fromChainId: def.chainId,
    toChainId: DEST,
    provider: "none",
    providers: [],
    nextStep: NEXT_FAUCET_TRADE,
    group: def.group,
    hasUsdc: false,
    usdcAddress: null,
    ok: false,
    result: "FAIL",
    status: "unsupported",
    reason: `DEFERRED: ${def.label} (${def.chainId}) — ${DEFERRED_REASON}`,
  };
}

async function buildProbe(): Promise<ProbeResponse> {
  const integrator = pickIntegrator();

  const [squid, axelar, lifi, debridge, layerzero, skip] = await Promise.all([
    probeSquid(integrator),
    probeAxelar(),
    probeLifi(),
    probeDebridge(),
    probeLayerZero(),
    probeSkip(),
  ]);

  const providers = buildProviderMatrix({
    squid,
    axelar,
    lifi,
    debridge,
    layerzero,
    skip,
  });

  const byKey: Record<string, ProbeLeg> = {};
  const sources: ProbeLeg[] = [];
  for (const s of SOURCES) {
    const row = isActiveCorridor(s.key)
      ? buildLeg(s, { providers, squid, axelar })
      : deferredLeg(s);
    byKey[s.key] = row;
    sources.push(row);
  }

  const corridor = baseCorridorGate({
    squidHasDest: squid.hasDest,
    squidHasSource: squid.ids.has(String(BASE_SEPOLIA_CORRIDOR.chainId)),
    usdcOnSource: squid.usdcByChain.get(BASE_SEPOLIA_CORRIDOR.chainId)?.hasUsdc ?? false,
    rlusdOnDest: axelar.hasRlusdOnDest,
    axelarHasSource:
      axelar.sourceIds.has(BASE_SEPOLIA_CORRIDOR.axelarId) ||
      axelar.sourceChainIds.has(String(BASE_SEPOLIA_CORRIDOR.chainId)),
    // Never true this slice: no live quote, no new write rails.
    liveQuote: false,
    signedTxWired: false,
  });

  const buyEnabledCount = sources.filter((r) => r.ok && r.result === "PASS").length;
  // Buy remains fail-closed until a live Squid USDC→RLUSD quote and depth smoke pass.
  const squidQuoteLive = false;
  const settleReady = false; // catalog PASS != Squid quote; Aggregated* settle fail-closed
  const swapReady = true; // local rail is independent; it never enables Aggregated* Buy
  const buyEnabled = false;
  // settleReady / buyEnabled only on live PASS that lands XRP (or proven convert→XRP). swapReady ≠ buyEnabled.
  const hopFamilies: HopFamily[] = [
    {
      id: "A",
      label: "A — Squid Intents USDC→RLUSD",
      status: "blocked",
      legs: [
        "USDC",
        "RLUSD ETH",
        "RLUSD xrpl-evm",
        "XRP EVM",
        "market /s",
      ],
      detail:
        "PATH_AB_HOP_PROBE: RLUSD UNSUPPORTED (Axelar ITS 0 RLUSD; Squid no 1449000). Kernel: never Market/V2 with USDC/RLUSD. Family A blocked.",
    },
    {
      id: "B",
      label: "B — Native RLUSD peers",
      status: axelar.hasXrpOnDest ? "partial" : "blocked",
      legs: ["USDC", "XRP other chains", "native XRP 1449000", "market /s"],
      detail: axelar.hasXrpOnDest
        ? "PATH_AB: ITS XRP on testnet is xrpl ↔ xrpl-evm ONLY (not eth/base sepolia). Must land native XRP on 1449000. Catalog PARTIAL ≠ buyEnabled. E2E USDC→XRP PASS required."
        : "PATH_AB: XRP not on ITS xrpl-evm — blocked until catalog + native-XRP land PASS.",
    },
  ];

  const path: AggregatedPath = {
    kind: "aggregated-usdc-to-rlusd",
    hops: [
      {
        id: "source-usdc",
        label: "USDC on source EVM",
        status: "planned",
        detail:
          "Base Sepolia first corridor — spend USDC on source; not hold-USDC-on-dest. Arb / RH / HL deferred until Base PASS.",
      },
      {
        id: "aggregator-settle",
        label: "Squid quote: USDC → RLUSD (mainnet 1440000 policy)",
        status: settleReady ? "ready" : "blocked",
        detail: settleReady
          ? "Live Squid quote lands RLUSD on mainnet 1440000."
          : "No live Squid quote/depth smoke; mainnet 1440000 remains policy-only and testnet 1449000 Buy is fail-closed.",
      },
      {
        id: "swap-market",
        label: "RLUSD destination policy (1440000)",
        status: "blocked",
        detail:
          "Preferred Aggregated* destination; testnet 1449000 is not a substitute for mainnet 1440000.",
      },
    ],
    hopFamilies,
    buyEnabled,
    settleReady,
    swapReady,
    preferredSettleAsset: "rlusd",
    squidQuoteLive,
    mainnetTargetChainId: MAINNET_DEST,
    axelarItsOnDest: {
      xrp: axelar.hasXrpOnDest,
      rlusd: axelar.hasRlusdOnDest,
      usdc: axelar.hasUsdcOnDest,
      symbols: axelar.itsSymbolsOnDestList,
    },
  };

  return {
    destChainId: DEST,
    destLabel: "XRPL EVM Testnet",
    faucet: FAUCET_URL,
    note:
      "Base Sepolia is the first inbound corridor: USDC → RLUSD → XRPL EVM 1449000. Live quote + depth smoke is required before Buy. Fail-closed; display RLUSD only. Arb / RH / HL deferred until Base PASS.",
    anyPass: buyEnabledCount > 0,
    buyEnabledCount,
    corridor,
    path,
    providers,
    squid: {
      queried: true,
      integrator: integrator === "test" ? "test (public probe)" : "env",
      chainCount: squid.ok ? squid.chainCount : undefined,
      hasDest: squid.hasDest,
      notedMainnetXrplEvm:
        "Squid-first policy target is XRPL EVM 1440000 for USDC→RLUSD. Testnet 1449000 remains fail-closed until a live quote is proven.",
    },
    sources,
    base: byKey.base,
    hyperliquid: byKey.hyperliquid,
    robinhood: byKey.robinhood,
    ethereumSepolia: byKey.ethereumSepolia,
    arbitrumSepolia: byKey.arbitrumSepolia,
    optimismSepolia: byKey.optimismSepolia,
    polygonAmoy: byKey.polygonAmoy,
    avalancheFuji: byKey.avalancheFuji,
    bnbTestnet: byKey.bnbTestnet,
    lineaSepolia: byKey.lineaSepolia,
  };
}

export async function GET() {
  const body = await buildProbe();
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  let dest: string | undefined;
  try {
    const j = (await req.json()) as { dest?: string };
    dest = j.dest;
  } catch {
    /* empty body ok */
  }
  const body = await buildProbe();
  return NextResponse.json(
    { ...body, dest: dest || null },
    { headers: { "Cache-Control": "no-store" } }
  );
}
