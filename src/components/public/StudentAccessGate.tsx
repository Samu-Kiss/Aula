import { Lock, Hourglass } from "lucide-react";
import type { Class } from "@/lib/types/db";
import type { StudentAccessState } from "@/lib/auth/studentAccess";
import { ClassNav } from "@/components/public/ClassNav";
import { SelfEnrollBanner } from "@/app/c/[classSlug]/SelfEnrollBanner";

interface Props {
  cls: Class;
  access: Exclude<StudentAccessState, "approved">;
  student: { email: string } | null;
  studentName: string | null;
  crumbs?: { label: string; href?: string }[];
}

/**
 * Pantalla que reemplaza el contenido de módulos/contenidos cuando el
 * estudiante no tiene acceso aprobado a la clase. La landing de la clase
 * sigue siendo pública; aquí se pide identificarse o esperar aprobación.
 */
export function StudentAccessGate({ cls, access, student, studentName, crumbs }: Props) {
  return (
    <main className="min-h-screen bg-page">
      <ClassNav cls={cls} crumbs={crumbs} />

      <div className="max-w-3xl mx-auto px-5 md:px-10 py-14 md:py-20">
        {access === "pending" ? (
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center">
              <Hourglass size={18} className="text-ink-soft" aria-hidden />
            </div>
            <h1 className="text-h1 text-ink text-[clamp(22px,3.5vw,32px)]">
              Tu acceso está pendiente de aprobación
            </h1>
            <p className="text-body text-ink-soft max-w-xl">
              Tu profesor recibió la solicitud
              {studentName ? (
                <>
                  {" "}de <span className="font-medium text-ink">{studentName}</span>
                </>
              ) : null}
              {student?.email ? (
                <>
                  {" "}(<span className="text-mono">{student.email}</span>)
                </>
              ) : null}
              . Cuando la apruebe podrás ver los módulos y contenidos de la clase.
            </p>
            <p className="text-caption text-ink-mute">
              Vuelve a intentar más tarde o pídele a tu profesor que revise la
              sección Estudiantes de su clase.
            </p>
          </div>
        ) : access === "inactive" ? (
          <div className="space-y-4">
            <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center">
              <Lock size={16} className="text-ink-soft" aria-hidden />
            </div>
            <h1 className="text-h1 text-ink text-[clamp(22px,3.5vw,32px)]">
              Tu acceso a esta clase está desactivado
            </h1>
            <p className="text-body text-ink-soft max-w-xl">
              Habla con tu profesor si crees que se trata de un error.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-full bg-surface-alt flex items-center justify-center">
                <Lock size={16} className="text-ink-soft" aria-hidden />
              </div>
              <h1 className="text-h1 text-ink text-[clamp(22px,3.5vw,32px)]">
                Este contenido es para estudiantes de la clase
              </h1>
              <p className="text-body text-ink-soft max-w-xl">
                Identifícate con tu correo para solicitar acceso. Tu profesor
                aprobará tu ingreso y podrás ver módulos, lecturas y
                evaluaciones.
              </p>
            </div>
            <SelfEnrollBanner
              classId={cls.id}
              existingEmail={student?.email ?? null}
              existingName={studentName}
              enrollmentStatus={null}
            />
          </div>
        )}
      </div>
    </main>
  );
}
