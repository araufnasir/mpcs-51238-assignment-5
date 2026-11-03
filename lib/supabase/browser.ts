import { createClient } from "@supabase/supabase-js";

// Supabase client for Client Components. getToken is Clerk's session.getToken,
// so PostgREST and Realtime both see the signed-in user and RLS applies.
// supabase-js calls it again when Realtime refreshes its token.
export function createBrowserSupabaseClient(getToken: () => Promise<string | null>) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    accessToken: getToken,
  });
}
