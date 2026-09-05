// assignmentState.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Framework-free tests for the pure assignment-state resolver. Run with:
//
//   npx tsx client/src/app/lms/component/student/assignmentState.test.ts
//
// Same pattern as questionsource/quotaModel.test.ts and
// server/utils/topicCompletion.test.js: `node:assert/strict` + a tiny runner.
//
// The suite pins the reported bug — a partial attempt against a deadline of
// "today, 6:00 PM" must show `In progress` + `Continue` — plus every other
// priority-order case from the spec.

import assert from 'node:assert/strict';
import {
  resolveAssignmentState,
  getAttemptInfo,
  formatDeadline,
  matchesChip,
  type AssignmentStateKind,
} from './assignmentState';

// ─── Tiny runner ────────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (e: any) {
    failed++;
    const line = String(e?.message || e).split('\n')[0];
    failures.push(`${name}\n    ${line}`);
    console.log(`  \x1b[31m✘\x1b[0m ${name}\n      ${line}`);
  }
}
function group(label: string, fn: () => void) {
  console.log(`\n\x1b[1m${label}\x1b[0m`);
  fn();
}

// ─── Fixtures ───────────────────────────────────────────────────────────────
const EX_ID = 'ex-loops-practice';

function makeExercise(overrides: any = {}) {
  return {
    _id: EX_ID,
    exerciseInformation: {
      exerciseId: 'EX511',
      exerciseName: 'Loops Practice',
      exerciseLevel: 'beginner',
    },
    availabilityPeriod: {
      startDate: '2026-08-21T19:11:00.000Z',
      endDate:   '2026-08-21T18:00:00.000Z', // 6:00 PM (default, overridden per test)
    },
    ...overrides,
  };
}

// Build a "now" that lands at 12:00 local on a given YYYY-MM-DD.
function noonOf(y: number, m: number, d: number) { return new Date(y, m - 1, d, 12, 0, 0).getTime(); }

// One We_Do bucket answer, matching how it lands in user.courses[i].answers.
function attemptWithAnswers(exerciseId: string, opts: {
  status?: 'in-progress' | 'completed' | 'terminated';
  testSubmissions?: number;
  questions?: any[];
  score?: number;
} = {}) {
  return {
    We_Do: {
      Assignments: [{
        exerciseId,
        status: opts.status ?? 'in-progress',
        testSubmissions: opts.testSubmissions ?? 0,
        questions: opts.questions ?? [],
        score: opts.score,
      }],
    },
  };
}

// ─── The reported bug: partial attempt, deadline today at 6 PM ───────────────

group('SPEC ACCEPTANCE: partial attempt with due-today deadline → In progress + Continue', () => {
  test('3 of 10 answered, deadline today 6 PM → in-progress + Continue + urgent', () => {
    const nowMs = noonOf(2026, 8, 21); // same local day as 6 PM deadline
    const endLocal = new Date(2026, 7, 21, 18, 0, 0); // Aug 21 18:00 local
    const ex = makeExercise({
      availabilityPeriod: {
        startDate: new Date(2026, 7, 21, 8, 0, 0).toISOString(),
        endDate:   endLocal.toISOString(),
      },
    });
    const answers = attemptWithAnswers(EX_ID, {
      status: 'in-progress',
      testSubmissions: 0,
      questions: [
        { questionId: 'q1', status: 'submitted' },
        { questionId: 'q2', status: 'submitted' },
        { questionId: 'q3', status: 'solved' },
        // q4..q10 not attempted
      ],
    });

    const state = resolveAssignmentState(ex, answers, 'We_Do', 'Assignments', { now: nowMs });
    assert.equal(state.kind, 'in-progress');
    assert.equal(state.label, 'In progress');
    assert.equal(state.tone, 'info');
    assert.equal(state.actionLabel, 'Continue');
    assert.equal(state.actionKind, 'primary');
    assert.equal(state.isUrgent, true, 'partial-attempt row must render with the pale-orange highlight');

    // Due date column reads two-line "Due today / 6:00 PM"
    const dl = formatDeadline(state, { now: nowMs });
    assert.equal(dl.headline, 'Due today');
    assert.match(dl.timeLine, /6:00\sPM/);
    assert.equal(dl.variant, 'today');
  });
});

// ─── Attempt detection ──────────────────────────────────────────────────────

group('getAttemptInfo — attempt detection', () => {
  const ex = makeExercise();
  test('no answers → attemptExists=false, canResume=false', () => {
    const info = getAttemptInfo(ex, {}, 'We_Do', 'Assignments');
    assert.equal(info.attemptExists, false);
    assert.equal(info.canResume, false);
    assert.equal(info.isComplete, false);
  });

  test('matching progress with no submitted questions → attemptExists=true but not progressed', () => {
    const ans = attemptWithAnswers(EX_ID, { status: 'in-progress', questions: [{ status: 'attempted' }] });
    const info = getAttemptInfo(ex, ans, 'We_Do', 'Assignments');
    assert.equal(info.attemptExists, true);
    assert.equal(info.hasProgressedQuestions, false);
  });

  test('progress with submitted question → hasProgressedQuestions=true', () => {
    const ans = attemptWithAnswers(EX_ID, { status: 'in-progress', questions: [{ status: 'submitted' }] });
    const info = getAttemptInfo(ex, ans, 'We_Do', 'Assignments');
    assert.equal(info.hasProgressedQuestions, true);
  });

  test('progress with codeAnswer counts as progressed', () => {
    const ans = attemptWithAnswers(EX_ID, { questions: [{ status: 'attempted', codeAnswer: 'print(1)' }] });
    assert.equal(getAttemptInfo(ex, ans, 'We_Do', 'Assignments').hasProgressedQuestions, true);
  });

  test('testSubmissions >= 1 → isComplete', () => {
    const ans = attemptWithAnswers(EX_ID, { testSubmissions: 1 });
    assert.equal(getAttemptInfo(ex, ans, 'We_Do', 'Assignments').isComplete, true);
  });

  test('status === "completed" → isComplete even with 0 testSubmissions', () => {
    const ans = attemptWithAnswers(EX_ID, { status: 'completed', testSubmissions: 0 });
    assert.equal(getAttemptInfo(ex, ans, 'We_Do', 'Assignments').isComplete, true);
  });
});

// ─── Priority order (§Status and action precedence) ─────────────────────────

group('resolveAssignmentState — priority order', () => {
  const later = new Date(2027, 0, 1).getTime(); // Jan 2027 — past every date fixture

  test('graded > submitted > in-progress: an isComplete + scored attempt reads Graded', () => {
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-02T00:00:00Z' } });
    const ans = attemptWithAnswers(EX_ID, { status: 'completed', testSubmissions: 1, score: 92 });
    const s = resolveAssignmentState(ex, ans, 'We_Do', 'Assignments', { now: later });
    assert.equal(s.kind, 'graded');
    assert.equal(s.actionLabel, 'View feedback');
    assert.match(s.labelSuffix, /92%/);
  });

  test('submitted (no score) → Submitted + View submission', () => {
    const ex = makeExercise();
    const ans = attemptWithAnswers(EX_ID, { status: 'completed', testSubmissions: 1 });
    const s = resolveAssignmentState(ex, ans, 'We_Do', 'Assignments', { now: later });
    assert.equal(s.kind, 'submitted');
    assert.equal(s.actionLabel, 'View submission');
  });

  test('past deadline + no attempt → missed + Closed disabled', () => {
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-02T00:00:00Z' } });
    const s = resolveAssignmentState(ex, {}, 'We_Do', 'Assignments', { now: later });
    assert.equal(s.kind, 'missed');
    assert.equal(s.actionLabel, 'Closed');
    assert.equal(s.actionKind, 'disabled');
  });

  test('past deadline + attempted-but-never-submitted → closed + Closed disabled', () => {
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-02T00:00:00Z' } });
    const ans = attemptWithAnswers(EX_ID, { status: 'in-progress', questions: [{ status: 'submitted' }] });
    const s = resolveAssignmentState(ex, ans, 'We_Do', 'Assignments', { now: later });
    assert.equal(s.kind, 'closed');
    assert.equal(s.actionLabel, 'Closed');
  });

  test('partial attempt WITHIN due-soon window → in-progress wins over due-soon', () => {
    const now = noonOf(2026, 8, 21);
    const endsIn6h = new Date(now + 6 * 60 * 60 * 1000).toISOString();
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-08-01T00:00:00Z', endDate: endsIn6h } });
    const ans = attemptWithAnswers(EX_ID, { questions: [{ status: 'submitted' }] });
    const s = resolveAssignmentState(ex, ans, 'We_Do', 'Assignments', { now });
    assert.equal(s.kind, 'in-progress', 'attempted assignment must never fall back to due-soon');
  });

  test('no attempt + deadline within 48h → due-soon + Start', () => {
    const now = noonOf(2026, 8, 21);
    const endsIn6h = new Date(now + 6 * 60 * 60 * 1000).toISOString();
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-08-01T00:00:00Z', endDate: endsIn6h } });
    const s = resolveAssignmentState(ex, {}, 'We_Do', 'Assignments', { now });
    assert.equal(s.kind, 'due-soon');
    assert.equal(s.actionLabel, 'Start');
  });

  test('no attempt + deadline far off → active + Start', () => {
    const now = noonOf(2026, 8, 21);
    const endsIn10d = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString();
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-08-01T00:00:00Z', endDate: endsIn10d } });
    const s = resolveAssignmentState(ex, {}, 'We_Do', 'Assignments', { now });
    assert.equal(s.kind, 'active');
    assert.equal(s.actionLabel, 'Start');
  });

  test('window not yet open → upcoming + Not available (disabled)', () => {
    const now = noonOf(2026, 8, 21);
    const startsTomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const ex = makeExercise({ availabilityPeriod: { startDate: startsTomorrow, endDate: '2026-12-31T00:00:00Z' } });
    const s = resolveAssignmentState(ex, {}, 'We_Do', 'Assignments', { now });
    assert.equal(s.kind, 'upcoming');
    assert.equal(s.actionLabel, 'Not available');
    assert.equal(s.actionKind, 'disabled');
  });

  test('late-submission window still allows Continue when attempt exists', () => {
    const now = noonOf(2026, 8, 21);
    const ended1hAgo   = new Date(now - 1  * 60 * 60 * 1000).toISOString();
    const cutOff2hAway = new Date(now + 2  * 60 * 60 * 1000).toISOString();
    const ex = makeExercise({
      availabilityPeriod: {
        startDate:     '2026-08-01T00:00:00Z',
        endDate:       ended1hAgo,
        cutOffEnabled: true,
        cutOffDate:    cutOff2hAway,
      },
    });
    const ans = attemptWithAnswers(EX_ID, { questions: [{ status: 'submitted' }] });
    const s = resolveAssignmentState(ex, ans, 'We_Do', 'Assignments', { now });
    assert.equal(s.kind, 'in-progress');
    assert.equal(s.actionLabel, 'Continue');
  });
});

// ─── Due date formatting ────────────────────────────────────────────────────

group('formatDeadline — spec §"Due-date presentation"', () => {
  test('due today → "Due today" + time', () => {
    const now = noonOf(2026, 8, 21);
    const end = new Date(2026, 7, 21, 18, 0, 0).toISOString();
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-08-01T00:00:00Z', endDate: end } });
    const s = resolveAssignmentState(ex, attemptWithAnswers(EX_ID, { questions: [{ status: 'submitted' }] }), 'We_Do', 'Assignments', { now });
    const dl = formatDeadline(s, { now });
    assert.equal(dl.headline, 'Due today');
    assert.equal(dl.variant, 'today');
  });

  test('due tomorrow → "Due tomorrow" via local calendar', () => {
    const now = new Date(2026, 7, 21, 22, 0, 0).getTime(); // late tonight
    const end = new Date(2026, 7, 22, 10, 0, 0).toISOString(); // tomorrow morning
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-08-01T00:00:00Z', endDate: end } });
    const s = resolveAssignmentState(ex, {}, 'We_Do', 'Assignments', { now });
    const dl = formatDeadline(s, { now });
    assert.equal(dl.headline, 'Due tomorrow');
    assert.equal(dl.variant, 'tomorrow');
  });

  test('due in <24h but different calendar day → still "Due tomorrow"', () => {
    // 23:30 local, deadline at 00:30 local the NEXT day: <24h out but the
    // headline must read "Due tomorrow", not "Due today".
    const now = new Date(2026, 7, 21, 23, 30, 0).getTime();
    const end = new Date(2026, 7, 22, 0, 30, 0).toISOString();
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-08-01T00:00:00Z', endDate: end } });
    const s = resolveAssignmentState(ex, {}, 'We_Do', 'Assignments', { now });
    assert.equal(formatDeadline(s, { now }).headline, 'Due tomorrow');
  });

  test('future deadline → "Due <short date>"', () => {
    const now = noonOf(2026, 8, 21);
    const end = new Date(2026, 8, 7, 17, 0, 0).toISOString(); // Sep 7
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-08-01T00:00:00Z', endDate: end } });
    const s = resolveAssignmentState(ex, {}, 'We_Do', 'Assignments', { now });
    assert.match(formatDeadline(s, { now }).headline, /^Due Sep 7,\s?2026$/);
  });

  test('submitted → "Submitted <date>"', () => {
    const now = new Date(2026, 9, 1).getTime();
    const end = new Date(2026, 7, 29, 9, 40, 0).toISOString();
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-08-01T00:00:00Z', endDate: end } });
    const s = resolveAssignmentState(ex, attemptWithAnswers(EX_ID, { status: 'completed', testSubmissions: 1 }), 'We_Do', 'Assignments', { now });
    const dl = formatDeadline(s, { now });
    assert.match(dl.headline, /^Submitted Aug 29,\s?2026$/);
    assert.equal(dl.variant, 'submitted');
  });

  test('missed → "Closed <date>"', () => {
    const now = new Date(2026, 9, 1).getTime();
    const end = new Date(2026, 7, 8, 23, 59, 0).toISOString();
    const ex = makeExercise({ availabilityPeriod: { startDate: '2026-08-01T00:00:00Z', endDate: end } });
    const s = resolveAssignmentState(ex, {}, 'We_Do', 'Assignments', { now });
    const dl = formatDeadline(s, { now });
    assert.match(dl.headline, /^Closed Aug 8,\s?2026$/);
    assert.equal(dl.variant, 'closed');
  });
});

// ─── Filter chip grouping ───────────────────────────────────────────────────

group('matchesChip — spec §"Search and filters"', () => {
  const cases: Array<[AssignmentStateKind, Record<'all'|'active'|'submitted'|'pending'|'missed', boolean>]> = [
    ['active',       { all: true, active: true,  submitted: false, pending: false, missed: false }],
    ['due-soon',     { all: true, active: true,  submitted: false, pending: false, missed: false }],
    ['in-progress',  { all: true, active: true,  submitted: false, pending: false, missed: false }],
    ['submitted',    { all: true, active: false, submitted: true,  pending: false, missed: false }],
    ['graded',       { all: true, active: false, submitted: true,  pending: false, missed: false }],
    ['upcoming',     { all: true, active: false, submitted: false, pending: true,  missed: false }],
    ['missed',       { all: true, active: false, submitted: false, pending: false, missed: true  }],
    ['closed',       { all: true, active: false, submitted: false, pending: false, missed: true  }],
  ];
  for (const [kind, expected] of cases) {
    test(`kind=${kind} → ${JSON.stringify(expected)}`, () => {
      for (const chip of ['all', 'active', 'submitted', 'pending', 'missed'] as const) {
        assert.equal(matchesChip(kind, chip), (expected as any)[chip], `chip=${chip}`);
      }
    });
  }
});

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n\x1b[31mFAILURES:\x1b[0m');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
