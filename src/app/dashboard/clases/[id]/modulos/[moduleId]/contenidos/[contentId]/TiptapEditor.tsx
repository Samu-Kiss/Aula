"use client";

import type React from "react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Undo2, Redo2, Link2, ImagePlus, Loader2, ImageIcon } from "lucide-react";
import { publishContentAction, unpublishContentAction } from "@/app/dashboard/clases/[id]/actions";
import { accentHex } from "@/lib/accentColors";

type SaveStatus = "saved" | "saving" | "unsaved";

interface Props {
  contentId: string;
  classId: string;
  initialDraft: Record<string, unknown>;
  isPublished: boolean;
  accent?: string | null;
}

async function uploadImageToR2(file: File, contentId: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("prefix", `images/${contentId}/`);
  formData.append("bucket", "public");

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Error al subir la imagen (${res.status}).`);
  }
  const data = await res.json();
  if (!data.url) throw new Error("No se recibió URL pública de la imagen. Configura NEXT_PUBLIC_R2_PUBLIC_URL.");
  return data.url as string;
}

export function TiptapEditor({ contentId, classId, initialDraft, isPublished, accent }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [published, setPublished] = useState(isPublished);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inline toolbar inputs
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageChecking, setImageChecking] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          style: `color: ${accentHex(accent) ?? "inherit"}; text-decoration: underline; text-underline-offset: 2px;`,
        },
      }),
      Image.configure({ allowBase64: false }),
    ],
    content: (initialDraft?.doc as object) ? { type: "doc", ...(initialDraft.doc as object) } : initialDraft,
    editorProps: {
      attributes: {
        class: "outline-none min-h-[400px] prose-aula",
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (!item.type.startsWith("image/")) continue;
          const file = item.getAsFile();
          if (!file) continue;
          event.preventDefault();
          setImageUploading(true);
          uploadImageToR2(file, contentId)
            .then((src) => {
              view.dispatch(view.state.tr.replaceSelectionWith(
                view.state.schema.nodes.image.create({ src })
              ));
            })
            .catch(() => {
              // silent fail for paste — could show a toast in the future
            })
            .finally(() => setImageUploading(false));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      setSaveStatus("unsaved");
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await fetch(`/api/contents/${contentId}/autosave`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body_draft: { doc: editor.getJSON() } }),
          });
          setSaveStatus("saved");
        } catch {
          setSaveStatus("unsaved");
        }
      }, 2000);
    },
  });

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  // Focus the inline inputs when they open
  useEffect(() => { if (linkUrl !== null) linkInputRef.current?.focus(); }, [linkUrl]);
  useEffect(() => { if (imageUrl !== null) imageInputRef.current?.focus(); }, [imageUrl]);

  function handlePublish() {
    startTransition(async () => {
      if (editor) {
        await fetch(`/api/contents/${contentId}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body_draft: { doc: editor.getJSON() } }),
        });
      }
      const result = await publishContentAction(contentId, classId);
      if (result.ok) {
        setSaveStatus("saved");
        setPublished(true);
      }
    });
  }

  function handleUnpublish() {
    startTransition(async () => {
      const result = await unpublishContentAction(contentId, classId);
      if (result.ok) setPublished(false);
    });
  }

  function openLinkInput() {
    const existing = editor?.getAttributes("link").href ?? "";
    setLinkUrl(existing);
    setImageUrl(null);
  }

  function applyLink() {
    if (linkUrl === null) return;
    if (!linkUrl.trim()) {
      editor?.chain().focus().unsetLink().run();
    } else {
      editor?.chain().focus().setLink({ href: linkUrl.trim(), target: "_blank" }).run();
    }
    setLinkUrl(null);
  }

  function openImageInput() {
    setImageUrl("");
    setImageError(null);
    setLinkUrl(null);
  }

  function applyImage() {
    const src = imageUrl?.trim();
    if (!src) { setImageUrl(null); return; }
    setImageError(null);
    setImageChecking(true);
    const img = new window.Image();
    img.onload = () => {
      setImageChecking(false);
      editor?.chain().focus().setImage({ src }).run();
      setImageUrl(null);
    };
    img.onerror = () => {
      setImageChecking(false);
      setImageError("No se pudo cargar la imagen. Verifica que la URL sea correcta y accesible.");
    };
    img.src = src;
  }

  async function handleImageFileUpload(file: File) {
    setImageUrl(null);
    setImageError(null);
    setImageUploading(true);
    try {
      const src = await uploadImageToR2(file, contentId);
      editor?.chain().focus().setImage({ src }).run();
    } catch (err: unknown) {
      setImageError(err instanceof Error ? err.message : "Error al subir la imagen.");
    } finally {
      setImageUploading(false);
    }
  }

  const STATUS_LABEL: Record<SaveStatus, string> = {
    saved: "Guardado",
    saving: "Guardando…",
    unsaved: "Sin guardar",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageFileUpload(file);
          e.target.value = "";
        }}
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-2 pb-3 border-b border-hairline">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            <ToolbarButton onClick={() => editor?.chain().focus().undo().run()} active={false} label={<Undo2 size={14} />} title="Deshacer (Ctrl+Z)" />
            <ToolbarButton onClick={() => editor?.chain().focus().redo().run()} active={false} label={<Redo2 size={14} />} title="Rehacer (Ctrl+Y)" />
            <div className="w-px h-5 bg-[rgba(0,0,0,0.1)] mx-0.5" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} label="N" title="Negrita" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} label="I" title="Cursiva" className="italic" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive("underline")} label="S" title="Subrayado" className="underline" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })} label="H2" title="Título" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")} label="•" title="Lista" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")} label="1." title="Lista numerada" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive("blockquote")} label="❝" title="Cita" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive("codeBlock")} label="{}" title="Código" />
            <div className="w-px h-5 bg-[rgba(0,0,0,0.1)] mx-0.5" />
            <ToolbarButton onClick={openLinkInput} active={editor?.isActive("link") || linkUrl !== null} label={<Link2 size={14} />} title="Enlace" />
            <ToolbarButton
              onClick={() => fileInputRef.current?.click()}
              active={imageUploading}
              label={imageUploading ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
              title="Subir imagen desde archivo"
            />
            <ToolbarButton onClick={openImageInput} active={imageUrl !== null} label={<ImagePlus size={14} />} title="Imagen por URL" />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <span aria-live="polite" className={`text-mono transition-colors ${imageUploading ? "text-indigo" : saveStatus === "unsaved" ? "text-warning" : "text-ink-mute"}`}>
              {imageUploading ? "Subiendo imagen…" : STATUS_LABEL[saveStatus]}
            </span>
            <button
              onClick={handlePublish}
              disabled={isPending}
              className="h-8 px-4 rounded-[8px] text-caption font-bold transition-colors disabled:opacity-50 bg-accent-deep text-page hover:bg-accent-deep/88 whitespace-nowrap"
            >
              {isPending ? "Publicando…" : published ? "Publicar cambios" : "Publicar"}
            </button>
            {published && (
              <button
                onClick={handleUnpublish}
                disabled={isPending}
                className="h-8 px-3 rounded-[8px] text-caption text-ink-mute hover:text-borgona transition-colors disabled:opacity-50"
              >
                Despublicar
              </button>
            )}
          </div>
        </div>

        {/* Inline link input */}
        {linkUrl !== null && (
          <div className="flex items-center gap-2">
            <input
              ref={linkInputRef}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyLink(); if (e.key === "Escape") setLinkUrl(null); }}
              placeholder="https://..."
              className="flex-1 h-7 px-2 text-mono text-[12px] rounded-[6px] border border-[rgba(0,0,0,0.12)] bg-page focus:outline-none focus:ring-1 focus:ring-accent/40"
            />
            <button onClick={applyLink} className="h-7 px-3 text-mono text-[12px] rounded-[6px] bg-ink text-page hover:bg-ink/80 transition-colors">
              {linkUrl.trim() ? "Aplicar" : "Quitar"}
            </button>
            <button onClick={() => setLinkUrl(null)} className="h-7 px-2 text-mono text-[12px] text-ink-mute hover:text-ink transition-colors">
              ✕
            </button>
          </div>
        )}

        {/* Inline image URL input */}
        {imageUrl !== null && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImageError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") applyImage(); if (e.key === "Escape") { setImageUrl(null); setImageError(null); } }}
                placeholder="https://... (URL de la imagen)"
                className={`flex-1 h-7 px-2 text-mono text-[12px] rounded-[6px] border bg-page focus:outline-none focus:ring-1 transition-colors ${
                  imageError ? "border-red-400 focus:ring-red-300" : "border-[rgba(0,0,0,0.12)] focus:ring-accent/40"
                }`}
              />
              <button
                onClick={applyImage}
                disabled={!imageUrl?.trim() || imageChecking}
                className="h-7 px-3 text-mono text-[12px] rounded-[6px] bg-ink text-page hover:bg-ink/80 disabled:opacity-40 transition-colors"
              >
                {imageChecking ? "…" : "Insertar URL"}
              </button>
              <button onClick={() => { setImageUrl(null); setImageError(null); }} className="h-7 px-2 text-mono text-[12px] text-ink-mute hover:text-ink transition-colors">
                ✕
              </button>
            </div>
            {imageError && (
              <p className="text-[11px] text-red-500 pl-0.5">{imageError}</p>
            )}
          </div>
        )}

        {/* File upload image error (when imageUrl is null but error exists) */}
        {imageError && imageUrl === null && (
          <p className="text-[11px] text-red-500">{imageError}</p>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} className="text-body text-ink" />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  label,
  title,
  className = "",
}: {
  onClick: () => void;
  active?: boolean;
  label: React.ReactNode;
  title: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`h-7 min-w-[28px] px-1.5 rounded-[4px] text-body transition-colors ${className} ${
        active ? "bg-ink text-surface" : "text-ink-soft hover:bg-surface-alt hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
