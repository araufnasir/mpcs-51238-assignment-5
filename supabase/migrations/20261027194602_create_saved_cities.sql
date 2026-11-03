-- One row per city a user has saved to their watchlist.
-- user_id is the Clerk user ID, taken from the `sub` claim of the verified session token.
create table public.saved_cities (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default (auth.jwt() ->> 'sub'),
  name        text not null,
  latitude    double precision not null,
  longitude   double precision not null,
  created_at  timestamptz not null default now(),
  constraint saved_cities_user_location_key unique (user_id, latitude, longitude)
);

alter table public.saved_cities enable row level security;

-- (select auth.jwt()) is evaluated once per query instead of once per row.
create policy "Users can view their own saved cities"
  on public.saved_cities
  for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

create policy "Users can save cities to their own list"
  on public.saved_cities
  for insert
  to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

create policy "Users can remove their own saved cities"
  on public.saved_cities
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);
