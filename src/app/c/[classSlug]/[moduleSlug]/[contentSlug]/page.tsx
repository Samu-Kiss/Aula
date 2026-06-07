import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { quizRepo } from "@/server/repositories/quizRepo";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { ClassNav } from "@/components/public/ClassNav";
import { RichTextRenderer } from "@/components/content/RichTextRenderer";
import { QuizAccess } from "@/components/quiz/QuizAccess";

interface Props {
  params: Promise<{ classSlug: string; moduleSlug: string; contentSlug: string }>;
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

export default async function ContentPage({ params }: Props) {
  const { classSlug, moduleSlug, contentSlug } = await params;
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
  if (content.type === "quiz") {
    const svc = createServiceClient();
    quiz = await quizRepo(svc).findByContentId(content.id);
    initialStudent = await getStudentFromCookie();
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
        {content.type === "quiz" && (
          <QuizAccess
            quiz={quiz}
            content={{ title: content.title, slug: content.slug }}
            classSlug={classSlug}
            moduleSlug={moduleSlug}
            initialStudent={initialStudent}
          />
        )}
      </article>
    </main>
  );
}
