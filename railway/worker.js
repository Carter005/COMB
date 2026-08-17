import http from "node:http";
import { getRobinhoodHead, ingestRobinhoodBlock, observeRobinhoodHead, verifyRobinhoodChain } from "../lib/robinhood-chain.js";
import { refreshPonsLifecycle } from "../lib/pons-launchpad.js";
import { supabaseRequest } from "../lib/supabase-server.js";

const pollIntervalMs = Math.max(500, Number(process.env.POLL_INTERVAL_MS || 1000));
const ponsIntervalMs = Math.max(5000, Number(process.env.PONS_INTERVAL_MS || 15000));
const heartbeatIntervalMs = Math.max(5000, Number(process.env.HEARTBEAT_INTERVAL_MS || 15000));
const analysisIntervalMs = Math.max(3000, Number(process.env.ANALYSIS_INTERVAL_MS || 5000));
const port = Number(process.env.PORT || 3000);

const runtime = {
  service: "o8-chain-observer",
  status: "STARTING",
  chainId: null,
  head: null,
  processedBlock: null,
  analyzedBlock: null,
  lastPollAt: null,
  lastBlockAt: null,
  lastPonsAt: null,
  targetAddress: null,
  targetBackfillBlock: null,
  consecutiveErrors: 0,
  lastError: null,
  lastIncidentKey: null,
  lastIncidentAt: 0,
  startedAt: new Date().toISOString(),
};

let stopping = false;
let ponsRunning = false;
let heartbeatRunning = false;
let analysisRunning = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readStoredBlock() {
  const rows = await supabaseRequest("/o8_sources?id=eq.robinhood-mainnet&select=payload&limit=1");
  const value = Number(rows?.[0]?.payload?.blockNumber);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

async function publishObserverStatus(status = runtime.status) {
  await supabaseRequest("/o8_system_bindings?id=eq.railway-observer", {
    method: "PATCH",
    body: JSON.stringify({
      status,
      truth: "CONNECTED",
      details: {
        runtime: "Railway",
        pollIntervalMs,
        delivery: "Supabase Realtime",
        publicRpcRequestsFromBrowser: false,
        chainId: runtime.chainId,
        head: runtime.head,
        processedBlock: runtime.processedBlock,
        targetAddress: runtime.targetAddress,
        targetBackfillBlock: runtime.targetBackfillBlock,
        lastPollAt: runtime.lastPollAt,
        lastBlockAt: runtime.lastBlockAt,
        startedAt: runtime.startedAt,
      },
      updated_at: new Date().toISOString(),
    }),
  });
}

async function retainObserverIncident(kind, text) {
  const key = `${kind}:${text}`;
  const now = Date.now();
  if (runtime.lastIncidentKey === key && now - runtime.lastIncidentAt < 300000) return;
  runtime.lastIncidentKey = key;
  runtime.lastIncidentAt = now;
  try {
    await supabaseRequest("/o8_events", {
      method: "POST",
      body: JSON.stringify({
        type: "observer_incident",
        source: "COMB-OBSERVER",
        truth: "RULE",
        text,
        metadata: { tokenAddress: runtime.targetAddress, coverage: runtime.targetAddress ? "TARGET_SCOPED" : "NETWORK", incidentKind: kind, observedAt: new Date(now).toISOString() },
      }),
    });
  } catch (error) {
    console.warn(JSON.stringify({ event: "incident_retention_degraded", error: error.message }));
  }
}

async function processHead(head) {
  if (runtime.processedBlock === null) {
    const stored = await readStoredBlock();
    runtime.processedBlock = stored === null ? Math.max(0, head - 1) : Math.min(stored, head);
  }
  if (head <= runtime.processedBlock) return;
  const skipped = Math.max(0, head - runtime.processedBlock - 1);
  const result = await observeRobinhoodHead(head);
  runtime.processedBlock = head;
  runtime.lastBlockAt = new Date().toISOString();
  console.log(JSON.stringify({ event: "head_observed", block: head, changed: result.changed, skippedIntermediateHeads: skipped }));
}

async function refreshPonsJob() {
  if (ponsRunning || stopping) return;
  ponsRunning = true;
  try {
    const result = await refreshPonsLifecycle();
    runtime.lastPonsAt = new Date().toISOString();
    const nextTarget = result.target?.tokenAddress?.toLowerCase() || null;
    if (result.refreshed && !nextTarget) {
      runtime.targetAddress = null;
      runtime.targetBackfillBlock = null;
    } else if (runtime.targetAddress !== nextTarget) {
      const launchBlock = Number(result.target.launchBlock);
      const backfillBlock = Number.isSafeInteger(launchBlock) && launchBlock > 0 ? launchBlock : "latest";
      const backfill = await ingestRobinhoodBlock(backfillBlock, { targetOnly: true });
      runtime.targetAddress = nextTarget;
      runtime.targetBackfillBlock = backfill.blockNumber;
      console.log(JSON.stringify({ event: "target_backfilled", tokenAddress: nextTarget, block: backfill.blockNumber }));
    }
    console.log(JSON.stringify({ event: "pons_refreshed", refreshed: result.refreshed, status: result.target?.status || "AWAITING_LAUNCH" }));
  } catch (error) {
    console.warn(JSON.stringify({ event: "pons_degraded", error: error.message }));
  } finally {
    ponsRunning = false;
  }
}

async function heartbeatJob() {
  if (heartbeatRunning || stopping) return;
  heartbeatRunning = true;
  const results = await Promise.allSettled([
    supabaseRequest("/rpc/o8_tick", { method: "POST", body: "{}" }),
    publishObserverStatus("CONNECTED"),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.warn(JSON.stringify({ event: "heartbeat_degraded", error: result.reason.message }));
  }
  heartbeatRunning = false;
}

async function analysisJob() {
  if (analysisRunning || stopping || !runtime.head || runtime.head === runtime.analyzedBlock) return;
  analysisRunning = true;
  const block = runtime.head;
  try {
    await ingestRobinhoodBlock(block, { analyzeSeen: true });
    runtime.analyzedBlock = block;
    console.log(JSON.stringify({ event: "block_analyzed", block }));
  } catch (error) {
    console.warn(JSON.stringify({ event: "analysis_degraded", block, error: error.message }));
  } finally {
    analysisRunning = false;
  }
}

async function observerLoop() {
  runtime.chainId = await verifyRobinhoodChain();
  runtime.status = "CONNECTED";
  await publishObserverStatus("CONNECTED");
  console.log(JSON.stringify({ event: "observer_started", chainId: runtime.chainId, pollIntervalMs }));

  while (!stopping) {
    const cycleStarted = Date.now();
    try {
      const head = await getRobinhoodHead();
      runtime.head = head;
      runtime.lastPollAt = new Date().toISOString();
      await processHead(head);
      const recovered = runtime.consecutiveErrors > 0;
      runtime.status = "CONNECTED";
      runtime.consecutiveErrors = 0;
      runtime.lastError = null;
      if (recovered) await retainObserverIncident("RECOVERED", "COMB observer recovered verified Robinhood Chain head polling after a recorded observation gap.");
    } catch (error) {
      runtime.status = "DEGRADED";
      runtime.consecutiveErrors += 1;
      runtime.lastError = error.message;
      console.error(JSON.stringify({ event: "observer_error", errors: runtime.consecutiveErrors, error: error.message }));
      await retainObserverIncident("DEGRADED", "COMB observer recorded a Robinhood Chain polling gap. No market inference is made while the observation link is degraded.");
    }
    const elapsed = Date.now() - cycleStarted;
    const backoff = runtime.consecutiveErrors ? Math.min(15000, pollIntervalMs * (2 ** Math.min(4, runtime.consecutiveErrors))) : pollIntervalMs;
    await sleep(Math.max(50, backoff - elapsed));
  }
}

const maintenanceTimers = [
  setInterval(refreshPonsJob, ponsIntervalMs),
  setInterval(heartbeatJob, heartbeatIntervalMs),
  setInterval(analysisJob, analysisIntervalMs),
];
for (const timer of maintenanceTimers) timer.unref();

const server = http.createServer((request, response) => {
  const healthy = runtime.status === "CONNECTED" && runtime.lastPollAt
    && Date.now() - new Date(runtime.lastPollAt).getTime() < Math.max(10000, pollIntervalMs * 5);
  if (request.url === "/health" || request.url === "/ready") {
    response.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify({ ok: Boolean(healthy), ...runtime }));
    return;
  }
  response.writeHead(200, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ service: runtime.service, status: runtime.status }));
});

server.listen(port, "0.0.0.0", () => console.log(JSON.stringify({ event: "health_server_started", port })));

const shutdown = (signal) => {
  console.log(JSON.stringify({ event: "shutdown", signal }));
  stopping = true;
  for (const timer of maintenanceTimers) clearInterval(timer);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

observerLoop().catch((error) => {
  runtime.status = "FAILED";
  runtime.lastError = error.message;
  console.error(JSON.stringify({ event: "observer_fatal", error: error.message }));
  setTimeout(() => process.exit(1), 1000);
});
