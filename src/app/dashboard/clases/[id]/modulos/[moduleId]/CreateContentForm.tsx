"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContentAction } from "@/app/dashboard/clases/[id]/actions";

const TYPES = [
  { value: "rich_text", label: "Lectura" },
  { value: "video",     label: "Video" },
  { value: "map",       label: "Mapa" },
  { value: "file",      label: "Archivo" },
  { value: "quiz",      label: "Evaluación" },
];

interface Props {
  moduleId: string;
  classId: string;
}

export function CreateContentForm({ moduleId, classId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("rich_text");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const fd = new FormData();
    fd.set("title", title);
    fd.set("type", type);
    startTransition(async () => {
      const result = await createContentAction(moduleId, classId, fd);
      if (result.ok) {
        router.push(`/dashboard/clases/${classId}/modulos/${moduleId}/contenidos/${result.id}`);
      } else {
        setError(result.error ?? "Error al crear.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-body text-ink-soft hover:text-ink transition-colors"
      >
        <span className="text-lg leading-none">+</span> Agregar contenido
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface rounded-[12px] border-subtle p-5 space-y-4">
      <p className="text-caption text-ink-mute">Nuevo contenido</p>

      <div className="space-y-1">
        <label htmlFor="content-title" className="text-caption text-ink-soft block">Título</label>
        <input
          id="content-title"
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="Ej. Introducción al Pentateuco"
          className="w-full h-10 px-3 rounded-[8px] border-subtle bg-page text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      <div className="space-y-1">
        <p className="text-caption text-ink-soft">Tipo</p>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <label key={t.value} className="cursor-pointer">
              <input
                type="radio"
                name="type"
                value={t.value}
                checked={type === t.value}
                onChange={() => setType(t.value)}
                className="sr-only"
              />
              <span className={`inline-flex h-8 items-center px-3 rounded-[8px] text-body transition-colors ${
                type === t.value
                  ? "bg-ink text-surface"
                  : "bg-surface-alt text-ink-soft hover:text-ink"
              }`}>
                {t.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-body text-error">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !title.trim()}
          className="h-9 px-4 rounded-[8px] bg-accent-deep text-page text-caption font-bold hover:bg-accent-deep/88 transition-colors disabled:opacity-50"
        >
          {isPending ? "Creando…" : "Crear"}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setTitle(""); setError(""); }}
          className="text-body text-ink-soft hover:text-ink transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
