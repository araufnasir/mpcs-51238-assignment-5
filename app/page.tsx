import { Show } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { primaryButton, secondaryButton } from "@/components/buttons";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Weather for the cities you care about</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
        Search any city, save it to your personal watchlist, and see the current temperature, conditions, and
        today&apos;s high and low at a glance. Your list is private to your account and is still there next time
        you sign in.
      </p>

      <ul className="mt-8 space-y-2 text-zinc-700 dark:text-zinc-300">
        <li>🔍 Search cities worldwide</li>
        <li>⭐ Save them to your own list</li>
        <li>🌡️ Current conditions for each, updated every few minutes</li>
      </ul>

      <div className="mt-10 flex gap-3">
        <Suspense fallback={<div className="h-9" />}>
          <Show when="signed-out">
            <Link href="/sign-up" className={primaryButton}>Create an account</Link>
            <Link href="/sign-in" className={secondaryButton}>Sign in</Link>
          </Show>
          <Show when="signed-in">
            <Link href="/watchlist" className={primaryButton}>Open your watchlist</Link>
            <Link href="/search" className={secondaryButton}>Search cities</Link>
          </Show>
        </Suspense>
      </div>

      <p className="mt-16 text-xs text-zinc-500">
        Weather data by <a href="https://open-meteo.com/" className="underline">Open-Meteo</a>.
      </p>
    </main>
  );
}
