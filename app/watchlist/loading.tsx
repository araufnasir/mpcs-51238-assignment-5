export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8" aria-busy aria-label="Loading your watchlist">
      <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-64 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </ul>
    </main>
  );
}
