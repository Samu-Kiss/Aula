"use client";

import { useRef, useState } from "react";
import { Calendar } from "lucide-react";

/**
 * Campo de fecha/hora con formato FORZADO dd/mm/aaaa hh:mm y selector de
 * calendario nativo.
 *
 * - El texto se enmascara mientras se escribe: solo dígitos, los separadores
 *   (/ /  :) se insertan solos. Es imposible escribir otro formato.
 * - El botón de calendario abre el picker nativo (showPicker) de un
 *   datetime-local oculto y sincronizado; al elegir fecha, el texto se
 *   actualiza ya formateado.
 * - El datetime-local nativo no se usa visible porque muestra el formato del
 *   locale del navegador (mm/dd en muchos equipos) y no se puede forzar.
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

function toDisplay(value: string): string {
  // "YYYY-MM-DDTHH:MM" → "dd/mm/yyyy hh:mm"
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

/** Aplica la máscara dd/mm/aaaa hh:mm sobre los dígitos escritos. */
function maskDigits(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 12); // ddmmyyyyhhmm
  let out = "";
  for (let i = 0; i < d.length; i++) {
    if (i === 2 || i === 4) out += "/";
    if (i === 8) out += " ";
    if (i === 10) out += ":";
    out += d[i];
  }
  return out;
}

/** "dd/mm/yyyy hh:mm" completo y válido → "YYYY-MM-DDTHH:MM"; si no, null. */
function toValue(display: string): string | null {
  const m = display.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, mi] = m;
  const day = Number(dd), month = Number(mm), hour = Number(hh), min = Number(mi);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || min > 59) return null;
  // Validar que la fecha exista (p. ej. 31/02 no)
  const date = new Date(Number(yyyy), month - 1, day, hour, min);
  if (date.getDate() !== day || date.getMonth() !== month - 1) return null;
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function DateTimeField({ value, onChange, id, className = "", ...aria }: Props) {
  const [text, setText] = useState(() => toDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const nativeRef = useRef<HTMLInputElement>(null);

  function emit(display: string) {
    if (display === "") {
      setInvalid(false);
      onChange("");
      return;
    }
    const parsed = toValue(display);
    if (parsed) {
      setInvalid(false);
      onChange(parsed);
    }
    // Incompleto: no emitimos; se marca inválido solo al salir del campo
  }

  function handleInput(raw: string) {
    const masked = maskDigits(raw);
    setText(masked);
    setInvalid(false);
    emit(masked);
  }

  function handleBlur() {
    if (text === "") return;
    setInvalid(toValue(text) == null);
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el) return;
    // Sincronizar el picker con lo que haya escrito (si es válido)
    el.value = toValue(text) ?? value ?? "";
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  function handleNativeChange(v: string) {
    setText(toDisplay(v));
    setInvalid(false);
    onChange(v);
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        id={id}
        value={text}
        onChange={(e) => handleInput(e.target.value)}
        onBlur={handleBlur}
        placeholder="dd/mm/aaaa hh:mm"
        aria-invalid={invalid || undefined}
        {...aria}
        className={`w-full border rounded-[8px] pl-3 pr-9 py-1.5 text-body text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40 ${
          invalid ? "border-borgona" : "border-subtle"
        } ${className}`}
      />
      <button
        type="button"
        onClick={openPicker}
        aria-label="Abrir calendario"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[6px] text-ink-mute hover:text-ink hover:bg-surface-alt transition-colors"
      >
        <Calendar size={14} aria-hidden />
      </button>
      {/* Picker nativo oculto: solo aporta el calendario, nunca se ve su
          formato de locale. Rendered (no display:none) para que showPicker
          funcione. */}
      <input
        ref={nativeRef}
        type="datetime-local"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => handleNativeChange(e.target.value)}
        className="absolute right-0 bottom-0 w-px h-px opacity-0 pointer-events-none"
      />
    </div>
  );
}
