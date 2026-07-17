"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { enrollInClassAction, type EnrollmentStatus } from "./enrollInClassAction";

interface Props {
  classId: string;
  existingEmail: string | null;
  existingName: string | null;
  /** Estado de inscripción en ESTA clase (null = identificado pero sin solicitar). */
  enrollmentStatus?: EnrollmentStatus | null;
}

type Step = "identify" | "verify" | "identified";

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

const inputBase =
  "w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40";
const inputLocked =
  "w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface-alt cursor-not-allowed opacity-75";

export function SelfEnrollBanner({ classId, existingEmail, existingName, enrollmentStatus = null }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(existingEmail ? "identified" : "identify");
  const [activeEmail, setActiveEmail] = useState(existingEmail ?? "");
  const [activeName, setActiveName] = useState(existingName ?? "");
  const [status, setStatus] = useState<EnrollmentStatus | null>(enrollmentStatus);
  const [error, setError] = useState<string | null>(null);
  const [requestPending, startRequest] = useTransition();

  // Step 1 state
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [namesLocked, setNamesLocked] = useState(false);
  const [sendPending, startSend] = useTransition();
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 2 state
  const [code, setCode] = useState("");
  const [verifyPending, startVerify] = useTransition();

  // Lookup student when email reaches valid format
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    // handleEmailChange ya desbloquea los nombres cuando el email es inválido
    if (!isValidEmail(email)) return;
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

  // ── Step 1: send code ──────────────────────────────────────────────────────
  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Nombre y apellido son obligatorios.");
      return;
    }
    setError(null);
    startSend(async () => {
      const res = await fetch("/api/student/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, first_name: firstName.trim(), last_name: lastName.trim(), remember_me: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setStep("verify");
        setCode("");
      } else if (data.error === "rate_limited") {
        setError("Demasiados intentos. Espera 10 minutos.");
      } else {
        setError("No se pudo enviar el código. Intenta de nuevo.");
      }
    });
  }

  // ── Step 2: verify code + enroll ───────────────────────────────────────────
  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("El código debe ser de 6 dígitos.");
      return;
    }
    setError(null);
    startVerify(async () => {
      const res = await fetch("/api/student/session/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, first_name: firstName.trim(), last_name: lastName.trim(), remember_me: true }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error === "invalid_code" ? "Código incorrecto o expirado." : "Error al verificar. Intenta de nuevo.");
        return;
      }
      // Cookie is now set — enroll in class (queda pendiente de aprobación)
      const enroll = await enrollInClassAction(classId);
      if (enroll.ok) {
        setActiveEmail(enroll.email!);
        setActiveName(enroll.name ?? enroll.email!);
        setStatus(enroll.status ?? "pending");
        setStep("identified");
        router.refresh();
      } else {
        setError("Verificado, pero no se pudo completar el registro. Recarga la página.");
      }
    });
  }

  // Ya identificado por cookie pero sin inscripción en esta clase → un clic
  function handleRequestAccess() {
    setError(null);
    startRequest(async () => {
      const enroll = await enrollInClassAction(classId);
      if (enroll.ok) {
        setStatus(enroll.status ?? "pending");
        router.refresh();
      } else {
        setError("No se pudo enviar la solicitud. Recarga la página e intenta de nuevo.");
      }
    });
  }

  function handleSwitch() {
    setEmail(""); setFirstName(""); setLastName("");
    setNamesLocked(false); setCode(""); setError(null);
    setStep("identify");
  }

  // ── Identified ──────────────────────────────────────────────────────────────
  if (step === "identified") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between py-3 px-4 bg-surface-alt rounded-[10px]">
          <div>
            <p className="text-caption text-ink-mute mb-0.5">Identificado como</p>
            <p className="text-body text-ink font-medium">{activeName || activeEmail}</p>
            {activeName && activeName !== activeEmail && (
              <p className="text-mono text-ink-mute">{activeEmail}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {status === null && (
              <button
                type="button"
                onClick={handleRequestAccess}
                disabled={requestPending}
                className="py-2 px-4 bg-accent-deep text-page rounded-[8px] text-caption font-bold hover:bg-accent-deep/88 disabled:opacity-50 transition-colors"
              >
                {requestPending ? "Enviando…" : "Solicitar acceso"}
              </button>
            )}
            <button type="button" onClick={handleSwitch} className="text-caption text-ink-soft hover:text-borgona transition-colors">
              No soy yo
            </button>
          </div>
        </div>
        {status === "pending" && (
          <p className="text-caption text-warning py-1 px-4" role="status">
            Tu solicitud de acceso está pendiente de aprobación del profesor.
          </p>
        )}
        {status === "inactive" && (
          <p className="text-caption text-ink-mute py-1 px-4" role="status">
            Tu acceso a esta clase está desactivado. Habla con tu profesor.
          </p>
        )}
        {error && <p className="text-caption text-borgona px-4">{error}</p>}
      </div>
    );
  }

  // ── Step 1: identify ────────────────────────────────────────────────────────
  if (step === "identify") {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-eyebrow text-ink-mute mb-2">Identifícate</p>
          <p className="text-body text-ink-soft">
            Ingresa el correo que usarás en las evaluaciones — te enviaremos un código de verificación.
          </p>
        </div>
        <form onSubmit={handleSend} className="space-y-3 max-w-md">
          <div>
            <label className="text-caption text-ink block mb-1">
              Correo electrónico <span className="text-borgona">*</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              autoComplete="email"
              required
              placeholder="ana@ejemplo.com"
              className={inputBase}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-caption text-ink block mb-1">
                Nombre <span className="text-borgona">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="given-name"
                required
                disabled={namesLocked}
                readOnly={namesLocked}
                placeholder="Ana"
                className={namesLocked ? inputLocked : inputBase}
              />
            </div>
            <div>
              <label className="text-caption text-ink block mb-1">
                Apellido <span className="text-borgona">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoComplete="family-name"
                required
                disabled={namesLocked}
                readOnly={namesLocked}
                placeholder="García"
                className={namesLocked ? inputLocked : inputBase}
              />
            </div>
          </div>
          {namesLocked && (
            <p className="text-caption text-ink-mute">Bienvenido de nuevo — tus datos están guardados.</p>
          )}
          {error && <p className="text-caption text-borgona">{error}</p>}
          <button
            type="submit"
            disabled={sendPending}
            className="py-2.5 px-5 bg-accent-deep text-page rounded-[8px] text-caption font-bold hover:bg-accent-deep/88 disabled:opacity-50 transition-colors"
          >
            {sendPending ? "Enviando…" : "Continuar →"}
          </button>
        </form>
      </div>
    );
  }

  // ── Step 2: verify ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div>
        <p className="text-eyebrow text-ink-mute mb-2">Verificación</p>
        <p className="text-body text-ink-soft">
          Enviamos un código de 6 dígitos a <span className="text-ink font-medium">{email}</span>. Revisa tu bandeja de entrada.
        </p>
      </div>
      <form onSubmit={handleVerify} className="space-y-3 max-w-md">
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
            disabled={verifyPending}
            className="py-2.5 px-5 bg-accent-deep text-page rounded-[8px] text-caption font-bold hover:bg-accent-deep/88 disabled:opacity-50 transition-colors"
          >
            {verifyPending ? "Verificando…" : "Verificar →"}
          </button>
          <button
            type="button"
            onClick={() => { setStep("identify"); setError(null); }}
            className="px-4 py-2.5 bg-surface-alt text-ink-soft rounded-[8px] text-caption font-medium hover:text-ink transition-colors"
          >
            Atrás
          </button>
        </div>
      </form>
    </div>
  );
}
