"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { createModuleSchema } from "@/lib/schemas/module";
import { createContentSchema } from "@/lib/schemas/content";
import { ZodError } from "zod";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export async function createModuleAction(classId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  try {
    const title = formData.get("title") as string;
    const input = createModuleSchema.parse({
      title,
      slug: slugify(title),
      description: formData.get("description") || undefined,
    });
    const existing = await moduleRepo(supabase).listByClass(classId);
    const mod = await moduleRepo(supabase).create(classId, input, existing.length);
    revalidatePath(`/dashboard/clases/${classId}`);
    return { ok: true, id: mod.id };
  } catch (err) {
    if (err instanceof ZodError) return { error: err.issues[0]?.message ?? "Error de validación." };
    return { error: "No se pudo crear el módulo." };
  }
}

export async function createContentAction(moduleId: string, classId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  try {
    const title = formData.get("title") as string;
    const type = formData.get("type") as string;
    const input = createContentSchema.parse({
      title,
      slug: slugify(title),
      type,
    });
    const existing = await contentRepo(supabase).listByModule(moduleId);
    const content = await contentRepo(supabase).create(moduleId, input, existing.length);
    revalidatePath(`/dashboard/clases/${classId}`);
    return { ok: true, id: content.id };
  } catch (err) {
    if (err instanceof ZodError) return { error: err.issues[0]?.message ?? "Error de validación." };
    return { error: "No se pudo crear el contenido." };
  }
}

export async function reorderModulesAction(
  classId: string,
  updates: { id: string; order_index: number }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await moduleRepo(supabase).reorder(updates);
  revalidatePath(`/dashboard/clases/${classId}`);
  return { ok: true };
}

export async function publishContentAction(contentId: string, classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await contentRepo(supabase).publish(contentId);
  revalidatePath(`/dashboard/clases/${classId}`);
  return { ok: true };
}
