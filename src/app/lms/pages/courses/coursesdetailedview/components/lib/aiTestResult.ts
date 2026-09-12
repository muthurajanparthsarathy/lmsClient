// aiTestResult.ts
// ─────────────────────────────────────────────────────────────────────────────
// One place that turns an AI evaluation breakdown into the `TestResultState`
// the shared Test Result panel renders.
//
// Before this, each student editor built its own thin AI result ("AI
// evaluation — 3 criteria", no cases, no parameter detail) and the three
// surfaces drifted. Now the multi-file workspace, the We_Do editor and the
// You_Do editor all call this, so an AI-graded question looks the same
// everywhere: the SAME summary + case chips + case detail Test Case scoring
// produces, plus an AI block showing which parameters were scored and how the
// marks were allocated.
//
// HIDDEN CASES: a trainer-authored case flagged `isHidden` keeps its input and
// expected output concealed under AI grading exactly as it does under Test
// Case grading — same progressive unlock (reveal the first hidden case only
// once every visible case passes, keep revealing while each one passes, stop
// at the first failing hidden case, which IS revealed so it can be debugged).
// AI-generated cases are never hidden: the trainer never authored them.

import type {
  SubmitStatus, TestResultCase, TestResultState, AiResultInfo,
} from '@/app/lms/pages/courses/coursesdetailedview/components/multi-file/BottomPanel';
import { AI_CRITERIA_OPTIONS } from '@/app/lms/pages/courses/coursesdetailedview/components/EvaluationMethodConfig';

/** Loose shape of `evaluationBreakdown.ai` — accepts both the client's own
 *  result object and the sanitised copy the server echoes back. */
interface RawAiBreakdown {
  perCriterionMax?: number;
  criteria?: Array<{ key?: string; percentage?: number; score?: number; comment?: string }>;
  testCases?: Array<{
    index?: number; source?: string; hidden?: boolean;
    input?: string; expectedOutput?: string; passed?: boolean; comment?: string;
  }>;
  passedTestCases?: number;
  totalTestCases?: number;
  criteriaPortion?: number;
  testCasePortion?: number;
  model?: string;
  failed?: boolean;
}

const CRITERION_LABEL = new Map(AI_CRITERIA_OPTIONS.map(o => [o.value as string, o.label]));

/**
 * How maxMarks is split between the two signals. Mirrors the score model in
 * `aiEvaluator.ts` exactly — 50/50 when both exist, otherwise whichever side
 * exists carries the full weight. Kept here (rather than re-derived from the
 * portions) so the panel still reads correctly when a student scores 0 on
 * both halves.
 */
export function resolveAiWeights(totalTestCases: number, criteriaCount: number): {
  testCaseWeightPct: number; criteriaWeightPct: number;
} {
  const haveTC = totalTestCases > 0;
  const haveCrit = criteriaCount > 0;
  if (haveTC && haveCrit) return { testCaseWeightPct: 50, criteriaWeightPct: 50 };
  if (haveCrit) return { testCaseWeightPct: 0, criteriaWeightPct: 100 };
  if (haveTC) return { testCaseWeightPct: 100, criteriaWeightPct: 0 };
  return { testCaseWeightPct: 0, criteriaWeightPct: 0 };
}

export interface BuildAiTestResultInput {
  /** `evaluationBreakdown.ai` from the client evaluator or the server echo. */
  ai: RawAiBreakdown | null | undefined;
  /** Marks actually awarded (already clamped to maxMarks by the evaluator). */
  score?: number | null;
  /** The question's maximum marks. */
  maxMarks?: number | null;
  /** True when the Gemini call itself failed — the panel says so plainly. */
  failed?: boolean;
  /** Grader error text, surfaced as the panel's error detail. */
  errorMessage?: string;
}

/**
 * Build the full Test Result state for an AI-graded submission.
 * Returns a `submission-failed` state (never throws) when `ai` is missing.
 */
export function buildAiTestResultState({
  ai, score, maxMarks, failed, errorMessage,
}: BuildAiTestResultInput): TestResultState {
  const graderFailed = !!(failed || ai?.failed);

  if (!ai) {
    return {
      status: 'submission-failed',
      cases: [],
      score: typeof score === 'number' ? score : null,
      maxMarks: typeof maxMarks === 'number' ? maxMarks : null,
      message: 'AI evaluation unavailable',
      errorDetail: errorMessage || 'The grader returned no breakdown — your code was saved for manual grading.',
    };
  }

  const rawCases = Array.isArray(ai.testCases) ? ai.testCases : [];

  // Progressive hidden-case reveal — identical rule to Test Case scoring.
  let unlockNext = rawCases.filter(c => c?.hidden).length === 0
    ? true
    : rawCases.filter(c => !c?.hidden).every(c => !!c?.passed);

  const cases: TestResultCase[] = rawCases.map((c, i) => {
    const index = Number.isFinite(Number(c?.index)) ? Number(c!.index) : i;
    const passed = !!c?.passed;
    const source: 'question' | 'ai' = c?.source === 'ai' ? 'ai' : 'question';
    if (!c?.hidden) {
      return {
        index, hidden: false, passed, unlocked: true, source,
        input: c?.input ?? '',
        expectedOutput: c?.expectedOutput ?? '',
        actualOutput: '',
        comment: c?.comment ?? '',
      };
    }
    const unlocked = unlockNext;
    if (unlocked && !passed) unlockNext = false;
    return {
      index, hidden: true, passed, unlocked, source,
      input: unlocked ? (c?.input ?? '') : '',
      expectedOutput: unlocked ? (c?.expectedOutput ?? '') : '',
      actualOutput: '',
      comment: c?.comment ?? '',
    };
  });

  const passedCount = Number(ai.passedTestCases) || cases.filter(c => c.passed).length;
  const totalCount = Number(ai.totalTestCases) || cases.length;

  const rawCriteria = Array.isArray(ai.criteria) ? ai.criteria : [];
  const perCriterionMax = Number(ai.perCriterionMax) || 0;
  const criteria = rawCriteria
    .filter(c => c && typeof c.key === 'string')
    .map(c => ({
      key: c.key as string,
      label: CRITERION_LABEL.get(c.key as string) || (c.key as string),
      percentage: Math.max(0, Math.min(100, Math.round(Number(c.percentage) || 0))),
      score: Math.max(0, Number(c.score) || 0),
      maxScore: perCriterionMax,
      comment: c.comment || '',
    }));

  const { testCaseWeightPct, criteriaWeightPct } = resolveAiWeights(totalCount, criteria.length);

  const aiInfo: AiResultInfo = {
    criteria,
    perCriterionMax,
    criteriaPortion: Math.max(0, Number(ai.criteriaPortion) || 0),
    testCasePortion: Math.max(0, Number(ai.testCasePortion) || 0),
    criteriaWeightPct,
    testCaseWeightPct,
    passedTestCases: passedCount,
    totalTestCases: totalCount,
    model: ai.model || '',
    failed: graderFailed,
  };

  const status: SubmitStatus =
    graderFailed ? 'submission-failed'
    : totalCount > 0 && passedCount === 0 ? 'wrong-answer'
    : totalCount > 0 && passedCount < totalCount ? 'partial'
    : 'accepted';

  return {
    status,
    cases,
    passedCount: totalCount > 0 ? passedCount : undefined,
    totalCount: totalCount > 0 ? totalCount : undefined,
    score: typeof score === 'number' ? score : null,
    maxMarks: typeof maxMarks === 'number' ? maxMarks : null,
    ai: aiInfo,
    message: graderFailed
      ? 'AI grader unavailable — your code was saved for manual grading.'
      : `Graded by AI on ${criteria.length} parameter${criteria.length === 1 ? '' : 's'}`,
    errorDetail: graderFailed ? (errorMessage || undefined) : undefined,
  };
}
