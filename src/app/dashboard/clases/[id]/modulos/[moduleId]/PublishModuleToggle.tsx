"use client";

import { useState, useTransition } from "react";
import { publishModuleAction, unpublishModuleAction } from "@/app/dashboard/clases/[id]/actions";

interface Props {
  moduleId: string;
  classId: string;
  isPublished: boolean;
}

export function PublishModuleToggle({ moduleId, classId, isPublished }: Props) {
  const [published, setPublished] = useState(isPublished);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (published) {
        await unpublishModuleAction(moduleId, classId);
        setPublished(false);
      } else {
        await publishModuleAction(moduleId, classId);
        setPublished(true);
      }
    });
  }

  // Chip de estado (informativo) + botón de acción explícito: antes el chip
  // era a la vez el botón de publicar, y nadie lo descubría.
  return (
    <div className="flex items-center gap-2">
      <span
        className={`text-mono px-2 py-0.5 rounded-[4px] ${
          published ? "bg-bosque/10 text-bosque" : "bg-surface-alt text-ink-mute"
        }`}
      >
        {published ? "Publicado" : "Borrador"}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className="text-caption font-medium px-3 py-1 rounded-[6px] border border-subtle text-ink-soft hover:text-ink hover:bg-surface-alt transition-colors disabled:opacity-50 cursor-pointer"
        title={
          published
            ? "Ocultar este módulo a los estudiantes"
            : "Hacer visible este módulo para los estudiantes"
        }
      >
        {pending ? "…" : published ? "Despublicar" : "Publicar módulo"}
      </button>
    </div>
  );
}
