"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";

// Called after /api/student/session/verify sets the cookie — enroll student in class
export async function enrollInClassAction(
  classId: string
): Promise<{ ok: boolean; error?: string; email?: string; name?: string }> {
  const student = await getStudentFromCookie();
  if (!student) return { ok: false, error: "not_authenticated" };

  const svc = createServiceClient();

  // Enroll — find or insert to avoid upsert constraint issues
  const { data: existing } = await svc
    .from("class_students")
    .select("id")
    .eq("class_id", classId)
    .eq("student_id", student.student_id)
    .maybeSingle();

  if (!existing) {
    await svc
      .from("class_students")
      .insert({ class_id: classId, student_id: student.student_id, status: "active" });
  }

  const { data: row } = await svc
    .from("students")
    .select("first_name, last_name, display_name")
    .eq("id", student.student_id)
    .maybeSingle();

  const composed = [row?.first_name, row?.last_name].filter(Boolean).join(" ");
  const name = row?.display_name ?? (composed || student.email);

  return { ok: true, email: student.email, name };
}
