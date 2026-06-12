"use client";

import { useEffect, useRef, useState } from "react";
import { accentHex } from "@/lib/accentColors";

interface ContentItem {
  id: string;
  slug: string;
  title: string;
  type: string;
}

interface Props {
  contents: ContentItem[];
  accent?: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  rich_text: "Lectura",
  video: "Video",
  map: "Mapa",
  file: "Archivo",
  quiz: "Evaluación",
};

export function ModuleContentsSidebar({ contents, accent }: Props) {
  const [activeSlug, setActiveSlug] = useState<string | null>(contents[0]?.slug ?? null);
  const hex = accentHex(accent);
  const locked = useRef(false);

  useEffect(() => {
    const slugs = contents.map((c) => c.slug);
    let rafId: number;

    function detect() {
      // getBoundingClientRect doesn't depend on which element scrolls —
      // it always returns position relative to the visible viewport.
      if (!locked.current) {
        // At the very top of the page, always show the first section —
        // avoids false positives when section 1 is short and section 2's
        // top is already inside any reasonable threshold.
        if (window.scrollY < 50) {
          setActiveSlug(slugs[0] ?? null);
        } else {
          // 40% of viewport scales with screen size (works on 4K).
          const triggerY = window.innerHeight * 0.4;
          let active = slugs[0] ?? null;
          for (const slug of slugs) {
            const el = document.getElementById(slug);
            if (!el) continue;
            if (el.getBoundingClientRect().top <= triggerY) active = slug;
          }
          setActiveSlug(active);
        }
      }
      rafId = requestAnimationFrame(detect);
    }

    rafId = requestAnimationFrame(detect);
    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClick(slug: string) {
    setActiveSlug(slug);
    locked.current = true;
    const el = document.getElementById(slug);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
    // Release lock after smooth scroll animation (~700ms)
    setTimeout(() => { locked.current = false; }, 800);
  }

  return (
    <nav aria-label="Contenidos del módulo">
      <ul className="space-y-0.5">
        {contents.map((c, i) => {
          const isActive = c.slug === activeSlug;
          return (
            <li key={c.id}>
              <a
                href={`#${c.slug}`}
                onClick={(e) => { e.preventDefault(); handleClick(c.slug); }}
                className={`flex items-start gap-2 px-2 py-2 rounded-[6px] transition-colors group ${
                  isActive ? "bg-surface" : "hover:bg-surface"
                }`}
              >
                <span className="text-mono text-[10px] text-ink-mute shrink-0 mt-0.5 tabular-nums w-5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={`text-[12px] leading-snug block ${
                      isActive ? "font-semibold" : "text-ink-soft group-hover:text-ink"
                    }`}
                    style={isActive && hex ? { color: hex } : undefined}
                  >
                    {c.title}
                  </span>
                  <span className="text-[10px] text-ink-mute mt-0.5 block">
                    {TYPE_LABEL[c.type] ?? c.type}
                  </span>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
