import { supabaseRequest } from "./supabase-server.js";
import { parseChainSnapshot } from "./chain-parser.js";

const sourceId = "robinhood-mainnet";
const rpcUrl = "https://rpc.mainnet.chain.robinhood.com";
const expectedChainId = 4663;

function hexNumber(value) {
  if (!value || typeof value !== "string") return 0;
  return Number(BigInt(value));
}

function hexDecimal(value) {
  if (!value || typeof value !== "string") return "0";
  return BigInt(value).toString(10);
}

async function rpcRequest(method, params = [], timeoutMs = 10000) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const reply = await response.json();
  if (reply?.error) throw new Error(reply.error.message || `${method} failed`);
  return reply?.result;
}

export async function getRobinhoodHead() {
  return hexNumber(await rpcRequest("eth_blockNumber"));
}

export async function verifyRobinhoodChain() {
  const chainId = hexNumber(await rpcRequest("eth_chainId"));
  if (chainId !== expectedChainId) throw new Error(`unexpected chain ID ${chainId}`);
  return chainId;
}

async function persistRobinhoodBlock(block, startedAt) {
  return supabaseRequest("/rpc/o8_ingest_robinhood", {
    method: "POST",
    body: JSON.stringify({
      p_block_number: hexNumber(block.number),
      p_block_hash: block.hash,
      p_parent_hash: block.parentHash,
      p_timestamp: new Date(hexNumber(block.timestamp) * 1000).toISOString(),
      p_tx_count: Array.isArray(block.transactions) ? block.transactions.length : 0,
      p_gas_used: hexDecimal(block.gasUsed),
      p_gas_limit: hexDecimal(block.gasLimit),
      p_base_fee_wei: hexDecimal(block.baseFeePerGas),
      p_l1_block_number: hexNumber(block.l1BlockNumber),
      p_latency_ms: Date.now() - startedAt,
    }),
  });
}

export async function observeRobinhoodHead(blockNumber = "latest") {
  const startedAt = Date.now();
  const tag = typeof blockNumber === "number" ? `0x${blockNumber.toString(16)}` : blockNumber;
  const block = await rpcRequest("eth_getBlockByNumber", [tag, false]);
  if (!block?.hash || !block?.number) throw new Error(`block ${tag} payload is incomplete`);
  const result = await persistRobinhoodBlock(block, startedAt);
  return { refreshed: true, ...result };
}

export async function ingestRobinhoodBlock(blockNumber = "latest", options = {}) {
  const startedAt = Date.now();
  const tag = typeof blockNumber === "number" ? `0x${blockNumber.toString(16)}` : blockNumber;
  try {
    const [block, receiptsReply] = await Promise.all([
      rpcRequest("eth_getBlockByNumber", [tag, true]),
      rpcRequest("eth_getBlockReceipts", [tag]),
    ]);
    if (!block?.hash || !block?.number) throw new Error(`block ${tag} payload is incomplete`);
    const receipts = Array.isArray(receiptsReply) ? receiptsReply : [];
    const targetRows = await supabaseRequest("/o8_token_targets?id=eq.o8&select=token_address,pool_address,status&limit=1");
    const storedTarget = targetRows?.[0];
    const target = storedTarget?.token_address && ["CURVE_ACTIVE", "GRADUATED"].includes(storedTarget.status)
      ? {
        tokenAddress: storedTarget.token_address,
        poolAddress: storedTarget.pool_address,
        status: storedTarget.status,
      }
      : null;
    const snapshot = parseChainSnapshot(block, receipts, target);
    if (options.targetOnly) {
      const targetAnalysis = snapshot.target ? await supabaseRequest("/rpc/o8_ingest_target_snapshot", {
        method: "POST",
        body: JSON.stringify({ p_snapshot: snapshot }),
      }) : null;
      return { refreshed: true, targetOnly: true, blockNumber: hexNumber(block.number), analysis: targetAnalysis };
    }
    const result = await persistRobinhoodBlock(block, startedAt);
    const analysis = (result.changed || options.analyzeSeen) ? await Promise.all([
      supabaseRequest("/rpc/o8_ingest_chain_snapshot", {
        method: "POST",
        body: JSON.stringify({ p_snapshot: snapshot }),
      }),
      snapshot.target ? supabaseRequest("/rpc/o8_ingest_target_snapshot", {
        method: "POST",
        body: JSON.stringify({ p_snapshot: snapshot }),
      }) : Promise.resolve(null),
    ]) : null;
    return { refreshed: true, ...result, analysis };
  } catch (error) {
    await supabaseRequest("/rpc/o8_mark_source_degraded", {
      method: "POST",
      body: JSON.stringify({ p_source_id: sourceId, p_reason: error.message }),
    }).catch(() => null);
    throw error;
  }
}

export async function refreshRobinhoodChain() {
  const claimed = await supabaseRequest("/rpc/o8_claim_source_refresh", {
    method: "POST",
    body: JSON.stringify({ p_source_id: sourceId }),
  });
  if (!claimed) return { refreshed: false, reason: "refresh locked" };

  try {
    await verifyRobinhoodChain();
    return await ingestRobinhoodBlock("latest");
  } catch (error) {
    await supabaseRequest("/rpc/o8_mark_source_degraded", {
      method: "POST",
      body: JSON.stringify({ p_source_id: sourceId, p_reason: error.message }),
    }).catch(() => null);
    throw error;
  }
}
