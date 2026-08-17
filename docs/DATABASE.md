# Supabase O8/AAA database

## Safety

The user-designated database is the O8/AAA Supabase project. Only operate there. Never use a migration or script against another project. Service-role access is server-side only and must be supplied through environment variables.

## Main tables

- `o8_specimen` — organism status and heartbeat.
- `o8_arms` — eight arm registry, role, state, mood metadata.
- `o8_sources` — source health and latest payload.
- `o8_events` — normalized feed events with truth layer and metadata.
- `o8_token_targets` — replaceable target CA and Pons lifecycle state.
- `o8_lifecycle_events` — deduplicated phase transitions.
- `o8_story_state` / `o8_story_milestones` — historical highs, retreats, silence/gaps, baselines, deviations.
- `o8_target_block_snapshots` — target-scoped trace samples.
- `o8_dissent_records` — eight deterministic phase positions.
- `o8_system_bindings` — public status/config such as chain, Pons, Railway, AI voices, and X link.
- AI tables — prompts, questions, responses, evidence references, and model metadata.

## Migration order

Apply these idempotent SQL files in order:

1. `o8_schema.sql`
2. `o8_public_agent_voice.sql`
3. `o8_ai_agents.sql`
4. `o8_minimax.sql`
5. `o8_remove_usgs.sql`
6. `o8_ingest_scheduler.sql`
7. `o8_chain_analysis.sql`
8. `o8_pons_launchpad.sql`
9. `o8_admin_controls.sql`
10. `o8_realtime.sql`
11. `o8_robinhood_chain.sql`
12. `o8_target_monitoring.sql`
13. `o8_truth_layers.sql`
14. `o8_story_upgrade.sql`
15. `o8_lifecycle_enhancements.sql`
16. `o8_target_trace_realtime.sql`

If the live database is ahead, inspect objects before applying anything. Do not reset or truncate the project to make a migration pass.

## Target workflow

1. Admin registers a candidate CA through the protected route/UI.
2. Pons catalog and factory/pool data are verified.
3. Railway backfills and begins target-scoped observation.
4. Lifecycle state and evidence are deduplicated by target/event key.
5. Admin can clear the target for another test without deleting the global chain record.

## Realtime

`o8_realtime.sql` adds the public tables to the Realtime publication. The frontend listens to changes and uses REST as a fallback. If the UI is stale, test the worker heartbeat and Realtime publication before adding browser-side RPC polling.

