# Architecture and data flow

```mermaid
flowchart LR
  RPC[Robinhood Chain RPC] --> RW[Railway observer]
  PONS[Pons Launchpad catalog] --> RW
  RW --> PARSER[viem + deterministic parser]
  PARSER --> DB[(Supabase O8/AAA)]
  DB --> RT[Supabase Realtime]
  DB --> API[Vercel API routes]
  RT --> UI[React single-screen terminal]
  API --> UI
  UI --> ASK[/api/o8/ask]
  ASK --> MM[MiniMax adapter]
  MM --> DB
```

## Browser

The browser reads `/api/o8/state` and `/api/o8/feed?limit=40` on first load and periodically as a fallback. It subscribes to Supabase Realtime for source, event, specimen, arms, token, lifecycle, dissent, milestones, trace, story, and system-binding changes. It never makes one RPC request per visitor.

The octopus canvas is `VISUAL` only. Its frame changes do not create data.

## Vercel API routes

- `/api/o8/state` — public normalized snapshot.
- `/api/o8/feed` — public evidence feed.
- `/api/o8/ingest` — protected/manual ingestion path.
- `/api/o8/register-token` — protected target registration/reset path.
- `/api/o8/tick` — protected scheduled maintenance path.
- `/api/o8/ask` — visitor question; invokes only the relevant MiniMax agent voices on request.
- `/api/o8/config` — public-safe configuration.

## Railway worker

`railway/worker.js` is the only continuous observer. It:

1. verifies chain ID;
2. polls the head roughly every second;
3. persists source heartbeat and retained block state;
4. runs target-scoped parsing;
5. refreshes Pons lifecycle/catalog state;
6. runs lifecycle and story analysis;
7. publishes `railway-observer` status;
8. exposes `/health` and `/ready`.

The worker uses backoff on RPC failure and reports degraded state instead of fabricating fresh data.

## Evidence path

```text
RPC / Pons source
  -> normalized source row
  -> chain parser / rule engine
  -> deduplicated event + lifecycle row
  -> public state/feed response
  -> Realtime update to every visitor
```

