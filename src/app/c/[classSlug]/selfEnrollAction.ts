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

  const svc = createServiceClient();

  // Upsert student — only overwrite name fields if provided, don't clobber existing
  const upsertPayload: Record<string, unknown> = { email };
  if (firstName) upsertPayload.first_name = firstName;
  if (lastName) upsertPayload.last_name = lastName;

  const { data: student, error: sErr } = await svc
    .from("students")
    .upsert(upsertPayload, { onConflict: "email" })
    .select("id, email, first_name, last_name, display_name")
    .single();

  if (sErr || !student) return { ok: false, error: "student_error" };

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
