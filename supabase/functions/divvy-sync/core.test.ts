// Runs the worker's decision logic on saved copies of the real Divvy feed
// (two station_status responses taken 60 s apart on 2026-11-03, trimmed to
// seven stations) and checks exactly what it would save.
//
//   npm run test:worker      (node --test; also runs under `deno test`)

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildRows, planRun, INACTIVE_AFTER_SECONDS } from "./core.ts";
import type { ComparedRow, GbfsInfo, GbfsStatus } from "./core.ts";

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));

const before: GbfsStatus = fixture("station_status.before.json");
const after: GbfsStatus = fixture("station_status.after.json");
const info: GbfsInfo = fixture("station_information.json");

const RAVENSWOOD = "a3ab9119-a135-11e9-9cda-0a87ae2ba916"; // bikes 38 -> 37
const PAULINA = "a3a3b202-a135-11e9-9cda-0a87ae2ba916"; // bikes 6 -> 7
const SHIELDS = "a3ad13e4-a135-11e9-9cda-0a87ae2ba916"; // only last_reported moved
const CALIFORNIA = "a3acb1de-a135-11e9-9cda-0a87ae2ba916"; // only last_reported moved
const GLENWOOD = "a3b0fae6-a135-11e9-9cda-0a87ae2ba916"; // silent since October
const UNIVERSITY = "1850868044363584392"; // not in the "before" rows: new
const STONY_ISLAND = "a3a528d0-a135-11e9-9cda-0a87ae2ba916"; // missing from station_information

// What the table holds after the worker saved the "before" response.
const tableAfterFirstRun = (): ComparedRow[] => buildRows(before, info).rows;

test("saves only stations whose counts changed, plus new ones", () => {
  const plan = planRun(tableAfterFirstRun(), after, info);
  const saved = plan.upserts.map((r) => r.station_id).sort();

  assert.deepEqual(saved, [PAULINA, RAVENSWOOD, UNIVERSITY].sort());
  assert.equal(plan.stationsInFeed, 7);
  assert.equal(plan.skippedWithoutInfo, 1);
  assert.equal(plan.feedLastUpdated, "2026-11-03T21:21:41.000Z");
});

test("saved rows carry the new values from the feed", () => {
  const byId = new Map(planRun(tableAfterFirstRun(), after, info).upserts.map((r) => [r.station_id, r]));

  assert.deepEqual(
    pick(byId.get(RAVENSWOOD)!, ["name", "num_bikes_available", "num_ebikes_available"]),
    { name: "Ravenswood Ave & Lawrence Ave", num_bikes_available: 37, num_ebikes_available: 32 },
  );
  assert.deepEqual(pick(byId.get(PAULINA)!, ["num_bikes_available", "num_ebikes_available"]), {
    num_bikes_available: 7,
    num_ebikes_available: 6,
  });
  assert.deepEqual(
    pick(byId.get(UNIVERSITY)!, ["name", "short_name", "capacity", "is_renting", "is_reporting"]),
    { name: "University Ave & 59th St", short_name: "CHI01913", capacity: 15, is_renting: true, is_reporting: true },
  );
});

test("a last_reported heartbeat alone is not a change", () => {
  const upserts = planRun(tableAfterFirstRun(), after, info).upserts.map((r) => r.station_id);
  assert.ok(!upserts.includes(SHIELDS));
  assert.ok(!upserts.includes(CALIFORNIA));
});

test("an identical response saves nothing", () => {
  const current = buildRows(after, info).rows;
  assert.deepEqual(planRun(current, after, info).upserts, []);
});

test("a flag change is saved", () => {
  const current = tableAfterFirstRun().map((r) => (r.station_id === CALIFORNIA ? { ...r, is_renting: false } : r));
  const upserts = planRun(current, after, info).upserts.map((r) => r.station_id);
  assert.ok(upserts.includes(CALIFORNIA));
});

test("a station is flagged inactive once, when it passes 24 h without reporting", () => {
  // Glenwood is already inactive in both responses: no write.
  assert.equal(buildRows(after, info).rows.find((r) => r.station_id === GLENWOOD)!.is_reporting, false);
  assert.ok(!planRun(tableAfterFirstRun(), after, info).upserts.some((r) => r.station_id === GLENWOOD));

  // Same response a day later with Shields unchanged: it crosses the threshold.
  const dayLater: GbfsStatus = structuredClone(after);
  dayLater.last_updated += INACTIVE_AFTER_SECONDS + 60;
  const current = buildRows(after, info).rows;
  const flipped = planRun(current, dayLater, info).upserts.find((r) => r.station_id === SHIELDS);
  assert.equal(flipped?.is_reporting, false);
});

test("a station missing from station_information is skipped, not saved nameless", () => {
  const upserts = planRun([], after, info).upserts;
  assert.ok(!upserts.some((r) => r.station_id === STONY_ISLAND));
  assert.equal(upserts.length, 6);
});

test("a malformed response throws so the run is recorded as failed", () => {
  assert.throws(() => planRun([], { error: "rate limited" }, info), /station_status: unexpected shape/);
  assert.throws(() => planRun([], after, {}), /station_information: unexpected shape/);
});

function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return Object.fromEntries(keys.map((k) => [k, obj[k]])) as Pick<T, K>;
}
