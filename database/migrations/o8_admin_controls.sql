insert into public.o8_system_bindings(id, label, status, truth, details)
values ('public-links', 'O8 public links', 'UNBOUND', 'SYSTEM', '{"twitterUrl":null}'::jsonb)
on conflict (id) do nothing;

create or replace function public.o8_clear_pons_token()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_address text;
begin
  select token_address into previous_address from public.o8_token_targets where id = 'o8' for update;
  if previous_address is not null then
    delete from public.o8_events where lower(coalesce(metadata->>'tokenAddress', '')) = lower(previous_address);
  end if;
  delete from public.o8_token_lifecycle_snapshots where target_id = 'o8';

  update public.o8_token_targets set
    symbol = 'O8', token_name = null, token_address = null, status = 'AWAITING_LAUNCH',
    deployer_address = null, pool_address = null, launch_tx_hash = null, launch_block = null,
    launched_at = null, initial_buy_wei = null, position_id = null, restrictions_end_block = null,
    graduation_progress = null, paired_principal_wei = null, graduated = false,
    price_usd = null, market_cap_usd = null,
    metadata = jsonb_build_object('launchpadUrl', 'https://www.ponsfamily.com/launchpad', 'coverage', 'FACTORY_VERIFIED'),
    updated_at = now()
  where id = 'o8';

  update public.o8_system_bindings set
    status = 'AWAITING_LAUNCH',
    details = jsonb_build_object('symbol', 'O8', 'contractAddress', null, 'launchpad', 'PONS', 'factory', '0xA5aAb3F0c6EeadF30Ef1D3Eb997108E976351feB'),
    updated_at = now()
  where id = 'o8-token';

  return jsonb_build_object('cleared', previous_address is not null, 'previousAddress', previous_address, 'status', 'AWAITING_LAUNCH');
end;
$$;

revoke all on function public.o8_clear_pons_token() from public, anon, authenticated;
grant execute on function public.o8_clear_pons_token() to service_role;
