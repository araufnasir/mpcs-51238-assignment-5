import { clerk, setupClerkTestingToken } from "@clerk/testing/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Page } from "@playwright/test";

// Two real Clerk test users. A saves a city; B must not see it, neither in
// the app nor by querying Supabase directly with B's own session token.

const CITY_QUERY = "Reykjavik";
const CITY_NAME = /Reykjav[ií]k/;

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name} in .env.local`);
  return value;
}

async function signIn(browser: Browser, user: "A" | "B") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await setupClerkTestingToken({ page });
  await page.goto("/");
  // Sign in with a one-time sign-in token created via the Clerk Backend API.
  // The password strategy stops at "needs_client_trust" (an email code for new
  // devices), and every Playwright context is a new device.
  await clerk.signIn({ page, emailAddress: env(`E2E_USER_${user}_EMAIL`) });
  await page.waitForFunction(() => Boolean(window.Clerk?.session));
  return page;
}

// A Supabase client acting as whoever is signed in on `page` (same token the app uses).
async function supabaseAs(page: Page) {
  const token = await page.evaluate(() => window.Clerk!.session!.getToken());
  const userId = await page.evaluate(() => window.Clerk!.user!.id);
  const supabase = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"), {
    accessToken: async () => token,
  });
  return { supabase, userId };
}

test("user B cannot see user A's saved city", async ({ browser }) => {
  // --- User A saves a city ---
  const pageA = await signIn(browser, "A");
  const a = await supabaseAs(pageA);

  // Start clean in case an earlier run stopped before cleanup.
  await a.supabase.from("saved_cities").delete().ilike("name", "Reykjav%");

  await pageA.goto("/search");
  await pageA.getByPlaceholder(/search for a city/i).fill(CITY_QUERY);
  const result = pageA.getByRole("button", { name: CITY_NAME }).first();
  await result.click();
  await expect(result).toContainText("Saved");

  await pageA.goto("/watchlist");
  await expect(pageA.getByRole("heading", { name: CITY_NAME })).toBeVisible();

  const { data: aRows, error: aError } = await a.supabase
    .from("saved_cities")
    .select("id, user_id, name")
    .ilike("name", "Reykjav%");
  expect(aError).toBeNull();
  expect(aRows).toHaveLength(1);
  const aRow = aRows![0];
  expect(aRow.user_id).toBe(a.userId);

  try {
    // --- User B signs in separately ---
    const pageB = await signIn(browser, "B");
    const b = await supabaseAs(pageB);
    expect(b.userId).not.toBe(a.userId);

    // 1. Not on B's watchlist page. (Soft, so the direct checks below still run and report.)
    await pageB.goto("/watchlist");
    await expect(pageB.getByRole("heading", { name: "Your watchlist" })).toBeVisible();
    await expect.soft(pageB.getByRole("heading", { name: CITY_NAME }), "A's city on B's watchlist").toHaveCount(0);

    // 2. Not readable by B straight from Supabase, by id or at all.
    const byId = await b.supabase.from("saved_cities").select("id").eq("id", aRow.id);
    expect(byId.error).toBeNull();
    expect(byId.data, "B fetched A's row by id").toEqual([]);

    const othersRows = await b.supabase.from("saved_cities").select("id, user_id").neq("user_id", b.userId);
    expect(othersRows.error).toBeNull();
    expect(othersRows.data, "B can read rows belonging to other users").toEqual([]);
  } finally {
    // --- Clean up A's row ---
    await a.supabase.from("saved_cities").delete().eq("id", aRow.id);
  }
});
