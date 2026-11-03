import { weatherCategory } from "./weather-codes";

// Rule-based advice from public weather data only. Pure functions: no I/O,
// nothing about the signed-in user. Inputs are metric (°C, km/h); outputs
// contain no numbers, so they read the same in °C or °F.

export type WeatherInput = {
  current: { feelsLike: number; weatherCode: number; isDay: boolean };
  today: { high: number; low: number; rainChance: number; uvMax: number; windMax: number };
};

export type Recommendation = {
  wear: string;
  bring: string[];
  outdoor: string[];
  indoor: string[];
};

const WINDY = 30; // km/h: bring a windproof layer
const TOO_WINDY_FOR_UMBRELLA = 40; // km/h
const LIKELY_RAIN = 60; // %
const POSSIBLE_RAIN = 30; // %
const HIGH_UV = 6;
const VERY_HIGH_UV = 8;
const POOR_OUTDOOR_SCORE = 40;

function wearFor(feelsLike: number) {
  if (feelsLike <= -10) return "Heavy coat, hat, gloves and scarf";
  if (feelsLike <= 0) return "Winter coat, hat and gloves";
  if (feelsLike <= 8) return "Warm jacket";
  if (feelsLike <= 15) return "Light jacket or sweater";
  if (feelsLike <= 21) return "Long sleeves";
  if (feelsLike <= 26) return "T-shirt";
  return "Light, breathable clothes";
}

export function recommend({ current, today }: WeatherInput): Recommendation {
  const category = weatherCategory(current.weatherCode);
  const snowy = category === "snow";
  const stormy = category === "storm";
  const rainingNow = category === "rain" || stormy;
  const rainy = !snowy && (rainingNow || today.rainChance >= LIKELY_RAIN);
  const windy = today.windMax >= WINDY;
  const tooWindyForUmbrella = today.windMax >= TOO_WINDY_FOR_UMBRELLA;
  const feels = current.feelsLike;

  const wear = wearFor(feels) + (snowy ? ", plus boots" : "");

  const bring: string[] = [];
  if (rainy) bring.push(tooWindyForUmbrella ? "Hooded rain jacket (too windy for an umbrella)" : "Umbrella");
  else if (!snowy && today.rainChance >= POSSIBLE_RAIN)
    bring.push(tooWindyForUmbrella ? "Hooded jacket in case of showers" : "Compact umbrella");
  if (windy) bring.push("Windproof layer");
  if (today.uvMax >= HIGH_UV) bring.push("Sunscreen", "Sunglasses", "Hat");
  else if (today.uvMax >= 3) bring.push("Sunscreen");
  if (today.high - today.low >= 10) bring.push("An extra layer for later");

  let outdoor: string[];
  let indoor: string[];
  if (stormy) {
    outdoor = [];
    indoor = ["Cinema", "Café or bookstore", "Board games at home"];
  } else if (!current.isDay) {
    outdoor = snowy
      ? ["Evening walk in the snow"]
      : rainy
        ? []
        : feels >= 15
          ? ["Outdoor dinner", "Evening walk"]
          : ["Evening walk"];
    indoor = snowy || feels < 5 ? ["Board games", "Cook something warm"] : ["Live music or a show", "Cinema"];
  } else if (snowy) {
    outdoor = ["Build a snowman or go sledding", "Winter walk"];
    indoor = ["Café with a hot drink"];
  } else if (rainy) {
    // Dry right now but showers likely later: go out early rather than "between showers".
    outdoor = [rainingNow ? "Short walk between showers" : "Get outside now, before the showers"];
    indoor = ["Café or bookstore", "Cinema"];
  } else if (feels >= 24) {
    outdoor = ["Swim or beach", today.uvMax >= HIGH_UV ? "Picnic early or late (strong midday sun)" : "Picnic in the park"];
    indoor = [feels >= 28 ? "Museum during the midday heat" : "Museum or gallery"];
  } else if (feels >= 10) {
    outdoor = [tooWindyForUmbrella ? "Fly a kite" : "Bike ride", "Hike or long walk"];
    indoor = ["Museum or gallery"];
  } else {
    outdoor = ["Brisk walk", "Visit an outdoor market"];
    indoor = ["Café or bookstore"];
  }

  // 2–3 ideas in total: up to 2 outdoor, then fill with indoor.
  outdoor = outdoor.slice(0, 2);
  indoor = indoor.slice(0, Math.max(1, 3 - outdoor.length));
  return { wear, bring, outdoor, indoor };
}

// 0–100: how good today is for outdoor plans.
export function outdoorScore({ current, today }: WeatherInput) {
  let score = 100;
  score -= 0.6 * today.rainChance;
  score -= Math.min(45, 3 * Math.abs(today.high - 21));
  score -= 1.5 * Math.max(0, today.windMax - 20);
  if (weatherCategory(current.weatherCode) === "storm") score -= 30;
  if (today.uvMax >= VERY_HIGH_UV) score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function outdoorReasons({ today }: WeatherInput) {
  const reasons: string[] = [];
  if (today.rainChance < 20) reasons.push("dry");
  if (today.windMax < 20) reasons.push("light wind");
  if (today.high >= 15 && today.high <= 26) reasons.push("comfortable temperatures");
  return reasons.slice(0, 2);
}

// The saved city with the best outdoor score today, or null if none is good.
// Ties go to the city saved first.
export function bestOutdoorCity<T extends { name: string; weather: WeatherInput }>(cities: T[]) {
  let best: { city: T; score: number } | null = null;
  for (const city of cities) {
    const score = outdoorScore(city.weather);
    if (!best || score > best.score) best = { city, score };
  }
  if (!best || best.score < POOR_OUTDOOR_SCORE) return null;
  return { name: best.city.name, score: best.score, reasons: outdoorReasons(best.city.weather) };
}
