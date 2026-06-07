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
  searchParams: Promise<{ quiz?: string }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function IntentosPage({ params, searchParams }: Props) {
  const { id: classId } = await params;
  const { quiz: selectedQuizId } = await searchParams;

  const supabase = await createClient();
  const cls = await classService(supabase).getById(classId);
  if (!cls) notFound();

  const svc = createServiceClient();

  // ── Carga liviana: lista de quizzes con conteos ──────────────────────────────

  const modules = await moduleRepo(supabase).listByClass(classId);
  const contentsList = (
    await Promise.all(modules.map((m) => contentRepo(supabase).listByModule(m.id)))
  ).flat().filter((c) => c.type === "quiz");

  // Cargar quizzes en paralelo
  const quizMeta = (
    await Promise.all(
      contentsList.map(async (c) => {
        const quiz = await quizRepo(svc).findByContentId(c.id);
        if (!quiz) return null;
        const mod = modules.find((m) => m.id === c.module_id);
        return { quiz, content: c, mod };
      })
    )
  ).filter(Boolean) as { quiz: NonNullable<Awaited<ReturnType<ReturnType<typeof quizRepo>["findByContentId"]>>>; content: typeof contentsList[0]; mod: typeof modules[0] | undefined }[];

  // Conteo de intentos y pendientes por quiz (una query por quiz, pero liviana)
  const quizStats = await Promise.all(
    quizMeta.map(async ({ quiz }) => {
      const [totalCount, pendingCount] = await Promise.all([
        svc.from("attempts")
          .select("id", { count: "exact", head: true })
          .eq("quiz_id", quiz.id)
          .in("status", ["submitted", "graded"]),
        svc.from("answers")
          .select("attempt_id", { count: "exact", head: true })
          .is("is_correct", null)
          .is("points_awarded", null)
          .in(
            "attempt_id",
            // subquery via nestedQuery isn't possible directly; use a join approach
            // We'll count distinct attempts with pending answers
            await svc
              .from("attempts")
              .select("id")
              .eq("quiz_id", quiz.id)
              .in("status", ["submitted", "graded"])
              .then((r) => (r.data ?? []).map((a) => a.id))
          ),
      ]);
      return {
        quizId: quiz.id,
        total: totalCount.count ?? 0,
        pendingAnswers: pendingCount.count ?? 0,
      };
    })
  );

  // Calcular pending attempts (no answers) — cuántos intentos tienen al menos 1 respuesta pendiente
  // Simplificamos: si pendingAnswers > 0, el quiz tiene pendientes
  const statsMap = Object.fromEntries(
    quizStats.map((s) => [s.quizId, s])
  );

  const totalPendingQuizzes = quizStats.filter((s) => s.pendingAnswers > 0).length;

  // ── Vista de overview (sin quiz seleccionado) ────────────────────────────────

  if (!selectedQuizId) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-eyebrow text-ink-mute mb-1">Clase</p>
          <h1 className="text-h2 text-ink mb-1">Intentos</h1>
          {totalPendingQuizzes > 0 && (
            <p className="text-body text-ambar">
              {totalPendingQuizzes} evaluacion{totalPendingQuizzes !== 1 ? "es" : ""} con respuestas pendientes de calificación
            </p>
          )}
        </div>

        {quizMeta.length === 0 ? (
          <p className="text-body text-ink-soft">No hay evaluaciones en esta clase todavía.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quizMeta.map(({ quiz, content, mod }) => {
              const stats = statsMap[quiz.id];
              const hasPending = (stats?.pendingAnswers ?? 0) > 0;
              return (
                <Link
                  key={quiz.id}
                  href={`/dashboard/clases/${classId}/intentos?quiz=${quiz.id}`}
                  className="group block bg-surface border-subtle rounded-[12px] p-5 hover:border-indigo/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-caption text-ink-mute mb-0.5 truncate">{mod?.title ?? "Módulo"}</p>
                      <p className="text-body text-ink font-medium truncate">{content.title}</p>
                    </div>
                    {hasPending && (
                      <span className="shrink-0 text-mono text-[11px] px-2 py-0.5 rounded-full bg-ambar/15 text-ambar font-medium">
                        Pendiente
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[22px] font-black text-ink leading-none">{stats?.total ?? 0}</p>
                      <p className="text-caption text-ink-mute mt-0.5">intento{stats?.total !== 1 ? "s" : ""}</p>
                    </div>
                    {hasPending && (
                      <div>
                        <p className="text-[22px] font-black text-ambar leading-none">{stats?.pendingAnswers}</p>
                        <p className="text-caption text-ink-mute mt-0.5">respuesta{stats?.pendingAnswers !== 1 ? "s" : ""} por calificar</p>
                      </div>
                    )}
                    <span className="ml-auto text-caption text-indigo group-hover:translate-x-0.5 transition-transform">
                      Ver →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Vista de quiz específico (con ?quiz=id) ───────────────────────────────────

  const selectedMeta = quizMeta.find((m) => m.quiz.id === selectedQuizId);
  if (!selectedMeta) notFound();

  const { quiz: selectedQuiz, content: selectedContent, mod: selectedMod } = selectedMeta;

  // Cargar intentos del quiz seleccionado (carga pesada, solo para este quiz)
  const attempts = await attemptRepo(svc).listByQuiz(selectedQuizId);

  // Detectar intentos pendientes de calificación manual
  const attemptIds = attempts.map((a) => a.id);
  let pendingSet = new Set<string>();
  if (attemptIds.length > 0) {
    const { data: pendingAnswers } = await svc
      .from("answers")
      .select("attempt_id")
      .in("attempt_id", attemptIds)
      .is("is_correct", null)
      .is("points_awarded", null);
    pendingSet = new Set((pendingAnswers ?? []).map((a: { attempt_id: string }) => a.attempt_id));
  }

  const pendingCount = pendingSet.size;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/clases/${classId}/intentos`}
          className="text-caption text-ink-mute hover:text-ink transition-colors"
        >
          ← Todas las evaluaciones
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <p className="text-caption text-ink-mute mb-0.5">{selectedMod?.title ?? "Módulo"}</p>
            <h1 className="text-h2 text-ink">{selectedContent.title}</h1>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[28px] font-black text-ink leading-none">{attempts.length}</p>
            <p className="text-caption text-ink-mute">intento{attempts.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      </div>

      {/* Tabs de otros quizzes */}
      {quizMeta.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {quizMeta.map(({ quiz, content }) => {
            const isActive = quiz.id === selectedQuizId;
            const hasPending = (statsMap[quiz.id]?.pendingAnswers ?? 0) > 0;
            return (
              <Link
                key={quiz.id}
                href={`/dashboard/clases/${classId}/intentos?quiz=${quiz.id}`}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-caption font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-ink text-surface"
                    : "bg-surface-alt text-ink-soft hover:text-ink"
                }`}
              >
                {content.title}
                {hasPending && (
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-ambar" : "bg-ambar"}`} />
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Banner de pendientes */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-[10px] bg-ambar/8 border border-ambar/25">
          <span className="text-ambar">⚠</span>
          <p className="text-body text-ink">
            <span className="font-medium">{pendingCount}</span> intento{pendingCount !== 1 ? "s" : ""} con respuestas de calificación manual pendiente
          </p>
        </div>
      )}

      {/* Tabla de intentos */}
      {attempts.length === 0 ? (
        <div className="bg-surface border-subtle rounded-[12px] px-5 py-10 text-center">
          <p className="text-body text-ink-soft">Ningún estudiante ha presentado esta evaluación todavía.</p>
        </div>
      ) : (
        <div className="bg-surface rounded-[12px] border-subtle overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-body">
              <thead>
                <tr className="border-b border-[rgba(0,0,0,0.06)] bg-surface-alt/50">
                  <th className="text-left text-caption text-ink-mute font-medium px-5 py-3">Estudiante</th>
                  <th className="text-left text-caption text-ink-mute font-medium px-3 py-3 hidden sm:table-cell">Correo</th>
                  <th className="text-right text-caption text-ink-mute font-medium px-3 py-3">N°</th>
                  <th className="text-right text-caption text-ink-mute font-medium px-3 py-3">Puntaje</th>
                  <th className="text-right text-caption text-ink-mute font-medium px-3 py-3">%</th>
                  <th className="text-right text-caption text-ink-mute font-medium px-5 py-3 hidden md:table-cell">Fecha</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => {
                  const isPending = pendingSet.has(a.id);
                  const passing =
                    selectedQuiz.passing_score != null && a.score != null && a.max_score
                      ? (a.score / a.max_score) * 100 >= selectedQuiz.passing_score
                      : null;

                  return (
                    <tr
                      key={a.id}
                      className={`border-b border-[rgba(0,0,0,0.04)] last:border-0 transition-colors ${
                        isPending ? "bg-ambar/3 hover:bg-ambar/6" : "hover:bg-surface-alt/40"
                      }`}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-ink font-medium">{studentName(a.student)}</span>
                          {isPending && (
                            <span className="text-mono text-[10px] px-1.5 py-0.5 rounded-[4px] bg-ambar/15 text-ambar leading-none whitespace-nowrap">
                              Por calificar
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-ink-soft text-mono hidden sm:table-cell">{a.student.email}</td>
                      <td className="px-3 py-3 text-ink-mute text-right text-mono">#{a.attempt_number}</td>
                      <td className="px-3 py-3 text-right">
                        <span className="text-ink font-medium tabular-nums">
                          {a.score ?? "—"}/{a.max_score ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <span className={`text-mono font-medium tabular-nums ${
                          passing === true ? "text-bosque" :
                          passing === false ? "text-borgona" :
                          "text-ink-soft"
                        }`}>
                          {pct(a.score, a.max_score)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-mute text-right text-mono hidden md:table-cell">
                        {formatDate(a.submitted_at)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/dashboard/clases/${classId}/intentos/${a.id}`}
                          className={`text-caption font-medium transition-colors ${
                            isPending ? "text-ambar hover:text-ambar/70" : "text-indigo hover:text-indigo/70"
                          }`}
                        >
                          {isPending ? "Calificar →" : "Ver →"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
