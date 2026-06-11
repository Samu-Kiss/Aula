"use client";

import { useState, useTransition, useEffect } from "react";
import { formatDate } from "@/lib/dates";
import { useRouter } from "next/navigation";
import {
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
  createItemAction,
  updateItemAction,
  deleteItemAction,
} from "../actions";

interface Category {
  id: string;
  name: string;
  weight: number;
  order_index: number;
}

interface GradeItem {
  id: string;
  category_id: string;
  quiz_id: string | null;
  title: string;
  max_score: number;
  due_at: string | null;
  missing_policy: string | null;
}

interface QuizOption {
  id: string;
  title: string;
  moduleName: string;
}

interface Props {
  classId: string;
  initialCategories: Category[];
  initialItems: GradeItem[];
  quizOptions: QuizOption[];
}

function weightColor(total: number) {
  if (total > 100) return "text-borgona";
  if (Math.abs(total - 100) < 0.01) return "text-bosque";
  return "text-amber-600";
}

export function CategoriasClient({ classId, initialCategories, initialItems, quizOptions }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [items, setItems] = useState(initialItems);

  // Sync local state when server component passes fresh props after router.refresh()
  useEffect(() => { setCategories(initialCategories); }, [initialCategories]);
  useEffect(() => { setItems(initialItems); }, [initialItems]);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [showNewCat, setShowNewCat] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalWeight = categories.reduce((acc, c) => acc + Number(c.weight), 0);

  // ── Category CRUD ────────────────────────────────────────────────────────────

  function handleAddCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const fd = new FormData(e.currentTarget);
    const form = e.currentTarget;
    startTransition(async () => {
      const res = await createCategoryAction(classId, fd);
      if (!res.ok) { setServerError(res.error ?? "Error"); return; }
      form.reset();
      setShowNewCat(false);
      router.refresh();
    });
  }

  function handleUpdateCategory(catId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateCategoryAction(classId, catId, fd);
      if (!res.ok) { setServerError(res.error ?? "Error"); return; }
      setEditingCat(null);
      router.refresh();
    });
  }

  function handleDeleteCategory(catId: string) {
    if (!confirm("¿Eliminar esta categoría y todos sus ítems de calificación?")) return;
    startTransition(async () => {
      await deleteCategoryAction(classId, catId);
      setCategories((prev) => prev.filter((c) => c.id !== catId));
      setItems((prev) => prev.filter((i) => i.category_id !== catId));
    });
  }

  // ── Item CRUD ────────────────────────────────────────────────────────────────

  function handleAddItem(catId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("category_id", catId);
    const form = e.currentTarget;
    startTransition(async () => {
      const res = await createItemAction(classId, fd);
      if (!res.ok) { setServerError(res.error ?? "Error"); return; }
      form.reset();
      setAddingItemFor(null);
      router.refresh();
    });
  }

  function handleUpdateItem(itemId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateItemAction(classId, itemId, fd);
      if (!res.ok) { setServerError(res.error ?? "Error"); return; }
      setEditingItem(null);
      router.refresh();
    });
  }

  function handleDeleteItem(itemId: string) {
    if (!confirm("¿Eliminar este ítem de calificación? Las notas ya registradas se perderán.")) return;
    startTransition(async () => {
      await deleteItemAction(classId, itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center justify-between p-4 bg-surface-alt rounded-[12px] border border-subtle">
        <div>
          <p className="text-caption text-ink-mute">Peso total asignado</p>
          <p className={`text-h3 font-bold tabular-nums ${weightColor(totalWeight)}`}>{totalWeight.toFixed(1)}%</p>
        </div>
        <div className="text-right">
          <p className="text-caption text-ink-mute">{categories.length} categoría{categories.length !== 1 ? "s" : ""}</p>
          {Math.abs(totalWeight - 100) > 0.01 && (
            <p className="text-mono text-amber-600">
              {totalWeight < 100 ? `Faltan ${(100 - totalWeight).toFixed(1)}%` : `Excede por ${(totalWeight - 100).toFixed(1)}%`}
            </p>
          )}
        </div>
      </div>

      {serverError && (
        <div className="p-3 bg-borgona/10 text-borgona rounded-[8px] text-caption">{serverError}</div>
      )}

      {/* Category list */}
      <div className="space-y-4">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category_id === cat.id);
          return (
            <div key={cat.id} className="border border-subtle rounded-[12px] overflow-hidden">
              {/* Category header */}
              {editingCat === cat.id ? (
                <form onSubmit={(e) => handleUpdateCategory(cat.id, e)} className="p-4 bg-surface-alt flex items-center gap-3">
                  <input name="name" defaultValue={cat.name} required maxLength={50} className="flex-1 h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40" />
                  <div className="flex items-center gap-1">
                    <input name="weight" type="number" min="0" max="100" step="0.1" defaultValue={cat.weight} required className="w-28 h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-accent/40" />
                    <span className="text-body text-ink-mute">%</span>
                  </div>
                  <button type="submit" disabled={isPending} className="px-3 py-1.5 text-caption bg-accent-deep text-page rounded-[8px] disabled:opacity-50">Guardar</button>
                  <button type="button" onClick={() => setEditingCat(null)} className="px-3 py-1.5 text-caption text-ink-soft hover:text-ink">Cancelar</button>
                </form>
              ) : (
                <div className="p-4 bg-surface-alt flex items-center gap-3">
                  <div className="flex-1">
                    <span className="text-body font-semibold text-ink">{cat.name}</span>
                    <span className="ml-2 text-caption text-ink-mute">{cat.weight}%</span>
                  </div>
                  <button onClick={() => setEditingCat(cat.id)} className="text-caption text-ink-mute hover:text-ink transition-colors">Editar</button>
                  <button onClick={() => handleDeleteCategory(cat.id)} disabled={isPending} className="text-caption text-borgona hover:text-borgona/80 transition-colors disabled:opacity-40">Eliminar</button>
                </div>
              )}

              {/* Items */}
              <div className="divide-y divide-[rgba(0,0,0,0.04)]">
                {catItems.length === 0 && addingItemFor !== cat.id && (
                  <p className="px-4 py-3 text-mono text-ink-mute">Sin ítems — agrega uno abajo.</p>
                )}
                {catItems.map((item) =>
                  editingItem === item.id ? (
                    // ── Inline edit form ──────────────────────────────────
                    <form
                      key={item.id}
                      onSubmit={(e) => handleUpdateItem(item.id, e)}
                      className="p-4 bg-surface-alt/50 space-y-3 border-t border-[rgba(0,0,0,0.04)]"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-mono text-ink-mute mb-1">Título *</label>
                          <input
                            name="title"
                            required
                            maxLength={80}
                            defaultValue={item.title}
                            className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40"
                          />
                        </div>
                        <div>
                          <label className="block text-mono text-ink-mute mb-1">Puntaje máximo *</label>
                          <input
                            name="max_score"
                            type="number"
                            min="0.1"
                            step="0.1"
                            defaultValue={item.max_score}
                            required
                            className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40"
                          />
                        </div>
                        <div>
                          <label className="block text-mono text-ink-mute mb-1">Vincular quiz</label>
                          <select
                            name="quiz_id"
                            defaultValue={item.quiz_id ?? ""}
                            className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40"
                          >
                            <option value="">— Ninguno —</option>
                            {quizOptions.map((q) => (
                              <option key={q.id} value={q.id}>{q.moduleName} / {q.title}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-mono text-ink-mute mb-1">Fecha de entrega</label>
                          <input
                            name="due_at"
                            type="datetime-local"
                            defaultValue={item.due_at ? item.due_at.slice(0, 16) : ""}
                            className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40"
                          />
                        </div>
                        <div>
                          <label className="block text-mono text-ink-mute mb-1">Política de ausente</label>
                          <select
                            name="missing_policy"
                            defaultValue={item.missing_policy ?? "ignore_until_due"}
                            className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40"
                          >
                            <option value="ignore_until_due">Ignorar hasta vencimiento</option>
                            <option value="zero_immediately">Cero inmediato</option>
                            <option value="ignore_always">Ignorar siempre</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={isPending} className="px-4 py-1.5 bg-accent-deep text-page text-caption rounded-[8px] disabled:opacity-50">Guardar</button>
                        <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-1.5 text-caption text-ink-soft hover:text-ink">Cancelar</button>
                      </div>
                    </form>
                  ) : (
                    // ── Read-only row ─────────────────────────────────────
                    <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-body text-ink">{item.title}</p>
                        <p className="text-mono text-ink-mute">
                          {item.max_score} pts
                          {item.quiz_id && (
                            <span className="ml-2 px-1.5 py-0.5 bg-surface-alt text-ink-mute rounded-[4px]">
                              Quiz vinculado
                            </span>
                          )}
                          {item.due_at && (
                            <span className="ml-2">· Vence {formatDate(item.due_at)}</span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => { setEditingItem(item.id); setAddingItemFor(null); }}
                        className="text-caption text-ink-mute hover:text-ink transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={isPending}
                        className="text-caption text-borgona hover:text-borgona/80 transition-colors disabled:opacity-40"
                      >
                        Eliminar
                      </button>
                    </div>
                  )
                )}

                {/* Add item form */}
                {addingItemFor === cat.id ? (
                  <form onSubmit={(e) => handleAddItem(cat.id, e)} className="p-4 bg-surface-alt/50 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-mono text-ink-mute mb-1">Título *</label>
                        <input name="title" required maxLength={80} placeholder="ej: Taller 1, Parcial Midterm…" className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40" />
                      </div>
                      <div>
                        <label className="block text-mono text-ink-mute mb-1">Puntaje máximo *</label>
                        <input name="max_score" type="number" min="0.1" step="0.1" defaultValue={100} required className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40" />
                      </div>
                      <div>
                        <label className="block text-mono text-ink-mute mb-1">Vincular quiz (opcional)</label>
                        <select name="quiz_id" className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40">
                          <option value="">— Ninguno —</option>
                          {quizOptions.map((q) => (
                            <option key={q.id} value={q.id}>{q.moduleName} / {q.title}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-mono text-ink-mute mb-1">Fecha de entrega</label>
                        <input name="due_at" type="datetime-local" className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40" />
                      </div>
                      <div>
                        <label className="block text-mono text-ink-mute mb-1">Política de ausente</label>
                        <select name="missing_policy" className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40">
                          <option value="ignore_until_due">Ignorar hasta vencimiento</option>
                          <option value="zero_immediately">Cero inmediato</option>
                          <option value="ignore_always">Ignorar siempre</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="submit" disabled={isPending} className="px-4 py-1.5 bg-accent-deep text-page text-caption rounded-[8px] disabled:opacity-50">Agregar ítem</button>
                      <button type="button" onClick={() => setAddingItemFor(null)} className="px-4 py-1.5 text-caption text-ink-soft hover:text-ink">Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setAddingItemFor(cat.id)}
                    className="w-full px-4 py-2.5 text-left text-caption text-ink-mute hover:text-ink hover:bg-surface-alt/50 transition-colors"
                  >
                    + Agregar ítem
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* New category */}
      {showNewCat ? (
        <form onSubmit={handleAddCategory} className="p-4 border border-subtle rounded-[12px] bg-surface-alt space-y-3">
          <p className="text-caption font-medium text-ink">Nueva categoría</p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-mono text-ink-mute mb-1">Nombre *</label>
              <input name="name" required maxLength={50} placeholder="ej: Quices, Parciales, Proyecto…" className="w-full h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink focus:outline-none focus:ring-1 focus:ring-accent/40" />
            </div>
            <div>
              <label className="block text-mono text-ink-mute mb-1">Peso %</label>
              <div className="flex items-center gap-1">
                <input name="weight" type="number" min="0" max="100" step="0.1" defaultValue={Math.max(0, 100 - totalWeight)} required className="w-28 h-9 px-3 rounded-[8px] border border-subtle bg-page text-body text-ink tabular-nums focus:outline-none focus:ring-1 focus:ring-accent/40" />
                <span className="text-body text-ink-mute">%</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="px-4 py-1.5 bg-accent-deep text-page text-caption rounded-[8px] disabled:opacity-50">Crear</button>
            <button type="button" onClick={() => setShowNewCat(false)} className="px-4 py-1.5 text-caption text-ink-soft hover:text-ink">Cancelar</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowNewCat(true)}
          className="w-full py-3 border border-dashed border-subtle rounded-[12px] text-caption text-ink-mute hover:text-ink hover:border-ink/30 transition-colors"
        >
          + Nueva categoría
        </button>
      )}
    </div>
  );
}
