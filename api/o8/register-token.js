import { allowMethod, requireAdmin, supabaseRequest } from "../../lib/supabase-server.js";
import { isSolanaAddress, inspectMint } from "../../lib/solana-pump.js";

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["POST", "DELETE"])) return;
  if (!requireAdmin(request, response)) return;
  try {
    if (request.method === "DELETE") {
      const updatedAt = new Date().toISOString();
      await Promise.all([
        supabaseRequest("/o8_token_targets?id=eq.o8", { method: "PATCH", body: JSON.stringify({ platform: "PUMP.FUN", symbol: "SWRM", token_name: null, token_address: null, launch_tx_hash: null, launch_block: null, launched_at: null, total_supply: null, status: "AWAITING_PUMP_CA", metadata: { chain: "SOLANA", launchpad: "PUMP.FUN", verification: "TARGET_MINT_REQUIRED" }, updated_at: updatedAt }) }),
        supabaseRequest("/o8_system_bindings?id=eq.o8-token", { method: "PATCH", body: JSON.stringify({ status: "AWAITING_PUMP_CA", details: { symbol: "SWRM", contractAddress: null, launchpad: "PUMP.FUN", stage: "AWAITING_PUMP_CA" }, updated_at: updatedAt }) }),
        supabaseRequest("/o8_system_bindings?id=eq.pump-fun", { method: "PATCH", body: JSON.stringify({ status: "AWAITING_PUMP_CA", details: { platform: "PUMP.FUN", verification: "TARGET_MINT_REQUIRED" }, updated_at: updatedAt }) }),
      ]);
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json({ cleared: true, status: "AWAITING_PUMP_CA" });
    }
    const tokenAddress = String(request.body?.tokenAddress || "").trim();
    const launchTxHash = String(request.body?.launchTxHash || "").trim() || null;
    if (!isSolanaAddress(tokenAddress)) return response.status(400).json({ error: "invalid Solana mint address" });
    if (launchTxHash && !isSolanaAddress(launchTxHash)) return response.status(400).json({ error: "invalid Solana launch signature" });
    const mint = await inspectMint(tokenAddress); const updatedAt = new Date().toISOString();
    const verification = "SPL_MINT_CONFIRMED_PUMP_ORIGIN_UNVERIFIED";
    await Promise.all([
      supabaseRequest("/o8_token_targets?id=eq.o8", { method: "PATCH", body: JSON.stringify({ platform: "PUMP.FUN", symbol: "SWRM", token_address: tokenAddress, launch_tx_hash: launchTxHash || mint.firstObservedSignature, launch_block: mint.firstObservedSlot, total_supply: mint.supplyRaw, status: "PUMP_ACTIVE", metadata: { chain: "SOLANA", launchpad: "PUMP.FUN", mintProgram: mint.owner, decimals: mint.decimals, supplyRaw: mint.supplyRaw, verification, explorer: `https://solscan.io/token/${tokenAddress}` }, updated_at: updatedAt }) }),
      supabaseRequest("/o8_system_bindings?id=eq.o8-token", { method: "PATCH", body: JSON.stringify({ status: "PUMP_ACTIVE", truth: "CONNECTED", details: { symbol: "SWRM", contractAddress: tokenAddress, launchpad: "PUMP.FUN", stage: "PUMP_ACTIVE", explorer: `https://solscan.io/token/${tokenAddress}` }, updated_at: updatedAt }) }),
      supabaseRequest("/o8_system_bindings?id=eq.pump-fun", { method: "PATCH", body: JSON.stringify({ status: "PUMP_UNVERIFIED", truth: "CONNECTED", details: { platform: "PUMP.FUN", targetMint: tokenAddress, verification }, updated_at: updatedAt }) }),
    ]);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ registered: true, tokenAddress, status: "PUMP_ACTIVE", verification });
  } catch (error) {
    return response.status(503).json({ error: error.message || "token registration unavailable" });
  }
}
