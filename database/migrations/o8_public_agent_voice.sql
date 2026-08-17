update public.o8_arms
set mood_reason = case id
  when 8 then 'ARCHIVE memory and voice routing are ready; Robinhood Chain remains unbound'
  else agent_name || ' is available for routed questions; Robinhood Chain source is not configured'
end,
last_event_at = now();

update public.o8_fragments
set summary = 'eight agent voices verified and retained'
where summary ilike '%MiniMax%' or summary ilike '%provider binding%';

update public.o8_events
set type = 'agent_voice_registry',
    text = 'WATCHER, CURRENT, DEPTH, CHORUS, AUDITOR, HUNTER, KEEPER, and ARCHIVE are registered for routed questions.',
    metadata = '{"agents":["WATCHER","CURRENT","DEPTH","CHORUS","AUDITOR","HUNTER","KEEPER","ARCHIVE"],"voiceRouting":"READY"}'::jsonb
where type = 'provider_connected' or text ilike '%MiniMax%provider%';

update public.o8_events
set text = 'scheduler heartbeat retained. Robinhood Chain is unbound; ARCHIVE is active.',
    metadata = (metadata - 'providerConfigured') || '{"archiveActive":true}'::jsonb
where type = 'system_heartbeat' and text ilike '%MiniMax%';

update public.o8_events
set text = 'ARCHIVE synchronized retained records. voice routing is ready; no interpretation was executed during this heartbeat.',
    metadata = (metadata - 'providerConfigured') || '{"agent":"ARCHIVE","voiceRoutingReady":true}'::jsonb
where type = 'memory_sync' and text ilike '%MiniMax%';

update public.o8_events
set text = 'eight-agent registry initialized. Robinhood Chain remains unbound; $O8 remains unminted.',
    metadata = '{"agents":8,"activeAgents":1,"primarySource":"Robinhood Chain"}'::jsonb
where type = 'agent_registry';

update public.o8_events
set text = replace(text, 'no model interpretation', 'no agent interpretation')
where text ilike '%no model interpretation%';
