"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

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

  await svc
    .from("attempts")
    .update({ score: newScore, status: "graded" })
    .eq("id", attemptId);

  // Invalidar todas las páginas relevantes
  revalidatePath(`/dashboard/clases/${classId}/intentos`);
  revalidatePath(`/dashboard/clases/${classId}/intentos/${attemptId}`);
  revalidatePath(`/dashboard/clases/${classId}/gradebook`);
  return { ok: true };
}
