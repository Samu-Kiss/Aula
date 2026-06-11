import { loginAction } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string; next?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, next } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-eyebrow text-ink-mute mb-2">Plataforma</p>
          <h1 className="text-hero-dashboard font-black text-ink leading-none">
            Aula
          </h1>
        </div>

        <form action={loginAction} className="space-y-4">
          {next && (
            <input type="hidden" name="next" value={next} />
          )}

          <div className="space-y-1">
            <label
              htmlFor="email"
              className="text-caption text-ink-soft block"
            >
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

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="text-caption text-ink-soft block"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full h-11 px-3 rounded-[8px] border-subtle bg-surface text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder="••••••••"
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
            Entrar
          </button>
        </form>
      </div>
    </main>
  );
}
