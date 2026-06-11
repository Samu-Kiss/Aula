import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// GET /api/student/lookup?email=... — devuelve nombre/apellido si el estudiante existe
export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({}, { status: 400 });
  }

  const svc = createServiceClient();
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
