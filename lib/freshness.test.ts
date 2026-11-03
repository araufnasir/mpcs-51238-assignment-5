// Freshness state logic for /live: loading, fresh, stale (naming the clock
// that is behind) and down (latest run failed, last counts kept).
//
//   npm run test:freshness

import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRun, clockAges, freshnessReason, freshnessState, STALE_AFTER_MS, type Run } from "./freshness.ts";

const NOW = Date.parse("2026-11-03T22:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

function run(over: Partial<Run> = {}): Run {
  return { id: 1, finished_at: ago(12_000), ok: true, rows_changed: 70, feed_last_updated: ago(40_000), error: null, ...over };
}

function stateFor(latestRun: Run | null, lastOkRun: Run | null, channelStatus: "CONNECTING" | "SUBSCRIBED" = "SUBSCRIBED") {
  const ages = clockAges(lastOkRun, NOW);
  const state = freshnessState({ channelStatus, latestRun, ...ages });
  return { state, reason: freshnessReason(state, { latestRun, ...ages, now: NOW }), ages };
}

test("loading until the Realtime channel is subscribed", () => {
  assert.deepEqual(stateFor(run(), run(), "CONNECTING").state, { kind: "loading" });
});

test("loading until the page knows the time (first render)", () => {
  const ages = clockAges(run(), null);
  assert.deepEqual(ages, { workerAge: null, feedAge: null });
  assert.deepEqual(freshnessState({ channelStatus: "SUBSCRIBED", latestRun: run(), ...ages }), { kind: "loading" });
});

test("loading when no run has ever succeeded", () => {
  assert.deepEqual(stateFor(null, null).state, { kind: "loading" });
});

test("fresh when both clocks are within 3 minutes", () => {
  const { state, reason, ages } = stateFor(run(), run());
  assert.deepEqual(state, { kind: "fresh" });
  assert.equal(reason, null);
  assert.deepEqual(ages, { workerAge: 12_000, feedAge: 40_000 });
});

test("exactly 3 minutes is still fresh; one second more is stale", () => {
  assert.equal(stateFor(run({ finished_at: ago(STALE_AFTER_MS) }), run({ finished_at: ago(STALE_AFTER_MS) })).state.kind, "fresh");
  const late = run({ finished_at: ago(STALE_AFTER_MS + 1000) });
  assert.equal(stateFor(late, late).state.kind, "stale");
});

test("stale, worker: cron stopped, so both clocks age and the worker is named", () => {
  // Last run 5 min ago; the feed it saw was 40 s old at the time.
  const last = run({ finished_at: ago(5 * 60_000), feed_last_updated: ago(5 * 60_000 + 40_000) });
  const { state, reason } = stateFor(last, last);
  assert.deepEqual(state, { kind: "stale", which: "worker" });
  assert.equal(reason, "The worker hasn't finished a run for 5 min, so Divvy's latest data isn't reaching this page.");
});

test("stale, feed: the worker runs every minute but Divvy stopped publishing", () => {
  const last = run({ finished_at: ago(20_000), feed_last_updated: ago(10 * 60_000) });
  const { state, reason } = stateFor(last, last);
  assert.deepEqual(state, { kind: "stale", which: "feed" });
  assert.equal(reason, "Divvy hasn't published new data for 10 min; the worker is still running.");
});

test("down when the latest run failed, even if the last success was recent", () => {
  const ok = run({ id: 1 });
  const failed = run({ id: 2, ok: false, finished_at: ago(30_000), feed_last_updated: null, error: "GET station_status: HTTP 503" });
  const { state, reason } = stateFor(failed, ok);
  assert.deepEqual(state, { kind: "down" });
  assert.equal(reason, "The last run failed 30 s ago: GET station_status: HTTP 503. Showing the last known counts.");
});

test("a failed run keeps the last successful run, so last counts keep their true age", () => {
  const ok = run({ id: 1, finished_at: ago(70_000) });
  const failed = run({ id: 2, ok: false, finished_at: ago(5_000), feed_last_updated: null, error: "timeout" });

  const after = applyRun({ latestRun: ok, lastOkRun: ok }, failed);
  assert.equal(after.latestRun, failed);
  assert.equal(after.lastOkRun, ok);
  assert.equal(clockAges(after.lastOkRun, NOW).workerAge, 70_000);
});

test("a successful run after a failure brings the page back to fresh", () => {
  const failed = run({ id: 2, ok: false, error: "timeout" });
  const ok = run({ id: 3, finished_at: ago(2_000) });
  const after = applyRun({ latestRun: failed, lastOkRun: run({ id: 1, finished_at: ago(90_000) }) }, ok);
  assert.deepEqual(after, { latestRun: ok, lastOkRun: ok });
  assert.equal(stateFor(after.latestRun, after.lastOkRun).state.kind, "fresh");
});
