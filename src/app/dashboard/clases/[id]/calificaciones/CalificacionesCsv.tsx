"use client";

interface ItemScore {
  itemId: string;
  title: string;
  score: number | null;
  max: number;
}

interface RowData {
  name: string;
  email: string;
  final: number | null;
  itemScores: ItemScore[];
}

interface GradeItem {
  id: string;
  title: string;
  max_score: number;
}

interface Props {
  rows: RowData[];
  items: GradeItem[];
  className: string;
}

export function CalificacionesCsv({ rows, items, className }: Props) {
  function download() {
    const headers = [
      "Estudiante",
      "Email",
      ...items.flatMap((i) => [`${i.title} [%]`, `${i.title} [pts/${i.max_score}]`]),
      "Nota Final [%]",
    ];

    const csvRows = rows.map((r) => [
      r.name,
      r.email,
      ...r.itemScores.flatMap((s) => {
        const pct =
          s.score != null && s.max > 0
            ? (Math.round((s.score / s.max) * 1000) / 10).toFixed(1)
            : "";
        return [pct, s.score?.toString() ?? ""];
      }),
      r.final?.toFixed(1) ?? "",
    ]);

    const bom = "﻿";
    const csv =
      bom +
      [headers, ...csvRows]
        .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const date = new Date().toISOString().slice(0, 10);
    const slug = className.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calificaciones_${slug}_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="px-3 py-1.5 text-caption bg-ink text-surface rounded-[8px] hover:bg-ink/90 transition-colors"
    >
      Exportar CSV
    </button>
  );
}
