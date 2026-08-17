insert into public.o8_sources(id, label, kind, truth, status, latency_ms, payload)
values (
  'robinhood-mainnet',
  'Robinhood Chain mainnet RPC',
  'evm-json-rpc',
  'CONNECTED',
  'CONNECTING',
  null,
  '{"chainId":4663,"rpc":"https://rpc.mainnet.chain.robinhood.com","explorer":"https://robinhoodchain.blockscout.com"}'::jsonb
)
on conflict (id) do update set
  label = excluded.label,
  kind = excluded.kind,
  truth = excluded.truth;

create or replace function public.o8_claim_source_refresh(p_source_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  update public.o8_sources
    set last_checked_at = now()
  where id = p_source_id
    and last_checked_at < now() - interval '8 seconds';
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

create or replace function public.o8_ingest_robinhood(
  p_block_number bigint,
  p_block_hash text,
  p_parent_hash text,
  p_timestamp timestamptz,
  p_tx_count integer,
  p_gas_used numeric,
  p_gas_limit numeric,
  p_base_fee_wei numeric,
  p_l1_block_number bigint,
  p_latency_ms integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_hash text;
  inserted_event_id bigint;
begin
  select payload->>'blockHash' into previous_hash
  from public.o8_sources where id = 'robinhood-mainnet' for update;

  update public.o8_sources
  set status = 'CONNECTED',
      latency_ms = p_latency_ms,
      last_checked_at = now(),
      payload = jsonb_build_object(
        'chainId', 4663,
        'network', 'Robinhood Chain Mainnet',
        'rpc', 'https://rpc.mainnet.chain.robinhood.com',
        'explorer', 'https://robinhoodchain.blockscout.com',
        'blockNumber', p_block_number,
        'blockHash', p_block_hash,
        'parentHash', p_parent_hash,
        'blockTimestamp', p_timestamp,
        'transactionCount', p_tx_count,
        'gasUsed', p_gas_used,
        'gasLimit', p_gas_limit,
        'baseFeeWei', p_base_fee_wei,
        'l1BlockNumber', p_l1_block_number
      )
  where id = 'robinhood-mainnet';

  update public.o8_system_bindings
  set status = 'CONNECTED',
      details = jsonb_build_object(
        'rpcConfigured', true,
        'chainId', 4663,
        'network', 'Robinhood Chain Mainnet',
        'rpc', 'https://rpc.mainnet.chain.robinhood.com',
        'explorer', 'https://robinhoodchain.blockscout.com',
        'nativeCurrency', 'ETH'
      ),
      updated_at = now()
  where id = 'robinhood-chain';

  update public.o8_arms
  set state = case when id = 1 then 'OBSERVING' when id = 8 then 'REMEMBERING' else state end,
      node_name = case when id in (1, 8) then 'ROBINHOOD-MAINNET' else node_name end,
      latency_ms = case when id = 1 then p_latency_ms else latency_ms end,
      packet_loss = 0,
      route_confidence = case when id in (1, 8) then 1 else route_confidence end,
      mood = case when id = 1 then 'focused' else mood end,
      mood_reason = case
        when id = 1 then 'WATCHER is receiving verified Robinhood Chain mainnet blocks'
        when id = 8 then 'ARCHIVE is preserving verified Robinhood Chain block evidence'
        else agent_name || ' can access verified blocks and awaits domain-specific evidence'
      end,
      last_event_at = now()
  where id between 1 and 8;

  if previous_hash is distinct from p_block_hash
    and not exists (
      select 1 from public.o8_events
      where type = 'chain_block'
        and created_at > now() - interval '10 seconds'
    ) then
    insert into public.o8_events(type, source, truth, text, metadata)
    values (
      'chain_block',
      'ARM-01',
      'CONNECTED',
      'WATCHER observed Robinhood Chain block ' || p_block_number || ' containing ' || p_tx_count || ' transactions.',
      jsonb_build_object(
        'chainId', 4663,
        'blockNumber', p_block_number,
        'blockHash', p_block_hash,
        'transactionCount', p_tx_count,
        'explorerUrl', 'https://robinhoodchain.blockscout.com/block/' || p_block_number
      )
    ) returning id into inserted_event_id;
  end if;

  return jsonb_build_object('changed', previous_hash is distinct from p_block_hash, 'eventId', inserted_event_id, 'blockNumber', p_block_number);
end;
$$;

create or replace function public.o8_mark_source_degraded(p_source_id text, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.o8_sources
  set status = 'DEGRADED',
      last_checked_at = now(),
      payload = payload || jsonb_build_object('lastError', left(p_reason, 180))
  where id = p_source_id;
end;
$$;

revoke all on function public.o8_claim_source_refresh(text) from public, anon, authenticated;
revoke all on function public.o8_ingest_robinhood(bigint, text, text, timestamptz, integer, numeric, numeric, numeric, bigint, integer) from public, anon, authenticated;
revoke all on function public.o8_mark_source_degraded(text, text) from public, anon, authenticated;
grant execute on function public.o8_claim_source_refresh(text) to service_role;
grant execute on function public.o8_ingest_robinhood(bigint, text, text, timestamptz, integer, numeric, numeric, numeric, bigint, integer) to service_role;
grant execute on function public.o8_mark_source_degraded(text, text) to service_role;
