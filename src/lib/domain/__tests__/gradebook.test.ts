import { describe, it, expect } from "vitest";
import { effectiveItemScore, calculateGradebookFinal } from "../gradebook";

const NOW = new Date("2026-06-07T12:00:00Z");
const PAST = "2026-06-01T00:00:00Z";
const FUTURE = "2026-06-30T00:00:00Z";

// ─── effectiveItemScore ───────────────────────────────────────────────────────

describe("effectiveItemScore", () => {
  it("returns the recorded score when present", () => {
    const item = { id: "i1", category_id: "c1", max_score: 100, missing_policy: "ignore_until_due" as const, due_at: null };
    const entry = { grade_item_id: "i1", score: 75 };
    expect(effectiveItemScore(item, entry, NOW)).toBe(75);
  });

  it("returns 0 for zero_immediately when no score", () => {
    const item = { id: "i1", category_id: "c1", max_score: 100, missing_policy: "zero_immediately" as const, due_at: null };
    expect(effectiveItemScore(item, undefined, NOW)).toBe(0);
  });

  it("returns null for ignore_always", () => {
    const item = { id: "i1", category_id: "c1", max_score: 100, missing_policy: "ignore_always" as const, due_at: null };
    const entry = { grade_item_id: "i1", score: 50 };
    expect(effectiveItemScore(item, entry, NOW)).toBe(null);
  });

  it("returns null for ignore_until_due before due date", () => {
    const item = { id: "i1", category_id: "c1", max_score: 100, missing_policy: "ignore_until_due" as const, due_at: FUTURE };
    expect(effectiveItemScore(item, undefined, NOW)).toBe(null);
  });

  it("returns 0 for ignore_until_due after due date with no score", () => {
    const item = { id: "i1", category_id: "c1", max_score: 100, missing_policy: "ignore_until_due" as const, due_at: PAST };
    expect(effectiveItemScore(item, undefined, NOW)).toBe(0);
  });
});

// ─── calculateGradebookFinal ──────────────────────────────────────────────────

describe("calculateGradebookFinal", () => {
  it("returns null when no items contribute", () => {
    const cats = [{ id: "c1", weight: 100 }];
    const items = [{ id: "i1", category_id: "c1", max_score: 100, missing_policy: "ignore_always" as const, due_at: null }];
    expect(calculateGradebookFinal(cats, items, [], NOW)).toBe(null);
  });

  it("computes 100% for a perfect score in one category", () => {
    const cats = [{ id: "c1", weight: 100 }];
    const items = [{ id: "i1", category_id: "c1", max_score: 50, missing_policy: "ignore_until_due" as const, due_at: null }];
    const grades = [{ grade_item_id: "i1", score: 50 }];
    expect(calculateGradebookFinal(cats, items, grades, NOW)).toBe(100);
  });

  it("computes 50% when half earned", () => {
    const cats = [{ id: "c1", weight: 100 }];
    const items = [{ id: "i1", category_id: "c1", max_score: 100, missing_policy: "ignore_until_due" as const, due_at: null }];
    const grades = [{ grade_item_id: "i1", score: 50 }];
    expect(calculateGradebookFinal(cats, items, grades, NOW)).toBe(50);
  });

  it("weights categories correctly (60/40 split)", () => {
    const cats = [
      { id: "c1", weight: 60 },
      { id: "c2", weight: 40 },
    ];
    const items = [
      { id: "i1", category_id: "c1", max_score: 100, missing_policy: "ignore_until_due" as const, due_at: null },
      { id: "i2", category_id: "c2", max_score: 100, missing_policy: "ignore_until_due" as const, due_at: null },
    ];
    // c1: 100% (60 pts of final), c2: 0% (0 pts of final) → 60%
    const grades = [
      { grade_item_id: "i1", score: 100 },
      { grade_item_id: "i2", score: 0 },
    ];
    expect(calculateGradebookFinal(cats, items, grades, NOW)).toBe(60);
  });

  it("re-normalizes weights when only one category has data", () => {
    const cats = [
      { id: "c1", weight: 60 },
      { id: "c2", weight: 40 }, // no items contribute
    ];
    const items = [
      { id: "i1", category_id: "c1", max_score: 100, missing_policy: "ignore_until_due" as const, due_at: null },
      // c2 item uses ignore_always → never contributes
      { id: "i2", category_id: "c2", max_score: 100, missing_policy: "ignore_always" as const, due_at: null },
    ];
    const grades = [{ grade_item_id: "i1", score: 80 }];
    // Only c1 counts, re-normalized to 100% → final = 80%
    expect(calculateGradebookFinal(cats, items, grades, NOW)).toBe(80);
  });

  it("aggregates multiple items in the same category", () => {
    const cats = [{ id: "c1", weight: 100 }];
    const items = [
      { id: "i1", category_id: "c1", max_score: 50, missing_policy: "zero_immediately" as const, due_at: null },
      { id: "i2", category_id: "c1", max_score: 50, missing_policy: "zero_immediately" as const, due_at: null },
    ];
    const grades = [{ grade_item_id: "i1", score: 50 }]; // i2 missing → 0
    // earned=50, possible=100 → 50%
    expect(calculateGradebookFinal(cats, items, grades, NOW)).toBe(50);
  });
});
