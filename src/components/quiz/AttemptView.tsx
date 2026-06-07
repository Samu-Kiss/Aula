"use client";

import { useState, useEffect, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Attempt, AttemptQuestion, Answer, Quiz } from "@/lib/types/db";
import type { StudentPayload } from "@/lib/auth/studentJwt";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  attempt: Attempt;
  questions: AttemptQuestion[];
  initialAnswers: Answer[];
  quiz: Quiz | null;
  student: StudentPayload;
  contentUrl: string;
}

type AnswerMap = Record<string, Record<string, unknown>>; // question_id → response

// ─── Timer ───────────────────────────────────────────────────────────────────

function useTimer(expiresAt: string | null): { display: string; expired: boolean } {
  const [remaining, setRemaining] = useState<number | null>(() => {
    if (!expiresAt) return null;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  });

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r !== null ? Math.max(0, r - 1) : null));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  if (remaining === null) return { display: "", expired: false };

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const display = `${m}:${String(s).padStart(2, "0")}`;
  return { display, expired: remaining === 0 };
}

// ─── Question renderers ───────────────────────────────────────────────────────

interface QProps {
  question: AttemptQuestion;
  response: Record<string, unknown>;
  onChange: (response: Record<string, unknown>) => void;
  submitted: boolean;
}

function SingleChoiceQuestion({ question, response, onChange, submitted }: QProps) {
  const options = (question.body_snapshot.options as { id: string; text: string }[]) ?? [];
  const selected = response.selected_id as string | undefined;

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={submitted}
          onClick={() => onChange({ selected_id: opt.id })}
          className={`w-full text-left px-4 py-3 rounded-[10px] border transition-colors text-body ${
            selected === opt.id
              ? "border-indigo bg-indigo/8 text-ink"
              : "border-subtle bg-surface text-ink hover:border-indigo/40"
          } disabled:cursor-default`}
        >
          {opt.text}
        </button>
      ))}
    </div>
  );
}

function MultiChoiceQuestion({ question, response, onChange, submitted }: QProps) {
  const options = (question.body_snapshot.options as { id: string; text: string }[]) ?? [];
  const selected = (response.selected_ids as string[]) ?? [];

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    onChange({ selected_ids: next });
  }

  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={submitted}
          onClick={() => toggle(opt.id)}
          className={`w-full text-left px-4 py-3 rounded-[10px] border transition-colors text-body ${
            selected.includes(opt.id)
              ? "border-indigo bg-indigo/8 text-ink"
              : "border-subtle bg-surface text-ink hover:border-indigo/40"
          } disabled:cursor-default`}
        >
          <span className={`inline-block w-3.5 h-3.5 rounded-[3px] border mr-3 align-middle transition-colors ${
            selected.includes(opt.id) ? "border-indigo bg-indigo" : "border-ink-mute"
          }`} />
          {opt.text}
        </button>
      ))}
    </div>
  );
}

function TrueFalseQuestion({ question, response, onChange, submitted }: QProps) {
  const selected = response.answer as boolean | undefined;

  return (
    <div className="flex gap-3">
      {([true, false] as const).map((v) => (
        <button
          key={String(v)}
          type="button"
          disabled={submitted}
          onClick={() => onChange({ answer: v })}
          className={`flex-1 py-3 rounded-[10px] border text-body font-medium transition-colors ${
            selected === v
              ? "border-indigo bg-indigo/8 text-ink"
              : "border-subtle bg-surface text-ink-soft hover:border-indigo/40"
          } disabled:cursor-default`}
        >
          {v ? "Verdadero" : "Falso"}
        </button>
      ))}
    </div>
  );
}

function ShortAnswerQuestion({ question: _q, response, onChange, submitted }: QProps) {
  return (
    <textarea
      value={(response.text as string) ?? ""}
      onChange={(e) => onChange({ text: e.target.value })}
      disabled={submitted}
      rows={3}
      className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30 resize-none disabled:opacity-70"
      placeholder="Escribe tu respuesta…"
    />
  );
}

function QuestionRenderer(props: QProps) {
  switch (props.question.type) {
    case "single_choice": return <SingleChoiceQuestion {...props} />;
    case "multi_choice": return <MultiChoiceQuestion {...props} />;
    case "true_false": return <TrueFalseQuestion {...props} />;
    case "short_answer": return <ShortAnswerQuestion {...props} />;
    default: return <p className="text-body text-ink-soft">Tipo de pregunta no soportado.</p>;
  }
}

// ─── AttemptView ─────────────────────────────────────────────────────────────

export function AttemptView({ attempt, questions, initialAnswers, quiz, student: _s, contentUrl }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<AnswerMap>(() => {
    const map: AnswerMap = {};
    for (const a of initialAnswers) map[a.question_id] = a.response;
    return map;
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [submitted, setSubmitted] = useState(attempt.status !== "in_progress");
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState("");
  const dirtyRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { display: timerDisplay, expired: timerExpired } = useTimer(attempt.expires_at);

  // Auto-submit when timer expires
  useEffect(() => {
    if (timerExpired && !submitted) handleSubmit();
  }, [timerExpired]);

  // Autosave dirty answers every 5s
  const flush = useCallback(async () => {
    if (dirtyRef.current.size === 0) return;
    const toSave = [...dirtyRef.current];
    dirtyRef.current.clear();
    setSaveStatus("saving");
    try {
      await fetch(`/api/attempts/${attempt.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: toSave.map((qid) => ({
            question_id: qid,
            response: answers[qid] ?? {},
            client_updated_at: new Date().toISOString(),
          })),
        }),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
      toSave.forEach((id) => dirtyRef.current.add(id));
    }
  }, [answers, attempt.id]);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flush, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [answers, flush]);

  function setAnswer(questionId: string, response: Record<string, unknown>) {
    setAnswers((prev) => ({ ...prev, [questionId]: response }));
    dirtyRef.current.add(questionId);
    setSaveStatus("unsaved");
  }

  async function handleSubmit() {
    await flush();
    startSubmit(async () => {
      const res = await fetch(`/api/attempts/${attempt.id}/submit`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        router.push(`${contentUrl}?resultado=${attempt.id}`);
      } else {
        setSubmitError(data.error ?? "Error al enviar.");
      }
    });
  }

  const currentQuestion = questions[currentIndex];
  const answered = Object.keys(answers).filter((id) =>
    questions.some((q) => q.id === id)
  ).length;

  const SAVE_LABEL = { saved: "Guardado", saving: "Guardando…", unsaved: "Sin guardar" };

  return (
    <div className="space-y-6">
      {/* Header del intento */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-caption text-ink-mute">
            Pregunta {currentIndex + 1} de {questions.length}
            <span className="ml-3 text-ink-mute">· {answered}/{questions.length} respondidas</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {!submitted && (
            <span className={`text-mono transition-colors ${saveStatus === "unsaved" ? "text-ambar" : "text-ink-mute"}`}>
              {SAVE_LABEL[saveStatus]}
            </span>
          )}
          {timerDisplay && (
            <span className={`text-mono font-medium tabular-nums px-3 py-1 rounded-[6px] ${
              timerExpired ? "bg-borgona/10 text-borgona" :
              parseInt(timerDisplay) < 2 ? "bg-ambar/10 text-ambar" : "bg-surface-alt text-ink"
            }`}>
              {timerDisplay}
            </span>
          )}
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-1 bg-surface-alt rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo rounded-full transition-all"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      {/* Pregunta actual */}
      {currentQuestion && (
        <div className="bg-surface border-subtle rounded-[12px] p-6 space-y-5">
          <div>
            <p className="text-caption text-ink-mute mb-2">
              {currentQuestion.points} pt{currentQuestion.points !== 1 ? "s" : ""}
            </p>
            <p className="text-body text-ink text-[15px] leading-relaxed">{currentQuestion.prompt}</p>
          </div>
          <QuestionRenderer
            question={currentQuestion}
            response={answers[currentQuestion.id] ?? {}}
            onChange={(r) => setAnswer(currentQuestion.id, r)}
            submitted={submitted}
          />
        </div>
      )}

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 bg-surface-alt text-ink-soft rounded-[8px] text-caption font-medium hover:text-ink disabled:opacity-30 transition-colors"
        >
          ← Anterior
        </button>

        {/* Mapa de preguntas */}
        <div className="flex gap-1.5">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`w-7 h-7 rounded-[6px] text-mono transition-colors ${
                i === currentIndex
                  ? "bg-indigo text-white"
                  : answers[q.id]
                  ? "bg-bosque/20 text-bosque"
                  : "bg-surface-alt text-ink-mute hover:bg-surface-alt/80"
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {currentIndex < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
            className="px-4 py-2 bg-surface-alt text-ink-soft rounded-[8px] text-caption font-medium hover:text-ink transition-colors"
          >
            Siguiente →
          </button>
        ) : (
          <div className="w-24" />
        )}
      </div>

      {/* Enviar */}
      {!submitted && (
        <div className="pt-4 border-t border-subtle space-y-3">
          {answered < questions.length && (
            <p className="text-caption text-ambar text-center">
              Tienes {questions.length - answered} pregunta{questions.length - answered !== 1 ? "s" : ""} sin responder.
            </p>
          )}
          {submitError && <p className="text-caption text-borgona text-center">{submitError}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 bg-ink text-surface rounded-[10px] text-caption font-bold hover:bg-ink/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Enviando…" : "Entregar evaluación"}
          </button>
        </div>
      )}
    </div>
  );
}
