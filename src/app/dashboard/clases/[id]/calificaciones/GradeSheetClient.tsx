"use client";

import { useState } from "react";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { GradeCell } from "./GradeCell";
import { GradePanel, type SelectedCell } from "./GradePanel";
import { CalificacionesCsv } from "./CalificacionesCsv";

interface Category { id: string; name: string; weight: number }
interface Item { id: string; category_id: string; quiz_id: string | null; title: string; max_score: number }
interface Student { id: string; email: string; first_name: string | null; last_name: string | null; display_name: string | null }
interface GradeRow { grade_item_id: string; student_id: string; score: number | null; notes: string | null }

export interface Props {
  classId: string;
  className: string;
  categories: Category[];
  items: Item[];
  students: Student[];
  initialGrades: GradeRow[];
  /** key: `${quizId}:${studentId}` */
  autoScoreMap: Record<string, { score: number; max: number }>;
}

function studentLabel(s: Student) {
  if (s.display_name) return s.display_name;
  if (s.first_name || s.last_name) return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
  return s.email;
}

function round1(n: number) { return Math.round(n * 10) / 10; }

export function GradeSheetClient({
  classId, className, categories, items, students, initialGrades, autoScoreMap,
}: Props) {
  const [grades, setGrades] = useState<GradeRow[]>(initialGrades);
  const [selected, setSelected] = useState<SelectedCell | null>(null);

  const totalCategoryWeight = categories.reduce((acc, c) => acc + Number(c.weight), 0);

  // Build grade lookup
  const gradeMap = new Map<string, { score: number | null; notes: string | null }>();
  for (const g of grades) {
    gradeMap.set(`${g.grade_item_id}:${g.student_id}`, { score: g.score, notes: g.notes });
  }

  function getAutoScore(studentId: string, quizId: string) {
    return autoScoreMap[`${quizId}:${studentId}`] ?? null;
  }

  function computeFinal(studentId: string): number | null {
    if (totalCategoryWeight === 0) return null;
    let weightedSum = 0, weightUsed = 0;
    for (const cat of categories) {
      const catItems = items.filter((i) => i.category_id === cat.id);
      if (catItems.length === 0) continue;
      let catTotal = 0, catMax = 0;
      for (const item of catItems) {
        const g = gradeMap.get(`${item.id}:${studentId}`);
        if (g?.score != null) {
          catTotal += g.score; catMax += item.max_score;
        } else if (item.quiz_id) {
          const auto = getAutoScore(studentId, item.quiz_id);
          if (auto && auto.max > 0) {
            catTotal += (auto.score / auto.max) * item.max_score;
            catMax   += item.max_score;
          }
        }
      }
      if (catMax === 0) continue;
      weightedSum += (catTotal / catMax) * Number(cat.weight);
      weightUsed  += Number(cat.weight);
    }
    if (weightUsed === 0) return null;
    return round1((weightedSum / totalCategoryWeight) * 100);
  }

  function handleSelect(item: Item, student: Student, cat: Category) {
    const g = gradeMap.get(`${item.id}:${student.id}`);
    const auto = item.quiz_id ? getAutoScore(student.id, item.quiz_id) : null;
    setSelected({
      gradeItemId:  item.id,
      studentId:    student.id,
      itemTitle:    item.title,
      categoryName: cat.name,
      studentName:  studentLabel(student),
      studentEmail: student.email,
      maxScore:     item.max_score,
      currentScore: g?.score ?? null,
      currentNotes: g?.notes ?? null,
      autoScore:    auto?.score ?? null,
      autoMax:      auto?.max   ?? null,
    });
  }

  function handleSaved(
    gradeItemId: string, studentId: string,
    score: number | null, notes: string | null
  ) {
    setGrades((prev) => {
      const key = `${gradeItemId}:${studentId}`;
      const exists = prev.some((g) => g.grade_item_id === gradeItemId && g.student_id === studentId);
      if (exists) {
        return prev.map((g) =>
          g.grade_item_id === gradeItemId && g.student_id === studentId
            ? { ...g, score, notes }
            : g
        );
      }
      return [...prev, { grade_item_id: gradeItemId, student_id: studentId, score, notes }];
    });
    // Update selected cell's current values so the panel reflects the saved state
    setSelected((prev) =>
      prev && prev.gradeItemId === gradeItemId && prev.studentId === studentId
        ? { ...prev, currentScore: score, currentNotes: notes }
        : prev
    );
  }

  // Sort students: by final grade desc, then by name
  const rows = students.map((s) => ({ student: s, final: computeFinal(s.id) }));
  rows.sort((a, b) => {
    if (b.final !== null && a.final !== null) return b.final - a.final;
    if (b.final !== null) return 1;
    if (a.final !== null) return -1;
    return studentLabel(a.student).localeCompare(studentLabel(b.student));
  });

  // CSV data derived from current local grade state
  const csvRows = rows.map((r) => ({
    name: studentLabel(r.student),
    email: r.student.email,
    final: r.final,
    itemScores: items.map((item) => {
      const manual = gradeMap.get(`${item.id}:${r.student.id}`);
      const auto   = item.quiz_id ? getAutoScore(r.student.id, item.quiz_id) : null;
      const score  =
        manual?.score != null
          ? manual.score
          : auto
          ? (auto.max > 0 ? (auto.score / auto.max) * item.max_score : auto.score)
          : null;
      return { itemId: item.id, title: item.title, score, max: item.max_score };
    }),
  }));

  return (
    <div className="flex gap-6 items-start">
      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="w-72 shrink-0 sticky top-6 border border-subtle rounded-[12px] bg-surface p-5">
        <GradePanel
          classId={classId}
          selected={selected}
          onSaved={handleSaved}
          onClose={() => setSelected(null)}
        />
      </div>

      {/* ── Table area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-caption text-ink-mute">
            {rows.length} estudiante{rows.length !== 1 ? "s" : ""} · {items.length} ítem{items.length !== 1 ? "s" : ""}
          </p>
          <div className="flex gap-2">
            <Link
              href={`/dashboard/clases/${classId}/calificaciones/categorias`}
              className="px-3 py-1.5 text-caption text-ink-soft border border-subtle rounded-[8px] hover:text-ink hover:border-ink/30 transition-colors"
            >
              Categorías
            </Link>
            <CalificacionesCsv rows={csvRows} items={items} className={className} />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-[12px] border border-subtle">
          <table className="min-w-full text-body border-collapse">
            <thead>
              <tr className="bg-surface-alt border-b border-hairline">
                <th className="sticky left-0 z-10 bg-surface-alt text-left text-caption text-ink-mute font-medium px-4 py-3 whitespace-nowrap min-w-[180px]">
                  Estudiante
                </th>
                {categories.flatMap((cat) =>
                  items.filter((i) => i.category_id === cat.id).map((item) => (
                    <th key={item.id} className="text-center text-caption text-ink-mute font-medium px-3 py-3 whitespace-nowrap min-w-[100px]">
                      <p className="text-ink truncate max-w-[110px] mx-auto">{item.title}</p>
                      <p className="text-ink-mute font-normal mt-0.5">
                        {cat.name} · {cat.weight}%{item.quiz_id ? <><span className="mx-0.5">·</span><Link2 size={11} className="inline-block align-middle" /></> : ""}
                      </p>
                    </th>
                  ))
                )}
                <th className="text-center text-caption text-ink-mute font-medium px-4 py-3 whitespace-nowrap min-w-[80px]">
                  Final
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={items.length + 2} className="px-4 py-10 text-center text-body text-ink-soft">
                    No hay estudiantes activos.{" "}
                    <Link href={`/dashboard/clases/${classId}/estudiantes`} className="underline">Agregar</Link>
                  </td>
                </tr>
              ) : rows.map(({ student, final }, ri) => (
                <tr
                  key={student.id}
                  className={`border-b border-[rgba(0,0,0,0.04)] last:border-0 ${ri % 2 === 0 ? "bg-surface" : "bg-[#F7F5EF]"}`}
                >
                  <td className={`sticky left-0 z-10 px-4 py-3 ${ri % 2 === 0 ? "bg-surface" : "bg-[#F7F5EF]"}`}>
                    <p className="text-body text-ink font-medium leading-snug">{studentLabel(student)}</p>
                    <p className="text-mono text-ink-mute">{student.email}</p>
                  </td>
                  {categories.flatMap((cat) =>
                    items.filter((i) => i.category_id === cat.id).map((item) => {
                      const g = gradeMap.get(`${item.id}:${student.id}`);
                      const auto = item.quiz_id ? getAutoScore(student.id, item.quiz_id) : null;
                      const isSelected =
                        selected?.gradeItemId === item.id && selected?.studentId === student.id;
                      return (
                        <td key={item.id} className="px-1.5 py-2 text-center align-middle">
                          <GradeCell
                            score={g?.score ?? null}
                            notes={g?.notes ?? null}
                            maxScore={item.max_score}
                            autoScore={auto?.score ?? null}
                            autoMax={auto?.max ?? null}
                            isSelected={isSelected}
                            onSelect={() => handleSelect(item, student, cat)}
                          />
                        </td>
                      );
                    })
                  )}
                  <td className="px-4 py-3 text-center">
                    {final != null ? (
                      <p className="text-body font-bold tabular-nums text-ink">{final}%</p>
                    ) : (
                      <span className="text-mono text-ink-mute">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-mono text-ink-mute">Haz clic en una celda para editar.</p>
      </div>
    </div>
  );
}
