"use client";

import { useState, useTransition } from "react";
import { selfEnrollAction } from "./selfEnrollAction";

interface Props {
  classId: string;
  existingEmail: string | null;
  existingName: string | null;
}

export function SelfEnrollBanner({ classId, existingEmail, existingName }: Props) {
  const [switching, setSwitching] = useState(false);
  const [newEmail, setNewEmail] = useState<string | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await selfEnrollAction(classId, fd);
      if (res.ok) {
        setNewEmail(res.email!);
        setNewName(res.name ?? res.email!);
        setSwitching(false);
      } else {
        setError(
          res.error === "invalid_email"
            ? "Correo inválido. Verifica el formato."
            : "No se pudo completar. Intenta de nuevo."
        );
      }
    });
  }

  // ── Identified — matches QuizLanding identity bar exactly ──────────────────
  const activeEmail = newEmail ?? existingEmail;
  const activeName  = newName  ?? existingName;

  if (activeEmail && !switching) {
    return (
      <div className="flex items-center justify-between py-3 px-4 bg-surface-alt rounded-[10px]">
        <div>
          <p className="text-caption text-ink-mute mb-0.5">Identificado como</p>
          <p className="text-body text-ink font-medium">
            {activeName ?? activeEmail}
          </p>
          {activeName && activeName !== activeEmail && (
            <p className="text-mono text-ink-mute">{activeEmail}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setSwitching(true)}
          className="text-caption text-ink-soft hover:text-borgona transition-colors"
        >
          No soy yo
        </button>
      </div>
    );
  }

  // ── Form — matches IdentStep1 style ────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div>
        <p className="text-eyebrow text-ink-mute mb-2">Identifícate</p>
        <p className="text-body text-ink-soft">
          Ingresa el correo que usarás en las evaluaciones. Recuérdalo — te pediremos el mismo cada vez que interactúes con la plataforma.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-caption text-ink block mb-1">Nombre</label>
            <input
              name="first_name"
              type="text"
              autoComplete="given-name"
              placeholder="Ana"
              className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
            />
          </div>
          <div>
            <label className="text-caption text-ink block mb-1">Apellido</label>
            <input
              name="last_name"
              type="text"
              autoComplete="family-name"
              placeholder="García"
              className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
            />
          </div>
        </div>

        <div>
          <label className="text-caption text-ink block mb-1">
            Correo electrónico <span className="text-borgona">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="ana@ejemplo.com"
            className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
          />
        </div>

        {error && <p className="text-caption text-borgona">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="py-2.5 px-5 bg-ink text-surface rounded-[8px] text-caption font-bold hover:bg-ink/90 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Guardando…" : "Continuar →"}
          </button>
          {switching && (
            <button
              type="button"
              onClick={() => setSwitching(false)}
              className="px-4 py-2.5 bg-surface-alt text-ink-soft rounded-[8px] text-caption font-medium hover:text-ink transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
