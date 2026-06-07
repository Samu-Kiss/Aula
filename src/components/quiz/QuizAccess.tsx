"use client";

import { useState, useTransition } from "react";
import type { Quiz } from "@/lib/types/db";
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ─── Identification form — step 1 ────────────────────────────────────────────

interface Step1Props {
  onSent: (data: { email: string; firstName: string; lastName: string; rememberMe: boolean }) => void;
}

function IdentStep1({ onSent }: Step1Props) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [pending, startPending] = useTransition();

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
      } else {
        setError("No se pudo enviar el código. Intenta de nuevo.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="text-body text-ink-soft mb-5">
          Para presentar esta evaluación necesitamos identificarte. Ingresa tu correo y nombre — te enviaremos un código de verificación.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-caption text-ink block mb-1">Nombre</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
            placeholder="Ana"
          />
        </div>
        <div>
          <label className="text-caption text-ink block mb-1">Apellido</label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
            placeholder="García"
          />
        </div>
      </div>

      <div>
        <label className="text-caption text-ink block mb-1">Correo electrónico</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
          placeholder="ana@ejemplo.com"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="remember_me"
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="w-4 h-4 rounded accent-indigo"
        />
        <label htmlFor="remember_me" className="text-caption text-ink-soft">
          Recordarme en este dispositivo (30 días)
        </label>
      </div>

      {error && <p className="text-caption text-borgona">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full py-2.5 bg-ink text-surface rounded-[8px] text-caption font-bold hover:bg-ink/90 disabled:opacity-50 transition-colors"
      >
        {pending ? "Enviando…" : "Continuar →"}
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
          className="w-40 border border-subtle rounded-[8px] px-3 py-2 text-mono text-ink text-center tracking-widest bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30 text-base"
          placeholder="000000"
        />
      </div>

      {error && <p className="text-caption text-borgona">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={pending}
          className="flex-1 py-2.5 bg-ink text-surface rounded-[8px] text-caption font-bold hover:bg-ink/90 disabled:opacity-50 transition-colors"
        >
          {pending ? "Verificando…" : "Verificar →"}
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
}

function QuizLanding({ quiz, content, student, availability, onSignOut }: LandingProps) {
  const [signingOut, startSignOut] = useTransition();

  function handleSignOut() {
    startSignOut(async () => {
      await fetch("/api/student/session", { method: "DELETE" });
      onSignOut();
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

      {/* Quiz info */}
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
            <p className="text-caption text-ink-mute mb-1">Intentos permitidos</p>
            <p className="text-body text-ink font-medium">{quiz.attempts_allowed}</p>
          </div>
          {quiz.passing_score != null && (
            <div className="p-4 bg-surface border-subtle rounded-[10px]">
              <p className="text-caption text-ink-mute mb-1">Puntaje mínimo</p>
              <p className="text-body text-ink font-medium">{quiz.passing_score}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Availability state / CTA */}
      {availability === "disabled" && (
        <div className="p-5 bg-surface-alt rounded-[10px] text-center">
          <p className="text-body text-ink-soft">Esta evaluación no está disponible en este momento.</p>
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

      {availability === "available" && (
        <div className="space-y-2">
          <button
            type="button"
            disabled
            className="w-full py-3 bg-ink text-surface rounded-[10px] text-caption font-bold opacity-40"
          >
            Iniciar evaluación →
          </button>
          <p className="text-mono text-ink-mute text-center">El flujo de presentación llega en la siguiente fase.</p>
        </div>
      )}
    </div>
  );
}

// ─── QuizAccess (root) ────────────────────────────────────────────────────────

export function QuizAccess({ quiz, content, classSlug, moduleSlug, initialStudent }: Props) {
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
