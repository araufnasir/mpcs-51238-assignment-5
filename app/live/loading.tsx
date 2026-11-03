export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8" aria-busy aria-label="Loading live stations">
      <div className="mb-6 h-8 w-56 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mb-6 h-24 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
      <ul className="space-y-3">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-32 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
        ))}
      </ul>
    </main>
  );
}
