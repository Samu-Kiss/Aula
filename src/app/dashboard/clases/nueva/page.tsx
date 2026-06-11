"use client";

import { useActionState, useEffect, useState } from "react";
import { createClassAction } from "./actions";
import type { Accent } from "@/lib/schemas/shared";

const ACCENTS: { value: Accent; label: string; hex: string }[] = [
  { value: "indigo",    label: "Índigo",    hex: "#4C51BF" },
  { value: "terracota", label: "Terracota", hex: "#C25733" },
  { value: "bosque",    label: "Bosque",    hex: "#24755B" },
  { value: "ciruela",   label: "Ciruela",   hex: "#9B478A" },
  { value: "ambar",     label: "Ámbar",     hex: "#C18924" },
  { value: "pizarra",   label: "Pizarra",   hex: "#3F638A" },
  { value: "borgona",   label: "Borgoña",   hex: "#922F41" },
  { value: "salvia",    label: "Salvia",    hex: "#737A43" },
];

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export default function NuevaClasePage() {
  const [state, action, pending] = useActionState(createClassAction, { status: "idle" });
  const [accent, setAccent] = useState<Accent>("indigo");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    if (!slugEdited) setSlug(slugify(title));
  }, [title, slugEdited]);

  const fields = state.status === "error" ? state.fields ?? {} : {};

  return (
    <div className="max-w-lg">
      <p className="text-eyebrow text-ink-mute mb-2">Dashboard</p>
      <h1 className="text-hero-dashboard font-black text-ink leading-none mb-8">
        Nueva clase
      </h1>

      <form action={action} className="space-y-5">
        {/* Título */}
        <div className="space-y-1">
          <label htmlFor="title" className="text-caption text-ink-soft block">
            Título
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!fields.title}
            aria-describedby={fields.title ? "title-error" : undefined}
            className="w-full h-11 px-3 rounded-[8px] border-subtle bg-surface text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-accent-indigo"
            placeholder="Historia bíblica"
          />
          {fields.title && (
            <p id="title-error" className="text-body text-error">{fields.title}</p>
          )}
        </div>

        {/* Slug */}
        <div className="space-y-1">
          <label htmlFor="slug" className="text-caption text-ink-soft block">
            URL pública
          </label>
          <div className="flex items-center gap-2">
            <span className="text-body text-ink-mute shrink-0">/c/</span>
            <input
              id="slug"
              name="slug"
              type="text"
              required
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
              aria-invalid={!!fields.slug}
              aria-describedby={fields.slug ? "slug-error" : undefined}
              className="flex-1 h-11 px-3 rounded-[8px] border-subtle bg-surface text-body text-ink font-mono placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-accent-indigo"
              placeholder="historia-biblica"
            />
          </div>
          {fields.slug && (
            <p id="slug-error" className="text-body text-error">{fields.slug}</p>
          )}
        </div>

        {/* Descripción */}
        <div className="space-y-1">
          <label htmlFor="description" className="text-caption text-ink-soft block">
            Descripción <span className="text-ink-mute">(opcional)</span>
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 rounded-[8px] border-subtle bg-surface text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-accent-indigo resize-none"
            placeholder="Del Génesis a los jueces…"
          />
        </div>

        {/* Acento */}
        <div className="space-y-2">
          <p className="text-caption text-ink-soft">Color de acento</p>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <label key={a.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="accent"
                  value={a.value}
                  checked={accent === a.value}
                  onChange={() => setAccent(a.value)}
                  aria-label={`Color de acento ${a.label}`}
                  className="sr-only"
                />
                <span
                  title={a.label}
                  className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all ${
                    accent === a.value ? "border-ink scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: a.hex }}
                />
              </label>
            ))}
          </div>
        </div>

        {state.status === "error" && !Object.keys(fields).length && (
          <p role="alert" className="text-body text-error">{state.message}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={pending}
            className="h-11 px-6 rounded-[8px] bg-ink text-surface text-caption font-bold hover:bg-ink/90 transition-colors disabled:opacity-50"
          >
            {pending ? "Creando…" : "Crear clase"}
          </button>
          <a
            href="/dashboard"
            className="text-body text-ink-soft hover:text-ink transition-colors"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
