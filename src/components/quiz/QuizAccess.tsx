"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import type { Quiz, Attempt } from "@/lib/types/db";
import type { StudentPayload } from "@/lib/auth/studentJwt";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentInfo {
  title: string;
  slug: string;
}

interface Props {
  quiz: Quiz | null;
  content: ContentInfo;
  classSlug: string;
  moduleSlug: string;
  initialStudent: StudentPayload | null;
  initialAttempts: Attempt[];
}

type Step = "identify_1" | "identify_2" | "landing";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function quizAvailability(quiz: Quiz): "available" | "not_open" | "closed" | "disabled" {
  if (!quiz.is_available) return "disabled";
  const now = new Date();
  if (quiz.opens_at && new Date(quiz.opens_at) > now) return "not_open";
  if (quiz.closes_at && new Date(quiz.closes_at) < now) return "closed";
  return "available";
}

const formatDate = formatDateTime;

// ─── Identification form — step 1 ────────────────────────────────────────────

interface Step1Props {
  onSent: (data: { email: string; firstName: string; lastName: string; rememberMe: boolean }) => void;
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function IdentStep1({ onSent }: Step1Props) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [namesLocked, setNamesLocked] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [pending, startPending] = useTransition();
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (!isValidEmail(email)) { setNamesLocked(false); return; }
    lookupTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/student/lookup?email=${encodeURIComponent(email)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.first_name || data.last_name) {
          setFirstName(data.first_name ?? "");
          setLastName(data.last_name ?? "");
          setNamesLocked(true);
        } else {
          setNamesLocked(false);
        }
      } catch {}
    }, 500);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [email]);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (!isValidEmail(value)) setNamesLocked(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !firstName || !lastName) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    setError("");
    startPending(async () => {
      const res = await fetch("/api/student/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, first_name: firstName, last_name: lastName, remember_me: rememberMe }),
      });
      const data = await res.json();
      if (data.ok) {
        onSent({ email, firstName, lastName, rememberMe });
      } else if (data.error === "rate_limited") {
        setError("Demasiados intentos. Espera 10 minutos antes de pedir otro código.");
      } else {
        setError("No se pudo enviar el código. Intenta de nuevo.");
      }
    });
  }

  const inputBase = "w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40";
  const inputLocked = "w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface-alt cursor-not-allowed opacity-75";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-body text-ink-soft mb-5">
          Para presentar esta evaluación necesitamos identificarte. Ingresa tu correo y nombre — te enviaremos un código de verificación.
        </p>
      </div>

      <div>
        <label className="text-caption text-ink block mb-1">Correo electrónico <span className="text-borgona">*</span></label>
        <input
          type="email"
          value={email}
          onChange={(e) => handleEmailChange(e.target.value)}
          autoComplete="email"
          required
          className={inputBase}
          placeholder="ana@ejemplo.com"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-caption text-ink block mb-1">Nombre <span className="text-borgona">*</span></label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
            disabled={namesLocked}
            readOnly={namesLocked}
            className={namesLocked ? inputLocked : inputBase}
            placeholder="Ana"
          />
        </div>
        <div>
          <label className="text-caption text-ink block mb-1">Apellido <span className="text-borgona">*</span></label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
            disabled={namesLocked}
            readOnly={namesLocked}
            className={namesLocked ? inputLocked : inputBase}
            placeholder="García"
          />
        </div>
      </div>

      {namesLocked && (
        <p className="text-caption text-ink-mute">Bienvenido de nuevo — tus datos están guardados.</p>
      )}

      <div className="flex items-center gap-2">
        <input
          id="remember_me"
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="w-3.5 h-3.5 rounded accent-[var(--class-accent-deep)]"
        />
        <label htmlFor="remember_me" className="text-caption text-ink-soft">
          Recordarme en este dispositivo (30 días)
        </label>
      </div>

      {error && <p className="text-caption text-borgona">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 bg-accent-deep text-page rounded-[8px] text-caption font-bold hover:bg-accent-deep/88 disabled:opacity-50 transition-colors"
      >
        {pending ? "Enviando…" : <span className="inline-flex items-center gap-1">Continuar <ArrowRight size={14} /></span>}
      </button>
    </form>
  );
}

// ─── Identification form — step 2 ────────────────────────────────────────────

interface Step2Props {
  email: string;
  firstName: string;
  lastName: string;
  rememberMe: boolean;
  onVerified: () => void;
  onBack: () => void;
}

function IdentStep2({ email, firstName, lastName, rememberMe, onVerified, onBack }: Step2Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startPending] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("El código debe ser de 6 dígitos.");
      return;
    }
    setError("");
    startPending(async () => {
      const res = await fetch("/api/student/session/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, first_name: firstName, last_name: lastName, remember_me: rememberMe }),
      });
      const data = await res.json();
      if (data.ok) {
        onVerified();
      } else {
        setError(data.error === "invalid_code" ? "Código incorrecto o expirado." : "Error al verificar. Intenta de nuevo.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-body text-ink-soft">
        Enviamos un código de 6 dígitos a <span className="text-ink font-medium">{email}</span>. Revisa tu bandeja de entrada.
      </p>

      <div>
        <label className="text-caption text-ink block mb-1">Código de verificación</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          autoFocus
          className="w-40 border border-subtle rounded-[8px] px-3 py-2 text-mono text-ink text-center tracking-widest bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40 text-base"
          placeholder="000000"
        />
      </div>

      {error && <p className="text-caption text-borgona">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-2.5 bg-accent-deep text-page rounded-[8px] text-caption font-bold hover:bg-accent-deep/88 disabled:opacity-50 transition-colors"
        >
          {pending ? "Verificando…" : <span className="inline-flex items-center gap-1">Verificar <ArrowRight size={14} /></span>}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 bg-surface-alt text-ink-soft rounded-[8px] text-caption font-medium hover:text-ink transition-colors"
        >
          Atrás
        </button>
      </div>
    </form>
  );
}

// ─── Quiz landing (post-identification) ──────────────────────────────────────

interface LandingProps {
  quiz: Quiz;
  content: ContentInfo;
  student: { email: string; firstName: string; lastName: string };
  availability: ReturnType<typeof quizAvailability>;
  onSignOut: () => void;
  classSlug: string;
  moduleSlug: string;
  initialAttempts: Attempt[];
}

function pct(score: number | null, max: number | null) {
  if (score == null || !max) return "—";
  return `${Math.round((score / max) * 100)}%`;
}

function QuizLanding({ quiz, content, student, availability, onSignOut, classSlug, moduleSlug, initialAttempts }: LandingProps) {
  const router = useRouter();
  const [signingOut, startSignOut] = useTransition();
  const [starting, startBegin] = useTransition();
  const [startError, setStartError] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>(initialAttempts);

  // Si el estudiante acaba de identificarse (sin intentos cargados server-side), buscarlos
  useEffect(() => {
    if (initialAttempts.length > 0) return;
    fetch(`/api/quizzes/${quiz.id}/attempts`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.attempts)) setAttempts(d.attempts); })
      .catch(() => {});
  }, [quiz.id, initialAttempts.length]);

  const finishedCount = attempts.length;
  const attemptsLeft = Math.max(0, quiz.attempts_allowed - finishedCount);
  const canStart = availability === "available" && attemptsLeft > 0;

  function handleSignOut() {
    startSignOut(async () => {
      await fetch("/api/student/session", { method: "DELETE" });
      onSignOut();
    });
  }

  function handleStart() {
    setStartError("");
    startBegin(async () => {
      const res = await fetch(`/api/quizzes/${quiz.id}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotency_key: crypto.randomUUID() }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/c/${classSlug}/${moduleSlug}/${content.slug}/intento/${data.attempt.id}`);
      } else {
        const msgs: Record<string, string> = {
          attempts_exhausted: "Ya usaste todos tus intentos permitidos.",
          quiz_unavailable: "El quiz no está disponible.",
          quiz_closed: "El período del quiz ha cerrado.",
          quiz_has_no_questions: "Este quiz no tiene preguntas todavía.",
        };
        setStartError(msgs[data.error] ?? "No se pudo iniciar. Intenta de nuevo.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Student identity bar */}
      <div className="flex items-center justify-between py-3 px-4 bg-surface-alt rounded-[10px]">
        <div>
          <p className="text-caption text-ink-mute mb-0.5">Identificado como</p>
          <p className="text-body text-ink font-medium">{student.firstName} {student.lastName}</p>
          <p className="text-mono text-ink-mute">{student.email}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="text-caption text-ink-soft hover:text-borgona transition-colors disabled:opacity-50"
        >
          No soy yo
        </button>
      </div>

      {/* Quiz info cards */}
      <div className="space-y-3">
        {quiz.instructions && (
          <p className="text-body text-ink-soft">{quiz.instructions}</p>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {quiz.time_limit_min != null && (
            <div className="p-4 bg-surface border-subtle rounded-[10px]">
              <p className="text-caption text-ink-mute mb-1">Tiempo límite</p>
              <p className="text-body text-ink font-medium">{quiz.time_limit_min} min</p>
            </div>
          )}
          <div className="p-4 bg-surface border-subtle rounded-[10px]">
            <p className="text-caption text-ink-mute mb-1">Intentos</p>
            <p className="text-body text-ink font-medium">
              {finishedCount} / {quiz.attempts_allowed}
            </p>
          </div>
          {quiz.passing_score != null && (
            <div className="p-4 bg-surface border-subtle rounded-[10px]">
              <p className="text-caption text-ink-mute mb-1">Puntaje mínimo</p>
              <p className="text-body text-ink font-medium">{quiz.passing_score}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Past attempts list */}
      {attempts.length > 0 && (
        <div className="space-y-2">
          <p className="text-caption text-ink-mute">Tus intentos</p>
          <div className="rounded-[10px] border border-subtle overflow-hidden">
            {attempts.map((a, i) => {
              const percentage = pct(a.score, a.max_score);
              const passing =
                quiz.passing_score != null && a.score != null && a.max_score
                  ? (a.score / a.max_score) * 100 >= quiz.passing_score
                  : null;

              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-4 px-4 py-3 bg-surface ${
                    i < attempts.length - 1 ? "border-b border-[rgba(0,0,0,0.05)]" : ""
                  }`}
                >
                  <span className="text-mono text-ink-mute w-6 shrink-0">#{a.attempt_number}</span>
                  <div className="flex-1">
                    <p className="text-body text-ink font-medium">
                      {a.score ?? "—"} / {a.max_score ?? "—"} pts
                      <span className={`ml-2 text-caption ${
                        passing === true ? "text-bosque" :
                        passing === false ? "text-borgona" :
                        "text-ink-soft"
                      }`}>
                        {percentage}
                        {passing === true && " · Aprobado"}
                        {passing === false && " · Reprobado"}
                      </span>
                    </p>
                    <p className="text-mono text-ink-mute">
                      {a.submitted_at
                        ? formatDateTime(a.submitted_at)
                        : "—"}
                    </p>
                  </div>
                  <a
                    href={`/c/${classSlug}/${moduleSlug}/${content.slug}?resultado=${a.id}`}
                    className="text-caption text-accent-deep hover:text-accent-deep/70 transition-colors shrink-0"
                  >
                    <span className="inline-flex items-center gap-0.5">Ver <ChevronRight size={13} /></span>
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Availability state */}
      {availability === "disabled" && (
        <div className="p-5 bg-surface-alt rounded-[10px] text-center">
          <p className="text-body text-ink-soft">
            Tu profesor aún no ha abierto esta evaluación. Vuelve a intentarlo más tarde.
          </p>
        </div>
      )}
      {availability === "not_open" && quiz.opens_at && (
        <div className="p-5 bg-surface-alt rounded-[10px] text-center">
          <p className="text-caption text-ink-mute mb-1">Disponible desde</p>
          <p className="text-body text-ink">{formatDate(quiz.opens_at)}</p>
        </div>
      )}
      {availability === "closed" && (
        <div className="p-5 bg-surface-alt rounded-[10px] text-center">
          <p className="text-body text-ink-soft">El período de esta evaluación ha cerrado.</p>
          {quiz.closes_at && (
            <p className="text-mono text-ink-mute mt-1">Cerró el {formatDate(quiz.closes_at)}</p>
          )}
        </div>
      )}

      {/* CTA */}
      {startError && <p className="text-caption text-borgona text-center">{startError}</p>}

      {canStart && (
        <button
          type="button"
          disabled={starting}
          onClick={handleStart}
          className="w-full py-3 bg-accent-deep text-page rounded-[10px] text-caption font-bold hover:bg-accent-deep/88 disabled:opacity-50 transition-colors"
        >
          {starting
            ? "Iniciando…"
            : finishedCount > 0
            ? `Nuevo intento (${attemptsLeft} restante${attemptsLeft !== 1 ? "s" : ""})`
            : <span className="inline-flex items-center gap-1">Iniciar evaluación <ArrowRight size={14} /></span>}
        </button>
      )}

      {availability === "available" && attemptsLeft === 0 && (
        <div className="p-4 bg-surface-alt rounded-[10px] text-center">
          <p className="text-body text-ink-soft">Usaste todos tus intentos permitidos.</p>
        </div>
      )}
    </div>
  );
}

// ─── QuizAccess (root) ────────────────────────────────────────────────────────

export function QuizAccess({ quiz, content, classSlug, moduleSlug, initialStudent, initialAttempts }: Props) {
  // If student is pre-identified from cookie, jump straight to landing
  const [step, setStep] = useState<Step>(initialStudent ? "landing" : "identify_1");
  const [studentData, setStudentData] = useState<{
    email: string;
    firstName: string;
    lastName: string;
  } | null>(
    initialStudent
      ? { email: initialStudent.email, firstName: "", lastName: "" }
      : null
  );
  const [formBuffer, setFormBuffer] = useState<{
    email: string;
    firstName: string;
    lastName: string;
    rememberMe: boolean;
  } | null>(null);

  if (!quiz) {
    return (
      <div className="p-6 bg-surface-alt rounded-[12px] text-center">
        <p className="text-body text-ink-soft">Esta evaluación no está disponible en este momento.</p>
      </div>
    );
  }

  const availability = quizAvailability(quiz);

  if (step === "identify_1") {
    return (
      <div className="max-w-md">
        <p className="text-eyebrow text-ink-mute mb-4">Identificación</p>
        <IdentStep1
          onSent={(data) => {
            setFormBuffer(data);
            setStep("identify_2");
          }}
        />
      </div>
    );
  }

  if (step === "identify_2" && formBuffer) {
    return (
      <div className="max-w-md">
        <p className="text-eyebrow text-ink-mute mb-4">Verificación</p>
        <IdentStep2
          email={formBuffer.email}
          firstName={formBuffer.firstName}
          lastName={formBuffer.lastName}
          rememberMe={formBuffer.rememberMe}
          onVerified={() => {
            setStudentData({
              email: formBuffer.email,
              firstName: formBuffer.firstName,
              lastName: formBuffer.lastName,
            });
            setStep("landing");
          }}
          onBack={() => setStep("identify_1")}
        />
      </div>
    );
  }

  if (step === "landing" && studentData) {
    return (
      <QuizLanding
        quiz={quiz}
        content={content}
        student={studentData}
        availability={availability}
        classSlug={classSlug}
        moduleSlug={moduleSlug}
        initialAttempts={step === "landing" && initialStudent ? initialAttempts : []}
        onSignOut={() => {
          setStudentData(null);
          setFormBuffer(null);
          setStep("identify_1");
        }}
      />
    );
  }

  return null;
}
