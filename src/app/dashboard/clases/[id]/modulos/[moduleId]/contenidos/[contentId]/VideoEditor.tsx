"use client";

import { useState, useTransition } from "react";
import { publishContentAction } from "@/app/dashboard/clases/[id]/actions";

interface Props {
  contentId: string;
  classId: string;
  initialDraft: Record<string, unknown>;
  isPublished: boolean;
}

function parseVideoUrl(url: string): { embedUrl: string; platform: "youtube" | "vimeo" } | null {
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    return { embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}`, platform: "youtube" };
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return { embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`, platform: "vimeo" };
  }
  return null;
}

export function VideoEditor({ contentId, classId, initialDraft, isPublished }: Props) {
  const [url, setUrl] = useState((initialDraft?.url as string) ?? "");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">(
    initialDraft?.url ? "saved" : "unsaved"
  );
  const [published, setPublished] = useState(isPublished);
  const [isPending, startTransition] = useTransition();

  const parsed = url.trim() ? parseVideoUrl(url.trim()) : null;

  async function save(newUrl: string) {
    setSaveStatus("saving");
    try {
      await fetch(`/api/contents/${contentId}/autosave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_draft: { url: newUrl } }),
      });
      setSaveStatus("saved");
    } catch {
      setSaveStatus("unsaved");
    }
  }

  function handlePublish() {
    startTransition(async () => {
      await save(url.trim());
      const result = await publishContentAction(contentId, classId);
      if (result?.ok) setPublished(true);
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface rounded-[10px] border border-subtle">
        <span className="text-mono text-ink-mute text-[12px]">
          {saveStatus === "saved" ? "Guardado" : saveStatus === "saving" ? "Guardando…" : "Sin guardar"}
        </span>
        <button
          onClick={handlePublish}
          disabled={isPending || !parsed}
          className="text-mono text-[12px] px-3 py-1.5 rounded-[6px] bg-ink text-page hover:bg-ink/80 disabled:opacity-40 transition-colors"
        >
          {published ? "Actualizar publicación" : "Publicar"}
        </button>
      </div>

      {/* URL input */}
      <div className="bg-surface rounded-[12px] border border-subtle p-5 space-y-3">
        <label className="text-caption font-medium text-ink block">URL del video</label>
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setSaveStatus("unsaved");
          }}
          onBlur={() => { if (url.trim()) save(url.trim()); }}
          placeholder="https://www.youtube.com/watch?v=… o https://vimeo.com/…"
          className="w-full px-3 py-2.5 rounded-[8px] border border-[rgba(0,0,0,0.12)] bg-page text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-2 focus:ring-ink/20"
        />
        {url.trim() && !parsed && (
          <p className="text-mono text-borgona text-[12px]">URL no reconocida. Pega un enlace de YouTube o Vimeo.</p>
        )}
        {parsed && (
          <p className="text-mono text-bosque text-[12px]">
            {parsed.platform === "youtube" ? "YouTube" : "Vimeo"} detectado.
          </p>
        )}
      </div>

      {/* Preview */}
      {parsed && (
        <div className="bg-surface rounded-[12px] border border-subtle overflow-hidden">
          <p className="text-caption text-ink-mute px-5 pt-4 pb-3">Vista previa</p>
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={parsed.embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
}
