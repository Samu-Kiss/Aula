"use client";

import { useState, useTransition, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Quiz, QuizQuestion } from "@/lib/types/db";
import {
  ensureQuizAction,
  saveQuizSettingsAction,
  upsertQuestionAction,
  deleteQuestionAction,
  reorderQuestionsAction,
} from "./quizActions";

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "single_choice" | "multi_choice" | "true_false" | "short_answer";

interface ChoiceOption {
  id: string;
  text: string;
  is_correct: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultBody(type: QuestionType): Record<string, unknown> {
  if (type === "single_choice" || type === "multi_choice") {
    return {
      options: [
        { id: "a", text: "", is_correct: false },
        { id: "b", text: "", is_correct: false },
      ],
      explanation: "",
    };
  }
  if (type === "true_false") return { correct: true, explanation: "" };
  return { accepted_answers: [""], case_sensitive: false, auto_grade: true };
}

function newId() {
  return Math.random().toString(36).slice(2, 6);
}

const TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Selección única",
  multi_choice: "Selección múltiple",
  true_false: "Verdadero / Falso",
  short_answer: "Respuesta corta",
};

const SHOW_ANSWERS_OPTIONS: { value: Quiz["show_correct_answers"]; label: string }[] = [
  { value: "never", label: "Nunca" },
  { value: "after_submit", label: "Al enviar" },
  { value: "after_close", label: "Después del cierre" },
];

// ─── QuestionForm ─────────────────────────────────────────────────────────────

interface QuestionFormProps {
  quizId: string;
  classId: string;
  question: QuizQuestion | null;
  orderIndex: number;
  onSaved: (q: QuizQuestion) => void;
  onCancel: () => void;
}

function QuestionForm({ quizId, classId, question, orderIndex, onSaved, onCancel }: QuestionFormProps) {
  const initialType = (question?.type as QuestionType) ?? "single_choice";
  const [type, setType] = useState<QuestionType>(initialType);
  const [prompt, setPrompt] = useState(question?.prompt ?? "");
  const [points, setPoints] = useState(question?.points ?? 1);
  const [body, setBody] = useState<Record<string, unknown>>(
    question?.body ?? defaultBody(initialType)
  );
  const [saving, startSave] = useTransition();
  const [error, setError] = useState("");

  function handleTypeChange(t: QuestionType) {
    setType(t);
    if (!question) setBody(defaultBody(t));
  }

  function setOptions(updater: (opts: ChoiceOption[]) => ChoiceOption[]) {
    setBody((b) => ({ ...b, options: updater(b.options as ChoiceOption[]) }));
  }

  function addOption() {
    setOptions((opts) => [...opts, { id: newId(), text: "", is_correct: false }]);
  }

  function removeOption(id: string) {
    setOptions((opts) => opts.filter((o) => o.id !== id));
  }

  function updateOptionText(id: string, text: string) {
    setOptions((opts) => opts.map((o) => (o.id === id ? { ...o, text } : o)));
  }

  function toggleOptionCorrect(id: string) {
    if (type === "single_choice") {
      setOptions((opts) => opts.map((o) => ({ ...o, is_correct: o.id === id })));
    } else {
      setOptions((opts) => opts.map((o) => (o.id === id ? { ...o, is_correct: !o.is_correct } : o)));
    }
  }

  function setAcceptedAnswers(answers: string[]) {
    setBody((b) => ({ ...b, accepted_answers: answers }));
  }

  function handleSave() {
    if (!prompt.trim()) { setError("El enunciado es obligatorio."); return; }
    if ((type === "single_choice" || type === "multi_choice")) {
      const opts = body.options as ChoiceOption[];
      if (opts.some((o) => !o.text.trim())) { setError("Todas las opciones deben tener texto."); return; }
      if (!opts.some((o) => o.is_correct)) { setError("Debes marcar al menos una opción correcta."); return; }
    }
    setError("");
    startSave(async () => {
      const result = await upsertQuestionAction(
        quizId,
        classId,
        { id: question?.id, type, prompt: prompt.trim(), points, body },
        orderIndex
      );
      if (result.ok) {
        onSaved(result.question);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="border border-subtle rounded-[10px] p-5 bg-surface space-y-4">
      {/* Type picker */}
      <div className="flex gap-2 flex-wrap">
        {(Object.keys(TYPE_LABELS) as QuestionType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTypeChange(t)}
            className={`px-3 py-1.5 rounded-[8px] text-caption font-medium transition-colors ${
              type === t
                ? "bg-indigo text-white"
                : "bg-surface-alt text-ink-soft hover:text-ink"
            }`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Prompt */}
      <div>
        <label className="text-caption font-medium text-ink block mb-1">Enunciado</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30 resize-none"
          placeholder="¿Cuál de las siguientes…?"
        />
      </div>

      {/* Points */}
      <div className="flex items-center gap-3">
        <label className="text-caption font-medium text-ink">Puntos</label>
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={points}
          onChange={(e) => setPoints(Number(e.target.value))}
          className="w-20 border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
        />
      </div>

      {/* Type-specific fields */}
      {(type === "single_choice" || type === "multi_choice") && (
        <div className="space-y-2">
          <label className="text-caption font-medium text-ink block">
            Opciones {type === "single_choice" ? "(una correcta)" : "(varias correctas)"}
          </label>
          {(body.options as ChoiceOption[]).map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleOptionCorrect(opt.id)}
                title="Marcar como correcta"
                className={`flex-none w-5 h-5 rounded-full border-2 transition-colors ${
                  opt.is_correct
                    ? "border-bosque bg-bosque"
                    : "border-ink-mute bg-surface"
                }`}
              />
              <input
                type="text"
                value={opt.text}
                onChange={(e) => updateOptionText(opt.id, e.target.value)}
                className="flex-1 border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
                placeholder={`Opción ${opt.id.toUpperCase()}`}
              />
              <button
                type="button"
                onClick={() => removeOption(opt.id)}
                className="text-ink-mute hover:text-borgona text-caption px-1"
                title="Eliminar opción"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            className="text-caption text-indigo hover:underline mt-1"
          >
            + Agregar opción
          </button>
          <div>
            <label className="text-caption text-ink-mute block mt-2 mb-1">Explicación (opcional)</label>
            <input
              type="text"
              value={(body.explanation as string) ?? ""}
              onChange={(e) => setBody((b) => ({ ...b, explanation: e.target.value }))}
              className="w-full border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
              placeholder="Se muestra al estudiante según la política de corrección"
            />
          </div>
        </div>
      )}

      {type === "true_false" && (
        <div className="space-y-3">
          <label className="text-caption font-medium text-ink block">Respuesta correcta</label>
          <div className="flex gap-4">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                onClick={() => setBody((b) => ({ ...b, correct: v }))}
                className={`px-6 py-2 rounded-[8px] font-medium text-body transition-colors ${
                  body.correct === v
                    ? "bg-bosque text-white"
                    : "bg-surface-alt text-ink-soft hover:text-ink"
                }`}
              >
                {v ? "Verdadero" : "Falso"}
              </button>
            ))}
          </div>
          <div>
            <label className="text-caption text-ink-mute block mb-1">Explicación (opcional)</label>
            <input
              type="text"
              value={(body.explanation as string) ?? ""}
              onChange={(e) => setBody((b) => ({ ...b, explanation: e.target.value }))}
              className="w-full border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
            />
          </div>
        </div>
      )}

      {type === "short_answer" && (
        <div className="space-y-3">
          <label className="text-caption font-medium text-ink block">Respuestas aceptadas</label>
          {(body.accepted_answers as string[]).map((ans, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={ans}
                onChange={(e) => {
                  const arr = [...(body.accepted_answers as string[])];
                  arr[i] = e.target.value;
                  setAcceptedAnswers(arr);
                }}
                className="flex-1 border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
                placeholder={`Respuesta ${i + 1}`}
              />
              <button
                type="button"
                onClick={() => setAcceptedAnswers((body.accepted_answers as string[]).filter((_, j) => j !== i))}
                className="text-ink-mute hover:text-borgona text-caption px-1"
              >
                ✕
              </button>
            </div>
          ))}
          {(body.accepted_answers as string[]).length < 10 && (
            <button
              type="button"
              onClick={() => setAcceptedAnswers([...(body.accepted_answers as string[]), ""])}
              className="text-caption text-indigo hover:underline"
            >
              + Agregar respuesta aceptada
            </button>
          )}
          <div className="flex items-center gap-3 mt-1">
            <input
              id="case_sensitive"
              type="checkbox"
              checked={body.case_sensitive as boolean}
              onChange={(e) => setBody((b) => ({ ...b, case_sensitive: e.target.checked }))}
              className="w-4 h-4 rounded accent-indigo"
            />
            <label htmlFor="case_sensitive" className="text-caption text-ink-soft">
              Sensible a mayúsculas
            </label>
            <input
              id="auto_grade"
              type="checkbox"
              checked={body.auto_grade as boolean}
              onChange={(e) => setBody((b) => ({ ...b, auto_grade: e.target.checked }))}
              className="w-4 h-4 rounded accent-indigo ml-4"
            />
            <label htmlFor="auto_grade" className="text-caption text-ink-soft">
              Calificar automáticamente
            </label>
          </div>
        </div>
      )}

      {error && <p className="text-caption text-borgona">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo text-white rounded-[8px] text-caption font-medium hover:bg-indigo/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Guardando…" : "Guardar pregunta"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-surface-alt text-ink-soft rounded-[8px] text-caption font-medium hover:text-ink transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── SortableQuestion ─────────────────────────────────────────────────────────

interface SortableQuestionProps {
  question: QuizQuestion;
  index: number;
  quizId: string;
  classId: string;
  onUpdated: (q: QuizQuestion) => void;
  onDeleted: (id: string) => void;
}

function SortableQuestion({ question, index, quizId, classId, onUpdated, onDeleted }: SortableQuestionProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
  });
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  function handleDelete() {
    startDelete(async () => {
      await deleteQuestionAction(question.id, classId);
      onDeleted(question.id);
    });
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-surface border border-subtle rounded-[10px]">
      {editing ? (
        <div className="p-4">
          <QuestionForm
            quizId={quizId}
            classId={classId}
            question={question}
            orderIndex={index}
            onSaved={(q) => { onUpdated(q); setEditing(false); }}
            onCancel={() => setEditing(false)}
          />
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4">
          <button
            {...attributes}
            {...listeners}
            className="flex-none mt-0.5 text-ink-mute hover:text-ink cursor-grab active:cursor-grabbing"
            title="Reordenar"
          >
            ⠿
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-caption text-ink-mute mb-0.5">
              {index + 1}. {TYPE_LABELS[question.type as QuestionType]} · {question.points} pt{question.points !== 1 ? "s" : ""}
            </p>
            <p className="text-body text-ink line-clamp-2">{question.prompt}</p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-caption text-indigo hover:underline"
            >
              Editar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-caption text-ink-mute hover:text-borgona disabled:opacity-50"
            >
              {deleting ? "…" : "Eliminar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── QuizSettings ─────────────────────────────────────────────────────────────

interface QuizSettingsProps {
  quiz: Quiz;
  classId: string;
  onUpdated: (q: Quiz) => void;
}

function QuizSettings({ quiz, classId, onUpdated }: QuizSettingsProps) {
  const [timeLimitMin, setTimeLimitMin] = useState<string>(
    quiz.time_limit_min != null ? String(quiz.time_limit_min) : ""
  );
  const [attemptsAllowed, setAttemptsAllowed] = useState<number>(quiz.attempts_allowed ?? 1);
  const [passScore, setPassScore] = useState<string>(
    quiz.passing_score != null ? String(quiz.passing_score) : ""
  );
  const [showCorrect, setShowCorrect] = useState<Quiz["show_correct_answers"]>(
    quiz.show_correct_answers ?? "after_submit"
  );
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  function handleSave() {
    startSave(async () => {
      const result = await saveQuizSettingsAction(quiz.id, classId, {
        time_limit_min: timeLimitMin ? Number(timeLimitMin) : null as unknown as number,
        attempts_allowed: attemptsAllowed,
        passing_score: passScore ? Number(passScore) : null as unknown as number,
        show_correct_answers: showCorrect,
      });
      if (result.ok) {
        onUpdated(result.quiz);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-5 max-w-lg">
      <div>
        <label className="text-caption font-medium text-ink block mb-1">
          Tiempo límite (minutos)
        </label>
        <input
          type="number"
          min={1}
          max={180}
          value={timeLimitMin}
          onChange={(e) => setTimeLimitMin(e.target.value)}
          className="w-32 border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
          placeholder="Sin límite"
        />
        <p className="text-caption text-ink-mute mt-1">Dejar vacío para sin límite de tiempo.</p>
      </div>

      <div>
        <label className="text-caption font-medium text-ink block mb-1">Intentos permitidos</label>
        <input
          type="number"
          min={1}
          max={10}
          value={attemptsAllowed}
          onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
          className="w-24 border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
        />
      </div>

      <div>
        <label className="text-caption font-medium text-ink block mb-1">
          Puntaje mínimo para aprobar (%)
        </label>
        <input
          type="number"
          min={0}
          max={100}
          value={passScore}
          onChange={(e) => setPassScore(e.target.value)}
          className="w-32 border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
          placeholder="Sin mínimo"
        />
      </div>

      <div>
        <label className="text-caption font-medium text-ink block mb-1">Mostrar respuestas correctas</label>
        <div className="flex gap-2 flex-wrap">
          {SHOW_ANSWERS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setShowCorrect(opt.value)}
              className={`px-3 py-1.5 rounded-[8px] text-caption font-medium transition-colors ${
                showCorrect === opt.value
                  ? "bg-indigo text-white"
                  : "bg-surface-alt text-ink-soft hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-caption text-borgona">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-5 py-2 bg-indigo text-white rounded-[8px] text-caption font-medium hover:bg-indigo/90 disabled:opacity-50 transition-colors"
      >
        {saving ? "Guardando…" : saved ? "¡Guardado!" : "Guardar ajustes"}
      </button>
    </div>
  );
}

// ─── QuizEditor (main) ────────────────────────────────────────────────────────

interface Props {
  contentId: string;
  classId: string;
  initialQuiz: Quiz | null;
  initialQuestions: QuizQuestion[];
}

export function QuizEditor({ contentId, classId, initialQuiz, initialQuestions }: Props) {
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz);
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [tab, setTab] = useState<"questions" | "settings">("questions");
  const [showAddForm, setShowAddForm] = useState(false);
  const [initializing, startInit] = useTransition();

  useEffect(() => {
    if (!quiz) {
      startInit(async () => {
        const q = await ensureQuizAction(contentId);
        setQuiz(q);
      });
    }
  }, [quiz, contentId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(questions, oldIndex, newIndex).map((q, i) => ({
      ...q,
      order_index: i,
    }));
    setQuestions(reordered);
    reorderQuestionsAction(reordered.map((q) => ({ id: q.id, order_index: q.order_index })));
  }

  if (initializing || !quiz) {
    return (
      <div className="bg-surface-alt rounded-[12px] p-8 text-center">
        <p className="text-body text-ink-soft">Cargando editor…</p>
      </div>
    );
  }

  const totalPoints = questions.reduce((acc, q) => acc + (q.points ?? 0), 0);

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-subtle">
        {(["questions", "settings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-caption font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-indigo text-indigo"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t === "questions" ? "Preguntas" : "Configuración"}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <div className="space-y-3">
          {questions.length > 0 && (
            <p className="text-caption text-ink-mute">
              {questions.length} pregunta{questions.length !== 1 ? "s" : ""} · {totalPoints} punto{totalPoints !== 1 ? "s" : ""} en total
            </p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {questions.map((q, i) => (
                  <SortableQuestion
                    key={q.id}
                    question={q}
                    index={i}
                    quizId={quiz.id}
                    classId={classId}
                    onUpdated={(updated) =>
                      setQuestions((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                    }
                    onDeleted={(id) => setQuestions((prev) => prev.filter((p) => p.id !== id))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {showAddForm ? (
            <QuestionForm
              quizId={quiz.id}
              classId={classId}
              question={null}
              orderIndex={questions.length}
              onSaved={(q) => {
                setQuestions((prev) => [...prev, q]);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-3 border-2 border-dashed border-subtle rounded-[10px] text-caption text-ink-soft hover:border-indigo hover:text-indigo transition-colors"
            >
              + Agregar pregunta
            </button>
          )}
        </div>
      )}

      {tab === "settings" && (
        <QuizSettings quiz={quiz} classId={classId} onUpdated={setQuiz} />
      )}
    </div>
  );
}
