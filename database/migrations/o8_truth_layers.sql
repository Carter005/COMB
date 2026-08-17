-- O8 evidence-layer cleanup: stop synthetic public heartbeat records and random narrative metrics.
-- This only affects the AAA / O8 schema and leaves chain ingestion untouched.

create or replace function public.o8_tick()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  specimen public.o8_specimen%rowtype;
  next_tick bigint;
begin
  select * into specimen from public.o8_specimen where id = 'o8' for update;

  if specimen.updated_at > now() - interval '12 seconds' then
    return jsonb_build_object('advanced', false, 'heartbeat', specimen.tick_count);
  end if;

  next_tick := specimen.tick_count + 1;

  -- This counter is an observer heartbeat only. It is not an AI inference count.
  update public.o8_specimen
    set tick_count = next_tick,
        next_scan_at = case when next_scan_at <= now() then now() + interval '60 seconds' else next_scan_at end,
        next_sync_at = now() + interval '5 minutes',
        updated_at = now()
  where id = 'o8';

  return jsonb_build_object('advanced', true, 'heartbeat', next_tick);
end;
$$;

revoke all on function public.o8_tick() from public, anon, authenticated;
grant execute on function public.o8_tick() to service_role;

-- Remove seeded/synthetic public records. Future public memory is sourced from
-- verified chain events, deterministic parser records, or explicit AI queries.
delete from public.o8_events
where type in ('system_heartbeat', 'memory_sync', 'agent_registry', 'agent_voice_registry', 'provider_connected');

delete from public.o8_fragments;
