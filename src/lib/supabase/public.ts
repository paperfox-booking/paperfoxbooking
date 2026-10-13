import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * A Supabase client for public information, acting as a visitor who isn't
 * signed in. It never reads cookies, so what it loads can be cached and
 * shared by everyone. Row level security only lets it see published events.
 */
export function createSupabasePublicClient() {
  const env = publicEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
}
