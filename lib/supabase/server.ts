import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

// Supabase client for Server Components, Route Handlers and Server Actions.
// Sends the signed-in user's Clerk session token, so RLS sees their user ID
// in auth.jwt() ->> 'sub'. With no session it sends nothing and the request
// runs as anon, which our policies give no access to.
export async function createServerSupabaseClient() {
  const { getToken } = await auth();

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      accessToken: async () => (await getToken()) ?? null,
    },
  );
}
