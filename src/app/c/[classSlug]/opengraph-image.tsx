import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { loadOgFonts } from "@/lib/og-fonts";
import type { Accent } from "@/lib/schemas/shared";

export const alt = "Clase en Aula";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ classSlug: string }>;
}

const ACCENT_COLORS: Record<Accent, string> = {
  indigo:    "#4C51BF",
  terracota: "#C25733",
  bosque:    "#24755B",
  ciruela:   "#9B478A",
  ambar:     "#B8821D",
  pizarra:   "#3F638A",
  borgona:   "#922F41",
  salvia:    "#737A43",
};

export default async function Image({ params }: Props) {
  const { classSlug } = await params;

  const supabase = await createClient();
  const cls = await classService(supabase).getBySlug(classSlug);

  const { inter, fraunces } = await loadOgFonts();

  // Fallback if class not found
  if (!cls) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#FAF8F3",
            fontFamily: "Inter",
            fontWeight: 900,
            fontSize: 48,
            color: "#A8A398",
          }}
        >
          Aula
        </div>
      ),
      { ...size, fonts: [{ name: "Inter", data: inter, style: "normal", weight: 900 }] },
    );
  }

  const accentColor = ACCENT_COLORS[cls.accent as Accent];

  const words = cls.title.trim().split(/\s+/);
  const split = cls.lockup_split_at ?? 1;
  const italic = words.slice(0, split).join(" ");
  const bold = words.slice(split).join(" ");

  // Scale font size to avoid overflow on long titles
  const len = cls.title.length;
  const fontSize = len > 28 ? 72 : len > 18 ? 96 : 116;

  const eyebrow =
    cls.description && cls.description.length > 0
      ? cls.description.length > 90
        ? cls.description.slice(0, 90) + "…"
        : cls.description
      : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "72px 96px 80px",
          background: "#FAF8F3",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Accent bar at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: accentColor,
          }}
        />

        {/* Description as eyebrow */}
        {eyebrow && (
          <p
            style={{
              fontFamily: "Inter",
              fontWeight: 400,
              fontSize: 20,
              color: "#A8A398",
              margin: "0 0 28px",
              maxWidth: 680,
            }}
          >
            {eyebrow}
          </p>
        )}

        {/* Lockup title */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            flexWrap: "wrap",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize,
              color: accentColor,
              lineHeight: 1,
            }}
          >
            {italic}
          </span>
          {bold && (
            <span
              style={{
                fontFamily: "Inter",
                fontWeight: 900,
                fontSize,
                letterSpacing: "-0.04em",
                color: "#1A1814",
                marginLeft: "-0.01em",
                lineHeight: 1,
              }}
            >
              {` ${bold}`}
            </span>
          )}
        </div>

        {/* Brand watermark */}
        <p
          style={{
            position: "absolute",
            bottom: 48,
            right: 96,
            fontFamily: "Inter",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: "-0.02em",
            color: "#C8C2B8",
            margin: 0,
          }}
        >
          Aula
        </p>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: inter, style: "normal", weight: 900 },
        { name: "Fraunces", data: fraunces, style: "italic", weight: 400 },
      ],
    },
  );
}
