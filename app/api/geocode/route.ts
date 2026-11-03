import { auth } from "@clerk/nextjs/server";
import { searchCities } from "@/lib/open-meteo";

// GET /api/geocode?q=chic → { results: CityResult[] } or 502 { error }
export async function GET(request: Request) {
  await auth.protect();

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) {
    return Response.json({ results: [] });
  }

  try {
    return Response.json({ results: await searchCities(query) });
  } catch {
    return Response.json({ error: "The city search service is unavailable." }, { status: 502 });
  }
}
