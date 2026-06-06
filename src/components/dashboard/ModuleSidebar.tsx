"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import type { Module } from "@/lib/types/db";
import { createModuleAction, reorderModulesAction } from "@/app/dashboard/clases/[id]/actions";

function SortableModule({
  mod,
  classId,
  active,
}: {
  mod: Module;
  classId: string;
  active: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: mod.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 group">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1 text-ink-mute opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Reordenar"
      >
        ⠿
      </button>
      <Link
        href={`/dashboard/clases/${classId}/modulos/${mod.id}`}
        className={`flex-1 flex items-center h-8 px-2 rounded-[8px] text-body truncate transition-colors ${
          active
            ? "bg-surface-alt text-ink font-medium"
            : "text-ink-soft hover:bg-surface-alt hover:text-ink"
        }`}
      >
        <span className="truncate">{mod.title}</span>
        {!mod.is_published && (
          <span className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-ink-mute" />
        )}
      </Link>
    </div>
  );
}

interface Props {
  classId: string;
  initialModules: Module[];
}

export function ModuleSidebar({ classId, initialModules }: Props) {
  const pathname = usePathname();
  const [modules, setModules] = useState(initialModules);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    const reordered = arrayMove(modules, oldIndex, newIndex).map((m, i) => ({
      ...m,
      order_index: i,
    }));
    setModules(reordered);

    startTransition(async () => {
      await reorderModulesAction(
        classId,
        reordered.map((m) => ({ id: m.id, order_index: m.order_index }))
      );
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const fd = new FormData();
    fd.set("title", title);
    startTransition(async () => {
      const result = await createModuleAction(classId, fd);
      if (result.ok) {
        setTitle("");
        setShowForm(false);
      }
    });
  }

  return (
    <div className="w-56 shrink-0 flex flex-col border-r border-[rgba(0,0,0,0.08)] bg-surface">
      <div className="px-3 py-3 border-b border-[rgba(0,0,0,0.08)] flex items-center justify-between">
        <span className="text-caption text-ink-mute">Módulos</span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-body text-ink-soft hover:text-ink transition-colors leading-none"
          aria-label="Nuevo módulo"
        >
          +
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="px-3 py-2 border-b border-[rgba(0,0,0,0.08)]">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre del módulo"
            className="w-full h-8 px-2 rounded-[8px] border-subtle bg-page text-body text-ink placeholder:text-ink-mute focus:outline-none focus:ring-1 focus:ring-ink/20"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              disabled={isPending || !title.trim()}
              className="text-caption text-ink hover:text-ink-soft transition-colors disabled:opacity-40"
            >
              Crear
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setTitle(""); }}
              className="text-caption text-ink-mute hover:text-ink transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <nav className="flex-1 px-2 py-2 overflow-y-auto space-y-0.5">
        <Link
          href={`/dashboard/clases/${classId}`}
          className={`flex items-center h-8 px-3 rounded-[8px] text-body transition-colors ${
            pathname === `/dashboard/clases/${classId}`
              ? "bg-surface-alt text-ink font-medium"
              : "text-ink-soft hover:bg-surface-alt hover:text-ink"
          }`}
        >
          Vista general
        </Link>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
            {modules.map((mod) => (
              <SortableModule
                key={mod.id}
                mod={mod}
                classId={classId}
                active={pathname.includes(mod.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {modules.length === 0 && !showForm && (
          <p className="px-3 py-2 text-mono text-ink-mute">Sin módulos</p>
        )}
      </nav>

      <div className="px-3 py-3 border-t border-[rgba(0,0,0,0.08)] space-y-0.5">
        <Link
          href={`/dashboard/clases/${classId}/configuracion`}
          className={`flex items-center h-8 px-3 rounded-[8px] text-body transition-colors ${
            pathname.includes("configuracion")
              ? "bg-surface-alt text-ink font-medium"
              : "text-ink-soft hover:bg-surface-alt hover:text-ink"
          }`}
        >
          Configuración
        </Link>
        <Link
          href={`/dashboard/clases/${classId}/preview`}
          className="flex items-center h-8 px-3 rounded-[8px] text-body text-ink-soft hover:bg-surface-alt hover:text-ink transition-colors"
          target="_blank"
        >
          Vista previa ↗
        </Link>
      </div>
    </div>
  );
}
