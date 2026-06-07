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

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`text-mono px-2 py-0.5 rounded-[4px] transition-colors disabled:opacity-50 cursor-pointer ${
        published
          ? "bg-bosque/10 text-bosque hover:bg-borgona/10 hover:text-borgona"
          : "bg-surface-alt text-ink-mute hover:bg-ink/10 hover:text-ink"
      }`}
      title={published ? "Clic para despublicar" : "Clic para publicar"}
    >
      {pending ? "…" : published ? "Publicado" : "Borrador"}
    </button>
  );
}
