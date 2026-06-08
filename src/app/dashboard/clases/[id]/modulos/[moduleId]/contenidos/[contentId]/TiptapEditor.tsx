"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { publishContentAction } from "@/app/dashboard/clases/[id]/actions";
import { accentHex } from "@/lib/accentColors";

type SaveStatus = "saved" | "saving" | "unsaved";

interface Props {
  contentId: string;
  classId: string;
  initialDraft: Record<string, unknown>;
  isPublished: boolean;
  accent?: string | null;
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
  const linkInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
      Image.configure({ allowBase64: true }),
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
          const reader = new FileReader();
          reader.onload = (e) => {
            const src = e.target?.result as string;
            if (src) view.dispatch(view.state.tr.replaceSelectionWith(
              view.state.schema.nodes.image.create({ src })
            ));
          };
          reader.readAsDataURL(file);
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

  const STATUS_LABEL: Record<SaveStatus, string> = {
    saved: "Guardado",
    saving: "Guardando…",
    unsaved: "Sin guardar",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 pb-3 border-b border-[rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 flex-wrap">
            <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} label="N" title="Negrita" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} label="I" title="Cursiva" className="italic" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive("underline")} label="S" title="Subrayado" className="underline" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })} label="H2" title="Título" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")} label="•" title="Lista" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")} label="1." title="Lista numerada" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive("blockquote")} label="❝" title="Cita" />
            <ToolbarButton onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive("codeBlock")} label="{}" title="Código" />
            <div className="w-px h-5 bg-[rgba(0,0,0,0.1)] mx-0.5" />
            <ToolbarButton onClick={openLinkInput} active={editor?.isActive("link") || linkUrl !== null} label="🔗" title="Enlace" />
            <ToolbarButton onClick={openImageInput} active={imageUrl !== null} label="🖼" title="Imagen" />
          </div>

          <div className="ml-auto flex items-center gap-4">
            <span aria-live="polite" className={`text-mono transition-colors ${saveStatus === "unsaved" ? "text-warning" : "text-ink-mute"}`}>
              {STATUS_LABEL[saveStatus]}
            </span>
            <button
              onClick={handlePublish}
              disabled={isPending}
              className={`h-8 px-4 rounded-[8px] text-caption font-bold transition-colors disabled:opacity-50 ${
                published ? "bg-surface-alt text-ink-soft hover:bg-surface-alt" : "bg-ink text-surface hover:bg-ink/90"
              }`}
            >
              {isPending ? "Publicando…" : published ? "Publicar cambios" : "Publicar"}
            </button>
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
              className="flex-1 h-7 px-2 text-mono text-[12px] rounded-[6px] border border-[rgba(0,0,0,0.12)] bg-page focus:outline-none focus:ring-1 focus:ring-ink/20"
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
                  imageError ? "border-red-400 focus:ring-red-300" : "border-[rgba(0,0,0,0.12)] focus:ring-ink/20"
                }`}
              />
              <button
                onClick={applyImage}
                disabled={!imageUrl?.trim() || imageChecking}
                className="h-7 px-3 text-mono text-[12px] rounded-[6px] bg-ink text-page hover:bg-ink/80 disabled:opacity-40 transition-colors"
              >
                {imageChecking ? "…" : "Insertar"}
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
  label: string;
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
