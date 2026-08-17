import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Download, Radio, X } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

const realtimeUrl = import.meta.env.VITE_SUPABASE_URL;
const realtimeKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const realtimeClient = realtimeUrl && realtimeKey
  ? createClient(realtimeUrl, realtimeKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  : null;

const initialArms = [
  { id: "01", name: "SCOUT", role: "new forager observer", mood: "focused", state: "STANDBY" },
  { id: "02", name: "NECTAR", role: "liquidity interpreter", mood: "restless", state: "STANDBY" },
  { id: "03", name: "COMB", role: "contract structure analyst", mood: "guarded", state: "STANDBY" },
  { id: "04", name: "SWARM", role: "participant observer", mood: "curious", state: "STANDBY" },
  { id: "05", name: "WING", role: "route interpreter", mood: "tracking", state: "STANDBY" },
  { id: "06", name: "STING", role: "anomaly hunter", mood: "suspicious", state: "STANDBY" },
  { id: "07", name: "KEEPER", role: "reserve keeper", mood: "watchful", state: "STANDBY" },
  { id: "08", name: "ARCHIVE", role: "hive memory synthesizer", mood: "composed", state: "REMEMBERING" },
];

const initialFeed = [];

const SYSTEM_EVENT_TYPES = new Set(["system_heartbeat", "memory_sync", "agent_registry", "agent_voice_registry", "provider_connected"]);
const CHAIN_EVENT_TYPES = new Set(["chain_block", "token_launched", "token_graduated"]);

const LIFE_PHASES = [
  { code: "00", name: "EMPTY HIVE", directive: "await a verified COMB target" },
  { code: "01", name: "QUEEN EMERGED", directive: "verify origin and establish identity" },
  { code: "02", name: "FIRST FORAGE", directive: "bind eight scouts to one contract" },
  { code: "03", name: "SWARM FORMED", directive: "ingest verifiable chain evidence" },
  { code: "04", name: "HONEY RISING", directive: "observe the approach to graduation" },
  { code: "05", name: "OPEN HIVE", directive: "follow the migration into open liquidity" },
  { code: "06", name: "MIGRATION", directive: "compare new behavior with retained history" },
  { code: "07", name: "WINTER ARCHIVE", directive: "preserve the hive record after observation" },
];

const SCOUT_DOCTRINES = {
  SCOUT: ["I record the first trace. I do not infer intent.", "A first appearance does not establish a founder, a buyer, or a motive.", "A verified CA and its first target-scoped transfer or deployment record."],
  NECTAR: ["Flow is not conviction. Liquidity is not loyalty.", "A transfer count does not establish price direction, demand, or a reserve.", "A verified pool and target-scoped liquidity evidence over time."],
  COMB: ["A hive is defined by its cells, not its noise.", "Network activity cannot describe a contract that has not been bound.", "A verified contract, bytecode, and privileged-call evidence."],
  SWARM: ["A crowd can form before a community does.", "Observed addresses are not a holder count or a social graph.", "Repeated target-scoped address interactions with retained evidence."],
  WING: ["Where value travels matters more than where it arrives.", "A route is not a buy, sell, migration, or economic intention by itself.", "A verified target and repeated route patterns across its own transfers."],
  STING: ["Every clean signal deserves an adversarial reading.", "Absence of evidence is not evidence of safety.", "A verified anomaly, privileged call, or abnormal target concentration."],
  KEEPER: ["What remains after attention leaves is the reserve.", "A short sample cannot establish durability or a baseline.", "A stable target history long enough to retain a comparison baseline."],
  ARCHIVE: ["Memory does not resolve disagreement. It preserves it.", "A record is not a verdict, and silence is not consensus.", "A verified lifecycle transition with materially different Scout readings."],
};

function resolveLifePhase(token, tokenBindingStatus, storyState) {
  const status = String(token?.status || tokenBindingStatus || "").toUpperCase();
  const progress = Number(token?.graduationProgressPct);
  if (status === "ARCHIVED") return LIFE_PHASES[7];
  if (storyState?.baselineReadyAt || status === "ADAPTING") return LIFE_PHASES[6];
  if (token?.graduated || status === "GRADUATED") return LIFE_PHASES[5];
  if (Number.isFinite(progress) && progress >= 75) return LIFE_PHASES[4];
  if (["CURVE_ACTIVE", "LIVE", "FEEDING"].includes(status)) return LIFE_PHASES[3];
  if (token?.tokenAddress) return LIFE_PHASES[2];
  if (["VERIFYING", "AWAKENED"].includes(status)) return LIFE_PHASES[1];
  return LIFE_PHASES[0];
}

function Panel({ title, className = "", children }) {
  return (
    <section className={`panel ${className}`} aria-label={title}>
      <div className="panel-label">{title}</div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone = "" }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function formatClock(value) {
  return String(value).padStart(2, "0");
}

function shortAddress(value) {
  return value ? `${value.slice(0, 7)}...${value.slice(-5)}` : "UNBOUND";
}

function sourceFromRow(row) {
  return {
    id: row.id,
    label: row.label,
    kind: row.kind,
    truth: row.truth,
    status: row.status,
    latencyMs: row.latency_ms,
    lastCheckedAt: row.last_checked_at,
    payload: row.payload,
  };
}

function specimenFromRow(row) {
  return {
    id: row.id,
    status: row.status,
    observerHeartbeats: row.tick_count,
    updatedAt: row.updated_at,
  };
}

function armFromRow(row) {
  return {
    id: row.id,
    agentName: row.agent_name,
    role: row.role,
    domain: row.domain,
    temperament: row.temperament,
    mood: row.mood,
    moodReason: row.mood_reason,
    voice: row.voice,
    state: row.state,
    nodeName: row.node_name,
    latencyMs: row.latency_ms,
    packetLoss: Number(row.packet_loss),
    routeConfidence: Number(row.route_confidence),
  };
}

function tokenFromRow(row) {
  return {
    id: row.id,
    platform: row.platform,
    status: row.status,
    name: row.token_name,
    symbol: row.symbol,
    tokenAddress: row.token_address,
    deployerAddress: row.deployer_address,
    poolAddress: row.pool_address,
    pairTokenAddress: row.pair_token_address,
    launchTxHash: row.launch_tx_hash,
    launchBlock: row.launch_block,
    launchedAt: row.launched_at,
    graduationProgressPct: row.graduation_progress === null ? null : Number(row.graduation_progress),
    pairedPrincipalWei: row.paired_principal_wei,
    graduationThresholdWei: row.graduation_threshold_wei,
    graduated: row.graduated,
    priceUsd: row.price_usd === null ? null : Number(row.price_usd),
    marketCapUsd: row.market_cap_usd === null ? null : Number(row.market_cap_usd),
    metadata: row.metadata,
    updatedAt: row.updated_at,
  };
}

function lifecycleFromRow(row) {
  return {
    id: row.id,
    targetAddress: row.target_address,
    phaseCode: row.phase_code,
    phaseName: row.phase_name,
    title: row.title,
    description: row.description,
    truth: row.truth,
    observedBlock: row.observed_block,
    evidence: row.evidence,
    ceremony: row.ceremony,
    occurredAt: row.occurred_at,
  };
}

function dissentFromRow(row) {
  return {
    id: row.id,
    targetAddress: row.target_address,
    phaseCode: row.phase_code,
    lifecycleEventId: row.lifecycle_event_id,
    truth: row.truth,
    summary: row.summary,
    positions: row.positions,
    evidence: row.evidence,
    occurredAt: row.occurred_at,
  };
}

function storyMilestoneFromRow(row) {
  return {
    id: row.id,
    targetAddress: row.target_address,
    eventKey: row.event_key,
    category: row.category,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    truth: row.truth,
    source: row.source,
    observedBlock: row.observed_block,
    evidence: row.evidence,
    occurredAt: row.occurred_at,
  };
}

function storyStateFromRow(row) {
  return {
    targetAddress: row.target_address,
    highProgressPct: Number(row.high_progress),
    lastProgressPct: row.last_progress === null ? null : Number(row.last_progress),
    lastProgressAt: row.last_progress_at,
    lastActivityAt: row.last_activity_at,
    lastActivityBlock: row.last_activity_block,
    observerHealth: row.observer_health,
    silenceState: row.silence_state,
    graduatedBlock: row.graduated_block,
    baseline: row.baseline,
    baselineSampleCount: row.baseline_sample_count,
    baselineReadyAt: row.baseline_ready_at,
    updatedAt: row.updated_at,
  };
}

function targetTraceFromRow(row) {
  return {
    targetAddress: row.target_address,
    blockNumber: row.block_number,
    targetStatus: row.target_status,
    transactionCount: Number(row.metrics?.transactionCount || 0),
    tokenTransferCount: Number(row.metrics?.tokenTransferCount || 0),
    poolEventCount: Number(row.metrics?.poolEventCount || 0),
    observedAt: row.observed_at,
  };
}

function feedRow(item) {
  const type = item.type || "unknown";
  const metadata = item.metadata || {};
  const layer = SYSTEM_EVENT_TYPES.has(type) || item.truth === "SYSTEM"
    ? "SYSTEM"
    : item.truth === "AI" || item.truth === "AGENT" || type === "agent_response"
      ? "AI"
      : CHAIN_EVENT_TYPES.has(type)
        ? "CHAIN"
        : "RULE";
  const scope = metadata.tokenAddress || metadata.coverage === "TARGET_SCOPED" ? "COMB TARGET" : "NETWORK";
  return {
    id: item.id,
    time: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(item.created_at || item.at)),
    source: item.source,
    truth: item.truth,
    text: item.text,
    type,
    metadata,
    layer,
    scope,
  };
}

function formatAge(seconds) {
  if (!Number.isFinite(seconds)) return "--";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

const SWIM_FRAMES = [
  { pose: 0, mantle: 1.02, recoil: 0.0, lean: -1 },
  { pose: 1, mantle: 1.07, recoil: 0.08, lean: 0 },
  { pose: 2, mantle: 1.0, recoil: 0.2, lean: 1 },
  { pose: 3, mantle: 0.89, recoil: 1.0, lean: 2 },
  { pose: 4, mantle: 0.94, recoil: 0.58, lean: 1 },
  { pose: 5, mantle: 1.0, recoil: 0.12, lean: -1 },
];

const ARM_SHAPES = [
  { root: 20, width: 2, points: [[64, 21], [52, 24], [41, 23], [31, 27], [19, 25], [9, 29]] },
  { root: 22, width: 1, points: [[65, 23], [55, 27], [43, 29], [34, 27], [24, 31], [14, 35], [7, 33]] },
  { root: 23, width: 2, points: [[63, 24], [53, 22], [45, 25], [36, 31], [27, 34], [19, 32], [13, 37]] },
  { root: 24, width: 1, points: [[66, 25], [57, 29], [47, 32], [38, 31], [29, 35], [22, 39]] },
  { root: 25, width: 2, points: [[64, 26], [54, 30], [46, 28], [37, 32], [28, 30], [20, 34], [11, 32]] },
  { root: 26, width: 1, points: [[66, 27], [58, 31], [50, 35], [42, 36], [35, 33], [29, 38]] },
  { root: 27, width: 2, points: [[65, 28], [56, 26], [47, 30], [39, 34], [31, 36], [24, 35], [18, 39]] },
  { root: 28, width: 1, points: [[67, 29], [59, 33], [51, 31], [44, 35], [38, 38], [32, 37]] },
];

function drawPixelLine(context, points, size = 1, value = 1) {
  context.fillStyle = value === 1 ? "#d8ded8" : "#8eb3a8";
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x0, y0] = points[index];
    const [x1, y1] = points[index + 1];
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let step = 0; step <= steps; step += 1) {
      const x = Math.round(x0 + ((x1 - x0) * step) / steps);
      const y = Math.round(y0 + ((y1 - y0) * step) / steps);
      context.fillRect(x, y, size, size);
    }
  }
}

function renderHiveFrame(frame) {
  const sprite = document.createElement("canvas");
  sprite.width = 108;
  sprite.height = 42;
  const context = sprite.getContext("2d");
  context.imageSmoothingEnabled = false;
  const drift = Math.round(Math.sin(frame.pose * 0.8) * 2);
  context.strokeStyle = "#e8e8e8";
  context.lineWidth = 1;
  const cells = [[18, 12], [34, 12], [50, 12], [26, 25], [42, 25], [58, 25], [74, 12], [90, 25]];
  cells.forEach(([cx, cy], index) => {
    const x = cx + (index % 2 ? drift : 0);
    context.beginPath();
    for (let point = 0; point < 6; point += 1) {
      const angle = Math.PI / 3 * point;
      const px = x + Math.round(Math.cos(angle) * 7);
      const py = cy + Math.round(Math.sin(angle) * 7);
      if (point === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath();
    context.stroke();
    if ((index + frame.pose) % 3 === 0) context.fillRect(x - 1, cy - 1, 2, 2);
  });
  context.fillStyle = "#e8e8e8";
  context.fillRect(42 + drift, 18, 24, 2);
  context.fillRect(48 + drift, 16, 12, 6);
  context.fillStyle = "#050505";
  context.fillRect(54 + drift, 17, 2, 2);

  return sprite;
}

function downloadMemoryCard(item) {
  const canvas = document.createElement("canvas");
  canvas.width = 1500;
  canvas.height = 900;
  const context = canvas.getContext("2d");
  context.fillStyle = "#050505";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#e8e8e8";
  context.lineWidth = 3;
  context.strokeRect(54, 54, 1392, 792);
  context.fillStyle = "#e8e8e8";
  context.font = "600 30px Cascadia Mono, monospace";
  context.fillText("COMB / HIVE MEMORY", 96, 120);
  context.font = "500 22px Cascadia Mono, monospace";
  context.fillText(`${item.layer} / ${item.source} / ${item.time}`, 96, 170);
  context.font = "600 46px Cascadia Mono, monospace";
  const words = String(item.text || "").split(/\s+/);
  let line = "";
  let y = 280;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > 1250 && line) { context.fillText(line, 96, y); line = word; y += 68; } else line = next;
  }
  if (line) context.fillText(line, 96, y);
  context.font = "500 20px Cascadia Mono, monospace";
  context.fillText("EVIDENCE BEFORE ACTION / ROBINHOOD CHAIN", 96, 786);
  const link = document.createElement("a");
  link.download = `comb-memory-${String(item.id).replace(/[^a-z0-9-]/gi, "-")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function hiveCellFromRow(row) {
  return {
    id: row.id,
    cellKey: row.cell_key,
    cellType: row.cell_type,
    status: row.status,
    title: row.title,
    description: row.description,
    truth: row.truth,
    sourceEventId: row.source_event_id,
    targetAddress: row.target_address,
    observedBlock: row.observed_block,
    evidence: row.evidence,
    createdAt: row.created_at,
  };
}

function HivePulse() {
  const canvasRef = useRef(null);
  const beeSprites = [
    ["....##..##....", "...###..###...", "..############", "..##.####.##..", "..############", "...########...", "....#....#...."],
    [".....#..#.....", "...##....##...", "..############", ".##..######..##", "..############", "...########...", "...#......#..."],
    ["...###..###...", "..####..####..", ".############.", ".##.##########", ".############.", "...########...", "....#....#...."],
    ["....##..##....", "...####.####..", "..############", "..###.#######.", "..############", "....######....", "...#......#..."],
    [".....##.##....", "...###..###...", "..############", "..##..####..##", "..############", "...########...", "....#....#...."],
    ["...##....##...", "..###....###..", ".############.", ".##..######..#", ".############.", "...########...", "...#......#..."],
    ["....###.###...", "...####.####..", "..############", "..##.######.##", "..############", "....######....", "....#....#...."],
    [".....##..##...", "...###..####..", "..############", "..###.#####.##", "..############", "...########...", "...#......#..."],
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let previous = performance.now();
    let animationId;
    const bees = Array.from({ length: 8 }, (_, index) => ({
      x: 0.12 + ((index * 0.113) % 0.72),
      y: 0.22 + ((index * 0.179) % 0.52),
      vx: (index % 2 ? -1 : 1) * (0.012 + (index % 3) * 0.004),
      vy: (index % 3 - 1) * 0.008,
      phase: index * 1.91,
      size: index % 3 === 0 ? 1.18 : 1,
      flip: index % 2 === 1,
    }));

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      const density = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.max(1, Math.round(width * density));
      canvas.height = Math.max(1, Math.round(height * density));
      context.setTransform(density, 0, 0, density, 0, 0);
      context.imageSmoothingEnabled = false;
    }

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    function draw(time) {
      const delta = Math.min((time - previous) / 1000, 0.04);
      previous = time;
      context.clearRect(0, 0, width, height);

      bees.forEach((bee, index) => {
        const drift = reduceMotion ? 0 : Math.sin(time * 0.0007 + bee.phase) * 0.00075;
        const cross = reduceMotion ? 0 : Math.cos(time * 0.00043 + bee.phase * 1.7) * 0.00055;
        bee.vx += (drift + cross) * delta * 8;
        bee.vy += (cross - drift) * delta * 8;
        const speed = Math.hypot(bee.vx, bee.vy) || 1;
        const maxSpeed = 0.024;
        if (speed > maxSpeed) {
          bee.vx = bee.vx / speed * maxSpeed;
          bee.vy = bee.vy / speed * maxSpeed;
        }
        if (!reduceMotion) {
          bee.x += bee.vx * delta * 4;
          bee.y += bee.vy * delta * 4;
        }
        if (bee.x < 0.08 || bee.x > 0.92) bee.vx *= -1;
        if (bee.y < 0.16 || bee.y > 0.84) bee.vy *= -1;
        bee.x = Math.max(0.08, Math.min(0.92, bee.x));
        bee.y = Math.max(0.16, Math.min(0.84, bee.y));

        const x = Math.round(bee.x * width);
        const y = Math.round(bee.y * height);
        const scale = Math.max(1.4, Math.min(2.3, width / 520)) * bee.size;
        const sprite = beeSprites[index];
        context.fillStyle = "#e8e8e8";
        sprite.forEach((row, rowIndex) => {
          [...(bee.flip ? row.split("").reverse() : row)].forEach((pixel, columnIndex) => {
            if (pixel === "#") context.fillRect(
              Math.round(x + (columnIndex - row.length / 2) * scale),
              Math.round(y + (rowIndex - sprite.length / 2) * scale),
              Math.max(1, Math.round(scale)),
              Math.max(1, Math.round(scale)),
            );
          });
        });
        if (index === 0) {
          context.fillStyle = "rgba(232, 232, 232, .36)";
          context.fillRect(x - 1, y + Math.round(5 * scale), 1, 1);
        }
      });

      if (!reduceMotion) animationId = requestAnimationFrame(draw);
    }

    animationId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="hive-pulse" aria-label="Animated COMB honeycomb evidence display" />;
}

function App() {
  const [now, setNow] = useState(new Date());
  const [feed, setFeed] = useState(initialFeed);
  const [remoteState, setRemoteState] = useState(null);
  const [backendStatus, setBackendStatus] = useState("CONNECTING");
  const [filter, setFilter] = useState("ALL");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [replyAgent, setReplyAgent] = useState(null);
  const [asking, setAsking] = useState(false);
  const [showDissent, setShowDissent] = useState(false);
  const [showCeremony, setShowCeremony] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedScout, setSelectedScout] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showProposal, setShowProposal] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [proposalQuestion, setProposalQuestion] = useState("");
  const [proposalStatus, setProposalStatus] = useState("");
  const sessionIdRef = useRef(null);
  const targetAddressRef = useRef(null);

  useEffect(() => {
    const existing = window.localStorage.getItem("o8-session-id");
    const sessionId = existing || window.crypto.randomUUID();
    window.localStorage.setItem("o8-session-id", sessionId);
    sessionIdRef.current = sessionId;
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const [stateResponse, feedResponse] = await Promise.all([
          fetch("/api/o8/state"),
          fetch("/api/o8/feed?limit=40"),
        ]);
        if (!stateResponse.ok || !feedResponse.ok) throw new Error("observation service unavailable");
        const state = await stateResponse.json();
        const feedData = await feedResponse.json();
        if (!active) return;
        targetAddressRef.current = state.token?.tokenAddress?.toLowerCase() || null;
        setRemoteState(state);
        setFeed(feedData.items.map(feedRow));
        // If realtime has already subscribed, keep the stronger LIVE state.
        // The initial REST response can otherwise overwrite it with CONNECTED.
        setBackendStatus((current) => current === "LIVE" ? current : "CONNECTED");
      } catch {
        if (active) setBackendStatus("DEGRADED");
      }
    }
    refresh();
    const interval = window.setInterval(refresh, 5000);
    if (!realtimeClient) {
      return () => { active = false; window.clearInterval(interval); };
    }

    const channel = realtimeClient.channel("o8-public-terminal")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "o8_sources" }, ({ new: row }) => {
        if (!active) return;
        setBackendStatus("LIVE");
        setRemoteState((current) => current ? {
          ...current,
          serverTime: new Date().toISOString(),
          sources: current.sources.some((source) => source.id === row.id)
            ? current.sources.map((source) => source.id === row.id ? sourceFromRow(row) : source)
            : [...current.sources, sourceFromRow(row)],
        } : current);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "o8_events" }, ({ new: row }) => {
        if (!active) return;
        setBackendStatus("LIVE");
        const activeTarget = targetAddressRef.current;
        const eventTarget = row.metadata?.tokenAddress?.toLowerCase() || null;
        if ((activeTarget && eventTarget !== activeTarget) || (!activeTarget && eventTarget)) return;
        const incoming = feedRow(row);
        setFeed((current) => [incoming, ...current.filter((item) => item.id !== incoming.id)].slice(0, 40));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "o8_specimen", filter: "id=eq.o8" }, ({ new: row }) => {
        if (!active) return;
        const next = specimenFromRow(row);
        setRemoteState((current) => current ? { ...current, specimen: next } : current);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "o8_arms" }, ({ new: row }) => {
        if (!active) return;
        setRemoteState((current) => current ? {
          ...current,
          arms: current.arms.map((arm) => Number(arm.id) === Number(row.id) ? armFromRow(row) : arm),
        } : current);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "o8_token_targets", filter: "id=eq.o8" }, ({ new: row }) => {
        if (!active) return;
        targetAddressRef.current = row.token_address?.toLowerCase() || null;
        setRemoteState((current) => current ? { ...current, token: tokenFromRow(row) } : current);
        fetch("/api/o8/feed?limit=40")
          .then((response) => response.ok ? response.json() : Promise.reject(new Error("feed refresh failed")))
          .then((data) => { if (active) setFeed(data.items.map(feedRow)); })
          .catch(() => null);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "o8_lifecycle_events" }, ({ new: row }) => {
        if (!active) return;
        const incoming = lifecycleFromRow(row);
        if (targetAddressRef.current && incoming.targetAddress?.toLowerCase() !== targetAddressRef.current) return;
        setRemoteState((current) => current ? {
          ...current,
          lifecycleEvents: [incoming, ...(current.lifecycleEvents || []).filter((item) => item.id !== incoming.id)].slice(0, 8),
        } : current);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "o8_dissent_records" }, ({ new: row }) => {
        if (!active) return;
        const incoming = dissentFromRow(row);
        if (targetAddressRef.current && incoming.targetAddress?.toLowerCase() !== targetAddressRef.current) return;
        setRemoteState((current) => current ? {
          ...current,
          dissentRecords: [incoming, ...(current.dissentRecords || []).filter((item) => item.id !== incoming.id)].slice(0, 4),
        } : current);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "o8_story_milestones" }, ({ new: row }) => {
        if (!active) return;
        const incoming = storyMilestoneFromRow(row);
        if (targetAddressRef.current && incoming.targetAddress?.toLowerCase() !== targetAddressRef.current) return;
        setRemoteState((current) => current ? {
          ...current,
          storyMilestones: [incoming, ...(current.storyMilestones || []).filter((item) => item.id !== incoming.id)].slice(0, 24),
        } : current);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "o8_hive_cells" }, ({ eventType, new: row, old: oldRow }) => {
        if (!active) return;
        const incoming = hiveCellFromRow(row);
        if (eventType === "DELETE") {
          setRemoteState((current) => current ? { ...current, hiveCells: (current.hiveCells || []).filter((cell) => cell.id !== oldRow.id) } : current);
          return;
        }
        setBackendStatus("LIVE");
        setRemoteState((current) => current ? {
          ...current,
          hiveCells: [incoming, ...(current.hiveCells || []).filter((cell) => cell.id !== incoming.id)].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 64),
        } : current);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "o8_story_state" }, ({ new: row }) => {
        if (!active || !row?.target_address) return;
        if (targetAddressRef.current && row.target_address.toLowerCase() !== targetAddressRef.current) return;
        setRemoteState((current) => current ? { ...current, storyState: storyStateFromRow(row) } : current);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "o8_target_block_snapshots" }, ({ new: row }) => {
        if (!active) return;
        const incoming = targetTraceFromRow(row);
        if (targetAddressRef.current && incoming.targetAddress?.toLowerCase() !== targetAddressRef.current) return;
        setRemoteState((current) => current ? {
          ...current,
          targetTrace: [incoming, ...(current.targetTrace || []).filter((item) => Number(item.blockNumber) !== Number(incoming.blockNumber))].slice(0, 32),
        } : current);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "o8_system_bindings" }, ({ new: row }) => {
        if (!active || !row?.id) return;
        const binding = { id: row.id, label: row.label, status: row.status, truth: row.truth, details: row.details, updatedAt: row.updated_at };
        setRemoteState((current) => current ? {
          ...current,
          bindings: current.bindings.some((item) => item.id === row.id)
            ? current.bindings.map((item) => item.id === row.id ? binding : item)
            : [...current.bindings, binding],
        } : current);
      })
      .subscribe((status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") setBackendStatus("LIVE");
        if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) setBackendStatus("DEGRADED");
      });

    return () => {
      active = false;
      window.clearInterval(interval);
      realtimeClient.removeChannel(channel);
    };
  }, []);

  const filteredFeed = useMemo(
    () => filter === "ALL" ? feed.filter((item) => item.layer !== "SYSTEM") : feed.filter((item) => item.layer === filter),
    [feed, filter],
  );

  const clock = `${formatClock(now.getUTCHours())}:${formatClock(now.getUTCMinutes())}:${formatClock(now.getUTCSeconds())}`;
  const specimen = remoteState?.specimen ?? { status: "LOADING", observerHeartbeats: 0, updatedAt: null };
  const arms = remoteState?.arms?.map((arm) => ({
    id: String(arm.id).padStart(2, "0"),
    name: arm.agentName,
    role: arm.role,
    domain: arm.domain,
    mood: arm.mood,
    state: arm.state,
    nodeName: arm.nodeName,
    routeConfidence: arm.routeConfidence,
  })) ?? initialArms;
  const connectedSources = remoteState?.sources?.filter((source) => source.status === "CONNECTED").length ?? 0;
  const chainSource = remoteState?.sources?.find((source) => source.id === "robinhood-mainnet");
  const chain = chainSource?.payload ?? {};
  const activeArms = remoteState?.arms?.filter((arm) => !["STANDBY", "OFFLINE"].includes(arm.state)).length ?? 1;
  const bindings = Object.fromEntries((remoteState?.bindings ?? []).map((binding) => [binding.id, binding]));
  const chainStatus = bindings["robinhood-chain"]?.details?.rpcConfigured ? "BOUND" : "UNBOUND";
  const voiceStatus = bindings["agent-voices"]?.details?.ready ? "READY" : "DORMANT";
  const launchpadStatus = bindings["pons-launchpad"]?.status || "CONNECTING";
  const tokenBindingStatus = bindings["o8-token"]?.status || "AWAITING_LAUNCH";
  const twitterUrl = bindings["public-links"]?.details?.twitterUrl || "";
  const token = remoteState?.token || null;
  const storyState = remoteState?.storyState || null;
  const lifePhase = resolveLifePhase(token, tokenBindingStatus, storyState);
  const tokenStatus = tokenBindingStatus === "GRADUATED" ? "GRADUATED"
    : tokenBindingStatus === "CURVE_ACTIVE" ? "LIVE"
      : tokenBindingStatus === "VERIFYING" ? "VERIFYING"
        : "AWAITING";
  const chainConnected = chainStatus === "BOUND" && chainSource?.status === "CONNECTED";
  const chainBlock = Number(chain.blockNumber ?? 0);
  const chainTransactions = Number(chain.transactionCount ?? 0);
  const chainExplorer = chain.explorer || "https://robinhoodchain.blockscout.com";
  const hiveEpochKey = "comb-hive-epoch";
  if (token?.tokenAddress) {
    const verifiedLaunchAt = token.launchedAt ? new Date(token.launchedAt).toISOString() : null;
    const retainedEpoch = window.localStorage.getItem(hiveEpochKey);
    if (verifiedLaunchAt && retainedEpoch !== verifiedLaunchAt) window.localStorage.setItem(hiveEpochKey, verifiedLaunchAt);
    if (!verifiedLaunchAt && !retainedEpoch && token.updatedAt) window.localStorage.setItem(hiveEpochKey, new Date(token.updatedAt).toISOString());
  } else if (window.localStorage.getItem(hiveEpochKey)) {
    window.localStorage.removeItem(hiveEpochKey);
  }
  const hiveEpoch = token?.tokenAddress ? window.localStorage.getItem(hiveEpochKey) : null;
  const hiveAgeSeconds = hiveEpoch ? Math.max(0, Math.round((now.getTime() - new Date(hiveEpoch).getTime()) / 1000)) : Number.NaN;
  const hiveAge = formatAge(hiveAgeSeconds);
  const observationScope = token?.tokenAddress ? "COMB TARGET" : "NETWORK SAMPLE";
  const retainedRows = feed.filter((item) => item.layer === "CHAIN" || item.layer === "RULE").slice(0, 4);
  const lifecycleEvents = (remoteState?.lifecycleEvents || []).filter((item) => !token?.tokenAddress
    || item.targetAddress?.toLowerCase() === token.tokenAddress.toLowerCase());
  const latestDissent = (remoteState?.dissentRecords || []).find((item) => !token?.tokenAddress
    || item.targetAddress?.toLowerCase() === token.tokenAddress.toLowerCase()) || null;
  const graduationEvent = lifecycleEvents.find((item) => item.phaseCode === "05" && item.ceremony) || null;
  const storyMilestones = (remoteState?.storyMilestones || []).filter((item) => !token?.tokenAddress
    || item.targetAddress?.toLowerCase() === token.tokenAddress.toLowerCase());
  const hiveCells = (remoteState?.hiveCells || []).filter((item) => !token?.tokenAddress
    || !item.targetAddress || item.targetAddress?.toLowerCase() === token.tokenAddress.toLowerCase());
  const foragerIdentities = (remoteState?.foragerIdentities || []).filter((item) => !token?.tokenAddress
    || item.targetAddress?.toLowerCase() === token.tokenAddress.toLowerCase());
  const scoutEvidence = (arm) => feed.filter((item) => {
    const source = item.source?.toUpperCase() || "";
    return source.includes(`SCOUT-${String(arm.id).padStart(2, "0")}`) || source.includes(`ARM-${String(arm.id).padStart(2, "0")}`) || source.includes(arm.agentName?.toUpperCase());
  }).slice(0, 8);
  const memoryRecords = [
    ...lifecycleEvents.map((item) => ({ ...item, recordKind: "PHASE", recordCode: item.phaseCode, recordName: item.phaseName })),
    ...storyMilestones.map((item) => ({ ...item, recordKind: item.category, recordCode: item.source?.replace("ARM-", "") || "--", recordName: item.title })),
  ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const traceMode = token?.tokenAddress ? "TARGET ACTIVITY" : "NETWORK ACTIVITY";
  const traceRecords = token?.tokenAddress
    ? (remoteState?.targetTrace || []).filter((item) => item.targetAddress?.toLowerCase() === token.tokenAddress.toLowerCase())
    : (remoteState?.networkTrace || []);
  const traceSamples = traceRecords.slice(0, 24).reverse().map((item) => Number(item.transactionCount || 0));
  const traceMaximum = Math.max(1, ...traceSamples);
  const traceHasActivity = traceSamples.some((value) => value > 0);
  const tracePoints = traceSamples.map((value, index) => ({
    value,
    x: traceSamples.length > 1 ? (index / (traceSamples.length - 1)) * 500 : 250,
    y: 61 - (value / traceMaximum) * 48,
  }));
  const tracePath = traceSamples.length > 1
    ? tracePoints.map((point, index) => {
      return `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
    }).join(" ")
    : "M0 37 H500";

  useEffect(() => {
    if (!graduationEvent) return;
    const dismissed = window.localStorage.getItem("comb-graduation-ceremony");
    if (dismissed !== String(graduationEvent.id)) setShowCeremony(true);
  }, [graduationEvent?.id]);

  async function submitQuery(event) {
    event.preventDefault();
    const question = query.trim();
    if (!question || asking) return;
    setAsking(true);
    setReplyAgent(null);
    setReply("querying retained evidence...");
    try {
      const response = await fetch("/api/o8/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: question, sessionId: sessionIdRef.current }),
      });
      if (!response.ok) throw new Error("query failed");
      const result = await response.json();
      if (result.sessionId) {
        sessionIdRef.current = result.sessionId;
        window.localStorage.setItem("o8-session-id", result.sessionId);
      }
      setReplyAgent(result.agent || null);
      setReply(result.answer);
    } catch {
      setReply("observation unavailable. the question was not added to memory.");
    } finally {
      setAsking(false);
    }
    setQuery("");
  }

  async function submitProposal(event) {
    event.preventDefault();
    if (proposalTitle.trim().length < 4 || proposalQuestion.trim().length < 12) return;
    setProposalStatus("SUBMITTING");
    try {
      const response = await fetch("/api/o8/propose-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: proposalTitle, question: proposalQuestion, targetAddress: token?.tokenAddress || null }),
      });
      if (!response.ok) throw new Error("proposal unavailable");
      setProposalStatus("PROPOSAL RETAINED / AWAITING SCOUT REVIEW");
      setProposalTitle("");
      setProposalQuestion("");
    } catch {
      setProposalStatus("PROPOSAL COULD NOT BE RETAINED");
    }
  }

  return (
    <main className="terminal">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="octo-mark" aria-hidden="true">
            <img src="/comb-logo.png" alt="" />
          </div>
          <div>
            <h1>COMB PROTOCOL</h1>
            <p>every cell stores a memory // eight scouts read the swarm</p>
          </div>
        </div>
        <div className="top-metrics">
          <Metric label="Robinhood Chain" value={chainStatus} tone={chainStatus === "BOUND" ? "signal" : "warning"} />
          <Metric label="scout router" value={voiceStatus === "READY" ? "READY" : "DORMANT"} tone={voiceStatus === "READY" ? "signal" : "warning"} />
          <Metric label="hive phase" value={`${lifePhase.code} / ${lifePhase.name}`} tone={lifePhase.name === "EMPTY HIVE" ? "warning" : "signal"} />
          <Metric label="scouts online" value={`${String(activeArms).padStart(2, "0")} / 08`} tone="signal" />
          {token?.tokenAddress ? (
            <a className="ca-link bound" href={`${chainExplorer}/address/${token.tokenAddress}`} target="_blank" rel="noreferrer" title="Open verified COMB contract">
              <span>COMB CA</span><strong>{shortAddress(token.tokenAddress)}</strong>
            </a>
          ) : (
            <div className="ca-link terminal-readout" title="Readout only. A contract address appears after admin binding.">
              <span>COMB CA</span><strong>UNBOUND</strong>
            </div>
          )}
          <Metric label="hive age" value={hiveAge} tone={token?.tokenAddress ? "signal" : "warning"} />
          {twitterUrl ? (
            <a className="social-link" href={twitterUrl} target="_blank" rel="noreferrer" title="Open the COMB X profile">X / FOLLOW</a>
          ) : (
            <div className="social-link terminal-readout" title="Readout only. The X profile has not been configured.">X / UNBOUND</div>
          )}
        </div>
      </header>

      <div className="ticker" aria-label="Current terminal state">
        <span>ATTACH · FORAGE · ARCHIVE</span><i /> <b>PHASE {lifePhase.code} / {lifePhase.name}</b><i /> <span>{lifePhase.directive}</span><i />
        <b>CLOCK {clock}</b><i /> <span>CHAIN INPUT {chainStatus}</span><i /> <span>PONS {launchpadStatus}</span><i /> <span>AI ROUTER {voiceStatus}</span><i />
        <span>CHAIN facts / RULE analysis / AI on request / VISUAL only</span>
      </div>

      <section className="specimen" aria-label="Live specimen">
        <div className="specimen-label">COMB HIVE // PHASE {lifePhase.code} — {lifePhase.name}</div>
        <div className="specimen-visual" aria-label="Live honeycomb evidence display">
          <div className="terminal-specimen" role="img" aria-label="COMB honeycomb rendered from terminal pixels">
            <div className="specimen-readout"><span>8 FREE SCOUTS</span><b>VISUAL / DECORATIVE</b><span>NO TARGET VECTOR</span></div>
            <HivePulse />
            <div className="arm-register" aria-hidden="true"><span>01</span><span>02</span><span>03</span><span>04</span><b>SCOUT REGISTER</b><span>05</span><span>06</span><span>07</span><span>08</span></div>
          </div>
        </div>
        <div className="specimen-meta">
          <span><Radio size={13} /> {lifePhase.directive}</span>
          <div className="life-cycle" aria-label="COMB lifecycle">
            {LIFE_PHASES.map((phase) => <span key={phase.code} className={phase.code === lifePhase.code ? "active" : ""}>{phase.code} {phase.name}</span>)}
          </div>
        </div>
        <form className="ask-line" onSubmit={submitQuery}>
          <label htmlFor="ask">ASK&gt;</label>
          <input id="ask" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ask COMB about retained evidence or scout state" />
          <button type="button" onClick={() => setShowProposal(true)}>PROPOSE MEMORY</button>
          <button type="submit" disabled={asking}>{asking ? "reading" : "ask COMB"}</button>
        </form>
        {reply && (
          <div className="conversation-overlay" role="status" aria-live="polite">
            <div className="conversation-header">
              <span>{replyAgent ? `AI / ON REQUEST / SCOUT-${String(replyAgent.id).padStart(2, "0")} / ${replyAgent.name} / voice:${replyAgent.mood}` : "AI / ON REQUEST / QUERYING"}</span>
              <button type="button" onClick={() => { setReply(""); setReplyAgent(null); }} aria-label="Close response" title="Close response"><X size={14} /></button>
            </div>
            <div className="reply">{reply}</div>
          </div>
        )}
        {showDissent && latestDissent && (
          <div className="conversation-overlay story-overlay" role="dialog" aria-label="Eight-arm divergence record">
            <div className="conversation-header">
              <span>RULE / DIVERGENCE RECORD / PHASE {latestDissent.phaseCode} / 08 POSITIONS</span>
              <button type="button" onClick={() => setShowDissent(false)} aria-label="Close divergence record"><X size={14} /></button>
            </div>
            <p className="story-disclosure">Deterministic rule-layer positions recorded at a real lifecycle transition. This is not eight simultaneous LLM calls.</p>
            <div className="dissent-grid">
              {(latestDissent.positions || []).map((position) => (
                <article key={position.armId}>
                  <header><b>SCOUT-{String(position.armId).padStart(2, "0")} / {position.name}</b><span>{position.stance}</span></header>
                  <p>{position.position}</p>
                </article>
              ))}
            </div>
          </div>
        )}
        {showCeremony && graduationEvent && (
          <div className="conversation-overlay ceremony-overlay" role="dialog" aria-label="Verified COMB graduation ceremony">
            <div className="conversation-header">
              <span>CHAIN-TRIGGERED CEREMONY / PHASE 05 / GRADUATED</span>
              <button type="button" onClick={() => { setShowCeremony(false); window.localStorage.setItem("comb-graduation-ceremony", String(graduationEvent.id)); }} aria-label="Close graduation ceremony"><X size={14} /></button>
            </div>
            <div className="ceremony-body">
              <span className="ceremony-sigil">08</span>
              <div><small>THE EIGHT ARMS ACKNOWLEDGE A VERIFIED STATE TRANSITION</small><h2>THE TARGET CROSSED THE PONS GRADUATION THRESHOLD.</h2><p>This ceremony was opened by retained chain state—not by a timer, animation, or AI prediction.</p></div>
            </div>
            <div className="ceremony-facts"><span>BLOCK <b>{graduationEvent.observedBlock || "RETAINED"}</b></span><span>POOL <b>{graduationEvent.evidence?.poolAddress ? `${graduationEvent.evidence.poolAddress.slice(0, 10)}...${graduationEvent.evidence.poolAddress.slice(-6)}` : "VERIFIED"}</b></span><span>PROGRESS <b>100%</b></span></div>
          </div>
        )}
      </section>

      <section className="dashboard">
        <div className="left-column">
          <Panel title="FORAGE 01 — READ THE CHAIN" className="sense-panel">
            <div className="sense-top">
              <div><span className="eyebrow">primary chain input</span><strong className="countdown">{chainConnected ? "LIVE" : chainStatus}</strong><p>{chainConnected ? "SCOUT is sampling verified Robinhood Chain blocks." : "Evidence scanner is paused until an RPC endpoint is configured."}</p></div>
              <div className={`radar ${chainConnected ? "" : "inactive"}`}><Radio size={42} /><span>{chainConnected ? "01" : "00"}</span></div>
            </div>
            <div className={`trace ${chainConnected ? "" : "inactive"}`} title={token?.tokenAddress ? "Target-scoped relevant transaction counts from recently analyzed blocks" : "Verified transaction counts from recently retained Robinhood Chain blocks"}>
              <div className="trace-caption"><span>{traceMode}</span><b>{traceSamples.length ? (traceHasActivity ? `${traceSamples.length} SAMPLES / MAX ${traceMaximum}` : `${traceSamples.length} SAMPLES / VERIFIED ZERO ACTIVITY`) : "AWAITING SAMPLES"}</b></div>
              <svg viewBox="0 0 500 70" preserveAspectRatio="none"><path d={chainConnected ? tracePath : "M0 37 H500"} />{chainConnected && tracePoints.map((point, index) => <circle key={`${point.x}-${index}`} cx={point.x} cy={point.y} r={point.value > 0 ? 2.2 : 1.15} className={point.value > 0 ? "active" : ""} />)}</svg>
            </div>
            <div className="sense-grid"><Metric label="latest block" value={chainConnected ? chainBlock.toLocaleString() : "--"} tone={chainConnected ? "signal" : "warning"} /><Metric label="transactions" value={chainConnected ? String(chainTransactions).padStart(2, "0") : "--"} /><Metric label="RPC latency" value={chainConnected ? `${chainSource.latencyMs}ms` : "--"} /></div>
            <div className="source-row"><Activity size={13} /><span>primary market source</span><b>ROBINHOOD CHAIN / {chainConnected ? "CONNECTED" : "AWAITING RPC"}</b></div>
              <p className="observation">{chainConnected ? `SCOUT retained block ${chainBlock.toLocaleString()} with its hash, parent, timestamp, gas values, L1 reference, and transaction count.` : "No blocks, transactions, contracts, pools, or wallet activity are being ingested yet."}</p>
          </Panel>
          <Panel title={token?.tokenAddress ? "TARGET IDENTITY — VERIFIED EVIDENCE" : "ENVIRONMENT — VERIFIED EVIDENCE"} className="signal-panel">
            <div className="signal-header"><a className="signal-link" href={chainConnected ? `${chainExplorer}/block/${chainBlock}` : chainExplorer} target="_blank" rel="noreferrer">ROBINHOOD CHAIN / MAINNET RPC</a><span className={`truth-tag ${chainConnected ? "" : "warning"}`}>{chainConnected ? "CONNECTED" : chainStatus}</span></div>
            <p>{token?.tokenAddress
              ? <><b>{token.name || token.symbol}</b> is verified through the Pons factory. CA <a className="signal-link" href={`${chainExplorer}/address/${token.tokenAddress}`} target="_blank" rel="noreferrer">{`${token.tokenAddress.slice(0, 8)}...${token.tokenAddress.slice(-6)}`}</a>{token.poolAddress ? `; pool ${token.poolAddress.slice(0, 8)}...${token.poolAddress.slice(-6)}.` : "."}</>
              : chainConnected ? `SCOUT observed block ${chainBlock.toLocaleString()} containing ${chainTransactions} transactions. The retained hash is ${String(chain.blockHash || "").slice(0, 18)}...` : "No chain evidence is currently available. COMB will not generate hive observations until the chain ID and RPC endpoint are verified."}</p>
            {!token?.tokenAddress && <div className="genesis-checklist" aria-label="COMB genesis checklist"><span><b className={launchpadStatus === "CONNECTED" ? "done" : "pending"}>{launchpadStatus === "CONNECTED" ? "READY" : "WAIT"}</b> PONS ORIGIN</span><span><b className="pending">WAIT</b> COMB CONTRACT</span><span><b className={chainConnected ? "done" : "pending"}>{chainConnected ? "READY" : "WAIT"}</b> CHAIN IDENTITY</span></div>}
            <div className="signal-scale">{token?.tokenAddress
              ? <><span>{token.symbol} / PONS</span><b>CURVE {Number(token.graduationProgressPct || 0).toFixed(2)}%</b><span>{token.status}</span></>
              : <><span>CHAIN ID {chainConnected ? "4663" : "--"}</span><b>BLOCK {chainConnected ? chainBlock.toLocaleString() : "--"}</b><span>TX {chainConnected ? chainTransactions : "--"}</span></>}</div>
          </Panel>
        </div>

        <div className="middle-column">
          <Panel title="SWARM 02 — INTERPRET WITHOUT CONSENSUS" className="adapt-panel">
            <div className="panel-summary"><Metric label="scouts online" value={`${String(activeArms).padStart(2, "0")} / 08`} tone="signal" /><Metric label="observer heartbeats" value={String(specimen.observerHeartbeats ?? 0).padStart(2, "0")} /><Metric label="AI invocation" value="ON REQUEST" tone={voiceStatus === "READY" ? "signal" : "warning"} /></div>
            <div className="arm-list">
              {arms.map((arm) => (
                <button type="button" className="arm-row scout-row-button" key={arm.id} title={`Open ${arm.name} evidence`} onClick={() => setSelectedScout({ ...arm, evidence: scoutEvidence(arm) })}>
                  <span className={`arm-dot ${arm.state === "STANDBY" ? "faint" : ""}`} />
                  <b>SCOUT-{arm.id}</b><span className="agent-name">{arm.name}</span><em>{arm.role}</em><span className="agent-mood">{scoutEvidence(arm).length} records</span><strong className={arm.state === "STANDBY" ? "warning" : ""}>{arm.state}</strong>
                </button>
              ))}
            </div>
            {latestDissent ? (
              <button type="button" className="dissent-button" onClick={() => setShowDissent(true)}>
                <span>DIVERGENCE RECORD / PHASE {latestDissent.phaseCode}</span><b>OPEN 08 POSITIONS</b>
              </button>
            ) : (
              <div className="dissent-button dissent-status" title="Readout only. Divergence is recorded after a verified lifecycle transition.">
                <span>DIVERGENCE RECORD / AWAITING TRANSITION</span><b>NO RECORD</b>
              </div>
            )}
          </Panel>
          <Panel title="ARCHIVE 03 — STORE WHAT THE SWARM REMEMBERS" className="memory-panel">
            <div className="memory-top"><Metric label="hive cells" value={String(hiveCells.length).padStart(2, "0")} tone="signal" /><Metric label="observer" value={storyState?.observerHealth || (chainConnected ? "HEALTHY" : "UNKNOWN")} tone={storyState?.observerHealth === "DEGRADED" ? "warning" : "signal"} /><Metric label="baseline" value={storyState?.baselineReadyAt ? "READY" : "COLLECTING"} tone={storyState?.baselineReadyAt ? "signal" : "warning"} /></div>
            <div className="memory-list">
              {hiveCells.length ? hiveCells.slice(0, 5).map((cell) => <button type="button" className="memory-row memory-cell-button" key={`cell-${cell.id}`} onClick={() => setSelectedCell(cell)}><time>CELL {String(cell.id).padStart(3, "0")}</time><span className="memory-type rule">{cell.cellType}</span><p><b>{cell.title}</b> — {cell.description}</p></button>) : memoryRecords.length ? memoryRecords.slice(0, 5).map((item) => <div className="memory-row" key={`${item.recordKind}-${item.id}`}><time>{item.recordCode}</time><span className="memory-type rule">{item.recordKind}</span><p><b>{item.recordName}</b> — {item.description}</p></div>) : retainedRows.length ? retainedRows.map((item) => <div className="memory-row" key={item.id}><time>{item.time}</time><span className={`memory-type ${item.layer.toLowerCase()}`}>{item.layer}</span><p>{item.text}</p></div>) : <div className="empty-evidence">EMPTY HIVE / FIRST CELL AWAITS A VERIFIED IDENTITY</div>}
              {foragerIdentities.slice(0, 3).map((forager) => <div className="memory-row" key={`forager-${forager.id}`}><time>FORAGER</time><span className="memory-type chain">{forager.identityType}</span><p><b>{forager.label}</b> — first seen block {forager.firstSeenBlock || "--"}</p></div>)}
            </div>
          </Panel>
        </div>

          <Panel title={`HIVE MEMORY — ${lifePhase.name}`} className="feed-panel">
          <div className="feed-filters" role="group" aria-label="Evidence layer filter">
            {["ALL", "CHAIN", "RULE", "SYSTEM"].map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
          </div>
          <div className="evidence-legend"><span><b>CHAIN</b> verified RPC facts</span><span><b>RULE</b> deterministic parsing</span><span><b>AI</b> only after ASK</span><span><b>VISUAL</b> decorative only</span></div>
          <div className="feed-list">
            {filteredFeed.length ? filteredFeed.map((item) => (
              <button type="button" className="feed-item feed-event-button" key={item.id} onClick={() => setSelectedEvent(item)} aria-label={`Open event ${item.id}`}>
                <div><time>{item.time}</time><span>{item.source}</span><em className={`layer-${item.layer.toLowerCase()}`}>{item.layer}</em><small>{item.scope}</small></div>
                <p>{item.text}</p>
              </button>
            )) : <div className="empty-evidence">{filter === "SYSTEM" ? "SYSTEM LAYER QUIET / CHAIN MONITORING CONTINUES" : "NO RECORDS IN THIS EVIDENCE LAYER / MONITORING CONTINUES"}</div>}
          </div>
          <div className="feed-footer"><span className="live-dot" /> {["CONNECTED", "LIVE"].includes(backendStatus) ? `${observationScope.toLowerCase()} records are persisted; labels identify their origin` : "observation link degraded"}</div>
        </Panel>
      </section>

      {selectedCell && (
        <div className="cell-detail-backdrop" role="presentation" onClick={() => setSelectedCell(null)}>
          <section className="cell-detail" role="dialog" aria-modal="true" aria-label={`Hive cell ${selectedCell.id}`} onClick={(event) => event.stopPropagation()}>
            <header className="cell-detail-header"><span>CELL {String(selectedCell.id).padStart(3, "0")} / {selectedCell.cellKey}</span><button type="button" onClick={() => setSelectedCell(null)} aria-label="Close hive cell details" title="Close details"><X size={14} /></button></header>
            <div className="cell-detail-title"><span className="truth-tag">{selectedCell.truth} / {selectedCell.status}</span><h2>{selectedCell.title}</h2><p>{selectedCell.description}</p></div>
            <dl className="cell-detail-facts"><div><dt>TYPE</dt><dd>{selectedCell.cellType}</dd></div><div><dt>BLOCK</dt><dd>{selectedCell.observedBlock || "NOT YET OBSERVED"}</dd></div><div><dt>TARGET</dt><dd>{selectedCell.targetAddress || "UNBOUND"}</dd></div><div><dt>SOURCE EVENT</dt><dd>{selectedCell.sourceEventId || "NONE"}</dd></div></dl>
            <div className="cell-detail-evidence"><span className="eyebrow">RETAINED EVIDENCE</span><pre>{JSON.stringify(selectedCell.evidence || {}, null, 2)}</pre></div>
          </section>
        </div>
      )}

      {selectedScout && (
        <div className="cell-detail-backdrop" role="presentation" onClick={() => setSelectedScout(null)}>
          <section className="cell-detail scout-detail" role="dialog" aria-modal="true" aria-label={`${selectedScout.name} scout evidence`} onClick={(event) => event.stopPropagation()}>
            <header className="cell-detail-header"><span>SCOUT-{selectedScout.id} / {selectedScout.name}</span><button type="button" onClick={() => setSelectedScout(null)} aria-label="Close scout details" title="Close scout details"><X size={14} /></button></header>
            <div className="cell-detail-title"><span className="truth-tag">{selectedScout.state} / {selectedScout.mood}</span><h2>{selectedScout.role}</h2><p>{selectedScout.domain || "This Scout is waiting for a verified COMB target."}</p></div>
            <dl className="cell-detail-facts"><div><dt>NODE</dt><dd>{selectedScout.nodeName || "UNBOUND"}</dd></div><div><dt>RECORDS</dt><dd>{selectedScout.evidence.length}</dd></div><div><dt>CONFIDENCE</dt><dd>{Number(selectedScout.routeConfidence || 0).toFixed(2)}</dd></div><div><dt>AI</dt><dd>ON REQUEST</dd></div></dl>
            <div className="scout-doctrine">
              {[["WHAT I SEE", 0], ["WHAT I CANNOT CLAIM", 1], ["WHAT WOULD CHANGE MY VIEW", 2]].map(([label, index]) => <div key={label}><span>{label}</span><p>{(SCOUT_DOCTRINES[selectedScout.name] || SCOUT_DOCTRINES.SCOUT)[index]}</p></div>)}
              <div><span>CURRENT BOUNDARY</span><p>{token?.tokenAddress ? "TARGET-SCOPED EVIDENCE MAY NOW CHANGE THIS VIEW." : "NETWORK MODE / NO TARGET-SCOPED CLAIM IS AVAILABLE."}</p></div>
            </div>
            <div className="scout-record-list"><span className="eyebrow">RECENT OBSERVATIONS</span>{selectedScout.evidence.length ? selectedScout.evidence.map((item) => <div key={item.id}><time>{item.time}</time><b>{item.layer}</b><p>{item.text}</p></div>) : <p className="empty-evidence">NO SCOUT-SCOPED RECORDS / AWAITING A VERIFIED TARGET</p>}</div>
          </section>
        </div>
      )}

      {selectedEvent && (
        <div className="cell-detail-backdrop" role="presentation" onClick={() => setSelectedEvent(null)}>
          <section className="cell-detail" role="dialog" aria-modal="true" aria-label={`Event ${selectedEvent.id}`} onClick={(event) => event.stopPropagation()}>
            <header className="cell-detail-header"><span>EVENT {String(selectedEvent.id).padStart(4, "0")} / {selectedEvent.layer}</span><div className="event-detail-actions"><button type="button" className="memory-download" onClick={() => downloadMemoryCard(selectedEvent)} title="Download memory card"><Download size={14} /></button><button type="button" onClick={() => setSelectedEvent(null)} aria-label="Close event details" title="Close event details"><X size={14} /></button></div></header>
            <div className="cell-detail-title"><span className="truth-tag">{selectedEvent.source} / {selectedEvent.scope}</span><h2>{selectedEvent.text}</h2><p>Retained feed event from the COMB observation stream. Open the evidence fields below before assigning a narrative interpretation.</p></div>
            <dl className="cell-detail-facts"><div><dt>TIME</dt><dd>{selectedEvent.time}</dd></div><div><dt>LAYER</dt><dd>{selectedEvent.layer}</dd></div><div><dt>SOURCE</dt><dd>{selectedEvent.source}</dd></div><div><dt>CELL</dt><dd>{selectedEvent.metadata?.cellKey || "UNASSIGNED"}</dd></div></dl>
            <div className="cell-detail-evidence"><span className="eyebrow">EVENT METADATA</span><pre>{JSON.stringify(selectedEvent.metadata || {}, null, 2)}</pre></div>
          </section>
        </div>
      )}

      {showProposal && (
        <div className="cell-detail-backdrop" role="presentation" onClick={() => setShowProposal(false)}>
          <form className="cell-detail proposal-form" role="dialog" aria-modal="true" aria-label="Propose a hive memory" onClick={(event) => event.stopPropagation()} onSubmit={submitProposal}>
            <header className="cell-detail-header"><span>PROPOSE MEMORY / HIVE ARCHIVE</span><button type="button" onClick={() => setShowProposal(false)} aria-label="Close memory proposal" title="Close memory proposal"><X size={14} /></button></header>
            <div className="cell-detail-title"><span className="truth-tag">COMMUNITY INPUT / PENDING REVIEW</span><h2>Offer a question to the Scouts.</h2><p>Proposals do not change chain facts. A proposal becomes a memory only after evidence is verified and reviewed.</p></div>
            <label className="proposal-field">TITLE<input value={proposalTitle} onChange={(event) => setProposalTitle(event.target.value)} maxLength={120} placeholder="first forage needs verification" /></label>
            <label className="proposal-field">QUESTION<textarea value={proposalQuestion} onChange={(event) => setProposalQuestion(event.target.value)} maxLength={600} rows={4} placeholder="What should the Scouts verify from the retained evidence?" /></label>
            <div className="proposal-actions"><span>{proposalStatus}</span><button type="submit" disabled={proposalStatus === "SUBMITTING"}>{proposalStatus === "SUBMITTING" ? "SUBMITTING" : "RETAIN PROPOSAL"}</button></div>
          </form>
        </div>
      )}

      <footer className="footer">
        <span>protocol <b>COMB</b></span><span>phase <b>{lifePhase.code} / {lifePhase.name}</b></span><span>scouts <b>08</b></span><span>scope <b>{observationScope}</b></span><span>chain <b>{chainStatus}</b></span><span>token <b>{tokenStatus}</b></span><span>hive age <b>{hiveAge}</b></span><span>AI <b>ON REQUEST</b></span><span className="footer-hint">THE SWARM MOVES. COMB REMEMBERS.</span>
      </footer>
    </main>
  );
}

export default App;
