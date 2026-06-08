"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Props {
  onRestore: () => Promise<{ ok: boolean; error?: string }>;
  onPermanentDelete: () => Promise<{ ok: boolean; error?: string }>;
}

export function ArchivedItemActions({ onRestore, onPermanentDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoring, startRestore] = useTransition();
  const [deleting, startDelete] = useTransition();
  const router = useRouter();

  function handleRestore() {
    setError(null);
    startRestore(async () => {
      const result = await onRestore();
      if (!result.ok) setError(result.error ?? "Error al restaurar.");
      else router.refresh();
    });
  }

  function handlePermanentDelete() {
    setError(null);
    startDelete(async () => {
      const result = await onPermanentDelete();
      if (!result.ok) setError(result.error ?? "Error al eliminar.");
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {error && <span className="text-mono text-borgona text-xs">{error}</span>}

      <button
        onClick={handleRestore}
        disabled={restoring || deleting}
        className="h-8 px-3 rounded-[8px] bg-ink text-surface text-caption font-medium hover:bg-ink/90 disabled:opacity-40 transition-colors"
      >
        {restoring ? "Restaurando…" : "Restaurar"}
      </button>

      {confirming ? (
        <div className="flex items-center gap-1">
          <button
            onClick={handlePermanentDelete}
            disabled={deleting}
            className="h-8 px-3 rounded-[8px] bg-borgona text-white text-caption font-medium hover:bg-borgona/90 disabled:opacity-50 transition-colors"
          >
            {deleting ? "…" : "Eliminar"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="h-8 px-3 text-caption text-ink-mute hover:text-ink transition-colors"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          disabled={restoring || deleting}
          className="h-8 px-3 rounded-[8px] border border-borgona/30 text-borgona text-caption font-medium hover:bg-borgona/5 disabled:opacity-40 transition-colors"
        >
          Eliminar
        </button>
      )}
    </div>
  );
}
