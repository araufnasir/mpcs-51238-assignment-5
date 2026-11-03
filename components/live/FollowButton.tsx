"use client";

import { useState, useTransition } from "react";
import { followStation, unfollowStation } from "@/app/live/actions";
import { primaryButton, secondaryButton } from "@/components/buttons";

export function FollowButton({ stationId, name, following }: { stationId: string; name: string; following: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = following ? await unfollowStation(stationId) : await followStation(stationId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={pending}
        aria-label={`${following ? "Unfollow" : "Follow"} ${name}`}
        className={`${following ? secondaryButton : primaryButton} px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600`}
      >
        {pending ? (following ? "Unfollowing…" : "Following…") : following ? "Unfollow" : "Follow"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
