-- pg_net makes HTTP calls from Postgres; pg_cron schedules them (Supabase Cron).
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;
