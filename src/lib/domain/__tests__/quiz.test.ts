import { describe, it, expect } from "vitest";
import {
  getQuizEffectiveState,
  getModuleEffectiveState,
  canStartAttempt,
  canSubmitAttempt,
  calculateAttemptScore,
  sanitizeQuestionForPublic,
} from "../quiz";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-07T12:00:00Z");
const PAST = "2026-06-01T00:00:00Z";
const FUTURE = "2026-06-30T00:00:00Z";

function baseQuiz(overrides: Partial<Parameters<typeof getQuizEffectiveState>[0]> = {}) {
  return {
    is_available: true,
    opens_at: null,
    closes_at: null,
    attempts_allowed: 3,
    ...overrides,
  };
}

function baseModule(overrides: Partial<Parameters<typeof getModuleEffectiveState>[0]> = {}) {
  return {
    is_published: true,
    is_available: true,
    opens_at: null,
    closes_at: null,
    ...overrides,
  };
}

// ─── getQuizEffectiveState ────────────────────────────────────────────────────

describe("getQuizEffectiveState", () => {
  it("returns 'locked' when is_available is false", () => {
    expect(getQuizEffectiveState(baseQuiz({ is_available: false }), NOW)).toBe("locked");
  });

  it("returns 'available' when no time window", () => {
    expect(getQuizEffectiveState(baseQuiz(), NOW)).toBe("available");
  });

  it("returns 'upcoming' when opens_at is in the future", () => {
    expect(getQuizEffectiveState(baseQuiz({ opens_at: FUTURE }), NOW)).toBe("upcoming");
  });

  it("returns 'past' when closes_at is in the past", () => {
    expect(getQuizEffectiveState(baseQuiz({ closes_at: PAST }), NOW)).toBe("past");
  });

  it("returns 'available' when within the window", () => {
    expect(getQuizEffectiveState(baseQuiz({ opens_at: PAST, closes_at: FUTURE }), NOW)).toBe("available");
  });
});

// ─── getModuleEffectiveState ──────────────────────────────────────────────────

describe("getModuleEffectiveState", () => {
  it("returns 'locked' when not published", () => {
    expect(getModuleEffectiveState(baseModule({ is_published: false }), NOW)).toBe("locked");
  });

  it("returns 'locked' when is_available is false", () => {
    expect(getModuleEffectiveState(baseModule({ is_available: false }), NOW)).toBe("locked");
  });

  it("returns 'available' when published and no window", () => {
    expect(getModuleEffectiveState(baseModule(), NOW)).toBe("available");
  });

  it("returns 'upcoming' when opens_at is in the future", () => {
    expect(getModuleEffectiveState(baseModule({ opens_at: FUTURE }), NOW)).toBe("upcoming");
  });

  it("returns 'past' when closes_at is in the past", () => {
    expect(getModuleEffectiveState(baseModule({ closes_at: PAST }), NOW)).toBe("past");
  });
});

// ─── canStartAttempt ─────────────────────────────────────────────────────────

describe("canStartAttempt", () => {
  it("allows start when available and under limit", () => {
    expect(canStartAttempt(baseQuiz({ attempts_allowed: 3 }), 1, NOW)).toEqual({ ok: true });
  });

  it("blocks when attempts exhausted", () => {
    const result = canStartAttempt(baseQuiz({ attempts_allowed: 2 }), 2, NOW);
    expect(result).toEqual({ ok: false, reason: "attempts_exhausted" });
  });

  it("blocks when quiz is locked", () => {
    const result = canStartAttempt(baseQuiz({ is_available: false }), 0, NOW);
    expect(result).toEqual({ ok: false, reason: "quiz_unavailable" });
  });

  it("blocks when quiz is upcoming", () => {
    const result = canStartAttempt(baseQuiz({ opens_at: FUTURE }), 0, NOW);
    expect(result).toEqual({ ok: false, reason: "quiz_not_open_yet" });
  });

  it("blocks when quiz is past", () => {
    const result = canStartAttempt(baseQuiz({ closes_at: PAST }), 0, NOW);
    expect(result).toEqual({ ok: false, reason: "quiz_closed" });
  });
});

// ─── canSubmitAttempt ────────────────────────────────────────────────────────

describe("canSubmitAttempt", () => {
  it("allows submit for in_progress with no expiry", () => {
    expect(canSubmitAttempt({ status: "in_progress", expires_at: null }, NOW)).toEqual({ ok: true });
  });

  it("allows submit before expiry", () => {
    expect(canSubmitAttempt({ status: "in_progress", expires_at: FUTURE }, NOW)).toEqual({ ok: true });
  });

  it("blocks when already submitted", () => {
    expect(canSubmitAttempt({ status: "submitted", expires_at: null }, NOW)).toEqual({
      ok: false,
      reason: "attempt_not_in_progress",
    });
  });

  it("blocks when expired", () => {
    expect(canSubmitAttempt({ status: "in_progress", expires_at: PAST }, NOW)).toEqual({
      ok: false,
      reason: "attempt_expired",
    });
  });
});

// ─── calculateAttemptScore ────────────────────────────────────────────────────

describe("calculateAttemptScore", () => {
  it("scores a correct single_choice answer", () => {
    const questions = [
      {
        id: "q1",
        points: 5,
        type: "single_choice",
        body_snapshot: {
          options: [
            { id: "a", is_correct: true },
            { id: "b", is_correct: false },
          ],
        },
      },
    ];
    const answers = [{ question_id: "q1", response: { selected_id: "a" } }];
    const result = calculateAttemptScore(questions, answers);
    expect(result.total).toBe(5);
    expect(result.maxScore).toBe(5);
    expect(result.perQuestion[0].isCorrect).toBe(true);
  });

  it("scores an incorrect single_choice answer as 0", () => {
    const questions = [
      {
        id: "q1",
        points: 5,
        type: "single_choice",
        body_snapshot: {
          options: [
            { id: "a", is_correct: true },
            { id: "b", is_correct: false },
          ],
        },
      },
    ];
    const answers = [{ question_id: "q1", response: { selected_id: "b" } }];
    const result = calculateAttemptScore(questions, answers);
    expect(result.total).toBe(0);
    expect(result.perQuestion[0].isCorrect).toBe(false);
  });

  it("scores true_false correctly", () => {
    const q = { id: "q1", points: 2, type: "true_false", body_snapshot: { correct: true } };
    const right = calculateAttemptScore([q], [{ question_id: "q1", response: { answer: true } }]);
    const wrong = calculateAttemptScore([q], [{ question_id: "q1", response: { answer: false } }]);
    expect(right.total).toBe(2);
    expect(wrong.total).toBe(0);
  });

  it("scores short_answer case-insensitively by default", () => {
    const q = {
      id: "q1",
      points: 3,
      type: "short_answer",
      body_snapshot: { accepted_answers: ["Paris"], case_sensitive: false, auto_grade: true },
    };
    const result = calculateAttemptScore([q], [{ question_id: "q1", response: { text: "paris" } }]);
    expect(result.total).toBe(3);
    expect(result.perQuestion[0].isCorrect).toBe(true);
  });

  it("handles missing answers with zero score", () => {
    const q = { id: "q1", points: 10, type: "single_choice", body_snapshot: { options: [{ id: "a", is_correct: true }] } };
    const result = calculateAttemptScore([q], []);
    expect(result.total).toBe(0);
    expect(result.maxScore).toBe(10);
  });
});

// ─── sanitizeQuestionForPublic ────────────────────────────────────────────────

describe("sanitizeQuestionForPublic", () => {
  it("removes is_correct from single_choice options", () => {
    const q = {
      id: "q1",
      type: "single_choice",
      prompt: "Pregunta",
      points: 1,
      body: {
        options: [
          { id: "a", text: "Opción A", is_correct: true },
          { id: "b", text: "Opción B", is_correct: false },
        ],
      },
    };
    const sanitized = sanitizeQuestionForPublic(q);
    const opts = sanitized.options as { id: string; text: string; is_correct?: boolean }[];
    expect(opts.every((o) => !("is_correct" in o))).toBe(true);
    expect(opts[0].text).toBe("Opción A");
  });

  it("removes correct field from true_false", () => {
    const q = {
      id: "q1",
      type: "true_false",
      prompt: "¿Verdadero?",
      points: 1,
      body: { correct: true },
    };
    const sanitized = sanitizeQuestionForPublic(q);
    expect("correct" in sanitized).toBe(false);
  });

  it("removes accepted_answers from short_answer", () => {
    const q = {
      id: "q1",
      type: "short_answer",
      prompt: "¿Capital?",
      points: 2,
      body: { accepted_answers: ["Paris"], case_sensitive: false, auto_grade: true },
    };
    const sanitized = sanitizeQuestionForPublic(q);
    expect("accepted_answers" in sanitized).toBe(false);
    expect("case_sensitive" in sanitized).toBe(false);
    expect(sanitized.auto_grade).toBe(true);
  });
});
