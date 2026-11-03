import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { CityCard } from "@/components/CityCard";
import { DailyBrief } from "@/components/DailyBrief";
import { RetryButton } from "@/components/RetryButton";
import { StateMessage } from "@/components/StateMessage";
import { UnitToggle } from "@/components/Units";
import { primaryButton } from "@/components/buttons";
import { getForecasts, type CityForecast } from "@/lib/open-meteo";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function WatchlistPage() {
  await auth.protect();

  // RLS returns only the signed-in user's rows.
  const supabase = await createServerSupabaseClient();
  const { data: cities, error } = await supabase
    .from("saved_cities")
    .select("id, name, latitude, longitude")
    .order("created_at")
    .limit(50); // matches the per-user cap enforced in the database

  let content;
  if (error) {
    content = (
      <StateMessage tone="error" icon="⚠️" title="Couldn't load your watchlist" action={<RetryButton />}>
        Something went wrong reading your saved cities.
      </StateMessage>
    );
  } else if (cities.length === 0) {
    content = (
      <StateMessage
        icon="🗺️"
        title="No saved cities yet"
        action={<Link href="/search" className={primaryButton}>Search for a city</Link>}
      >
        Search for a city and save it to see its current weather here.
      </StateMessage>
    );
  } else {
    let weather: CityForecast[] | null = null;
    try {
      weather = await getForecasts(cities.map(({ latitude, longitude }) => ({ latitude, longitude })));
    } catch {
      // Shown below as the API-down state; saved cities still render and can be removed.
    }

    content = (
      <div className="space-y-4">
        {!weather && (
          <StateMessage tone="error" icon="🌩️" title="Weather service is down" action={<RetryButton />}>
            We couldn&apos;t reach Open-Meteo for current conditions. Your saved cities are safe.
          </StateMessage>
        )}
        {weather && (
          <DailyBrief cities={cities.map((city, i) => ({ id: city.id, name: city.name, weather: weather[i] }))} />
        )}
        <ul className="space-y-3">
          {cities.map((city, i) => (
            <CityCard key={city.id} id={city.id} name={city.name} weather={weather?.[i]} />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your watchlist</h1>
        <div className="flex items-center gap-3">
          <UnitToggle />
          <Link href="/search" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
            + Add city
          </Link>
        </div>
      </div>
      {content}
    </main>
  );
}
