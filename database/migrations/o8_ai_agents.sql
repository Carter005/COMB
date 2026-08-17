alter table public.o8_arms add column if not exists agent_name text;
alter table public.o8_arms add column if not exists domain text;
alter table public.o8_arms add column if not exists temperament text;
alter table public.o8_arms add column if not exists mood text;
alter table public.o8_arms add column if not exists mood_reason text;
alter table public.o8_arms add column if not exists voice text;

update public.o8_arms set
  agent_name = case id
    when 1 then 'WATCHER' when 2 then 'CURRENT' when 3 then 'DEPTH' when 4 then 'CHORUS'
    when 5 then 'AUDITOR' when 6 then 'HUNTER' when 7 then 'KEEPER' when 8 then 'ARCHIVE' end,
  domain = case id
    when 1 then 'blocks, RPC, finality, network health'
    when 2 then 'capital flow, swaps, volume, momentum'
    when 3 then 'liquidity, pool depth, slippage, LP changes'
    when 4 then 'holders, wallet distribution, participation'
    when 5 then 'contracts, permissions, mint and upgrade risk'
    when 6 then 'anomalies, bots, coordinated wallets, funding origin'
    when 7 then 'treasury, reserves, operational runway'
    when 8 then 'routing, memory, consensus, dissent' end,
  temperament = case id
    when 1 then 'clinical' when 2 then 'energetic' when 3 then 'cautious' when 4 then 'curious'
    when 5 then 'skeptical' when 6 then 'investigative' when 7 then 'protective' when 8 then 'composed' end,
  mood = case id
    when 1 then 'focused' when 2 then 'restless' when 3 then 'guarded' when 4 then 'curious'
    when 5 then 'suspicious' when 6 then 'tracking' when 7 then 'watchful' when 8 then 'composed' end,
  mood_reason = case id
    when 8 then 'memory service active; no model provider connected'
    else 'Robinhood Chain source is not configured' end,
  voice = case id
    when 1 then 'short, exact, timestamped'
    when 2 then 'fast, directional, momentum-sensitive'
    when 3 then 'conditional, conservative, fragility-aware'
    when 4 then 'socially attentive, comparative, questioning'
    when 5 then 'blunt, literal, authority-sensitive'
    when 6 then 'sequential, investigative, relationship-focused'
    when 7 then 'restrained, pragmatic, reserve-first'
    when 8 then 'structured, reflective, dissent-preserving' end,
  role = case id
    when 1 then 'block observer' when 2 then 'flow interpreter' when 3 then 'liquidity analyst' when 4 then 'holder observer'
    when 5 then 'contract auditor' when 6 then 'anomaly hunter' when 7 then 'reserve keeper' when 8 then 'memory synthesizer' end,
  state = case when id = 8 then 'REMEMBERING' else 'STANDBY' end,
  node_name = case when id = 8 then 'O8-MEMORY' else 'ROBINHOOD-UNBOUND' end,
  latency_ms = case when id = 8 then 0 else 0 end,
  packet_loss = 0,
  route_confidence = case when id = 8 then 1 else 0 end,
  last_event_at = now();

update public.o8_fragments set summary = case status
  when 'preserved' then 'MiniMax-M3 provider binding verified and retained'
  when 'disputed' then 'chain interpretation unavailable until Robinhood RPC binding'
  when 'compressed' then 'system heartbeat reduced to tick, timestamp, and source health'
  when 'lost' then 'no model interpretation exists before provider configuration'
end;

delete from public.o8_events
where type in ('route_degraded', 'route_changed', 'source_reading', 'observation');

insert into public.o8_events(type, source, truth, text, metadata)
select 'agent_registry', 'O8-SYSTEM', 'SYSTEM',
  'eight-agent registry initialized. Robinhood Chain remains unbound; $O8 remains unminted.',
  '{"agents":8,"activeAgents":1}'::jsonb
where not exists (select 1 from public.o8_events where type = 'agent_registry');

alter table public.o8_arms alter column agent_name set not null;
alter table public.o8_arms alter column domain set not null;
alter table public.o8_arms alter column temperament set not null;
alter table public.o8_arms alter column mood set not null;
alter table public.o8_arms alter column mood_reason set not null;
alter table public.o8_arms alter column voice set not null;

create table if not exists public.o8_system_bindings (
  id text primary key,
  label text not null,
  status text not null,
  truth text not null default 'SYSTEM',
  details jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.o8_system_bindings(id, label, status, details) values
  ('robinhood-chain', 'Robinhood Chain', 'AWAITING_CONFIGURATION', '{"rpcConfigured":false,"chainId":null}'::jsonb),
  ('minimax', 'MiniMax AI', 'AWAITING_API_KEY', '{"providerConfigured":false,"model":null}'::jsonb),
  ('o8-token', '$O8 Token', 'UNMINTED', '{"contractAddress":null,"symbol":"O8"}'::jsonb)
on conflict (id) do update set label = excluded.label;

create table if not exists public.o8_conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.o8_messages (
  id bigint generated by default as identity primary key,
  conversation_id uuid not null references public.o8_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'agent', 'o8', 'system')),
  agent_id smallint references public.o8_arms(id),
  content text not null,
  evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.o8_agent_runs (
  id bigint generated by default as identity primary key,
  conversation_id uuid references public.o8_conversations(id) on delete set null,
  agent_id smallint not null references public.o8_arms(id),
  mood text not null,
  provider text,
  model text,
  status text not null,
  input_evidence jsonb not null default '[]'::jsonb,
  interpretation text,
  confidence numeric(4,3),
  latency_ms integer,
  token_usage jsonb,
  created_at timestamptz not null default now()
);

create index if not exists o8_messages_conversation_idx on public.o8_messages(conversation_id, id);
create index if not exists o8_agent_runs_conversation_idx on public.o8_agent_runs(conversation_id, id);

alter table public.o8_system_bindings enable row level security;
alter table public.o8_conversations enable row level security;
alter table public.o8_messages enable row level security;
alter table public.o8_agent_runs enable row level security;

drop policy if exists "o8 public read bindings" on public.o8_system_bindings;
create policy "o8 public read bindings" on public.o8_system_bindings for select to anon, authenticated using (true);

grant select on public.o8_system_bindings to anon, authenticated;
grant all on public.o8_system_bindings, public.o8_conversations, public.o8_messages, public.o8_agent_runs to service_role;
grant usage, select on all sequences in schema public to service_role;

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
begin
  select * into specimen from public.o8_specimen where id = 'o8' for update;

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
      'ARCHIVE synchronized retained records. no agent interpretation was executed.',
      jsonb_build_object('agent', 'ARCHIVE', 'providerConfigured', false)
    ) returning id into inserted_event_id;
  elsif next_tick % 5 = 0 then
    insert into public.o8_events(type, source, truth, text, metadata)
    values (
      'system_heartbeat', 'O8-SYSTEM', 'SYSTEM',
      'scheduler heartbeat retained. Robinhood Chain and MiniMax remain unbound.',
      jsonb_build_object('tick', next_tick)
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
