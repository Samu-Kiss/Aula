import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { Lockup } from "@/components/Lockup";

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

export default async function ModulePage({ params }: Props) {
  const { classSlug, moduleSlug } = await params;
  const supabase = await createClient();

  const cls = await classService(supabase).getBySlug(classSlug);
  if (!cls) notFound();

  const mod = await moduleRepo(supabase).findBySlug(cls.id, moduleSlug);
  if (!mod || !mod.is_published) notFound();

  // Verificar disponibilidad
  const now = new Date();
  const unavailable =
    !mod.is_available ||
    (mod.opens_at && new Date(mod.opens_at) > now) ||
    (mod.closes_at && new Date(mod.closes_at) < now);
  if (unavailable) notFound();

  const contents = await contentRepo(supabase).listPublishedByModule(mod.id);

  const CONTENT_LABELS: Record<string, string> = {
    rich_text: "Lectura",
    video: "Video",
    map: "Mapa",
    file: "Archivo",
    quiz: "Evaluación",
  };

  return (
    <main className="min-h-screen bg-page">
      <header className="px-6 py-12 md:px-12 md:py-16 max-w-4xl mx-auto border-b border-[rgba(0,0,0,0.08)]">
        <Link
          href={`/c/${classSlug}`}
          className="text-mono text-ink-mute hover:text-ink transition-colors mb-6 block"
        >
          ← <Lockup title={cls.title} accent={cls.accent} splitAt={cls.lockup_split_at} className="text-sm" />
        </Link>
        <h1 className="text-h1 text-ink">{mod.title}</h1>
        {mod.description && (
          <p className="text-body text-ink-soft mt-2">{mod.description}</p>
        )}
      </header>

      <section className="px-6 py-10 md:px-12 max-w-4xl mx-auto">
        {contents.length === 0 ? (
          <p className="text-body text-ink-soft">No hay contenidos disponibles todavía.</p>
        ) : (
          <ol className="space-y-2">
            {contents.map((content, i) => (
              <li key={content.id}>
                <Link
                  href={`/c/${classSlug}/${moduleSlug}/${content.slug}`}
                  className="flex items-center gap-4 px-5 py-4 rounded-[12px] bg-surface border-subtle hover:border-ink/20 transition-colors group"
                >
                  <span className="text-mono text-ink-mute w-6 shrink-0">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 text-body text-ink">{content.title}</span>
                  <span className="text-mono text-ink-mute text-xs">
                    {CONTENT_LABELS[content.type] ?? content.type}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
