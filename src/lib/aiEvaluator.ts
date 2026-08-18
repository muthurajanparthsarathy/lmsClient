// aiEvaluator.ts
// ─────────────────────────────────────────────────────────────────────────────
// Client-side AI evaluation for programming submissions.
//
// Called by the student code editors (We_Do + You_Do + multi-file) when the
// exercise's `evaluationMethod.method === 'ai'`. One Gemini call does three
// jobs at once:
//   1) GENERATE  — synthesise `testCasesCount` new test cases (only when the
//                  question hasn't been populated yet — cached after first Submit)
//   2) JUDGE     — decide, statically, whether the student's code would pass
//                  each cached-generated test case AND each of the question's
//                  authored test cases
//   3) SCORE     — return a percentage per selected evaluation criterion
//
// SCORE MODEL — 50 / 50 split of the question's maxMarks:
//   testCasePortion = (passed / total) × maxMarks × 0.5     (when total > 0)
//   criteriaPortion = (avg criteria %) / 100 × maxMarks × 0.5   (when criteria > 0)
//   totalScore      = testCasePortion + criteriaPortion, rounded to 2 dp
//
// Degenerate cases: if there are no test cases at all (question empty AND
// count === 0), criteria carry the full 100 %; if criteria list is empty,
// test cases carry the full 100 %; if BOTH are empty the total is 0 and we
// mark the breakdown as failed (nothing to evaluate against).
//
// The 20 (or whatever `testCasesCount` is) cases the AI GENERATES the first
// time round are handed back to the caller so it can persist them on the
// question doc; subsequent submits pass those cached cases back in
// (`cachedGeneratedTestCases`) and Gemini only judges. Same 20 for every student.
//
// FALLBACK — every failure path (network, non-JSON, empty response, missing
// key) returns `{failed: true, totalScore: 0, breakdown}` so the caller can
// still POST the submission. The breakdown carries `failed: true` so the
// Review page surfaces "AI evaluation failed — please grade manually".

import { callGeminiJSON, GeminiError } from '@/app/lms/component/questionforms/geminiClient';
import type { AiCriterion } from '@/app/lms/component/evaluation/EvaluationMethodConfig';

const GEMINI_MODEL_LABEL = 'gemini-3.5-flash (fallback: gemini-2.5-flash)';

const CRITERION_LABEL: Record<AiCriterion, string> = {
  correctness: 'Correctness — does the code solve the problem for typical & stated inputs?',
  codeQuality: 'Code Quality — structure, naming, modularity, no code smells.',
  efficiency: 'Efficiency — time & space complexity appropriate for the constraints.',
  readability: 'Readability — clarity, formatting, sensible comments where helpful.',
  edgeCases: 'Edge Cases — handles empty, boundary, and unexpected inputs safely.',
  bestPractices: 'Best Practices — idiomatic language features, standard conventions.',
};

const MAX_INPUT_CHARS = 400;
const MAX_OUTPUT_CHARS = 400;
const MAX_CODE_CHARS = 12000;
const MAX_TESTCASE_LIST = 25;      // cap the number of PROMPTED cases so the
                                    // prompt stays under the token budget

// ─── Public types ────────────────────────────────────────────────────────────
export type BreakdownCriterion = {
  key: AiCriterion;
  percentage: number;    // 0–100 integer
  score: number;         // absolute marks awarded within the criteria half
  comment: string;
};

export type BreakdownTestCase = {
  index: number;
  source: 'question' | 'ai';
  input: string;
  expectedOutput: string;
  passed: boolean;
  comment: string;
};

export interface GeneratedTestCase {
  input: string;
  expectedOutput: string;
}

export interface EvaluationBreakdownAi {
  method: 'ai';
  ai: {
    perCriterionMax: number;
    criteria: BreakdownCriterion[];
    testCases: BreakdownTestCase[];
    passedTestCases: number;
    totalTestCases: number;
    criteriaPortion: number;
    testCasePortion: number;
    model: string;
    failed: boolean;
  };
}

export interface AiEvaluationResult {
  totalScore: number;
  breakdown: EvaluationBreakdownAi;
  failed: boolean;
  errorMessage?: string;
  /**
   * Newly generated cases to persist on the question doc. Populated only
   * when `cachedGeneratedTestCases` was empty AND generation succeeded.
   * Caller sends this back to the server so subsequent students see the
   * same set.
   */
  newlyGeneratedTestCases?: GeneratedTestCase[];
}

export interface EvaluateWithAiInput {
  code: string;
  language: string;
  question: {
    title?: string;
    description?: string;
    /** Test cases the trainer authored on the question. Always judged. */
    testCases?: Array<{ input?: string; expectedOutput?: string; isSample?: boolean; isHidden?: boolean }>;
  };
  criteria: AiCriterion[];
  maxMarks: number;
  /** From the exercise's evaluationMethod.ai.testCasesCount. Clamped [0, 50]. */
  testCasesCount: number;
  /**
   * Test cases the AI generated on an EARLIER Submit (from question doc).
   * When populated, Gemini only judges — no generation. Empty on the first
   * student's Submit; caller stores newlyGeneratedTestCases back on the doc.
   */
  cachedGeneratedTestCases?: GeneratedTestCase[];
  signal?: AbortSignal;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

const truncate = (s: string, n: number) => {
  const str = (s ?? '').toString();
  if (str.length <= n) return str;
  const half = Math.floor((n - 8) / 2);
  return str.slice(0, half) + '\n… …\n' + str.slice(-half);
};

const cleanTestCase = (tc: any) => ({
  input: truncate((tc?.input || '').toString(), MAX_INPUT_CHARS),
  expectedOutput: truncate((tc?.expectedOutput || '').toString(), MAX_OUTPUT_CHARS),
});

// ─── Prompt builder ──────────────────────────────────────────────────────────
interface PromptInput {
  code: string;
  language: string;
  title: string;
  description: string;
  criteria: AiCriterion[];
  questionTestCases: Array<{ input: string; expectedOutput: string }>;
  cachedGenerated: Array<{ input: string; expectedOutput: string }>;
  countToGenerate: number;
}

const buildPrompt = (p: PromptInput): string => {
  const critLines = p.criteria.length > 0
    ? p.criteria.map(k => `  - ${k}: ${CRITERION_LABEL[k]}`).join('\n')
    : '  (none — skip the "criteria" field in the response)';

  const listCases = (label: string, cases: Array<{ input: string; expectedOutput: string }>) => {
    if (cases.length === 0) return '';
    return `${label}:\n` + cases.map((tc, i) =>
      `  #${i + 1}\n    input: ${truncate(tc.input, MAX_INPUT_CHARS) || '(empty)'}\n    expected: ${truncate(tc.expectedOutput, MAX_OUTPUT_CHARS) || '(empty)'}`,
    ).join('\n');
  };

  const generationInstructions = p.countToGenerate > 0
    ? [
        '',
        `Also GENERATE exactly ${p.countToGenerate} NEW test cases that cover meaningful behaviours the`,
        'authored test cases might miss (edge / boundary / invalid input / typical case mix). Include them',
        'in the "newlyGenerated" array of the response, each with concrete `input` and `expectedOutput`',
        'strings you compute FROM THE PROBLEM DESCRIPTION (not by running the code). Judge the student code',
        'against these newly generated cases too, filed under source "ai".',
      ].join('\n')
    : '';

  return [
    'You are grading a student\'s programming submission. Do THREE things in ONE JSON response:',
    ' A) JUDGE the student code against every test case listed below (mark passed true/false + one-line comment).',
    p.countToGenerate > 0
      ? ` B) GENERATE ${p.countToGenerate} NEW test cases (input + expected output) covering edge cases + typical + boundary.`
      : ' B) (No generation requested this call — testCasesCount is 0.)',
    ' C) SCORE the code independently on each selected criterion.',
    '',
    `Question title: ${p.title || '(untitled)'}`,
    `Language: ${p.language || '(unspecified)'}`,
    p.description ? `Description:\n${truncate(p.description, 1500)}\n` : '',
    'Selected evaluation criteria:',
    critLines,
    '',
    listCases('Question authored test cases (source: "question")', p.questionTestCases),
    p.cachedGenerated.length > 0
      ? '\n' + listCases('Previously AI-generated test cases (source: "ai" — reuse verbatim, judge only)', p.cachedGenerated)
      : '',
    generationInstructions,
    '',
    `Student code (${p.language || 'code'}):`,
    '```',
    truncate(p.code || '', MAX_CODE_CHARS),
    '```',
    '',
    'Return STRICT JSON matching this schema EXACTLY (no prose, no markdown):',
    '{',
    '  "questionTestCaseResults": [ { "index": <0-based>, "passed": <bool>, "comment": "<one sentence, ≤120 chars>" }, … ],',
    p.cachedGenerated.length > 0
      ? '  "cachedGeneratedResults": [ { "index": <0-based>, "passed": <bool>, "comment": "<one sentence>" }, … ],'
      : (p.countToGenerate > 0
          ? '  "newlyGenerated": [ { "input": "<string>", "expectedOutput": "<string>", "passed": <bool>, "comment": "<one sentence>" }, … ],'
          : ''),
    '  "criteria": [ { "key": "<one of the selected>", "percentage": <int 0-100>, "comment": "<one sentence>" }, … ]',
    '}',
    '',
    'Rules:',
    '- Judge STATICALLY — you cannot run the code.',
    '- Include EXACTLY one entry per authored test case, in the same order.',
    p.cachedGenerated.length > 0
      ? '- Include EXACTLY one entry per previously-generated case, in the same order.'
      : (p.countToGenerate > 0 ? `- Include EXACTLY ${p.countToGenerate} newlyGenerated entries.` : ''),
    '- Include EXACTLY one criterion entry per selected criterion; do not add/drop/duplicate.',
    '- Empty submission or non-attempt → all passed:false, all percentages 0.',
  ].filter(Boolean).join('\n');
};

// ─── Response shape ──────────────────────────────────────────────────────────
interface GeminiJudgment {
  index?: number;
  passed?: boolean;
  comment?: string;
}
interface GeminiGeneratedCase {
  input?: string;
  expectedOutput?: string;
  passed?: boolean;
  comment?: string;
}
interface GeminiCriterion {
  key?: string;
  percentage?: number;
  comment?: string;
}
interface GeminiResponse {
  questionTestCaseResults?: GeminiJudgment[];
  cachedGeneratedResults?: GeminiJudgment[];
  newlyGenerated?: GeminiGeneratedCase[];
  criteria?: GeminiCriterion[];
}

// ─── Main entry point ────────────────────────────────────────────────────────
export async function evaluateWithAi(input: EvaluateWithAiInput): Promise<AiEvaluationResult> {
  const maxMarks = Math.max(0, Number(input.maxMarks) || 0);
  // Never leave criteria empty — the settings UI shows a red hint but doesn't
  // hard-block, so a mis-configured exercise still reaches us. Fall back to
  // ['correctness'] so the student's Submit isn't wedged waiting on config.
  const criteria: AiCriterion[] = input.criteria.length ? input.criteria : ['correctness'];
  // Clamp count [0, 50]; 0 means "skip generation, only judge question's cases".
  const rawCount = Math.max(0, Math.min(50, Math.floor(Number(input.testCasesCount) || 0)));
  const cachedGen = (input.cachedGeneratedTestCases || []).map(cleanTestCase);
  const questionCases = (input.question.testCases || []).map(cleanTestCase);
  // If we already have cached generated cases, DON'T ask Gemini for more —
  // reuse them so every student sees the same set.
  const countToGenerate = cachedGen.length > 0 ? 0 : rawCount;

  // ── Precompute per-criterion max BEFORE the API call so failure fallback is coherent ──
  const perCriterionMax = criteria.length > 0 ? (maxMarks * 0.5) / criteria.length : 0;

  const failedBreakdown = (): EvaluationBreakdownAi => ({
    method: 'ai',
    ai: {
      perCriterionMax: round2(perCriterionMax),
      criteria: criteria.map(k => ({ key: k, percentage: 0, score: 0, comment: '' })),
      testCases: [],
      passedTestCases: 0,
      totalTestCases: 0,
      criteriaPortion: 0,
      testCasePortion: 0,
      model: GEMINI_MODEL_LABEL,
      failed: true,
    },
  });

  const prompt = buildPrompt({
    code: input.code,
    language: input.language,
    title: input.question.title || '',
    description: (input.question.description || '').replace(/<[^>]*>/g, '').trim(),
    criteria,
    questionTestCases: questionCases.slice(0, MAX_TESTCASE_LIST),
    cachedGenerated: cachedGen.slice(0, MAX_TESTCASE_LIST),
    countToGenerate,
  });

  let raw: GeminiResponse;
  try {
    raw = await callGeminiJSON<GeminiResponse>({
      prompt,
      systemInstruction:
        'You are a strict programming code grader. Return only valid JSON matching the requested schema.',
      temperature: 0.2,
      maxOutputTokens: 4096,
      jsonMode: true,
      signal: input.signal,
    });
  } catch (err) {
    const msg = err instanceof GeminiError
      ? `AI grader failed (${err.status ?? 'network'}). Your code was saved — trainer will grade manually.`
      : (err as any)?.name === 'AbortError'
        ? 'AI grader cancelled.'
        : 'AI grader failed. Your code was saved — trainer will grade manually.';
    return { totalScore: 0, breakdown: failedBreakdown(), failed: true, errorMessage: msg };
  }
  if (!raw || typeof raw !== 'object') {
    return {
      totalScore: 0,
      breakdown: failedBreakdown(),
      failed: true,
      errorMessage: 'AI grader returned an unexpected response. Your code was saved — trainer will grade manually.',
    };
  }

  // ── Merge test case results ────────────────────────────────────────────
  const outTestCases: BreakdownTestCase[] = [];

  // Question authored cases first
  const qResults = Array.isArray(raw.questionTestCaseResults) ? raw.questionTestCaseResults : [];
  questionCases.forEach((tc, i) => {
    const r = qResults.find(x => x?.index === i) ?? qResults[i];
    outTestCases.push({
      index: outTestCases.length,
      source: 'question',
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      passed: !!r?.passed,
      comment: (r?.comment ?? '').toString().slice(0, 200),
    });
  });

  // AI cases: either previously cached (judged only) or newly generated (judged inline)
  let newlyGeneratedForCaller: GeneratedTestCase[] | undefined;
  if (cachedGen.length > 0) {
    const aiResults = Array.isArray(raw.cachedGeneratedResults) ? raw.cachedGeneratedResults : [];
    cachedGen.forEach((tc, i) => {
      const r = aiResults.find(x => x?.index === i) ?? aiResults[i];
      outTestCases.push({
        index: outTestCases.length,
        source: 'ai',
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        passed: !!r?.passed,
        comment: (r?.comment ?? '').toString().slice(0, 200),
      });
    });
  } else if (countToGenerate > 0 && Array.isArray(raw.newlyGenerated)) {
    // Only accept up to countToGenerate — Gemini can over-produce
    const clipped = raw.newlyGenerated.slice(0, countToGenerate);
    clipped.forEach(g => {
      const inp = (g.input ?? '').toString();
      const exp = (g.expectedOutput ?? '').toString();
      outTestCases.push({
        index: outTestCases.length,
        source: 'ai',
        input: inp,
        expectedOutput: exp,
        passed: !!g.passed,
        comment: (g.comment ?? '').toString().slice(0, 200),
      });
    });
    // Send only the input/expectedOutput back for persistence — the pass/comment
    // are per-submission, not per-cache.
    newlyGeneratedForCaller = clipped.map(g => ({
      input: (g.input ?? '').toString(),
      expectedOutput: (g.expectedOutput ?? '').toString(),
    }));
  }

  const totalTestCases = outTestCases.length;
  const passedTestCases = outTestCases.filter(t => t.passed).length;

  // ── Criteria scoring ───────────────────────────────────────────────────
  const critByKey = new Map<AiCriterion, GeminiCriterion>();
  (raw.criteria || []).forEach(c => {
    const k = c?.key as AiCriterion | undefined;
    if (k && criteria.includes(k) && !critByKey.has(k)) critByKey.set(k, c);
  });
  const outCriteria: BreakdownCriterion[] = criteria.map(k => {
    const r = critByKey.get(k);
    const pct = Math.max(0, Math.min(100, Math.round(Number(r?.percentage) || 0)));
    return {
      key: k,
      percentage: pct,
      score: round2(perCriterionMax * (pct / 100)),
      comment: (r?.comment ?? '').toString().slice(0, 200),
    };
  });

  // ── Combine into the 50/50 total ───────────────────────────────────────
  // Degenerate cases: shift the weight to whichever side actually exists so
  // maxMarks is fully addressable (empty criteria list AND empty test cases
  // still returns 0, marked failed by the caller if desired).
  const haveTC = totalTestCases > 0;
  const haveCrit = criteria.length > 0;
  const criteriaAvgPct = haveCrit
    ? outCriteria.reduce((s, c) => s + c.percentage, 0) / outCriteria.length
    : 0;
  const tcPassRatio = haveTC ? passedTestCases / totalTestCases : 0;

  let criteriaPortion = 0;
  let testCasePortion = 0;
  if (haveTC && haveCrit) {
    criteriaPortion = round2((criteriaAvgPct / 100) * maxMarks * 0.5);
    testCasePortion = round2(tcPassRatio * maxMarks * 0.5);
  } else if (haveCrit) {
    // No test cases at all → criteria carry full 100 %.
    criteriaPortion = round2((criteriaAvgPct / 100) * maxMarks);
  } else if (haveTC) {
    testCasePortion = round2(tcPassRatio * maxMarks);
  }
  const totalScore = round2(criteriaPortion + testCasePortion);

  return {
    totalScore,
    breakdown: {
      method: 'ai',
      ai: {
        perCriterionMax: round2(perCriterionMax),
        criteria: outCriteria,
        testCases: outTestCases,
        passedTestCases,
        totalTestCases,
        criteriaPortion,
        testCasePortion,
        model: GEMINI_MODEL_LABEL,
        failed: false,
      },
    },
    failed: false,
    newlyGeneratedTestCases: newlyGeneratedForCaller,
  };
}
