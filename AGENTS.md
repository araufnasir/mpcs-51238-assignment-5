<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Data model

One table, `public.saved_cities`, one row per city a user has saved to their watchlist.

| column       | type             | notes                                                        |
|--------------|------------------|--------------------------------------------------------------|
| `id`         | `uuid`           | primary key, `default gen_random_uuid()`                     |
| `user_id`    | `text`           | not null, `default (auth.jwt() ->> 'sub')` — the Clerk user ID |
| `name`       | `text`           | not null, display name from Open-Meteo geocoding (e.g. "Chicago, Illinois, US") |
| `latitude`   | `double precision` | not null                                                   |
| `longitude`  | `double precision` | not null                                                   |
| `created_at` | `timestamptz`    | not null, `default now()`                                    |

Constraints:
- `unique (user_id, latitude, longitude)` so a user can't save the same city twice.
- `check` constraints: `name` 1–200 characters, `latitude` −90..90, `longitude` −180..180.
- A `before insert` trigger caps each user at 50 saved cities (raises `saved_cities_limit`).

Current conditions are **not** stored — they are fetched from Open-Meteo at view time using the saved coordinates.

### Why `user_id` is on the table

- It is the only thing that ties a row to a person. Without it, every saved city would belong to everyone.
- Row Level Security keys off it: every policy (select, insert, delete) checks `(auth.jwt() ->> 'sub') = user_id`, so Postgres itself filters rows to the signed-in user. The app never has to remember to add a `where user_id = …`, and a bug in app code can't leak another user's rows.
- It is `text`, not `uuid`, because Clerk user IDs look like `user_2abc…`. The value comes from the `sub` claim of the Clerk session token that Supabase verifies via third-party auth.
- The column default fills it from the token on insert, and the insert policy's `with check` rejects any attempt to write a row for a different user.

### Rules

- RLS is enabled on every table. New tables must ship with RLS enabled and policies in the same migration.
- Schema changes go through migrations, never ad-hoc dashboard edits.
