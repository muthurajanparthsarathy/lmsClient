// quotaModel.ts
// ─────────────────────────────────────────────────────────────────────────────
// Centralised Add-Question quota model. Reads the existing exercise doc
// (customDistribution matrix stored as {easy/medium/hard} × {scratch/ai/thirdParty})
// AND its saved questions, and returns per-bucket remaining slots under the
// new three-bucket contract:
//
//   • ai            — AI Automation generator
//   • manual        — Scratch typing + Question Bank imports + Document Upload
//   • otherPlatform — Other Platform bank imports (thirdParty)
//
// The disk shape stays unchanged (`scratch` column carries the manual bucket).
// This module only reshapes the READ side so every entry method that maps to
// the manual bucket shares one pool.
//
// The forms and hosts import from here rather than reimplementing the maths
// six times (QuestionsView, QuestionsTest, ProgrammingQuestionForm ×2 copies,
// MCQQuestionForm, and the server). The server keeps its own copy for now;
// Phase 4 ports it.

export type QuotaBucket = 'ai' | 'manual' | 'otherPlatform';

// Every entry method surfaced in the UI. Multiple methods can map to one
// bucket; the bucket is what the quota check enforces.
export type QuestionEntryMethod =
  | 'ai'
  | 'scratch'
  | 'questionBank'
  | 'documentUpload'
  | 'otherPlatform';

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'] as const;
export const BUCKETS: readonly QuotaBucket[] = ['ai', 'manual', 'otherPlatform'] as const;

// The legacy per-bucket cell on customDistribution keeps its historical
// column names. This map translates from the on-disk column to the bucket
// the UI now treats it as.
const LEGACY_COL_TO_BUCKET: Record<'scratch' | 'ai' | 'thirdParty', QuotaBucket> = {
  scratch: 'manual',
  ai: 'ai',
  thirdParty: 'otherPlatform',
};

/**
 * Map an entry method the user chose to the quota bucket that gates it.
 * Scratch typing, Question Bank imports, and Document Upload all consume the
 * shared Manual pool. AI has its own pool. Other Platform has its own pool.
 */
export function getQuotaBucket(method: QuestionEntryMethod): QuotaBucket {
  if (method === 'ai') return 'ai';
  if (method === 'otherPlatform') return 'otherPlatform';
  return 'manual';
}

/**
 * Convert the existing per-question `source` string tag (as persisted on
 * question docs and passed through `pendingSourceRef` in the forms) into a
 * bucket. Legacy tags: 'scratch-manual' | 'scratch-bank' | 'scratch-upload'
 * | 'ai' | 'thirdParty' (and 'thirdParty:leetcode' etc.). Anything else
 * falls back to 'manual' — the safer bucket for unknown tags.
 */
export function srcToBucket(source: string | null | undefined): QuotaBucket {
  const s = (source ?? '').toString().toLowerCase();
  if (s === 'ai') return 'ai';
  if (s.startsWith('thirdparty')) return 'otherPlatform';
  return 'manual';
}

/**
 * Which specific manual method was used, if any. Returns null for AI and
 * Other Platform sources. Used for analytics/display, never for quota gating.
 */
export function srcToEntryMethod(source: string | null | undefined): QuestionEntryMethod {
  const s = (source ?? '').toString().toLowerCase();
  if (s === 'ai') return 'ai';
  if (s.startsWith('thirdparty')) return 'otherPlatform';
  if (s === 'scratch-bank' || s === 'bank') return 'questionBank';
  if (s === 'scratch-upload' || s === 'upload' || s === 'document') return 'documentUpload';
  return 'scratch';
}

const emptyRow = () => ({ ai: 0, manual: 0, otherPlatform: 0 } as Record<QuotaBucket, number>);

/**
 * Read the exercise's customDistribution matrix and return the configured
 * quota per (difficulty, bucket). Returns null when the exercise has no
 * per-level custom distribution — the caller should fall back to the flat
 * exercise-wide quota in that case.
 *
 * The disk shape is {easy/medium/hard} × {scratch/ai/thirdParty}. This
 * function rekeys the source axis to buckets (scratch → manual, thirdParty
 * → otherPlatform, ai → ai).
 */
export function readPlan(
  customDistribution: any,
): Record<Difficulty, Record<QuotaBucket, number>> | null {
  if (!customDistribution || typeof customDistribution !== 'object') return null;
  const plan = {
    easy: emptyRow(),
    medium: emptyRow(),
    hard: emptyRow(),
  } as Record<Difficulty, Record<QuotaBucket, number>>;
  let anyConfigured = false;
  for (const d of DIFFICULTIES) {
    const row = customDistribution[d];
    if (!row || typeof row !== 'object') continue;
    for (const col of ['scratch', 'ai', 'thirdParty'] as const) {
      const n = Number(row[col] || 0);
      if (n > 0) anyConfigured = true;
      plan[d][LEGACY_COL_TO_BUCKET[col]] += n;
    }
  }
  return anyConfigured ? plan : null;
}

/**
 * Count how many saved questions currently sit in each (difficulty, bucket).
 * Deactivated questions (isActive === false) are excluded, matching the
 * existing per-difficulty gates.
 */
export function readUsed(
  questions: any[] | null | undefined,
): Record<Difficulty, Record<QuotaBucket, number>> {
  const used = {
    easy: emptyRow(),
    medium: emptyRow(),
    hard: emptyRow(),
  } as Record<Difficulty, Record<QuotaBucket, number>>;
  if (!Array.isArray(questions)) return used;
  for (const q of questions) {
    if (q?.isActive === false) continue;
    const d = (q?.difficulty ?? q?.exerciseLevel ?? '').toString().toLowerCase();
    const diff: Difficulty = d === 'easy' || d === 'hard' ? d : 'medium';
    const bucket = srcToBucket(q?.source);
    used[diff][bucket] += 1;
  }
  return used;
}

/**
 * Remaining slots per (difficulty, bucket). `null` when the exercise has no
 * per-difficulty custom distribution.
 */
export function readRemaining(
  customDistribution: any,
  questions: any[] | null | undefined,
): Record<Difficulty, Record<QuotaBucket, number>> | null {
  const plan = readPlan(customDistribution);
  if (!plan) return null;
  const used = readUsed(questions);
  const remaining = {
    easy: emptyRow(),
    medium: emptyRow(),
    hard: emptyRow(),
  } as Record<Difficulty, Record<QuotaBucket, number>>;
  for (const d of DIFFICULTIES) {
    for (const b of BUCKETS) {
      remaining[d][b] = Math.max(0, plan[d][b] - used[d][b]);
    }
  }
  return remaining;
}

/**
 * The whole-exercise remaining count per bucket — sum across the three
 * difficulties. Returned as null when there is no per-level configuration.
 */
export function readRemainingTotals(
  customDistribution: any,
  questions: any[] | null | undefined,
): Record<QuotaBucket, number> | null {
  const rem = readRemaining(customDistribution, questions);
  if (!rem) return null;
  const totals = emptyRow();
  for (const d of DIFFICULTIES) {
    for (const b of BUCKETS) totals[b] += rem[d][b];
  }
  return totals;
}

/**
 * The next pending (difficulty, bucket) the user should be routed into after
 * a successful save, given the plan, what's already saved, and what they
 * just filled. Progression rules:
 *
 *   1. Prefer the bucket they were just in — keep them in the same source
 *      while it still has slots.
 *   2. Prefer their current difficulty — finish this level before moving on.
 *   3. If the current bucket at the current difficulty is done, walk the
 *      other difficulties for the SAME bucket in easy→medium→hard order.
 *   4. If that bucket is fully done everywhere, walk to the next bucket that
 *      still has any pending slot, again in easy→medium→hard order.
 *   5. If nothing is pending, return null (caller shows completion).
 *
 * Returns `{ difficulty, bucket }` for the next pending slot, or `null` when
 * the plan is complete.
 */
export function getNextPendingQuestion(input: {
  currentDifficulty: Difficulty | null;
  currentBucket: QuotaBucket | null;
  customDistribution: any;
  questions: any[] | null | undefined;
}): { difficulty: Difficulty; bucket: QuotaBucket } | null {
  const remaining = readRemaining(input.customDistribution, input.questions);
  if (!remaining) return null;

  const { currentBucket, currentDifficulty } = input;

  // (1) + (2) — stay in the same cell if it still has room.
  if (
    currentBucket &&
    currentDifficulty &&
    remaining[currentDifficulty][currentBucket] > 0
  ) {
    return { difficulty: currentDifficulty, bucket: currentBucket };
  }

  // (3) — walk other difficulties for the SAME bucket.
  if (currentBucket) {
    for (const d of DIFFICULTIES) {
      if (d === currentDifficulty) continue;
      if (remaining[d][currentBucket] > 0) return { difficulty: d, bucket: currentBucket };
    }
  }

  // (4) — walk to the next bucket that has any pending slot anywhere. Bucket
  // priority: keep AI first, then Manual, then Other Platform — matches the
  // order users typically plan in and stops OP from getting starved.
  for (const b of BUCKETS) {
    if (b === currentBucket) continue;
    for (const d of DIFFICULTIES) {
      if (remaining[d][b] > 0) return { difficulty: d, bucket: b };
    }
  }

  // (5) — plan complete.
  return null;
}

/**
 * How many more items the caller can safely add in one shot to a given
 * (difficulty, bucket). Used by the bank picker and doc-upload picker to cap
 * multi-select before submission (never silently discard excess).
 */
export function getManualImportCapacity(
  customDistribution: any,
  questions: any[] | null | undefined,
  difficulty: Difficulty | null,
): number {
  const rem = readRemaining(customDistribution, questions);
  if (!rem) return Infinity;
  if (difficulty) return rem[difficulty].manual;
  // No specific difficulty: use the whole-exercise Manual pool.
  return rem.easy.manual + rem.medium.manual + rem.hard.manual;
}

/**
 * Human-readable status per bucket at a given difficulty. Used by the source
 * chooser to explain why an option is disabled without saying "quota full"
 * for a sibling method.
 */
export function describeBucketStatus(
  customDistribution: any,
  questions: any[] | null | undefined,
  difficulty: Difficulty,
  bucket: QuotaBucket,
): { configured: number; used: number; remaining: number; label: string } {
  const plan = readPlan(customDistribution);
  const used = readUsed(questions);
  const configured = plan?.[difficulty][bucket] ?? 0;
  const spent = used[difficulty][bucket];
  const remaining = Math.max(0, configured - spent);
  const bucketName = bucket === 'ai' ? 'AI' : bucket === 'manual' ? 'Manual' : 'Other Platform';
  let label: string;
  if (configured === 0) label = `${bucketName}: not allocated for ${difficulty}`;
  else if (remaining === 0) label = `${bucketName}: ${spent}/${configured} — completed`;
  else label = `${bucketName}: ${spent}/${configured} — ${remaining} remaining`;
  return { configured, used: spent, remaining, label };
}
