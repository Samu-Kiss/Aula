"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveModuleAvailabilityAction } from "@/app/dashboard/clases/[id]/actions";
import { DateTimeField } from "@/components/dashboard/DateTimeField";
import type { Module } from "@/lib/types/db";

interface Props {
  module: Module;
  classId: string;
}

function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  // Hora LOCAL (no UTC): el campo muestra dd/mm/aaaa hh:mm en hora del equipo
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function localToIso(val: string): string | null {
  if (!val) return null;
  return new Date(val).toISOString();
}

export function ModuleAvailabilityForm({ module: mod, classId }: Props) {
  const [isAvailable, setIsAvailable] = useState(mod.is_available ?? true);
  const [opensAt, setOpensAt] = useState(isoToLocal(mod.opens_at));
  const [closesAt, setClosesAt] = useState(isoToLocal(mod.closes_at));
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const firstRender = useRef(true);

  // Autosave on change (debounce corto para no disparar por cada tecla
  // del datetime-local).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setError("");
      startSave(async () => {
        const result = await saveModuleAvailabilityAction(mod.id, classId, {
          is_available: isAvailable,
          opens_at: localToIso(opensAt),
          closes_at: localToIso(closesAt),
        });
        if (result.ok) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        } else {
          setError(result.error);
        }
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [isAvailable, opensAt, closesAt, mod.id, classId]);

  return (
    <div className="p-4 bg-surface border border-subtle rounded-[12px] space-y-4">
      <p className="text-caption font-medium text-ink">Ventana de disponibilidad</p>

      {/* Toggle is_available */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-body text-ink">Disponible para estudiantes</p>
          <p className="text-mono text-ink-mute mt-0.5">
            {isAvailable
              ? "Los estudiantes pueden ver este módulo"
              : "Módulo oculto — los estudiantes no lo verán"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAvailable((v) => !v)}
          style={{ width: 40, height: 24, borderRadius: 999, flexShrink: 0 }}
          className={`relative transition-colors ${isAvailable ? "bg-accent-deep" : "bg-ink-mute"}`}
          role="switch"
          aria-checked={isAvailable}
        >
          <span
            style={{
              position: "absolute",
              top: 4,
              left: isAvailable ? 20 : 4,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "white",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              transition: "left 0.15s ease",
            }}
          />
        </button>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="mod-opens-at" className="text-caption text-ink-mute block mb-1">Abre</label>
          <DateTimeField id="mod-opens-at" value={opensAt} onChange={setOpensAt} />
        </div>
        <div>
          <label htmlFor="mod-closes-at" className="text-caption text-ink-mute block mb-1">Cierra</label>
          <DateTimeField id="mod-closes-at" value={closesAt} onChange={setClosesAt} />
        </div>
      </div>
      <p className="text-mono text-ink-mute">Deja las fechas vacías para que el módulo esté disponible sin restricción de tiempo.</p>

      {error && <p className="text-caption text-borgona">{error}</p>}

      {/* Autosave: estado en vez de botón */}
      <p className="text-mono text-ink-mute h-4" role="status" aria-live="polite">
        {saving ? "Guardando…" : saved ? "Guardado ✓" : ""}
      </p>
    </div>
  );
}
