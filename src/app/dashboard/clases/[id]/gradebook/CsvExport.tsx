"use client";

interface QuizCol {
  quizId: string;
  title: string;
  module: string;
  maxScore: number;
  passingScore: number | null;
  attemptScoring: string;
}

interface CellData {
  score: number;
  max: number;
  pct: number;
  passing: boolean | null;
  attemptCount: number;
}

interface StudentRow {
  studentId: string;
  email: string;
  name: string;
  cells: Record<string, CellData | null>;
  totalPct: number | null;
}

interface Props {
  rows: StudentRow[];
  quizCols: QuizCol[];
  className: string;
}

export function CsvExport({ rows, quizCols, className }: Props) {
  function handleExport() {
    const escape = (v: string) =>
      `"${v.replace(/"/g, '""')}"`;

    // Header row
    const header = [
      "Estudiante",
      "Correo",
      ...quizCols.map((c) => `${c.title} (${c.module}) [%]`),
      ...quizCols.map((c) => `${c.title} (${c.module}) [pts]`),
      "Promedio general [%]",
    ];

    // Data rows
    const dataRows = rows.map((row) => [
      row.name,
      row.email,
      ...quizCols.map((col) => {
        const cell = row.cells[col.quizId];
        return cell != null ? String(cell.pct) : "";
      }),
      ...quizCols.map((col) => {
        const cell = row.cells[col.quizId];
        return cell != null ? `${cell.score}/${cell.max}` : "";
      }),
      row.totalPct != null ? String(row.totalPct) : "",
    ]);

    const csv = [header, ...dataRows]
      .map((row) => row.map(escape).join(","))
      .join("\r\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `gradebook_${className.toLowerCase().replace(/\s+/g, "_")}_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="shrink-0 px-4 py-2 bg-surface border-subtle rounded-[8px] text-caption text-ink-soft hover:text-ink hover:border-ink/20 transition-colors"
    >
      Exportar CSV ↓
    </button>
  );
}
