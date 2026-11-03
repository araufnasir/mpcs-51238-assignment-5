// Display formatting. Data is always metric; conversion happens only here.
export type Unit = "F" | "C";

export function formatTemp(celsius: number, unit: Unit) {
  return `${Math.round(unit === "F" ? (celsius * 9) / 5 + 32 : celsius)}°`;
}

export function formatWind(kmh: number, unit: Unit) {
  return unit === "F" ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`;
}
