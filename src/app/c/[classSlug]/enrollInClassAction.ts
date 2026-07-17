"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { createAccessRequestNotification } from "@/lib/notifications/createAccessRequestNotification";

export type EnrollmentStatus = "pending" | "active" | "inactive";

// Called after /api/student/session/verify sets the cookie — enroll student in class.
// New self-enrollments start as 'pending' until the professor approves them.
export async function enrollInClassAction(
  classId: string
): Promise<{ ok: boolean; error?: string; email?: string; name?: string; status?: EnrollmentStatus }> {
  const student = await getStudentFromCookie();
  if (!student) return { ok: false, error: "not_authenticated" };

  const svc = createServiceClient();

  // Enroll — find or insert to avoid upsert constraint issues
  const { data: existing } = await svc
    .from("class_students")
    .select("id, status")
    .eq("class_id", classId)
    .eq("student_id", student.student_id)
    .maybeSingle();

  let status: EnrollmentStatus = (existing?.status as EnrollmentStatus) ?? "pending";

  if (!existing) {
    const { error: insertError } = await svc
      .from("class_students")
      .insert({ class_id: classId, student_id: student.student_id, status: "pending" });
    if (insertError) return { ok: false, error: "enroll_failed" };
    status = "pending";
  }

  const { data: row } = await svc
    .from("students")
    .select("first_name, last_name, display_name")
    .eq("id", student.student_id)
    .maybeSingle();

  const composed = [row?.first_name, row?.last_name].filter(Boolean).join(" ");
  const name = row?.display_name ?? (composed || student.email);

  // Avisar al profesor solo cuando se crea una solicitud nueva
  if (!existing) {
    const { data: cls } = await svc
      .from("classes")
      .select("professor_id, title")
      .eq("id", classId)
      .maybeSingle();
    if (cls?.professor_id) {
      await createAccessRequestNotification(cls.professor_id, {
        student_name: name,
        student_email: student.email,
        class_title: cls.title,
        class_id: classId,
      });
    }
  }

  return { ok: true, email: student.email, name, status };
}
