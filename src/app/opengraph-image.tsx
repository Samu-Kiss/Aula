import { ImageResponse } from "next/og";
import { loadOgFonts } from "@/lib/og-fonts";

export const alt = "Aula — Plataforma de clases";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const { inter, fraunces } = await loadOgFonts();

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
        {/* Indigo accent bar at top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: "#4C51BF",
          }}
        />

        {/* Eyebrow */}
        <p
          style={{
            fontFamily: "Inter",
            fontWeight: 900,
            fontSize: 18,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#A8A398",
            margin: "0 0 28px",
          }}
        >
          Te presentamos
        </p>

        {/* Lockup: "tu" italic serif + " aula" black sans */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            lineHeight: 1,
          }}
        >
          <span
            style={{
              fontFamily: "Fraunces",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 136,
              color: "#4C51BF",
              lineHeight: 1,
            }}
          >
            tu
          </span>
          <span
            style={{
              fontFamily: "Inter",
              fontWeight: 900,
              fontSize: 136,
              letterSpacing: "-0.04em",
              color: "#1A1814",
              marginLeft: "-0.01em",
              lineHeight: 1,
            }}
          >
            {" "}aula
          </span>
        </div>

        {/* Tagline */}
        <p
          style={{
            fontFamily: "Inter",
            fontWeight: 400,
            fontSize: 22,
            color: "#6B665C",
            margin: "36px 0 0",
            maxWidth: 520,
            lineHeight: 1.5,
          }}
        >
          Crea, organiza y publica tus clases. Tus estudiantes acceden sin
          registrarse.
        </p>

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
