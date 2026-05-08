import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup"];
const PUBLIC_API_PREFIX = "/api/bajaj/auth/";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public auth API routes
  if (pathname.startsWith(PUBLIC_API_PREFIX)) {
    return NextResponse.next({ request });
  }

  // Build a mutable response so Supabase can refresh the session cookie
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPage = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  // Protected API routes → 401 JSON
  const isProtectedApi =
    pathname.startsWith("/api/bajaj/") &&
    !pathname.startsWith(PUBLIC_API_PREFIX);

  if (isProtectedApi && !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Authenticated user visiting login/signup → redirect to app
  if (user && isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/bajaj/boards/vipar";
    return NextResponse.redirect(url);
  }

  // Unauthenticated user visiting protected page → redirect to login
  const isProtectedPage =
    !isPublicPage &&
    !pathname.startsWith("/api/") &&
    pathname !== "/";

  if (!user && isProtectedPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
