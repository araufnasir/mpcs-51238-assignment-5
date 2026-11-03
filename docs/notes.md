# Notes: questions about the live system

The answers come from the saved feed responses ([`source.md`](source.md)), the code, and the project's own database and logs, read on 2026-11-03 between 22:30 and 22:33 UTC (16:30–16:33 in Chicago).

## (a) "Explain the Divvy response: what each field means, how often it changes, and which fields my app needs."

Divvy publishes GBFS 2.3 through Lyft. The app reads two of the feeds listed in `gbfs.json`.

**`station_status.json`** has live counts. The whole file is regenerated about every 60 s.

| field | meaning | how often it changes | used? |
|---|---|---|---|
| `last_updated` (top level) | Unix time when Lyft generated this snapshot | every ~60 s (it moved 60 ± 1 s between fetches; sometimes Lyft's CDN repeats a snapshot for a minute) | **yes**: saved as `runs.feed_last_updated`, the page's "Divvy feed published" clock, and the clock for `is_reporting` |
| `ttl` (top level) | seconds a client may cache the file | constant (60) | yes, to choose the cron interval (not stored) |
| `version` (top level) | GBFS version | constant (`2.3`) | no |
| `station_id` | stable ID: a UUID or a long digit string | never | **yes**: primary key and Realtime filter |
| `num_bikes_available` | rentable bikes, classic and electric together | about 40–90 stations a minute | **yes** |
| `num_ebikes_available` | the electric bikes among those | about 30–75 stations a minute | **yes** |
| `num_docks_available` | empty docks you can return a bike to | about 40–100 stations a minute | **yes** |
| `num_bikes_disabled` | broken or locked bikes sitting in docks | about 10–20 stations a minute | stored and compared, not shown |
| `num_docks_disabled` | out-of-service docks | 0–2 stations a minute | stored and compared, not shown |
| `is_installed` | the station physically exists (0/1) | rarely | **yes**: the search hides uninstalled stations |
| `is_renting` / `is_returning` | you can take / return a bike (0/1) | rarely | `is_renting` is shown as "not renting"; both are compared |
| `last_reported` | Unix time the station last checked in | about 700–800 stations a minute (a heartbeat) | stored when something else changes, **never counted as a change**. It's used to work out `is_reporting` (reported in the last 24 h) |
| `vehicle_types_available` | per-type counts (types 1–3) | follows the counts above | no (it duplicates bikes and e-bikes) |
| `num_scooters_available` / `_unavailable` | scooters (always 0 in Chicago's station feed) | — | no |

**`station_information.json`** has station details, which rarely change.

| field | meaning | used? |
|---|---|---|
| `name` | display name, e.g. "Canal St & Adams St" | **yes**: shown and searched |
| `short_name` | Divvy's station code, e.g. `CHI01913` | stored |
| `lat`, `lon` | coordinates, sometimes with 16–17 significant digits | stored, **rounded to 6 decimals** (see the bug in the README) |
| `capacity` | total docks | stored |
| `rental_uris`, `is_charging` | app links, charging-station flag | no |

There are 2,079 stations. 910 of them haven't reported for over 24 h (seasonal or out of service in November), so they're flagged `is_reporting = false` and hidden from the search.

## (b) "Walk me through the chart: what each part sends to the next, and what would break if one part changed it."

| hop | what is sent | if that part changed what it sends |
|---|---|---|
| **Vault → Cron** | the secret `divvy_sync_cron_secret`, read by name each minute | If the secret is renamed or deleted, the lookup returns null, the header disappears, every call gets **401**, and no `runs` rows are written. After 3 minutes the page shows **stale: worker**. |
| **Cron → Edge Function** | `POST /functions/v1/divvy-sync` with `x-divvy-sync-secret` | A different header name, method (GET → 405) or URL means the same thing: 401/404, no runs, **stale: worker**. Changing the schedule to every 10 s would mostly fetch repeated snapshots and use about half the free quota. |
| **Divvy → Edge Function** | `station_status` and `station_information` JSON | If the top-level shape changes (no `data.stations` or `last_updated`), `assertFeeds` throws, the run is recorded `ok = false`, and the page shows **down** with the error. If one count field went missing or null, the `not null` column makes the upsert fail, so also **down**. If Lyft stopped publishing but kept serving the old file, runs succeed with 0 changes, and the page shows **stale: feed** ("the worker is still running"). If coordinate precision changed, it would be the bug again, but rounding absorbs it. |
| **Edge Function → `stations`** | upserts of changed rows only | If the worker wrote every row each minute, the data would look the same, but every follower would get an event per followed station per minute. That's about 2 M Realtime messages a month for 5 pages × 10 follows, the whole free quota. If it counted `last_reported` as a change, it would write about 750 rows a minute. |
| **Edge Function → `runs`** | one row per run: `started_at`, `finished_at`, `ok`, `rows_changed`, `feed_last_updated`, `error` | If it stopped inserting runs (or only on failure), stations would keep updating but the page would show **stale: worker** after 3 minutes. If it left out `feed_last_updated`, the feed clock would show "—" and the page would be stuck on **stale: feed**. |
| **Postgres → Realtime** | logical replication of committed changes for tables in `supabase_realtime` | If `stations` were dropped from the publication, the counts would freeze. **The page would still say "Live"**, because `runs` events keep arriving. This is the one failure the freshness states can't see. If `runs` were dropped, the clocks would never reset, so **stale: worker** after 3 minutes, even though counts keep updating. |
| **Realtime → browser** | `postgres_changes` for followed stations and new runs, each checked with the user's Clerk JWT | If the `select` grant or RLS policy were removed, or the Clerk token lost `role: authenticated`, events would be silently dropped, with the same frozen symptoms as above. If the filter grew past 100 IDs, the subscription would fail (the 50-follow cap prevents this). |
| **Browser ↔ Next.js ↔ `followed_stations`** | follow/unfollow server actions with the Clerk token; first render reads follows, stations and the latest runs | If the RLS `with check` were removed, a user could write follows for someone else. If the station FK were removed, users could follow IDs that don't exist. If the first render stopped reading `lastOkRun`, the page would sit in **loading** until the next run arrived (up to 60 s). |

## (c) "Show me the worker's logs from its last three runs, and explain each line."

From the Edge Function logs (`function_logs`), oldest first, in UTC:

```
22:31:01.364  log   booted (time: 169ms)
22:31:02.898  info  divvy-sync ok rows_changed=131 stations=2079 skipped_without_info=0 feed_last_updated=2026-11-03T22:31:00.000Z ms=1155 fields={"num_bikes_available":90,"num_ebikes_available":76,"num_docks_available":102,"num_bikes_disabled":16,"num_docks_disabled":2}
22:31:15.403  log   shutdown
22:32:01.817  info  divvy-sync ok rows_changed=100 stations=2079 skipped_without_info=0 feed_last_updated=2026-11-03T22:31:59.000Z ms=1295 fields={"num_bikes_available":54,"num_ebikes_available":44,"num_docks_available":66,"num_bikes_disabled":14,"num_docks_disabled":2}
22:32:16.381  log   shutdown
22:33:01.333  log   booted (time: 448ms)
22:33:02.962  info  divvy-sync ok rows_changed=101 stations=2079 skipped_without_info=0 feed_last_updated=2026-11-03T22:32:59.000Z ms=1050 fields={"num_bikes_available":54,"num_ebikes_available":39,"num_bikes_disabled":18,"num_docks_available":65}
```

The matching `runs` rows and cron jobs:

| run | cron fired | started_at | finished_at | ok | rows_changed | feed_last_updated |
|---|---|---|---|---|---|---|
| 51 | 22:31:00.059 (succeeded) | 22:31:01.742 | 22:31:02.881 | true | 131 | 22:31:00 |
| 52 | 22:32:00.015 (succeeded) | 22:32:00.522 | 22:32:01.805 | true | 100 | 22:31:59 |
| 53 | 22:33:00.050 (succeeded) | 22:33:01.911 | 22:33:02.948 | true | 101 | 22:32:59 |

What each line means:

- **`booted (time: 169ms)`**: Supabase started a fresh isolate (a sandbox running the function) for this request, which took 169 ms. It comes from the platform, not our code.
- **`divvy-sync ok …`**: the one line our code logs per successful run.
  - `rows_changed=131` is how many stations were upserted, the same number as `runs.rows_changed`.
  - `stations=2079` is how many stations were in `station_status`.
  - `skipped_without_info=0` means every station had a name in `station_information`.
  - `feed_last_updated=…22:31:00` is the snapshot time Lyft stamped on it, here 1.7 s before the function started.
  - `ms=1155` is the run's wall time: two fetches, reading 2,079 rows in 3 pages, upserting, and inserting the run.
  - `fields={…}` counts the changed rows per field. One row can change several fields, so the numbers add up to more than `rows_changed`. No `lat`/`lon` appears, which confirms the coordinate fix.
- **`shutdown`**: the platform stopped the isolate about 13–15 s after the request, once it was idle.
- **Run 52 has no `booted` line** even though the previous isolate had shut down. The logs don't say why: either the line wasn't captured, or another isolate that was already running served it. The run itself succeeded, as its `runs` row and cron record show.
- Run 51 changed more (131) than 52 and 53 (about 100). This was 16:30–16:33 in Chicago, during the evening rush, which is higher than the 74–89 measured at 15:20.

## (d) "Trace one update for me, from the source to my screen, and name every part it passes through."

A real update: **Canal St & Adams St** (next to Union Station), written by run 53.

| time (UTC) | part | what happened |
|---|---|---|
| 22:32:42 | **Divvy station hardware → Lyft** | The station checked in (`last_reported` = 22:32:42) with its current counts. |
| 22:32:59 | **Lyft GBFS** | Lyft generated a new `station_status.json` snapshot (`last_updated` = 22:32:59), served through its CDN. |
| 22:33:00.050 | **Supabase Cron (`pg_cron`)** | Job `divvy-sync-every-minute` fired. It read the secret from **Vault** by name and queued an HTTP POST with **`pg_net`**. |
| 22:33:01.333 | **Supabase Edge Functions** | A new isolate booted (448 ms). `index.ts` checked the header through **`divvy_sync_secret_ok()`** in Postgres: allowed. |
| 22:33:01.911 | **divvy-sync `index.ts`** | Run started: fetched both feeds from Lyft, then read the current rows of **`public.stations`** through the REST API with the injected secret key. |
| (in memory) | **divvy-sync `core.ts` `planRun`** | Compared counts and flags for 2,079 stations. Canal St & Adams St differed, so it was one of the 101 rows to save. |
| 22:33:02.797 | **Postgres `public.stations`** | The upsert committed. The row now reads **19 bikes (11 e-bikes), 25 docks**, `last_reported` 22:32:42, `updated_at` 22:33:02.797. |
| 22:33:02.948 | **Postgres `public.runs`** | Run 53 inserted: `ok`, 101 rows, feed 22:32:59. |
| right after commit | **`supabase_realtime` publication → Supabase Realtime** | The committed UPDATE and the `runs` INSERT went out through logical replication. For each subscriber whose filter includes this `station_id`, Realtime ran the **RLS select policy** as that user, using their **Clerk JWT** (role `authenticated`, the `select` grant), and pushed the row over the WebSocket. |
| about a second later (not measured) | **Browser `LiveStations` component** | The `postgres_changes` handler replaced the card's counts in place, so React re-rendered the card. The list is `aria-live="polite"`, so screen readers announce the change. The `runs` event reset "Worker updated" to about 0 s and set "Divvy feed published" from 22:32:59. The dev-only indicator shows `stations UPDATE (Canal St & Adams St)`. |

The hops up to the database are measured: about 20 s from the station check-in to the database write. The station waited 17 s for Lyft's next snapshot, and the snapshot waited about 4 s for the worker. The last step, Realtime to a screen, isn't measured here, because measuring it needs a signed-in browser, and this note was written without one. The dev indicator's "last event … ago" shows it when the page is open under `npm run dev`. Worst case, a check-in just after a snapshot reaches the screen about 2 minutes later: up to 60 s until Lyft's next snapshot, plus up to 60 s until the next cron run.
