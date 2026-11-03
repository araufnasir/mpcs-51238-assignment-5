-- Stations silent for over 24 h (by the feed's own clock) are flagged so the
-- page can hide or label them. Written by divvy-sync like any other flag.
alter table public.stations add column is_reporting boolean not null default true;

-- Shared secret between Supabase Cron and the divvy-sync Edge Function.
-- The value is generated here, inside the database, and lives only in Vault:
-- it never appears in code, migrations, logs or the repo. Cron reads it by
-- name; the function checks a request's header with divvy_sync_secret_ok().
select vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'divvy_sync_cron_secret',
  'Shared secret: Supabase Cron -> divvy-sync Edge Function'
)
where not exists (select 1 from vault.secrets where name = 'divvy_sync_cron_secret');

-- security definer so it can read Vault; only the worker's secret key
-- (service_role) may call it, and it only ever answers true/false.
create function public.divvy_sync_secret_ok(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = 'divvy_sync_cron_secret'
      and decrypted_secret = candidate
  );
$$;

revoke execute on function public.divvy_sync_secret_ok(text) from public, anon, authenticated;
grant execute on function public.divvy_sync_secret_ok(text) to service_role;
