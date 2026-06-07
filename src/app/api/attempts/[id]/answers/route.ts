import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { attemptRepo } from "@/server/repositories/attemptRepo";

// POST /api/attempts/[id]/answers — batch autosave de respuestas
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attemptId } = await params;

  const student = await getStudentFromCookie();
  if (!student) return NextResponse.json({ error: "not_identified" }, { status: 401 });

  const body = await request.json();
  const answers = body.answers as { question_id: string; response: Record<string, unknown>; client_updated_at: string }[];
  if (!Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();
  const aRepo = attemptRepo(supabase);

  // Verificar que el intento pertenece al estudiante y está en progreso
  const attempt = await aRepo.findById(attemptId);
  if (!attempt || attempt.student_id !== student.student_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "attempt_not_in_progress" }, { status: 409 });
  }

  await aRepo.batchUpsertAnswers(
    answers.map((a) => ({ ...a, attempt_id: attemptId }))
  );

  return NextResponse.json({ ok: true });
}
