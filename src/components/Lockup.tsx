import type { Accent } from "@/lib/schemas/shared";

const ACCENT_COLORS: Record<Accent, string> = {
  indigo:    "#4C51BF",
  terracota: "#C25733",
  bosque:    "#24755B",
  ciruela:   "#9B478A",
  ambar:     "#C18924",
  pizarra:   "#3F638A",
  borgona:   "#922F41",
  salvia:    "#737A43",
};

interface Props {
  title: string;
  accent: Accent;
  splitAt?: number | null;
  className?: string;
  plain?: boolean;
}

export function Lockup({ title, accent, splitAt, className = "", plain = false }: Props) {
  const words = title.trim().split(/\s+/);
  const accentColor = plain ? undefined : ACCENT_COLORS[accent];

  // Single word with no explicit split → all accent serif, no sans portion
  if (words.length === 1 && splitAt == null) {
    return (
      <span className={`inline-flex items-baseline leading-none ${className}`}>
        <span className="font-serif italic text-ink" style={accentColor ? { color: accentColor } : undefined}>
          {words[0]}
        </span>
      </span>
    );
  }

  let italic: string;
  let bold: string;

  if (words.length === 1) {
    // splitAt was explicitly set on a single word — honour it
    const mid = splitAt!;
    italic = words[0].slice(0, mid);
    bold = words[0].slice(mid);
  } else {
    const split = splitAt ?? 1;
    italic = words.slice(0, split).join(" ");
    bold = words.slice(split).join(" ");
  }

  return (
    <span className={`inline-flex flex-wrap items-baseline leading-none ${className}`}>
      <span
        className="font-serif italic text-ink"
        style={accentColor ? { color: accentColor } : undefined}
      >
        {italic}
      </span>
      <span
        className="font-sans font-black text-ink"
        style={{ marginLeft: "-0.02em", letterSpacing: "-0.04em" }}
      >
        {bold ? ` ${bold}` : ""}
      </span>
    </span>
  );
}
