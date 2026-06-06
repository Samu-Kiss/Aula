"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { publishContentAction } from "@/app/dashboard/clases/[id]/actions";

type SaveStatus = "saved" | "saving" | "unsaved";

interface Props {
  contentId: string;
  classId: string;
  initialDraft: Record<string, unknown>;
  isPublished: boolean;
}

export function TiptapEditor({ contentId, classId, initialDraft, isPublished }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [published, setPublished] = useState(isPublished);
  const [isPending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: (initialDraft?.doc as object) ? { type: "doc", ...(initialDraft.doc as object) } : initialDraft,
    editorProps: {
      attributes: {
        class: "outline-none min-h-[400px] prose-aula",
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

  function handlePublish() {
    startTransition(async () => {
      // Save latest draft first
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

  const STATUS_LABEL: Record<SaveStatus, string> = {
    saved: "Guardado",
    saving: "Guardando…",
    unsaved: "Sin guardar",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 pb-3 border-b border-[rgba(0,0,0,0.08)]">
        <div className="flex items-center gap-1">
          <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive("bold")} label="N" title="Negrita" />
          <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive("italic")} label="I" title="Cursiva" className="italic" />
          <ToolbarButton onClick={() => editor?.chain().focus().toggleUnderline().run()} active={editor?.isActive("underline")} label="S" title="Subrayado" className="underline" />
          <ToolbarButton onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} active={editor?.isActive("heading", { level: 2 })} label="H2" title="Título" />
          <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive("bulletList")} label="•" title="Lista" />
          <ToolbarButton onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive("orderedList")} label="1." title="Lista numerada" />
          <ToolbarButton onClick={() => editor?.chain().focus().toggleBlockquote().run()} active={editor?.isActive("blockquote")} label="❝" title="Cita" />
          <ToolbarButton onClick={() => editor?.chain().focus().toggleCodeBlock().run()} active={editor?.isActive("codeBlock")} label="{}" title="Código" />
        </div>

        <div className="ml-auto flex items-center gap-4">
          <span
            aria-live="polite"
            className={`text-mono transition-colors ${
              saveStatus === "unsaved" ? "text-warning" : "text-ink-mute"
            }`}
          >
            {STATUS_LABEL[saveStatus]}
          </span>
          <button
            onClick={handlePublish}
            disabled={isPending}
            className={`h-8 px-4 rounded-[8px] text-caption font-bold transition-colors disabled:opacity-50 ${
              published
                ? "bg-surface-alt text-ink-soft hover:bg-surface-alt"
                : "bg-ink text-surface hover:bg-ink/90"
            }`}
          >
            {isPending ? "Publicando…" : published ? "Publicar cambios" : "Publicar"}
          </button>
        </div>
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
        active
          ? "bg-ink text-surface"
          : "text-ink-soft hover:bg-surface-alt hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
