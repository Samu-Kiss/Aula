"use client";

import { useState, useTransition, useEffect } from "react";
import { updateClassMetaAction } from "@/app/dashboard/clases/[id]/actions";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

interface Props {
  classId: string;
  initialTitle: string;
  initialSlug: string;
  initialDescription: string | null;
  appUrl: string;
}

export function ClassMetaForm({ classId, initialTitle, initialSlug, initialDescription, appUrl }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [slug, setSlug] = useState(initialSlug);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startPending] = useTransition();

  // Auto-update slug from title unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(slugify(title));
    }
  }, [title, slugManuallyEdited]);

  function handleSlugChange(val: string) {
    setSlugManuallyEdited(true);
    // Only allow valid slug chars while typing
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaved(false);
    startPending(async () => {
      const result = await updateClassMetaAction(classId, { title, slug, description });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  const dirty =
    title !== initialTitle ||
    slug !== initialSlug ||
    description !== (initialDescription ?? "");

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Título */}
      <div>
        <label className="text-caption font-medium text-ink block mb-1">Título</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-page focus:outline-none focus:ring-2 focus:ring-indigo/30"
          placeholder="Mi clase de Biología"
        />
      </div>

      {/* Slug */}
      <div>
        <label className="text-caption font-medium text-ink block mb-1">Slug (URL)</label>
        <div className="flex items-center gap-2">
          <span className="text-mono text-ink-mute text-[13px] shrink-0">{appUrl}/c/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            maxLength={60}
            className="flex-1 border border-subtle rounded-[8px] px-3 py-2 text-mono text-ink bg-page focus:outline-none focus:ring-2 focus:ring-indigo/30"
            placeholder="mi-clase"
          />
        </div>
        <p className="text-mono text-ink-mute mt-1">
          URL completa: <span className="text-ink">{appUrl}/c/{slug || "…"}</span>
        </p>
        {slug !== initialSlug && (
          <p className="text-caption text-ambar mt-1">
            ⚠ Cambiar el slug rompe los links existentes hacia esta clase.
          </p>
        )}
      </div>

      {/* Descripción */}
      <div>
        <label className="text-caption font-medium text-ink block mb-1">
          Descripción <span className="text-ink-mute font-normal">(opcional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full border border-subtle rounded-[8px] px-3 py-2 text-body text-ink bg-page focus:outline-none focus:ring-2 focus:ring-indigo/30 resize-none"
          placeholder="Una breve descripción visible en la página pública de la clase…"
        />
        <p className="text-mono text-ink-mute text-right">{description.length}/500</p>
      </div>

      {error && <p className="text-caption text-borgona">{error}</p>}

      <button
        type="submit"
        disabled={pending || !dirty || !title.trim() || !slug.trim()}
        className="px-5 py-2 bg-ink text-surface rounded-[8px] text-caption font-bold hover:bg-ink/90 disabled:opacity-40 transition-colors"
      >
        {pending ? "Guardando…" : saved ? "¡Guardado!" : "Guardar cambios"}
      </button>
    </form>
  );
}
