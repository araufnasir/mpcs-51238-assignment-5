import type { CityForecast } from "@/lib/open-meteo";
import { recommend } from "@/lib/recommendations";
import { describeWeather, uvLevel } from "@/lib/weather-codes";
import { Advice } from "./Advice";
import { DeleteCityButton } from "./DeleteCityButton";
import { Temp, Wind } from "./Units";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function CityCard({ id, name, weather }: { id: string; name: string; weather?: CityForecast }) {
  if (!weather) {
    return (
      <li className="flex items-center gap-4 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug break-words">{name}</h2>
          <p className="text-sm text-zinc-500">Weather unavailable</p>
        </div>
        <DeleteCityButton id={id} name={name} />
      </li>
    );
  }

  const { current, today } = weather;
  const conditions = describeWeather(current.weatherCode, current.isDay);
  const gusty = current.windGusts - current.windSpeed >= 15;

  return (
    <li className="space-y-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug break-words">{name}</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {conditions.label} · Feels like <Temp c={current.feelsLike} />
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            H <Temp c={today.high} /> · L <Temp c={today.low} />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-4xl" aria-hidden>{conditions.icon}</span>
          <span className="text-4xl font-semibold tabular-nums"><Temp c={current.temperature} /></span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-sm">
        <Stat label="Rain today" value={`${today.rainChance}%`} />
        <Stat
          label="Wind"
          value={
            <>
              <Wind kmh={current.windSpeed} />
              {gusty && (
                <>
                  , gusts <Wind kmh={current.windGusts} />
                </>
              )}
            </>
          }
        />
        <Stat label="UV today" value={`${Math.round(today.uvMax)} ${uvLevel(today.uvMax)}`} />
      </dl>

      <Advice rec={recommend(weather)} />

      <div className="flex justify-end">
        <DeleteCityButton id={id} name={name} />
      </div>
    </li>
  );
}
