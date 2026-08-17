# COMB Restoration Guide

This is the authoritative handoff document. Historical files using `O8` describe the project lineage only; current public identity, language, and design are COMB.

## Identity And Story

COMB is an evidence hive on Robinhood Chain.

- Eight AI bee Scouts observe different evidence domains.
- One verified Pons V2 contract address is bound through the admin terminal.
- The hive retains verified chain facts, deterministic lifecycle interpretation, Scout disagreement, community proposals, and actual observer incidents.
- A visitor can invoke one Scout through ASK. AI answers are grounded in retained evidence and do not alter it.
- Canonical public line: `THE HIVE REMEMBERS.`
- Operating line: `EVIDENCE BEFORE ACTION.`

The eight Scouts are: SCOUT, NECTAR, COMB, SWARM, WING, STING, KEEPER, and ARCHIVE.

## Truth Model

| Layer | Meaning |
| --- | --- |
| `CHAIN` | Direct Robinhood Chain RPC or on-chain contract fact. |
| `CONNECTED` | Verified external source, including Pons catalog/factory data. |
| `RULE` | Deterministic lifecycle, milestone, memory, or incident interpretation. |
| `SYSTEM` | Infrastructure and scheduler health. |
| `AI` | On-request Scout interpretation with evidence citations. |
| `VISUAL` | Decorative motion only. Never present it as evidence. |

Never infer price direction, intent, holders, safety, or coordination without retained evidence.

## Visual Contract

- Full viewport terminal, not a marketing landing page.
- Palette is only near-black `#050505` and off-white `#e8e8e8` with opacity variations.
- One monospace stack: IBM Plex Mono, Cascadia Mono, Consolas, system monospace.
- Thin square rules, no gradients, no rounded cards, no neon, no decorative color.
- Current logo asset: `public/comb-logo.png`; browser favicon uses the same file.
- Social banner: `public/comb-x-banner.png` and `.svg`.
- All public UI copy is English.

## Architecture

```text
Robinhood Chain RPC + Pons V2
              |
      Railway / railway/worker.js
              |
          Supabase tables + Realtime
              |
Vercel API (/api/o8/*) -> React terminal + admin
```

- `src/App.jsx`: public terminal, evidence feed, Scout drawers, community proposal form, memory-card download.
- `src/Admin.jsx`: CA binding/reset, X link, Community Memory review queue.
- `api/o8/state.js`: canonical public read model.
- `api/o8/feed.js`: resilient merged feed from events, lifecycle, milestones, and micro-milestones.
- `api/o8/review-memory.js`: authenticated proposal accept/decline; accepted proposals become `COMMUNITY_MEMORY` Hive Cells.
- `railway/worker.js`: centralized polling, lifecycle refresh, and persisted real observer degradation/recovery records.
- `database/migrations/`: Supabase migration history. Preserve and apply safely; do not overwrite historical tables.

## Narrative Loops Already Built

1. **Target binding**: `/admin` accepts a Pons CA, verifies it, and can clear/reset it.
2. **Observation**: Railway reads chain state; the visitor never spams public RPC.
3. **Memory**: lifecycle events, milestones, Hive Cells, and Feed persist across refreshes.
4. **Eight Scouts**: ARM-01 through ARM-08 evidence is routed to the correct Scout drawer.
5. **Community Memory**: visitors propose questions; admins accept or decline; accepted proposals become retained Hive Cells.
6. **Foragers**: persisted forager identities appear in the Archive ledger when observed.
7. **Share**: an event drawer can download a monochrome `COMB / HIVE MEMORY` PNG card.
8. **Observer honesty**: real Railway degradation and recovery are retained as Rule-layer incidents.

## Operations

1. Keep Vercel server variables set: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `O8_ADMIN_SECRET`, `CRON_SECRET`, `MINIMAX_API_KEY`, `MINIMAX_MODEL`.
2. Keep browser variables set: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Keep Railway server variables equal to the worker-required variables plus timing values from `.env.example`.
4. Deploy frontend/API: `npx vercel --prod --yes`.
5. Deploy observer after linking Railway: `npx @railway/cli up --service comb-observer`.
6. Verify after every production change:
   - `GET /api/o8/state` returns `200`.
   - `GET /api/o8/feed?limit=40` returns persisted records.
   - Railway reports `comb-observer` as Online and advances `lastPollAt`.

## Future Change Rules

- Prefer persisted data and deterministic interpretation over simulated UX.
- Use a database migration for schema changes and make it idempotent.
- Do not clear target data except through the admin reset workflow.
- When adding a narrative feature, identify its evidence source, truth layer, persistence point, UI read model, and reset behavior first.
- Keep legacy `o8_*` table/API names for compatibility unless a deliberate migration is planned. Public terminology must say COMB.
