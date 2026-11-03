"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useState } from "react";
import { FollowButton } from "./FollowButton";
import {
  applyRun,
  clockAges,
  formatAge,
  freshnessReason,
  freshnessState,
  type ChannelStatus,
  type Freshness,
  type Run,
} from "@/lib/freshness";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export type { Run };

export type LiveStation = {
  station_id: string;
  name: string;
  num_bikes_available: number;
  num_ebikes_available: number;
  num_docks_available: number;
  is_renting: boolean;
  is_reporting: boolean;
  last_reported: string;
  updated_at: string;
};

type LastEvent = { table: string; type: string; at: number; detail: string };

export function LiveStations({
  initialStations,
  latestRun: initialLatestRun,
  lastOkRun: initialLastOkRun,
}: {
  initialStations: LiveStation[];
  latestRun: Run | null;
  lastOkRun: Run | null;
}) {
  const { getToken, isSignedIn } = useAuth();
  const [stations, setStations] = useState(initialStations);
  const [runs, setRuns] = useState({ latestRun: initialLatestRun, lastOkRun: initialLastOkRun });
  const { latestRun, lastOkRun } = runs;
  const [channelStatus, setChannelStatus] = useState<ChannelStatus>("CONNECTING");
  const [lastEvent, setLastEvent] = useState<LastEvent | null>(null);
  // null until mounted, so server and client render the same markup.
  const [now, setNow] = useState<number | null>(null);

  // The parent remounts this component (key) when follows change, so the
  // subscription's filter is fixed for its lifetime.
  const stationFilter = useMemo(
    () => `station_id=in.(${initialStations.map((s) => s.station_id).join(",")})`,
    [initialStations],
  );

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;
    const supabase = createBrowserSupabaseClient(() => getToken());
    const channel = supabase.channel("live-stations");

    if (initialStations.length > 0) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stations", filter: stationFilter },
        (payload) => {
          const row = payload.new as LiveStation;
          if (!row?.station_id) return;
          setStations((prev) => prev.map((s) => (s.station_id === row.station_id ? { ...s, ...row } : s)));
          setLastEvent({ table: "stations", type: payload.eventType, at: Date.now(), detail: row.name });
        },
      );
    }
    channel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "runs" }, (payload) => {
        const run = payload.new as Run;
        setRuns((prev) => applyRun(prev, run));
        setLastEvent({
          table: "runs",
          type: "INSERT",
          at: Date.now(),
          detail: run.ok ? `ok, ${run.rows_changed} rows` : "failed",
        });
      })
      .subscribe((status) => setChannelStatus(status as ChannelStatus));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSignedIn, getToken, stationFilter, initialStations.length]);

  const { workerAge, feedAge } = clockAges(lastOkRun, now);
  const state = freshnessState({ channelStatus, latestRun, workerAge, feedAge });

  return (
    <section aria-labelledby="following-heading" className="space-y-4">
      <FreshnessBanner state={state} channelStatus={channelStatus} latestRun={latestRun} workerAge={workerAge} feedAge={feedAge} now={now} />

      <h2 id="following-heading" className="text-lg font-semibold">
        Following ({stations.length}/50)
      </h2>

      {stations.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 p-6 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          You aren&apos;t following any stations yet. Search below and follow one to watch it live.
        </p>
      ) : (
        // Polite live region: count changes are announced without interrupting.
        <ul aria-live="polite" className={`space-y-3 ${state.kind === "stale" || state.kind === "down" ? "opacity-75" : ""}`}>
          {stations.map((s) => (
            <StationCard key={s.station_id} station={s} now={now} />
          ))}
        </ul>
      )}

      {process.env.NODE_ENV === "development" && (
        <DevRealtimeIndicator channelStatus={channelStatus} lastEvent={lastEvent} now={now} />
      )}
    </section>
  );
}

const BANNER = {
  loading: { icon: "⏳", title: "Connecting to live updates…", colors: "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900" },
  fresh: { icon: "✅", title: "Live", colors: "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40" },
  stale: { icon: "⚠️", title: "Data may be out of date", colors: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40" },
  down: { icon: "⛔", title: "Updates are down", colors: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40" },
} as const;

function FreshnessBanner({
  state,
  channelStatus,
  latestRun,
  workerAge,
  feedAge,
  now,
}: {
  state: Freshness;
  channelStatus: ChannelStatus;
  latestRun: Run | null;
  workerAge: number | null;
  feedAge: number | null;
  now: number | null;
}) {
  const b = BANNER[state.kind];
  const reason = freshnessReason(state, { latestRun, workerAge, feedAge, now });
  const disconnected = channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT" || channelStatus === "CLOSED";

  return (
    <div className={`rounded-xl border p-4 ${b.colors}`}>
      {/* Only the state and its reason are announced; the ticking ages below are not. */}
      <div role="status" aria-live="polite" className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>{b.icon}</span>
        <div>
          <p className="font-semibold">{b.title}</p>
          {reason && <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">{reason}</p>}
          {disconnected && (
            <p className="mt-0.5 text-sm text-zinc-700 dark:text-zinc-300">Live connection lost; reconnecting…</p>
          )}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-zinc-600 dark:text-zinc-400">Worker updated</dt>
          <dd className="font-medium tabular-nums">{workerAge === null ? "—" : `${formatAge(workerAge)} ago`}</dd>
        </div>
        <div>
          <dt className="text-zinc-600 dark:text-zinc-400">Divvy feed published</dt>
          <dd className="font-medium tabular-nums">{feedAge === null ? "—" : `${formatAge(feedAge)} ago`}</dd>
        </div>
      </dl>
    </div>
  );
}

function StationCard({ station: s, now }: { station: LiveStation; now: number | null }) {
  return (
    <li className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{s.name}</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Station last reported a change {now === null ? "—" : formatAge(now - Date.parse(s.last_reported))} ago
            {!s.is_renting && " · not renting"}
            {!s.is_reporting && " · inactive (no report in 24 h)"}
          </p>
        </div>
        <FollowButton stationId={s.station_id} name={s.name} following />
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Count label="Bikes" value={s.num_bikes_available} />
        <Count label="E-bikes" value={s.num_ebikes_available} />
        <Count label="Docks" value={s.num_docks_available} />
      </dl>
    </li>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-zinc-50 py-2 dark:bg-zinc-900">
      <dt className="text-xs text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function DevRealtimeIndicator({ channelStatus, lastEvent, now }: { channelStatus: ChannelStatus; lastEvent: LastEvent | null; now: number | null }) {
  return (
    <aside
      aria-label="Realtime debug (development only)"
      className="fixed right-3 bottom-3 rounded-lg border border-zinc-300 bg-white/95 px-3 py-2 font-mono text-xs shadow dark:border-zinc-700 dark:bg-zinc-900/95"
    >
      <div>channel: {channelStatus}</div>
      <div>
        last event:{" "}
        {lastEvent && now !== null ? `${lastEvent.table} ${lastEvent.type} (${lastEvent.detail}) ${formatAge(now - lastEvent.at)} ago` : "none yet"}
      </div>
    </aside>
  );
}
