// Loads fonts for OG image generation (next/og / Satori).
// Satori requires TTF/OTF/WOFF — not WOFF2.
// The CSS v1 API with an IE11 UA returns WOFF, which Satori accepts.

async function fetchGoogleFont(
  family: string,
  weight: number,
  style: "normal" | "italic" = "normal",
): Promise<ArrayBuffer> {
  // CSS v1 family syntax: "Fraunces:400italic" or "Inter:900"
  const familyParam =
    style === "italic" ? `${family}:${weight}italic` : `${family}:${weight}`;

  const css = await fetch(
    `https://fonts.googleapis.com/css?family=${encodeURIComponent(familyParam)}&display=swap`,
    {
      headers: {
        // IE11 UA → Google returns WOFF (v1), which Satori supports
        "User-Agent":
          "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko",
      },
    },
  ).then((r) => r.text());

  const url = css.match(/url\((.+?)\)/)?.[1];
  if (!url) throw new Error(`[og-fonts] no URL for ${family} ${weight} ${style}`);

  return fetch(url).then((r) => r.arrayBuffer());
}

export async function loadOgFonts() {
  const [inter, fraunces] = await Promise.all([
    fetchGoogleFont("Inter", 900),
    fetchGoogleFont("Fraunces", 400, "italic"),
  ]);
  return { inter, fraunces };
}
