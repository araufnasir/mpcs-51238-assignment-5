// Identifies a place by its coordinates, matching the table's unique constraint.
export function cityKey(city: { latitude: number; longitude: number }) {
  return `${city.latitude},${city.longitude}`;
}
