import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { classService } from "@/server/services/classService";
import { moduleRepo } from "@/server/repositories/moduleRepo";
import { contentRepo } from "@/server/repositories/contentRepo";
import { quizRepo } from "@/server/repositories/quizRepo";
import { gradeRepo } from "@/server/repositories/gradeRepo";
import { GradeSheetClient } from "./GradeSheetClient";
import { CsvExport } from "../gradebook/CsvExport";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// ─── Tab Nav ──────────────────────────────────────────────────────────────────

function TabBar({ classId, active }: { classId: string; active: "notas" | "quices" }) {
  const base = "px-4 py-2 text-caption rounded-[8px] transition-colors";
  const on = "bg-ink text-surface font-medium";
  const off = "text-ink-soft hover:text-ink hover:bg-surface-alt";
  return (
    <div className="flex gap-1 p-1 bg-surface-alt rounded-[10px] w-fit">
      <Link href={`/dashboard/clases/${classId}/calificaciones?tab=notas`} className={`${base} ${active === "notas" ? on : off}`}>
        Notas
      </Link>
      <Link href={`/dashboard/clases/${classId}/calificaciones?tab=quices`} className={`${base} ${active === "quices" ? on : off}`}>
        Por quiz
      </Link>
    </div>
  );
}

// ─── Tab: Notas (grade_items) ─────────────────────────────────────────────────

async function NotasTab({ classId, className }: { classId: string; className: string }) {
  const svc = createServiceClient();
  const repo = gradeRepo(svc);

  const [categories, items, enrollments, grades] = await Promise.all([
    repo.listCategories(classId),
    repo.listItems(classId),
    repo.listEnrolled(classId),
    repo.listGradesByClass(classId),
  ]);

  const activeEnrollments = enrollments.filter((e) => e.status === "active");

  if (categories.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-subtle rounded-[12px]">
        {/* Tabla fantasma: anticipa la estructura del gradebook */}
        <div aria-hidden className="max-w-sm mx-auto mb-8 select-none">
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div className="h-5 rounded-[4px] bg-surface-alt" />
            <div className="h-5 rounded-[4px] bg-surface-alt opacity-80" />
            <div className="h-5 rounded-[4px] bg-surface-alt opacity-60" />
            <div className="h-5 rounded-[4px]" style={{ background: "color-mix(in srgb, var(--class-accent) 18%, transparent)" }} />
          </div>
          {[0.7, 0.5, 0.35].map((o) => (
            <div key={o} className="grid grid-cols-4 gap-2 mb-2" style={{ opacity: o }}>
              <div className="h-4 rounded-[4px] bg-surface-alt" />
              <div className="h-4 rounded-[4px] bg-surface-alt" />
              <div className="h-4 rounded-[4px] bg-surface-alt" />
              <div className="h-4 rounded-[4px] bg-surface-alt" />
            </div>
          ))}
        </div>
        <p className="text-h3 text-ink mb-1">Tu libro de calificaciones empieza aquí</p>
        <p className="text-body text-ink-soft mb-5 max-w-sm mx-auto">
          Define categorías con peso (ej. Quizzes 40%, Trabajos 40%, Participación 20%) y los
          quizzes alimentarán las notas solos.
        </p>
        <Link href={`/dashboard/clases/${classId}/calificaciones/categorias`} className="px-4 py-2 bg-accent-deep text-page text-caption rounded-[8px] hover:bg-accent-deep/88 transition-colors">
          <span className="inline-flex items-center gap-1">Configurar categorías <ChevronRight size={13} /></span>
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-subtle rounded-[12px]">
        <p className="text-body text-ink-soft mb-3">Las categorías no tienen ítems todavía.</p>
        <Link href={`/dashboard/clases/${classId}/calificaciones/categorias`} className="px-4 py-2 bg-accent-deep text-page text-caption rounded-[8px] hover:bg-accent-deep/88 transition-colors">
          <span className="inline-flex items-center gap-1">Agregar ítems <ChevronRight size={13} /></span>
        </Link>
      </div>
    );
  }

  // ── Build autoScoreMap (serializable for client component) ─────────────────
  const quizLinkedIds = [...new Set(items.map((i) => i.quiz_id).filter(Boolean) as string[])];
  const quizScoringMap = new Map<string, "best" | "average">();
  if (quizLinkedIds.length > 0) {
    const { data: quizRows } = await svc.from("quizzes").select("id, attempt_scoring").in("id", quizLinkedIds);
    for (const q of quizRows ?? []) quizScoringMap.set(q.id, (q.attempt_scoring as "best" | "average") ?? "best");
  }

  const attemptScores = await repo.listAttemptScoresByQuizIds(quizLinkedIds);
  const rawByStudentQuiz = new Map<string, Map<string, Array<{ score: number; max: number }>>>();
  for (const a of attemptScores) {
    if (a.score == null) continue;
    if (!rawByStudentQuiz.has(a.student_id)) rawByStudentQuiz.set(a.student_id, new Map());
    const byQuiz = rawByStudentQuiz.get(a.student_id)!;
    if (!byQuiz.has(a.quiz_id)) byQuiz.set(a.quiz_id, []);
    byQuiz.get(a.quiz_id)!.push({ score: a.score, max: a.max_score ?? 0 });
  }

  // Serialize as plain object keyed by `${quizId}:${studentId}`
  const autoScoreMap: Record<string, { score: number; max: number }> = {};
  for (const [studentId, byQuiz] of rawByStudentQuiz) {
    for (const [quizId, entries] of byQuiz) {
      if (entries.length === 0) continue;
      const scoring = quizScoringMap.get(quizId) ?? "best";
      const max = entries.find((e) => e.max > 0)?.max ?? 0;
      const score = scoring === "best"
        ? Math.max(...entries.map((e) => e.score))
        : entries.reduce((sum, e) => sum + e.score, 0) / entries.length;
      autoScoreMap[`${quizId}:${studentId}`] = { score, max };
    }
  }

  if (Math.abs(categories.reduce((a, c) => a + Number(c.weight), 0) - 100) > 0.01) {
    // warn banner rendered inside GradeSheetClient via a prop would be complex;
    // keep it simple as a sibling here
  }

  const totalWeight = categories.reduce((a, c) => a + Number(c.weight), 0);

  return (
    <div className="space-y-4">
      {Math.abs(totalWeight - 100) > 0.01 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] text-caption text-amber-800">
          Los pesos suman {totalWeight.toFixed(1)}% — la nota final puede no ser exacta.{" "}
          <Link href={`/dashboard/clases/${classId}/calificaciones/categorias`} className="underline">Ajustar</Link>
        </div>
      )}
      <GradeSheetClient
        classId={classId}
        className={className}
        categories={categories}
        items={items}
        students={activeEnrollments.map((e) => e.students)}
        initialGrades={grades}
        autoScoreMap={autoScoreMap}
      />
    </div>
  );
}

// ─── Tab: Por quiz (attempts-based) ──────────────────────────────────────────

async function QuicesTab({ classId, className }: { classId: string; className: string }) {
  const supabase = await createClient();
  const svc = createServiceClient();

  const modules = await moduleRepo(supabase).listByClass(classId);

  interface QuizCol {
    quizId: string; title: string; module: string;
    maxScore: number; passingScore: number | null; attemptScoring: "best" | "average";
  }
  interface CellData { score: number; max: number; pct: number; passing: boolean | null; attemptCount: number; }
  interface StudentRow { studentId: string; email: string; name: string; cells: Record<string, CellData | null>; totalPct: number | null; }

  const quizCols: QuizCol[] = [];
  for (const mod of modules) {
    const contents = await contentRepo(supabase).listByModule(mod.id);
    for (const c of contents.filter((c) => c.type === "quiz")) {
      const quiz = await quizRepo(svc).findByContentId(c.id);
      if (!quiz) continue;
      quizCols.push({ quizId: quiz.id, title: c.title, module: mod.title, maxScore: quiz.max_score, passingScore: quiz.passing_score, attemptScoring: quiz.attempt_scoring });
    }
  }

  if (quizCols.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-subtle rounded-[12px]">
        <p className="text-body text-ink-soft">No hay quices en esta clase todavía.</p>
      </div>
    );
  }

  const quizIds = quizCols.map((q) => q.quizId);
  const { data: allAttempts } = await svc
    .from("attempts")
    .select("id, quiz_id, student_id, score, max_score, status, submitted_at")
    .in("quiz_id", quizIds)
    .in("status", ["submitted", "graded"]);

  const studentIds = [...new Set((allAttempts ?? []).map((a) => a.student_id))];

  if (studentIds.length === 0) {
    return (
      <div className="py-12 text-center border border-dashed border-subtle rounded-[12px]">
        <p className="text-body text-ink-soft">Ningún estudiante ha presentado quices todavía.</p>
      </div>
    );
  }

  const { data: students } = await svc
    .from("students")
    .select("id, email, first_name, last_name, display_name")
    .in("id", studentIds)
    .order("last_name", { ascending: true });

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

  const rows: StudentRow[] = (students ?? []).map((s) => {
    const byQuiz = scoreMap.get(s.id);
    const cells: Record<string, CellData | null> = {};
    let totalWeightedScore = 0, totalMax = 0;
    for (const col of quizCols) {
      const attempts = byQuiz?.get(col.quizId) ?? [];
      if (attempts.length === 0) { cells[col.quizId] = null; continue; }
      const max = attempts[0].max > 0 ? attempts[0].max : col.maxScore;
      const score = col.attemptScoring === "best"
        ? Math.max(...attempts.map((a) => a.score))
        : attempts.reduce((acc, a) => acc + a.score, 0) / attempts.length;
      const pct = max > 0 ? round1((score / max) * 100) : 0;
      const passing = col.passingScore != null ? pct >= col.passingScore : null;
      cells[col.quizId] = { score: round1(score), max, pct, passing, attemptCount: attempts.length };
      totalWeightedScore += score;
      totalMax += max;
    }
    return { studentId: s.id, email: s.email, name: studentLabel(s), cells, totalPct: totalMax > 0 ? round1((totalWeightedScore / totalMax) * 100) : null };
  });

  rows.sort((a, b) => {
    if (b.totalPct !== null && a.totalPct !== null) return b.totalPct - a.totalPct;
    if (b.totalPct !== null) return 1;
    if (a.totalPct !== null) return -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-caption text-ink-mute">
          {rows.length} estudiante{rows.length !== 1 ? "s" : ""} · {quizCols.length} quiz{quizCols.length !== 1 ? "ces" : ""}
        </p>
        <CsvExport rows={rows} quizCols={quizCols} className={className} />
      </div>

      <div className="overflow-x-auto rounded-[12px] border border-subtle">
        <table className="min-w-full text-body border-collapse">
          <thead>
            <tr className="bg-surface-alt border-b border-hairline">
              <th className="sticky left-0 z-10 bg-surface-alt text-left text-caption text-ink-mute font-medium px-4 py-3 whitespace-nowrap min-w-[180px]">
                Estudiante
              </th>
              {quizCols.map((col) => (
                <th key={col.quizId} className="text-center text-caption text-ink-mute font-medium px-3 py-3 whitespace-nowrap min-w-[110px]">
                  <p className="text-ink truncate max-w-[120px] mx-auto">{col.title}</p>
                  <p className="text-ink-mute font-normal mt-0.5">{col.module}</p>
                </th>
              ))}
              <th className="text-center text-caption text-ink-mute font-medium px-4 py-3 whitespace-nowrap min-w-[90px]">Promedio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              // Cebra opaca (#F7F5EF = surface-alt al 30% sobre page): la celda
              // sticky necesita fondo opaco y debe coincidir con el resto de la fila
              <tr key={row.studentId} className={`border-b border-[rgba(0,0,0,0.04)] last:border-0 ${ri % 2 === 0 ? "bg-surface" : "bg-[#F7F5EF]"}`}>
                <td className={`sticky left-0 z-10 px-4 py-3 ${ri % 2 === 0 ? "bg-surface" : "bg-[#F7F5EF]"}`}>
                  <p className="text-body text-ink font-medium leading-snug">{row.name}</p>
                  <p className="text-mono text-ink-mute">{row.email}</p>
                </td>
                {quizCols.map((col) => {
                  const cell = row.cells[col.quizId];
                  return (
                    <td key={col.quizId} className="px-3 py-3 text-center">
                      {cell == null ? (
                        <span className="text-mono text-ink-mute">—</span>
                      ) : (
                        <div>
                          <p className={`text-body font-semibold tabular-nums inline-flex items-center gap-1.5 ${cell.passing === true ? "text-bosque" : cell.passing === false ? "text-borgona" : "text-ink"}`}>
                            <span
                              aria-hidden
                              className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${
                                cell.passing === true ? "bg-bosque" : cell.passing === false ? "bg-borgona" : "bg-ink-mute"
                              }`}
                            />
                            {cell.pct}%
                            <span className="sr-only">
                              {cell.passing === true ? " — aprobado" : cell.passing === false ? " — reprobado" : " — sin puntaje mínimo"}
                            </span>
                          </p>
                          <p className="text-mono text-ink-mute">{cell.score}/{cell.max}</p>
                          {cell.attemptCount > 1 && <p className="text-mono text-ink-mute opacity-60">{cell.attemptCount} intentos</p>}
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center">
                  {row.totalPct != null ? (
                    <p className="text-body font-bold tabular-nums text-ink">{row.totalPct}%</p>
                  ) : (
                    <span className="text-mono text-ink-mute">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-5 text-caption text-ink-mute">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-bosque inline-block" />Aprobado</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-borgona inline-block" />Reprobado</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-ink-mute inline-block" />Sin calificar / Sin puntaje mínimo</span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const metadata = { title: "Calificaciones" };

export default async function CalificacionesPage({ params, searchParams }: Props) {
  const { id: classId } = await params;
  const { tab = "notas" } = await searchParams;
  const activeTab = tab === "quices" ? "quices" : "notas";

  const supabase = await createClient();
  const cls = await classService(supabase).getById(classId);
  if (!cls) notFound();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-eyebrow text-ink-mute mb-1">Clase</p>
        <h1 className="text-h2 text-ink">Calificaciones</h1>
      </div>

      <TabBar classId={classId} active={activeTab} />

      {activeTab === "notas" ? (
        <NotasTab classId={classId} className={cls.title} />
      ) : (
        <QuicesTab classId={classId} className={cls.title} />
      )}
    </div>
  );
}
