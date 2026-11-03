import { clerkSetup } from "@clerk/testing/playwright";

// Fetches a Clerk testing token (dev instance only) so sign-in isn't blocked as a bot.
export default async function globalSetup() {
  await clerkSetup();
}
