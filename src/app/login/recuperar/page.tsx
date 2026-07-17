import Link from "next/link";
import type { Metadata } from "next";
import { requestPasswordResetAction } from "../actions";

export const metadata: Metadata = { title: "Recuperar contraseña" };

interface Props {
  searchParams: Promise<{ error?: string; sent?: string }>;
}

export default async function RecuperarPage({ searchParams }: Props) {
  const { error, sent } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-eyebrow text-ink-mute mb-2">Plataforma</p>
          <h1 className="text-hero-dashboard font-black text-ink leading-none">
            Aula
          </h1>
        </div>

        <h2 className="text-h3 text-ink mb-2">Recuperar contraseña</h2>

        {sent ? (
          <div className="space-y-4">
            <p className="text-body text-ink-soft">
              Si el correo está registrado, te enviamos un enlace para
              restablecer tu contraseña. Revisa tu bandeja de entrada (y el
              spam).
            </p>
            <Link
              href="/login"
              className="inline-block text-caption font-bold text-ink hover:opacity-80 transition-opacity"
            >
              ← Volver al login
            </Link>
          </div>
        ) : (
          <form action={requestPasswordResetAction} className="space-y-4">
            <p className="text-body text-ink-soft">
              Escribe tu correo y te enviaremos un enlace para crear una
              contraseña nueva.
            </p>

            <div className="space-y-1">
              <label htmlFor="email" className="text-caption text-ink-soft block">
                Correo
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full h-11 px-3 rounded-[8px] border-subtle bg-surface text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="profe@correo.com"
              />
            </div>

            {error && (
              <p role="alert" className="text-body text-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full h-11 rounded-[8px] bg-ink text-surface text-caption font-bold hover:bg-ink/90 transition-colors"
            >
              Enviar enlace
            </button>

            <Link
              href="/login"
              className="inline-block text-caption text-ink-mute hover:text-ink transition-colors"
            >
              ← Volver al login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
