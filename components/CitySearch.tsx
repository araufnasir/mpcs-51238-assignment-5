"use client";

import { useEffect, useState, useTransition } from "react";
import { saveCity } from "@/app/actions";
import { cityKey } from "@/lib/city-key";
import type { CityResult } from "@/lib/open-meteo";
import { StateMessage } from "./StateMessage";
import { secondaryButton } from "./buttons";

const DEBOUNCE_MS = 300;
const MIN_LENGTH = 2;

type Status = "loading" | "done" | "error";

export function CitySearch({ savedKeys }: { savedKeys: string[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("done");
  const [results, setResults] = useState<CityResult[]>([]);
  const [attempt, setAttempt] = useState(0); // bumped by Retry to re-run the search

  const [saved, setSaved] = useState(() => new Set(savedKeys));
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_LENGTH;

  // Wait until typing pauses, then search. Typing again (or leaving the page)
  // cancels both the pending timer and any request still in flight.
  useEffect(() => {
    if (tooShort) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const body: { results: CityResult[] } = await res.json();
        setResults(body.results);
        setStatus("done");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, tooShort, attempt]);

  function handleChange(value: string) {
    setQuery(value);
    const next = value.trim();
    // Only show loading if the effect will actually run a new search.
    if (next.length >= MIN_LENGTH && next !== trimmed) setStatus("loading");
  }

  function retry() {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  function handleSave(city: CityResult) {
    const key = cityKey(city);
    setSavingKey(key);
    setSaveError(null);
    startTransition(async () => {
      const result = await saveCity({ name: city.name, latitude: city.latitude, longitude: city.longitude });
      if (result.ok) setSaved((prev) => new Set(prev).add(key));
      else setSaveError(result.error);
      setSavingKey(null);
    });
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="sr-only">City name</span>
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search for a city, e.g. Chicago"
          autoFocus
          autoComplete="off"
          maxLength={100}
          className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {saveError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}

      {tooShort ? (
        <p className="text-sm text-zinc-500">Type at least {MIN_LENGTH} letters to search.</p>
      ) : status === "loading" ? (
        <ul aria-label="Searching" aria-busy className="space-y-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-14 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
          ))}
        </ul>
      ) : status === "error" ? (
        <StateMessage
          tone="error"
          icon="⚠️"
          title="City search is down"
          action={<button onClick={retry} className={secondaryButton}>Try again</button>}
        >
          We couldn&apos;t reach the Open-Meteo search service. Check your connection or try again in a moment.
        </StateMessage>
      ) : results.length === 0 ? (
        <StateMessage icon="🔍" title={`No cities found for “${trimmed}”`}>
          Check the spelling, or try a larger nearby city.
        </StateMessage>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {results.map((city) => {
            const key = cityKey(city);
            const isSaved = saved.has(key);
            const isSaving = savingKey === key;
            return (
              <li key={city.id}>
                <button
                  onClick={() => handleSave(city)}
                  disabled={isSaved || savingKey !== null}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-zinc-50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-900"
                >
                  <span>
                    <span className="block font-medium">{city.name}</span>
                    <span className="block text-xs text-zinc-500">
                      {city.latitude.toFixed(2)}°, {city.longitude.toFixed(2)}°
                    </span>
                  </span>
                  <span className={`shrink-0 text-sm ${isSaved ? "text-green-600 dark:text-green-400" : "text-sky-600 dark:text-sky-400"}`}>
                    {isSaved ? "✓ Saved" : isSaving ? "Saving…" : "+ Save"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
