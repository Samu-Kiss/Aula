import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Wraps the native fetch with a hard timeout so that a down Supabase
 * instance fails quickly instead of hanging for 8–10 s.
 */
function fetchWithTimeout(ms: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(id)
    );
  };
}

const TIMEOUT_MS = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS ?? 5000);

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchWithTimeout(TIMEOUT_MS) },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — las cookies las setea el middleware
          }
        },
      },
    }
  );
}

// Cliente con service role — bypasea RLS. Solo usar en Route Handlers de servidor,
// nunca exponer al cliente.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: fetchWithTimeout(TIMEOUT_MS) } }
  );
}
