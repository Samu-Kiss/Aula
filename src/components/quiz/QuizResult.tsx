"use client";

import { lazy, Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import type { Attempt, AttemptQuestion, Answer, Quiz } from "@/lib/types/db";

const MapPinQuestion = lazy(() =>
  import("./MapPinQuestion").then((m) => ({ default: m.MapPinQuestion }))
);

interface Props {
  attempt: Attempt;
  quiz: Quiz;
  questions: AttemptQuestion[];
  answers: Answer[];
  contentUrl: string;
  student: { firstName: string; lastName: string; email: string };
}

// ─── Per-type answer review components ───────────────────────────────────────

function ChoiceResult({
  options,
  selectedId,
  selectedIds,
  isMulti,
  showAnswer,
  answerIsCorrect,
}: {
  options: { id: string; text: string; is_correct?: boolean }[];
  selectedId?: string;
  selectedIds?: string[];
  isMulti: boolean;
  showAnswer: boolean;
  answerIsCorrect?: boolean | null;
}) {
  return (
    <div className="space-y-1.5">
      {options.map((opt) => {
        const isSelected = isMulti
          ? (selectedIds ?? []).includes(opt.id)
          : selectedId === opt.id;
        const isCorrect = showAnswer && opt.is_correct === true;
        if (!isSelected && !isCorrect) return null;
        const graded = showAnswer ? (isSelected && isCorrect) : (isSelected ? answerIsCorrect : null);
        const style =
          graded === true ? "bg-bosque/8 border-bosque/30 text-bosque" :
          graded === false ? "bg-borgona/8 border-borgona/30 text-borgona" :
          isSelected ? "bg-indigo/8 border-indigo/30 text-ink" :
          "bg-bosque/4 border-bosque/20 text-ink";
        const tag =
          graded === true ? "Tu respuesta · correcta" :
          graded === false ? "Tu respuesta · incorrecta" :
          isSelected ? "Tu respuesta" :
          "Respuesta correcta";
        const icon = graded === true ? <Check size={12} /> : graded === false ? <X size={12} /> : isSelected ? <span>·</span> : <Check size={12} />;
        return (
          <div key={opt.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-[8px] border text-body ${style}`}>
            <span className="w-4 flex items-center justify-center shrink-0">{icon}</span>
            <span className="flex-1">{opt.text}</span>
            <span className="text-[11px] opacity-70 shrink-0">{tag}</span>
          </div>
        );
      })}
    </div>
  );
}

function TrueFalseResult({
  correct,
  given,
  showAnswer,
  answerIsCorrect,
}: {
  correct: boolean;
  given: boolean | undefined;
  showAnswer: boolean;
  answerIsCorrect?: boolean | null;
}) {
  return (
    <div className="flex gap-2">
      {([true, false] as const).map((v) => {
        const isSelected = given === v;
        const isCorrect = showAnswer && correct === v;
        const graded = showAnswer ? (isSelected && isCorrect) : (isSelected ? answerIsCorrect : null);
        const style =
          graded === true ? "bg-bosque/8 border-bosque/30 text-bosque" :
          graded === false ? "bg-borgona/8 border-borgona/30 text-borgona" :
          isSelected ? "bg-indigo/8 border-indigo/30 text-ink" :
          isCorrect ? "bg-bosque/4 border-bosque/20 text-ink" :
          "bg-surface-alt border-transparent text-ink-soft";
        const icon = graded === true ? <Check size={14} /> : graded === false ? <X size={14} /> : isCorrect ? <Check size={14} /> : null;
        return (
          <div key={String(v)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[8px] border text-body font-medium ${style}`}>
            {icon && <span className="flex items-center">{icon}</span>}
            <span>{v ? "Verdadero" : "Falso"}</span>
          </div>
        );
      })}
    </div>
  );
}

function ShortAnswerResult({
  text,
  isCorrect,
  acceptedAnswers,
  feedback,
  showAnswer,
}: {
  text: string | undefined;
  isCorrect: boolean | null;
  acceptedAnswers: string[];
  feedback: string | undefined;
  showAnswer: boolean;
}) {
  const borderStyle =
    isCorrect === true ? "bg-bosque/8 border-bosque/30 text-bosque" :
    isCorrect === false ? "bg-borgona/8 border-borgona/30 text-borgona" :
    "bg-surface-alt border-transparent text-ink";
  return (
    <div className="space-y-2">
      <div>
        <p className="text-[11px] text-ink-mute mb-1">Tu respuesta</p>
        <div className={`rounded-[8px] px-3 py-2 text-body border ${borderStyle}`}>
          {text || <em className="text-ink-mute">Sin respuesta</em>}
        </div>
      </div>
      {showAnswer && acceptedAnswers.length > 0 && (
        <div>
          <p className="text-[11px] text-ink-mute mb-1">
            {acceptedAnswers.length === 1 ? "Respuesta correcta" : "Respuestas aceptadas"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {acceptedAnswers.map((a) => (
              <span key={a} className="px-2 py-0.5 bg-bosque/8 text-bosque rounded-[6px] text-body">
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
      {feedback && (
        <p className="text-caption text-ink-soft italic">Retroalimentación: {feedback}</p>
      )}
    </div>
  );
}

interface MapPinSnap {
  center: [number, number];
  zoom: number;
  markers: { id: string; lng: number; lat: number; label: string }[];
  correct_marker_id: string;
}

function MapPinResult({
  snap,
  selectedId,
  showAnswer,
}: {
  snap: MapPinSnap;
  selectedId: string | undefined;
  showAnswer: boolean;
}) {
  const selectedMarker = snap.markers.find((m) => m.id === selectedId);
  const correctMarker = showAnswer ? snap.markers.find((m) => m.id === snap.correct_marker_id) : undefined;
  const isCorrect = showAnswer && selectedId === snap.correct_marker_id;

  return (
    <div className="space-y-3">
      <Suspense fallback={<div className="h-[260px] bg-surface-alt rounded-[10px] animate-pulse" />}>
        <MapPinQuestion
          bodySnapshot={snap}
          selectedMarkerId={selectedId}
          onChange={() => {}}
          submitted
          correctMarkerId={showAnswer ? snap.correct_marker_id : undefined}
        />
      </Suspense>

      {/* Summary legend */}
      <div className="space-y-1.5">
        {selectedMarker ? (
          <div className={`flex items-center gap-2.5 px-3 py-2 rounded-[8px] border text-body ${
            isCorrect ? "bg-bosque/8 border-bosque/30 text-bosque" : "bg-borgona/8 border-borgona/30 text-borgona"
          }`}>
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: isCorrect ? "#16a34a" : "#dc2626" }}
            >
              {selectedMarker.label}
            </span>
            <span className="flex-1">Marcador {selectedMarker.label}</span>
            <span className="text-[11px] opacity-70 shrink-0">Tu respuesta{isCorrect ? " · correcta" : " · incorrecta"}</span>
          </div>
        ) : (
          <p className="text-caption text-ink-mute italic">No seleccionaste ningún marcador.</p>
        )}

        {correctMarker && !isCorrect && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-[8px] border bg-bosque/4 border-bosque/20 text-ink text-body">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
              style={{ background: "#16a34a" }}
            >
              {correctMarker.label}
            </span>
            <span className="flex-1">Marcador {correctMarker.label}</span>
            <span className="text-[11px] opacity-70 shrink-0">Respuesta correcta</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

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
              <p className="text-body text-bosque font-bold mb-0.5">¡Aprobaste!</p>
              <p className="text-caption text-ink-soft">Superaste el mínimo de {quiz.passing_score}%</p>
            </>
          )}
          {passing === false && (
            <>
              <p className="text-body text-borgona font-bold mb-0.5">No aprobaste</p>
              <p className="text-caption text-ink-soft">El mínimo requerido es {quiz.passing_score}%</p>
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

      {/* Per-question review — always shown; correct answers gated by showAnswers */}
      <div className="space-y-4">
        <p className="text-caption text-ink-mute">Revisión de respuestas</p>

        {questions.map((q, i) => {
          const answer = answerMap[q.id];
          const snap = q.body_snapshot;

          return (
            <div key={q.id} className="bg-surface rounded-[12px] border-subtle p-4 space-y-3">
              {/* Question header */}
              <div className="flex items-start justify-between gap-3">
                <p className="text-body text-ink flex-1">
                  <span className="text-ink-mute text-caption mr-2">{i + 1}.</span>
                  {q.prompt}
                </p>
                {answer?.is_correct === true && (
                  <span className="shrink-0 text-mono px-2 py-0.5 rounded-[4px] text-[11px] bg-bosque/10 text-bosque inline-flex items-center gap-0.5">
                    <Check size={11} /> +{answer.points_awarded ?? q.points}
                  </span>
                )}
                {answer?.is_correct === false && (
                  <span className="shrink-0 text-mono px-2 py-0.5 rounded-[4px] text-[11px] bg-borgona/10 text-borgona inline-flex items-center gap-0.5">
                    <X size={11} /> 0
                  </span>
                )}
                {answer && answer.is_correct == null && (
                  <span className="shrink-0 text-mono px-2 py-0.5 rounded-[4px] text-[11px] bg-surface-alt text-ink-mute">
                    Revisión pendiente
                  </span>
                )}
                {!answer && (
                  <span className="shrink-0 text-mono px-2 py-0.5 rounded-[4px] text-[11px] bg-surface-alt text-ink-mute">
                    Sin respuesta
                  </span>
                )}
              </div>

              {/* Answer body */}
              {(q.type === "single_choice" || q.type === "multi_choice") && (
                <ChoiceResult
                  options={(snap.options as { id: string; text: string; is_correct?: boolean }[]) ?? []}
                  selectedId={answer?.response.selected_id as string | undefined}
                  selectedIds={answer?.response.selected_ids as string[] | undefined}
                  isMulti={q.type === "multi_choice"}
                  showAnswer={showAnswers}
                  answerIsCorrect={answer?.is_correct}
                />
              )}

              {q.type === "true_false" && (
                <TrueFalseResult
                  correct={snap.correct as boolean}
                  given={answer?.response.answer as boolean | undefined}
                  showAnswer={showAnswers}
                  answerIsCorrect={answer?.is_correct}
                />
              )}

              {q.type === "short_answer" && (
                <ShortAnswerResult
                  text={answer?.response.text as string | undefined}
                  isCorrect={answer?.is_correct ?? null}
                  acceptedAnswers={(snap.accepted_answers as string[] | undefined) ?? []}
                  feedback={answer?.feedback as string | undefined}
                  showAnswer={showAnswers}
                />
              )}

              {q.type === "map_pin" && (
                <MapPinResult
                  snap={snap as unknown as MapPinSnap}
                  selectedId={answer?.response.marker_id as string | undefined}
                  showAnswer={showAnswers}
                />
              )}

              {/* Explanation */}
              {showAnswers && typeof snap.explanation === "string" && (
                <div className="pt-1 border-t border-subtle">
                  <p className="text-caption text-ink-soft italic">{snap.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
        <span className="inline-flex items-center gap-1"><ArrowLeft size={14} /> Volver a la evaluación</span>
      </Link>
    </div>
  );
}
