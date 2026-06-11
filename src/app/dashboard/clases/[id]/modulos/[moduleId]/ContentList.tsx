"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, Loader2, Trash2 } from "lucide-react";
import type { Content } from "@/lib/types/db";
import { reorderContentsAction, deleteContentAction, duplicateContentAction } from "@/app/dashboard/clases/[id]/actions";

const CONTENT_LABELS: Record<string, string> = {
  rich_text: "Lectura",
  video: "Video",
  map: "Mapa",
  file: "Archivo",
  quiz: "Evaluación",
};

function SortableContent({
  content,
  index,
  classId,
  moduleId,
  onDeleted,
  onDuplicated,
}: {
  content: Content;
  index: number;
  classId: string;
  moduleId: string;
  onDeleted: (id: string) => void;
  onDuplicated: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: content.id });
  const [confirming, setConfirming] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [duplicating, startDuplicate] = useTransition();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function handleDelete() {
    startDelete(async () => {
      await deleteContentAction(content.id, classId);
      onDeleted(content.id);
    });
  }

  function handleDuplicate() {
    startDuplicate(async () => {
      await duplicateContentAction(content.id, moduleId, classId);
      onDuplicated();
    });
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 group">
      <button
        {...attributes}
        {...listeners}
        className="p-1.5 text-ink-mute opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100 cursor-grab active:cursor-grabbing touch-none shrink-0"
        aria-label="Reordenar"
      >
        ⠿
      </button>
      <Link
        href={`/dashboard/clases/${classId}/modulos/${moduleId}/contenidos/${content.id}`}
        className="flex-1 flex items-center gap-4 px-4 py-3 rounded-[12px] bg-surface border-subtle hover:border-ink/20 transition-colors"
      >
        <span className="text-mono text-ink-mute w-6 shrink-0">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1 text-body text-ink">{content.title}</span>
        <span className="text-mono text-ink-mute text-xs">
          {CONTENT_LABELS[content.type] ?? content.type}
        </span>
        <span
          title={content.is_published ? "Publicado — visible para estudiantes" : "Borrador — solo tú puedes verlo"}
          className={`text-mono text-xs px-1.5 py-0.5 rounded-[4px] ${
            content.is_published
              ? "bg-bosque/10 text-bosque"
              : "bg-surface-alt text-ink-mute"
          }`}
        >
          {content.is_published ? "✓ Publicado" : "Borrador"}
        </span>
      </Link>

      {/* Actions — appear on hover */}
      <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
        {/* Duplicate button */}
        <button
          onClick={handleDuplicate}
          disabled={duplicating}
          title="Duplicar contenido"
          className="p-1.5 text-ink-mute hover:text-ink transition-colors disabled:opacity-40"
        >
          {duplicating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Copy size={14} />
          )}
        </button>

        {/* Delete button */}
        {confirming ? (
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-2 py-1 text-mono text-[11px] rounded-[6px] bg-borgona text-white hover:bg-borgona/90 disabled:opacity-50 transition-colors"
            >
              {deleting ? "…" : "Eliminar"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-2 py-1 text-mono text-[11px] text-ink-mute hover:text-ink transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="p-1.5 text-ink-mute hover:text-borgona transition-colors"
            title="Eliminar contenido"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

interface Props {
  classId: string;
  moduleId: string;
  initialContents: Content[];
}

export function ContentList({ classId, moduleId, initialContents }: Props) {
  const [contents, setContents] = useState(initialContents);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function handleDeleted(id: string) {
    setContents((prev) => prev.filter((c) => c.id !== id));
  }

  function handleDuplicated() {
    router.refresh();
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = contents.findIndex((c) => c.id === active.id);
    const newIndex = contents.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(contents, oldIndex, newIndex).map((c, i) => ({
      ...c,
      order_index: i,
    }));
    setContents(reordered);

    startTransition(async () => {
      await reorderContentsAction(
        moduleId,
        classId,
        reordered.map((c) => ({ id: c.id, order_index: c.order_index }))
      );
    });
  }

  if (contents.length === 0) {
    return <p className="text-body text-ink-soft mb-6">No hay contenidos todavía.</p>;
  }

  return (
    <DndContext
      id="content-list-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={contents.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="space-y-2 mb-6">
          {contents.map((content, i) => (
            <li key={content.id}>
              <SortableContent
                content={content}
                index={i}
                classId={classId}
                moduleId={moduleId}
                onDeleted={handleDeleted}
                onDuplicated={handleDuplicated}
              />
            </li>
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
