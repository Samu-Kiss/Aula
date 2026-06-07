import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { quizRepo } from "@/server/repositories/quizRepo";
import { attemptRepo } from "@/server/repositories/attemptRepo";

interface Props {
  params: Promise<{ id: string }>;
}

function pct(score: number | null, max: number | null) {
  if (score == null || !max) return "—";
  return `${Math.round((score / max) * 100)}%`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", { dateStyle: "short", timeStyle: "short" });
}

function studentName(s: { first_name: string | null; last_name: string | null; display_name: string | null; email: string }) {
  if (s.display_name) return s.display_name;
  if (s.first_name || s.last_name) return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
  return s.email;
}

export default async function IntentosPage({ params }: Props) {
  const { id: classId } = await params;
  const supabase = await createClient();

  const cls = await classService(supabase).getById(classId);
  if (!cls) notFound();

  const svc = createServiceClient();

  // Cargar todos los módulos → contenidos tipo quiz → quizzes + intentos
  const modules = await moduleRepo(supabase).listByClass(classId);
  const contentsList = (
    await Promise.all(modules.map((m) => contentRepo(supabase).listByModule(m.id)))
  ).flat().filter((c) => c.type === "quiz");

  const quizData = await Promise.all(
    contentsList.map(async (c) => {
      const quiz = await quizRepo(svc).findByContentId(c.id);
      const attempts = quiz ? await attemptRepo(svc).listByQuiz(quiz.id) : [];
      const mod = modules.find((m) => m.id === c.module_id);
      return { content: c, quiz, attempts, mod };
    })
  );

  const totalAttempts = quizData.reduce((acc, d) => acc + d.attempts.length, 0);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <p className="text-eyebrow text-ink-mute mb-1">Clase</p>
        <h1 className="text-h2 text-ink mb-1">Intentos</h1>
        <p className="text-body text-ink-soft">
          {totalAttempts} intento{totalAttempts !== 1 ? "s" : ""} en {quizData.filter((d) => d.quiz).length} evaluacion{quizData.filter((d) => d.quiz).length !== 1 ? "es" : ""}
        </p>
      </div>

      {quizData.length === 0 && (
        <p className="text-body text-ink-soft">No hay evaluaciones en esta clase todavía.</p>
      )}

      {quizData.map(({ content, quiz, attempts, mod }) => (
        <section key={content.id} className="bg-surface rounded-[12px] border-subtle overflow-hidden">
          {/* Quiz header */}
          <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-start justify-between gap-4">
            <div>
              <p className="text-caption text-ink-mute mb-0.5">{mod?.title ?? "Módulo"}</p>
              <p className="text-body text-ink font-medium">{content.title}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-mono text-ink-mute">
                {attempts.length} intento{attempts.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Attempts table */}
          {attempts.length === 0 ? (
            <p className="px-5 py-4 text-body text-ink-soft">Ningún estudiante ha presentado esta evaluación.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-body">
                <thead>
                  <tr className="border-b border-[rgba(0,0,0,0.06)]">
                    <th className="text-left text-caption text-ink-mute font-medium px-5 py-2.5">Estudiante</th>
                    <th className="text-left text-caption text-ink-mute font-medium px-3 py-2.5">Correo</th>
                    <th className="text-right text-caption text-ink-mute font-medium px-3 py-2.5">Intento</th>
                    <th className="text-right text-caption text-ink-mute font-medium px-3 py-2.5">Puntaje</th>
                    <th className="text-right text-caption text-ink-mute font-medium px-3 py-2.5">%</th>
                    <th className="text-right text-caption text-ink-mute font-medium px-5 py-2.5">Fecha</th>
                    <th className="text-right text-caption text-ink-mute font-medium px-5 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => {
                    const passing = quiz?.passing_score != null && a.score != null && a.max_score
                      ? (a.score / a.max_score) * 100 >= quiz.passing_score
                      : null;

                    return (
                      <tr
                        key={a.id}
                        className="border-b border-[rgba(0,0,0,0.04)] last:border-0 hover:bg-surface-alt/50 transition-colors"
                      >
                        <td className="px-5 py-3 text-ink font-medium">
                          {studentName(a.student)}
                        </td>
                        <td className="px-3 py-3 text-ink-soft text-mono">{a.student.email}</td>
                        <td className="px-3 py-3 text-ink-mute text-right">#{a.attempt_number}</td>
                        <td className="px-3 py-3 text-right">
                          <span className="text-ink font-medium">
                            {a.score ?? "—"}/{a.max_score ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          {passing !== null ? (
                            <span className={`text-mono font-medium ${passing ? "text-bosque" : "text-borgona"}`}>
                              {pct(a.score, a.max_score)}
                            </span>
                          ) : (
                            <span className="text-ink-soft">{pct(a.score, a.max_score)}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-ink-mute text-right text-mono">
                          {formatDate(a.submitted_at)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/dashboard/clases/${classId}/intentos/${a.id}`}
                            className="text-caption text-indigo hover:text-indigo/70 transition-colors"
                          >
                            Ver →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
