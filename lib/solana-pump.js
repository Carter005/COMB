import { supabaseRequest } from "./supabase-server.js";

const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const tokenProgram = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export function isSolanaAddress(value) {
  const address = String(value || "").trim();
  if (address.length < 32 || address.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(address)) return false;
  let bytes = [0];
  for (const character of address) {
    let carry = alphabet.indexOf(character);
    if (carry < 0) return false;
    for (let index = 0; index < bytes.length; index += 1) { carry += bytes[index] * 58; bytes[index] = carry & 255; carry >>= 8; }
    while (carry) { bytes.push(carry & 255); carry >>= 8; }
  }
  for (const character of address) { if (character === "1") bytes.push(0); else break; }
  return bytes.length === 32;
}

async function rpc(method, params = []) {
  const startedAt = Date.now();
  const response = await fetch(rpcUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) throw new Error(payload.error?.message || `Solana RPC HTTP ${response.status}`);
  return { result: payload.result, latencyMs: Date.now() - startedAt };
}

function readU64LE(base64, offset) {
  const buffer = Buffer.from(base64, "base64"); let value = 0n;
  for (let index = 7; index >= 0; index -= 1) value = (value << 8n) + BigInt(buffer[offset + index] || 0);
  return value.toString();
}

export async function getSolanaHead() {
  const { result: slot, latencyMs } = await rpc("getSlot", [{ commitment: "confirmed" }]);
  const { result: blockTime } = await rpc("getBlockTime", [slot]);
  return { slot: Number(slot), blockTime: blockTime ? new Date(blockTime * 1000).toISOString() : null, latencyMs };
}

export async function inspectMint(mint) {
  const [{ result: account }, { result: supply }, { result: signatures }] = await Promise.all([
    rpc("getAccountInfo", [mint, { encoding: "base64", commitment: "confirmed" }]), rpc("getTokenSupply", [mint, { commitment: "confirmed" }]), rpc("getSignaturesForAddress", [mint, { limit: 1, commitment: "confirmed" }]),
  ]);
  const value = account?.value;
  if (!value || value.owner !== tokenProgram || !Array.isArray(value.data)) throw new Error("address is not a confirmed SPL token mint");
  const rawData = value.data[0];
  return { mint, owner: value.owner, decimals: Buffer.from(rawData, "base64")[44], supplyRaw: supply?.value?.amount || readU64LE(rawData, 36), supplyUi: supply?.value?.uiAmountString || null, firstObservedSignature: signatures?.[0]?.signature || null, firstObservedSlot: signatures?.[0]?.slot || null };
}

export async function refreshPumpTarget() {
  const targets = await supabaseRequest("/o8_token_targets?id=eq.o8&select=token_address,launch_tx_hash");
  const target = targets?.[0];
  if (!target?.token_address) return { refreshed: true, target: null, status: "AWAITING_PUMP_CA" };
  // A legacy EVM target cannot be observed as a Solana mint. Reset only the active pointer;
  // historic events remain intact in their existing tables.
  if (!isSolanaAddress(target.token_address)) {
    await Promise.all([
      supabaseRequest("/o8_token_targets?id=eq.o8", { method: "PATCH", body: JSON.stringify({ platform: "PUMP.FUN", symbol: "SWRM", token_name: null, token_address: null, launch_tx_hash: null, launch_block: null, launched_at: null, status: "AWAITING_PUMP_CA", metadata: { chain: "SOLANA", launchpad: "PUMP.FUN", verification: "TARGET_MINT_REQUIRED" }, updated_at: new Date().toISOString() }) }),
      supabaseRequest("/o8_system_bindings?id=eq.o8-token", { method: "PATCH", body: JSON.stringify({ status: "AWAITING_PUMP_CA", details: { symbol: "SWRM", contractAddress: null, launchpad: "PUMP.FUN", stage: "AWAITING_PUMP_CA" }, updated_at: new Date().toISOString() }) }),
    ]);
    return { refreshed: true, target: null, status: "AWAITING_PUMP_CA" };
  }
  const mint = target.token_address; const data = await inspectMint(mint);
  const metadata = { chain: "SOLANA", launchpad: "PUMP.FUN", mintProgram: data.owner, decimals: data.decimals, supplyRaw: data.supplyRaw, supplyUi: data.supplyUi, verification: "SPL_MINT_CONFIRMED_PUMP_ORIGIN_UNVERIFIED", observedSignature: data.firstObservedSignature, observedSlot: data.firstObservedSlot, explorer: `https://solscan.io/token/${mint}` };
  await Promise.all([
    supabaseRequest("/o8_token_targets?id=eq.o8", { method: "PATCH", body: JSON.stringify({ platform: "PUMP.FUN", status: "PUMP_ACTIVE", total_supply: data.supplyRaw, launch_tx_hash: target.launch_tx_hash || data.firstObservedSignature, launch_block: data.firstObservedSlot, metadata, updated_at: new Date().toISOString() }) }),
    supabaseRequest("/o8_system_bindings?id=eq.o8-token", { method: "PATCH", body: JSON.stringify({ status: "PUMP_ACTIVE", truth: "CONNECTED", details: { symbol: "SWRM", contractAddress: mint, launchpad: "PUMP.FUN", stage: "PUMP_ACTIVE", verification: metadata.verification, explorer: metadata.explorer }, updated_at: new Date().toISOString() }) }),
  ]);
  return { refreshed: true, target: { tokenAddress: mint, ...data, status: "PUMP_ACTIVE" }, status: "PUMP_ACTIVE" };
}
