import { Show, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { NavLink } from "./NavLink";
import { primaryButton } from "./buttons";

export function Header() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-4 px-4">
        <Link href="/" className="font-semibold">
          <span aria-hidden>🌤️</span> Weather Watchlist
        </Link>

        {/* Auth state is per request, so it streams in behind this boundary. */}
        <Suspense fallback={<div className="h-8 w-8" />}>
          <Show when="signed-in">
            <nav className="flex items-center gap-1">
              <NavLink href="/watchlist">Watchlist</NavLink>
              <NavLink href="/search">Search</NavLink>
              <div className="ml-2 flex">
                <UserButton />
              </div>
            </nav>
          </Show>
          <Show when="signed-out">
            <nav className="flex items-center gap-2">
              <Link href="/sign-in" className="px-3 py-1.5 text-sm font-medium">Sign in</Link>
              <Link href="/sign-up" className={primaryButton}>Sign up</Link>
            </nav>
          </Show>
        </Suspense>
      </div>
    </header>
  );
}
