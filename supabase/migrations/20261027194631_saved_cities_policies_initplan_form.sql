-- Same rules as before; wrap only auth.jwt() in a subselect so the
-- performance advisor (lint 0003 auth_rls_initplan) recognises it.
alter policy "Users can view their own saved cities"
  on public.saved_cities
  using ((select auth.jwt()) ->> 'sub' = user_id);

alter policy "Users can save cities to their own list"
  on public.saved_cities
  with check ((select auth.jwt()) ->> 'sub' = user_id);

alter policy "Users can remove their own saved cities"
  on public.saved_cities
  using ((select auth.jwt()) ->> 'sub' = user_id);
