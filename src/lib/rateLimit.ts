/**
 * Simple rate limiting using the `rate_limits` table.
 * Sliding-window approach: counts rows in a rolling time window.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec?: number;
}

/**
 * Check and record a rate-limited request.
 *
 * @param supabase  Service-role client (bypasses RLS)
 * @param key       Identity key (e.g. student ID or IP)
 * @param endpoint  Name of the endpoint being rate-limited (e.g. "start_attempt")
 * @param limit     Max requests allowed within windowSec
 * @param windowSec Window size in seconds
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  key: string,
  endpoint: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStartMs = now - windowSec * 1000;
  const windowStartIso = new Date(windowStartMs).toISOString();

  // Count existing requests in the window
  const { count } = await supabase
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("key", key)
    .eq("endpoint", endpoint)
    .gte("window_start", windowStartIso);

  const current = count ?? 0;

  if (current >= limit) {
    return { allowed: false, retryAfterSec: windowSec };
  }

  // Record this request
  await supabase.from("rate_limits").insert({
    key,
    endpoint,
    window_start: new Date(now).toISOString(),
    count: 1,
  });

  return { allowed: true };
}

/**
 * Purge old rate_limit rows to keep the table small.
 * Call periodically (e.g. on each request, probabilistically).
 */
export async function pruneRateLimits(
  supabase: SupabaseClient,
  olderThanSec: number = 3600
): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanSec * 1000).toISOString();
  await supabase.from("rate_limits").delete().lt("window_start", cutoff);
}
