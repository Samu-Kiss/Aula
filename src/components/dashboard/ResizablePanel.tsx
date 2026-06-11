"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface Props {
  /** Clave de localStorage para persistir el ancho elegido. */
  storageKey: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  children: React.ReactNode;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

export function ResizablePanel({
  storageKey,
  defaultWidth = 224,
  minWidth = 160,
  maxWidth = 480,
  className = "",
  children,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(defaultWidth);
  const [measuring, setMeasuring] = useState(false);

  const persist = useCallback(
    (w: number) => {
      try {
        localStorage.setItem(storageKey, String(w));
      } catch {
        /* localStorage no disponible */
      }
    },
    [storageKey]
  );

  // Cargar ancho persistido tras montar (evita mismatch de hidratación).
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!Number.isNaN(n)) setWidth(clamp(n, minWidth, maxWidth));
    }
  }, [storageKey, minWidth, maxWidth]);

  // Autoajuste: mientras `measuring`, el panel usa max-content; medimos su
  // ancho natural, lo fijamos numéricamente y persistimos.
  useLayoutEffect(() => {
    if (!measuring) return;
    const el = ref.current;
    if (el) {
      const natural = el.scrollWidth;
      const w = clamp(natural, minWidth, maxWidth);
      setWidth(w);
      persist(w);
    }
    setMeasuring(false);
  }, [measuring, minWidth, maxWidth, persist]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = ref.current?.getBoundingClientRect().width ?? width;

      const onMove = (ev: PointerEvent) => {
        setWidth(clamp(startW + (ev.clientX - startX), minWidth, maxWidth));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setWidth((w) => {
          persist(w);
          return w;
        });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width, minWidth, maxWidth, persist]
  );

  const autoFit = useCallback(() => setMeasuring(true), []);

  const style = measuring
    ? ({ width: "max-content", minWidth, maxWidth } as const)
    : ({ width } as const);

  return (
    <div ref={ref} style={style} className={`relative box-border shrink-0 flex flex-col ${className}`}>
      {children}

      {/* Divisor: arrastrar = redimensionar; doble-clic = autoajustar al contenido */}
      <div
        onPointerDown={startDrag}
        onDoubleClick={autoFit}
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar columna (doble clic para ajustar al contenido)"
        className="group absolute top-0 right-0 h-full w-2 translate-x-1/2 cursor-col-resize z-20 flex justify-center"
      >
        <span className="w-px h-full bg-transparent group-hover:bg-ink/20 group-active:bg-ink/30 transition-colors" />
      </div>
    </div>
  );
}
