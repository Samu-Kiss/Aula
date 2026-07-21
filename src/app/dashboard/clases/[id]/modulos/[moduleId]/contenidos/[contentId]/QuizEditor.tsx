"use client";

import { useState, useTransition, useEffect, useRef, Suspense, lazy, type ChangeEvent } from "react";
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
import { publishContentAction } from "@/app/dashboard/clases/[id]/actions";
import { DateTimeField } from "@/components/dashboard/DateTimeField";

const MapPinQuestionEditor = lazy(() =>
  import("./MapPinQuestionEditor").then((m) => ({ default: m.MapPinQuestionEditor }))
);

// ─── Types ────────────────────────────────────────────────────────────────────

type QuestionType = "single_choice" | "multi_choice" | "true_false" | "short_answer" | "map_pin";

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
  if (type === "map_pin") return {
    center: [-74.0721, 4.711],
    zoom: 11,
    markers: [],
    correct_marker_id: "",
  };
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
  map_pin: "Pin en mapa",
};

const SHOW_ANSWERS_OPTIONS: { value: Quiz["show_correct_answers"]; label: string }[] = [
  { value: "never", label: "Nunca" },
  { value: "after_submit", label: "Al enviar" },
  { value: "after_close", label: "Después del cierre" },
];

// ─── Importar preguntas ────────────────────────────────────────────────────────

type NewQuestion = { type: QuestionType; prompt: string; points: number; body: Record<string, unknown> };

const IMPORTABLE_TYPES: QuestionType[] = ["single_choice", "multi_choice", "true_false", "short_answer", "map_pin"];

const PIN_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function asBool(v: unknown, dflt: boolean): boolean {
  return typeof v === "boolean" ? v : dflt;
}

// Acepta claves en español (las de la plantilla) o en inglés (las internas), para
// que un archivo exportado a mano de cualquiera de las dos formas funcione.
function parseImportedQuestions(raw: string): { questions: NewQuestion[]; error: string | null } {
  let data: unknown;
  try { data = JSON.parse(raw); }
  catch { return { questions: [], error: "El archivo no es JSON válido." }; }

  const root = (data ?? {}) as Record<string, unknown>;
  const arr = Array.isArray(data) ? data : (root.preguntas ?? root.questions);
  if (!Array.isArray(arr) || arr.length === 0) {
    return { questions: [], error: "No se encontró un arreglo 'preguntas' con al menos una pregunta." };
  }

  const out: NewQuestion[] = [];
  for (let i = 0; i < arr.length; i++) {
    const q = (arr[i] ?? {}) as Record<string, unknown>;
    const n = i + 1;
    const type = (q.tipo ?? q.type) as QuestionType;
    if (!IMPORTABLE_TYPES.includes(type)) {
      return { questions: [], error: `Pregunta ${n}: tipo no válido o no importable ("${String(q.tipo ?? q.type ?? "")}"). Usa: ${IMPORTABLE_TYPES.join(", ")}.` };
    }
    const prompt = String(q.enunciado ?? q.prompt ?? "").trim();
    if (prompt.length < 5 || prompt.length > 1000) {
      return { questions: [], error: `Pregunta ${n}: el enunciado debe tener entre 5 y 1000 caracteres.` };
    }
    const points = Number(q.puntos ?? q.points ?? 1);
    if (!Number.isFinite(points) || points < 0.25 || points > 100) {
      return { questions: [], error: `Pregunta ${n}: los puntos deben estar entre 0.25 y 100.` };
    }

    let body: Record<string, unknown>;
    if (type === "single_choice" || type === "multi_choice") {
      const rawOpts = q.opciones ?? q.options;
      if (!Array.isArray(rawOpts) || rawOpts.length < 2) {
        return { questions: [], error: `Pregunta ${n}: necesita al menos 2 opciones.` };
      }
      const options: ChoiceOption[] = rawOpts.map((o) => {
        const oo = (o ?? {}) as Record<string, unknown>;
        return {
          id: newId(),
          text: String(oo.texto ?? oo.text ?? "").trim(),
          is_correct: asBool(oo.correcta ?? oo.is_correct ?? oo.correct, false),
        };
      });
      if (options.some((o) => !o.text)) {
        return { questions: [], error: `Pregunta ${n}: todas las opciones deben tener texto.` };
      }
      if (!options.some((o) => o.is_correct)) {
        return { questions: [], error: `Pregunta ${n}: marca al menos una opción como correcta.` };
      }
      body = { options, explanation: String(q.explicacion ?? q.explanation ?? "") };
    } else if (type === "true_false") {
      const correct = q.correcta ?? q.correct;
      if (typeof correct !== "boolean") {
        return { questions: [], error: `Pregunta ${n}: 'correcta' debe ser true o false.` };
      }
      body = { correct, explanation: String(q.explicacion ?? q.explanation ?? "") };
    } else if (type === "map_pin") {
      const rawMarkers = q.marcadores ?? q.markers;
      if (!Array.isArray(rawMarkers) || rawMarkers.length < 2) {
        return { questions: [], error: `Pregunta ${n}: necesita al menos 2 marcadores.` };
      }
      let correctId = "";
      const markers = rawMarkers.map((mk, mi) => {
        const m = (mk ?? {}) as Record<string, unknown>;
        const id = newId();
        if (asBool(m.correcto ?? m.correct ?? m.is_correct, false) && !correctId) correctId = id;
        return {
          id,
          lng: Number(m.lng ?? m.longitud),
          lat: Number(m.lat ?? m.latitud),
          label: String(m.etiqueta ?? m.label ?? PIN_LABELS[mi] ?? String(mi + 1)),
        };
      });
      if (markers.some((m) => !Number.isFinite(m.lng) || !Number.isFinite(m.lat))) {
        return { questions: [], error: `Pregunta ${n}: cada marcador necesita 'lng' y 'lat' numéricos.` };
      }
      if (!correctId) {
        return { questions: [], error: `Pregunta ${n}: marca el marcador correcto con "correcto": true.` };
      }
      const centerRaw = q.centro ?? q.center;
      const center: [number, number] = Array.isArray(centerRaw) && centerRaw.length === 2
        ? [Number(centerRaw[0]), Number(centerRaw[1])]
        : [markers[0].lng, markers[0].lat];
      const zoom = Number(q.zoom ?? 11);
      body = { center, zoom: Number.isFinite(zoom) ? zoom : 11, markers, correct_marker_id: correctId };
    } else {
      const rawAns = q.respuestas_aceptadas ?? q.accepted_answers;
      const answers = Array.isArray(rawAns) ? rawAns.map((a) => String(a).trim()).filter(Boolean) : [];
      if (answers.length === 0) {
        return { questions: [], error: `Pregunta ${n}: necesita al menos una respuesta aceptada.` };
      }
      body = {
        accepted_answers: answers,
        case_sensitive: asBool(q.sensible_mayusculas ?? q.case_sensitive, false),
        auto_grade: asBool(q.calificar_automatico ?? q.auto_grade, true),
      };
    }
    out.push({ type, prompt, points, body });
  }
  return { questions: out, error: null };
}

// Plantilla de ejemplo, documentada. JSON no admite comentarios, así que los
// campos "_instrucciones" describen qué se usa; el importador los ignora.
function buildQuestionTemplate() {
  return {
    _instrucciones: {
      formato: "Rellena el arreglo 'preguntas'. Cada una necesita 'tipo', 'enunciado' y 'puntos', más los campos propios de su tipo.",
      tipos: {
        single_choice: "Selección única: 'opciones' [{texto, correcta}]; marca UNA con correcta:true. 'explicacion' opcional.",
        multi_choice: "Selección múltiple: igual que single_choice, pero puedes marcar varias con correcta:true.",
        true_false: "Verdadero/Falso: 'correcta' true o false. 'explicacion' opcional.",
        short_answer: "Respuesta corta: 'respuestas_aceptadas' [texto…]; 'sensible_mayusculas' y 'calificar_automatico' opcionales.",
        map_pin: "Pin en mapa: 'marcadores' [{lng, lat, etiqueta?, correcto?}] (mínimo 2); marca UNO con correcto:true. 'centro' [lng, lat] y 'zoom' opcionales.",
      },
      reglas: "enunciado: 5 a 1000 caracteres. puntos: entre 0.25 y 100. Coordenadas en [longitud, latitud] (¡lng primero!).",
      nota: "Los campos que empiezan con '_' son notas y se ignoran al importar.",
    },
    preguntas: [
      {
        tipo: "single_choice", enunciado: "¿Cuál es la capital de Colombia?", puntos: 1,
        opciones: [
          { texto: "Bogotá", correcta: true },
          { texto: "Medellín", correcta: false },
          { texto: "Cali", correcta: false },
        ],
        explicacion: "Bogotá es la capital de Colombia.",
      },
      {
        tipo: "multi_choice", enunciado: "¿Cuáles de estos son números primos?", puntos: 2,
        opciones: [
          { texto: "2", correcta: true },
          { texto: "3", correcta: true },
          { texto: "4", correcta: false },
        ],
        explicacion: "",
      },
      {
        tipo: "true_false", enunciado: "La Tierra es plana.", puntos: 1,
        correcta: false, explicacion: "La Tierra es aproximadamente esférica.",
      },
      {
        tipo: "short_answer", enunciado: "Escribe el símbolo químico del agua.", puntos: 1,
        respuestas_aceptadas: ["H2O", "h2o"], sensible_mayusculas: false, calificar_automatico: true,
      },
      {
        tipo: "map_pin", enunciado: "Ubica la capital de Colombia en el mapa.", puntos: 2,
        centro: [-74.2973, 4.5709], zoom: 5,
        marcadores: [
          { lng: -74.0721, lat: 4.7110, etiqueta: "A", correcto: true },
          { lng: -75.5636, lat: 6.2518, etiqueta: "B", correcto: false },
          { lng: -76.5320, lat: 3.4516, etiqueta: "C", correcto: false },
        ],
      },
    ],
  };
}

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
    // La DB exige 5–1000 caracteres y puntos 0.25–100; validar aquí evita que
    // el check constraint reviente con un error genérico.
    if (prompt.trim().length < 5) { setError("El enunciado debe tener al menos 5 caracteres."); return; }
    if (prompt.trim().length > 1000) { setError("El enunciado no puede superar los 1000 caracteres."); return; }
    if (!Number.isFinite(points) || points < 0.25 || points > 100) {
      setError("Los puntos deben estar entre 0.25 y 100."); return;
    }
    if ((type === "single_choice" || type === "multi_choice")) {
      const opts = body.options as ChoiceOption[];
      if (opts.some((o) => !o.text.trim())) { setError("Todas las opciones deben tener texto."); return; }
      if (!opts.some((o) => o.is_correct)) { setError("Debes marcar al menos una opción correcta."); return; }
    }
    if (type === "map_pin") {
      const markers = body.markers as { id: string }[] ?? [];
      if (markers.length < 2) { setError("Añade al menos 2 marcadores en el mapa."); return; }
      if (!body.correct_marker_id) { setError("Selecciona el marcador correcto."); return; }
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
                ? "bg-accent-deep text-page"
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
          className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40 resize-none"
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
          className="w-20 border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
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
                className="flex-1 border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
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
            className="text-caption text-accent-deep hover:underline mt-1"
          >
            + Agregar opción
          </button>
          <div>
            <label className="text-caption text-ink-mute block mt-2 mb-1">Explicación (opcional)</label>
            <input
              type="text"
              value={(body.explanation as string) ?? ""}
              onChange={(e) => setBody((b) => ({ ...b, explanation: e.target.value }))}
              className="w-full border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
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
              className="w-full border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
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
                className="flex-1 border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
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
              className="text-caption text-accent-deep hover:underline"
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
              className="w-3.5 h-3.5 rounded accent-[var(--class-accent-deep)]"
            />
            <label htmlFor="case_sensitive" className="text-caption text-ink-soft">
              Sensible a mayúsculas
            </label>
            <input
              id="auto_grade"
              type="checkbox"
              checked={body.auto_grade as boolean}
              onChange={(e) => setBody((b) => ({ ...b, auto_grade: e.target.checked }))}
              className="w-3.5 h-3.5 rounded accent-[var(--class-accent-deep)] ml-4"
            />
            <label htmlFor="auto_grade" className="text-caption text-ink-soft">
              Calificar automáticamente
            </label>
          </div>
        </div>
      )}

      {type === "map_pin" && (
        <Suspense fallback={<div className="h-48 bg-surface-alt rounded-[10px] animate-pulse" />}>
          <MapPinQuestionEditor
            body={body as unknown as import("./MapPinQuestionEditor").MapPinBody}
            onChange={(b) => setBody(b as unknown as Record<string, unknown>)}
          />
        </Suspense>
      )}

      {error && <p className="text-caption text-borgona">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-accent-deep text-page rounded-[8px] text-caption font-medium hover:bg-accent-deep/88 disabled:opacity-50 transition-colors"
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
              {index + 1}. {TYPE_LABELS[question.type as QuestionType] ?? question.type} · {question.points} pt{question.points !== 1 ? "s" : ""}
            </p>
            <p className="text-body text-ink line-clamp-2">{question.prompt}</p>
          </div>
          <div className="flex items-center gap-2 flex-none">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-caption text-accent-deep hover:underline"
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

// Convierte datetime-local string a ISO para guardar, o null si vacío
function localToIso(val: string): string | null {
  if (!val) return null;
  return new Date(val).toISOString();
}
// Convierte ISO a datetime-local string para el input
function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  // Hora LOCAL (no UTC): el campo muestra dd/mm/aaaa hh:mm en hora del equipo
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function QuizSettings({ quiz, classId, onUpdated }: QuizSettingsProps) {
  const [isAvailable, setIsAvailable] = useState(quiz.is_available ?? false);
  const [opensAt, setOpensAt] = useState(isoToLocal(quiz.opens_at));
  const [closesAt, setClosesAt] = useState(isoToLocal(quiz.closes_at));
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
  const [attemptScoring, setAttemptScoring] = useState<Quiz["attempt_scoring"]>(
    quiz.attempt_scoring ?? "best"
  );
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const firstRender = useRef(true);

  // Autosave on change (debounce para inputs de texto/fecha).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setError("");
      startSave(async () => {
        const result = await saveQuizSettingsAction(quiz.id, classId, {
          is_available: isAvailable,
          opens_at: localToIso(opensAt) as unknown as string,
          closes_at: localToIso(closesAt) as unknown as string,
          time_limit_min: timeLimitMin ? Number(timeLimitMin) : null as unknown as number,
          attempts_allowed: attemptsAllowed,
          passing_score: passScore ? Number(passScore) : null as unknown as number,
          show_correct_answers: showCorrect,
          attempt_scoring: attemptScoring,
        });
        if (result.ok) {
          onUpdated(result.quiz);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } else {
          setError(result.error);
        }
      });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAvailable, opensAt, closesAt, timeLimitMin, attemptsAllowed, passScore, showCorrect, attemptScoring]);

  return (
    <div className="space-y-6 max-w-lg">

      {/* Disponibilidad */}
      <div className="p-4 bg-surface border-subtle rounded-[10px] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-caption font-medium text-ink">Disponible para estudiantes</p>
            <p className="text-mono text-ink-mute mt-0.5">
              {isAvailable ? "Los estudiantes pueden acceder al quiz" : "Quiz bloqueado — invisible para estudiantes"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAvailable((v) => !v)}
            style={{ width: 40, height: 24, borderRadius: 999, flexShrink: 0 }}
            className={`relative transition-colors ${isAvailable ? "bg-accent-deep" : "bg-ink-mute"}`}
            role="switch"
            aria-checked={isAvailable}
          >
            <span
              style={{
                position: "absolute",
                top: 4,
                left: isAvailable ? 20 : 4,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "white",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.15s ease",
              }}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="quiz-opens-at" className="text-caption text-ink-mute block mb-1">Abre</label>
            <DateTimeField id="quiz-opens-at" value={opensAt} onChange={setOpensAt} />
          </div>
          <div>
            <label htmlFor="quiz-closes-at" className="text-caption text-ink-mute block mb-1">Cierra</label>
            <DateTimeField id="quiz-closes-at" value={closesAt} onChange={setClosesAt} />
          </div>
        </div>
        <p className="text-mono text-ink-mute">Deja las fechas vacías para que el quiz esté disponible sin ventana de tiempo.</p>
      </div>

      {/* Tiempo */}
      <div>
        <label className="text-caption font-medium text-ink block mb-1">
          Tiempo límite
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={180}
            value={timeLimitMin}
            onChange={(e) => setTimeLimitMin(e.target.value)}
            className="w-24 border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-describedby="time-limit-hint"
          />
          <span className="text-body text-ink-soft">minutos</span>
        </div>
        <p id="time-limit-hint" className="text-caption text-ink-mute mt-1">Deja vacío para que no haya límite de tiempo.</p>
      </div>

      {/* Intentos */}
      <div>
        <label className="text-caption font-medium text-ink block mb-1">Intentos permitidos</label>
        <input
          type="number"
          min={1}
          max={10}
          value={attemptsAllowed}
          onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
          className="w-24 border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      {/* Calificación final — solo si hay más de 1 intento */}
      {attemptsAllowed > 1 && (
        <div>
          <label className="text-caption font-medium text-ink block mb-2">
            Calificación final (con múltiples intentos)
          </label>
          <div className="flex gap-2">
            {([
              { value: "best", label: "Mejor intento", desc: "Se usa el intento con mayor puntaje" },
              { value: "average", label: "Promedio", desc: "Promedio de todos los intentos" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAttemptScoring(opt.value)}
                className={`flex-1 px-3 py-2.5 rounded-[8px] text-left transition-colors border ${
                  attemptScoring === opt.value
                    ? "bg-accent/8 border-accent/40 text-ink"
                    : "bg-surface border-subtle text-ink-soft hover:text-ink"
                }`}
              >
                <p className={`text-caption font-medium ${attemptScoring === opt.value ? "text-accent-deep" : ""}`}>
                  {opt.label}
                </p>
                <p className="text-mono text-ink-mute mt-0.5">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Puntaje mínimo */}
      <div>
        <label className="text-caption font-medium text-ink block mb-1">
          Puntaje mínimo para aprobar
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={100}
            value={passScore}
            onChange={(e) => setPassScore(e.target.value)}
            className="w-24 border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
            aria-describedby="pass-score-hint"
          />
          <span className="text-body text-ink-soft">%</span>
        </div>
        <p id="pass-score-hint" className="text-caption text-ink-mute mt-1">
          Por ejemplo, 60 aprueba con el 60 % del puntaje. Deja vacío si no hay mínimo.
        </p>
      </div>

      {/* Mostrar respuestas */}
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
                  ? "bg-accent-deep text-page"
                  : "bg-surface-alt text-ink-soft hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-caption text-borgona">{error}</p>}

      {/* Autosave: estado en vez de botón */}
      <p className="text-mono text-ink-mute h-4" role="status" aria-live="polite">
        {saving ? "Guardando…" : saved ? "Guardado ✓" : ""}
      </p>
    </div>
  );
}

// ─── QuizEditor (main) ────────────────────────────────────────────────────────

interface Props {
  contentId: string;
  classId: string;
  initialQuiz: Quiz | null;
  initialQuestions: QuizQuestion[];
  isPublished: boolean;
}

export function QuizEditor({ contentId, classId, initialQuiz, initialQuestions, isPublished }: Props) {
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz);
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);
  const [tab, setTab] = useState<"questions" | "settings">("questions");
  const [showAddForm, setShowAddForm] = useState(false);
  const [published, setPublished] = useState(isPublished);
  const [initializing, startInit] = useTransition();
  const [publishing, startPublish] = useTransition();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, startImport] = useTransition();

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

  function handleDownloadQuestionTemplate() {
    const blob = new Blob([JSON.stringify(buildQuestionTemplate(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "plantilla-preguntas.json"; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite reimportar el mismo archivo
    if (!file || !quiz) return;
    setImportError(null);
    setImportMsg(null);
    const text = await file.text();
    const { questions: parsed, error } = parseImportedQuestions(text);
    if (error) { setImportError(error); return; }
    startImport(async () => {
      const created: QuizQuestion[] = [];
      let idx = questions.length;
      for (const nq of parsed) {
        const res = await upsertQuestionAction(quiz.id, classId, nq, idx++);
        if (!res.ok) {
          setImportError(`Se importaron ${created.length} de ${parsed.length}. Error en la pregunta ${created.length + 1}: ${res.error}`);
          break;
        }
        created.push(res.question);
      }
      if (created.length) {
        setQuestions((prev) => [...prev, ...created]);
        if (created.length === parsed.length) {
          setImportMsg(`${created.length} pregunta${created.length !== 1 ? "s" : ""} importada${created.length !== 1 ? "s" : ""}.`);
        }
      }
    });
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
      {/* Aviso: publicada pero cerrada para estudiantes */}
      {published && !quiz.is_available && (
        <div className="flex items-start gap-2 rounded-[10px] border border-ambar/40 bg-ambar/10 p-3">
          <p className="text-caption text-ink-soft leading-snug">
            La evaluación está publicada pero{" "}
            <span className="font-medium text-ink">cerrada para estudiantes</span>: actívala con
            &ldquo;Disponible para estudiantes&rdquo; en la pestaña Configuración.
          </p>
        </div>
      )}

      {/* Header con botón publicar */}
      <div className="flex items-center justify-end mb-1">
        <button
          type="button"
          disabled={publishing}
          onClick={() => {
            startPublish(async () => {
              const result = await publishContentAction(contentId, classId);
              if (result.ok) setPublished(true);
            });
          }}
          className={`h-8 px-4 rounded-[8px] text-caption font-bold transition-colors disabled:opacity-50 ${
            published
              ? "bg-surface-alt text-ink-soft hover:bg-surface-alt"
              : "bg-accent-deep text-page hover:bg-accent-deep/88"
          }`}
        >
          {publishing ? "Publicando…" : published ? "Publicar cambios" : "Publicar"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-subtle">
        {(["questions", "settings"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-caption font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-accent text-accent-deep"
                : "border-transparent text-ink-soft hover:text-ink"
            }`}
          >
            {t === "questions" ? "Preguntas" : "Configuración"}
          </button>
        ))}
      </div>

      {tab === "questions" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption text-ink-mute">
              {questions.length > 0
                ? `${questions.length} pregunta${questions.length !== 1 ? "s" : ""} · ${totalPoints} punto${totalPoints !== 1 ? "s" : ""} en total`
                : "Aún no hay preguntas."}
            </p>
            <div className="inline-flex items-center border border-subtle rounded-[6px] divide-x divide-subtle shrink-0">
              <input ref={importInputRef} type="file" accept=".json,application/json"
                onChange={handleImportFile} className="hidden" />
              <button onClick={() => importInputRef.current?.click()} disabled={importing}
                title="Importar preguntas desde un archivo JSON"
                className="text-mono text-[12px] px-2.5 h-6 text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors rounded-l-[5px] disabled:opacity-50">
                {importing ? "Importando…" : "Importar"}
              </button>
              <button onClick={handleDownloadQuestionTemplate}
                title="Descargar plantilla JSON de ejemplo"
                className="text-mono text-[12px] px-2.5 h-6 text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors rounded-r-[5px]">
                Plantilla
              </button>
            </div>
          </div>

          {importError && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-[8px] text-[12px] text-red-600">
              {importError}
            </div>
          )}
          {importMsg && (
            <div className="px-3 py-2 bg-bosque/10 border border-bosque/30 rounded-[8px] text-[12px] text-bosque">
              {importMsg}
            </div>
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
              className="w-full py-3 border-2 border-dashed border-subtle rounded-[10px] text-caption text-ink-soft hover:border-accent hover:text-accent-deep transition-colors"
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
