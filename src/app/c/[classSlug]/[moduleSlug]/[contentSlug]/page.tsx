import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { Lockup } from "@/components/Lockup";
import { RichTextRenderer } from "@/components/content/RichTextRenderer";

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

  return (
    <main className="min-h-screen bg-page">
      <header className="px-6 py-10 md:px-12 max-w-3xl mx-auto border-b border-[rgba(0,0,0,0.08)]">
        <Link
          href={`/c/${classSlug}/${moduleSlug}`}
          className="text-mono text-ink-mute hover:text-ink transition-colors mb-6 block"
        >
          ← {mod.title}
        </Link>
        <h1 className="text-h1 text-ink">{content.title}</h1>
      </header>

      <article className="px-6 py-10 md:px-12 max-w-3xl mx-auto">
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
          <p className="text-body text-ink-soft">Evaluación — próximamente.</p>
        )}
      </article>

      <nav className="px-6 pb-16 md:px-12 max-w-3xl mx-auto">
        <Link
          href={`/c/${classSlug}/${moduleSlug}`}
          className="text-mono text-ink-mute hover:text-ink transition-colors"
        >
          ← Volver al módulo
        </Link>
      </nav>
    </main>
  );
}
