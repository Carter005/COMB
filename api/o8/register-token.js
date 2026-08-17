import { allowMethod, requireAdmin, supabaseRequest } from "../../lib/supabase-server.js";
import { isSolanaAddress, isSolanaSignature, inspectMint } from "../../lib/solana-pump.js";

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
    if (launchTxHash && !isSolanaSignature(launchTxHash)) return response.status(400).json({ error: "invalid Solana launch signature" });
    // Admin binding is intentionally durable even when a public RPC is temporarily rate-limited.
    // Railway will promote VERIFYING_MINT to PUMP_ACTIVE after it confirms an SPL mint.
    const mint = await inspectMint(tokenAddress).catch(() => null); const updatedAt = new Date().toISOString();
    const status = mint ? "PUMP_ACTIVE" : "VERIFYING_MINT";
    const verification = mint ? "SPL_MINT_CONFIRMED_PUMP_ORIGIN_UNVERIFIED" : "MINT_PENDING_RPC_CONFIRMATION";
    await Promise.all([
      supabaseRequest("/o8_token_targets?id=eq.o8", { method: "PATCH", body: JSON.stringify({ platform: "PUMP.FUN", symbol: "SWRM", token_address: tokenAddress, launch_tx_hash: launchTxHash || mint?.firstObservedSignature || null, launch_block: mint?.firstObservedSlot || null, total_supply: mint?.supplyRaw || null, status, metadata: { chain: "SOLANA", launchpad: "PUMP.FUN", mintProgram: mint?.owner || null, decimals: mint?.decimals ?? null, supplyRaw: mint?.supplyRaw || null, verification, explorer: `https://solscan.io/token/${tokenAddress}` }, updated_at: updatedAt }) }),
      supabaseRequest("/o8_system_bindings?id=eq.o8-token", { method: "PATCH", body: JSON.stringify({ status, truth: "CONNECTED", details: { symbol: "SWRM", contractAddress: tokenAddress, launchpad: "PUMP.FUN", stage: status, verification, explorer: `https://solscan.io/token/${tokenAddress}` }, updated_at: updatedAt }) }),
      supabaseRequest("/o8_system_bindings?id=eq.pump-fun", { method: "PATCH", body: JSON.stringify({ status: mint ? "PUMP_UNVERIFIED" : "VERIFYING_MINT", truth: "CONNECTED", details: { platform: "PUMP.FUN", targetMint: tokenAddress, verification }, updated_at: updatedAt }) }),
    ]);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ registered: true, tokenAddress, status, verification });
  } catch (error) {
    return response.status(503).json({ error: error.message || "token registration unavailable" });
  }
}
