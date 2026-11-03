-- Signed-in users can reach PostgREST directly with their Clerk token, so the
-- input rules in the saveCity server action are repeated here where they
-- can't be skipped.

alter table public.saved_cities
  add constraint saved_cities_name_length check (char_length(name) between 1 and 200),
  add constraint saved_cities_latitude_range check (latitude between -90 and 90),
  add constraint saved_cities_longitude_range check (longitude between -180 and 180);

-- At most 50 saved cities per user. Keeps the table (500 MB free tier) and the
-- single batched Open-Meteo request per watchlist bounded.
create function public.enforce_saved_cities_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.saved_cities where user_id = new.user_id) >= 50 then
    raise exception 'saved_cities_limit' using hint = 'A user can save at most 50 cities.';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_saved_cities_limit() from public, anon, authenticated;

create trigger saved_cities_limit
  before insert on public.saved_cities
  for each row execute function public.enforce_saved_cities_limit();
