"use client";

import type React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Link2, ImageIcon } from "lucide-react";
import { ACCENT_HEX } from "@/lib/accentColors";

export interface MapCard { title: string; body: Record<string, unknown>; }

// Exactly the 8 app accent colors — no extras
export const MAP_PALETTE = Object.values(ACCENT_HEX);

interface Props {
  entityType: "marker" | "route" | "area";
  entityIndex: number;
  initialCard: MapCard;
  initialColor: string | undefined;
  accentColor: string;
  onUpdate: (card: MapCard, color: string | undefined) => void;
  onDelete: () => void;
}

export function MapCardEditor({
  entityType, entityIndex, initialCard, initialColor,
  accentColor, onUpdate, onDelete,
}: Props) {
  const [title,           setTitle]           = useState(initialCard.title);
  const [color,           setColor]           = useState(initialColor);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [linkUrl,         setLinkUrl]         = useState<string | null>(null);
  const [imageUrl,        setImageUrl]        = useState<string | null>(null);
  const [imageError,      setImageError]      = useState<string | null>(null);
  const [imageChecking,   setImageChecking]   = useState(false);

  const linkInputRef   = useRef<HTMLInputElement>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorRef       = useRef(color);
  const titleRef       = useRef(title);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { titleRef.current = title; }, [title]);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorPickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (!colorPickerRef.current?.contains(e.target as Node)) setColorPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [colorPickerOpen]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);
  useEffect(() => { if (linkUrl  !== null) linkInputRef.current?.focus();  }, [linkUrl]);
  useEffect(() => { if (imageUrl !== null) imageInputRef.current?.focus(); }, [imageUrl]);

  // RichTextRenderer expects { doc: tiptapJSON }; wrap before saving
  const scheduleUpdate = useCallback((t: string, rawJson: Record<string, unknown>, c: string | undefined) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onUpdate({ title: t, body: { doc: rawJson } }, c), 700);
  }, [onUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false, autolink: true,
        HTMLAttributes: { style: `color:${accentColor};text-decoration:underline;text-underline-offset:2px;` },
      }),
      Image.configure({ allowBase64: true }),
    ],
    content: (() => {
      const b = initialCard.body;
      if (!b || !Object.keys(b).length) return { type: "doc", content: [{ type: "paragraph" }] };
      // New format: { doc: { type: "doc", content: [...] } }
      if (b.doc) return b.doc as Record<string, unknown>;
      // Old raw tiptap format: { type: "doc", content: [...] }
      if (b.type === "doc") return b;
      return { type: "doc", content: [{ type: "paragraph" }] };
    })(),
    editorProps: {
      attributes: { class: "outline-none prose-aula text-[13px]" },
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
            if (src) view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.image.create({ src })));
          };
          reader.readAsDataURL(file);
          return true;
        }
        return false;
      },
    },
    onUpdate({ editor }) {
      scheduleUpdate(titleRef.current, editor.getJSON() as Record<string, unknown>, colorRef.current);
    },
  });

  function handleTitleChange(v: string) {
    setTitle(v);
    scheduleUpdate(v, (editor?.getJSON() as Record<string, unknown>) ?? {}, colorRef.current);
  }

  function handleColorChange(c: string | undefined) {
    setColor(c);
    const rawJson = (editor?.getJSON() as Record<string, unknown>) ?? {};
    onUpdate({ title: titleRef.current, body: { doc: rawJson } }, c);
  }

  function openLinkInput()  { setLinkUrl(editor?.getAttributes("link").href ?? ""); setImageUrl(null); }
  function applyLink()      {
    if (linkUrl === null) return;
    if (!linkUrl.trim()) editor?.chain().focus().unsetLink().run();
    else editor?.chain().focus().setLink({ href: linkUrl.trim(), target: "_blank" }).run();
    setLinkUrl(null);
  }
  function openImageInput() { setImageUrl(""); setLinkUrl(null); setImageError(null); }
  function applyImage() {
    const src = imageUrl?.trim();
    if (!src) { setImageUrl(null); return; }
    setImageError(null); setImageChecking(true);
    const img = new window.Image();
    img.onload  = () => { setImageChecking(false); editor?.chain().focus().setImage({ src }).run(); setImageUrl(null); };
    img.onerror = () => { setImageChecking(false); setImageError("No se pudo cargar. Verifica la URL."); };
    img.src = src;
  }

  const entityLabel = entityType === "marker" ? `Punto ${entityIndex + 1}`
    : entityType === "route" ? `Ruta ${entityIndex + 1}`
    : `Área ${entityIndex + 1}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
        <span className="text-mono text-ink-mute text-[11px] uppercase tracking-wide shrink-0">{entityLabel}</span>

        {/* Compact color picker: single dot → popover */}
        <div ref={colorPickerRef} className="relative ml-1">
          <button
            onClick={() => setColorPickerOpen((p) => !p)}
            title="Color"
            className="w-4 h-4 rounded-full border-2 border-white shadow ring-1 ring-black/10 hover:scale-110 transition-transform"
            style={{ background: color ?? "#9CA3AF" }}
          />
          {colorPickerOpen && (
            <div className="absolute left-0 top-6 z-30 bg-page rounded-[8px] border border-subtle shadow-lg p-1.5 flex flex-wrap gap-1 w-[88px]">
              {MAP_PALETTE.map((c) => (
                <button key={c} onClick={() => { handleColorChange(c); setColorPickerOpen(false); }}
                  title={c}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${color === c ? "border-ink scale-110" : "border-transparent hover:border-ink/20"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          )}
        </div>

        <button onClick={onDelete} className="ml-auto text-[11px] text-ink-mute hover:text-red-500 transition-colors shrink-0">
          Eliminar
        </button>
      </div>

      {/* Title */}
      <input
        autoFocus
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); editor?.commands.focus(); } }}
        placeholder={entityType === "marker" ? "Nombre del lugar" : entityType === "route" ? "Nombre de la ruta" : "Nombre del área"}
        className="mx-3 mb-2 px-2.5 py-1.5 text-[13px] font-semibold rounded-[6px] border border-subtle bg-page focus:outline-none focus:ring-1 focus:ring-ink/20 shrink-0"
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-1 px-3 pb-2 border-b border-subtle shrink-0">
        <div className="flex items-center gap-0.5 flex-wrap">
          <TB onClick={() => editor?.chain().focus().toggleBold().run()}        active={editor?.isActive("bold")}                  label="N"  title="Negrita" />
          <TB onClick={() => editor?.chain().focus().toggleItalic().run()}      active={editor?.isActive("italic")}                label="I"  title="Cursiva" className="italic" />
          <TB onClick={() => editor?.chain().focus().toggleUnderline().run()}   active={editor?.isActive("underline")}             label="S"  title="Subrayado" className="underline" />
          <TB onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })} label="H2" title="Título" />
          <TB onClick={() => editor?.chain().focus().toggleBulletList().run()}  active={editor?.isActive("bulletList")}            label="•"  title="Lista" />
          <TB onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")}           label="1." title="Numerada" />
          <TB onClick={() => editor?.chain().focus().toggleBlockquote().run()}  active={editor?.isActive("blockquote")}            label="❝"  title="Cita" />
          <div className="w-px h-3.5 bg-[rgba(0,0,0,0.1)] mx-0.5" />
          <TB onClick={openLinkInput}  active={editor?.isActive("link") || linkUrl  !== null} label={<Link2 size={11} />} title="Enlace" />
          <TB onClick={openImageInput} active={imageUrl !== null}                             label={<ImageIcon size={11} />} title="Imagen" />
        </div>

        {linkUrl !== null && (
          <div className="flex items-center gap-1">
            <input ref={linkInputRef} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") applyLink(); if (e.key === "Escape") setLinkUrl(null); }}
              placeholder="https://..."
              className="flex-1 h-5 px-1.5 text-[11px] rounded-[4px] border border-[rgba(0,0,0,0.12)] bg-page focus:outline-none"
            />
            <button onClick={applyLink} className="h-5 px-1.5 text-[11px] rounded-[4px] bg-ink text-page shrink-0">
              {linkUrl.trim() ? "Ok" : "Quitar"}
            </button>
            <button onClick={() => setLinkUrl(null)} className="text-[11px] text-ink-mute">✕</button>
          </div>
        )}

        {imageUrl !== null && (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <input ref={imageInputRef} value={imageUrl}
                onChange={(e) => { setImageUrl(e.target.value); setImageError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") applyImage(); if (e.key === "Escape") { setImageUrl(null); setImageError(null); } }}
                placeholder="https://..."
                className={`flex-1 h-5 px-1.5 text-[11px] rounded-[4px] border bg-page focus:outline-none ${imageError ? "border-red-400" : "border-[rgba(0,0,0,0.12)]"}`}
              />
              <button onClick={applyImage} disabled={!imageUrl?.trim() || imageChecking}
                className="h-5 px-1.5 text-[11px] rounded-[4px] bg-ink text-page disabled:opacity-40 shrink-0">
                {imageChecking ? "…" : "Ok"}
              </button>
              <button onClick={() => { setImageUrl(null); setImageError(null); }} className="text-[11px] text-ink-mute">✕</button>
            </div>
            {imageError && <p className="text-[10px] text-red-500 pl-0.5">{imageError}</p>}
          </div>
        )}
      </div>

      {/* Editor body */}
      <div className="flex-1 overflow-y-auto px-3 py-2 cursor-text min-h-0" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} className="text-body text-ink" />
      </div>
    </div>
  );
}

function TB({ onClick, active, label, title, className = "" }: {
  onClick: () => void; active?: boolean; label: React.ReactNode; title: string; className?: string;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`h-5 min-w-[20px] px-1 rounded-[3px] text-[11px] transition-colors ${className} ${
        active ? "bg-ink text-surface" : "text-ink-soft hover:bg-surface-alt hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
