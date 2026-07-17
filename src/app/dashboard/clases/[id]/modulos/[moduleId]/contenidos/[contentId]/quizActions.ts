"use server";

import { revalidatePath } from "next/cache";
import * as Sentry from "@sentry/nextjs";
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
  if (e instanceof NotAuthenticatedError) {
    return { ok: false, error: SESSION_EXPIRED };
  }
  // El error real (RLS, constraint, red) solo vive aquí — sin esto, en
  // producción el fallo queda invisible detrás del mensaje genérico.
  console.error("[quizActions]", e);
  Sentry.captureException(e);

  const { code, message } = (e ?? {}) as { code?: string; message?: string };
  // 23514 = violación de check constraint (p. ej. prompt de 5–1000 caracteres,
  // puntos 0.25–100). La UI valida antes, pero si algo se cuela, decirlo claro.
  if (code === "23514") {
    return {
      ok: false,
      error:
        "La pregunta no cumple las validaciones: enunciado de 5 a 1000 caracteres y puntos entre 0.25 y 100.",
    };
  }
  // Solo profesores ven estos mensajes — incluir el detalle técnico acorta el
  // diagnóstico sin necesidad de logs.
  const detail = [code, message].filter(Boolean).join(": ").slice(0, 180);
  return { ok: false, error: detail ? `${fallback} (${detail})` : fallback };
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
