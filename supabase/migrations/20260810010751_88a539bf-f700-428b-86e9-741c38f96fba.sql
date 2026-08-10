insert into public.cron_tokens (name, token)
values ('organism_cron', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

select cron.schedule(
  'organism-metabolism-every-30-min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1/organism-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select token from public.cron_tokens where name = 'organism_cron')
    ),
    body := jsonb_build_object('source', 'pg_cron', 'at', now()),
    timeout_milliseconds := 120000
  );
  $$
);