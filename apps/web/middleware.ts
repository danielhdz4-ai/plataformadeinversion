import { clientRateLimitKey, rateLimit } from "@/lib/api/rate-limit";
import { isOpenAccess } from "@/lib/open-access";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function apiRateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Demasiadas peticiones", retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/api/map/") || path.startsWith("/api/scans")) {
    const key = clientRateLimitKey(request);
    const limit = path.includes("/run") ? 30 : 100;
    const rl = rateLimit(`mw:${path.split("/").slice(0, 4).join("/")}:${key}`, {
      limit,
      windowMs: 60_000,
    });
    if (!rl.ok) return apiRateLimitResponse(rl.retryAfterSec);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnon) {
    if (request.nextUrl.pathname.startsWith("/app") && !isOpenAccess()) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  let user: { id: string } | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    if (!isOpenAccess() && request.nextUrl.pathname.startsWith("/app")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  if (request.nextUrl.pathname.startsWith("/app") && !user && !isOpenAccess()) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/app/:path*", "/api/map/:path*", "/api/scans", "/api/scans/:path*"],
};
