"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lockup } from "@/components/Lockup";
import type { Accent } from "@/lib/schemas/shared";

interface Crumb {
  label: string;
  href?: string;
}

interface Props {
  classId: string;
  title: string;
  accent: Accent;
  splitAt: number | null;
  isPublished: boolean;
  moduleTitles: Record<string, string>;
}

const SECTIONS: Record<string, string> = {
  calificaciones: "Calificaciones",
  estudiantes: "Estudiantes",
  intentos: "Intentos",
  configuracion: "Configuración",
  gradebook: "Gradebook",
};

function buildCrumbs(pathname: string, base: string, moduleTitles: Record<string, string>): Crumb[] {
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).split("/").filter(Boolean) : [];
  if (rest.length === 0) return [];

  const [first, second] = rest;

  if (first === "modulos" && second) {
    const modLabel = moduleTitles[second] ?? "Módulo";
    if (rest[2] === "contenidos" && rest[3]) {
      return [{ label: modLabel, href: `${base}/modulos/${second}` }, { label: "Contenido" }];
    }
    return [{ label: modLabel }];
  }

  const section = SECTIONS[first];
  if (!section) return [];

  if (first === "calificaciones" && second === "categorias") {
    return [{ label: section, href: `${base}/${first}` }, { label: "Categorías" }];
  }
  if (first === "intentos" && second) {
    return [{ label: section, href: `${base}/${first}` }, { label: "Intento" }];
  }
  return [{ label: section }];
}

export function ClassHeaderCrumbs({ classId, title, accent, splitAt, isPublished, moduleTitles }: Props) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Volvemos a buscar el slot en cada render (no lo cacheamos): así el portal
  // nunca queda apuntando a un nodo desconectado tras un remonte/HMR del header.
  const slot = mounted ? document.getElementById("dashboard-header-slot") : null;
  if (!slot) return null;

  const base = `/dashboard/clases/${classId}`;
  const crumbs = buildCrumbs(pathname, base, moduleTitles);

  return createPortal(
    <>
      <Link href={base} className="shrink-0 hover:opacity-80 transition-opacity">
        <Lockup title={title} accent={accent} splitAt={splitAt} className="text-xl" />
      </Link>

      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-3 min-w-0">
          <span className="text-ink-mute shrink-0 text-[15px]">/</span>
          {crumb.href ? (
            <Link
              href={crumb.href}
              className="text-[15px] text-ink-soft hover:text-ink transition-colors truncate"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-[15px] text-ink truncate">{crumb.label}</span>
          )}
        </span>
      ))}

      <span
        className={`ml-2 text-mono px-2 py-0.5 rounded-[4px] shrink-0 ${
          isPublished ? "bg-bosque/10 text-bosque" : "bg-surface-alt text-ink-mute"
        }`}
      >
        {isPublished ? "Publicada" : "Borrador"}
      </span>
    </>,
    slot
  );
}
