"use client";

import { useState, useTransition } from "react";
import { deleteCity } from "@/app/actions";

export function DeleteCityButton({ id, name }: { id: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  function handleClick() {
    setFailed(false);
    startTransition(async () => {
      try {
        await deleteCity(id);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      aria-label={`Remove ${name}`}
      className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-60 dark:hover:bg-zinc-800"
    >
      {pending ? "Removing…" : failed ? "Failed, retry" : "Remove"}
    </button>
  );
}
