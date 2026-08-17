import {
  createPublicClient,
  formatEther,
  getAddress,
  http,
  isAddress,
  parseEther,
  parseAbi,
  zeroAddress,
} from "viem";
import { supabaseRequest } from "./supabase-server.js";

const sourceId = "pons-launchpad";
const rpcUrl = "https://rpc.mainnet.chain.robinhood.com";
const factoryAddress = "0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB";
const ponsV2FactoryAddress = "0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e";
const lockerAddress = "0x736D76699C26D0d966744cAe304C000d471f7F35";
const launchpadUrl = "https://www.ponsfamily.com/launchpad";
const exploreApi = "https://www.ponsfamily.com/api/pons-launches?explore=1&sort=newest&age=all&page=1&pageSize=50&graduatedPage=1&graduatedPageSize=50&includeGraduated=1&v=10";

const launchpadAbi = parseAbi([
  "function launchEnabled() view returns (bool)",
  "function launchFee() view returns (uint256)",
  "function owner() view returns (address)",
  "function locker() view returns (address)",
  "function getDexConfig(uint256 id) view returns ((string name, address factory, address positionManager, address swapRouter, uint24 poolFee, int24 tickSpacing, bool enabled) config)",
  "function getLaunchConfig(uint256 id) view returns ((address pairToken, uint256 graduationThreshold, int24 initialTick, uint256 supply, uint16 maxWalletBps, uint16 maxTxBps, uint32 restrictionBlocks, uint24 reservedFee, bool enabled, bool routerRequiresDeadline) config)",
  "function graduationStatus(address token) view returns (uint256 pairedPrincipal, uint256 threshold, bool graduated)",
  "function getLaunchedToken(address token) view returns ((address token, address deployer, address pairedToken, address positionManager, uint256 positionId, uint256 dexId, uint256 launchConfigId, uint256 restrictionsEndBlock, uint256 supply, bool isToken0, uint24 poolFee, bool exists, uint256 initialBuyAmount) launched)",
  "event TokenLaunched(address indexed token, address indexed deployer, address indexed dexFactory, address pairToken, address pool, uint256 dexId, uint256 launchConfigId, uint256 positionId, uint256 restrictionsEndBlock, uint256 initialBuyAmount)",
]);

const uniswapFactoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address pool)",
]);

const poolAbi = parseAbi([
  "function liquidity() view returns (uint128)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
]);

const tokenAbi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
]);

function serialize(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

function percentage(numerator, denominator) {
  if (!denominator || denominator <= 0n) return 0;
  const basisPoints = numerator * 10000n / denominator;
  return Math.min(100, Number(basisPoints) / 100);
}

async function fetchPonsCatalog() {
  const response = await fetch(exploreApi, {
    headers: { Accept: "application/json", "User-Agent": "O8-Lifecycle-Monitor/1.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Pons catalog HTTP ${response.status}`);
  return response.json();
}

function findCatalogItem(catalog, tokenAddress) {
  const normalized = tokenAddress.toLowerCase();
  const items = [...(catalog?.active?.items || []), ...(catalog?.graduated?.items || [])];
  return items.find((item) => item.token?.toLowerCase() === normalized) || null;
}

export async function refreshPonsLifecycle() {
  const claimed = await supabaseRequest("/rpc/o8_claim_source_refresh", {
    method: "POST",
    body: JSON.stringify({ p_source_id: sourceId }),
  });
  if (!claimed) return { refreshed: false, reason: "refresh locked" };

  const startedAt = Date.now();
  try {
    const publicClient = createPublicClient({
      transport: http(rpcUrl, {
        fetchOptions: { headers: { Origin: "https://ponsfamily.com" } },
        timeout: 10000,
        retryCount: 1,
      }),
    });
    const [launchEnabled, launchFee, owner, locker, dexConfig, launchConfig, blockNumber, targetRows, catalogResult] = await Promise.all([
      publicClient.readContract({ address: factoryAddress, abi: launchpadAbi, functionName: "launchEnabled" }),
      publicClient.readContract({ address: factoryAddress, abi: launchpadAbi, functionName: "launchFee" }),
      publicClient.readContract({ address: factoryAddress, abi: launchpadAbi, functionName: "owner" }),
      publicClient.readContract({ address: factoryAddress, abi: launchpadAbi, functionName: "locker" }),
      publicClient.readContract({ address: factoryAddress, abi: launchpadAbi, functionName: "getDexConfig", args: [0n] }),
      publicClient.readContract({ address: factoryAddress, abi: launchpadAbi, functionName: "getLaunchConfig", args: [0n] }),
      publicClient.getBlockNumber(),
      supabaseRequest("/o8_token_targets?id=eq.o8&select=*"),
      fetchPonsCatalog().catch(() => null),
    ]);

    const platform = {
      platform: "PONS",
      launchpadUrl,
      chainId: 4663,
      network: "Robinhood Chain Mainnet",
      factory: factoryAddress,
      locker: getAddress(locker),
      expectedLocker: lockerAddress,
      owner: getAddress(owner),
      launchEnabled,
      launchFeeWei: launchFee.toString(),
      launchFeeEth: formatEther(launchFee),
      dexId: 0,
      dexName: dexConfig.name,
      dexFactory: dexConfig.factory,
      positionManager: dexConfig.positionManager,
      swapRouter: dexConfig.swapRouter,
      poolFee: Number(dexConfig.poolFee),
      tickSpacing: Number(dexConfig.tickSpacing),
      dexEnabled: dexConfig.enabled,
      launchConfigId: 0,
      pairToken: launchConfig.pairToken,
      graduationThresholdWei: launchConfig.graduationThreshold.toString(),
      graduationThresholdEth: formatEther(launchConfig.graduationThreshold),
      initialTick: Number(launchConfig.initialTick),
      supply: launchConfig.supply.toString(),
      supplyTokens: formatEther(launchConfig.supply),
      maxWalletBps: Number(launchConfig.maxWalletBps),
      maxTxBps: Number(launchConfig.maxTxBps),
      restrictionBlocks: Number(launchConfig.restrictionBlocks),
      routerRequiresDeadline: launchConfig.routerRequiresDeadline,
      launchTotal: catalogResult?.launchTotal ?? null,
      activeTotal: catalogResult?.activeTotal ?? null,
      graduatedTotal: catalogResult?.graduatedTotal ?? null,
      observedBlock: Number(blockNumber),
      latencyMs: Date.now() - startedAt,
      verification: "ON_CHAIN_CONFIG_WITH_PUBLIC_CATALOG",
    };

    const storedTarget = targetRows[0];
    const tokenAddress = process.env.O8_TOKEN_ADDRESS || storedTarget?.token_address;
    if (!tokenAddress || !isAddress(tokenAddress)) {
      const result = await supabaseRequest("/rpc/o8_ingest_pons_launchpad", {
        method: "POST",
        body: JSON.stringify({ p_snapshot: { platform, target: null } }),
      });
      return { refreshed: true, platform, target: null, result };
    }

    const token = getAddress(tokenAddress);
    const catalogItem = findCatalogItem(catalogResult, token);
    if (catalogItem?.version === "v2") {
      const [name, symbol, totalSupply] = await Promise.all([
        publicClient.readContract({ address: token, abi: tokenAbi, functionName: "name" }),
        publicClient.readContract({ address: token, abi: tokenAbi, functionName: "symbol" }),
        publicClient.readContract({ address: token, abi: tokenAbi, functionName: "totalSupply" }),
      ]);
      const graduated = Boolean(catalogItem.graduated);
      const target = {
        status: graduated ? "GRADUATED" : "CURVE_ACTIVE",
        tokenAddress: token,
        name,
        symbol,
        deployer: catalogItem.deployer,
        pool: catalogItem.pool && catalogItem.pool !== zeroAddress ? catalogItem.pool : null,
        pairToken: null,
        launchTxHash: storedTarget?.launch_tx_hash || catalogItem.transactionHash || null,
        launchBlock: storedTarget?.launch_block || catalogItem.blockNumber || null,
        launchedAt: storedTarget?.launched_at || catalogItem.launchedAt || null,
        initialBuyWei: catalogItem.initialBuyWei || "0",
        totalSupply: totalSupply.toString(),
        dexId: "2",
        launchConfigId: "2",
        positionId: null,
        restrictionsEndBlock: null,
        poolFee: null,
        graduated,
        graduationProgressPct: Number(catalogItem.graduationProgressPct || 0),
        pairedPrincipalWei: catalogItem.pairedPrincipalEth ? parseEther(String(catalogItem.pairedPrincipalEth)).toString() : null,
        graduationThresholdWei: catalogItem.graduationThresholdEth ? parseEther(String(catalogItem.graduationThresholdEth)).toString() : null,
        poolLiquidity: null,
        poolSqrtPriceX96: "0",
        observedBlock: Number(blockNumber),
        priceUsd: catalogItem.priceUsd ?? null,
        marketCapUsd: catalogItem.marketCapUsd ?? null,
        metadata: {
          version: "v2",
          venue: catalogItem.venue || "curve",
          quoteAsset: catalogItem.quoteAsset || null,
          catalogMatched: true,
          evidence: ["PONS_V2_FACTORY", "PONS_PUBLIC_CATALOG", "TOKEN_CONTRACT"],
        },
      };
      const result = await supabaseRequest("/rpc/o8_ingest_pons_launchpad", {
        method: "POST",
        body: JSON.stringify({ p_snapshot: serialize({ platform: { ...platform, factory: catalogItem.factory || ponsV2FactoryAddress, version: "v2", verification: "PONS_V2_PUBLIC_CATALOG_WITH_CONTRACT" }, target }) }),
      });
      return { refreshed: true, platform, target, result };
    }
    const [launched, graduation, name, symbol, totalSupply] = await Promise.all([
      publicClient.readContract({ address: factoryAddress, abi: launchpadAbi, functionName: "getLaunchedToken", args: [token] }),
      publicClient.readContract({ address: factoryAddress, abi: launchpadAbi, functionName: "graduationStatus", args: [token] }),
      publicClient.readContract({ address: token, abi: tokenAbi, functionName: "name" }),
      publicClient.readContract({ address: token, abi: tokenAbi, functionName: "symbol" }),
      publicClient.readContract({ address: token, abi: tokenAbi, functionName: "totalSupply" }),
    ]);
    if (!launched.exists || launched.token.toLowerCase() !== token.toLowerCase()) {
      throw new Error("registered token is not a verified Pons launch");
    }

    const poolAddress = await publicClient.readContract({
      address: dexConfig.factory,
      abi: uniswapFactoryAbi,
      functionName: "getPool",
      args: [token, launched.pairedToken, launched.poolFee],
    });
    const hasPool = poolAddress !== zeroAddress;
    const [poolLiquidity, slot0] = hasPool ? await Promise.all([
      publicClient.readContract({ address: poolAddress, abi: poolAbi, functionName: "liquidity" }),
      publicClient.readContract({ address: poolAddress, abi: poolAbi, functionName: "slot0" }),
    ]) : [0n, null];
    const graduated = Boolean(graduation[2]);
    const progress = graduated ? 100 : percentage(graduation[0], graduation[1]);
    const target = {
      status: graduated ? "GRADUATED" : "CURVE_ACTIVE",
      tokenAddress: token,
      name,
      symbol,
      deployer: launched.deployer,
      pool: hasPool ? poolAddress : catalogItem?.pool || null,
      pairToken: launched.pairedToken,
      launchTxHash: storedTarget?.launch_tx_hash || catalogItem?.transactionHash || null,
      launchBlock: storedTarget?.launch_block || catalogItem?.blockNumber || null,
      launchedAt: storedTarget?.launched_at || catalogItem?.launchedAt || null,
      initialBuyWei: launched.initialBuyAmount.toString(),
      totalSupply: totalSupply.toString(),
      dexId: launched.dexId.toString(),
      launchConfigId: launched.launchConfigId.toString(),
      positionId: launched.positionId.toString(),
      restrictionsEndBlock: launched.restrictionsEndBlock.toString(),
      poolFee: Number(launched.poolFee),
      graduated,
      graduationProgressPct: progress,
      pairedPrincipalWei: graduation[0].toString(),
      graduationThresholdWei: graduation[1].toString(),
      poolLiquidity: poolLiquidity.toString(),
      poolSqrtPriceX96: slot0?.[0]?.toString() || "0",
      observedBlock: Number(blockNumber),
      priceUsd: catalogItem?.priceUsd ?? null,
      marketCapUsd: catalogItem?.marketCapUsd ?? null,
      metadata: {
        isToken0: launched.isToken0,
        positionManager: launched.positionManager,
        poolTick: slot0 ? Number(slot0[1]) : null,
        observedBlock: Number(blockNumber),
        catalogMatched: Boolean(catalogItem),
        evidence: ["PONS_FACTORY", "UNISWAP_V3_FACTORY", "TOKEN_CONTRACT", ...(catalogItem ? ["PONS_PUBLIC_CATALOG"] : [])],
      },
    };

    const result = await supabaseRequest("/rpc/o8_ingest_pons_launchpad", {
      method: "POST",
      body: JSON.stringify({ p_snapshot: serialize({ platform, target }) }),
    });
    return { refreshed: true, platform, target, result };
  } catch (error) {
    await supabaseRequest("/rpc/o8_mark_source_degraded", {
      method: "POST",
      body: JSON.stringify({ p_source_id: sourceId, p_reason: error.message }),
    }).catch(() => null);
    throw error;
  }
}
