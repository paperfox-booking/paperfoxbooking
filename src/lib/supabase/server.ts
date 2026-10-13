import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * A Supabase client for Server Components, Server Actions and Route Handlers,
 * acting as the signed-in person (so row level security applies). Create a
 * new one for each request; never share one between requests.
 */
export async function createSupabaseServerClient() {
  // Read cookies first: it marks the render as request-time, so prerendering
  // stops here rather than needing the settings at build time.
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't set cookies. That's fine: the proxy
            // refreshes the session cookie on every request.
          }
        },
      },
    },
  );
}
