delete from public.o8_events
where source = 'USGS'
   or type = 'external_signal'
   or truth in ('SYNTHETIC', 'CONNECTED');

delete from public.o8_sources
where id in ('usgs-seismic', 'buoy-04', 'east-09', 'system-health');

drop function if exists public.o8_ingest_usgs(text, integer, numeric, text, timestamptz, text, numeric, numeric, numeric, integer);

update public.o8_fragments
set summary = 'eight agent voices verified and retained'
where summary ilike '%USGS%' or summary ilike '%seismic%';

insert into public.o8_events(type, source, truth, text, metadata)
select 'source_registry', 'O8-SYSTEM', 'SYSTEM',
  'irrelevant external source removed. Robinhood Chain remains the sole planned market evidence channel.',
  '{"connectedSources":0,"primarySource":"Robinhood Chain","primarySourceBound":false}'::jsonb
where not exists (
  select 1 from public.o8_events
  where type = 'source_registry' and metadata->>'primarySource' = 'Robinhood Chain'
);
