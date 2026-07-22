"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { gradeRepo } from "@/server/repositories/gradeRepo";
import { sendGradeReady } from "@/lib/email/sendGradeReady";

// Calificar manualmente una respuesta de tipo short_answer
export async function gradeAnswerAction(
  answerId: string,
  pointsAwarded: number,
  feedback: string | null,
  classId: string,
  attemptId: string
): Promise<{ ok: boolean; error?: string }> {
  // Verificar que el profe está autenticado y es dueño de la clase
  const authSupabase = await createClient();
  const { data: { user } } = await authSupabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  const { data: cls } = await authSupabase
    .from("classes")
    .select("id")
    .eq("id", classId)
    .eq("professor_id", user.id)
    .maybeSingle();
  if (!cls) return { ok: false, error: "forbidden" };

  // Usar service client para escribir datos de estudiantes (RLS no permite al profe)
  const svc = createServiceClient();

  // El intento debe pertenecer a un quiz de esta clase, y la respuesta al intento.
  // Sin estas comprobaciones, cualquier profesor autenticado podría calificar
  // respuestas de cualquier alumno en cualquier clase (el service client ignora RLS).
  const { data: attemptRow } = await svc
    .from("attempts")
    .select("id, quiz_id")
    .eq("id", attemptId)
    .maybeSingle();
  if (!attemptRow?.quiz_id) return { ok: false, error: "not_found" };

  const { data: quizRow } = await svc
    .from("quizzes")
    .select("content_id")
    .eq("id", attemptRow.quiz_id)
    .maybeSingle();
  const { data: contentRow } = quizRow?.content_id
    ? await svc.from("contents").select("module_id").eq("id", quizRow.content_id).maybeSingle()
    : { data: null };
  const { data: moduleRow } = contentRow?.module_id
    ? await svc.from("modules").select("class_id").eq("id", contentRow.module_id).maybeSingle()
    : { data: null };

  if (moduleRow?.class_id !== classId) {
    return { ok: false, error: "not_found" };
  }

  const { data: answerRow } = await svc
    .from("answers")
    .select("id")
    .eq("id", answerId)
    .eq("attempt_id", attemptId)
    .maybeSingle();
  if (!answerRow) return { ok: false, error: "not_found" };

  // Actualizar la respuesta
  const { error: answerError } = await svc
    .from("answers")
    .update({ points_awarded: pointsAwarded, feedback, is_correct: pointsAwarded > 0 })
    .eq("id", answerId)
    .eq("attempt_id", attemptId);
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

  // Auto-populate grade_items + send "nota lista" email (best-effort)
  if (updatedAttempt.data) {
    try {
      const { quiz_id, student_id, max_score } = updatedAttempt.data;
      if (quiz_id) {
        const [quizRow, studentRow] = await Promise.all([
          svc.from("quizzes").select("content_id").eq("id", quiz_id).maybeSingle(),
          svc.from("students").select("email, first_name").eq("id", student_id).maybeSingle(),
        ]);
        if (quizRow.data?.content_id) {
          const contentRow = await svc
            .from("contents")
            .select("title, module_id")
            .eq("id", quizRow.data.content_id)
            .maybeSingle();
          const moduleRow = contentRow.data?.module_id
            ? await svc.from("modules").select("class_id").eq("id", contentRow.data.module_id).maybeSingle()
            : null;
          if (moduleRow?.data?.class_id) {
            const [classRow, repo] = [
              await svc.from("classes").select("name").eq("id", moduleRow.data.class_id).maybeSingle(),
              gradeRepo(svc),
            ];

            // Grade population (F3-04)
            const gradeItem = await repo.findItemByQuiz(quiz_id, moduleRow.data.class_id);
            if (gradeItem) {
              const normalizedScore =
                gradeItem.max_score > 0 && (max_score ?? 0) > 0
                  ? (newScore / (max_score ?? newScore)) * gradeItem.max_score
                  : newScore;
              await repo.upsertGrade(gradeItem.id, student_id, normalizedScore);

              // Email: nota lista
              if (studentRow.data?.email) {
                void sendGradeReady(
                  studentRow.data.email,
                  studentRow.data.first_name ?? "Estudiante",
                  contentRow.data?.title ?? gradeItem.id,
                  classRow.data?.name ?? "Clase",
                  newScore,
                  max_score ?? newScore
                );
              }
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
