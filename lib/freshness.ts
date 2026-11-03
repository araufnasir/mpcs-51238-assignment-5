// Pure freshness logic for /live: which of the four states the page is in,
// and what it says about it. No React, so it is unit-tested with node --test.

export type Run = {
  id: number;
  finished_at: string;
  ok: boolean;
  rows_changed: number;
  feed_last_updated: string | null;
  error: string | null;
};

export type ChannelStatus = "CONNECTING" | "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

export type Freshness =
  | { kind: "loading" }
  | { kind: "fresh" }
  | { kind: "stale"; which: "connection" | "worker" | "feed" }
  | { kind: "down" };

// "Stale" = about three missed 60 s runs, on either clock.
export const STALE_AFTER_MS = 3 * 60 * 1000;

// The Realtime channel ended; LiveStations is resubscribing and polling.
export const isChannelDown = (status: ChannelStatus) =>
  status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED";

// The two clocks: the worker's last successful run, and the feed's own
// last_updated as seen by that run. null until the page knows the time.
export function clockAges(lastOkRun: Run | null, now: number | null) {
  return {
    workerAge: now !== null && lastOkRun ? now - Date.parse(lastOkRun.finished_at) : null,
    feedAge: now !== null && lastOkRun?.feed_last_updated ? now - Date.parse(lastOkRun.feed_last_updated) : null,
  };
}

export function freshnessState({
  channelStatus,
  latestRun,
  workerAge,
  feedAge,
}: {
  channelStatus: ChannelStatus;
  latestRun: Run | null;
  workerAge: number | null;
  feedAge: number | null;
}): Freshness {
  if (latestRun && !latestRun.ok) return { kind: "down" };
  // Without the channel the clocks only move when polled, so don't blame the worker.
  if (isChannelDown(channelStatus)) return { kind: "stale", which: "connection" };
  if (channelStatus === "CONNECTING" || workerAge === null) return { kind: "loading" };
  // feed_last_updated is never newer than the run that saw it, so a stopped
  // worker always ages both clocks. Blame the worker then; "feed" means the
  // worker is running but Divvy stopped publishing.
  if (workerAge > STALE_AFTER_MS) return { kind: "stale", which: "worker" };
  if (feedAge === null || feedAge > STALE_AFTER_MS) return { kind: "stale", which: "feed" };
  return { kind: "fresh" };
}

// The sentence under the banner title, naming which clock is behind.
export function freshnessReason(
  state: Freshness,
  { latestRun, workerAge, feedAge, now }: { latestRun: Run | null; workerAge: number | null; feedAge: number | null; now: number | null },
): string | null {
  if (state.kind === "stale") {
    return {
      connection: "Live connection lost. Showing data from the last successful update",
      worker: `The worker hasn't finished a run for ${formatAge(workerAge)}, so Divvy's latest data isn't reaching this page.`,
      feed: `Divvy hasn't published new data for ${formatAge(feedAge)}; the worker is still running.`,
    }[state.which];
  }
  if (state.kind === "down" && latestRun && now !== null) {
    return `The last run failed ${formatAge(now - Date.parse(latestRun.finished_at))} ago: ${latestRun.error ?? "unknown error"}. Showing the last known counts.`;
  }
  return null;
}

// A new runs row from Realtime. A failed run becomes the latest run (so the
// page shows "down") but never replaces the last successful one, so the
// freshness clocks and the counts on screen keep their true age.
export function applyRun(prev: { latestRun: Run | null; lastOkRun: Run | null }, run: Run) {
  return { latestRun: run, lastOkRun: run.ok ? run : prev.lastOkRun };
}

export function formatAge(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} days`;
}
