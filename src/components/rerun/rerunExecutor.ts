// Client-side batch runner for the Rerun feature.
//
// For each { student × question } in the input set, executes the student's
// STORED code against the question's CURRENT test cases using the same Piston
// endpoint the student's submit flow uses (executeCodeAction). Builds the
// same-shaped `evaluationBreakdown` payload the server's rerunSubmissions
// endpoint expects, and yields per-item progress so a UI can render a bar.
//
// AI evaluation is intentionally deferred to a follow-up commit — the
// executor short-circuits AI-method items with `skipped: 'ai-not-yet-supported'`
// so a MVP rerun over a mixed exercise still processes its test-case items.
//
// Manual questions are always skipped: there's no automated pipeline to rerun.

import { executeCodeAction } from '@/apiServices/execute-code';
import type {
  RerunContext,
  RerunQuestion,
  RerunSubmission,
  RerunUpdate,
} from '@/apiServices/rerunApi';

// Same language ID → Piston mapping used by the submit flow (execute-code.ts).
// Keep in sync if new languages get added there.
const LANGUAGE_ID: Record<string, number> = {
  javascript: 63,
  js: 63,
  python: 71,
  py: 71,
  java: 62,
  cpp: 54,
  'c++': 54,
  typescript: 74,
  ts: 74,
};

function resolveLanguageId(language: string): number | null {
  const k = String(language || '').toLowerCase().trim();
  return LANGUAGE_ID[k] ?? null;
}

// Loose output equality — trims trailing whitespace on each line and the
// document. Matches how most autograders treat "correct output".
function outputsMatch(actual: string, expected: string): boolean {
  const norm = (s: string) => String(s ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\s+$/g, '');
  return norm(actual) === norm(expected);
}

export type RerunItemOutcome =
  | { kind: 'scored'; passed: number; total: number; score: number; status: 'solved' | 'attempted' | 'submitted' }
  | { kind: 'skipped'; reason: 'manual' | 'ai-not-yet-supported' | 'no-code' | 'unsupported-language' }
  | { kind: 'errored'; reason: string };

export interface RerunProgress {
  total: number;
  completed: number;
  scored: number;
  skipped: number;
  errored: number;
  currentUserId?: string;
  currentQuestionId?: string;
  currentUserName?: string;
}

interface RunOneArgs {
  submission: RerunSubmission;
  question: RerunQuestion;
  evaluationMethod: 'testcase' | 'ai' | 'manual' | null;
}

async function runOne({ submission, question, evaluationMethod }: RunOneArgs): Promise<RerunItemOutcome> {
  if (evaluationMethod === 'manual') return { kind: 'skipped', reason: 'manual' };
  if (evaluationMethod === 'ai') return { kind: 'skipped', reason: 'ai-not-yet-supported' };

  const code = submission.codeAnswer || '';
  if (!code.trim()) return { kind: 'skipped', reason: 'no-code' };

  const langId = resolveLanguageId(submission.language);
  if (langId === null) return { kind: 'skipped', reason: 'unsupported-language' };

  const testCases = Array.isArray(question.testCases) ? question.testCases : [];
  if (testCases.length === 0) {
    // No test cases means no automated scoring possible.
    return { kind: 'skipped', reason: 'manual' };
  }

  let passed = 0;
  const total = testCases.length;

  // Run each test case in sequence. Sequential avoids hammering the free
  // Piston endpoint and keeps memory bounded.
  for (const tc of testCases) {
    try {
      const result = await executeCodeAction(code, langId, tc.input || '');
      if (!result.error && outputsMatch(result.output || '', tc.expectedOutput || '')) {
        passed++;
      }
    } catch (err) {
      // Per-testcase error → count as failure, keep going.
    }
  }

  const questionMaxScore = Number(question.score) || 100;
  const rawScore = total > 0 ? (passed / total) * questionMaxScore : 0;
  const score = Math.round(rawScore);
  const status: 'solved' | 'submitted' = passed === total && total > 0 ? 'solved' : 'submitted';

  return { kind: 'scored', passed, total, score, status };
}

export interface RerunBatchOptions {
  context: RerunContext;
  // Set of question IDs to process — pass ALL for "all" mode or the flagged
  // subset for "recently edited" mode.
  questionIds: string[];
  // Optional student filter — omit to run for every submission.
  userIds?: string[];
  onProgress?: (p: RerunProgress) => void;
  signal?: AbortSignal;
}

export interface RerunBatchResult {
  updates: RerunUpdate[];
  progress: RerunProgress;
  skippedDetails: Array<{ userId: string; questionId: string; reason: RerunItemOutcome extends { kind: 'skipped'; reason: infer R } ? R : never }>;
  erroredDetails: Array<{ userId: string; questionId: string; reason: string }>;
}

export async function runRerunBatch(opts: RerunBatchOptions): Promise<RerunBatchResult> {
  const { context, questionIds, userIds, onProgress, signal } = opts;
  const qById = new Map<string, RerunQuestion>();
  // Defensive coercion — a malformed/error server payload without these fields
  // would crash Array.prototype.* calls with "not iterable" style errors.
  const safeQuestions = Array.isArray(context.questions) ? context.questions : [];
  const safeSubmissions = Array.isArray(context.submissions) ? context.submissions : [];
  safeQuestions.forEach(q => qById.set(String(q._id), q));
  const wantedQ = new Set(questionIds.map(String));
  const wantedU = userIds ? new Set(userIds.map(String)) : null;

  const items = safeSubmissions.filter(s =>
    wantedQ.has(String(s.questionId)) &&
    (wantedU ? wantedU.has(String(s.userId)) : true)
  );

  const evaluationMethod = context.evaluationMethod?.method ?? 'testcase';
  const updates: RerunUpdate[] = [];
  const skippedDetails: RerunBatchResult['skippedDetails'] = [];
  const erroredDetails: RerunBatchResult['erroredDetails'] = [];

  const progress: RerunProgress = {
    total: items.length,
    completed: 0,
    scored: 0,
    skipped: 0,
    errored: 0,
  };
  onProgress?.({ ...progress });

  for (const sub of items) {
    if (signal?.aborted) throw new Error('aborted');
    const q = qById.get(String(sub.questionId));
    if (!q) {
      erroredDetails.push({ userId: sub.userId, questionId: sub.questionId, reason: 'question metadata missing' });
      progress.errored++;
      progress.completed++;
      onProgress?.({ ...progress, currentUserId: sub.userId, currentQuestionId: sub.questionId, currentUserName: sub.userName });
      continue;
    }
    progress.currentUserId = sub.userId;
    progress.currentQuestionId = sub.questionId;
    progress.currentUserName = sub.userName;
    onProgress?.({ ...progress });

    let outcome: RerunItemOutcome;
    try {
      outcome = await runOne({ submission: sub, question: q, evaluationMethod });
    } catch (err: any) {
      outcome = { kind: 'errored', reason: err?.message || 'unknown error' };
    }

    if (outcome.kind === 'scored') {
      progress.scored++;
      updates.push({
        userId: sub.userId,
        questionId: sub.questionId,
        score: outcome.score,
        status: outcome.status,
        evaluationBreakdown: {
          method: 'testcase',
          testcase: { passed: outcome.passed, total: outcome.total },
        },
        note: 'client-side rerun',
      });
    } else if (outcome.kind === 'skipped') {
      progress.skipped++;
      skippedDetails.push({ userId: sub.userId, questionId: sub.questionId, reason: outcome.reason as any });
    } else {
      progress.errored++;
      erroredDetails.push({ userId: sub.userId, questionId: sub.questionId, reason: outcome.reason });
    }
    progress.completed++;
    onProgress?.({ ...progress });
  }

  return { updates, progress, skippedDetails, erroredDetails };
}
