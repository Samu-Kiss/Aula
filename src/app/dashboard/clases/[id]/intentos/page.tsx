import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, ChevronRight, Flag } from "lucide-react";
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

// Event types that count as "flag" alerts (suspicious behavior)
const FLAG_TYPES = new Set([
  "tab_blur",
  "paste",
  "copy",
  "duplicate_instance_attempt",
]);

const EVENT_LABELS: Record<string, string> = {
  tab_blur: "Cambio de pestaña",
  tab_focus: "Regreso a pestaña",
  paste: "Pegar texto",
  copy: "Copiar texto",
  duplicate_instance_attempt: "Otra pestaña detectada",
  time_expired: "Tiempo agotado",
  reconnect: "Reconexión",
  submit_blocked: "Envío bloqueado",
};

// ─── Page ────────────────────────────────────────────────────────────────────

export const metadata = { title: "Intentos" };

export default async function IntentosPage({ params, searchParams }: Props) {
  const { id: classId } = await params;
  const { quiz: selectedQuizId } = await searchParams;

  const supabase = await createClient();
  const cls = await classService(supabase).getById(classId);
  if (!cls) notFound();

  const svc = createServiceClient();

  // ── Lista de quizzes ───────────────────────────────────────────────────────

  const modules = await moduleRepo(supabase).listByClass(classId);
  const contentsList = (
    await Promise.all(modules.map((m) => contentRepo(supabase).listByModule(m.id)))
  ).flat().filter((c) => c.type === "quiz");

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

  const quizStats = await Promise.all(
    quizMeta.map(async ({ quiz }) => {
      const { count: total } = await svc
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", quiz.id)
        .in("status", ["submitted", "graded"]);
      return { quizId: quiz.id, total: total ?? 0 };
    })
  );
  const statsMap = Object.fromEntries(quizStats.map((s) => [s.quizId, s]));

  // ── Vista overview ─────────────────────────────────────────────────────────

  if (!selectedQuizId) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-eyebrow text-ink-mute mb-1">Clase</p>
          <h1 className="text-h2 text-ink mb-1">Intentos</h1>
        </div>

        {quizMeta.length === 0 ? (
          <p className="text-body text-ink-soft">No hay evaluaciones en esta clase todavía.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quizMeta.map(({ quiz, content, mod }) => {
              const stats = statsMap[quiz.id];
              return (
                <Link
                  key={quiz.id}
                  href={`/dashboard/clases/${classId}/intentos?quiz=${quiz.id}`}
                  className="group block bg-surface border border-subtle rounded-[12px] p-5 hover:border-indigo/30 hover:shadow-sm transition-all"
                >
                  <div className="mb-3">
                    <p className="text-caption text-ink-mute mb-0.5 truncate">{mod?.title ?? "Módulo"}</p>
                    <p className="text-body text-ink font-medium truncate">{content.title}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[22px] font-black text-ink leading-none">{stats?.total ?? 0}</p>
                      <p className="text-caption text-ink-mute mt-0.5">intento{stats?.total !== 1 ? "s" : ""}</p>
                    </div>
                    <span className="ml-auto text-caption text-indigo flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Ver <ChevronRight size={13} />
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

  // ── Vista de quiz específico ───────────────────────────────────────────────

  const selectedMeta = quizMeta.find((m) => m.quiz.id === selectedQuizId);
  if (!selectedMeta) notFound();
  const { quiz: selectedQuiz, content: selectedContent, mod: selectedMod } = selectedMeta;

  const aRepo = attemptRepo(svc);
  const attempts = await aRepo.listByQuiz(selectedQuizId);
  const attemptIds = attempts.map((a) => a.id);

  // Bulk-load pending answers and anti-cheating events
  let pendingSet = new Set<string>();
  let allEvents: { attempt_id: string; type: string; occurred_at: string }[] = [];

  if (attemptIds.length > 0) {
    const [{ data: pendingAnswers }, events] = await Promise.all([
      svc
        .from("answers")
        .select("attempt_id")
        .in("attempt_id", attemptIds)
        .is("is_correct", null)
        .is("points_awarded", null),
      aRepo.listEventsByAttemptIds(attemptIds),
    ]);
    pendingSet = new Set((pendingAnswers ?? []).map((a: { attempt_id: string }) => a.attempt_id));
    allEvents = events;
  }

  // Build event counts per attempt
  const eventCountMap = new Map<string, Map<string, number>>();
  for (const ev of allEvents) {
    if (!eventCountMap.has(ev.attempt_id)) eventCountMap.set(ev.attempt_id, new Map());
    const m = eventCountMap.get(ev.attempt_id)!;
    m.set(ev.type, (m.get(ev.type) ?? 0) + 1);
  }

  function flagCount(attemptId: string) {
    const m = eventCountMap.get(attemptId);
    if (!m) return 0;
    let n = 0;
    for (const [type, count] of m) {
      if (FLAG_TYPES.has(type)) n += count;
    }
    return n;
  }

  // Group attempts by student
  const studentMap = new Map<string, {
    student: typeof attempts[0]["student"];
    attempts: typeof attempts;
  }>();
  for (const a of attempts) {
    const sid = a.student.id;
    if (!studentMap.has(sid)) studentMap.set(sid, { student: a.student, attempts: [] });
    studentMap.get(sid)!.attempts.push(a);
  }
  const groups = [...studentMap.values()];
  // Sort each student's attempts by attempt_number asc
  for (const g of groups) {
    g.attempts.sort((a, b) => a.attempt_number - b.attempt_number);
  }
  // Sort groups by latest attempt desc
  groups.sort((a, b) => {
    const la = a.attempts[a.attempts.length - 1]?.submitted_at ?? "";
    const lb = b.attempts[b.attempts.length - 1]?.submitted_at ?? "";
    return lb.localeCompare(la);
  });

  const pendingCount = pendingSet.size;
  const totalStudents = groups.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/clases/${classId}/intentos`}
          className="text-caption text-ink-mute hover:text-ink transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft size={13} /> Todas las evaluaciones
        </Link>
        <div className="flex items-start justify-between gap-4 mt-2">
          <div>
            <p className="text-caption text-ink-mute mb-0.5">{selectedMod?.title ?? "Módulo"}</p>
            <h1 className="text-h2 text-ink">{selectedContent.title}</h1>
          </div>
          <div className="text-right shrink-0 space-y-0.5">
            <div>
              <span className="text-[28px] font-black text-ink leading-none">{totalStudents}</span>
              <span className="text-caption text-ink-mute ml-1">estudiante{totalStudents !== 1 ? "s" : ""}</span>
            </div>
            <div>
              <span className="text-body font-medium text-ink">{attempts.length}</span>
              <span className="text-caption text-ink-mute ml-1">intento{attempts.length !== 1 ? "s" : ""} total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs de otros quizzes */}
      {quizMeta.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {quizMeta.map(({ quiz, content }) => {
            const isActive = quiz.id === selectedQuizId;
            return (
              <Link
                key={quiz.id}
                href={`/dashboard/clases/${classId}/intentos?quiz=${quiz.id}`}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-caption font-medium transition-colors whitespace-nowrap ${
                  isActive ? "bg-ink text-surface" : "bg-surface-alt text-ink-soft hover:text-ink"
                }`}
              >
                {content.title}
              </Link>
            );
          })}
        </div>
      )}

      {/* Pending banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-[10px] bg-ambar/8 border border-ambar/25">
          <AlertTriangle size={16} className="text-ambar shrink-0" />
          <p className="text-body text-ink">
            <span className="font-medium">{pendingCount}</span> intento{pendingCount !== 1 ? "s" : ""} con respuestas manuales pendientes
          </p>
        </div>
      )}

      {/* Grouped attempts by student */}
      {groups.length === 0 ? (
        <div className="bg-surface border border-subtle rounded-[12px] px-5 py-10 text-center">
          <p className="text-body text-ink-soft">Ningún estudiante ha presentado esta evaluación todavía.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ student, attempts: studentAttempts }) => {
            const totalFlags = studentAttempts.reduce((s, a) => s + flagCount(a.id), 0);
            const hasPending = studentAttempts.some((a) => pendingSet.has(a.id));
            const scores = studentAttempts
              .map((a) => (a.score != null && a.max_score ? (a.score / a.max_score) * 100 : null))
              .filter((s): s is number => s != null);
            const bestScore = scores.length ? Math.max(...scores) : null;
            const passing =
              selectedQuiz.passing_score != null && bestScore != null
                ? bestScore >= selectedQuiz.passing_score
                : null;

            return (
              <div key={student.id} className="border border-subtle rounded-[12px] bg-surface overflow-hidden">
                {/* Student header row */}
                <div className="flex items-center gap-4 px-5 py-3.5 bg-surface-alt/50 border-b border-[rgba(0,0,0,0.05)]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-body font-medium text-ink">{studentName(student)}</span>
                      <span className="text-mono text-ink-soft">{student.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
                    {/* Best score */}
                    {bestScore != null && (
                      <span className={`text-caption font-bold px-2 py-0.5 rounded-[6px] ${
                        passing === true ? "bg-bosque/10 text-bosque" :
                        passing === false ? "bg-borgona/10 text-borgona" :
                        "bg-surface text-ink border border-subtle"
                      }`}>
                        Mejor: {Math.round(bestScore)}%
                      </span>
                    )}
                    {/* Flag indicator */}
                    {totalFlags > 0 && (
                      <span className="flex items-center gap-1 text-caption font-medium text-ambar bg-ambar/8 px-2 py-0.5 rounded-[6px]"
                        title={`${totalFlags} evento${totalFlags !== 1 ? "s" : ""} de actividad sospechosa`}
                      >
                        <Flag size={12} /> {totalFlags}
                      </span>
                    )}
                    {hasPending && (
                      <span className="text-caption text-ambar bg-ambar/8 px-2 py-0.5 rounded-[6px]">
                        Por calificar
                      </span>
                    )}
                    {/* Attempt count badge */}
                    {studentAttempts.length > 1 && (
                      <span className="text-mono text-ink-mute">
                        {studentAttempts.length} intentos
                      </span>
                    )}
                  </div>
                </div>

                {/* Individual attempts */}
                {studentAttempts.map((a, idx) => {
                  const flags = flagCount(a.id);
                  const isPending = pendingSet.has(a.id);
                  const scorePct = a.score != null && a.max_score
                    ? Math.round((a.score / a.max_score) * 100)
                    : null;
                  const passes =
                    selectedQuiz.passing_score != null && scorePct != null
                      ? scorePct >= selectedQuiz.passing_score
                      : null;

                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-4 px-5 py-2.5 border-b border-[rgba(0,0,0,0.04)] last:border-0 text-body ${
                        isPending ? "bg-ambar/3" : idx % 2 === 0 ? "" : "bg-surface-alt/20"
                      }`}
                    >
                      {/* Attempt number */}
                      <span className="text-mono text-ink-mute w-6 shrink-0 text-center">#{a.attempt_number}</span>

                      {/* Score */}
                      <span className="tabular-nums text-ink">
                        {a.score ?? "—"}/{a.max_score ?? "—"}
                      </span>
                      <span className={`text-mono font-medium tabular-nums w-12 ${
                        passes === true ? "text-bosque" :
                        passes === false ? "text-borgona" :
                        "text-ink-soft"
                      }`}>
                        {pct(a.score, a.max_score)}
                      </span>

                      {/* Date */}
                      <span className="text-mono text-ink-mute flex-1 hidden sm:block">
                        {formatDate(a.submitted_at)}
                      </span>

                      {/* Flags */}
                      {flags > 0 && (
                        <span className="text-caption text-ambar shrink-0 flex items-center gap-1" title={`${flags} evento${flags !== 1 ? "s" : ""} de actividad sospechosa`}>
                          <Flag size={12} /> {flags}
                        </span>
                      )}

                      {/* Actions */}
                      <Link
                        href={`/dashboard/clases/${classId}/intentos/${a.id}`}
                        className={`shrink-0 text-caption font-medium transition-colors ${
                          isPending ? "text-ambar hover:text-ambar/70" : "text-indigo hover:text-indigo/70"
                        }`}
                      >
                        <span className="inline-flex items-center gap-0.5">{isPending ? "Calificar" : "Ver"} <ChevronRight size={13} /></span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Legend for flags */}
      {allEvents.length > 0 && (
        <p className="text-mono text-ink-mute pt-2 inline-flex items-center gap-1">
          <Flag size={12} /> = Eventos de actividad sospechosa: cambio de pestaña, copiar/pegar, o intento desde otra pestaña.
        </p>
      )}
    </div>
  );
}
