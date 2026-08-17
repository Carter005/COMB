import { allowMethod } from "../../lib/supabase-server.js";
import { getSolanaHead, refreshPumpTarget } from "../../lib/solana-pump.js";

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["GET", "POST"])) return;
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.authorization || "";
  if (!expected || authorization !== `Bearer ${expected}`) {
    return response.status(401).json({ error: "unauthorized" });
  }

  const [chain, pump] = await Promise.allSettled([getSolanaHead(), refreshPumpTarget()]);
  response.setHeader("Cache-Control", "no-store");
  if (chain.status === "rejected") {
    return response.status(502).json({ ok: false, error: "chain ingestion failed" });
  }
  return response.status(200).json({
    ok: true,
    chain: chain.value,
    pump: pump.status === "fulfilled" ? pump.value : { refreshed: false, error: "Pump target refresh degraded" },
  });
}
