"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { primaryButton } from "@/components/buttons";

const DEBOUNCE_MS = 250;
const MIN_LENGTH = 2;

// Search-as-you-type for /live. It only changes ?q; the server page runs the
// same query as pressing Search. The input is uncontrolled, so re-rendered
// results never reset what's typed or move focus.
export function StationSearchForm({ query }: { query: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function handleChange(value: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = value.trim();
      const href = q.length >= MIN_LENGTH ? `/live?q=${encodeURIComponent(q)}` : "/live";
      startTransition(() => router.replace(href, { scroll: false }));
    }, DEBOUNCE_MS);
  }

  return (
    <div className="space-y-2">
      {/* Enter and the Search button still submit a plain GET to /live?q=… */}
      <form role="search" action="/live" onSubmit={() => timer.current && clearTimeout(timer.current)} className="flex gap-2">
        <label htmlFor="station-q" className="sr-only">Station name</label>
        <input
          id="station-q"
          name="q"
          type="search"
          defaultValue={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="e.g. Clinton St"
          maxLength={100}
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button type="submit" className={`${primaryButton} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600`}>
          Search
        </button>
      </form>
      {/* Always rendered so screen readers announce "Searching…" when it appears. */}
      <div role="status" className="min-h-5 text-sm text-zinc-600 dark:text-zinc-400">
        {isPending && (
          <span>
            <span aria-hidden>⏳</span> Searching…
          </span>
        )}
      </div>
    </div>
  );
}
