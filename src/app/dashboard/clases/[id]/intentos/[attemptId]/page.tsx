import { notFound } from "next/navigation";
import Link from "next/link";
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

export default async function AttemptDetailPage({ params }: Props) {
  const { id: classId, attemptId } = await params;
  const supabase = await createClient();

  const cls = await classService(supabase).getById(classId);
  if (!cls) notFound();

  const svc = createServiceClient();
  const aRepo = attemptRepo(svc);

  const attempt = await aRepo.findById(attemptId);
  if (!attempt) notFound();

  const [questions, answers] = await Promise.all([
    aRepo.listQuestions(attemptId),
    aRepo.listAnswers(attemptId),
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
          className="text-caption text-ink-mute hover:text-ink transition-colors"
        >
          ← Intentos
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
              ? new Date(attempt.submitted_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })
              : "En progreso"}
          </p>
          {pendingManual && (
            <p className="text-mono text-ambar mt-1">Pendiente calificación manual</p>
          )}
        </div>
      </div>

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
