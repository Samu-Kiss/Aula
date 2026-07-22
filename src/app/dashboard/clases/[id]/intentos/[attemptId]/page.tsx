import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDateTime } from "@/lib/dates";
import { ArrowLeft, Flag } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { attemptRepo } from "@/server/repositories/attemptRepo";
import { quizRepo } from "@/server/repositories/quizRepo";
import { GradeAnswerForm } from "./GradeAnswerForm";

interface Props {
  params: Promise<{ id: string; attemptId: string }>;
}

function studentName(s: { first_name: string | null; last_name: string | null; display_name: string | null; email: string }) {
  if (s.display_name) return s.display_name;
  if (s.first_name || s.last_name) return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
  return s.email;
}

function pct(score: number | null, max: number | null) {
  if (score == null || !max) return null;
  return Math.round((score / max) * 100);
}

export const metadata = { title: "Revisión de intento" };

export default async function AttemptDetailPage({ params }: Props) {
  const { id: classId, attemptId } = await params;
  const supabase = await createClient();

  // `getById` usa RLS, que también devuelve clases publicadas de OTROS profesores
  // (política de lectura pública). Verificar propiedad explícitamente para que un
  // profesor no pueda abrir la clase de otro.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const cls = await classService(supabase).getById(classId);
  if (!cls || cls.professor_id !== user.id) notFound();

  const svc = createServiceClient();
  const aRepo = attemptRepo(svc);

  const attempt = await aRepo.findById(attemptId);
  if (!attempt) notFound();

  // El intento se carga con service client (ignora RLS); hay que confirmar que
  // pertenece a un quiz de ESTA clase. Sin esto, cualquier profesor podría leer
  // las respuestas y datos personales de un alumno de otra clase por attemptId.
  const attemptClassId = attempt.quiz_id
    ? await (async () => {
        const { data: q } = await svc.from("quizzes").select("content_id").eq("id", attempt.quiz_id!).maybeSingle();
        if (!q?.content_id) return null;
        const { data: c } = await svc.from("contents").select("module_id").eq("id", q.content_id).maybeSingle();
        if (!c?.module_id) return null;
        const { data: m } = await svc.from("modules").select("class_id").eq("id", c.module_id).maybeSingle();
        return m?.class_id ?? null;
      })()
    : null;
  if (attemptClassId !== classId) notFound();

  const [questions, answers, events] = await Promise.all([
    aRepo.listQuestions(attemptId),
    aRepo.listAnswers(attemptId),
    aRepo.listEventsByAttempt(attemptId),
  ]);

  const quiz = attempt.quiz_id ? await quizRepo(svc).findById(attempt.quiz_id) : null;
  const answerMap = Object.fromEntries(answers.map((a) => [a.question_id, a]));

  // Cargar datos del estudiante
  const { data: student } = await svc
    .from("students")
    .select("id, email, first_name, last_name, display_name")
    .eq("id", attempt.student_id)
    .single();

  const percentage = pct(attempt.score, attempt.max_score);
  const passing = quiz?.passing_score != null && percentage != null
    ? percentage >= quiz.passing_score
    : null;

  const pendingManual = questions.some((q) => {
    if (q.type !== "short_answer") return false;
    const snap = q.body_snapshot;
    if (snap.auto_grade !== false) return false;
    const ans = answerMap[q.id];
    return ans && ans.points_awarded == null;
  });

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href={`/dashboard/clases/${classId}/intentos`}
          className="text-caption text-ink-mute hover:text-ink transition-colors inline-flex items-center gap-1"
        >
          <ArrowLeft size={13} /> Intentos
        </Link>
        <h1 className="text-h2 text-ink mt-2 mb-1">
          {student ? studentName(student) : "Estudiante"}
        </h1>
        {student && <p className="text-mono text-ink-mute">{student.email}</p>}
      </div>

      {/* Score card */}
      <div className="bg-surface rounded-[12px] border-subtle p-5 flex items-center gap-6">
        <div className="text-center">
          <p className="text-[36px] font-black text-ink leading-none">
            {attempt.score ?? "—"}
          </p>
          <p className="text-caption text-ink-mute mt-1">de {attempt.max_score ?? "—"} pts</p>
        </div>
        <div className="w-px h-12 bg-[rgba(0,0,0,0.08)]" />
        <div className="text-center">
          <p className={`text-[36px] font-black leading-none ${
            passing === true ? "text-bosque" :
            passing === false ? "text-borgona" :
            "text-ink"
          }`}>
            {percentage != null ? `${percentage}%` : "—"}
          </p>
          <p className="text-caption text-ink-mute mt-1">
            {passing === true ? "Aprobado" : passing === false ? "Reprobado" : "Puntaje"}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-caption text-ink-mute mb-0.5">Intento #{attempt.attempt_number}</p>
          <p className="text-mono text-ink-soft">
            {attempt.submitted_at
              ? formatDateTime(attempt.submitted_at)
              : "En progreso"}
          </p>
          {pendingManual && (
            <p className="text-mono text-ambar mt-1">Pendiente calificación manual</p>
          )}
        </div>
      </div>

      {/* Anti-cheating events */}
      {events.length > 0 && (
        <div className="bg-surface rounded-[12px] border border-subtle p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-caption font-medium text-ink">Actividad durante el intento</p>
            <span className="text-mono text-ink-mute">{events.length} evento{events.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Summary counts */}
          <div className="flex flex-wrap gap-2">
            {(["tab_blur", "paste", "copy", "duplicate_instance_attempt", "reconnect", "time_expired"] as const)
              .map((type) => {
                const count = events.filter((e) => e.type === type).length;
                if (count === 0) return null;
                const isFlag = ["tab_blur", "paste", "copy", "duplicate_instance_attempt"].includes(type);
                return (
                  <span
                    key={type}
                    className={`flex items-center gap-1.5 text-caption px-2.5 py-1 rounded-[6px] ${
                      isFlag
                        ? "bg-ambar/10 text-ambar font-medium"
                        : "bg-surface-alt text-ink-soft"
                    }`}
                  >
                    {isFlag && <Flag size={12} className="shrink-0" />}
                    {({
                      tab_blur: "Cambio de pestaña",
                      paste: "Pegar",
                      copy: "Copiar",
                      duplicate_instance_attempt: "Otra pestaña",
                      reconnect: "Reconexión",
                      time_expired: "Tiempo agotado",
                    } as Record<string, string>)[type]}
                    <span className="font-bold">{count}×</span>
                  </span>
                );
              })}
          </div>

          {/* Timeline */}
          <div className="border border-subtle rounded-[8px] overflow-hidden">
            <table className="w-full text-mono text-[12px]">
              <thead>
                <tr className="bg-surface-alt border-b border-hairline">
                  <th className="text-left text-ink-mute font-medium px-3 py-2">Hora</th>
                  <th className="text-left text-ink-mute font-medium px-3 py-2">Evento</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => {
                  const isFlag = ["tab_blur", "paste", "copy", "duplicate_instance_attempt"].includes(ev.type);
                  return (
                    <tr key={ev.id} className={`border-b border-[rgba(0,0,0,0.04)] last:border-0 ${isFlag ? "bg-ambar/3" : ""}`}>
                      <td className="px-3 py-1.5 text-ink-mute whitespace-nowrap">
                        {new Date(ev.occurred_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className={`px-3 py-1.5 ${isFlag ? "text-ambar font-medium" : "text-ink-soft"}`}>
                        <span className="inline-flex items-center gap-1">
                          {isFlag && <Flag size={11} />}
                          {({
                            tab_blur: "Cambió de pestaña",
                            tab_focus: "Regresó a la pestaña",
                            paste: "Pegó texto",
                            copy: "Copió texto",
                            duplicate_instance_attempt: "Abrió otra pestaña con el quiz",
                            time_expired: "Tiempo agotado",
                            reconnect: "Se reconectó",
                            submit_blocked: "Envío bloqueado",
                          } as Record<string, string>)[ev.type] ?? ev.type}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Questions + answers */}
      <div className="space-y-4">
        {questions.map((q, i) => {
          const answer = answerMap[q.id];
          const snap = q.body_snapshot;
          const isManual = q.type === "short_answer" && snap.auto_grade === false;

          return (
            <div key={q.id} className="bg-surface rounded-[12px] border-subtle p-5 space-y-3">
              {/* Question header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-caption text-ink-mute mb-1">
                    Pregunta {i + 1} · {q.points} pt{q.points !== 1 ? "s" : ""}
                  </p>
                  <p className="text-body text-ink">{q.prompt}</p>
                </div>
                {answer && (
                  <span className={`shrink-0 text-mono px-2 py-0.5 rounded-[4px] text-[11px] ${
                    answer.is_correct === true
                      ? "bg-bosque/10 text-bosque"
                      : answer.is_correct === false
                      ? "bg-borgona/10 text-borgona"
                      : "bg-surface-alt text-ink-mute"
                  }`}>
                    {answer.is_correct === true
                      ? `✓ ${answer.points_awarded ?? 0}/${q.points}`
                      : answer.is_correct === false
                      ? `✗ ${answer.points_awarded ?? 0}/${q.points}`
                      : "Sin calificar"}
                  </span>
                )}
              </div>

              {/* Answer display */}
              {!answer ? (
                <p className="text-mono text-ink-mute">Sin respuesta</p>
              ) : q.type === "single_choice" || q.type === "multi_choice" ? (
                <ChoiceAnswerView question={q} answer={answer} />
              ) : q.type === "true_false" ? (
                <TrueFalseAnswerView question={q} answer={answer} />
              ) : q.type === "short_answer" ? (
                <div className="space-y-3">
                  <div className="bg-surface-alt rounded-[8px] px-4 py-3">
                    <p className="text-body text-ink whitespace-pre-wrap">
                      {(answer.response.text as string)
                        ? (answer.response.text as string)
                        : <em className="text-ink-mute">Sin respuesta</em>}
                    </p>
                  </div>
                  {!isManual && Array.isArray(snap.accepted_answers) && (
                    <div>
                      <p className="text-caption text-ink-mute mb-1">Respuestas aceptadas:</p>
                      <p className="text-mono text-ink-soft">
                        {(snap.accepted_answers as string[]).join(" · ")}
                      </p>
                    </div>
                  )}
                  {isManual && answer && (
                    <GradeAnswerForm
                      answerId={answer.id}
                      attemptId={attemptId}
                      currentPoints={answer.points_awarded}
                      maxPoints={q.points}
                      currentFeedback={answer.feedback}
                      classId={classId}
                    />
                  )}
                </div>
              ) : q.type === "map_pin" ? (
                <MapPinAnswerView question={q} answer={answer} />
              ) : null}

              {/* Feedback (if set) */}
              {answer?.feedback && !isManual && (
                <p className="text-caption text-ink-soft italic">{answer.feedback}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChoiceAnswerView({
  question,
  answer,
}: {
  question: { body_snapshot: Record<string, unknown>; type: string };
  answer: { response: Record<string, unknown>; is_correct: boolean | null };
}) {
  const options = (question.body_snapshot.options as { id: string; text: string; is_correct?: boolean }[]) ?? [];
  const isMulti = question.type === "multi_choice";
  const selectedId = answer.response.selected_id as string | undefined;
  const selectedIds = (answer.response.selected_ids as string[]) ?? [];

  return (
    <div className="space-y-1.5">
      {options.map((opt) => {
        const isSelected = isMulti ? selectedIds.includes(opt.id) : selectedId === opt.id;
        const isCorrect = opt.is_correct === true;
        return (
          <div
            key={opt.id}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-body ${
              isSelected && isCorrect
                ? "bg-bosque/8 border border-bosque/30 text-ink"
                : isSelected && !isCorrect
                ? "bg-borgona/8 border border-borgona/30 text-ink"
                : isCorrect
                ? "bg-bosque/4 border border-bosque/20 text-ink-soft"
                : "bg-surface-alt border border-transparent text-ink-mute"
            }`}
          >
            <span className={`shrink-0 text-mono text-[11px] ${
              isSelected && isCorrect ? "text-bosque" :
              isSelected ? "text-borgona" :
              isCorrect ? "text-bosque" : "text-ink-mute"
            }`}>
              {isSelected && isCorrect ? "✓" : isSelected ? "✗" : isCorrect ? "✓" : " "}
            </span>
            <span>{opt.text}</span>
          </div>
        );
      })}
    </div>
  );
}

function MapPinAnswerView({
  question,
  answer,
}: {
  question: { body_snapshot: Record<string, unknown> };
  answer: { response: Record<string, unknown> };
}) {
  const markers =
    (question.body_snapshot.markers as { id: string; label?: string }[]) ?? [];
  const correctId = question.body_snapshot.correct_marker_id as string | undefined;
  const selectedId = answer.response.marker_id as string | undefined;
  const label = (m: { id: string; label?: string }, idx: number) =>
    m.label || `Marcador ${idx + 1}`;

  return (
    <div className="space-y-1.5">
      {markers.map((m, idx) => {
        const isSelected = m.id === selectedId;
        const isCorrect = m.id === correctId;
        return (
          <div
            key={m.id}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-[8px] text-body ${
              isSelected && isCorrect
                ? "bg-bosque/8 border border-bosque/30 text-ink"
                : isSelected && !isCorrect
                ? "bg-borgona/8 border border-borgona/30 text-ink"
                : isCorrect
                ? "bg-bosque/4 border border-bosque/20 text-ink-soft"
                : "bg-surface-alt border border-transparent text-ink-mute"
            }`}
          >
            <span className={`shrink-0 text-mono text-[11px] ${
              isSelected && isCorrect ? "text-bosque" :
              isSelected ? "text-borgona" :
              isCorrect ? "text-bosque" : "text-ink-mute"
            }`}>
              {isSelected && isCorrect ? "✓" : isSelected ? "✗" : isCorrect ? "✓" : " "}
            </span>
            <span>{label(m, idx)}</span>
            {isSelected && (
              <span className="ml-auto text-mono text-[11px] text-ink-mute">elegido</span>
            )}
          </div>
        );
      })}
      {!selectedId && <p className="text-mono text-ink-mute">Sin marcador elegido</p>}
    </div>
  );
}

function TrueFalseAnswerView({
  question,
  answer,
}: {
  question: { body_snapshot: Record<string, unknown> };
  answer: { response: Record<string, unknown>; is_correct: boolean | null };
}) {
  const correct = question.body_snapshot.correct as boolean;
  const given = answer.response.answer as boolean | undefined;

  return (
    <div className="flex gap-2">
      {([true, false] as const).map((v) => {
        const isSelected = given === v;
        const isCorrect = v === correct;
        return (
          <div
            key={String(v)}
            className={`flex-1 text-center py-2.5 rounded-[8px] text-body font-medium ${
              isSelected && isCorrect
                ? "bg-bosque/10 border border-bosque/30 text-bosque"
                : isSelected
                ? "bg-borgona/10 border border-borgona/30 text-borgona"
                : isCorrect
                ? "bg-bosque/5 border border-bosque/20 text-bosque"
                : "bg-surface-alt border border-transparent text-ink-mute"
            }`}
          >
            {v ? "Verdadero" : "Falso"}
          </div>
        );
      })}
    </div>
  );
}
