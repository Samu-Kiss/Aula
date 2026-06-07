import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { getStudentFromCookie } from "@/lib/auth/studentJwt";
import { Lockup } from "@/components/Lockup";
import { SelfEnrollBanner } from "./SelfEnrollBanner";

interface Props {
  params: Promise<{ classSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { classSlug } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getBySlug(classSlug);
  if (!cls) return {};
  return {
    title: cls.title,
    description: cls.description ?? undefined,
    openGraph: {
      title: cls.title,
      description: cls.description ?? undefined,
      locale: "es_CO",
      type: "article",
    },
  };
}

export default async function ClassLandingPage({ params }: Props) {
  const { classSlug } = await params;
  const supabase = await createClient();
  const cls = await classService(supabase).getBySlug(classSlug);
  if (!cls) notFound();

  const [modules, student] = await Promise.all([
    moduleRepo(supabase).listPublishedByClass(cls.id),
    getStudentFromCookie(),
  ]);

  // Resolve display name for one-click enroll banner
  let studentName: string | null = null;
  if (student) {
    const { data: row } = await supabase
      .from("students")
      .select("first_name, last_name, display_name")
      .eq("id", student.student_id)
      .maybeSingle();
    if (row) {
      const composed = [row.first_name, row.last_name].filter(Boolean).join(" ");
      studentName = row.display_name ?? (composed || null);
    }
  }

  return (
    <main className="min-h-screen bg-page">
      {/* Hero */}
      <header className="px-6 py-16 md:px-12 md:py-24 max-w-4xl mx-auto">
        {cls.description && (
          <p className="text-eyebrow text-ink-mute mb-6">{cls.description}</p>
        )}
        <Lockup
          title={cls.title}
          accent={cls.accent}
          splitAt={cls.lockup_split_at}
          className="text-[clamp(48px,7vw,96px)]"
        />
      </header>

      {/* Self-enroll banner */}
      <section className="px-6 pb-8 md:px-12 max-w-4xl mx-auto">
        <SelfEnrollBanner
          classId={cls.id}
          existingEmail={student?.email ?? null}
          existingName={studentName}
        />
      </section>

      {/* Módulos */}
      <section className="px-6 pb-24 md:px-12 max-w-4xl mx-auto">
        <p className="text-eyebrow text-ink-mute mb-6">Módulos</p>
        {modules.length === 0 ? (
          <p className="text-body text-ink-soft">No hay módulos disponibles todavía.</p>
        ) : (
          <ol className="space-y-2">
            {modules.map((mod, i) => {
              const now = new Date();
              const isScheduled = mod.opens_at && new Date(mod.opens_at) > now;
              const isClosed = mod.closes_at && new Date(mod.closes_at) < now;
              const isBlocked = !mod.is_available;
              const locked = isScheduled || isClosed || isBlocked;

              return (
                <li key={mod.id}>
                  {locked ? (
                    <div className="flex items-center gap-4 px-5 py-4 rounded-[12px] bg-surface border-subtle opacity-60 cursor-not-allowed">
                      <span className="text-mono text-ink-mute w-6 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-body text-ink flex-1">{mod.title}</span>
                      <span className="text-mono text-ink-mute text-xs">
                        {isScheduled
                          ? `Abre ${new Date(mod.opens_at!).toLocaleDateString("es-CO")}`
                          : isClosed
                          ? "Cerrado"
                          : "Bloqueado"}
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={`/c/${classSlug}/${mod.slug}`}
                      className="flex items-center gap-4 px-5 py-4 rounded-[12px] bg-surface border-subtle hover:border-ink/20 transition-colors group"
                    >
                      <span className="text-mono text-ink-mute w-6 shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-body text-ink flex-1 group-hover:text-ink transition-colors">
                        {mod.title}
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
