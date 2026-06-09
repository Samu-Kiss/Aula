"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AttemptError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[AttemptError]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-page flex items-center justify-center px-5">
      <div className="max-w-sm w-full text-center space-y-4">
        <AlertTriangle size={48} className="mx-auto text-ambar" />
        <h1 className="text-h2 text-ink">Error al cargar el intento</h1>
        <p className="text-body text-ink-soft">
          Ocurrió un problema al cargar tu evaluación. Tus respuestas guardadas están seguras — intenta recargar la página.
        </p>
        {error.digest && (
          <p className="text-mono text-ink-mute">ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 bg-ink text-surface rounded-[8px] text-caption font-bold hover:bg-ink/90 transition-colors"
          >
            Recargar
          </button>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-surface-alt text-ink-soft rounded-[8px] text-caption font-medium hover:text-ink transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    </div>
  );
}
