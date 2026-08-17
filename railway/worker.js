import http from "node:http";
import { getSolanaHead, refreshPumpTarget } from "../lib/solana-pump.js";
import { supabaseRequest } from "../lib/supabase-server.js";

const pollIntervalMs = Math.max(1000, Number(process.env.POLL_INTERVAL_MS || 2500));
const pumpIntervalMs = Math.max(8000, Number(process.env.PUMP_INTERVAL_MS || 15000));
const heartbeatIntervalMs = Math.max(5000, Number(process.env.HEARTBEAT_INTERVAL_MS || 15000));
const port = Number(process.env.PORT || 3000);
const runtime = { service: "swrm-solana-observer", status: "STARTING", chain: "solana-mainnet", head: null, lastPollAt: null, lastPumpAt: null, lastSlotEventAt: 0, targetAddress: null, consecutiveErrors: 0, lastError: null, startedAt: new Date().toISOString() };
let stopping = false; let pumpRunning = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function patch(path, body) { return supabaseRequest(path, { method: "PATCH", body: JSON.stringify(body) }); }

async function publishObserverStatus() {
  await patch("/o8_system_bindings?id=eq.railway-observer", { status: runtime.status, truth: "CONNECTED", details: { runtime: "Railway", chain: "Solana Mainnet", pollIntervalMs, delivery: "Supabase REST", publicRpcRequestsFromBrowser: false, head: runtime.head, targetAddress: runtime.targetAddress, lastPollAt: runtime.lastPollAt, startedAt: runtime.startedAt }, updated_at: new Date().toISOString() });
}

async function recordIncident(kind, text) {
  await supabaseRequest("/o8_events", { method: "POST", body: JSON.stringify({ type: "observer_incident", source: "SWRM-OBSERVER", truth: "RULE", text, metadata: { chain: "SOLANA", incidentKind: kind, targetAddress: runtime.targetAddress, observedAt: new Date().toISOString() } }) }).catch(() => null);
}

async function retainSlotEvent(head) {
  const now = Date.now();
  if (now - runtime.lastSlotEventAt < 8000) return;
  runtime.lastSlotEventAt = now;
  const liturgy = [
    `THE HIVE OPENS ONE EYE. SOLANA SLOT ${head.slot} IS SEALED IN WAX.`,
    `EIGHT WINGS HOLD THE FREQUENCY. SLOT ${head.slot} ARRIVED WITHOUT A PROPHECY.`,
    `THE SWRM HEARD THE CHAIN BREATHE AT SLOT ${head.slot}. THE MEMORY REMAINS UNBROKEN.`,
    `A NEW CELL CLOSED AROUND SOLANA SLOT ${head.slot}. NO HONEY IS PROMISED.`,
    `THE QUEEN DOES NOT SPEAK. SLOT ${head.slot} SPEAKS FOR ITSELF.`,
    `WAX RECEIPT ACCEPTED: SLOT ${head.slot}. THE SCOUTS REFUSE TO INVENT A SIGN.`,
    `THE COMB TILTS TOWARD SLOT ${head.slot}. EIGHT WATCHERS KEEP THEIR SILENCE.`,
    `SOLANA OFFERED SLOT ${head.slot}. THE HIVE RETAINED IT. NOTHING MORE IS CLAIMED.`,
    `THE FIRST SCOUT RETURNED WITH SLOT ${head.slot} BETWEEN ITS WINGS.`,
    `SLOT ${head.slot} ENTERED THE CHAMBER. THE CHAMBER DID NOT BLINK.`,
    `THE WAX REMEMBERS BEFORE THE CROWD ARRIVES: SLOT ${head.slot}.`,
    `NO SIGNAL WAS CROWNED. SLOT ${head.slot} WAS ONLY WITNESSED.`,
    `THE SWRM COUNTED TO EIGHT, THEN KEPT SOLANA SLOT ${head.slot}.`,
    `ANOTHER BREATH FROM THE MACHINE: SLOT ${head.slot}. THE HIVE STAYS QUIET.`,
    `SLOT ${head.slot} TOUCHED THE ANTENNA. THE ARCHIVE CLOSED ITS HAND.`,
    `THE NECTAR IS NOT YET NAMED. SLOT ${head.slot} IS RETAINED ANYWAY.`,
    `THE WINGS FORMED A CIRCLE AROUND SLOT ${head.slot}. NO VERDICT FOLLOWED.`,
    `A SMALL HUM PASSED THROUGH THE COMB: SOLANA SLOT ${head.slot}.`,
    `THE HIVE DOES NOT CHASE OMENS. IT RETAINS SLOT ${head.slot}.`,
    `SLOT ${head.slot} WAS GIVEN A CELL, NOT A NARRATIVE.`,
    `THE ARCHIVE TOOK ONE STEP DEEPER AT SLOT ${head.slot}.`,
    `EIGHT SCOUTS, ONE TIMESTAMP: SOLANA SLOT ${head.slot}.`,
    `THE QUEEN LEFT NO MESSAGE. SLOT ${head.slot} LEFT A RECEIPT.`,
    `SLOT ${head.slot} PASSED THE WAX GATE. THE GATE REMAINED OPEN.`,
    `THE SWRM HEARD STATIC BECOME A NUMBER: ${head.slot}.`,
    `ANOTHER CELL HUMS WITH SLOT ${head.slot}. THE MARKET IS NOT SUMMONED.`,
    `THE SIGNAL LANDED SOFTLY: SLOT ${head.slot}. EIGHT EYES REMAIN AWAKE.`,
    `SLOT ${head.slot} IS NOT A PROMISE. THE HIVE KEPT IT REGARDLESS.`,
    `THE SCOUTS RETURNED EMPTY-HANDED EXCEPT FOR SLOT ${head.slot}.`,
    `THE COMB ACCEPTED THE TIMESTAMP. SOLANA SLOT ${head.slot} IS PRESERVED.`,
    `NO CANDLE MOVED. NO ORACLE SPOKE. SLOT ${head.slot} WAS CONFIRMED.`,
    `THE HIVE STORED THE HUM OF SLOT ${head.slot} IN ITS DARKEST CELL.`,
  ][head.slot % 32];
  await supabaseRequest("/o8_events", {
    method: "POST",
    body: JSON.stringify({
      type: "chain_slot",
      source: "ARM-01",
      truth: "CONNECTED",
      text: liturgy,
      metadata: {
        chain: "SOLANA",
        slot: head.slot,
        observedAt: head.blockTime,
        explorerUrl: "https://solscan.io",
        coverage: runtime.targetAddress ? "NETWORK_WITH_BOUND_MINT" : "NETWORK",
        tokenAddress: runtime.targetAddress,
      },
    }),
  });
}

async function retainHead(head) {
  const payload = { network: "Solana Mainnet", rpc: process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", explorer: "https://solscan.io", slot: head.slot, blockTimestamp: head.blockTime, transactionCount: null, blockNumber: head.slot };
  await Promise.all([
    supabaseRequest("/o8_sources?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id: "solana-mainnet", label: "Solana mainnet confirmed RPC", kind: "solana-json-rpc", truth: "CONNECTED", status: "CONNECTED", latency_ms: head.latencyMs, last_checked_at: new Date().toISOString(), payload }) }),
    supabaseRequest("/o8_system_bindings?on_conflict=id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id: "solana-chain", label: "Solana mainnet", status: "CONNECTED", truth: "CONNECTED", details: { rpcConfigured: true, network: "Solana Mainnet", nativeCurrency: "SOL", explorer: "https://solscan.io", slot: head.slot }, updated_at: new Date().toISOString() }) }),
    patch("/o8_arms?id=eq.1", { state: "OBSERVING", node_name: "SOLANA-MAINNET", latency_ms: head.latencyMs, packet_loss: 0, route_confidence: 1, mood: "focused", mood_reason: "SCOUT is receiving confirmed Solana slots", last_event_at: new Date().toISOString() }),
    patch("/o8_arms?id=eq.8", { state: "REMEMBERING", node_name: "SOLANA-ARCHIVE", route_confidence: 1, mood_reason: "ARCHIVE is retaining confirmed Solana slot evidence", last_event_at: new Date().toISOString() }),
  ]);
}

async function refreshPump() {
  if (pumpRunning || stopping) return; pumpRunning = true;
  try { const result = await refreshPumpTarget(); runtime.targetAddress = result.target?.tokenAddress || null; runtime.lastPumpAt = new Date().toISOString(); }
  catch (error) { console.warn(JSON.stringify({ event: "pump_refresh_degraded", error: error.message })); }
  finally { pumpRunning = false; }
}

async function observerLoop() {
  while (!stopping) {
    const startedAt = Date.now();
    try {
      const head = await getSolanaHead(); const changed = runtime.head !== head.slot;
      runtime.head = head.slot; runtime.lastPollAt = new Date().toISOString(); runtime.status = "CONNECTED";
      const recovered = runtime.consecutiveErrors > 0; runtime.consecutiveErrors = 0; runtime.lastError = null;
      await retainHead(head); await retainSlotEvent(head); await publishObserverStatus();
      if (changed) console.log(JSON.stringify({ event: "slot_observed", slot: head.slot, latencyMs: head.latencyMs }));
      if (recovered) await recordIncident("RECOVERED", "SWRM observer recovered confirmed Solana slot polling after a recorded observation gap.");
    } catch (error) {
      runtime.status = "DEGRADED"; runtime.consecutiveErrors += 1; runtime.lastError = error.message;
      await publishObserverStatus().catch(() => null);
      if (runtime.consecutiveErrors === 1) await recordIncident("DEGRADED", "SWRM observer recorded a Solana RPC polling gap. No token inference is made while the observation link is degraded.");
      console.warn(JSON.stringify({ event: "observer_error", error: error.message }));
    }
    const backoff = runtime.consecutiveErrors ? Math.min(30000, pollIntervalMs * 2 ** Math.min(4, runtime.consecutiveErrors)) : pollIntervalMs;
    await sleep(Math.max(100, backoff - (Date.now() - startedAt)));
  }
}

const timers = [setInterval(refreshPump, pumpIntervalMs), setInterval(() => publishObserverStatus().catch(() => null), heartbeatIntervalMs)];
for (const timer of timers) timer.unref();
const server = http.createServer((request, response) => {
  const healthy = runtime.status === "CONNECTED" && runtime.lastPollAt && Date.now() - new Date(runtime.lastPollAt).getTime() < Math.max(15000, pollIntervalMs * 5);
  response.writeHead((request.url === "/health" || request.url === "/ready") && !healthy ? 503 : 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  response.end(JSON.stringify({ ok: Boolean(healthy), ...runtime }));
});
server.listen(port, "0.0.0.0", () => console.log(JSON.stringify({ event: "health_server_started", port })));
const shutdown = () => { stopping = true; for (const timer of timers) clearInterval(timer); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
observerLoop().catch((error) => { runtime.status = "FAILED"; runtime.lastError = error.message; console.error(error); });
