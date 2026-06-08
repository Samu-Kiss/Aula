import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const timeoutMs = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS ?? 5000);
  const fetchWithTimeout: typeof fetch = (input, init) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(id)
    );
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout },
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

  // If Supabase is unreachable, treat as unauthenticated rather than crashing.
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Backend down — fail safe: unauthenticated state.
  }

  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard");
  const isLogin = request.nextUrl.pathname === "/login";

  if (isDashboard && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isLogin && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
