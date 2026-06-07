import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { checkRateLimit } from "@/lib/rateLimit";

const ALLOWED_TYPES = new Set([
  "tab_blur",
  "tab_focus",
  "paste",
  "copy",
  "duplicate_instance_attempt",
  "time_expired",
  "reconnect",
  "submit_blocked",
]);

// POST /api/attempts/[id]/events — record an anti-cheating event
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attemptId } = await params;

  const student = await getStudentFromCookie();
  if (!student) return NextResponse.json({ error: "not_identified" }, { status: 401 });

  const supabase = createServiceClient();

  // Rate-limit: max 60 events per minute per student
  const rl = await checkRateLimit(supabase, student.student_id, "attempt_events", 60, 60);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  // Verify the attempt belongs to this student and is in progress
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, student_id, status")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt || attempt.student_id !== student.student_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (attempt.status !== "in_progress") {
    // Still record events for abandoned attempts (e.g. time_expired after submit)
    // but reject clearly invalid attempt states
    if (attempt.status === "submitted" || attempt.status === "graded") {
      return NextResponse.json({ error: "attempt_already_submitted" }, { status: 409 });
    }
  }

  const body = await request.json().catch(() => ({}));
  const type = body.type as string;
  const payload = body.payload ?? null;

  if (!type || !ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: "invalid_event_type" }, { status: 400 });
  }

  const { error } = await supabase.from("attempt_events").insert({
    attempt_id: attemptId,
    type,
    payload,
    occurred_at: body.occurred_at ?? new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
