-- One row per divvy-sync run, success or failure. The page reads the latest
-- row for both freshness clocks (finished_at, feed_last_updated) and the
-- "down" state (ok = false).
create table public.runs (
  id                 bigint generated always as identity primary key,
  started_at         timestamptz not null,
  finished_at        timestamptz not null default now(),
  ok                 boolean not null,
  rows_changed       integer not null default 0 check (rows_changed >= 0),
  -- The feed's own last_updated as seen by this run (null if the fetch failed).
  feed_last_updated  timestamptz,
  error              text check (char_length(error) <= 2000)
);

create index runs_finished_at_idx on public.runs (finished_at desc);

alter table public.runs enable row level security;

create policy "Signed-in users can view runs"
  on public.runs
  for select
  to authenticated
  using (true);

revoke all on public.runs from anon, authenticated;
grant select on public.runs to authenticated;
grant select, insert, delete on public.runs to service_role;

alter publication supabase_realtime add table public.runs;
