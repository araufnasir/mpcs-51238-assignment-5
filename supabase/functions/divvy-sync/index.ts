// divvy-sync: called by Supabase Cron every 60 s. Fetches Divvy's GBFS feeds,
// upserts only the stations that changed, and records every run in public.runs.
//
// Deployed with verify_jwt = false: the caller must instead send the shared
// secret from Vault in the x-divvy-sync-secret header. The database checks it
// (divvy_sync_secret_ok), so the value never exists in this code or its env.

import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { planRun } from "./core.ts";
import type { ComparedRow } from "./core.ts";

const FEED = "https://gbfs.lyft.com/gbfs/2.3/chi/en";
const FETCH_TIMEOUT_MS = 8_000;
const PAGE = 1_000; // PostgREST's default max rows per request
const COMPARED_COLUMNS =
  "station_id,name,short_name,lat,lon,capacity,num_bikes_available,num_ebikes_available," +
  "num_docks_available,num_bikes_disabled,num_docks_disabled,is_installed,is_renting,is_returning,is_reporting";

// The secret key is injected by Supabase into the function's environment.
const secretKey =
  JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const candidate = req.headers.get("x-divvy-sync-secret");
  if (!candidate) return reject("missing secret");
  const { data: allowed, error: checkError } = await supabase.rpc("divvy_sync_secret_ok", { candidate });
  if (checkError) {
    console.error(`divvy-sync secret check failed: ${checkError.message}`);
    return json({ error: "secret check failed" }, 500);
  }
  if (!allowed) return reject("wrong secret");

  const startedAt = new Date();
  try {
    const [status, info] = await Promise.all([getJson(`${FEED}/station_status.json`), getJson(`${FEED}/station_information.json`)]);
    const plan = planRun(await loadCurrent(), status, info);

    const updatedAt = new Date().toISOString();
    for (let i = 0; i < plan.upserts.length; i += 500) {
      const chunk = plan.upserts.slice(i, i + 500).map((r) => ({ ...r, updated_at: updatedAt }));
      const { error } = await supabase.from("stations").upsert(chunk, { onConflict: "station_id" });
      if (error) throw new Error(`upsert stations: ${error.message}`);
    }

    await recordRun({
      started_at: startedAt.toISOString(),
      ok: true,
      rows_changed: plan.upserts.length,
      feed_last_updated: plan.feedLastUpdated,
    });
    console.log(
      `divvy-sync ok rows_changed=${plan.upserts.length} stations=${plan.stationsInFeed} ` +
        `skipped_without_info=${plan.skippedWithoutInfo} feed_last_updated=${plan.feedLastUpdated} ` +
        `ms=${Date.now() - startedAt.getTime()} fields=${JSON.stringify(plan.changedFields)}`,
    );
    return json({ ok: true, rows_changed: plan.upserts.length, feed_last_updated: plan.feedLastUpdated });
  } catch (e) {
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
    console.error(`divvy-sync failed: ${message}`);
    await recordRun({ started_at: startedAt.toISOString(), ok: false, rows_changed: 0, error: message }).catch(
      (recordError) => console.error(`divvy-sync could not record failed run: ${recordError.message}`),
    );
    return json({ ok: false, error: message }, 500);
  }
});

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`GET ${url}: HTTP ${res.status}`);
  return res.json();
}

async function loadCurrent(): Promise<ComparedRow[]> {
  const rows: ComparedRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("stations")
      .select(COMPARED_COLUMNS)
      .order("station_id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`select stations: ${error.message}`);
    rows.push(...(data as unknown as ComparedRow[]));
    if (data.length < PAGE) return rows;
  }
}

async function recordRun(run: {
  started_at: string;
  ok: boolean;
  rows_changed: number;
  feed_last_updated?: string;
  error?: string;
}) {
  const { error } = await supabase.from("runs").insert(run);
  if (error) throw new Error(`insert run: ${error.message}`);
}

function reject(reason: string) {
  console.warn(`divvy-sync rejected request: ${reason}`);
  return json({ error: "unauthorized" }, 401);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
