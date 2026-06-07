import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { attemptRepo } from "@/server/repositories/attemptRepo";
import { quizRepo } from "@/server/repositories/quizRepo";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { createClient } from "@/lib/supabase/server";
import { ClassNav } from "@/components/public/ClassNav";
import { AttemptView } from "@/components/quiz/AttemptView";

interface Props {
  params: Promise<{
    classSlug: string;
    moduleSlug: string;
    contentSlug: string;
    attemptId: string;
  }>;
}

export default async function AttemptPage({ params }: Props) {
  const { classSlug, moduleSlug, contentSlug, attemptId } = await params;

  // Verificar identidad del estudiante
  const student = await getStudentFromCookie();
  if (!student) {
    redirect(`/c/${classSlug}/${moduleSlug}/${contentSlug}`);
  }

  const supabase = createServiceClient();
  const aRepo = attemptRepo(supabase);

  // Cargar intento y verificar pertenencia
  const attempt = await aRepo.findById(attemptId);
  if (!attempt || attempt.student_id !== student.student_id) notFound();

  // Si ya fue enviado/calificado, redirigir a resultados (F2-10)
  if (attempt.status === "submitted" || attempt.status === "graded") {
    redirect(`/c/${classSlug}/${moduleSlug}/${contentSlug}`);
  }

  // Si expiró sin enviar, marcar abandonado y redirigir
  if (attempt.expires_at && new Date(attempt.expires_at) < new Date()) {
    await supabase.from("attempts").update({ status: "abandoned" }).eq("id", attempt.id);
    redirect(`/c/${classSlug}/${moduleSlug}/${contentSlug}`);
  }

  // Cargar preguntas e respuestas existentes
  const [questions, answers] = await Promise.all([
    aRepo.listQuestions(attemptId),
    aRepo.listAnswers(attemptId),
  ]);

  // Cargar quiz (para mostrar info)
  const quiz = attempt.quiz_id ? await quizRepo(supabase).findById(attempt.quiz_id) : null;

  // Cargar datos de navegación (clase, módulo, contenido)
  const pubSupabase = await createClient();
  const cls = await classService(pubSupabase).getBySlug(classSlug);
  if (!cls) notFound();
  const mod = await moduleRepo(pubSupabase).findBySlug(cls.id, moduleSlug);
  const content = mod ? await contentRepo(pubSupabase).findBySlug(mod.id, contentSlug) : null;

  return (
    <main className="min-h-screen bg-page">
      <ClassNav
        cls={cls}
        crumbs={[
          { label: mod?.title ?? moduleSlug, href: `/c/${classSlug}/${moduleSlug}` },
          { label: content?.title ?? contentSlug, href: `/c/${classSlug}/${moduleSlug}/${contentSlug}` },
          { label: `Intento ${attempt.attempt_number}` },
        ]}
      />

      <div className="px-5 py-8 md:px-10 max-w-3xl mx-auto">
        <AttemptView
          attempt={attempt}
          questions={questions}
          initialAnswers={answers}
          quiz={quiz}
          student={student}
          contentUrl={`/c/${classSlug}/${moduleSlug}/${contentSlug}`}
        />
      </div>
    </main>
  );
}
