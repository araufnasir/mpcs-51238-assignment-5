import { auth } from "@clerk/nextjs/server";
import { FollowButton } from "@/components/live/FollowButton";
import { LiveStations, type LiveStation, type Run } from "@/components/live/LiveStations";
import { StationSearchForm } from "@/components/live/StationSearchForm";
import { RetryButton } from "@/components/RetryButton";
import { StateMessage } from "@/components/StateMessage";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const STATION_COLUMNS =
  "station_id, name, num_bikes_available, num_ebikes_available, num_docks_available, is_renting, is_reporting, last_reported, updated_at";
const RUN_COLUMNS = "id, finished_at, ok, rows_changed, feed_last_updated, error";
const SEARCH_LIMIT = 15;
const MAX_WORDS = 5;

// Escape ilike wildcards so a typed % or _ matches literally.
const escapeLike = (word: string) => word.replace(/[\\%_]/g, (c) => `\\${c}`);

export default async function LivePage({ searchParams }: PageProps<"/live">) {
  await auth.protect();
  const { q } = await searchParams;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);
  // Each word must appear somewhere in the name, so "59th university" finds "University Ave & 59th St".
  const words = query.split(/\s+/).filter(Boolean).slice(0, MAX_WORDS);

  const supabase = await createServerSupabaseClient();
  // RLS returns only the signed-in user's follows.
  const [follows, latestRun, lastOkRun] = await Promise.all([
    supabase.from("followed_stations").select(`station_id, stations (${STATION_COLUMNS})`).order("created_at").limit(50),
    supabase.from("runs").select(RUN_COLUMNS).order("id", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("runs").select(RUN_COLUMNS).eq("ok", true).order("id", { ascending: false }).limit(1).maybeSingle(),
  ]);

  // Only stations that reported in the last 24 h are offered, so nobody follows a dead one.
  let search = null;
  if (words.length > 0) {
    let stationQuery = supabase
      .from("stations")
      .select("station_id, name, num_bikes_available, num_docks_available")
      .eq("is_reporting", true)
      .eq("is_installed", true);
    for (const word of words) stationQuery = stationQuery.ilike("name", `%${escapeLike(word)}%`);
    search = await stationQuery.order("name").limit(SEARCH_LIMIT);
  }

  if (follows.error || latestRun.error || lastOkRun.error) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Live Divvy stations</h1>
        <StateMessage tone="error" icon="⚠️" title="Couldn't load your stations" action={<RetryButton />}>
          Something went wrong reading your followed stations.
        </StateMessage>
      </main>
    );
  }

  const stations = follows.data.flatMap((f) => (f.stations ? [f.stations as unknown as LiveStation] : []));
  const followedIds = new Set(stations.map((s) => s.station_id));

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">Live Divvy stations</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Bike and dock counts update on their own, about once a minute.
        </p>
      </div>

      <LiveStations
        key={[...followedIds].join(",")}
        initialStations={stations}
        latestRun={latestRun.data as Run | null}
        lastOkRun={lastOkRun.data as Run | null}
      />

      <section aria-labelledby="search-heading" className="space-y-3">
        <h2 id="search-heading" className="text-lg font-semibold">Find a station</h2>
        <StationSearchForm query={query} />

        {search?.error && (
          <StateMessage tone="error" icon="⚠️" title="Search failed" action={<RetryButton />}>
            Couldn&apos;t search stations. Please try again.
          </StateMessage>
        )}
        {search?.data && search.data.length === 0 && (
          <StateMessage icon="🔍" title={`No stations match ‘${query}’`}>
            Station names are street intersections, so try ‘university’, ‘canal’ or ‘clinton’. Only stations that
            reported in the last 24 hours are listed.
          </StateMessage>
        )}
        {search?.data && search.data.length > 0 && (
          <>
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {search.data.map((s) => (
                <li key={s.station_id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">
                      {s.num_bikes_available} bikes · {s.num_docks_available} docks
                    </p>
                  </div>
                  <FollowButton stationId={s.station_id} name={s.name} following={followedIds.has(s.station_id)} />
                </li>
              ))}
            </ul>
            {search.data.length === SEARCH_LIMIT && (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Showing the first {SEARCH_LIMIT} matches. Type more of the name to narrow it down.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
