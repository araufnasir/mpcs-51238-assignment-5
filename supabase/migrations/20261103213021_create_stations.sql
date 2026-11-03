-- Live Divvy station status, one row per station. Written only by the
-- divvy-sync Edge Function (secret key, bypasses RLS); read by any signed-in
-- user. Only stations whose counts, flags or info changed are rewritten.
create table public.stations (
  station_id            text primary key,
  name                  text not null,
  short_name            text,
  lat                   double precision not null,
  lon                   double precision not null,
  capacity              integer,
  num_bikes_available   integer not null,
  num_ebikes_available  integer not null,
  num_docks_available   integer not null,
  num_bikes_disabled    integer not null,
  num_docks_disabled    integer not null,
  is_installed          boolean not null,
  is_renting            boolean not null,
  is_returning          boolean not null,
  -- The station's own last report. Refreshed at most hourly when nothing else
  -- changes, so it's good for "inactive over 24 h" but not as a live clock.
  last_reported         timestamptz not null,
  updated_at            timestamptz not null default now()
);

alter table public.stations enable row level security;

-- Realtime needs all three: the publication (or no events are produced),
-- the grant (or the subscriber's role can't read the row), and this policy
-- (or RLS filters every event out).
create policy "Signed-in users can view stations"
  on public.stations
  for select
  to authenticated
  using (true);

-- No insert/update/delete policies: only the worker's secret key writes.
revoke all on public.stations from anon, authenticated;
grant select on public.stations to authenticated;
grant select, insert, update on public.stations to service_role;

alter publication supabase_realtime add table public.stations;
