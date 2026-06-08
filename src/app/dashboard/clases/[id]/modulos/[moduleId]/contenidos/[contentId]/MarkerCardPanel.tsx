"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";

export interface MarkerCategory { id: string; label: string; color: string; }
export interface MarkerCard { title: string; body: Record<string, unknown>; }

interface Props {
  markerIndex: number;
  initialCard: MarkerCard | undefined;
  categories: MarkerCategory[];
  selectedCategoryId: string | undefined;
  accentColor: string;
  onSave: (card: MarkerCard | null, categoryId: string | undefined) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function MarkerCardPanel({ markerIndex, initialCard, categories, selectedCategoryId, accentColor, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(initialCard?.title ?? "");
  const [categoryId, setCategoryId] = useState<string | undefined>(selectedCategoryId);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { style: `color: ${accentColor}; text-decoration: underline; text-underline-offset: 2px;` },
      }),
    ],
    content: initialCard?.body ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: { attributes: { class: "outline-none min-h-[80px] prose-aula text-[13px]" } },
  });

  function handleSave() {
    const body = editor?.getJSON() ?? {};
    const hasContent = title.trim() || editor?.getText().trim();
    onSave(hasContent ? { title: title.trim(), body } : null, categoryId);
  }

  return (
    <div className="bg-surface rounded-[12px] border border-subtle p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-mono text-ink-mute text-[12px]">Punto {markerIndex + 1}</span>
        <button onClick={onClose} className="text-ink-mute hover:text-ink transition-colors text-[14px]">✕</button>
      </div>

      {/* Category selector */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setCategoryId(undefined)}
            className={`h-6 px-2 rounded-full text-[11px] border transition-colors ${!categoryId ? "bg-ink text-page border-ink" : "border-subtle text-ink-soft hover:text-ink"}`}
          >
            Sin tipo
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryId(cat.id)}
              className="h-6 px-2 rounded-full text-[11px] flex items-center gap-1.5 border transition-colors"
              style={
                categoryId === cat.id
                  ? { background: cat.color, borderColor: cat.color, color: "white" }
                  : { borderColor: "rgba(0,0,0,0.12)", color: "#6B665C" }
              }
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
              {cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Title */}
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); editor?.commands.focus(); } }}
        placeholder="Nombre del lugar"
        className="w-full h-9 px-3 text-body font-medium rounded-[6px] border border-subtle bg-page focus:outline-none focus:ring-1 focus:ring-ink/20"
      />

      {/* Tiptap body */}
      <div
        className="border border-subtle rounded-[8px] px-3 py-2 bg-page cursor-text"
        style={{ "--link-color": accentColor } as React.CSSProperties}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center gap-2">
        <button onClick={handleSave} className="h-8 px-4 text-mono text-[12px] rounded-[6px] bg-ink text-page hover:bg-ink/80 transition-colors">
          Guardar
        </button>
        <button onClick={onDelete} className="h-8 px-3 text-mono text-[12px] rounded-[6px] border border-subtle text-ink-soft hover:text-red-500 hover:border-red-400 transition-colors ml-auto">
          Eliminar punto
        </button>
      </div>
    </div>
  );
}
