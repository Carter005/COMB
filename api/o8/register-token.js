import { isAddress } from "viem";
import { allowMethod, requireAdmin, supabaseRequest } from "../../lib/supabase-server.js";

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["POST", "DELETE"])) return;
  if (!requireAdmin(request, response)) return;

  if (request.method === "DELETE") {
    try {
      const result = await supabaseRequest("/rpc/o8_clear_pons_token", { method: "POST", body: "{}" });
      response.setHeader("Cache-Control", "no-store");
      return response.status(200).json(result);
    } catch {
      return response.status(503).json({ error: "token reset unavailable" });
    }
  }

  const tokenAddress = String(request.body?.tokenAddress || "").trim();
  const launchTxHash = String(request.body?.launchTxHash || "").trim() || null;
  if (!isAddress(tokenAddress)) return response.status(400).json({ error: "invalid token address" });
  if (launchTxHash && !/^0x[0-9a-fA-F]{64}$/.test(launchTxHash)) {
    return response.status(400).json({ error: "invalid launch transaction hash" });
  }

  try {
    const result = await supabaseRequest("/rpc/o8_register_pons_token", {
      method: "POST",
      body: JSON.stringify({ p_token_address: tokenAddress, p_launch_tx_hash: launchTxHash }),
    });
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json(result);
  } catch (error) {
    return response.status(503).json({ error: "token registration unavailable" });
  }
}
