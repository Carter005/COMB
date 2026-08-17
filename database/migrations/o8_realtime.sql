do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'o8_sources',
    'o8_events',
    'o8_specimen',
    'o8_arms',
    'o8_system_bindings',
    'o8_fragments',
    'o8_token_targets',
    'o8_token_lifecycle_snapshots'
  ] loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;

insert into public.o8_system_bindings(id, label, status, truth, details)
values (
  'railway-observer',
  'O8 persistent chain observer',
  'CONFIGURING',
  'SYSTEM',
  jsonb_build_object(
    'runtime', 'Railway',
    'pollIntervalMs', 1000,
    'delivery', 'Supabase Realtime',
    'publicRpcRequestsFromBrowser', false
  )
)
on conflict (id) do update set
  label = excluded.label,
  status = excluded.status,
  truth = excluded.truth,
  details = public.o8_system_bindings.details || excluded.details,
  updated_at = now();
