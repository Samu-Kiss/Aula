import Link from "next/link";
import { execSync } from "child_process";
import { Lockup } from "@/components/Lockup";

function getCommitHash(): string | null {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["pipe", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  }
}

const ACCENT_BLOBS = [
  { color: "#9B478A", size: 400, top: "-18%", right: "-4%",  opacity: 0.22 },  // ciruela — esquina superior
  { color: "#C47BB8", size: 260, top:  "55%", right: "18%",  opacity: 0.14 },  // ciruela claro — más abajo
];

const FEATURES = [
  {
    number: "01",
    eyebrow: "Identidad visual",
    title: "Cada clase, su propia voz",
    body: "Lockup tipográfico, color de acento y URL propia. Tus clases se sienten como publicaciones, no como carpetas.",
  },
  {
    number: "02",
    eyebrow: "Contenido estructurado",
    title: "Módulos, texto, video, mapas y archivos",
    body: "Organiza el material con disponibilidad programada. Publica cuando quieras, bloquea lo que todavía no toca.",
  },
  {
    number: "03",
    eyebrow: "Evaluaciones integradas",
    title: "Quizzes con calificación automática",
    body: "Opción múltiple, respuesta corta, ubicación en mapa. Los resultados llegan al gradebook sin trabajo extra.",
  },
];

export default function Home() {
  const commit = getCommitHash();

  return (
    <div className="min-h-screen bg-page flex flex-col overflow-hidden">

      {/* ── Hero ────────────────────────────────────────────── */}
      <main className="relative flex flex-col justify-center min-h-[40svh]
                       px-8 md:px-16 lg:px-24 max-w-screen-xl mx-auto w-full py-24">

        {/* Blobs decorativos — insinúan la paleta de acentos */}
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
          {ACCENT_BLOBS.map((blob, i) => (
            <div
              key={i}
              className="absolute rounded-full animate-fade-up"
              style={{
                background: blob.color,
                width:  blob.size,
                height: blob.size,
                top:    blob.top,
                right:  blob.right,
                opacity: blob.opacity,
                filter: "blur(64px)",
                "--delay": `${i * 40}ms`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Contenido */}
        <p
          className="text-eyebrow text-ink-mute mb-6 animate-fade-up"
          style={{ "--delay": "0ms" } as React.CSSProperties}
        >
          Te presentamos
        </p>

        <div
          className="text-hero-xl animate-fade-up"
          style={{ "--delay": "80ms" } as React.CSSProperties}
        >
          <Lockup title="tu aula" accent="indigo" splitAt={1} />
        </div>

        <p
          className="mt-10 max-w-sm text-body text-ink-soft leading-relaxed animate-fade-up"
          style={{ "--delay": "180ms" } as React.CSSProperties}
        >
          Crea, organiza y publica tus clases. Tus estudiantes acceden sin
          registrarse; tú controlas cada módulo, cada quiz y cada nota.
        </p>

        <div
          className="mt-10 animate-fade-up"
          style={{ "--delay": "260ms" } as React.CSSProperties}
        >
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-full bg-accent-indigo px-8 text-caption text-white hover:bg-accent-indigo/85 transition-colors"
          >
            Entrar como profesor
          </Link>
        </div>
      </main>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="px-8 md:px-16 lg:px-24 py-10 max-w-screen-xl mx-auto w-full">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.number}
              className="bg-surface rounded-[12px] border-subtle px-7 py-8 animate-fade-up"
              style={{ "--delay": `${340 + i * 80}ms` } as React.CSSProperties}
            >
              <span className="text-mono text-ink-mute block mb-5">{f.number}</span>
              <p className="text-eyebrow text-accent-indigo mb-3">{f.eyebrow}</p>
              <h2 className="text-h2 text-ink mb-2">{f.title}</h2>
              <p className="text-body text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer — pegado al fondo cuando el contenido no llena el viewport ── */}
      <footer className="mt-auto border-t border-black/[0.06] bg-surface">
        <div className="max-w-screen-xl mx-auto px-8 md:px-16 lg:px-24 py-5 flex items-center justify-between gap-4">
          <p className="text-body text-ink-mute">
            Desarrollado por{" "}
            <a
              href="https://github.com/Samu-Kiss"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink-soft hover:text-ink transition-colors underline underline-offset-2"
            >
              Samuel Pico
            </a>
            <span aria-hidden className="mx-3">·</span>
            <Link href="/privacidad" className="hover:text-ink-soft transition-colors">
              Privacidad
            </Link>
          </p>
          {commit && (
            <p className="text-mono text-ink-mute">{commit}</p>
          )}
        </div>
      </footer>

    </div>
  );
}
