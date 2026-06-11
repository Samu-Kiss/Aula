"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Campo de fecha/hora con formato FORZADO dd/mm/aaaa hh:mm y calendario
 * propio (no el nativo del navegador, que cambia de aspecto y de formato
 * según el locale — este se ve igual en todos lados y toma la tinta de
 * la clase via --class-accent).
 *
 * - El texto se enmascara mientras se escribe: solo dígitos, los
 *   separadores se insertan solos. Es imposible escribir otro formato.
 * - El botón abre un popover con el calendario y un campo de hora.
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

const WEEKDAYS = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const p2 = (n: number) => String(n).padStart(2, "0");

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

/** Máscara hh:mm para el campo de hora del popover. */
function maskTime(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

// ─── Popover de calendario ────────────────────────────────────────────────────

interface CalendarPopoverProps {
  /** Selección actual (Date) o null si el campo está vacío/incompleto */
  selected: Date | null;
  onPick: (d: Date) => void;
  onClose: () => void;
}

function CalendarPopover({ selected, onPick, onClose }: CalendarPopoverProps) {
  const today = new Date();
  const base = selected ?? today;
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth()); // 0-11
  const [time, setTime] = useState(
    selected ? `${p2(selected.getHours())}:${p2(selected.getMinutes())}` : "08:00"
  );

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function parsedTime(): [number, number] {
    const m = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return [0, 0];
    return [Math.min(23, Number(m[1])), Math.min(59, Number(m[2]))];
  }

  function pickDay(day: number) {
    const [hh, mi] = parsedTime();
    onPick(new Date(viewYear, viewMonth, day, hh, mi));
  }

  function applyTime(masked: string) {
    setTime(masked);
    // Si ya hay día elegido, actualizar la hora en vivo
    const m = masked.match(/^(\d{1,2}):(\d{2})$/);
    if (selected && m) {
      onPick(new Date(
        selected.getFullYear(), selected.getMonth(), selected.getDate(),
        Math.min(23, Number(m[1])), Math.min(59, Number(m[2]))
      ));
    }
  }

  // Lunes = 0 … domingo = 6
  const firstWeekday = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const isSelected = (day: number) =>
    selected != null &&
    selected.getFullYear() === viewYear &&
    selected.getMonth() === viewMonth &&
    selected.getDate() === day;
  const isToday = (day: number) =>
    today.getFullYear() === viewYear &&
    today.getMonth() === viewMonth &&
    today.getDate() === day;

  return (
    <div
      role="dialog"
      aria-label="Calendario"
      className="absolute z-50 top-full right-0 mt-2 w-[300px] p-5 bg-surface border border-subtle rounded-[12px] shadow-[0_8px_24px_rgba(26,24,20,0.10)]"
    >
      {/* Navegación de mes */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          aria-label="Mes anterior"
          className="p-1.5 rounded-[6px] text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors"
        >
          <ChevronLeft size={14} aria-hidden />
        </button>
        <p className="text-caption text-ink">
          {MONTHS[viewMonth]} <span className="font-serif italic normal-case text-[13px] text-ink-soft">{viewYear}</span>
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          aria-label="Mes siguiente"
          className="p-1.5 rounded-[6px] text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors"
        >
          <ChevronRight size={14} aria-hidden />
        </button>
      </div>

      {/* Días de la semana */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-mono text-ink-mute text-center py-1.5">{d}</span>
        ))}
      </div>

      {/* Grilla de días */}
      <div className="grid grid-cols-7 gap-y-1.5">
        {Array.from({ length: firstWeekday }).map((_, i) => <span key={`pad-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const sel = isSelected(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => pickDay(day)}
              className={`h-8 w-8 mx-auto rounded-[8px] text-[13px] tabular-nums transition-colors ${
                sel
                  ? "bg-accent-deep text-page font-semibold"
                  : isToday(day)
                  ? "text-ink font-semibold shadow-[inset_0_0_0_1px_var(--class-accent)]"
                  : "text-ink-soft hover:bg-surface-alt hover:text-ink"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      {/* Hora + cerrar */}
      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-hairline">
        <label className="flex items-center gap-2">
          <span className="text-caption text-ink-mute">Hora</span>
          <input
            type="text"
            inputMode="numeric"
            value={time}
            onChange={(e) => applyTime(maskTime(e.target.value))}
            placeholder="hh:mm"
            className="w-20 border border-subtle rounded-[6px] px-2.5 py-1.5 text-[13px] text-center tabular-nums text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        </label>
        <button
          type="button"
          onClick={onClose}
          className="text-caption font-semibold text-accent-deep hover:opacity-75 px-2 py-1 transition-opacity"
        >
          Listo
        </button>
      </div>
    </div>
  );
}

// ─── Campo ────────────────────────────────────────────────────────────────────

export function DateTimeField({ value, onChange, id, className = "", ...aria }: Props) {
  const [text, setText] = useState(() => toDisplay(value));
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Cerrar el popover con click afuera o Escape
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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

  function handlePick(d: Date) {
    const v = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
    setText(toDisplay(v));
    setInvalid(false);
    onChange(v);
  }

  const selectedDate = (() => {
    const v = toValue(text) ?? (value || null);
    if (!v) return null;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  })();

  return (
    <div ref={rootRef} className="relative">
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
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir calendario"
        aria-expanded={open}
        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-[6px] transition-colors ${
          open ? "text-accent-deep bg-surface-alt" : "text-ink-mute hover:text-ink hover:bg-surface-alt"
        }`}
      >
        <Calendar size={14} aria-hidden />
      </button>

      {open && (
        <CalendarPopover
          selected={selectedDate}
          onPick={handlePick}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
