"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { gradeRepo } from "@/server/repositories/gradeRepo";

// Calificar manualmente una respuesta de tipo short_answer
export async function gradeAnswerAction(
  answerId: string,
  pointsAwarded: number,
  feedback: string | null,
  classId: string,
  attemptId: string
): Promise<{ ok: boolean; error?: string }> {
  // Verificar que el profe está autenticado
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // Usar service client para escribir datos de estudiantes (RLS no permite al profe)
  const svc = createServiceClient();

  // Actualizar la respuesta
  const { error: answerError } = await svc
    .from("answers")
    .update({ points_awarded: pointsAwarded, feedback, is_correct: pointsAwarded > 0 })
    .eq("id", answerId);
  if (answerError) return { ok: false, error: answerError.message };

  // Recalcular score del intento sumando todos los points_awarded
  const { data: allAnswers } = await svc
    .from("answers")
    .select("points_awarded")
    .eq("attempt_id", attemptId);

  const newScore = (allAnswers ?? []).reduce(
    (acc, a) => acc + (a.points_awarded ?? 0),
    0
  );

  const updatedAttempt = await svc
    .from("attempts")
    .update({ score: newScore, status: "graded" })
    .eq("id", attemptId)
    .select("quiz_id, student_id, max_score")
    .single();

  // Auto-populate grade_items linked to this quiz (F3-04)
  if (updatedAttempt.data) {
    try {
      const { quiz_id, student_id, max_score } = updatedAttempt.data;
      if (quiz_id) {
        const quizRow = await svc
          .from("quizzes")
          .select("content_id")
          .eq("id", quiz_id)
          .maybeSingle();
        if (quizRow.data?.content_id) {
          const contentRow = await svc
            .from("contents")
            .select("module_id")
            .eq("id", quizRow.data.content_id)
            .maybeSingle();
          const moduleRow = contentRow.data?.module_id
            ? await svc.from("modules").select("class_id").eq("id", contentRow.data.module_id).maybeSingle()
            : null;
          if (moduleRow?.data?.class_id) {
            const repo = gradeRepo(svc);
            const gradeItem = await repo.findItemByQuiz(quiz_id, moduleRow.data.class_id);
            if (gradeItem) {
              const normalizedScore =
                gradeItem.max_score > 0 && (max_score ?? 0) > 0
                  ? (newScore / (max_score ?? newScore)) * gradeItem.max_score
                  : newScore;
              await repo.upsertGrade(gradeItem.id, student_id, normalizedScore);
            }
          }
        }
      }
    } catch {
      // Best-effort
    }
  }

  revalidatePath(`/dashboard/clases/${classId}/intentos`);
  revalidatePath(`/dashboard/clases/${classId}/intentos/${attemptId}`);
  revalidatePath(`/dashboard/clases/${classId}/gradebook`);
  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  return { ok: true };
}
