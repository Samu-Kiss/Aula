"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { gradeAnswerAction } from "../actions";

interface Props {
  answerId: string;
  attemptId: string;
  currentPoints: number | null;
  maxPoints: number;
  currentFeedback: string | null;
  classId: string;
}

export function GradeAnswerForm({ answerId, attemptId, currentPoints, maxPoints, currentFeedback, classId }: Props) {
  const [points, setPoints] = useState(currentPoints?.toString() ?? "");
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [saved, setSaved] = useState(currentPoints != null);
  const [error, setError] = useState("");
  const [pending, startPending] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const pts = parseFloat(points);
    if (isNaN(pts) || pts < 0 || pts > maxPoints) {
      setError(`El puntaje debe estar entre 0 y ${maxPoints}.`);
      return;
    }
    setError("");
    startPending(async () => {
      const result = await gradeAnswerAction(answerId, pts, feedback || null, classId, attemptId);
      if (result.ok) {
        setSaved(true);
      } else {
        setError("No se pudo guardar. Intenta de nuevo.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-hairline">
      <p className="text-caption text-ink-mute">Calificación manual</p>

      <div className="flex items-center gap-3">
        <div>
          <label className="text-caption text-ink block mb-1">Puntaje (máx {maxPoints})</label>
          <input
            type="number"
            min={0}
            max={maxPoints}
            step={0.5}
            value={points}
            onChange={(e) => { setPoints(e.target.value); setSaved(false); }}
            className="w-24 border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <div className="flex-1">
          <label className="text-caption text-ink block mb-1">Retroalimentación (opcional)</label>
          <input
            type="text"
            value={feedback}
            onChange={(e) => { setFeedback(e.target.value); setSaved(false); }}
            placeholder="Ej: Buena respuesta, faltó precisión"
            className="w-full border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
      </div>

      {error && <p className="text-caption text-borgona">{error}</p>}

      <button
        type="submit"
        disabled={pending || saved}
        className="px-4 py-1.5 bg-accent-deep text-page rounded-[8px] text-caption font-medium hover:bg-accent-deep/88 disabled:opacity-50 transition-colors"
      >
        {pending ? "Guardando…" : saved ? <span className="inline-flex items-center gap-1"><Check size={13} /> Guardado</span> : "Guardar calificación"}
      </button>
    </form>
  );
}
