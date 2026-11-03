"use client";

import { useSyncExternalStore } from "react";
import { formatTemp, formatWind, type Unit } from "@/lib/units";

// The °C/°F choice lives only in this browser (localStorage). The server
// always renders °F (the default) and never sees the preference, so cached
// forecasts stay keyed on coordinates alone.

const KEY = "temperature-unit";
const EVENT = "temperature-unit-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange); // other tabs
  window.addEventListener(EVENT, onChange); // this tab
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function readUnit(): Unit {
  return localStorage.getItem(KEY) === "C" ? "C" : "F";
}

export function useUnit(): Unit {
  return useSyncExternalStore(subscribe, readUnit, () => "F");
}

function setUnit(unit: Unit) {
  localStorage.setItem(KEY, unit);
  window.dispatchEvent(new Event(EVENT));
}

export function UnitToggle() {
  const unit = useUnit();
  return (
    <div role="group" aria-label="Temperature unit" className="inline-flex rounded-lg border border-zinc-300 p-0.5 dark:border-zinc-700">
      {(["F", "C"] as const).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={unit === u}
          onClick={() => setUnit(u)}
          className={`min-w-11 rounded-md px-2.5 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-sky-600 ${
            unit === u ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          °{u}
        </button>
      ))}
    </div>
  );
}

export function Temp({ c }: { c: number }) {
  return <>{formatTemp(c, useUnit())}</>;
}

export function Wind({ kmh }: { kmh: number }) {
  return <>{formatWind(kmh, useUnit())}</>;
}
