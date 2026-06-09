"use client";

import type React from "react";
import { useState } from "react";
import { FileText, FileVideo, FileAudio, Image, FileSpreadsheet, Presentation, FileType2, Archive, Paperclip } from "lucide-react";

interface Props {
  contentId: string;
  body: Record<string, unknown> | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string): React.ReactElement {
  if (type.startsWith("image/")) return <Image size={36} />;
  if (type.startsWith("video/")) return <FileVideo size={36} />;
  if (type.startsWith("audio/")) return <FileAudio size={36} />;
  if (type === "application/pdf") return <FileText size={36} />;
  if (type.includes("spreadsheet") || type.includes("excel")) return <FileSpreadsheet size={36} />;
  if (type.includes("presentation") || type.includes("powerpoint")) return <Presentation size={36} />;
  if (type.includes("word") || type.includes("document")) return <FileType2 size={36} />;
  if (type === "application/zip") return <Archive size={36} />;
  return <Paperclip size={36} />;
}

export function FileRenderer({ contentId, body }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!body?.file_key) {
    return (
      <div className="bg-surface border border-subtle rounded-[12px] p-6 text-center">
        <p className="text-body text-ink-soft">Archivo no disponible.</p>
      </div>
    );
  }

  const fileName = body.file_name as string;
  const fileType = body.file_type as string;
  const fileSize = body.file_size as number;

  async function handleDownload() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contents/${contentId}/signed-url`);
      if (!res.ok) throw new Error("No se pudo obtener el enlace de descarga.");
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al descargar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-subtle rounded-[12px] p-6 flex items-center gap-5">
      <div className="text-ink-soft flex-none">{fileIcon(fileType)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-body text-ink font-medium truncate">{fileName}</p>
        <p className="text-caption text-ink-mute mt-0.5">
          {fileSize ? formatBytes(fileSize) : ""}
        </p>
        {error && <p className="text-caption text-borgona mt-1">{error}</p>}
      </div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="flex-none px-4 py-2 bg-ink text-page rounded-[8px] text-caption font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors"
      >
        {loading ? "Cargando…" : "Descargar"}
      </button>
    </div>
  );
}
