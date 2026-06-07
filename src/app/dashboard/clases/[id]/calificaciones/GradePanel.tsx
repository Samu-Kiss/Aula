"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { upsertGradeAction } from "./actions";

export interface SelectedCell {
  gradeItemId: string;
  studentId: string;
  itemTitle: string;
  categoryName: string;
  studentName: string;
  studentEmail: string;
  maxScore: number;
  currentScore: number | null;
  currentNotes: string | null;
  autoScore: number | null;
  autoMax: number | null;
}

interface Props {
  classId: string;
  selected: SelectedCell | null;
  onSaved: (gradeItemId: string, studentId: string, score: number | null, notes: string | null) => void;
  onClose: () => void;
}

export function GradePanel({ classId, selected, onSaved, onClose }: Props) {
  const [draft, setDraft] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync draft when selection changes
  useEffect(() => {
    if (selected) {
      setDraft(selected.currentScore?.toString() ?? "");
      setDraftNotes(selected.currentNotes ?? "");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [selected?.gradeItemId, selected?.studentId]);

  function handleSave() {
    if (!selected) return;
    setError(null);
    const parsedScore = draft.trim() === "" ? null : parseFloat(draft);
    if (parsedScore !== null && (isNaN(parsedScore) || parsedScore < 0)) {
      setError("Debe ser un número ≥ 0");
      return;
    }
    startTransition(async () => {
      const res = await upsertGradeAction(
        classId,
        selected.gradeItemId,
        selected.studentId,
        parsedScore,
        draftNotes.trim() || null
      );
      if (!res.ok) { setError(res.error ?? "Error"); return; }
      onSaved(selected.gradeItemId, selected.studentId, parsedScore, draftNotes.trim() || null);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") onClose();
  }

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-4">
        <p className="text-body text-ink-soft">Selecciona una celda</p>
        <p className="text-mono text-ink-mute mt-1">para editar la nota</p>
      </div>
    );
  }

  const isAuto = selected.currentScore === null && selected.autoScore !== null;
  const displayScore = selected.currentScore !== null ? selected.currentScore : selected.autoScore;
  const displayMax   = selected.currentScore !== null ? selected.maxScore : (selected.autoMax ?? selected.maxScore);
  const pct = displayScore != null && displayMax > 0
    ? Math.round((displayScore / displayMax) * 1000) / 10
    : null;

  return (
    <div className="space-y-5">
      {/* Who + what */}
      <div className="space-y-1">
        <p className="text-caption text-ink-mute">{selected.categoryName}</p>
        <p className="text-body font-semibold text-ink">{selected.itemTitle}</p>
        <div className="pt-1 border-t border-subtle">
          <p className="text-body text-ink font-medium">{selected.studentName}</p>
          <p className="text-mono text-ink-mute">{selected.studentEmail}</p>
        </div>
      </div>

      {/* Current value */}
      {pct !== null && (
        <div className="flex items-center justify-between py-3 px-4 bg-surface-alt rounded-[10px]">
          <div>
            <p className="text-caption text-ink-mute mb-0.5">Nota actual</p>
            <p className="text-body font-bold tabular-nums text-ink">{pct}%</p>
            <p className="text-mono text-ink-mute">{displayScore} / {displayMax} pts</p>
          </div>
          {isAuto && (
            <span className="text-mono text-ink-mute text-[11px] bg-page border border-subtle rounded-[6px] px-2 py-1">
              del quiz
            </span>
          )}
        </div>
      )}

      {/* Score input */}
      <div className="space-y-1.5">
        <label className="block text-caption text-ink">
          Puntaje <span className="text-ink-mute font-normal">/ {selected.maxScore} pts</span>
        </label>
        <input
          ref={inputRef}
          type="number"
          min={0}
          step={0.1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAuto ? `${selected.autoScore} (del quiz)` : "—"}
          className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30 tabular-nums"
        />
        {isAuto && (
          <p className="text-mono text-ink-mute">Deja vacío para usar la nota del quiz automáticamente.</p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <label className="block text-caption text-ink">
          Observación <span className="text-ink-mute font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ej: entregó tarde, reposición…"
          className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
        />
      </div>

      {error && <p className="text-caption text-borgona">{error}</p>}

      {/* Actions */}
      <div className="space-y-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="w-full py-2.5 bg-ink text-surface rounded-[8px] text-caption font-bold hover:bg-ink/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Guardando…" : "Guardar"}
        </button>
        <button
          onClick={onClose}
          className="w-full py-2 bg-surface-alt text-ink-soft rounded-[8px] text-caption font-medium hover:text-ink transition-colors"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
