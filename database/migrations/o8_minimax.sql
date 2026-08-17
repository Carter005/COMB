update public.o8_system_bindings
set status = 'CONNECTED',
    truth = 'SYSTEM',
    details = jsonb_build_object(
      'providerConfigured', true,
      'provider', 'MiniMax',
      'model', 'MiniMax-M3',
      'endpointRegion', 'CN'
    ),
    updated_at = now()
where id = 'minimax';

update public.o8_arms
set mood_reason = case id
  when 8 then 'ARCHIVE memory and voice routing are ready; Robinhood Chain remains unbound'
  else agent_name || ' is available for routed questions; Robinhood Chain source is not configured'
end,
last_event_at = now();

delete from public.o8_events
where type = 'system_heartbeat' and text ilike '%MiniMax remain%unbound%';

insert into public.o8_events(type, source, truth, text, metadata)
select 'agent_voice_registry', 'O8-SYSTEM', 'SYSTEM',
  'WATCHER, CURRENT, DEPTH, CHORUS, AUDITOR, HUNTER, KEEPER, and ARCHIVE are registered for routed questions.',
  '{"agents":["WATCHER","CURRENT","DEPTH","CHORUS","AUDITOR","HUNTER","KEEPER","ARCHIVE"],"voiceRouting":"READY"}'::jsonb
where not exists (
  select 1 from public.o8_events
  where type = 'agent_voice_registry'
);

create or replace function public.o8_tick()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  specimen public.o8_specimen%rowtype;
  inserted_event_id bigint;
  next_tick bigint;
  provider_configured boolean := false;
  chain_configured boolean := false;
begin
  select * into specimen from public.o8_specimen where id = 'o8' for update;
  select coalesce((details->>'providerConfigured')::boolean, false)
    into provider_configured from public.o8_system_bindings where id = 'minimax';
  select coalesce((details->>'rpcConfigured')::boolean, false)
    into chain_configured from public.o8_system_bindings where id = 'robinhood-chain';

  if specimen.updated_at > now() - interval '12 seconds' then
    return jsonb_build_object('advanced', false, 'tick', specimen.tick_count);
  end if;

  next_tick := specimen.tick_count + 1;

  if next_tick % 20 = 0 then
    update public.o8_specimen
      set coherence = greatest(78, least(96, coherence + (random() * 1.4 - 0.4))),
          identity_drift = greatest(0.3, least(8, identity_drift + (random() * 0.3 - 0.1))),
          next_sync_at = now() + interval '5 minutes'
    where id = 'o8';
    insert into public.o8_events(type, source, truth, text, metadata)
    values (
      'memory_sync', 'ARM-08', 'SYSTEM',
      case when provider_configured
        then 'ARCHIVE synchronized retained records. voice routing is ready; no interpretation was executed during this heartbeat.'
        else 'ARCHIVE synchronized retained records. no agent interpretation was executed.' end,
      jsonb_build_object('agent', 'ARCHIVE', 'voiceRoutingReady', provider_configured)
    ) returning id into inserted_event_id;
  elsif next_tick % 5 = 0 then
    insert into public.o8_events(type, source, truth, text, metadata)
    values (
      'system_heartbeat', 'O8-SYSTEM', 'SYSTEM',
      concat(
        'scheduler heartbeat retained. Robinhood Chain is ',
        case when chain_configured then 'connected' else 'unbound' end,
        '; ARCHIVE is ',
        case when provider_configured then 'active.' else 'dormant.' end
      ),
      jsonb_build_object('tick', next_tick, 'chainConfigured', chain_configured, 'archiveActive', provider_configured)
    ) returning id into inserted_event_id;
  end if;

  update public.o8_specimen
    set tick_count = next_tick,
        next_scan_at = case when next_scan_at <= now() then now() + interval '60 seconds' else next_scan_at end,
        updated_at = now()
  where id = 'o8';

  delete from public.o8_events where id in (select id from public.o8_events order by id desc offset 500);
  return jsonb_build_object('advanced', true, 'eventId', inserted_event_id, 'tick', next_tick);
end;
$$;

revoke all on function public.o8_tick() from public, anon, authenticated;
grant execute on function public.o8_tick() to service_role;
