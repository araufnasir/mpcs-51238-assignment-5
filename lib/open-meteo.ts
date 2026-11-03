import "server-only";
import { cacheLife } from "next/cache";

// Open-Meteo needs no API key. All calls happen on the server so we can cache
// responses and turn any failure into one clear "weather service down" state.

const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 5000;

export type CityResult = {
  id: number;
  name: string; // "Chicago, Illinois, United States"
  latitude: number;
  longitude: number;
};

// Always metric (°C, km/h); the browser converts for display.
export type CityForecast = {
  current: {
    temperature: number;
    feelsLike: number;
    weatherCode: number;
    isDay: boolean;
    windSpeed: number;
    windGusts: number;
    uvIndex: number;
  };
  today: { high: number; low: number; rainChance: number; uvMax: number; windMax: number };
  days: { date: string; weatherCode: number; high: number; low: number; rainChance: number }[];
};

type Coordinates = { latitude: number; longitude: number };

// Throws on any network or upstream error. Errors are never cached,
// so the next request (or a Retry click) tries Open-Meteo again.
async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  return res.json();
}

type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
};

export async function searchCities(query: string): Promise<CityResult[]> {
  "use cache";
  cacheLife("days"); // place names and coordinates rarely change

  const params = new URLSearchParams({ name: query, count: "8", language: "en", format: "json" });
  const data: { results?: GeocodingResult[] } = await getJson(`${GEOCODING_URL}?${params}`);

  // No matches comes back as 200 with no `results` key at all.
  return (data.results ?? []).map((r) => ({
    id: r.id,
    name: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

type ForecastResponse = {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    is_day: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    uv_index: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    uv_index_max: (number | null)[];
    wind_speed_10m_max: number[];
  };
};

// One request for every saved city: current conditions plus 7 days.
// Results are in the same order as `places`. The cache key is only the coordinates.
export async function getForecasts(places: Coordinates[]): Promise<CityForecast[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 600, expire: 3600 }); // conditions update every 15 min upstream

  if (places.length === 0) return [];

  const params = new URLSearchParams({
    latitude: places.map((p) => p.latitude).join(","),
    longitude: places.map((p) => p.longitude).join(","),
    current: "temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m,wind_gusts_10m,uv_index",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,wind_speed_10m_max",
    timezone: "auto",
    forecast_days: "7",
  });
  const data: ForecastResponse | ForecastResponse[] = await getJson(`${FORECAST_URL}?${params}`);

  // A single location returns an object; several return an array.
  return (Array.isArray(data) ? data : [data]).map(({ current: c, daily: d }) => ({
    current: {
      temperature: c.temperature_2m,
      feelsLike: c.apparent_temperature,
      weatherCode: c.weather_code,
      isDay: c.is_day === 1,
      windSpeed: c.wind_speed_10m,
      windGusts: c.wind_gusts_10m,
      uvIndex: c.uv_index,
    },
    today: {
      high: d.temperature_2m_max[0],
      low: d.temperature_2m_min[0],
      rainChance: d.precipitation_probability_max[0] ?? 0,
      uvMax: d.uv_index_max[0] ?? 0,
      windMax: d.wind_speed_10m_max[0],
    },
    days: d.time.map((date, i) => ({
      date,
      weatherCode: d.weather_code[i],
      high: d.temperature_2m_max[i],
      low: d.temperature_2m_min[i],
      rainChance: d.precipitation_probability_max[i] ?? 0,
    })),
  }));
}
