"use server";

import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { signStudentJwt, buildStudentCookie } from "@/lib/auth/studentJwt";

export async function selfEnrollAction(
  classId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string; email?: string; name?: string }> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const firstName = (formData.get("first_name") as string)?.trim() || null;
  const lastName = (formData.get("last_name") as string)?.trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email" };
  }
  if (!firstName || !lastName) {
    return { ok: false, error: "missing_name" };
  }

  const svc = createServiceClient();

  // Find or create student by email
  const { data: existing } = await svc
    .from("students")
    .select("id, email, first_name, last_name, display_name")
    .eq("email", email)
    .maybeSingle();

  let student: { id: string; email: string; first_name: string | null; last_name: string | null; display_name: string | null } | null = null;

  if (existing) {
    const { data: updated, error: uErr } = await svc
      .from("students")
      .update({ first_name: firstName, last_name: lastName })
      .eq("id", existing.id)
      .select("id, email, first_name, last_name, display_name")
      .single();
    if (uErr || !updated) {
      console.error("[selfEnrollAction] update error:", uErr?.code, uErr?.message);
      return { ok: false, error: "student_error", ...(process.env.NODE_ENV !== "production" && { _debug: uErr?.message }) };
    }
    student = updated;
  } else {
    const { data: created, error: cErr } = await svc
      .from("students")
      .insert({ email, first_name: firstName, last_name: lastName })
      .select("id, email, first_name, last_name, display_name")
      .single();
    if (cErr || !created) {
      console.error("[selfEnrollAction] insert error:", cErr?.code, cErr?.message);
      return { ok: false, error: "student_error", ...(process.env.NODE_ENV !== "production" && { _debug: cErr?.message }) };
    }
    student = created;
  }

  // Enroll in class (no-op if already enrolled)
  await svc
    .from("class_students")
    .upsert(
      { class_id: classId, student_id: student.id, status: "active" },
      { onConflict: "class_id,student_id" }
    );

  // Issue JWT so they're identified automatically in quizzes (30-day remember)
  const token = await signStudentJwt({ student_id: student.id, email: student.email }, true);
  const cookieStore = await cookies();
  const opts = buildStudentCookie(token, true);
  cookieStore.set(opts.name, opts.value, opts);

  const composed = [student.first_name, student.last_name].filter(Boolean).join(" ");
  const displayName = student.display_name ?? (composed || student.email);

  return { ok: true, email: student.email, name: displayName };
}
