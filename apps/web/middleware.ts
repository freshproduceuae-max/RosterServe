import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

const PUBLIC_AUTH_PATHS = ["/sign-in", "/sign-up", "/auth/callback"];

export async function middleware(request: NextRequest) {
  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    const env = getPublicEnv();
    supabaseUrl = env.supabaseUrl;
    supabaseAnonKey = env.supabaseAnonKey;
  } catch {
    return new Response(
      "Server misconfiguration: missing required environment variables.",
      { status: 500 }
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]
      ) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Refresh the session token on every request
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicAuthPath = PUBLIC_AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Unauthenticated user trying to access protected route
  if (!user && !isPublicAuthPath && pathname !== "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  // Authenticated user trying to access auth pages.
  // Skip the redirect for RSC prefetch requests (Next-Router-State-Tree header or ?_rsc= param)
  // so that Next.js 15's server-action redirect flow can complete cleanly.
  const isRscRequest =
    request.headers.has("Next-Router-State-Tree") ||
    request.nextUrl.searchParams.has("_rsc");
  if (user && isPublicAuthPath && !isRscRequest) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
