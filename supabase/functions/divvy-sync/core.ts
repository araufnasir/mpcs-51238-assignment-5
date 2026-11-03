// Pure logic for divvy-sync: turn the two GBFS feeds into station rows and
// pick out the ones that changed. No I/O, so it runs under Deno (the Edge
// Function) and Node (the fixture test) alike.

export type GbfsStatus = {
  last_updated: number;
  ttl: number;
  data: { stations: RawStatus[] };
};

export type GbfsInfo = {
  data: { stations: RawInfo[] };
};

type RawStatus = {
  station_id: string;
  num_bikes_available: number;
  num_ebikes_available?: number;
  num_docks_available: number;
  num_bikes_disabled?: number;
  num_docks_disabled?: number;
  is_installed: number | boolean;
  is_renting: number | boolean;
  is_returning: number | boolean;
  last_reported: number;
};

type RawInfo = {
  station_id: string;
  name: string;
  short_name?: string;
  lat: number;
  lon: number;
  capacity?: number;
};

// One row of public.stations, minus updated_at (set by the writer).
export type StationRow = {
  station_id: string;
  name: string;
  short_name: string | null;
  lat: number;
  lon: number;
  capacity: number | null;
  num_bikes_available: number;
  num_ebikes_available: number;
  num_docks_available: number;
  num_bikes_disabled: number;
  num_docks_disabled: number;
  is_installed: boolean;
  is_renting: boolean;
  is_returning: boolean;
  is_reporting: boolean;
  last_reported: string;
};

// A station that hasn't reported for this long is flagged inactive.
export const INACTIVE_AFTER_SECONDS = 24 * 60 * 60;

// What counts as a change: counts, flags and the station's info.
// last_reported is deliberately absent: about 750 stations bump it every
// minute with nothing else different (see docs/source.md).
export const COMPARED_FIELDS = [
  "name",
  "short_name",
  "lat",
  "lon",
  "capacity",
  "num_bikes_available",
  "num_ebikes_available",
  "num_docks_available",
  "num_bikes_disabled",
  "num_docks_disabled",
  "is_installed",
  "is_renting",
  "is_returning",
  "is_reporting",
] as const;

export type ComparedRow = Pick<StationRow, "station_id" | (typeof COMPARED_FIELDS)[number]>;

export type RunPlan = {
  upserts: StationRow[];
  feedLastUpdated: string;
  stationsInFeed: number;
  skippedWithoutInfo: number;
};

// Throws on a response that isn't a usable GBFS station feed, so the run is
// recorded as failed instead of silently saving nothing.
export function assertFeeds(status: unknown, info: unknown): asserts status is GbfsStatus {
  const s = status as GbfsStatus;
  if (typeof s?.last_updated !== "number" || !Array.isArray(s?.data?.stations)) {
    throw new Error("station_status: unexpected shape (missing last_updated or data.stations)");
  }
  if (!Array.isArray((info as GbfsInfo)?.data?.stations)) {
    throw new Error("station_information: unexpected shape (missing data.stations)");
  }
}

// Joins status with info. Stations without an info entry have no name and are
// skipped; they normally appear in station_information within a minute.
export function buildRows(status: GbfsStatus, info: GbfsInfo): { rows: StationRow[]; skippedWithoutInfo: number } {
  const infoById = new Map(info.data.stations.map((i) => [i.station_id, i]));
  const rows: StationRow[] = [];
  let skippedWithoutInfo = 0;

  for (const s of status.data.stations) {
    const i = infoById.get(s.station_id);
    if (!i || !i.name) {
      skippedWithoutInfo++;
      continue;
    }
    rows.push({
      station_id: s.station_id,
      name: i.name,
      short_name: i.short_name ?? null,
      lat: i.lat,
      lon: i.lon,
      capacity: i.capacity ?? null,
      num_bikes_available: s.num_bikes_available,
      num_ebikes_available: s.num_ebikes_available ?? 0,
      num_docks_available: s.num_docks_available,
      num_bikes_disabled: s.num_bikes_disabled ?? 0,
      num_docks_disabled: s.num_docks_disabled ?? 0,
      is_installed: Boolean(s.is_installed),
      is_renting: Boolean(s.is_renting),
      is_returning: Boolean(s.is_returning),
      // Measured against the feed's own clock, not the worker's, so the
      // result depends only on the response.
      is_reporting: status.last_updated - s.last_reported <= INACTIVE_AFTER_SECONDS,
      last_reported: new Date(s.last_reported * 1000).toISOString(),
    });
  }
  return { rows, skippedWithoutInfo };
}

export function hasChanged(previous: ComparedRow | undefined, next: StationRow): boolean {
  if (!previous) return true;
  return COMPARED_FIELDS.some((f) => previous[f] !== next[f]);
}

export function diffStations(current: ComparedRow[], next: StationRow[]): StationRow[] {
  const byId = new Map(current.map((r) => [r.station_id, r]));
  return next.filter((row) => hasChanged(byId.get(row.station_id), row));
}

// The whole decision for one run: given what's in the table and the two feed
// responses, which rows to upsert and what to record in runs.
export function planRun(current: ComparedRow[], status: unknown, info: unknown): RunPlan {
  assertFeeds(status, info);
  const { rows, skippedWithoutInfo } = buildRows(status, info as GbfsInfo);
  return {
    upserts: diffStations(current, rows),
    feedLastUpdated: new Date(status.last_updated * 1000).toISOString(),
    stationsInFeed: status.data.stations.length,
    skippedWithoutInfo,
  };
}
