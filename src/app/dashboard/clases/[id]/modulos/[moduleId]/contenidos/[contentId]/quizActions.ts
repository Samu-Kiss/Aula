"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { quizRepo } from "@/server/repositories/quizRepo";
import type { Quiz, QuizQuestion } from "@/lib/types/db";

const SESSION_EXPIRED =
  "Tu sesión expiró. Recarga la página e inicia sesión de nuevo.";

class NotAuthenticatedError extends Error {
  constructor() {
    super("No autenticado.");
  }
}

async function authedSupabase() {
  const supabase = await createClient();
  let user = null;
  try {
    ({ data: { user } } = await supabase.auth.getUser());
  } catch {
    // Supabase caído o refresh token revocado — tratar como sin sesión.
  }
  if (!user) throw new NotAuthenticatedError();
  return supabase;
}

function actionError(e: unknown, fallback: string): { ok: false; error: string } {
  return { ok: false, error: e instanceof NotAuthenticatedError ? SESSION_EXPIRED : fallback };
}

export async function ensureQuizAction(contentId: string): Promise<Quiz> {
  const supabase = await authedSupabase();
  const repo = quizRepo(supabase);
  const existing = await repo.findByContentId(contentId);
  if (existing) return existing;
  return repo.create(contentId);
}

export async function saveQuizSettingsAction(
  quizId: string,
  classId: string,
  fields: Partial<Pick<Quiz, "time_limit_min" | "attempts_allowed" | "passing_score" | "show_correct_answers" | "is_available" | "opens_at" | "closes_at" | "attempt_scoring">>
): Promise<{ ok: true; quiz: Quiz } | { ok: false; error: string }> {
  try {
    const supabase = await authedSupabase();
    const quiz = await quizRepo(supabase).updateSettings(quizId, fields);
    revalidatePath(`/dashboard/clases/${classId}`);
    return { ok: true, quiz };
  } catch (e) {
    return actionError(e, "No se pudieron guardar los ajustes.");
  }
}

export async function upsertQuestionAction(
  quizId: string,
  classId: string,
  question: Partial<QuizQuestion> & { type: string; prompt: string; points: number; body: Record<string, unknown> },
  orderIndex: number
): Promise<{ ok: true; question: QuizQuestion } | { ok: false; error: string }> {
  try {
    const supabase = await authedSupabase();
    const q = await quizRepo(supabase).upsertQuestion(quizId, question, orderIndex);
    revalidatePath(`/dashboard/clases/${classId}`);
    return { ok: true, question: q };
  } catch (e) {
    return actionError(e, "No se pudo guardar la pregunta.");
  }
}

export async function deleteQuestionAction(
  questionId: string,
  classId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await authedSupabase();
    await quizRepo(supabase).deleteQuestion(questionId);
    revalidatePath(`/dashboard/clases/${classId}`);
    return { ok: true };
  } catch (e) {
    return actionError(e, "No se pudo eliminar la pregunta.");
  }
}

export async function reorderQuestionsAction(
  updates: { id: string; order_index: number }[]
): Promise<void> {
  const supabase = await authedSupabase();
  await quizRepo(supabase).reorderQuestions(updates);
}
