-- One row per station a user follows on /live.
-- user_id is the Clerk user ID, taken from the `sub` claim of the verified session token.
create table public.followed_stations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default (auth.jwt() ->> 'sub'),
  station_id  text not null references public.stations (station_id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint followed_stations_user_station_key unique (user_id, station_id)
);

create index followed_stations_station_id_idx on public.followed_stations (station_id);

alter table public.followed_stations enable row level security;

-- (select auth.jwt()) is evaluated once per query instead of once per row.
create policy "Users can view their own followed stations"
  on public.followed_stations
  for select
  to authenticated
  using ((select auth.jwt()) ->> 'sub' = user_id);

create policy "Users can follow stations for themselves"
  on public.followed_stations
  for insert
  to authenticated
  with check ((select auth.jwt()) ->> 'sub' = user_id);

create policy "Users can unfollow their own stations"
  on public.followed_stations
  for delete
  to authenticated
  using ((select auth.jwt()) ->> 'sub' = user_id);

revoke all on public.followed_stations from anon, authenticated;
grant select, insert, delete on public.followed_stations to authenticated;

-- At most 50 follows per user. The page's Realtime filter is
-- station_id=in.(...), which accepts at most 100 values.
create function public.enforce_followed_stations_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.followed_stations where user_id = new.user_id) >= 50 then
    raise exception 'followed_stations_limit' using hint = 'A user can follow at most 50 stations.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_followed_stations_limit() from public, anon, authenticated;

create trigger followed_stations_limit
  before insert on public.followed_stations
  for each row execute function public.enforce_followed_stations_limit();
