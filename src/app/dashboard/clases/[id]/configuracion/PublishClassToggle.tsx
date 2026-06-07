"use client";

import { useState, useTransition } from "react";
import { publishClassAction, unpublishClassAction } from "@/app/dashboard/clases/[id]/actions";

interface Props {
  classId: string;
  isPublished: boolean;
}

export function PublishClassToggle({ classId, isPublished }: Props) {
  const [published, setPublished] = useState(isPublished);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (published) {
        await unpublishClassAction(classId);
        setPublished(false);
      } else {
        await publishClassAction(classId);
        setPublished(true);
      }
    });
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${published ? "bg-bosque" : "bg-ink-mute"}`} />
        <span className="text-body text-ink">
          {published ? "Publicada — visible para estudiantes" : "Borrador — solo tú puedes verla"}
        </span>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`px-4 py-2 rounded-[8px] text-caption font-bold transition-colors disabled:opacity-50 ${
          published
            ? "bg-surface-alt text-ink-soft hover:bg-borgona/10 hover:text-borgona"
            : "bg-ink text-surface hover:bg-ink/90"
        }`}
      >
        {pending ? "…" : published ? "Despublicar" : "Publicar clase"}
      </button>
    </div>
  );
}
