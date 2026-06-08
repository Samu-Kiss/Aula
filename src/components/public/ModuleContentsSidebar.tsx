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
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const hex = accentHex(accent);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    contents.forEach(({ slug }) => {
      const el = document.getElementById(slug);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSlug(slug);
        },
        { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, [contents]);

  return (
    <nav aria-label="Contenidos del módulo">
      <ul className="space-y-0.5">
        {contents.map((c, i) => {
          const isActive = c.slug === activeSlug;
          return (
            <li key={c.id}>
              <a
                href={`#${c.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(c.slug)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setActiveSlug(c.slug);
                }}
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
