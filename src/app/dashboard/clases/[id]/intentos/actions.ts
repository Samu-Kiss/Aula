"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Calificar manualmente una respuesta de tipo short_answer
export async function gradeAnswerAction(
  answerId: string,
  pointsAwarded: number,
  feedback: string | null,
  classId: string
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  // Verificar que el profe es dueño de la clase
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "not_authenticated" };

  // Actualizar la respuesta
  const { error: answerError } = await supabase
    .from("answers")
    .update({ points_awarded: pointsAwarded, feedback, is_correct: pointsAwarded > 0 })
    .eq("id", answerId);
  if (answerError) return { ok: false, error: answerError.message };

  // Recalcular score del intento
  const { data: answer } = await supabase
    .from("answers")
    .select("attempt_id")
    .eq("id", answerId)
    .single();

  if (answer) {
    const { data: allAnswers } = await supabase
      .from("answers")
      .select("points_awarded")
      .eq("attempt_id", answer.attempt_id);

    const newScore = (allAnswers ?? []).reduce(
      (acc, a) => acc + (a.points_awarded ?? 0),
      0
    );

    await supabase
      .from("attempts")
      .update({ score: newScore, status: "graded" })
      .eq("id", answer.attempt_id);
  }

  revalidatePath(`/dashboard/clases/${classId}/intentos`);
  return { ok: true };
}
