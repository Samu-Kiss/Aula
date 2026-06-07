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

export async function publishModuleAction(moduleId: string, classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await supabase.from("modules").update({ is_published: true, is_available: true }).eq("id", moduleId);
  revalidatePath(`/dashboard/clases/${classId}`);
  return { ok: true };
}

export async function unpublishModuleAction(moduleId: string, classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await supabase.from("modules").update({ is_published: false }).eq("id", moduleId);
  revalidatePath(`/dashboard/clases/${classId}`);
  return { ok: true };
}

export async function publishClassAction(classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await supabase.from("classes").update({ is_published: true }).eq("id", classId);
  revalidatePath(`/dashboard/clases/${classId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function unpublishClassAction(classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await supabase.from("classes").update({ is_published: false }).eq("id", classId);
  revalidatePath(`/dashboard/clases/${classId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateClassMetaAction(
  classId: string,
  fields: { title?: string; slug?: string; description?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Validaciones básicas
  if (fields.title !== undefined && fields.title.trim().length < 3) {
    return { ok: false, error: "El título debe tener al menos 3 caracteres." };
  }
  if (fields.slug !== undefined) {
    if (!/^[a-z0-9-]+$/.test(fields.slug)) {
      return { ok: false, error: "El slug solo puede tener letras minúsculas, números y guiones." };
    }
    if (fields.slug.length < 3) {
      return { ok: false, error: "El slug debe tener al menos 3 caracteres." };
    }
    // Verificar unicidad
    const { data: existing } = await supabase
      .from("classes")
      .select("id")
      .eq("slug", fields.slug)
      .neq("id", classId)
      .is("deleted_at", null)
      .maybeSingle();
    if (existing) return { ok: false, error: "Ese slug ya está en uso. Elige otro." };
  }

  const { error } = await supabase
    .from("classes")
    .update({
      ...(fields.title !== undefined && { title: fields.title.trim() }),
      ...(fields.slug !== undefined && { slug: fields.slug.trim() }),
      ...(fields.description !== undefined && { description: fields.description.trim() || null }),
    })
    .eq("id", classId);

  if (error) return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };

  revalidatePath(`/dashboard/clases/${classId}`);
  revalidatePath(`/dashboard/clases/${classId}/configuracion`);
  revalidatePath("/dashboard");
  return { ok: true };
}
