-- Supabase Cron: call divvy-sync every 60 s, matching the feed's ttl of 60 s
-- (see docs/source.md). The shared secret is looked up in Vault by name each
-- time the job runs, so its value is never stored in the job or this file.
-- cron.schedule replaces an existing job with the same name.
select cron.schedule(
  'divvy-sync-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://dfczqptkfwdvetibgymh.supabase.co/functions/v1/divvy-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-divvy-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'divvy_sync_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  ) as request_id;
  $$
);
