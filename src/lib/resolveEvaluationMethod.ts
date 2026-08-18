// resolveEvaluationMethod.ts
// ─────────────────────────────────────────────────────────────────────────────
// Small helper used by the student code editors to decide what to do at
// Submit time based on the exercise's stored `evaluationMethod` plus the
// tab-type of the exercise (I_Do / We_Do / You_Do).
//
// LEGACY FALLBACK: exercises created before the evaluationMethod field
// existed have `null` on the doc. For those we preserve historical
// behaviour: You_Do assessments were client-side auto-scored via test cases,
// so their legacy default is 'testcase'; every other tab posted score:0
// (Manual). This keeps every pre-feature exercise submitting exactly the way
// students already experienced it.
//
// Once the trainer picks any explicit method in Settings, the stored value
// wins over this fallback.

import type { EvaluationMethod } from '@/app/lms/component/evaluation/EvaluationMethodConfig';
import { AI_CRITERIA_OPTIONS } from '@/app/lms/component/evaluation/EvaluationMethodConfig';
import type { AiCriterion } from '@/app/lms/component/evaluation/EvaluationMethodConfig';

export interface ResolvedEvaluation {
  method: EvaluationMethod;
  aiCriteria: AiCriterion[];       // only meaningful when method === 'ai'
  /**
   * Exercise-level count. Used directly when
   * `aiTestCasesCountMode === 'common'`. Kept accessible in `perQuestion` mode
   * too as the LEGACY-question fallback (see `getAiTestCasesCountFor`).
   */
  aiTestCasesCount: number;
  aiTestCasesCountMode: 'common' | 'perQuestion';
  /**
   * Given a specific question, return the effective count to use at Submit.
   *   • 'common'      → always the exercise's count
   *   • 'perQuestion' → question.aiTestCasesCount when set (>= 0), else
   *                     falls back to the exercise's count
   */
  getAiTestCasesCountFor: (question: any) => number;
}

/**
 * Return the effective evaluation method + AI criteria for a given exercise,
 * applying the per-tab legacy fallback.
 */
export function resolveEvaluationMethod(
  exercise: any,
  category: string | undefined | null,
): ResolvedEvaluation {
  const stored = exercise?.evaluationMethod?.method;
  const method: EvaluationMethod =
    stored === 'manual' || stored === 'testcase' || stored === 'ai'
      ? stored
      : category === 'You_Do' ? 'testcase' : 'manual';

  const rawCrit: any[] = Array.isArray(exercise?.evaluationMethod?.ai?.criteria)
    ? exercise.evaluationMethod.ai.criteria
    : [];
  const aiCriteria = rawCrit.filter(
    (c: any): c is AiCriterion => AI_CRITERIA_OPTIONS.some(o => o.value === c),
  );

  const rawCount = Number(exercise?.evaluationMethod?.ai?.testCasesCount);
  // Clamp to [0, 50] and fall back to 20 for legacy docs that don't have the field.
  const aiTestCasesCount = Number.isFinite(rawCount) && rawCount >= 0
    ? Math.min(50, Math.floor(rawCount))
    : 20;

  const rawMode = exercise?.evaluationMethod?.ai?.testCasesCountMode;
  const aiTestCasesCountMode: 'common' | 'perQuestion' =
    rawMode === 'perQuestion' ? 'perQuestion' : 'common';

  // Legacy questions authored before this feature won't have
  // `aiTestCasesCount`. Falling back to the exercise's count keeps the student's
  // Submit unblocked. In Common mode we always use the exercise's count and
  // ignore whatever the question happens to carry, so trainers can flip
  // between modes without losing their setting.
  const getAiTestCasesCountFor = (question: any): number => {
    if (aiTestCasesCountMode === 'common') return aiTestCasesCount;
    const raw = Number(question?.aiTestCasesCount);
    if (Number.isFinite(raw) && raw >= 0) return Math.min(50, Math.floor(raw));
    return aiTestCasesCount; // legacy fallback
  };

  return { method, aiCriteria, aiTestCasesCount, aiTestCasesCountMode, getAiTestCasesCountFor };
}
