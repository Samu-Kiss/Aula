"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { gradeRepo } from "@/server/repositories/gradeRepo";

async function getAuthSvc(classId: string) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;
  const { data: cls } = await auth.from("classes").select("id").eq("id", classId).eq("professor_id", user.id).maybeSingle();
  if (!cls) return null;
  return createServiceClient();
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function createCategoryAction(
  classId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const name = (formData.get("name") as string)?.trim();
  const weight = parseFloat(formData.get("weight") as string);

  if (!name || name.length < 1 || name.length > 50) return { ok: false, error: "invalid_name" };
  if (isNaN(weight) || weight < 0 || weight > 100) return { ok: false, error: "invalid_weight" };

  const repo = gradeRepo(svc);

  // Check total weight won't exceed 100
  const existing = await repo.listCategories(classId);
  const total = existing.reduce((acc, c) => acc + Number(c.weight), 0);
  if (total + weight > 100.01) {
    return { ok: false, error: `El peso total excedería 100% (actual: ${total.toFixed(1)}%)` };
  }

  const { error } = await repo.createCategory(classId, name, weight);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  revalidatePath(`/dashboard/clases/${classId}/calificaciones/categorias`);
  return { ok: true };
}

export async function updateCategoryAction(
  classId: string,
  categoryId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const name = (formData.get("name") as string)?.trim();
  const weight = parseFloat(formData.get("weight") as string);

  if (!name || name.length > 50) return { ok: false, error: "invalid_name" };
  if (isNaN(weight) || weight < 0 || weight > 100) return { ok: false, error: "invalid_weight" };

  const repo = gradeRepo(svc);
  const existing = await repo.listCategories(classId);
  const others = existing.filter((c) => c.id !== categoryId);
  const total = others.reduce((acc, c) => acc + Number(c.weight), 0);
  if (total + weight > 100.01) {
    return { ok: false, error: `El peso total excedería 100% (resto: ${total.toFixed(1)}%)` };
  }

  const { error } = await repo.updateCategory(categoryId, name, weight);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  revalidatePath(`/dashboard/clases/${classId}/calificaciones/categorias`);
  return { ok: true };
}

export async function deleteCategoryAction(
  classId: string,
  categoryId: string
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const repo = gradeRepo(svc);
  const { error } = await repo.deleteCategory(categoryId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  revalidatePath(`/dashboard/clases/${classId}/calificaciones/categorias`);
  return { ok: true };
}

// ── Grade Items ───────────────────────────────────────────────────────────────

export async function createItemAction(
  classId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const categoryId = formData.get("category_id") as string;
  const title = (formData.get("title") as string)?.trim();
  const maxScore = parseFloat(formData.get("max_score") as string);
  const quizId = (formData.get("quiz_id") as string) || null;
  const dueAt = (formData.get("due_at") as string) || null;
  const missingPolicy = (formData.get("missing_policy") as string) || "ignore_until_due";

  if (!categoryId) return { ok: false, error: "missing_category" };
  if (!title || title.length < 1 || title.length > 80) return { ok: false, error: "invalid_title" };
  if (isNaN(maxScore) || maxScore <= 0) return { ok: false, error: "invalid_max_score" };

  const repo = gradeRepo(svc);
  const { error } = await repo.createItem(classId, categoryId, title, maxScore, quizId, dueAt, missingPolicy);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  revalidatePath(`/dashboard/clases/${classId}/calificaciones/categorias`);
  return { ok: true };
}

export async function updateItemAction(
  classId: string,
  itemId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const title = (formData.get("title") as string)?.trim();
  const maxScore = parseFloat(formData.get("max_score") as string);
  const quizId = (formData.get("quiz_id") as string) || null;
  const dueAt = (formData.get("due_at") as string) || null;
  const missingPolicy = (formData.get("missing_policy") as string) || "ignore_until_due";

  if (!title || title.length < 1 || title.length > 80) return { ok: false, error: "invalid_title" };
  if (isNaN(maxScore) || maxScore <= 0) return { ok: false, error: "invalid_max_score" };

  const repo = gradeRepo(svc);
  const { error } = await repo.updateItem(itemId, { title, maxScore, quizId, dueAt, missingPolicy });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  revalidatePath(`/dashboard/clases/${classId}/calificaciones/categorias`);
  return { ok: true };
}

export async function deleteItemAction(
  classId: string,
  itemId: string
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const repo = gradeRepo(svc);
  const { error } = await repo.deleteItem(itemId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  revalidatePath(`/dashboard/clases/${classId}/calificaciones/categorias`);
  return { ok: true };
}

// ── Inline grade editing (F3-06) ──────────────────────────────────────────────

export async function upsertGradeAction(
  classId: string,
  gradeItemId: string,
  studentId: string,
  score: number | null,
  notes: string | null
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  if (score !== null && (isNaN(score) || score < 0)) return { ok: false, error: "invalid_score" };

  const repo = gradeRepo(svc);
  const { error } = await repo.upsertGradeWithNotes(gradeItemId, studentId, score, notes);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  return { ok: true };
}
