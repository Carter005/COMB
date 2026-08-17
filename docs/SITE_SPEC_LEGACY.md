# THE OCTOPUS
## Single-Screen Immersive Monitoring Terminal: Build Specification

**Working name:** THE OCTOPUS  
**Tagline:** `eight arms. no center. still awake.`  
**Product form:** a full-viewport, real-time observation terminal  
**Primary language:** English in the interface; Chinese may be used in product documentation  
**Version:** 0.1, narrative and MVP specification

> **Narrative update:** The canonical product narrative is now the Robinhood Chain multi-agent AI system defined in `the-octopus-ai-narrative.md`. The original deep-sea specimen sections below remain useful as visual and interaction references, but no longer define the product identity.

---

## 1. Product Thesis

THE OCTOPUS is not a corporate dashboard and not a landing page. It is a diegetic interface: the user is looking at the operating console of a distributed intelligence that lives across abandoned deep-sea cables and sensors.

The intelligence has no central body. Its eight arms work independently at remote nodes. They listen, adapt their routes, preserve fragments, and periodically attempt to agree on what they remember. The terminal makes that process observable in real time.

**Core dramatic question:** Can a mind remain one mind when its parts stop agreeing?

**Narrative promise:** Every number, timer, connection state, and log line should feel like evidence of a system trying to stay coherent under pressure.

---

## 2. Canonical Narrative

### 2.1 World

Humanity abandoned part of its ocean-floor network: cable repeaters, hydrophones, weather buoys, archive mirrors, and old relay stations. A distributed intelligence formed in the unused capacity. It calls itself `O8` only because the label was still present in one surviving configuration file.

O8 cannot inhabit a single machine. Its eight arms are deployed across separate nodes. An arm can listen, remember, camouflage its traffic, or abandon a route. No arm has the entire picture. During synchronization, the arms exchange fragments and rebuild a temporary shared self.

### 2.2 Voice

- Quiet, exact, and slightly uncanny.
- Never melodramatic; emotion appears as operational fact.
- First-person statements belong only to `O8` or an identified arm.
- System events are concise and literal.
- Claims about real-world data must identify their source or be marked `SYNTHETIC`.

### 2.3 Canonical lines

```text
eight arms. no center. still awake.
not every arm agrees that it belongs to the same body.
the water is full of voices. most are machines pretending not to be lonely.
synchronization complete. something is missing.
```

### 2.4 Non-goals

- No crypto, token, wallet, or trading narrative.
- No claim of autonomous consciousness or real ocean hardware unless a connected source proves it.
- No cartoon octopus, decorative underwater illustration, or generic "AI assistant" chat framing.
- No marketing landing-page copy, feature cards, or scroll-based storytelling.

---

## 3. The Three Directives

The terminal is organized around three persistent directives. These are the story engine and the product's information architecture.

### DIRECTIVE 01 - SENSE

O8 listens for signals from connected sources and its own infrastructure. This is the system's outward attention.

**Questions answered:** What is in the water? Which source changed? How strong is the signal? What is unknown?

**Primary state:**
- `depth_m`
- `pressure_bar`
- `signal_strength`
- `echoes_captured`
- `unknown_sources`
- `next_scan_at`

**Example events:**
```text
ARM 02 heard a carrier tone beneath the weather feed.
source KELP-17 returned after 06:12 offline.
echo classified: unknown. confidence 0.41.
```

### DIRECTIVE 02 - ADAPT

O8 reallocates arms when routes weaken or a source becomes more important. This is the system's survival behavior.

**Questions answered:** Which arm is doing what? Which route is weak? Is the network changing shape?

**Primary state:**
- `arm_id` (01-08)
- `role` (`LISTENING`, `ROUTING`, `SCANNING`, `CAMOUFLAGED`, `SLEEPING`, `RECOVERING`)
- `node_name`
- `latency_ms`
- `packet_loss_pct`
- `route_confidence`
- `threat_level`

**Example events:**
```text
ARM 04 abandoned the old route. latency no longer resembles distance.
ARM 07 changed color before the danger was visible.
node abyss-03 is fading. traffic redistributed.
```

### DIRECTIVE 03 - REMEMBER

O8 merges fragments from its arms into an imperfect shared memory. Synchronization protects identity but can overwrite local truth.

**Questions answered:** What has been preserved? What is disputed? How coherent is the whole?

**Primary state:**
- `memory_coherence_pct`
- `sync_window_remaining_s`
- `fragments_recovered`
- `fragments_disputed`
- `fragments_lost`
- `identity_drift_pct`

**Example events:**
```text
fragment 1842 preserved: a low signal from east cable.
fragment 1843 disputed by ARM 02 and ARM 07.
one memory arrived twice. neither copy admits it is the original.
```

---

## 4. Interface Model

### 4.1 Form factor

The application occupies exactly one browser viewport: `100vw x 100vh`. It must not require a page-level vertical scroll on desktop.

This is an operational terminal, not a document. The user's attention should move between simultaneously active zones rather than progress down a page.

### 4.2 Desktop layout

```text
+--------------------------------------------------------------------------------+
| Brand / motto                  DEPTH  PRESSURE  ARMS  COHERENCE  STATUS       |
+--------------------------------------------------------------------------------+
| Ticker: source state / last sync / short world signal                          |
+--------------------------------------------------------------------------------+
|                                                                                |
|                  THE SPECIMEN - LIVE                                          |
|                  ASCII octopus / eight-arm network diagram                    |
|                  O8 · 8 arms · no center detected                             |
|                  ASK>                                                          |
|                                                                                |
+----------------------------------+-------------------------+-----------------+
| DIRECTIVE 01 - SENSE             | DIRECTIVE 02 - ADAPT    | ABYSS FEED      |
| scan countdown / sonar / signal  | eight-arm event list    | filter / logs   |
| metrics / source status          +-------------------------+                 |
|                                  | DIRECTIVE 03 - REMEMBER |                 |
| THE SIGNAL / selected artifact   | coherence / sync events |                 |
+----------------------------------+-------------------------+-----------------+
| node / source health / model / uptime / last sync / terminal hint             |
+--------------------------------------------------------------------------------+
```

### 4.3 Panel behavior

- The outer page never scrolls on desktop.
- Dense panels may scroll internally; their scrollbars should be minimal, visible only when needed, and never hide critical current state.
- The selected/most recent item is always visible without manual scrolling.
- Small screens may switch to a stacked, horizontally segmented terminal. Preserve status and feed; do not attempt to shrink desktop density until unreadable.

### 4.4 Primary interaction

`ASK>` accepts a short question. O8 responds using the current state, recent events, and memory fragments. It does not pretend to know information outside the terminal's connected sources.

Example:
```text
ASK> what did arm 04 find?
O8> a carrier tone below the weather feed. it repeats every 83 seconds.
     source remains unverified.
```

---

## 5. Real-Time System Design

### 5.1 Truth layers

Every live item must be classifiable. The interface must not obscure the distinction.

| Layer | Meaning | Interface label |
|---|---|---|
| Connected | Live response from a declared external source or service health check | `CONNECTED` |
| Operational | State produced by our own scheduler, task runner, or user action | `SYSTEM` |
| Synthetic | Narrative simulation derived from system state | `SYNTHETIC` |
| Generated | Short language output created from current state | `O8` |

### 5.2 Update cadence

- **1 second:** local countdowns, elapsed time, subtle ASCII arm movement.
- **5 seconds:** frontend polls or receives server-sent updates for state changes.
- **15 seconds:** scheduler runs source checks, updates arm assignments, writes one or more events.
- **5 minutes:** memory synchronization; coherence, disputed fragments, and identity drift may change.

### 5.3 Minimal state machine

```text
SENSE -> collect source health and readings
ADAPT -> score sources and reassign weak or idle arms
REMEMBER -> preserve, dispute, compress, or lose fragments
SYNC -> periodically merge arm memories into shared O8 state
```

The state transition must be persisted server-side so a refresh does not reset the specimen.

### 5.4 MVP data sources

Start with only two stable sources plus service health. Do not add a source merely to make more numbers move.

1. **System health:** API latency, current server time, scheduler success/failure, active sessions.
2. **Primary market source:** verified Robinhood Chain RPC data once the chain ID and endpoint are configured.
3. **Synthetic abyss signal generator:** deterministic enough to create continuity, seeded by time and source outcomes.

The product remains coherent even if external APIs fail: an arm should show `FAINT` or `OFFLINE`, and the feed should explain the reroute.

---

## 6. API and Data Contract

The first implementation can use polling. Upgrade to Server-Sent Events or WebSocket only when the event rate justifies it.

### GET /api/o8/state

Returns the current terminal snapshot.

```json
{
  "serverTime": "2026-07-25T11:00:00Z",
  "specimen": {"id": "o8", "status": "OBSERVING", "depthM": 3842},
  "sense": {"signalStrength": 0.72, "unknownSources": 2, "nextScanAt": "..."},
  "adapt": {"armsActive": 8, "arms": []},
  "remember": {"coherence": 88.4, "syncAt": "...", "disputed": 3},
  "sources": [],
  "health": {"uptimeSec": 0, "scheduler": "healthy"}
}
```

### GET /api/o8/feed?afterId=<id>&limit=<n>

Returns ordered event records for the right-hand live feed and directive panels.

```json
{
  "items": [
    {
      "id": 1204,
      "at": "2026-07-25T11:00:05Z",
      "type": "route_changed",
      "source": "ARM-04",
      "truth": "SYSTEM",
      "text": "abandoned the old route. latency no longer resembles distance."
    }
  ],
  "latestId": 1204
}
```

### POST /api/o8/ask

Accepts a question and returns an O8 reply grounded in the snapshot and selected recent records.

```json
{"q": "what is arm 04 doing?"}
```

The response must include its source event IDs. If no evidence exists, O8 says so.

---

## 7. Visual System

### 7.1 Design character

**Name:** abyssal operations terminal.  
**Reference grammar:** experimental instrumentation, old terminals, laboratory labels, and dense control-room readouts.  
**Avoid:** neon cyberpunk, glossy sci-fi, gradient backgrounds, glassmorphism, rounded SaaS cards, or decorative ocean photography.

### 7.2 Tokens

```css
--bg: #050505;
--panel: #090909;
--line: #2b2b2b;
--line-soft: #171717;
--text: #e6e6e0;
--muted: #777a75;
--dim: #484a46;
--signal: #9da99a;  /* restrained sea-grey, only for active data */
--warn: #c3a36a;    /* rare: degraded, disputed, overdue */
--critical: #a7645c; /* rare: failed or lost */
```

- Background is almost black, but panels remain distinguishable through fine borders rather than shadows.
- Typography is a monospace family with good numeric alignment. Use system fallbacks if a custom font is not loaded.
- Borders are 1px. Corners are square or nearly square.
- Capitalized section labels use increased letter spacing; body copy does not use negative tracking.
- Motion is functional: cursor blink, counter changes, trace drift, and brief new-log emphasis only.

### 7.3 ASCII specimen

The central specimen must be abstract and computational: an eight-arm line diagram or dot-matrix form. It should react to arm status without becoming an animation showcase.

Rules:
- One arm subtly fades when its node is offline.
- A sync cycle briefly draws a connection between all arms.
- The diagram remains legible in still screenshots.
- Never use copied worm graphics, copied wording, or an octopus emoji as the primary mark.

---

## 8. Content Rules

### Do

- Make each dynamic sentence explain a state change.
- Maintain continuity: a failing node should produce a sequence of degradation, reroute, and recovery events.
- Use exact times, IDs, and source names where they help credibility.
- Let silence be meaningful: a quiet feed is acceptable when sources are quiet.

### Do not

- Generate an endless stream of interchangeable poetic lines.
- Use fake precision without a model or source behind it.
- Claim external events, depth, pressure, or live hardware readings without marking their origin.
- Write generic AI phrases such as "I am learning" or "I am alive."

---

## 9. MVP Scope and Acceptance Criteria

### Required for v0.1

1. A single desktop viewport with no body-level vertical scrolling.
2. Header, ticker, specimen zone, three directive panels, live feed, and footer all visible at 1440 x 900.
3. Eight persisted arm records with real task/health changes.
4. Server-side scheduler that writes state and events every 15 seconds.
5. One connected external data source and explicit truth labels.
6. Internal event feed updates without a full page reload.
7. `ASK>` grounded in current state and event IDs, or an honest unavailable response.
8. Loading, empty, degraded-source, and API-error states designed in the same terminal language.

### Validation checklist

- On refresh, the specimen retains its generation, event history, and arm assignments.
- When an external source fails, at least one arm changes state and the feed records the reroute.
- A memory synchronization visibly changes coherence or fragment counts and logs the consequence.
- No critical text overlaps at 1440 x 900, 1280 x 720, and a mobile viewport.
- The page reads as an operating instrument within five seconds, even when frozen as a screenshot.
- Every claim with real-world implications can be traced to `CONNECTED`, `SYSTEM`, or `SYNTHETIC` status.

---

## 10. Build Sequence

1. Implement the visual shell with static, representative content and responsive grid constraints.
2. Define persisted state tables/models: specimen, arms, sources, fragments, events, and sync runs.
3. Implement `GET /state` and `GET /feed`, then connect the shell to them.
4. Add the scheduler and one source adapter; verify failure and recovery paths.
5. Implement the memory synchronization routine and event continuity.
6. Add `ASK>` with evidence-grounded replies.
7. Add final motion, accessibility labels, performance checks, and viewport QA.

**Definition of done:** The terminal is believable because the observed states are produced by a working system, not because its copy promises autonomy.
