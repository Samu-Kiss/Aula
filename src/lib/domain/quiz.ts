/**
 * Pure domain functions for quiz state and attempt logic.
 * No framework imports — safe to run in any environment (tests, edge, server).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type EffectiveState = "available" | "upcoming" | "past" | "locked";

export interface QuizLike {
  is_available: boolean;
  opens_at: string | null;
  closes_at: string | null;
  attempts_allowed: number;
}

export interface ModuleLike {
  is_published: boolean;
  is_available: boolean;
  opens_at: string | null;
  closes_at: string | null;
}

export interface AttemptLike {
  status: "in_progress" | "submitted" | "graded" | "abandoned";
  expires_at: string | null;
}

export interface QuestionSnapshot {
  id: string;
  points: number;
  type: string;
  body_snapshot: Record<string, unknown>;
}

export interface AnswerLike {
  question_id: string;
  response: Record<string, unknown>;
}

// ─── Availability ─────────────────────────────────────────────────────────────

/** Compute the effective availability state of a module at a given instant. */
export function getModuleEffectiveState(mod: ModuleLike, now: Date = new Date()): EffectiveState {
  if (!mod.is_published) return "locked";
  if (!mod.is_available) return "locked";
  const t = now.getTime();
  if (mod.opens_at && new Date(mod.opens_at).getTime() > t) return "upcoming";
  if (mod.closes_at && new Date(mod.closes_at).getTime() < t) return "past";
  return "available";
}

/** Compute the effective availability state of a quiz at a given instant. */
export function getQuizEffectiveState(quiz: QuizLike, now: Date = new Date()): EffectiveState {
  if (!quiz.is_available) return "locked";
  const t = now.getTime();
  if (quiz.opens_at && new Date(quiz.opens_at).getTime() > t) return "upcoming";
  if (quiz.closes_at && new Date(quiz.closes_at).getTime() < t) return "past";
  return "available";
}

// ─── Attempt guards ───────────────────────────────────────────────────────────

/** Return true if a student can start a new attempt right now. */
export function canStartAttempt(
  quiz: QuizLike,
  finishedAttempts: number,
  now: Date = new Date()
): { ok: true } | { ok: false; reason: string } {
  const state = getQuizEffectiveState(quiz, now);
  if (state === "locked") return { ok: false, reason: "quiz_unavailable" };
  if (state === "upcoming") return { ok: false, reason: "quiz_not_open_yet" };
  if (state === "past") return { ok: false, reason: "quiz_closed" };
  if (finishedAttempts >= quiz.attempts_allowed) return { ok: false, reason: "attempts_exhausted" };
  return { ok: true };
}

/** Return true if an in-progress attempt can still be submitted. */
export function canSubmitAttempt(
  attempt: AttemptLike,
  now: Date = new Date()
): { ok: true } | { ok: false; reason: string } {
  if (attempt.status !== "in_progress") return { ok: false, reason: "attempt_not_in_progress" };
  if (attempt.expires_at && new Date(attempt.expires_at).getTime() < now.getTime()) {
    return { ok: false, reason: "attempt_expired" };
  }
  return { ok: true };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export interface ScoredQuestion {
  questionId: string;
  isCorrect: boolean | null;
  pointsAwarded: number;
}

/**
 * Auto-grade a set of answers against their question snapshots.
 * Returns per-question results and the total score.
 */
export function calculateAttemptScore(
  questions: QuestionSnapshot[],
  answers: AnswerLike[]
): { total: number; maxScore: number; perQuestion: ScoredQuestion[] } {
  const answerMap = new Map(answers.map((a) => [a.question_id, a.response]));
  const maxScore = questions.reduce((sum, q) => sum + q.points, 0);
  let total = 0;
  const perQuestion: ScoredQuestion[] = [];

  for (const q of questions) {
    const response = answerMap.get(q.id) ?? {};
    let isCorrect: boolean | null = null;
    let pointsAwarded = 0;
    const snap = q.body_snapshot;

    if (q.type === "single_choice") {
      const opts = snap.options as { id: string; is_correct: boolean }[];
      const correct = opts?.find((o) => o.is_correct);
      isCorrect = response.selected_id === correct?.id;
      pointsAwarded = isCorrect ? q.points : 0;
    } else if (q.type === "multi_choice") {
      const opts = snap.options as { id: string; is_correct: boolean }[];
      const correctIds = new Set(opts?.filter((o) => o.is_correct).map((o) => o.id) ?? []);
      const selectedIds = new Set((response.selected_ids as string[]) ?? []);
      isCorrect =
        correctIds.size === selectedIds.size && [...correctIds].every((id) => selectedIds.has(id));
      pointsAwarded = isCorrect ? q.points : 0;
    } else if (q.type === "true_false") {
      isCorrect = response.answer === snap.correct;
      pointsAwarded = isCorrect ? q.points : 0;
    } else if (q.type === "short_answer") {
      const autoGrade = snap.auto_grade !== false;
      if (autoGrade) {
        const accepted = (snap.accepted_answers as string[]) ?? [];
        const caseSensitive = snap.case_sensitive === true;
        const given = (response.text as string) ?? "";
        isCorrect = accepted.some((a) =>
          caseSensitive ? a === given : a.toLowerCase() === given.toLowerCase()
        );
        pointsAwarded = isCorrect ? q.points : 0;
      }
      // else: manual grading, leave null / 0
    }

    total += pointsAwarded;
    perQuestion.push({ questionId: q.id, isCorrect, pointsAwarded });
  }

  return { total, maxScore, perQuestion };
}

// ─── Sanitization ─────────────────────────────────────────────────────────────

/**
 * Strip correct-answer data from a question body before sending to students.
 * Works for single_choice, multi_choice, true_false, and short_answer.
 */
export function sanitizeQuestionForPublic(question: {
  id: string;
  type: string;
  prompt: string;
  points: number;
  body: Record<string, unknown>;
}): Record<string, unknown> {
  const body = { ...question.body };

  if (question.type === "single_choice" || question.type === "multi_choice") {
    const opts = body.options as { id: string; text: string; is_correct?: boolean }[];
    body.options = opts?.map(({ id, text }) => ({ id, text })) ?? [];
  }

  if (question.type === "true_false") {
    // Remove the correct answer field
    const { correct: _c, ...rest } = body;
    void _c;
    return rest;
  }

  if (question.type === "short_answer") {
    // Remove accepted answers and case_sensitive
    const { accepted_answers: _aa, case_sensitive: _cs, ...rest } = body;
    void _aa;
    void _cs;
    return rest;
  }

  return body;
}
