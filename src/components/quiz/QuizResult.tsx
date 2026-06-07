"use client";

import Link from "next/link";
import type { Attempt, AttemptQuestion, Answer, Quiz } from "@/lib/types/db";

interface Props {
  attempt: Attempt;
  quiz: Quiz;
  questions: AttemptQuestion[];
  answers: Answer[];
  contentUrl: string;
  student: { firstName: string; lastName: string; email: string };
}

function pct(score: number | null, max: number | null) {
  if (score == null || !max) return null;
  return Math.round((score / max) * 100);
}

export function QuizResult({ attempt, quiz, questions, answers, contentUrl, student }: Props) {
  const percentage = pct(attempt.score, attempt.max_score);
  const passing =
    quiz.passing_score != null && percentage != null
      ? percentage >= quiz.passing_score
      : null;

  const answerMap = Object.fromEntries(answers.map((a) => [a.question_id, a]));

  // Decide if we can show correct answers
  const now = new Date();
  const quizClosed =
    !quiz.is_available ||
    (quiz.closes_at ? new Date(quiz.closes_at) < now : false);
  const showAnswers =
    quiz.show_correct_answers === "after_submit" ||
    (quiz.show_correct_answers === "after_close" && quizClosed);

  return (
    <div className="space-y-6">
      {/* Score summary */}
      <div className={`rounded-[12px] p-6 flex items-center gap-6 ${
        passing === true ? "bg-bosque/8 border border-bosque/20" :
        passing === false ? "bg-borgona/8 border border-borgona/20" :
        "bg-surface-alt"
      }`}>
        <div className="text-center">
          <p className={`text-[42px] font-black leading-none ${
            passing === true ? "text-bosque" :
            passing === false ? "text-borgona" :
            "text-ink"
          }`}>
            {percentage != null ? `${percentage}%` : "—"}
          </p>
          <p className="text-caption text-ink-mute mt-1">
            {attempt.score ?? "—"} / {attempt.max_score ?? "—"} pts
          </p>
        </div>

        <div className="flex-1">
          {passing === true && (
            <>
              <p className="text-body text-bosque font-bold mb-0.5">¡Aprobaste! 🎉</p>
              <p className="text-caption text-ink-soft">
                Superaste el mínimo de {quiz.passing_score}%
              </p>
            </>
          )}
          {passing === false && (
            <>
              <p className="text-body text-borgona font-bold mb-0.5">No aprobaste</p>
              <p className="text-caption text-ink-soft">
                El mínimo requerido es {quiz.passing_score}%
              </p>
            </>
          )}
          {passing === null && (
            <p className="text-body text-ink font-medium">Evaluación entregada</p>
          )}
          <p className="text-mono text-ink-mute mt-2">
            {student.firstName} {student.lastName} · {student.email}
          </p>
        </div>
      </div>

      {/* Answer review */}
      {showAnswers && (
        <div className="space-y-4">
          <p className="text-caption text-ink-mute">Revisión de respuestas</p>
          {questions.map((q, i) => {
            const answer = answerMap[q.id];
            return (
              <div key={q.id} className="bg-surface rounded-[12px] border-subtle p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-body text-ink flex-1">
                    <span className="text-ink-mute text-caption mr-2">{i + 1}.</span>
                    {q.prompt}
                  </p>
                  {answer && (
                    <span className={`shrink-0 text-mono px-2 py-0.5 rounded-[4px] text-[11px] ${
                      answer.is_correct === true
                        ? "bg-bosque/10 text-bosque"
                        : answer.is_correct === false
                        ? "bg-borgona/10 text-borgona"
                        : "bg-surface-alt text-ink-mute"
                    }`}>
                      {answer.is_correct === true
                        ? `✓ +${answer.points_awarded ?? q.points}`
                        : answer.is_correct === false
                        ? `✗ 0`
                        : "—"}
                    </span>
                  )}
                </div>

                {/* Short answer: just show what they wrote + feedback */}
                {q.type === "short_answer" && (
                  <div className="space-y-2">
                    <div className="bg-surface-alt rounded-[8px] px-3 py-2 text-body text-ink">
                      {(answer?.response.text as string) || <em className="text-ink-mute">Sin respuesta</em>}
                    </div>
                    {answer?.feedback && (
                      <p className="text-caption text-ink-soft italic">
                        Retroalimentación: {answer.feedback}
                      </p>
                    )}
                  </div>
                )}

                {/* Choice questions */}
                {(q.type === "single_choice" || q.type === "multi_choice") && (() => {
                  const options = (q.body_snapshot.options as { id: string; text: string; is_correct?: boolean }[]) ?? [];
                  const isMulti = q.type === "multi_choice";
                  const selectedId = answer?.response.selected_id as string | undefined;
                  const selectedIds = (answer?.response.selected_ids as string[]) ?? [];
                  return (
                    <div className="space-y-1.5">
                      {options.map((opt) => {
                        const isSelected = isMulti ? selectedIds.includes(opt.id) : selectedId === opt.id;
                        const isCorrect = opt.is_correct === true;
                        if (!isSelected && !isCorrect) return null;
                        return (
                          <div key={opt.id} className={`flex items-center gap-2 px-3 py-2 rounded-[8px] text-body ${
                            isSelected && isCorrect ? "bg-bosque/8 text-bosque" :
                            isSelected ? "bg-borgona/8 text-borgona" :
                            "bg-bosque/4 text-ink-soft"
                          }`}>
                            <span className="text-[11px]">
                              {isSelected && isCorrect ? "✓ Tu respuesta (correcta)" :
                               isSelected ? "✗ Tu respuesta" :
                               "✓ Correcta"}
                            </span>
                            <span>— {opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* True/false */}
                {q.type === "true_false" && (() => {
                  const correct = q.body_snapshot.correct as boolean;
                  const given = answer?.response.answer as boolean | undefined;
                  return (
                    <div className="flex gap-2 text-body">
                      <span className={given === true ? (correct === true ? "text-bosque" : "text-borgona") : "text-ink-mute"}>
                        Verdadero {given === true ? (correct === true ? "✓" : "✗") : ""}
                      </span>
                      <span className="text-ink-mute">·</span>
                      <span className={given === false ? (correct === false ? "text-bosque" : "text-borgona") : "text-ink-mute"}>
                        Falso {given === false ? (correct === false ? "✓" : "✗") : ""}
                      </span>
                      {given !== correct && (
                        <span className="text-ink-mute ml-1">
                          (correcto: {correct ? "Verdadero" : "Falso"})
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {!showAnswers && quiz.show_correct_answers === "after_close" && !quizClosed && (
        <div className="bg-surface-alt rounded-[10px] p-4 text-center">
          <p className="text-body text-ink-soft">
            Las respuestas correctas se mostrarán cuando el período de la evaluación cierre.
          </p>
        </div>
      )}

      <Link
        href={contentUrl}
        className="inline-block px-5 py-2.5 bg-surface-alt rounded-[10px] text-caption text-ink-soft font-medium hover:text-ink transition-colors"
      >
        ← Volver a la evaluación
      </Link>
    </div>
  );
}
