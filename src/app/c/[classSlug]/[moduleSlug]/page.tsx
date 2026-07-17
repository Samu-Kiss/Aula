import type React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Video, Map, Paperclip, ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { getStudentAccess, getStudentDisplayName } from "@/lib/auth/studentAccess";
import { ClassNav } from "@/components/public/ClassNav";
import { StudentAccessGate } from "@/components/public/StudentAccessGate";
import { ModuleContentsSidebar } from "@/components/public/ModuleContentsSidebar";
import { RichTextRenderer } from "@/components/content/RichTextRenderer";
import { VideoRenderer } from "@/components/content/VideoRenderer";
import { MapRendererClient } from "@/components/content/MapRendererClient";
import { FileRenderer } from "@/components/content/FileRenderer";
import type { Content } from "@/lib/types/db";

interface Props {
  params: Promise<{ classSlug: string; moduleSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { classSlug, moduleSlug } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getBySlug(classSlug);
  if (!cls) return {};
  const mod = await moduleRepo(supabase).findBySlug(cls.id, moduleSlug);
  if (!mod) return {};
  return { title: `${mod.title} — ${cls.title}` };
}

const CONTENT_ICONS: Record<string, React.ReactNode> = {
  rich_text: <BookOpen size={14} />,
  video: <Video size={14} />,
  map: <Map size={14} />,
  file: <Paperclip size={14} />,
  quiz: <ClipboardList size={14} />,
};

function ContentCard({
  content,
  index,
  classSlug,
  moduleSlug,
}: {
  content: Content;
  index: number;
  classSlug: string;
  moduleSlug: string;
}) {
  return (
    <Link
      href={`/c/${classSlug}/${moduleSlug}/${content.slug}`}
      className="flex items-center gap-4 px-5 py-4 rounded-[12px] bg-surface border-subtle hover:border-ink/20 transition-colors"
    >
      <span className="text-mono text-ink-mute w-6 shrink-0">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="flex-1 text-body text-ink">{content.title}</span>
      <span className="text-ink-mute flex items-center">
        {CONTENT_ICONS[content.type] ?? content.type}
      </span>
    </Link>
  );
}

export default async function ModulePage({ params }: Props) {
  const { classSlug, moduleSlug } = await params;
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

  // Solo estudiantes aprobados por el profesor ven el contenido del módulo
  const access = await getStudentAccess(cls.id);
  if (access.state !== "approved") {
    const studentName = access.student
      ? await getStudentDisplayName(access.student.student_id)
      : null;
    return (
      <StudentAccessGate
        cls={cls}
        access={access.state}
        student={access.student}
        studentName={studentName}
        crumbs={[{ label: mod.title }]}
      />
    );
  }

  const contents = await contentRepo(supabase).listPublishedByModule(mod.id);

  const sidebarItems = contents.map((c) => ({
    id: c.id,
    slug: c.slug,
    title: c.title,
    type: c.type,
  }));

  return (
    <main className="min-h-screen bg-page">
      <ClassNav cls={cls} crumbs={[{ label: mod.title }]} />

      <div className="max-w-5xl mx-auto px-5 md:px-10">
        {/* Module header */}
        <header className="py-10 md:py-14 max-w-3xl">
          <h1 className="text-h1 text-ink text-[clamp(24px,4vw,36px)]">{mod.title}</h1>
          {mod.description && (
            <p className="text-body text-ink-soft mt-2 max-w-xl">{mod.description}</p>
          )}
        </header>

        {contents.length === 0 ? (
          <section className="pb-20">
            <p className="text-body text-ink-soft">No hay contenidos disponibles todavía.</p>
          </section>
        ) : (
          <>
          {/* Sidebar — fixed outside content flow, only on wide screens */}
          {contents.length > 1 && (
            <aside className="hidden xl:block fixed right-8 top-[30vh] w-[180px] z-10">
              <ModuleContentsSidebar contents={sidebarItems} accent={cls.accent} />
            </aside>
          )}

          <section className="pb-20 space-y-12 stagger">
            {contents.map((content, i) => {
                const isInline = content.type === "rich_text" ||
                  ((content.type === "video" || content.type === "map" || content.type === "file") && content.body_published);

                if (content.type === "quiz") {
                  return (
                    <div key={content.id} id={content.slug}>
                      <ContentCard content={content} index={i} classSlug={classSlug} moduleSlug={moduleSlug} />
                      {i < contents.length - 1 && (
                        <div className="mt-4 border-b border-hairline" />
                      )}
                    </div>
                  );
                }

                return (
                  <article key={content.id} id={content.slug}>
                    {/* Section header */}
                    <div className="flex items-baseline gap-3 mb-5">
                      <span className="text-mono text-ink-mute text-[12px] tabular-nums shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        {isInline ? (
                          <h2 className="text-h3 text-ink leading-snug">{content.title}</h2>
                        ) : (
                          <Link
                            href={`/c/${classSlug}/${moduleSlug}/${content.slug}`}
                            className="text-h3 text-ink hover:text-ink/70 transition-colors leading-snug"
                          >
                            {content.title}
                          </Link>
                        )}
                      </div>
                      <span className="text-mono text-ink-mute text-[11px] shrink-0">
                        {CONTENT_ICONS[content.type] ?? content.type}
                      </span>
                    </div>

                    {/* Inline body */}
                    {content.type === "rich_text" && content.body_published && (
                      <RichTextRenderer body={content.body_published as Record<string, unknown>} accent={cls.accent} />
                    )}
                    {content.type === "video" && (
                      content.body_published
                        ? <VideoRenderer body={content.body_published as Record<string, unknown>} />
                        : <ContentCard content={content} index={i} classSlug={classSlug} moduleSlug={moduleSlug} />
                    )}
                    {content.type === "map" && (
                      content.body_published
                        ? <MapRendererClient body={content.body_published as Record<string, unknown>} accent={cls.accent} />
                        : <ContentCard content={content} index={i} classSlug={classSlug} moduleSlug={moduleSlug} />
                    )}
                    {content.type === "file" && (
                      content.body_published
                        ? <FileRenderer contentId={content.id} body={content.body_published as Record<string, unknown>} />
                        : <ContentCard content={content} index={i} classSlug={classSlug} moduleSlug={moduleSlug} />
                    )}

                    {i < contents.length - 1 && (
                      <div className="mt-12 border-b border-hairline" />
                    )}
                  </article>
                );
              })}
          </section>
          </>
        )}
      </div>
    </main>
  );
}
