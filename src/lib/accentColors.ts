import type { Accent } from "@/lib/schemas/shared";

export const ACCENT_HEX: Record<Accent, string> = {
  indigo:    "#4C51BF",
  terracota: "#C25733",
  bosque:    "#24755B",
  ciruela:   "#9B478A",
  ambar:     "#C18924",
  pizarra:   "#3F638A",
  borgona:   "#922F41",
  salvia:    "#737A43",
};

export function accentHex(accent: string | null | undefined): string | undefined {
  return accent ? ACCENT_HEX[accent as Accent] : undefined;
}
