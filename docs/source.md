# Live source: Divvy station status (GBFS)

**Picked:** Divvy's GBFS feed, operated by Lyft. It is public, needs no key, answers in about 0.1 s, and changes every minute without us doing anything. The Open-Meteo fallback was not needed.

| feed | URL | `ttl` | what it holds |
|------|-----|-------|---------------|
| `station_status` | `https://gbfs.lyft.com/gbfs/2.3/chi/en/station_status.json` | 60 s | live counts per station |
| `station_information` | `https://gbfs.lyft.com/gbfs/2.3/chi/en/station_information.json` | 60 s | name, `lat`/`lon`, `capacity`, `short_name`; rarely changes |

GBFS version 2.3 has 2,079 stations.

## Fields in `station_status`

`station_id`, `num_bikes_available`, `num_ebikes_available`, `num_docks_available`, `num_bikes_disabled`, `num_docks_disabled`, `is_installed`, `is_renting`, `is_returning`, `last_reported` (unix seconds, per station), `vehicle_types_available` (per-type counts), `num_scooters_available`, `num_scooters_unavailable`.

The top level has `last_updated` (unix seconds, the whole feed), `ttl` and `version`.

## What changed: three fetches about 65 s apart (2026-11-03, 15:21–15:23 Chicago time)

| | fetch 1 → 2 | fetch 2 → 3 |
|---|---|---|
| feed `last_updated` | 15:20:41 → 15:21:41 | 15:21:41 → 15:22:40 |
| stations with any field changed | 696 | 799 |
| …excluding `last_reported` | **74** | **89** |
| `num_bikes_available` changed | 39 | 42 |
| `num_docks_available` changed | 44 | 58 |
| `num_ebikes_available` changed | 30 | 31 |
| stations added / removed | 0 / 0 | 0 / 0 |

Examples: University Ave & 59th St bikes 11 → 10; Harper Ave & 55th St bikes 1 → 2 and docks 13 → 12.

## What this means for the design

- **The feed refreshes every 60 s.** `last_updated` moved by exactly about 60 s each time, matching `ttl: 60`.
- **Interval: every 60 seconds (`* * * * *`).** Polling faster would mostly fetch the same snapshot. Polling slower would skip snapshots. That is 43,200 Edge Function calls a month, about 9% of the 500,000 free tier.
- **`last_reported` is a heartbeat, not a change.** About 750 stations bump it every minute with no change in counts. The worker treats a station as changed only when its counts or flags change. Otherwise every run would rewrite about a third of the table and send a Realtime message for each row.
- **About 80 stations really change per minute** (about 4% of 2,079). That is the expected write volume per run.
- **910 stations haven't reported in over 24 hours** (inactive or seasonal stations in November). They will simply never change. The page can show a station's own `last_reported` so a dead station isn't mistaken for a stale feed.
