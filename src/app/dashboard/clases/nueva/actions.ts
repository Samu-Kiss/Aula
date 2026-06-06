"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { ZodError } from "zod";

export type CreateClassState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Record<string, string> }
  | { status: "success"; id: string };

export async function createClassAction(
  _prev: CreateClassState,
  formData: FormData
): Promise<CreateClassState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "No autenticado." };

  try {
    const cls = await classService(supabase).create(user.id, {
      title: formData.get("title"),
      slug: formData.get("slug"),
      description: formData.get("description") || undefined,
      accent: formData.get("accent"),
      visibility: "unlisted",
    });
    redirect(`/dashboard/clases/${cls.id}`);
  } catch (err) {
    if (err instanceof ZodError) {
      const fields: Record<string, string> = {};
      for (const issue of err.issues) {
        const key = issue.path[0]?.toString();
        if (key) fields[key] = issue.message;
      }
      return { status: "error", message: "Revisa los campos.", fields };
    }
    // slug duplicado
    if (err instanceof Error && err.message.includes("duplicate")) {
      return { status: "error", message: "Este slug ya está en uso.", fields: { slug: "Ya existe una clase con este slug." } };
    }
    throw err;
  }
}
