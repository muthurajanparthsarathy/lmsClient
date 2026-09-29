// quotaModel.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Framework-free smoke tests for the shared quota engine. Run with:
//
//   npx tsx client/src/app/lms/component/questionsource/quotaModel.test.ts
//
// No Vitest/Jest — just `node:assert/strict` + a tiny runner. Every test is
// pure (no React, no async, no network) so it exits cleanly on the first
// failure and prints a PASS/FAIL row for each case. Add more cases by
// appending `test('...', () => { ... })` calls.
//
// Coverage: the shared Manual bucket model, per-difficulty enforcement,
// progression rules (getNextPendingQuestion), and the copy string that
// drives the chooser popup's allocation strip.

import assert from 'node:assert/strict';
import {
  getQuotaBucket,
  srcToBucket,
  srcToEntryMethod,
  readPlan,
  readUsed,
  readRemaining,
  readRemainingTotals,
  getNextPendingQuestion,
  getManualImportCapacity,
  describeBucketStatus,
} from './quotaModel';

// ─── Tiny test runner ────────────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } catch (e: any) {
    failed++;
    failures.push(`${name}\n    ${e.message.split('\n')[0]}`);
    console.log(`  \x1b[31m✘\x1b[0m ${name}\n      ${e.message.split('\n')[0]}`);
  }
}
function group(label: string, fn: () => void) {
  console.log(`\n\x1b[1m${label}\x1b[0m`);
  fn();
}

// ─── Fixtures ────────────────────────────────────────────────────────────────
// Plan matching the spec's Five-question example:
//   Easy   1 AI · 1 Manual · 0 Other  = 2
//   Medium 1 AI · 0 Manual · 1 Other  = 2
//   Hard   0 AI · 1 Manual · 0 Other  = 1
const FIVE_QUESTION_PLAN = {
  easy:   { scratch: 1, ai: 1, thirdParty: 0 },
  medium: { scratch: 0, ai: 1, thirdParty: 1 },
  hard:   { scratch: 1, ai: 0, thirdParty: 0 },
};

// Plan for shared-Manual demonstrations: 5 Manual for Easy, nothing else.
const SHARED_MANUAL_PLAN = {
  easy:   { scratch: 5, ai: 0, thirdParty: 0 },
  medium: { scratch: 0, ai: 0, thirdParty: 0 },
  hard:   { scratch: 0, ai: 0, thirdParty: 0 },
};

// Question doc shape (loose — matches what the app stores).
const q = (source: string, difficulty: string, extra: any = {}) => ({
  source, difficulty, isActive: true, ...extra,
});

// ─── Suites ──────────────────────────────────────────────────────────────────

group('getQuotaBucket — entry method → bucket', () => {
  test('ai → ai', () => assert.equal(getQuotaBucket('ai'), 'ai'));
  test('otherPlatform → otherPlatform', () => assert.equal(getQuotaBucket('otherPlatform'), 'otherPlatform'));
  test('scratch → manual', () => assert.equal(getQuotaBucket('scratch'), 'manual'));
  test('questionBank → manual', () => assert.equal(getQuotaBucket('questionBank'), 'manual'));
  test('documentUpload → manual', () => assert.equal(getQuotaBucket('documentUpload'), 'manual'));
});

group('srcToBucket — persisted source tag → bucket', () => {
  test('scratch-manual → manual', () => assert.equal(srcToBucket('scratch-manual'), 'manual'));
  test('scratch-bank → manual', () => assert.equal(srcToBucket('scratch-bank'), 'manual'));
  test('scratch-upload → manual', () => assert.equal(srcToBucket('scratch-upload'), 'manual'));
  test('ai → ai', () => assert.equal(srcToBucket('ai'), 'ai'));
  test('thirdParty → otherPlatform', () => assert.equal(srcToBucket('thirdParty'), 'otherPlatform'));
  test('thirdParty:leetcode → otherPlatform', () => assert.equal(srcToBucket('thirdParty:leetcode'), 'otherPlatform'));
  test('empty → manual (safe default)', () => assert.equal(srcToBucket(''), 'manual'));
  test('null → manual (legacy untagged)', () => assert.equal(srcToBucket(null), 'manual'));
  test('unknown → manual (safe default)', () => assert.equal(srcToBucket('wat'), 'manual'));
});

group('srcToEntryMethod — persisted source tag → method', () => {
  test('scratch-manual → scratch', () => assert.equal(srcToEntryMethod('scratch-manual'), 'scratch'));
  test('scratch-bank → questionBank', () => assert.equal(srcToEntryMethod('scratch-bank'), 'questionBank'));
  test('scratch-upload → documentUpload', () => assert.equal(srcToEntryMethod('scratch-upload'), 'documentUpload'));
  test('ai → ai', () => assert.equal(srcToEntryMethod('ai'), 'ai'));
  test('thirdParty → otherPlatform', () => assert.equal(srcToEntryMethod('thirdParty'), 'otherPlatform'));
});

group('readPlan — rekeys scratch column to manual bucket', () => {
  test('five-question plan reshaped', () => {
    const plan = readPlan(FIVE_QUESTION_PLAN);
    assert.ok(plan);
    assert.deepEqual(plan!.easy,   { ai: 1, manual: 1, otherPlatform: 0 });
    assert.deepEqual(plan!.medium, { ai: 1, manual: 0, otherPlatform: 1 });
    assert.deepEqual(plan!.hard,   { ai: 0, manual: 1, otherPlatform: 0 });
  });
  test('empty matrix → null (nothing configured)', () => {
    assert.equal(readPlan({ easy: {}, medium: {}, hard: {} }), null);
  });
  test('undefined → null', () => {
    assert.equal(readPlan(undefined), null);
  });
});

group('readUsed — counts saved questions per (difficulty, bucket)', () => {
  test('mixed sources counted into shared Manual pool', () => {
    const questions = [
      q('scratch-manual', 'easy'),
      q('scratch-bank', 'easy'),
      q('scratch-upload', 'easy'),
      q('ai', 'easy'),
      q('thirdParty', 'medium'),
    ];
    const used = readUsed(questions);
    assert.equal(used.easy.manual, 3, 'scratch/bank/upload all bill Manual');
    assert.equal(used.easy.ai, 1);
    assert.equal(used.medium.otherPlatform, 1);
  });
  test('deactivated questions excluded', () => {
    const questions = [
      q('scratch-bank', 'easy', { isActive: false }),
      q('scratch-manual', 'easy'),
    ];
    assert.equal(readUsed(questions).easy.manual, 1);
  });
  test('untagged difficulty defaults to medium', () => {
    assert.equal(readUsed([q('scratch-manual', 'unknown')]).medium.manual, 1);
  });
});

group('readRemaining — shared Manual bucket across all three methods', () => {
  test('Manual quota 5 · 2 bank + 3 doc = 0 remaining', () => {
    const questions = [
      q('scratch-bank', 'easy'),
      q('scratch-bank', 'easy'),
      q('scratch-upload', 'easy'),
      q('scratch-upload', 'easy'),
      q('scratch-upload', 'easy'),
    ];
    const rem = readRemaining(SHARED_MANUAL_PLAN, questions);
    assert.ok(rem);
    assert.equal(rem!.easy.manual, 0, '5/5 filled by bank+doc combo');
  });
  test('Manual quota 5 · 1 scratch + 2 bank + 2 doc = 0 remaining', () => {
    const questions = [
      q('scratch-manual', 'easy'),
      q('scratch-bank', 'easy'),
      q('scratch-bank', 'easy'),
      q('scratch-upload', 'easy'),
      q('scratch-upload', 'easy'),
    ];
    assert.equal(readRemaining(SHARED_MANUAL_PLAN, questions)!.easy.manual, 0);
  });
  test('Manual quota 5 · 3 bank leaves 2 for any manual method', () => {
    const questions = [
      q('scratch-bank', 'easy'),
      q('scratch-bank', 'easy'),
      q('scratch-bank', 'easy'),
    ];
    assert.equal(readRemaining(SHARED_MANUAL_PLAN, questions)!.easy.manual, 2);
  });
  test('over-count clamps at 0 (never negative)', () => {
    // Six questions against a quota of 5 — server would reject the 6th, but
    // the derivation should still say 0, not -1.
    const questions = Array.from({ length: 6 }, () => q('scratch-bank', 'easy'));
    assert.equal(readRemaining(SHARED_MANUAL_PLAN, questions)!.easy.manual, 0);
  });
});

group('readRemainingTotals — whole-exercise remaining per bucket', () => {
  test('five-question plan · nothing saved → each bucket has its full total', () => {
    const totals = readRemainingTotals(FIVE_QUESTION_PLAN, []);
    assert.deepEqual(totals, { ai: 2, manual: 2, otherPlatform: 1 });
  });
  test('after 2 AI saves (one each level) → AI totals collapse', () => {
    const questions = [q('ai', 'easy'), q('ai', 'medium')];
    const totals = readRemainingTotals(FIVE_QUESTION_PLAN, questions);
    assert.deepEqual(totals, { ai: 0, manual: 2, otherPlatform: 1 });
  });
});

group('getNextPendingQuestion — progression engine', () => {
  test('empty exercise · start with AI → routes to first pending AI slot', () => {
    const next = getNextPendingQuestion({
      currentDifficulty: null,
      currentBucket: 'ai',
      customDistribution: FIVE_QUESTION_PLAN,
      questions: [],
    });
    assert.deepEqual(next, { difficulty: 'easy', bucket: 'ai' });
  });

  test('after Easy AI saved → next is Medium AI (same bucket, next difficulty)', () => {
    const next = getNextPendingQuestion({
      currentDifficulty: 'easy',
      currentBucket: 'ai',
      customDistribution: FIVE_QUESTION_PLAN,
      questions: [q('ai', 'easy')],
    });
    assert.deepEqual(next, { difficulty: 'medium', bucket: 'ai' });
  });

  test('after both AI saved → moves to Manual (next bucket, earliest difficulty)', () => {
    const next = getNextPendingQuestion({
      currentDifficulty: 'medium',
      currentBucket: 'ai',
      customDistribution: FIVE_QUESTION_PLAN,
      questions: [q('ai', 'easy'), q('ai', 'medium')],
    });
    assert.deepEqual(next, { difficulty: 'easy', bucket: 'manual' });
  });

  test('spec walk-through — 2 AI → 2 Manual → 1 OP → complete', () => {
    // Simulate the full five-question saga in the order the spec describes.
    const saved: any[] = [];
    const step = (currentDifficulty: any, currentBucket: any) => getNextPendingQuestion({
      currentDifficulty, currentBucket,
      customDistribution: FIVE_QUESTION_PLAN,
      questions: saved,
    });
    let cur = step(null, 'ai');
    assert.deepEqual(cur, { difficulty: 'easy', bucket: 'ai' });
    saved.push(q('ai', 'easy'));
    cur = step('easy', 'ai');
    assert.deepEqual(cur, { difficulty: 'medium', bucket: 'ai' });
    saved.push(q('ai', 'medium'));
    cur = step('medium', 'ai');
    assert.deepEqual(cur, { difficulty: 'easy', bucket: 'manual' });
    saved.push(q('scratch-manual', 'easy'));
    cur = step('easy', 'manual');
    assert.deepEqual(cur, { difficulty: 'hard', bucket: 'manual' });
    saved.push(q('scratch-bank', 'hard'));
    cur = step('hard', 'manual');
    assert.deepEqual(cur, { difficulty: 'medium', bucket: 'otherPlatform' });
    saved.push(q('thirdParty', 'medium'));
    cur = step('medium', 'otherPlatform');
    assert.equal(cur, null, 'plan complete after fifth save');
  });

  test('Easy has 5 slots total but only 2 AI · after 2 Easy AI → routes to Medium AI, not third Easy AI', () => {
    // Plan: Easy 2 AI + 3 Manual; Medium 2 AI; Hard 0
    const plan = {
      easy:   { scratch: 3, ai: 2, thirdParty: 0 },
      medium: { scratch: 0, ai: 2, thirdParty: 0 },
      hard:   { scratch: 0, ai: 0, thirdParty: 0 },
    };
    const questions = [q('ai', 'easy'), q('ai', 'easy')];
    const next = getNextPendingQuestion({
      currentDifficulty: 'easy',
      currentBucket: 'ai',
      customDistribution: plan,
      questions,
    });
    assert.deepEqual(next, { difficulty: 'medium', bucket: 'ai' });
  });

  test('AI can advance to Medium while other Easy allocations remain', () => {
    // Explicitly tests the spec's "Do not block AI because other Easy
    // allocations remain incomplete" rule.
    const plan = {
      easy:   { scratch: 3, ai: 1, thirdParty: 0 }, // Easy Manual has 3 open
      medium: { scratch: 0, ai: 1, thirdParty: 0 },
      hard:   { scratch: 0, ai: 0, thirdParty: 0 },
    };
    const next = getNextPendingQuestion({
      currentDifficulty: 'easy',
      currentBucket: 'ai',
      customDistribution: plan,
      questions: [q('ai', 'easy')], // Easy AI now full
    });
    assert.deepEqual(next, { difficulty: 'medium', bucket: 'ai' });
  });

  test('completed plan → null (caller shows completion screen)', () => {
    const plan = { easy: { scratch: 1, ai: 0, thirdParty: 0 }, medium: {}, hard: {} } as any;
    const next = getNextPendingQuestion({
      currentDifficulty: 'easy',
      currentBucket: 'manual',
      customDistribution: plan,
      questions: [q('scratch-manual', 'easy')],
    });
    assert.equal(next, null);
  });

  test('null customDistribution → null (general-mode exercise, no per-diff plan)', () => {
    const next = getNextPendingQuestion({
      currentDifficulty: null,
      currentBucket: null,
      customDistribution: null,
      questions: [],
    });
    assert.equal(next, null);
  });
});

group('getManualImportCapacity — bank/doc picker caps', () => {
  test('difficulty specified → per-diff Manual remaining', () => {
    assert.equal(
      getManualImportCapacity(SHARED_MANUAL_PLAN, [q('scratch-bank', 'easy')], 'easy'),
      4,
    );
  });
  test('no difficulty → whole-exercise Manual pool', () => {
    const plan = {
      easy:   { scratch: 2, ai: 0, thirdParty: 0 },
      medium: { scratch: 1, ai: 0, thirdParty: 0 },
      hard:   { scratch: 0, ai: 0, thirdParty: 0 },
    };
    assert.equal(getManualImportCapacity(plan, [], null), 3);
  });
  test('no plan → Infinity (unconfigured exercise passes)', () => {
    assert.equal(getManualImportCapacity(null, [], null), Infinity);
  });
});

group('describeBucketStatus — copy strings for the allocation strip', () => {
  test('not allocated', () => {
    const st = describeBucketStatus(FIVE_QUESTION_PLAN, [], 'easy', 'otherPlatform');
    assert.equal(st.configured, 0);
    assert.match(st.label, /not allocated/i);
  });
  test('partial · N remaining', () => {
    const st = describeBucketStatus(FIVE_QUESTION_PLAN, [q('ai', 'easy')], 'medium', 'ai');
    assert.equal(st.configured, 1);
    assert.equal(st.used, 0);
    assert.equal(st.remaining, 1);
    assert.match(st.label, /1 remaining/i);
  });
  test('completed', () => {
    const st = describeBucketStatus(FIVE_QUESTION_PLAN, [q('ai', 'medium')], 'medium', 'ai');
    assert.equal(st.remaining, 0);
    assert.match(st.label, /completed/i);
  });
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n\x1b[31mFAILURES:\x1b[0m');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
