import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { quizRepo } from "@/server/repositories/quizRepo";
import { CsvExport } from "./CsvExport";

interface Props {
  params: Promise<{ id: string }>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface QuizCol {
  quizId: string;
  title: string;
  module: string;
  maxScore: number;
  passingScore: number | null;
  attemptScoring: "best" | "average";
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
  cells: Record<string, CellData | null>; // quizId → cell
  totalPct: number | null; // weighted average across all quizzes
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function studentLabel(s: {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string;
}) {
  if (s.display_name) return s.display_name;
  if (s.first_name || s.last_name)
    return `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim();
  return s.email;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function GradebookPage({ params }: Props) {
  const { id: classId } = await params;
  const supabase = await createClient();

  const cls = await classService(supabase).getById(classId);
  if (!cls) notFound();

  const svc = createServiceClient();

  // 1. Collect all quiz columns (modules → contents → quizzes)
  const modules = await moduleRepo(supabase).listByClass(classId);
  const quizCols: QuizCol[] = [];

  for (const mod of modules) {
    const contents = await contentRepo(supabase).listByModule(mod.id);
    for (const c of contents.filter((c) => c.type === "quiz")) {
      const quiz = await quizRepo(svc).findByContentId(c.id);
      if (!quiz) continue;
      quizCols.push({
        quizId: quiz.id,
        title: c.title,
        module: mod.title,
        maxScore: quiz.max_score,
        passingScore: quiz.passing_score,
        attemptScoring: quiz.attempt_scoring,
      });
    }
  }

  if (quizCols.length === 0) {
    return (
      <div className="max-w-2xl">
        <p className="text-eyebrow text-ink-mute mb-2">Clase</p>
        <h1 className="text-h2 text-ink mb-4">Gradebook</h1>
        <p className="text-body text-ink-soft">
          No hay evaluaciones en esta clase todavía.
        </p>
      </div>
    );
  }

  // 2. Load all finished attempts for all quizzes
  const quizIds = quizCols.map((q) => q.quizId);
  const { data: allAttempts } = await svc
    .from("attempts")
    .select("id, quiz_id, student_id, score, max_score, status, submitted_at")
    .in("quiz_id", quizIds)
    .in("status", ["submitted", "graded"]);

  // 3. Load all students who have at least one attempt
  const studentIds = [...new Set((allAttempts ?? []).map((a) => a.student_id))];

  if (studentIds.length === 0) {
    return (
      <div className="max-w-2xl">
        <p className="text-eyebrow text-ink-mute mb-2">Clase</p>
        <h1 className="text-h2 text-ink mb-4">Gradebook</h1>
        <p className="text-body text-ink-soft">
          Ningún estudiante ha presentado evaluaciones todavía.
        </p>
      </div>
    );
  }

  const { data: students } = await svc
    .from("students")
    .select("id, email, first_name, last_name, display_name")
    .in("id", studentIds)
    .eq("is_anonymized", false)
    .order("last_name", { ascending: true });

  // 4. Build score map: studentId → quizId → attempts[]
  type ScoreEntry = { score: number; max: number };
  const scoreMap = new Map<string, Map<string, ScoreEntry[]>>();

  for (const a of allAttempts ?? []) {
    if (a.score == null || !a.quiz_id) continue;
    let byQuiz = scoreMap.get(a.student_id);
    if (!byQuiz) { byQuiz = new Map(); scoreMap.set(a.student_id, byQuiz); }
    const list = byQuiz.get(a.quiz_id) ?? [];
    list.push({ score: a.score, max: a.max_score ?? 0 });
    byQuiz.set(a.quiz_id, list);
  }

  // 5. Build rows
  const rows: StudentRow[] = (students ?? []).map((s) => {
    const byQuiz = scoreMap.get(s.id);
    const cells: Record<string, CellData | null> = {};
    let totalWeightedScore = 0;
    let totalMax = 0;

    for (const col of quizCols) {
      const attempts = byQuiz?.get(col.quizId) ?? [];
      if (attempts.length === 0) {
        cells[col.quizId] = null;
        continue;
      }

      // Apply attempt_scoring
      let score: number;
      const max = attempts[0].max > 0 ? attempts[0].max : col.maxScore;
      if (col.attemptScoring === "best") {
        score = Math.max(...attempts.map((a) => a.score));
      } else {
        score = attempts.reduce((acc, a) => acc + a.score, 0) / attempts.length;
      }

      const pct = max > 0 ? round1((score / max) * 100) : 0;
      const passing =
        col.passingScore != null ? pct >= col.passingScore : null;

      cells[col.quizId] = { score: round1(score), max, pct, passing, attemptCount: attempts.length };
      totalWeightedScore += score;
      totalMax += max;
    }

    const totalPct = totalMax > 0 ? round1((totalWeightedScore / totalMax) * 100) : null;

    return {
      studentId: s.id,
      email: s.email,
      name: studentLabel(s),
      cells,
      totalPct,
    };
  });

  // Sort: by totalPct desc, then name
  rows.sort((a, b) => {
    if (b.totalPct !== null && a.totalPct !== null) return b.totalPct - a.totalPct;
    if (b.totalPct !== null) return 1;
    if (a.totalPct !== null) return -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow text-ink-mute mb-1">Clase</p>
          <h1 className="text-h2 text-ink">Gradebook</h1>
          <p className="text-body text-ink-soft mt-1">
            {rows.length} estudiante{rows.length !== 1 ? "s" : ""} ·{" "}
            {quizCols.length} evaluacion{quizCols.length !== 1 ? "es" : ""}
          </p>
        </div>
        <CsvExport rows={rows} quizCols={quizCols} className={cls.title} />
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-[12px] border border-subtle">
        <table className="min-w-full text-body border-collapse">
          <thead>
            <tr className="bg-surface-alt border-b border-[rgba(0,0,0,0.06)]">
              <th className="sticky left-0 z-10 bg-surface-alt text-left text-caption text-ink-mute font-medium px-4 py-3 whitespace-nowrap min-w-[180px]">
                Estudiante
              </th>
              {quizCols.map((col) => (
                <th
                  key={col.quizId}
                  className="text-center text-caption text-ink-mute font-medium px-3 py-3 whitespace-nowrap min-w-[110px]"
                >
                  <p className="text-ink truncate max-w-[120px] mx-auto">{col.title}</p>
                  <p className="text-ink-mute font-normal mt-0.5">{col.module}</p>
                </th>
              ))}
              <th className="text-center text-caption text-ink-mute font-medium px-4 py-3 whitespace-nowrap min-w-[90px]">
                Promedio
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr
                key={row.studentId}
                className={`border-b border-[rgba(0,0,0,0.04)] last:border-0 ${
                  ri % 2 === 0 ? "bg-surface" : "bg-surface-alt/30"
                }`}
              >
                {/* Student name — sticky */}
                <td className={`sticky left-0 z-10 px-4 py-3 ${ri % 2 === 0 ? "bg-surface" : "bg-[#f9f9f8]"}`}>
                  <p className="text-body text-ink font-medium leading-snug">{row.name}</p>
                  <p className="text-mono text-ink-mute">{row.email}</p>
                </td>

                {/* Quiz cells */}
                {quizCols.map((col) => {
                  const cell = row.cells[col.quizId];
                  return (
                    <td key={col.quizId} className="px-3 py-3 text-center">
                      {cell == null ? (
                        <span className="text-mono text-ink-mute">—</span>
                      ) : (
                        <div>
                          <p className={`text-body font-semibold tabular-nums ${
                            cell.passing === true
                              ? "text-bosque"
                              : cell.passing === false
                              ? "text-borgona"
                              : "text-ink"
                          }`}>
                            {cell.pct}%
                          </p>
                          <p className="text-mono text-ink-mute">
                            {cell.score}/{cell.max}
                          </p>
                          {cell.attemptCount > 1 && (
                            <p className="text-mono text-ink-mute opacity-60">
                              {cell.attemptCount} intentos
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}

                {/* Overall */}
                <td className="px-4 py-3 text-center">
                  {row.totalPct != null ? (
                    <p className="text-body font-bold tabular-nums text-ink">
                      {row.totalPct}%
                    </p>
                  ) : (
                    <span className="text-mono text-ink-mute">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-caption text-ink-mute">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-bosque inline-block" />
          Aprobado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-borgona inline-block" />
          Reprobado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-ink-mute inline-block" />
          Sin calificar / Sin puntaje mínimo
        </span>
      </div>
    </div>
  );
}
