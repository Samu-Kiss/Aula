"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { gradeRepo } from "@/server/repositories/gradeRepo";

async function getAuthSvc(classId: string) {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return null;

  // Verify professor owns this class
  const { data: cls } = await auth.from("classes").select("id").eq("id", classId).eq("professor_id", user.id).maybeSingle();
  if (!cls) return null;

  return createServiceClient();
}

// Add a single student to the class roster
export async function enrollStudentAction(
  classId: string,
  formData: FormData
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const firstName = (formData.get("first_name") as string)?.trim() || null;
  const lastName = (formData.get("last_name") as string)?.trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email" };
  }

  const repo = gradeRepo(svc);
  const result = await repo.enrollStudent(classId, email, firstName, lastName);
  if (result.error) return { ok: false, error: result.error };

  revalidatePath(`/dashboard/clases/${classId}/estudiantes`);
  return { ok: true };
}

// Import students from CSV text (email,first_name,last_name per line)
export async function importRosterAction(
  classId: string,
  csvText: string
): Promise<{ ok: boolean; imported: number; errors: string[]; totalError?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, imported: 0, errors: [], totalError: "not_authenticated" };

  const repo = gradeRepo(svc);
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Skip header if first line contains "email" or "correo"
  const dataLines =
    lines[0]?.toLowerCase().includes("email") || lines[0]?.toLowerCase().includes("correo")
      ? lines.slice(1)
      : lines;

  let imported = 0;
  const errors: string[] = [];

  for (const line of dataLines) {
    const [rawEmail, rawFirst, rawLast] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    const email = rawEmail?.toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push(`Email inválido: "${rawEmail}"`);
      continue;
    }
    const result = await repo.enrollStudent(classId, email, rawFirst || null, rawLast || null);
    if (result.error) {
      errors.push(`${email}: ${result.error}`);
    } else {
      imported++;
    }
  }

  revalidatePath(`/dashboard/clases/${classId}/estudiantes`);
  return { ok: true, imported, errors };
}

// Toggle student enrollment status
export async function setEnrollmentStatusAction(
  classId: string,
  enrollmentId: string,
  status: "active" | "inactive"
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const repo = gradeRepo(svc);
  const { error } = await repo.setEnrollmentStatus(enrollmentId, classId, status);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clases/${classId}/estudiantes`);
  return { ok: true };
}

// Edit a student's name
export async function updateStudentAction(
  classId: string,
  studentId: string,
  firstName: string | null,
  lastName: string | null
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const repo = gradeRepo(svc);

  // El estudiante debe estar inscrito en esta clase para poder editar su nombre.
  // `students` es global (una fila por email); sin esta comprobación un profesor
  // podría renombrar a cualquier estudiante de la plataforma vía service client.
  if (!(await repo.studentBelongsToClass(studentId, classId))) {
    return { ok: false, error: "not_found" };
  }

  const { error } = await repo.updateStudentProfile(studentId, firstName, lastName);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/clases/${classId}/estudiantes`);
  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  return { ok: true };
}

// Remove a student from the roster
// For explicit enrollments: hard-delete the class_students row
// For implicit students (id starts with "implicit-"): insert inactive row to block them
export async function removeFromRosterAction(
  classId: string,
  enrollmentId: string,
  studentId: string
): Promise<{ ok: boolean; error?: string }> {
  const svc = await getAuthSvc(classId);
  if (!svc) return { ok: false, error: "not_authenticated" };

  const repo = gradeRepo(svc);

  if (enrollmentId.startsWith("implicit-")) {
    const { error } = await repo.blockImplicitStudent(classId, studentId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await repo.removeEnrollment(enrollmentId, classId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/dashboard/clases/${classId}/estudiantes`);
  revalidatePath(`/dashboard/clases/${classId}/calificaciones`);
  return { ok: true };
}
