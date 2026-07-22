import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

// GET /api/student/lookup?email=... — devuelve nombre/apellido si el estudiante existe
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({}, { status: 400 });
  }

  const svc = createServiceClient();

  // Endpoint sin autenticar que confirma si un correo existe y revela el nombre.
  // Rate limit por IP para frenar la enumeración masiva de correos/PII.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rl = await checkRateLimit(svc, ip, "student_lookup", 20, 60);
  if (!rl.allowed) {
    return NextResponse.json({}, { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } });
  }
  const { data } = await svc
    .from("students")
    .select("first_name, last_name")
    .eq("email", email)
    .maybeSingle();

  if (!data) return NextResponse.json({});

  return NextResponse.json({
    first_name: data.first_name ?? null,
    last_name: data.last_name ?? null,
  });
}
