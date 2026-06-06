"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="text-center">
        <p className="text-eyebrow text-ink-mute mb-4">Error 500</p>
        <h1 className="text-[80px] font-black text-ink leading-none mb-4">
          Algo salió mal
        </h1>
        <p className="text-body text-ink-soft mb-2 max-w-sm mx-auto">
          Ocurrió un error inesperado de nuestro lado.
        </p>
        {error.digest && (
          <p className="text-mono text-ink-mute mb-8">ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="text-body text-ink underline underline-offset-4 hover:text-ink-soft transition-colors"
        >
          Intentar de nuevo
        </button>
      </div>
    </main>
  );
}
