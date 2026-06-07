import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { quizRepo } from "@/server/repositories/quizRepo";
import { attemptRepo } from "@/server/repositories/attemptRepo";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { ClassNav } from "@/components/public/ClassNav";
import { RichTextRenderer } from "@/components/content/RichTextRenderer";
import { QuizAccess } from "@/components/quiz/QuizAccess";
import { QuizResult } from "@/components/quiz/QuizResult";

interface Props {
  params: Promise<{ classSlug: string; moduleSlug: string; contentSlug: string }>;
  searchParams: Promise<{ resultado?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { classSlug, moduleSlug, contentSlug } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getBySlug(classSlug);
  if (!cls) return {};
  const mod = await moduleRepo(supabase).findBySlug(cls.id, moduleSlug);
  if (!mod) return {};
  const content = await contentRepo(supabase).findBySlug(mod.id, contentSlug);
  if (!content) return {};
  return { title: `${content.title} — ${cls.title}` };
}

export default async function ContentPage({ params, searchParams }: Props) {
  const { classSlug, moduleSlug, contentSlug } = await params;
  const { resultado: resultadoId } = await searchParams;
  const supabase = await createClient();

  const cls = await classService(supabase).getBySlug(classSlug);
  if (!cls) notFound();

  const mod = await moduleRepo(supabase).findBySlug(cls.id, moduleSlug);
  if (!mod || !mod.is_published) notFound();

  const now = new Date();
  const unavailable =
    !mod.is_available ||
    (mod.opens_at && new Date(mod.opens_at) > now) ||
    (mod.closes_at && new Date(mod.closes_at) < now);
  if (unavailable) notFound();

  const content = await contentRepo(supabase).findBySlug(mod.id, contentSlug);
  if (!content || !content.is_published) notFound();

  // Para quizzes: cargar datos con service client y leer cookie del estudiante
  let quiz = null;
  let initialStudent = null;
  let initialAttempts: import("@/lib/types/db").Attempt[] = [];
  let resultData: {
    attempt: import("@/lib/types/db").Attempt;
    questions: import("@/lib/types/db").AttemptQuestion[];
    answers: import("@/lib/types/db").Answer[];
    studentName: { firstName: string; lastName: string; email: string };
  } | null = null;

  if (content.type === "quiz") {
    const svc = createServiceClient();
    quiz = await quizRepo(svc).findByContentId(content.id);
    initialStudent = await getStudentFromCookie();

    // Cargar intentos previos si el estudiante está identificado
    if (initialStudent && quiz) {
      initialAttempts = await attemptRepo(svc).listFinishedByStudent(
        quiz.id,
        initialStudent.student_id
      );
    }

    // Cargar resultado si viene el param ?resultado=
    if (resultadoId && initialStudent) {
      const aRepo = attemptRepo(svc);
      const attempt = await aRepo.findById(resultadoId);
      if (attempt && attempt.student_id === initialStudent.student_id) {
        const [questions, answers, studentRow] = await Promise.all([
          aRepo.listQuestions(resultadoId),
          aRepo.listAnswers(resultadoId),
          svc.from("students").select("first_name, last_name, email").eq("id", attempt.student_id).single(),
        ]);
        const s = studentRow.data;
        resultData = {
          attempt,
          questions,
          answers,
          studentName: {
            firstName: s?.first_name ?? "",
            lastName: s?.last_name ?? "",
            email: s?.email ?? initialStudent.email,
          },
        };
      }
    }
  }

  const TYPE_LABEL: Record<string, string> = {
    rich_text: "Lectura",
    video: "Video",
    map: "Mapa",
    file: "Archivo",
    quiz: "Evaluación",
  };

  return (
    <main className="min-h-screen bg-page">
      <ClassNav
        cls={cls}
        crumbs={[
          { label: mod.title, href: `/c/${classSlug}/${moduleSlug}` },
          { label: content.title },
        ]}
      />

      <header className="px-5 py-10 md:px-10 md:py-14 max-w-3xl mx-auto border-b border-[rgba(0,0,0,0.06)]">
        <p className="text-eyebrow text-ink-mute mb-2">{TYPE_LABEL[content.type] ?? content.type}</p>
        <h1 className="text-h1 text-ink text-[clamp(22px,3.5vw,32px)]">{content.title}</h1>
      </header>

      <article className="px-5 py-10 md:px-10 max-w-3xl mx-auto">
        {content.type === "rich_text" && (
          <RichTextRenderer body={content.body_published} />
        )}
        {content.type === "video" && (
          <p className="text-body text-ink-soft">Video — próximamente.</p>
        )}
        {content.type === "map" && (
          <p className="text-body text-ink-soft">Mapa — próximamente.</p>
        )}
        {content.type === "file" && (
          <p className="text-body text-ink-soft">Archivo — próximamente.</p>
        )}
        {content.type === "quiz" && resultData && quiz && (
          <QuizResult
            attempt={resultData.attempt}
            quiz={quiz}
            questions={resultData.questions}
            answers={resultData.answers}
            contentUrl={`/c/${classSlug}/${moduleSlug}/${contentSlug}`}
            student={resultData.studentName}
          />
        )}
        {content.type === "quiz" && !resultData && (
          <QuizAccess
            quiz={quiz}
            content={{ title: content.title, slug: content.slug }}
            classSlug={classSlug}
            moduleSlug={moduleSlug}
            initialStudent={initialStudent}
            initialAttempts={initialAttempts}
          />
        )}
      </article>
    </main>
  );
}
