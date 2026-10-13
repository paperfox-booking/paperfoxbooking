import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { signInPath } from "@/lib/auth/redirects";

/**
 * Runs before every page request to keep the Supabase session cookie fresh.
 * It doesn't decide who can see what: each page and action checks that itself
 * on the server, and the database enforces it with row level security.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Stops a CDN caching one person's session cookie for someone else.
        for (const [header, value] of Object.entries(headers)) {
          response.headers.set(header, value);
        }
      },
    },
  });

  // Refreshes the session if it has expired. Must run before anything else.
  const { data } = await supabase.auth.getClaims();

  // A quick early redirect for people who clearly aren't signed in. This is
  // only for speed: the pages themselves still check properly.
  const path = request.nextUrl.pathname;
  const isPrivate = PRIVATE_AREAS.some(
    (area) => path === area || path.startsWith(`${area}/`),
  );
  if (isPrivate && !data?.claims.sub) {
    return NextResponse.redirect(
      new URL(signInPath(path + request.nextUrl.search), request.url),
    );
  }

  return response;
}

const PRIVATE_AREAS = ["/account", "/admin"];

export const config = {
  matcher: [
    // Everything except static files, images and the web app manifest.
    "/((?!_next/static|_next/image|brand/|icons/|icon.png|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml).*)",
  ],
};
