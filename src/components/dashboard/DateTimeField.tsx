"use client";

import { useState } from "react";

/**
 * Campo de fecha/hora con formato fijo dd/mm/aaaa hh:mm.
 * El input nativo datetime-local muestra el formato del locale del navegador
 * (mm/dd/aaaa en muchos equipos), que no se puede forzar — este campo
 * garantiza el formato español en toda la app.
 *
 * `value` usa el mismo formato que datetime-local ("YYYY-MM-DDTHH:MM" o ""),
 * así que es un reemplazo directo en los formularios existentes.
 */

interface Props {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

const DISPLAY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})[ ,]+(\d{1,2}):(\d{2})$/;

function toDisplay(value: string): string {
  // "YYYY-MM-DDTHH:MM" → "dd/mm/yyyy hh:mm"
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

function toValue(display: string): string | null {
  const m = display.trim().match(DISPLAY_RE);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi] = m;
  const day = Number(dd), month = Number(mm), hour = Number(hh);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23) return null;
  // Validar que la fecha exista (p. ej. 31/02 no)
  const d = new Date(Number(yyyy), month - 1, day, hour, Number(mi));
  if (d.getDate() !== day || d.getMonth() !== month - 1) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${yyyy}-${p(month)}-${p(day)}T${p(hour)}:${mi}`;
}

export function DateTimeField({ value, onChange, id, className = "", ...aria }: Props) {
  const [text, setText] = useState(() => toDisplay(value));
  const [invalid, setInvalid] = useState(false);

  function handleChange(raw: string) {
    setText(raw);
    if (raw.trim() === "") {
      setInvalid(false);
      onChange("");
      return;
    }
    const parsed = toValue(raw);
    if (parsed) {
      setInvalid(false);
      onChange(parsed);
    } else {
      // No emitimos valores a medio escribir; se marca al salir del campo
      setInvalid(false);
    }
  }

  function handleBlur() {
    if (text.trim() === "") return;
    const parsed = toValue(text);
    if (parsed) {
      setText(toDisplay(parsed));
      setInvalid(false);
    } else {
      setInvalid(true);
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      value={text}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      placeholder="dd/mm/aaaa hh:mm"
      aria-invalid={invalid || undefined}
      {...aria}
      className={`w-full border rounded-[8px] px-3 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40 ${
        invalid ? "border-borgona" : "border-subtle"
      } ${className}`}
    />
  );
}
