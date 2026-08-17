create table if not exists public.o8_target_block_snapshots (
  target_address text not null,
  block_number bigint not null,
  pool_address text,
  target_status text not null,
  metrics jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  primary key (target_address, block_number)
);

alter table public.o8_messages add column if not exists context_target_address text;
alter table public.o8_agent_runs add column if not exists target_address text;
create index if not exists o8_messages_target_idx on public.o8_messages(context_target_address, id);
create index if not exists o8_agent_runs_target_idx on public.o8_agent_runs(target_address, id);

create index if not exists o8_target_snapshots_recent_idx
  on public.o8_target_block_snapshots(target_address, block_number desc);

alter table public.o8_target_block_snapshots enable row level security;
drop policy if exists "o8 public read target snapshots" on public.o8_target_block_snapshots;
create policy "o8 public read target snapshots" on public.o8_target_block_snapshots
  for select to anon, authenticated using (true);
grant select on public.o8_target_block_snapshots to anon, authenticated;
grant all on public.o8_target_block_snapshots to service_role;

insert into public.o8_system_bindings(id, label, status, truth, details)
values (
  'target-monitor', 'O8 CA target monitor', 'AWAITING_LAUNCH', 'CONNECTED',
  '{"mode":"NETWORK","tokenAddress":null,"poolAddress":null}'::jsonb
)
on conflict (id) do nothing;

create or replace function public.o8_ingest_target_snapshot(p_snapshot jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b jsonb := p_snapshot->'block';
  t jsonb := p_snapshot->'target';
  current_block bigint := nullif(b->>'blockNumber', '')::bigint;
  supplied_token text := lower(t->>'tokenAddress');
  supplied_pool text := nullif(lower(t->>'poolAddress'), '');
  registered_token text;
  registered_pool text;
  registered_status text;
  inserted_rows integer := 0;
  common_metadata jsonb;
begin
  if t is null or supplied_token is null or current_block is null then
    return jsonb_build_object('accepted', false, 'reason', 'target missing');
  end if;

  select lower(token_address), lower(pool_address), status
    into registered_token, registered_pool, registered_status
  from public.o8_token_targets where id = 'o8';

  if registered_token is null or registered_token <> supplied_token
     or registered_status not in ('CURVE_ACTIVE', 'GRADUATED') then
    return jsonb_build_object('accepted', false, 'reason', 'target is not active');
  end if;

  if registered_pool is distinct from supplied_pool then
    return jsonb_build_object('accepted', false, 'reason', 'pool mismatch');
  end if;

  insert into public.o8_target_block_snapshots(
    target_address, block_number, pool_address, target_status, metrics
  ) values (
    supplied_token, current_block, supplied_pool, registered_status, t
  ) on conflict (target_address, block_number) do nothing;
  get diagnostics inserted_rows = row_count;
  if inserted_rows = 0 then
    return jsonb_build_object('accepted', true, 'duplicate', true, 'blockNumber', current_block);
  end if;

  common_metadata := jsonb_build_object(
    'tokenAddress', supplied_token,
    'poolAddress', supplied_pool,
    'blockNumber', current_block,
    'coverage', 'TARGET_SCOPED',
    'transactionHashes', coalesce(t->'transactionHashes', '[]'::jsonb)
  );

  update public.o8_system_bindings set
    status = 'TARGET_ACTIVE',
    details = jsonb_build_object(
      'mode', 'TARGET', 'tokenAddress', supplied_token, 'poolAddress', supplied_pool,
      'stage', registered_status, 'lastObservedBlock', current_block
    ),
    updated_at = now()
  where id = 'target-monitor';

  update public.o8_arms set
    state = 'OBSERVING',
    node_name = case id
      when 2 then 'O8-TOKEN-FLOW'
      when 3 then case when registered_status = 'GRADUATED' then 'O8-V3-POOL' else 'O8-PONS-CURVE' end
      when 4 then 'O8-HOLDER-DELTA'
      when 5 then 'O8-CONTRACT'
      when 6 then 'O8-ANOMALY-RULES'
      when 7 then 'O8-POOL-RESERVE'
    end,
    route_confidence = 1,
    last_event_at = now(),
    mood_reason = case id
      when 2 then 'CURRENT is measuring transfers involving the registered O8 token and pool'
      when 3 then 'DEPTH is measuring the verified Pons curve or graduated pool'
      when 4 then 'CHORUS is measuring sampled participant changes for the registered O8 token'
      when 5 then 'AUDITOR is inspecting calls and known administrative selectors scoped to the O8 contract'
      when 6 then 'HUNTER is testing explicit rules against O8-scoped transactions'
      when 7 then 'KEEPER is retaining verified curve principal and pool activity without claiming treasury ownership'
    end
  where id between 2 and 7;

  if coalesce((t->>'transactionCount')::integer, 0) > 0
     or coalesce((t->>'tokenTransferCount')::integer, 0) > 0
     or coalesce((t->>'poolEventCount')::integer, 0) > 0 then
    insert into public.o8_events(type, source, truth, text, metadata) values (
      'target_activity', 'ARM-01', 'CONNECTED',
      'WATCHER retained O8-scoped activity in block ' || current_block || ': ' ||
        coalesce(t->>'transactionCount', '0') || ' relevant transactions, ' ||
        coalesce(t->>'tokenTransferCount', '0') || ' token transfers, and ' ||
        coalesce(t->>'poolEventCount', '0') || ' pool events.',
      common_metadata || jsonb_build_object(
        'transactionCount', coalesce((t->>'transactionCount')::integer, 0),
        'tokenTransferCount', coalesce((t->>'tokenTransferCount')::integer, 0),
        'poolEventCount', coalesce((t->>'poolEventCount')::integer, 0)
      )
    );
  end if;

  if coalesce((t->>'tokenTransferCount')::integer, 0) > 0 then
    insert into public.o8_events(type, source, truth, text, metadata) values (
      'target_flow', 'ARM-02', 'CONNECTED',
      'CURRENT measured O8 token movements in block ' || current_block || ': ' ||
        coalesce(t->>'buyTransferCount', '0') || ' pool-to-wallet transfers, ' ||
        coalesce(t->>'sellTransferCount', '0') || ' wallet-to-pool transfers, and ' ||
        coalesce(t->>'tokenTransferCount', '0') || ' token transfers in total.',
      common_metadata || jsonb_build_object(
        'tokenTransferCount', coalesce((t->>'tokenTransferCount')::integer, 0),
        'transferVolumeRaw', coalesce(t->>'transferVolumeRaw', '0'),
        'buyTransferCount', coalesce((t->>'buyTransferCount')::integer, 0),
        'buyVolumeRaw', coalesce(t->>'buyVolumeRaw', '0'),
        'sellTransferCount', coalesce((t->>'sellTransferCount')::integer, 0),
        'sellVolumeRaw', coalesce(t->>'sellVolumeRaw', '0')
      )
    );
  end if;

  if coalesce((t->>'poolSwapCount')::integer, 0) > 0 then
    insert into public.o8_events(type, source, truth, text, metadata) values (
      'target_liquidity', 'ARM-03', 'CONNECTED',
      'DEPTH observed ' || coalesce(t->>'poolSwapCount', '0') ||
        ' verified swap events in the registered O8 pool during block ' || current_block || '.',
      common_metadata || jsonb_build_object(
        'poolSwapCount', coalesce((t->>'poolSwapCount')::integer, 0),
        'poolEventCount', coalesce((t->>'poolEventCount')::integer, 0),
        'stage', registered_status
      )
    );
  end if;

  if coalesce((t->>'uniqueParticipantCount')::integer, 0) > 0 then
    insert into public.o8_events(type, source, truth, text, metadata) values (
      'target_participants', 'ARM-04', 'CONNECTED',
      'CHORUS observed ' || coalesce(t->>'uniqueParticipantCount', '0') ||
        ' distinct non-pool participant addresses in sampled O8 transfers at block ' || current_block || '.',
      common_metadata || jsonb_build_object(
        'uniqueParticipantCount', coalesce((t->>'uniqueParticipantCount')::integer, 0),
        'scope', 'SAMPLED_BLOCK_PARTICIPANTS_NOT_TOTAL_HOLDERS'
      )
    );
  end if;

  if coalesce((t->>'failedTransactionCount')::integer, 0) > 0
     or coalesce((t->>'adminCallCount')::integer, 0) > 0 then
    insert into public.o8_events(type, source, truth, text, metadata) values (
      'target_contract', 'ARM-05', 'CONNECTED',
      'AUDITOR inspected O8-scoped calls in block ' || current_block || ': ' ||
        coalesce(t->>'failedTransactionCount', '0') || ' failed transactions and ' ||
        coalesce(t->>'adminCallCount', '0') || ' recognized administrative calls.',
      common_metadata || jsonb_build_object(
        'failedTransactionCount', coalesce((t->>'failedTransactionCount')::integer, 0),
        'adminCallCount', coalesce((t->>'adminCallCount')::integer, 0)
      )
    );
  end if;

  if coalesce((t->>'repeatedSenderCount')::integer, 0) > 0 then
    insert into public.o8_events(type, source, truth, text, metadata) values (
      'target_anomaly_rule', 'ARM-06', 'CONNECTED',
      'HUNTER found ' || coalesce(t->>'repeatedSenderCount', '0') ||
        ' O8-scoped senders with at least three relevant transactions inside block ' || current_block || '.',
      common_metadata || jsonb_build_object(
        'repeatedSenderCount', coalesce((t->>'repeatedSenderCount')::integer, 0),
        'rule', 'THREE_TARGET_TRANSACTIONS_IN_ONE_BLOCK'
      )
    );
  end if;

  if coalesce((t->>'mintTransferCount')::integer, 0) > 0
     or coalesce((t->>'burnTransferCount')::integer, 0) > 0
     or coalesce((t->>'poolEventCount')::integer, 0) > 0 then
    insert into public.o8_events(type, source, truth, text, metadata) values (
      'target_reserve_activity', 'ARM-07', 'CONNECTED',
      'KEEPER retained O8 supply and pool custody signals in block ' || current_block || ': ' ||
        coalesce(t->>'mintTransferCount', '0') || ' mint transfers, ' ||
        coalesce(t->>'burnTransferCount', '0') || ' burn transfers, and ' ||
        coalesce(t->>'poolEventCount', '0') || ' pool events. No treasury ownership is inferred.',
      common_metadata || jsonb_build_object(
        'mintTransferCount', coalesce((t->>'mintTransferCount')::integer, 0),
        'burnTransferCount', coalesce((t->>'burnTransferCount')::integer, 0),
        'poolEventCount', coalesce((t->>'poolEventCount')::integer, 0)
      )
    );
  end if;

  delete from public.o8_target_block_snapshots where (target_address, block_number) in (
    select target_address, block_number from public.o8_target_block_snapshots
    where target_address = supplied_token order by block_number desc offset 500
  );

  return jsonb_build_object(
    'accepted', true, 'duplicate', false, 'tokenAddress', supplied_token,
    'poolAddress', supplied_pool, 'blockNumber', current_block,
    'activity', coalesce((t->>'transactionCount')::integer, 0)
  );
end;
$$;

revoke all on function public.o8_ingest_target_snapshot(jsonb) from public, anon, authenticated;
grant execute on function public.o8_ingest_target_snapshot(jsonb) to service_role;

create or replace function public.o8_register_pons_token(p_token_address text, p_launch_tx_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_address text;
begin
  if p_token_address !~* '^0x[0-9a-f]{40}$' then
    raise exception 'invalid token address';
  end if;
  if p_launch_tx_hash is not null and p_launch_tx_hash !~* '^0x[0-9a-f]{64}$' then
    raise exception 'invalid launch transaction hash';
  end if;

  select lower(token_address) into previous_address from public.o8_token_targets where id = 'o8' for update;
  if previous_address is not null and previous_address <> lower(p_token_address) then
    delete from public.o8_events where lower(coalesce(metadata->>'tokenAddress', '')) = previous_address;
    delete from public.o8_token_lifecycle_snapshots where target_id = 'o8';
    delete from public.o8_target_block_snapshots where target_address = previous_address;
    delete from public.o8_agent_runs where lower(coalesce(target_address, '')) = previous_address;
    delete from public.o8_messages where lower(coalesce(context_target_address, '')) = previous_address;
  end if;

  update public.o8_token_targets set
    token_name = null,
    symbol = 'O8',
    token_address = lower(p_token_address),
    status = 'VERIFYING',
    deployer_address = null,
    pool_address = null,
    pair_token_address = null,
    launch_tx_hash = lower(p_launch_tx_hash),
    launch_block = null,
    launched_at = null,
    initial_buy_wei = null,
    total_supply = null,
    dex_id = null,
    launch_config_id = null,
    position_id = null,
    restrictions_end_block = null,
    pool_fee = null,
    graduation_progress = null,
    paired_principal_wei = null,
    graduation_threshold_wei = null,
    graduated = false,
    price_usd = null,
    market_cap_usd = null,
    metadata = jsonb_build_object('launchpadUrl', 'https://www.ponsfamily.com/launchpad', 'coverage', 'VERIFYING'),
    updated_at = now()
  where id = 'o8';

  update public.o8_system_bindings set
    status = 'VERIFYING',
    details = details || jsonb_build_object('contractAddress', lower(p_token_address), 'launchpad', 'PONS'),
    updated_at = now()
  where id = 'o8-token';

  update public.o8_system_bindings set
    status = 'VERIFYING',
    details = jsonb_build_object('mode', 'VERIFYING', 'tokenAddress', lower(p_token_address), 'poolAddress', null),
    updated_at = now()
  where id = 'target-monitor';

  return jsonb_build_object('registered', true, 'tokenAddress', lower(p_token_address), 'status', 'VERIFYING');
end;
$$;

create or replace function public.o8_clear_pons_token()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_address text;
begin
  select lower(token_address) into previous_address from public.o8_token_targets where id = 'o8' for update;
  if previous_address is not null then
    delete from public.o8_events where lower(coalesce(metadata->>'tokenAddress', '')) = previous_address;
    delete from public.o8_target_block_snapshots where target_address = previous_address;
    delete from public.o8_agent_runs where lower(coalesce(target_address, '')) = previous_address;
    delete from public.o8_messages where lower(coalesce(context_target_address, '')) = previous_address;
  end if;
  delete from public.o8_token_lifecycle_snapshots where target_id = 'o8';

  update public.o8_token_targets set
    symbol = 'O8', token_name = null, token_address = null, status = 'AWAITING_LAUNCH',
    deployer_address = null, pool_address = null, pair_token_address = null,
    launch_tx_hash = null, launch_block = null, launched_at = null,
    initial_buy_wei = null, total_supply = null, dex_id = null, launch_config_id = null,
    position_id = null, restrictions_end_block = null, pool_fee = null,
    graduation_progress = null, paired_principal_wei = null, graduation_threshold_wei = null,
    graduated = false,
    price_usd = null, market_cap_usd = null,
    metadata = jsonb_build_object('launchpadUrl', 'https://www.ponsfamily.com/launchpad', 'coverage', 'FACTORY_VERIFIED'),
    updated_at = now()
  where id = 'o8';

  update public.o8_system_bindings set
    status = 'AWAITING_LAUNCH',
    details = jsonb_build_object('symbol', 'O8', 'contractAddress', null, 'launchpad', 'PONS', 'factory', '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB'),
    updated_at = now()
  where id = 'o8-token';

  update public.o8_system_bindings set
    status = 'AWAITING_LAUNCH',
    details = jsonb_build_object('mode', 'NETWORK', 'tokenAddress', null, 'poolAddress', null),
    updated_at = now()
  where id = 'target-monitor';

  update public.o8_arms set
    state = case when id in (2, 5, 6) then 'OBSERVING' else 'STANDBY' end,
    node_name = case when id in (2, 5, 6) then 'ROBINHOOD-MAINNET' else 'AWAITING-O8-CA' end,
    route_confidence = case when id in (2, 5, 6) then 1 else 0 end,
    mood_reason = case id
      when 2 then 'CURRENT is measuring sampled Robinhood Chain blocks while O8 awaits launch'
      when 3 then 'DEPTH is waiting for a verified O8 pool'
      when 4 then 'CHORUS is waiting for a verified O8 token holder stream'
      when 5 then 'AUDITOR is inspecting sampled chain calls while O8 awaits launch'
      when 6 then 'HUNTER is testing sampled chain rules while O8 awaits launch'
      when 7 then 'KEEPER is waiting for verified O8 reserve and pool evidence'
    end,
    last_event_at = now()
  where id between 2 and 7;

  return jsonb_build_object(
    'cleared', previous_address is not null,
    'previousAddress', previous_address,
    'status', 'AWAITING_LAUNCH',
    'mode', 'NETWORK'
  );
end;
$$;

revoke all on function public.o8_register_pons_token(text, text) from public, anon, authenticated;
revoke all on function public.o8_clear_pons_token() from public, anon, authenticated;
grant execute on function public.o8_register_pons_token(text, text) to service_role;
grant execute on function public.o8_clear_pons_token() to service_role;
