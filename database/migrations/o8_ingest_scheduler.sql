create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'o8-robinhood-ingest';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'o8-robinhood-ingest',
  '15 seconds',
  $$
  select net.http_get(
    url := 'https://https-the-worm-codex-text-link.vercel.app/api/o8/ingest',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'o8-ingest-secret' limit 1)
    ),
    timeout_milliseconds := 12000
  );
  $$
);
