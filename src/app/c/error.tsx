"use client";

import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PublicError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[PublicError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center space-y-4">
        <p className="text-eyebrow text-ink-mute">Error</p>
        <h1 className="text-h2 text-ink">No se pudo cargar esta página</h1>
        <p className="text-body text-ink-soft">
          Ocurrió un problema inesperado. Intenta de nuevo.
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 bg-accent-deep text-page rounded-[8px] text-caption font-bold hover:bg-accent-deep/88 transition-colors"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
