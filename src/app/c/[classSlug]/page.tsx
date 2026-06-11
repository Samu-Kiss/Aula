import type React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { formatDate } from "@/lib/dates";
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

  const openModules = modules.filter((m) => {
    const now = new Date();
    return (
      m.is_available &&
      (!m.opens_at || new Date(m.opens_at) <= now) &&
      (!m.closes_at || new Date(m.closes_at) >= now)
    );
  }).length;

  return (
    <main className="min-h-screen bg-page">
      {/* Hero — portada editorial: lockup primero, descripción como bajada */}
      <header className="px-6 pt-16 pb-10 md:px-12 md:pt-24 md:pb-14 max-w-4xl mx-auto">
        <p className="text-eyebrow text-ink-mute mb-6 animate-fade-up">Clase</p>
        <div className="animate-fade-up" style={{ "--delay": "60ms" } as React.CSSProperties}>
          <Lockup
            title={cls.title}
            accent={cls.accent}
            splitAt={cls.lockup_split_at}
            className="text-[clamp(48px,7vw,96px)]"
          />
        </div>
        {cls.description && (
          <p
            className="font-serif italic text-[clamp(17px,2vw,20px)] leading-relaxed text-ink-soft mt-6 max-w-xl animate-fade-up"
            style={{ "--delay": "140ms" } as React.CSSProperties}
          >
            {cls.description}
          </p>
        )}
        {/* Colofón: metadata en mono, como ficha bibliográfica */}
        <div
          className="flex items-center gap-4 mt-8 animate-fade-up"
          style={{ "--delay": "220ms" } as React.CSSProperties}
        >
          <span className="text-mono text-ink-mute">
            {modules.length} {modules.length === 1 ? "módulo" : "módulos"}
          </span>
          <span className="text-mono text-ink-mute">·</span>
          <span className="text-mono text-ink-mute">
            {openModules} {openModules === 1 ? "abierto" : "abiertos"}
          </span>
        </div>
        <hr className="rule mt-10" />
      </header>

      {/* Self-enroll banner */}
      <section className="px-6 pb-8 md:px-12 max-w-4xl mx-auto">
        <SelfEnrollBanner
          classId={cls.id}
          existingEmail={student?.email ?? null}
          existingName={studentName}
        />
      </section>

      {/* Módulos — índice de libro: filas separadas por hairlines */}
      <section className="px-6 pb-24 md:px-12 max-w-4xl mx-auto">
        <p className="text-eyebrow text-ink-mute mb-2">Índice</p>
        {modules.length === 0 ? (
          <p className="text-body text-ink-soft mt-4">No hay módulos disponibles todavía.</p>
        ) : (
          <ol className="stagger">
            {modules.map((mod, i) => {
              const now = new Date();
              const isScheduled = mod.opens_at && new Date(mod.opens_at) > now;
              const isClosed = mod.closes_at && new Date(mod.closes_at) < now;
              const isBlocked = !mod.is_available;
              const locked = isScheduled || isClosed || isBlocked;

              const number = (
                <span className="text-mono text-ink-mute w-8 shrink-0 text-[13px] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              );

              return (
                <li key={mod.id} className="border-b border-hairline">
                  {locked ? (
                    <div className="flex items-center gap-4 px-1 py-5">
                      {number}
                      <span className="text-h2 text-ink-mute flex-1">{mod.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <Lock size={13} className="text-ink-mute" aria-hidden />
                        <span className="font-serif italic text-[14px] text-ink-mute">
                          {isScheduled
                            ? `Abre el ${formatDate(mod.opens_at!)}`
                            : isClosed
                            ? "Cerrado"
                            : "Próximamente"}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={`/c/${classSlug}/${mod.slug}`}
                      className="flex items-center gap-4 px-1 py-5 group transition-colors hover:bg-surface/60"
                    >
                      {number}
                      <span className="text-h2 text-ink flex-1 transition-transform duration-200 group-hover:translate-x-1">
                        {mod.title}
                      </span>
                      <span
                        className="text-mono text-[13px] shrink-0 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0"
                        style={{ color: "var(--class-accent)" }}
                        aria-hidden
                      >
                        →
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
