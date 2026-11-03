import type { ReactNode } from "react";

// Shared card for empty, nothing-found and error states.
export function StateMessage({
  icon,
  title,
  children,
  action,
  tone = "neutral",
}: {
  icon: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
}) {
  const colors =
    tone === "error"
      ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
      : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900";

  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border p-6 text-center ${colors}`}>
      <div className="text-3xl" aria-hidden>{icon}</div>
      <h2 className="mt-2 font-semibold">{title}</h2>
      {children && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
