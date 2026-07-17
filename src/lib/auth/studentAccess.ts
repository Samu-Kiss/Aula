import { createServiceClient } from "@/lib/supabase/server";
import { getStudentFromCookie, type StudentPayload } from "@/lib/auth/studentJwt";

export type StudentAccessState =
  | "anonymous" // sin cookie de estudiante
  | "unenrolled" // identificado pero sin fila en class_students
  | "pending" // solicitó acceso, espera aprobación del profesor
  | "inactive" // desactivado por el profesor
  | "approved"; // puede ver el contenido

export interface StudentAccess {
  state: StudentAccessState;
  student: StudentPayload | null;
}

/**
 * Resuelve el estado de acceso del estudiante actual a una clase.
 * La landing pública no lo usa (siempre visible); módulos, contenidos y
 * quizzes solo se muestran con state === "approved".
 */
export async function getStudentAccess(classId: string): Promise<StudentAccess> {
  const student = await getStudentFromCookie();
  if (!student) return { state: "anonymous", student: null };

  const svc = createServiceClient();
  const { data } = await svc
    .from("class_students")
    .select("status")
    .eq("class_id", classId)
    .eq("student_id", student.student_id)
    .maybeSingle();

  if (!data) return { state: "unenrolled", student };
  if (data.status === "active") return { state: "approved", student };
  if (data.status === "pending") return { state: "pending", student };
  return { state: "inactive", student };
}

/** Nombre para mostrar del estudiante (display_name > nombre compuesto > null). */
export async function getStudentDisplayName(studentId: string): Promise<string | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("students")
    .select("first_name, last_name, display_name")
    .eq("id", studentId)
    .maybeSingle();
  if (!data) return null;
  const composed = [data.first_name, data.last_name].filter(Boolean).join(" ");
  return data.display_name ?? (composed || null);
}
