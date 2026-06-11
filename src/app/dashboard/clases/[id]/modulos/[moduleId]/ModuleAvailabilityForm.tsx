"use client";

import { useState, useTransition } from "react";
import { saveModuleAvailabilityAction } from "@/app/dashboard/clases/[id]/actions";
import type { Module } from "@/lib/types/db";

interface Props {
  module: Module;
  classId: string;
}

function isoToLocal(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 16);
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

  function handleSave() {
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
  }

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
          className={`relative transition-colors ${isAvailable ? "bg-bosque" : "bg-ink-mute"}`}
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
          <label className="text-caption text-ink-mute block mb-1">Abre</label>
          <input
            type="datetime-local"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
            className="w-full border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
          />
        </div>
        <div>
          <label className="text-caption text-ink-mute block mb-1">Cierra</label>
          <input
            type="datetime-local"
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="w-full border border-subtle rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-indigo/30"
          />
        </div>
      </div>
      <p className="text-mono text-ink-mute">Deja las fechas vacías para que el módulo esté disponible sin restricción de tiempo.</p>

      {error && <p className="text-caption text-borgona">{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="px-4 py-2 bg-indigo text-white rounded-[8px] text-caption font-medium hover:bg-indigo/90 disabled:opacity-50 transition-colors"
      >
        {saving ? "Guardando…" : saved ? "¡Guardado!" : "Guardar disponibilidad"}
      </button>
    </div>
  );
}
