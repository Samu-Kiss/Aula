"use client";

import { useRef, useState, useTransition } from "react";
import { publishContentAction } from "@/app/dashboard/clases/[id]/actions";

interface Props {
  contentId: string;
  classId: string;
  initialDraft: Record<string, unknown>;
  isPublished: boolean;
}

const ACCEPTED_MIME =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.svg,.mp4,.mp3,.wav,.zip";

const MAX_SIZE_MB = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string): string {
  if (type.startsWith("image/")) return "🖼";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type === "application/pdf") return "📄";
  if (type.includes("spreadsheet") || type.includes("excel")) return "📊";
  if (type.includes("presentation") || type.includes("powerpoint")) return "📊";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type === "application/zip") return "🗜";
  return "📎";
}

type UploadStatus = "idle" | "uploading" | "done" | "error";

export function FileEditor({ contentId, classId, initialDraft, isPublished }: Props) {
  const [fileInfo, setFileInfo] = useState<{
    file_key: string;
    file_name: string;
    file_type: string;
    file_size: number;
  } | null>(
    initialDraft?.file_key
      ? {
          file_key: initialDraft.file_key as string,
          file_name: initialDraft.file_name as string,
          file_type: initialDraft.file_type as string,
          file_size: initialDraft.file_size as number,
        }
      : null
  );

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [published, setPublished] = useState(isPublished);
  const [publishing, startPublish] = useTransition();
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploadError(null);

    if (file.size > MAX_SIZE_BYTES) {
      setUploadError(`El archivo supera el límite de ${MAX_SIZE_MB} MB.`);
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(0);

    try {
      // Upload via our API (server-side to R2 — avoids CORS issues)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("prefix", `files/${classId}/${contentId}/`);
      formData.append("bucket", "private");

      const result = await new Promise<{ key: string; file_name: string; file_type: string; file_size: number }>(
        (resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/upload");
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 90));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try { resolve(JSON.parse(xhr.responseText)); }
              catch { reject(new Error("Respuesta inesperada del servidor.")); }
            } else {
              const msg = (() => { try { return JSON.parse(xhr.responseText).error; } catch { return `Error ${xhr.status}`; } })();
              reject(new Error(msg));
            }
          };
          xhr.onerror = () => reject(new Error("Error de red. Verifica tu conexión."));
          xhr.send(formData);
        }
      );

      setUploadProgress(95);

      // Save key + metadata to body_draft
      const info = { file_key: result.key, file_name: result.file_name, file_type: result.file_type, file_size: result.file_size };
      await fetch(`/api/contents/${contentId}/autosave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body_draft: info }),
      });

      setFileInfo(info);
      setUploadStatus("done");
      setUploadProgress(100);
    } catch (err: unknown) {
      setUploadStatus("error");
      setUploadError(err instanceof Error ? err.message : "Error al subir el archivo.");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handlePublish() {
    startPublish(async () => {
      const result = await publishContentAction(contentId, classId);
      if (result?.ok) setPublished(true);
    });
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface rounded-[10px] border border-subtle">
        <span className="text-mono text-ink-mute text-[12px]">
          {uploadStatus === "uploading"
            ? `Subiendo… ${uploadProgress}%`
            : uploadStatus === "done"
            ? "Archivo guardado"
            : fileInfo
            ? "Listo"
            : "Sin archivo"}
        </span>
        <button
          onClick={handlePublish}
          disabled={publishing || !fileInfo}
          className="text-mono text-[12px] px-3 py-1.5 rounded-[6px] bg-ink text-page hover:bg-ink/80 disabled:opacity-40 transition-colors"
        >
          {publishing ? "Publicando…" : published ? "Actualizar publicación" : "Publicar"}
        </button>
      </div>

      {/* Drop zone / file picker */}
      {uploadStatus !== "uploading" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`bg-surface rounded-[12px] border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
            isDragOver ? "border-indigo bg-indigo/4" : "border-subtle hover:border-indigo/40"
          }`}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_MIME}
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="text-4xl mb-3">{fileInfo ? fileIcon(fileInfo.file_type) : "📎"}</div>
          <p className="text-body text-ink font-medium">
            {fileInfo ? "Reemplazar archivo" : "Arrastra un archivo o haz clic para seleccionar"}
          </p>
          <p className="text-caption text-ink-mute mt-1">
            PDF, Word, Excel, PowerPoint, imágenes, video, audio, ZIP — hasta {MAX_SIZE_MB} MB
          </p>
        </div>
      )}

      {/* Upload progress */}
      {uploadStatus === "uploading" && (
        <div className="bg-surface rounded-[12px] border border-subtle p-6 space-y-3">
          <div className="flex items-center justify-between text-caption">
            <span className="text-ink-soft">Subiendo archivo…</span>
            <span className="text-ink font-medium">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-surface-alt rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo rounded-full transition-all duration-200"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error */}
      {uploadError && (
        <p className="text-caption text-borgona">{uploadError}</p>
      )}

      {/* File info preview */}
      {fileInfo && uploadStatus !== "uploading" && (
        <div className="bg-surface rounded-[12px] border border-subtle p-5 flex items-center gap-4">
          <div className="text-3xl flex-none">{fileIcon(fileInfo.file_type)}</div>
          <div className="flex-1 min-w-0">
            <p className="text-body text-ink font-medium truncate">{fileInfo.file_name}</p>
            <p className="text-caption text-ink-mute mt-0.5">
              {fileInfo.file_type} · {formatBytes(fileInfo.file_size)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
