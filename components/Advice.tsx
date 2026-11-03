import type { Recommendation } from "@/lib/recommendations";

export function Advice({ rec }: { rec: Recommendation }) {
  return (
    <dl className="grid gap-2 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
      <div className="flex gap-3">
        <dt className="w-14 shrink-0 font-medium text-zinc-600 dark:text-zinc-400">Wear</dt>
        <dd>{rec.wear}</dd>
      </div>
      <div className="flex gap-3">
        <dt className="w-14 shrink-0 font-medium text-zinc-600 dark:text-zinc-400">Bring</dt>
        <dd>{rec.bring.length ? rec.bring.join(", ") : "Nothing extra"}</dd>
      </div>
      <div className="flex gap-3">
        <dt className="w-14 shrink-0 font-medium text-zinc-600 dark:text-zinc-400">Ideas</dt>
        <dd>
          <ul className="flex flex-wrap gap-1.5">
            {rec.outdoor.map((idea) => (
              <li key={idea} className="rounded-full border border-emerald-300 px-2 py-0.5 text-emerald-900 dark:border-emerald-800 dark:text-emerald-200">
                <span className="sr-only">Outdoor: </span>
                <span aria-hidden>🌳 </span>
                {idea}
              </li>
            ))}
            {rec.indoor.map((idea) => (
              <li key={idea} className="rounded-full border border-zinc-300 px-2 py-0.5 dark:border-zinc-700">
                <span className="sr-only">Indoor: </span>
                <span aria-hidden>🏠 </span>
                {idea}
              </li>
            ))}
          </ul>
        </dd>
      </div>
    </dl>
  );
}
