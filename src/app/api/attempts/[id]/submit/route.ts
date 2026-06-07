import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { attemptRepo } from "@/server/repositories/attemptRepo";

// POST /api/attempts/[id]/submit — entregar intento y auto-calificar
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: attemptId } = await params;

  const student = await getStudentFromCookie();
  if (!student) return NextResponse.json({ error: "not_identified" }, { status: 401 });

  const supabase = createServiceClient();
  const aRepo = attemptRepo(supabase);

  const attempt = await aRepo.findById(attemptId);
  if (!attempt || attempt.student_id !== student.student_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "attempt_not_in_progress" }, { status: 409 });
  }

  // Cargar preguntas y respuestas
  const [questions, answers] = await Promise.all([
    aRepo.listQuestions(attemptId),
    aRepo.listAnswers(attemptId),
  ]);

  const answerMap = Object.fromEntries(answers.map((a) => [a.question_id, a]));
  let totalScore = 0;

  // Auto-calificar pregunta por pregunta
  const updates: { id: string; is_correct: boolean | null; points_awarded: number }[] = [];

  for (const q of questions) {
    const answer = answerMap[q.id];
    if (!answer) continue;

    let isCorrect: boolean | null = null;
    let pointsAwarded = 0;

    const snap = q.body_snapshot;

    if (q.type === "single_choice") {
      const opts = snap.options as { id: string; is_correct: boolean }[];
      const correct = opts.find((o) => o.is_correct);
      isCorrect = answer.response.selected_id === correct?.id;
      pointsAwarded = isCorrect ? q.points : 0;
    } else if (q.type === "multi_choice") {
      const opts = snap.options as { id: string; is_correct: boolean }[];
      const correctIds = new Set(opts.filter((o) => o.is_correct).map((o) => o.id));
      const selectedIds = new Set((answer.response.selected_ids as string[]) ?? []);
      isCorrect = correctIds.size === selectedIds.size && [...correctIds].every((id) => selectedIds.has(id));
      pointsAwarded = isCorrect ? q.points : 0;
    } else if (q.type === "true_false") {
      isCorrect = answer.response.answer === snap.correct;
      pointsAwarded = isCorrect ? q.points : 0;
    } else if (q.type === "short_answer") {
      const autoGrade = snap.auto_grade !== false;
      if (autoGrade) {
        const accepted = (snap.accepted_answers as string[]) ?? [];
        const caseSensitive = snap.case_sensitive === true;
        const given = (answer.response.text as string) ?? "";
        isCorrect = accepted.some((a) =>
          caseSensitive ? a === given : a.toLowerCase() === given.toLowerCase()
        );
        pointsAwarded = isCorrect ? q.points : 0;
      }
      // else: manual grading, leave null
    }

    totalScore += pointsAwarded;
    updates.push({ id: answer.id, is_correct: isCorrect, points_awarded: pointsAwarded });
  }

  // Actualizar respuestas con calificación
  await Promise.all(
    updates.map(({ id, is_correct, points_awarded }) =>
      supabase.from("answers").update({ is_correct, points_awarded }).eq("id", id)
    )
  );

  // Marcar intento como submitted + score
  const maxScore = attempt.max_score ?? questions.reduce((acc, q) => acc + q.points, 0);
  const updated = await supabase
    .from("attempts")
    .update({
      status: "graded",
      submitted_at: new Date().toISOString(),
      score: totalScore,
      max_score: maxScore,
    })
    .eq("id", attemptId)
    .select()
    .single();

  return NextResponse.json({ ok: true, attempt: updated.data, score: totalScore, max_score: maxScore });
}
