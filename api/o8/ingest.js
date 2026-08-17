import { allowMethod, supabaseRequest } from "../../lib/supabase-server.js";
import { refreshRobinhoodChain } from "../../lib/robinhood-chain.js";
import { refreshPonsLifecycle } from "../../lib/pons-launchpad.js";

export default async function handler(request, response) {
  if (!allowMethod(request, response, ["GET", "POST"])) return;
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.authorization || "";
  if (!expected || authorization !== `Bearer ${expected}`) {
    return response.status(401).json({ error: "unauthorized" });
  }

  const [tick, chain, pons] = await Promise.allSettled([
    supabaseRequest("/rpc/o8_tick", { method: "POST", body: "{}" }),
    refreshRobinhoodChain(),
    refreshPonsLifecycle(),
  ]);
  response.setHeader("Cache-Control", "no-store");
  if (chain.status === "rejected") {
    return response.status(502).json({ ok: false, error: "chain ingestion failed" });
  }
  return response.status(200).json({
    ok: true,
    chain: chain.value,
    pons: pons.status === "fulfilled" ? pons.value : { refreshed: false, error: "launchpad ingestion degraded" },
    tick: tick.status === "fulfilled" ? tick.value : null,
  });
}
