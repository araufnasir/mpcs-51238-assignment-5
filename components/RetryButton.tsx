"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { secondaryButton } from "./buttons";

// Re-renders the current page on the server, re-running its data fetches.
export function RetryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button onClick={() => startTransition(() => router.refresh())} disabled={pending} className={secondaryButton}>
      {pending ? "Retrying…" : "Try again"}
    </button>
  );
}
