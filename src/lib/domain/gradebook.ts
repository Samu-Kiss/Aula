/**
 * Pure domain functions for gradebook calculation.
 * No framework imports — safe to run in any environment.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  weight: number; // 0–100
}

export interface GradeItem {
  id: string;
  category_id: string;
  max_score: number;
  missing_policy: "ignore_until_due" | "zero_immediately" | "ignore_always";
  due_at: string | null;
}

export interface GradeEntry {
  grade_item_id: string;
  score: number | null;
}

// ─── Gradebook calculation ────────────────────────────────────────────────────

/**
 * Calculate the effective score for one item given a grade entry.
 *
 * Rules:
 *  - "ignore_always": always null (item never counts)
 *  - "zero_immediately": null score → 0
 *  - "ignore_until_due": null score before due date → null; after due date → 0
 */
export function effectiveItemScore(
  item: GradeItem,
  entry: GradeEntry | undefined,
  now: Date = new Date()
): number | null {
  if (item.missing_policy === "ignore_always") return null;

  if (entry?.score != null) return entry.score;

  // No score recorded
  if (item.missing_policy === "zero_immediately") return 0;

  // ignore_until_due
  if (!item.due_at) return null;
  const pastDue = new Date(item.due_at).getTime() < now.getTime();
  return pastDue ? 0 : null;
}

/**
 * Calculate the final gradebook score for a student.
 *
 * Algorithm:
 *  1. Group items by category.
 *  2. For each category, compute the percentage: sum(effectiveScore) / sum(maxScore).
 *     Skip items where effectiveItemScore returns null (not yet due / ignore_always).
 *  3. Weighted average across categories, using only categories that have at least
 *     one counted item. The weights of counted categories are re-normalized to 100%.
 *
 * Returns null if no items contribute.
 */
export function calculateGradebookFinal(
  categories: Category[],
  items: GradeItem[],
  grades: GradeEntry[],
  now: Date = new Date()
): number | null {
  const gradeMap = new Map(grades.map((g) => [g.grade_item_id, g]));

  // category_id → { weightedScore, totalWeight (of items that count) }
  const catTotals = new Map<string, { earned: number; possible: number }>();

  for (const item of items) {
    const effective = effectiveItemScore(item, gradeMap.get(item.id), now);
    if (effective === null) continue; // doesn't count yet

    const cur = catTotals.get(item.category_id) ?? { earned: 0, possible: 0 };
    cur.earned += effective;
    cur.possible += item.max_score;
    catTotals.set(item.category_id, cur);
  }

  if (catTotals.size === 0) return null;

  // Re-normalize weights for categories that actually have data
  const activeCats = categories.filter((c) => catTotals.has(c.id));
  const totalWeight = activeCats.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return null;

  let final = 0;
  for (const cat of activeCats) {
    const { earned, possible } = catTotals.get(cat.id)!;
    const pct = possible > 0 ? earned / possible : 0;
    final += (cat.weight / totalWeight) * pct * 100;
  }

  return Math.round(final * 100) / 100;
}
