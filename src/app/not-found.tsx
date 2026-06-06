import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="text-center">
        <p className="text-eyebrow text-ink-mute mb-4">Error 404</p>
        <h1 className="text-[80px] font-black text-ink leading-none mb-4">
          Página no encontrada
        </h1>
        <p className="text-body text-ink-soft mb-8 max-w-sm mx-auto">
          La página que buscas no existe o fue movida.
        </p>
        <Link
          href="/"
          className="text-body text-ink underline underline-offset-4 hover:text-ink-soft transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
