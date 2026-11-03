import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { primaryButton, secondaryButton } from "@/components/buttons";

// Signed-in visitors are sent to /live by proxy.ts, so this is mostly seen signed out.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Live bike and dock counts for your Divvy stations</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Follow the Divvy stations you ride from and see how many bikes, e-bikes and open docks each one has right
        now. The counts update by themselves about once a minute, with no refreshing, and the page tells you how
        fresh the data is.
      </p>

      <ul className="mt-8 space-y-2 text-zinc-700 dark:text-zinc-300">
        <li>🔍 Search Chicago&apos;s active Divvy stations by name</li>
        <li>⭐ Follow up to 50 stations on your own private list</li>
        <li>⚡ Bikes, e-bikes and docks update live, about every minute</li>
        <li>🕒 See when the data was last updated, and a clear warning if it falls behind</li>
      </ul>

      <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        Also included: a weather watchlist for the cities you care about.
      </p>

      <div className="mt-10 flex gap-3">
        <Suspense fallback={<div className="h-9" />}>
          <Show when="signed-out">
            <Link href="/sign-up" className={primaryButton}>Create an account</Link>
            <Link href="/sign-in" className={secondaryButton}>Sign in</Link>
          </Show>
          <Show when="signed-in">
            <Link href="/live" className={primaryButton}>Open live stations</Link>
            <Link href="/watchlist" className={secondaryButton}>Weather</Link>
          </Show>
        </Suspense>
      </div>

      <p className="mt-16 text-xs text-zinc-500">
        Station data from <a href="https://divvybikes.com/system-data" className="underline">Divvy&apos;s public GBFS feed</a>.
        Weather data by <a href="https://open-meteo.com/" className="underline">Open-Meteo</a>.
      </p>
    </main>
  );
}
