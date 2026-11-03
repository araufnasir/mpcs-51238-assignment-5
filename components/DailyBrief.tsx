import type { CityForecast } from "@/lib/open-meteo";
import { bestOutdoorCity, recommend } from "@/lib/recommendations";

type CityWeather = { id: string; name: string; weather: CityForecast };

// City names here are plain text, not headings: each card's <h2> is the one
// heading per city (the isolation test relies on that).
export function DailyBrief({ cities }: { cities: CityWeather[] }) {
  const best = bestOutdoorCity(cities);

  return (
    <section aria-labelledby="daily-brief" className="rounded-2xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
      <h2 id="daily-brief" className="font-semibold">Today&apos;s brief</h2>

      <p className="mt-1 text-sm">
        {best ? (
          <>
            <span aria-hidden>🌳 </span>Best for outdoor plans: <strong>{best.name}</strong>
            {best.reasons.length > 0 && ` (${best.reasons.join(", ")})`}
          </>
        ) : (
          <>
            <span aria-hidden>🏠 </span>No great outdoor weather in your cities today. A good day for indoor plans.
          </>
        )}
      </p>

      <ul className="mt-3 space-y-1 text-sm">
        {cities.map(({ id, name, weather }) => {
          const rec = recommend(weather);
          const rainGear = rec.bring.find((item) => /umbrella|rain jacket|hooded/i.test(item));
          return (
            <li key={id}>
              <strong>{name}</strong>: {rec.wear}
              {rainGear && ` · ${rainGear}`}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
