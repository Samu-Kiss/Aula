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

// ─── Timer (F4-07) ───────────────────────────────────────────────────────────

type TimerMilestone = "5min" | "1min" | "30s" | null;

function useTimer(expiresAt: string | null): {
  display: string;
  expired: boolean;
  remaining: number | null;
  milestone: TimerMilestone;
} {
  // Start as null on both server and client to avoid hydration mismatch.
  // useEffect syncs the real value client-side after hydration.
  const [remaining, setRemaining] = useState<number | null>(null);
  const triggeredRef = useRef<Set<TimerMilestone>>(new Set());
  const [milestone, setMilestone] = useState<TimerMilestone>(null);

  // Sync initial remaining time on the client only
  useEffect(() => {
    if (!expiresAt) return;
    const initial = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setRemaining(initial);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount — expiresAt won't change

  // Count down every second
  useEffect(() => {
    if (remaining === null || remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => (r !== null ? Math.max(0, r - 1) : null));
    }, 1000);
    return () => clearInterval(id);
  }, [remaining]);

  // Detect milestones
  useEffect(() => {
    if (remaining === null) return;
    const checks: [TimerMilestone, number][] = [
      ["5min", 300],
      ["1min", 60],
      ["30s", 30],
    ];
    for (const [label, threshold] of checks) {
      if (remaining <= threshold && !triggeredRef.current.has(label)) {
        triggeredRef.current.add(label);
        setMilestone(label);
        setTimeout(() => setMilestone((m) => (m === label ? null : m)), 6000);
        break;
      }
    }
  }, [remaining]);

  if (remaining === null) return { display: "", expired: false, remaining: null, milestone: null };

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const display = `${m}:${String(s).padStart(2, "0")}`;
  return { display, expired: remaining === 0, remaining, milestone };
}

// ─── Online/offline hook (F4-08) ─────────────────────────────────────────────

function useOnline(): boolean {
  // Always start as true on both server and client to avoid hydration mismatch.
  // useEffect syncs the real browser value after hydration (client-only).
  const [online, setOnline] = useState(true);
  useEffect(() => {
    // Immediately correct if browser is already offline
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

// ─── Anti-cheating hook (F4-06) ──────────────────────────────────────────────

function useAntiCheat(
  attemptId: string,
  isOnline: boolean,
  onDuplicate: () => void
) {
  const queueRef = useRef<{ type: string; occurred_at: string; payload?: unknown }[]>([]);

  const sendEvent = useCallback(
    async (type: string, payload?: unknown) => {
      const occurred_at = new Date().toISOString();
      if (!isOnline) {
        queueRef.current.push({ type, occurred_at, payload });
        return;
      }
      try {
        await fetch(`/api/attempts/${attemptId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, payload, occurred_at }),
        });
      } catch {
        queueRef.current.push({ type, occurred_at, payload });
      }
    },
    [attemptId, isOnline]
  );

  // Flush queued events when online
  useEffect(() => {
    if (!isOnline || queueRef.current.length === 0) return;
    const events = [...queueRef.current];
    queueRef.current = [];
    for (const ev of events) {
      fetch(`/api/attempts/${attemptId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ev),
      }).catch(() => {
        queueRef.current.push(ev);
      });
    }
    sendEvent("reconnect");
  }, [isOnline, attemptId, sendEvent]);

  // Tab blur/focus
  useEffect(() => {
    function onVisibilityChange() {
      sendEvent(document.hidden ? "tab_blur" : "tab_focus");
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [sendEvent]);

  // Paste / copy
  useEffect(() => {
    function onPaste() { sendEvent("paste"); }
    function onCopy() { sendEvent("copy"); }
    document.addEventListener("paste", onPaste);
    document.addEventListener("copy", onCopy);
    return () => {
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("copy", onCopy);
    };
  }, [sendEvent]);

  // Duplicate instance: block new tab and log event
  useEffect(() => {
    const TAB_KEY = `aula_attempt_tab_${attemptId}`;
    const tabId = Math.random().toString(36).slice(2);

    // Check immediately on mount: is another tab already open?
    try {
      const existing = localStorage.getItem(TAB_KEY);
      if (existing) {
        const data = JSON.parse(existing) as { tabId: string; ts: number };
        if (data.tabId !== tabId && Date.now() - data.ts < 5000) {
          // Another tab is active — block this one immediately
          sendEvent("duplicate_instance_attempt");
          onDuplicate();
          return; // Don't set up heartbeat — this tab is blocked
        }
      }
    } catch { /* ignore parse errors */ }

    // This tab is the primary — write heartbeat every 2s
    localStorage.setItem(TAB_KEY, JSON.stringify({ tabId, ts: Date.now() }));
    const heartbeat = setInterval(() => {
      localStorage.setItem(TAB_KEY, JSON.stringify({ tabId, ts: Date.now() }));
    }, 2000);

    // Listen for another tab writing to the same key
    let reported = false;
    function onStorage(e: StorageEvent) {
      if (e.key !== TAB_KEY || !e.newValue) return;
      try {
        const data = JSON.parse(e.newValue) as { tabId: string; ts: number };
        if (data.tabId !== tabId && Date.now() - data.ts < 5000 && !reported) {
          reported = true;
          sendEvent("duplicate_instance_attempt");
          // The OTHER tab is new — it will detect us and block itself.
          // The existing (this) tab continues normally.
        }
      } catch { /* ignore */ }
    }

    window.addEventListener("storage", onStorage);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("storage", onStorage);
      localStorage.removeItem(TAB_KEY);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]); // intentionally exclude sendEvent/onDuplicate from deps — only run on mount

  return { sendEvent };
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

// ─── Milestone alert labels (F4-07) ──────────────────────────────────────────

const MILESTONE_LABELS: Record<string, string> = {
  "5min": "⏱ Quedan 5 minutos",
  "1min": "⚠️ Queda 1 minuto",
  "30s": "🚨 Quedan 30 segundos",
};

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
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const [submitError, setSubmitError] = useState("");
  const dirtyRef = useRef<Set<string>>(new Set());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineQueueRef = useRef<{ question_id: string; response: Record<string, unknown>; ts: string }[]>([]);

  // F4-07: enhanced timer with milestones
  const { display: timerDisplay, expired: timerExpired, remaining, milestone } = useTimer(attempt.expires_at);

  // F4-08: online/offline
  const isOnline = useOnline();

  // F4-06: anti-cheat
  const { sendEvent } = useAntiCheat(attempt.id, isOnline, () => setIsDuplicate(true));

  // Auto-submit when timer expires
  useEffect(() => {
    if (timerExpired && !submitted) {
      sendEvent("time_expired");
      handleSubmit();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerExpired]);

  // Autosave dirty answers every 3s
  const flush = useCallback(async () => {
    if (dirtyRef.current.size === 0) return;
    const toSave = [...dirtyRef.current];
    dirtyRef.current.clear();
    setSaveStatus("saving");

    // F4-08: if offline, queue for later
    if (!isOnline) {
      toSave.forEach((qid) => {
        offlineQueueRef.current.push({
          question_id: qid,
          response: answers[qid] ?? {},
          ts: new Date().toISOString(),
        });
      });
      setSaveStatus("unsaved");
      return;
    }

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
  }, [answers, attempt.id, isOnline]);

  // Flush offline queue when connection restored (F4-08)
  useEffect(() => {
    if (!isOnline || offlineQueueRef.current.length === 0) return;
    const queued = [...offlineQueueRef.current];
    offlineQueueRef.current = [];
    fetch(`/api/attempts/${attempt.id}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers: queued.map((q) => ({
          question_id: q.question_id,
          response: q.response,
          client_updated_at: q.ts,
        })),
      }),
    })
      .then(() => setSaveStatus("saved"))
      .catch(() => {
        // Put them back
        offlineQueueRef.current.push(...queued);
      });
  }, [isOnline, attempt.id]);

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

  // Timer color based on remaining time
  const timerColor =
    timerExpired
      ? "bg-borgona/10 text-borgona"
      : remaining !== null && remaining <= 30
      ? "bg-borgona/10 text-borgona animate-pulse"
      : remaining !== null && remaining <= 60
      ? "bg-ambar/10 text-ambar"
      : remaining !== null && remaining <= 300
      ? "bg-ambar/10 text-ambar"
      : "bg-surface-alt text-ink";

  // F4-06: Duplicate tab blocker — renders over everything
  if (isDuplicate) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-4">
        <div className="text-5xl">🚫</div>
        <h2 className="text-h2 text-ink">Evaluación abierta en otra pestaña</h2>
        <p className="text-body text-ink-soft max-w-sm">
          Ya tienes esta evaluación abierta en otra pestaña del navegador. Cierra esta pestaña y regresa a la otra para continuar.
        </p>
        <p className="text-caption text-ink-mute">
          Usar múltiples pestañas puede ser registrado como actividad sospechosa.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* F4-08: Offline banner */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-ambar/10 border border-ambar/20 rounded-[10px]">
          <span className="text-ambar">⚡</span>
          <p className="text-caption text-ambar font-medium">
            Sin conexión — tus respuestas se guardarán al reconectar.
          </p>
        </div>
      )}

      {/* F4-07: Milestone alert */}
      {milestone && (
        <div className={`flex items-center justify-center px-4 py-2.5 rounded-[10px] text-center transition-all ${
          milestone === "30s"
            ? "bg-borgona/10 border border-borgona/20"
            : "bg-ambar/10 border border-ambar/20"
        }`}>
          <p className={`text-caption font-bold ${milestone === "30s" ? "text-borgona" : "text-ambar"}`}>
            {MILESTONE_LABELS[milestone]}
          </p>
        </div>
      )}

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
            <span className={`text-mono font-medium tabular-nums px-3 py-1 rounded-[6px] transition-colors ${timerColor}`}>
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
        <div className="flex gap-1.5 flex-wrap justify-center">
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
