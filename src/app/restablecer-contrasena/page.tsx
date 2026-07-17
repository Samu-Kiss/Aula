import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { updatePasswordAction } from "@/app/login/actions";
import { PasswordField } from "@/components/PasswordField";

export const metadata: Metadata = { title: "Cambiar contraseña" };

interface Props {
  searchParams: Promise<{ error?: string; ok?: string }>;
}

/**
 * Página de nueva contraseña. Llega aquí:
 * - el profesor desde el enlace de recuperación del correo (vía /auth/confirm,
 *   que deja la sesión iniciada), o
 * - el profesor ya loggeado desde "Cambiar contraseña" en el dashboard.
 */
export default async function RestablecerContrasenaPage({ searchParams }: Props) {
  const { error, ok } = await searchParams;

  const supabase = await createClient();
  let email: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    email = user?.email ?? null;
  } catch {
    // Supabase caído — se trata como sin sesión.
  }

  if (!email) {
    redirect(
      `/login?error=${encodeURIComponent("El enlace venció o ya fue usado. Solicita uno nuevo desde “¿La olvidaste?”.")}`
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-eyebrow text-ink-mute mb-2">Plataforma</p>
          <h1 className="text-hero-dashboard font-black text-ink leading-none">
            Aula
          </h1>
        </div>

        <h2 className="text-h3 text-ink mb-2">Cambiar contraseña</h2>

        {ok ? (
          <div className="space-y-4">
            <p className="text-body text-ink-soft">
              Tu contraseña se actualizó correctamente.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center h-11 px-5 rounded-[8px] bg-ink text-surface text-caption font-bold hover:bg-ink/90 transition-colors"
            >
              Ir al dashboard
            </Link>
          </div>
        ) : (
          <form action={updatePasswordAction} className="space-y-4">
            <p className="text-body text-ink-soft">
              Define la nueva contraseña para <strong>{email}</strong>.
            </p>

            <div className="space-y-1">
              <label htmlFor="password" className="text-caption text-ink-soft block">
                Nueva contraseña
              </label>
              <PasswordField
                id="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="confirm" className="text-caption text-ink-soft block">
                Confirmar contraseña
              </label>
              <PasswordField
                id="confirm"
                name="confirm"
                autoComplete="new-password"
                minLength={8}
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
              Guardar contraseña
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
