import { expect, test } from "@playwright/test";
import { bestOutdoorCity, outdoorScore, recommend, type WeatherInput } from "../lib/recommendations";

// Pure-function checks for the recommendation rules. No browser page, no sign-in.
// Each example can be checked by hand against the thresholds in lib/recommendations.ts.

const sunnyHot: WeatherInput = {
  current: { feelsLike: 29, weatherCode: 0, isDay: true },
  today: { high: 29, low: 20, rainChance: 5, uvMax: 8, windMax: 8 },
};
const coldRain: WeatherInput = {
  current: { feelsLike: 6, weatherCode: 63, isDay: true },
  today: { high: 10, low: 5, rainChance: 85, uvMax: 1, windMax: 25 },
};
const snowyNight: WeatherInput = {
  current: { feelsLike: -13, weatherCode: 73, isDay: false },
  today: { high: -4, low: -9, rainChance: 70, uvMax: 1, windMax: 20 },
};
const mildWindy: WeatherInput = {
  current: { feelsLike: 12, weatherCode: 3, isDay: true },
  today: { high: 16, low: 9, rainChance: 30, uvMax: 2, windMax: 45 },
};

test("clear hot day: light clothes, sun protection, swim and an early/late picnic", () => {
  expect(recommend(sunnyHot)).toEqual({
    wear: "Light, breathable clothes",
    bring: ["Sunscreen", "Sunglasses", "Hat"],
    outdoor: ["Swim or beach", "Picnic early or late (strong midday sun)"],
    indoor: ["Museum during the midday heat"],
  });
  // 100 - 0.6*5 - 3*|29-21| - 0 (wind) - 10 (UV 8) = 63
  expect(outdoorScore(sunnyHot)).toBe(63);
});

test("raining now: warm jacket and umbrella, walk between showers, mostly indoor ideas", () => {
  expect(recommend(coldRain)).toEqual({
    wear: "Warm jacket",
    bring: ["Umbrella"],
    outdoor: ["Short walk between showers"],
    indoor: ["Café or bookstore", "Cinema"],
  });
  // 100 - 51 - 33 - 7.5 = 8.5 → 9
  expect(outdoorScore(coldRain)).toBe(9);
});

test("snowy night: heavy coat and boots, no umbrella, snow walk and indoor ideas", () => {
  expect(recommend(snowyNight)).toEqual({
    wear: "Heavy coat, hat, gloves and scarf, plus boots",
    bring: [],
    outdoor: ["Evening walk in the snow"],
    indoor: ["Board games", "Cook something warm"],
  });
  // 100 - 42 - 45 (capped) - 0 = 13
  expect(outdoorScore(snowyNight)).toBe(13);
});

test("mild but windy: windproof layer, hooded jacket instead of umbrella, kite not bike", () => {
  expect(recommend(mildWindy)).toEqual({
    wear: "Light jacket or sweater",
    bring: ["Hooded jacket in case of showers", "Windproof layer"],
    outdoor: ["Fly a kite", "Hike or long walk"],
    indoor: ["Museum or gallery"],
  });
  // 100 - 18 - 15 - 37.5 = 29.5 → 30
  expect(outdoorScore(mildWindy)).toBe(30);
});

test("dry now, showers later: go out early, still bring an umbrella", () => {
  const dryNowShowersLater: WeatherInput = {
    current: { feelsLike: 16, weatherCode: 0, isDay: true },
    today: { high: 24, low: 15, rainChance: 68, uvMax: 8, windMax: 18 },
  };
  expect(recommend(dryNowShowersLater)).toEqual({
    wear: "Long sleeves",
    bring: ["Umbrella", "Sunscreen", "Sunglasses", "Hat"],
    outdoor: ["Get outside now, before the showers"],
    indoor: ["Café or bookstore", "Cinema"],
  });
  // 100 - 0.6*68 - 3*|24-21| - 0 (wind) - 10 (UV 8) = 40.2 → 40
  expect(outdoorScore(dryNowShowersLater)).toBe(40);
});

test("thunderstorm: no outdoor ideas", () => {
  const storm: WeatherInput = { ...coldRain, current: { ...coldRain.current, weatherCode: 95 } };
  const rec = recommend(storm);
  expect(rec.outdoor).toEqual([]);
  expect(rec.indoor).toHaveLength(3);
});

test("best outdoor city picks the highest score, or none if every city is poor", () => {
  const best = bestOutdoorCity([
    { name: "Rainy Town", weather: coldRain },
    { name: "Sunny City", weather: sunnyHot },
  ]);
  expect(best).toEqual({ name: "Sunny City", score: 63, reasons: ["dry", "light wind"] });

  expect(bestOutdoorCity([{ name: "Rainy Town", weather: coldRain }, { name: "Windy Bay", weather: mildWindy }])).toBeNull();
  expect(bestOutdoorCity([])).toBeNull();
});
