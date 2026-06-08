"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { createModuleSchema } from "@/lib/schemas/module";
import { createContentSchema } from "@/lib/schemas/content";
import { ZodError } from "zod";
import { deleteObjects, extractR2ImageKeys } from "@/lib/r2";

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

export async function reorderContentsAction(
  moduleId: string,
  classId: string,
  updates: { id: string; order_index: number }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await contentRepo(supabase).reorder(updates);
  revalidatePath(`/dashboard/clases/${classId}`);
  return { ok: true };
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

export async function deleteContentAction(contentId: string, classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };

  // Fetch content before deleting to collect R2 references
  const { data: content } = await supabase
    .from("contents")
    .select("type, body_draft, body_published")
    .eq("id", contentId)
    .single();

  await contentRepo(supabase).softDelete(contentId);

  // Clean up R2 objects — best-effort, never blocks the delete
  if (content) {
    try {
      const toDelete: { key: string; bucket: "public" | "private" }[] = [];

      if (content.type === "file") {
        const draftKey = (content.body_draft as Record<string, unknown> | null)?.file_key as string | undefined;
        const pubKey = (content.body_published as Record<string, unknown> | null)?.file_key as string | undefined;
        if (draftKey) toDelete.push({ key: draftKey, bucket: "private" });
        if (pubKey && pubKey !== draftKey) toDelete.push({ key: pubKey, bucket: "private" });
      } else if (content.type === "rich_text") {
        const r2Url = process.env.R2_PUBLIC_URL ?? "";
        const draftKeys = extractR2ImageKeys(content.body_draft, r2Url);
        const pubKeys = extractR2ImageKeys(content.body_published, r2Url);
        for (const key of new Set([...draftKeys, ...pubKeys])) {
          toDelete.push({ key, bucket: "public" });
        }
      }

      if (toDelete.length > 0) await deleteObjects(toDelete);
    } catch (err) {
      console.error("R2 cleanup error on content delete:", err);
    }
  }

  revalidatePath(`/dashboard/clases/${classId}`);
  const { data: cls } = await supabase.from("classes").select("slug").eq("id", classId).maybeSingle();
  if (cls?.slug) revalidatePath(`/c/${cls.slug}`);
  return { ok: true };
}

export async function publishContentAction(contentId: string, classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await contentRepo(supabase).publish(contentId);
  // F4-09: revalidate public routes
  const { data: cls } = await supabase.from("classes").select("slug").eq("id", classId).maybeSingle();
  if (cls?.slug) revalidatePath(`/c/${cls.slug}`);
  revalidatePath(`/dashboard/clases/${classId}`);
  return { ok: true };
}

export async function publishModuleAction(moduleId: string, classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await supabase.from("modules").update({ is_published: true, is_available: true }).eq("id", moduleId);
  // F4-09: revalidate public route too
  const { data: cls } = await supabase.from("classes").select("slug").eq("id", classId).maybeSingle();
  if (cls?.slug) revalidatePath(`/c/${cls.slug}`);
  revalidatePath(`/dashboard/clases/${classId}`);
  return { ok: true };
}

export async function unpublishModuleAction(moduleId: string, classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado." };
  await supabase.from("modules").update({ is_published: false }).eq("id", moduleId);
  // F4-09: revalidate public route too
  const { data: cls } = await supabase.from("classes").select("slug").eq("id", classId).maybeSingle();
  if (cls?.slug) revalidatePath(`/c/${cls.slug}`);
  revalidatePath(`/dashboard/clases/${classId}`);
  return { ok: true };
}

// F4-01: save module availability window
export async function saveModuleAvailabilityAction(
  moduleId: string,
  classId: string,
  fields: { is_available: boolean; opens_at: string | null; closes_at: string | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "No autenticado." };

    // Verify professor owns this module's class
    const { data: cls } = await supabase
      .from("classes")
      .select("id, slug")
      .eq("id", classId)
      .eq("professor_id", user.id)
      .maybeSingle();
    if (!cls) return { ok: false, error: "No autorizado." };

    await supabase
      .from("modules")
      .update({
        is_available: fields.is_available,
        opens_at: fields.opens_at,
        closes_at: fields.closes_at,
      })
      .eq("id", moduleId);

    revalidatePath(`/dashboard/clases/${classId}`);
    if (cls.slug) revalidatePath(`/c/${cls.slug}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "No se pudieron guardar los ajustes." };
  }
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
