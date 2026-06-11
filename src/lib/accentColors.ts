import type React from "react";
import type { Accent } from "@/lib/schemas/shared";

export const ACCENT_HEX: Record<Accent, string> = {
  indigo:    "#4C51BF",
  terracota: "#C25733",
  bosque:    "#24755B",
  ciruela:   "#9B478A",
  ambar:     "#B8821D",
  pizarra:   "#3F638A",
  borgona:   "#922F41",
  salvia:    "#737A43",
};

export function accentHex(accent: string | null | undefined): string | undefined {
  return accent ? ACCENT_HEX[accent as Accent] : undefined;
}

/**
 * Variante "deep" por acento: garantiza ≥4.5:1 con texto blanco para
 * rellenos sólidos (botones primarios, toggles). Los acentos ya oscuros
 * conservan su hex; los claros (terracota, ámbar, salvia) se oscurecen.
 */
export const ACCENT_DEEP: Record<Accent, string> = {
  indigo:    "#4C51BF",
  terracota: "#A8492A",
  bosque:    "#24755B",
  ciruela:   "#9B478A",
  ambar:     "#8A6419",
  pizarra:   "#3F638A",
  borgona:   "#922F41",
  salvia:    "#5F6836",
};

/**
 * Variables CSS de tinta por clase, para inyectar via `style` en el
 * wrapper del contexto de clase (dashboard de clase y rutas públicas).
 * Toda la UI interior resuelve `--class-accent` / `--class-accent-deep`.
 */
export function accentVars(accent: Accent): React.CSSProperties {
  return {
    "--class-accent": ACCENT_HEX[accent],
    "--class-accent-deep": ACCENT_DEEP[accent],
  } as React.CSSProperties;
}
