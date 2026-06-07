import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { gradeRepo } from "@/server/repositories/gradeRepo";
import { RosterClient } from "./RosterClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EstudiantesPage({ params }: Props) {
  const { id: classId } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getById(classId);
  if (!cls) notFound();

  const svc = createServiceClient();
  const repo = gradeRepo(svc);
  const enrollments = await repo.listEnrolled(classId);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-eyebrow text-ink-mute mb-1">Clase</p>
        <h1 className="text-h2 text-ink">Estudiantes</h1>
      </div>
      <RosterClient classId={classId} initialEnrollments={enrollments} />
    </div>
  );
}
