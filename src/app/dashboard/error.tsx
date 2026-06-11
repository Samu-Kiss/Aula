"use client";

import { useEffect } from "react";
import Link from "next/link";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center px-8 py-16">
      <div className="max-w-sm w-full text-center space-y-4">
        <p className="text-eyebrow text-borgona">Error</p>
        <h1 className="text-h2 text-ink">Algo salió mal</h1>
        <p className="text-body text-ink-soft">
          No se pudo cargar esta sección. Puedes intentar de nuevo o volver al inicio.
        </p>
        {error.digest && (
          <p className="text-mono text-ink-mute">ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 bg-accent-deep text-page rounded-[8px] text-caption font-bold hover:bg-accent-deep/88 transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-surface-alt text-ink-soft rounded-[8px] text-caption font-medium hover:text-ink transition-colors"
          >
            Ir al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
