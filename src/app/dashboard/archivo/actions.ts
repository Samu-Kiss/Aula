"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { classRepo } from "@/server/repositories/classRepo";
import { moduleRepo } from "@/server/repositories/moduleRepo";

export async function restoreClassAction(
  classId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: cls } = await supabase
    .from("classes")
    .select("professor_id")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || cls.professor_id !== user.id) return { ok: false, error: "No autorizado." };

  await classRepo(supabase).restore(classId);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/archivo");
  return { ok: true };
}

export async function permanentDeleteClassAction(
  classId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: cls } = await supabase
    .from("classes")
    .select("professor_id, deleted_at")
    .eq("id", classId)
    .maybeSingle();
  if (!cls || cls.professor_id !== user.id) return { ok: false, error: "No autorizado." };
  if (!cls.deleted_at) return { ok: false, error: "La clase no está en el archivo." };

  const { error } = await supabase.from("classes").delete().eq("id", classId);
  if (error) return { ok: false, error: "No se pudo eliminar definitivamente." };

  revalidatePath("/dashboard/archivo");
  return { ok: true };
}

export async function restoreModuleAction(
  moduleId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  // Verify ownership via class
  const { data: mod } = await supabase
    .from("modules")
    .select("class_id")
    .eq("id", moduleId)
    .maybeSingle();
  if (!mod) return { ok: false, error: "Módulo no encontrado." };

  const { data: cls } = await supabase
    .from("classes")
    .select("professor_id")
    .eq("id", mod.class_id)
    .maybeSingle();
  if (!cls || cls.professor_id !== user.id) return { ok: false, error: "No autorizado." };

  await moduleRepo(supabase).restore(moduleId);
  revalidatePath(`/dashboard/clases/${mod.class_id}`);
  revalidatePath("/dashboard/archivo");
  return { ok: true };
}

export async function permanentDeleteModuleAction(
  moduleId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado." };

  const { data: mod } = await supabase
    .from("modules")
    .select("class_id, deleted_at")
    .eq("id", moduleId)
    .maybeSingle();
  if (!mod) return { ok: false, error: "Módulo no encontrado." };
  if (!mod.deleted_at) return { ok: false, error: "El módulo no está en el archivo." };

  const { data: cls } = await supabase
    .from("classes")
    .select("professor_id")
    .eq("id", mod.class_id)
    .maybeSingle();
  if (!cls || cls.professor_id !== user.id) return { ok: false, error: "No autorizado." };

  const { error } = await supabase.from("modules").delete().eq("id", moduleId);
  if (error) return { ok: false, error: "No se pudo eliminar definitivamente." };

  revalidatePath("/dashboard/archivo");
  return { ok: true };
}
