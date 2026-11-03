import { auth } from "@clerk/nextjs/server";
import { CitySearch } from "@/components/CitySearch";
import { cityKey } from "@/lib/city-key";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function SearchPage() {
  await auth.protect();

  // Already-saved cities show as "Saved" in the results. RLS returns only this user's rows.
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("saved_cities").select("latitude, longitude");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Search cities</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">Tap a result to add it to your watchlist.</p>
      <CitySearch savedKeys={(data ?? []).map(cityKey)} />
    </main>
  );
}
