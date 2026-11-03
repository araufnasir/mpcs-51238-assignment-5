export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8" aria-busy>
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-8 h-12 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-800" />
    </main>
  );
}
