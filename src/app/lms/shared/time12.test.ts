// time12.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Run with:
//
//   npx tsx client/src/app/lms/shared/time12.test.ts
//
// Same node:assert/strict + tiny-runner pattern as quotaModel.test.ts and
// assignmentState.test.ts.

import assert from 'node:assert/strict';
import {
  to12,
  from12,
  formatDateTime12,
  formatTime12,
  isValidHour12,
  isValidMinute,
} from './time12';

let passed = 0, failed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  \x1b[32m✔\x1b[0m ${name}`); }
  catch (e: any) {
    failed++;
    const line = String(e?.message || e).split('\n')[0];
    failures.push(`${name}\n    ${line}`);
    console.log(`  \x1b[31m✘\x1b[0m ${name}\n      ${line}`);
  }
}
function group(label: string, fn: () => void) {
  console.log(`\n\x1b[1m${label}\x1b[0m`); fn();
}

group('to12 — 24h → {1..12, AM|PM}', () => {
  test('00:xx → 12 AM (midnight rolls to 12, not 0)',   () => assert.deepEqual(to12(0),  { h12: 12, period: 'AM' }));
  test('06:xx → 6 AM',                                  () => assert.deepEqual(to12(6),  { h12: 6,  period: 'AM' }));
  test('11:xx → 11 AM',                                 () => assert.deepEqual(to12(11), { h12: 11, period: 'AM' }));
  test('12:xx → 12 PM (noon)',                          () => assert.deepEqual(to12(12), { h12: 12, period: 'PM' }));
  test('13:xx → 1 PM',                                  () => assert.deepEqual(to12(13), { h12: 1,  period: 'PM' }));
  test('18:xx → 6 PM (spec\'s target row)',             () => assert.deepEqual(to12(18), { h12: 6,  period: 'PM' }));
  test('23:xx → 11 PM',                                 () => assert.deepEqual(to12(23), { h12: 11, period: 'PM' }));
});

group('from12 — {1..12, AM|PM} → 24h', () => {
  test('12 AM → 0',                                     () => assert.equal(from12({ h12: 12, period: 'AM' }), 0));
  test('6 AM  → 6',                                     () => assert.equal(from12({ h12: 6,  period: 'AM' }), 6));
  test('12 PM → 12 (noon)',                             () => assert.equal(from12({ h12: 12, period: 'PM' }), 12));
  test('6 PM  → 18',                                    () => assert.equal(from12({ h12: 6,  period: 'PM' }), 18));
  test('clamps h12=0 → treated as 1 (AM → 1)',          () => assert.equal(from12({ h12: 0,  period: 'AM' }), 1));
  test('clamps h12=13 → treated as 12 (PM → 12)',       () => assert.equal(from12({ h12: 13, period: 'PM' }), 12));
});

group('to12 + from12 are inverses over 0..23', () => {
  test('round-trip preserves every 24h value', () => {
    for (let h = 0; h < 24; h++) {
      const back = from12(to12(h));
      assert.equal(back, h, `hour ${h} → ${JSON.stringify(to12(h))} → ${back}`);
    }
  });
});

group('formatTime12 — no leading zero on hour', () => {
  test('06:09 renders as "6:09 AM" (not "06:09 AM")',   () => assert.equal(formatTime12(6, 9),   '6:09 AM'));
  test('18:00 renders as "6:00 PM"',                    () => assert.equal(formatTime12(18, 0),  '6:00 PM'));
  test('00:05 renders as "12:05 AM"',                   () => assert.equal(formatTime12(0, 5),   '12:05 AM'));
  test('12:30 renders as "12:30 PM"',                   () => assert.equal(formatTime12(12, 30), '12:30 PM'));
  test('minute IS zero-padded',                         () => assert.equal(formatTime12(9, 3),   '9:03 AM'));
});

group('formatDateTime12 — target format', () => {
  test('DV → "Sep 3, 2026, 6:09 PM"', () => {
    const dv = { year: 2026, month: 9, day: 3, hour: 18, minute: 9 };
    // Use a normalised comparison because we insert non-breaking spaces
    // to keep the string from breaking across two lines in the pill.
    const s = formatDateTime12(dv).replace(/ /g, ' ');
    assert.equal(s, 'Sep 3, 2026, 6:09 PM');
  });
  test('Date input works too', () => {
    const s = formatDateTime12(new Date(2026, 7, 21, 18, 0)).replace(/ /g, ' ');
    assert.equal(s, 'Aug 21, 2026, 6:00 PM');
  });
  test('empty DV → ""', () => {
    assert.equal(formatDateTime12({ year: 0, month: 0, day: 0, hour: 0, minute: 0 }), '');
  });
  test('null → ""', () => assert.equal(formatDateTime12(null), ''));
  test('NaN Date → ""', () => assert.equal(formatDateTime12(new Date('nope')), ''));
});

group('validators', () => {
  test('isValidHour12: 1..12 ok, 0 / 13 / 18 / 23 not', () => {
    for (let n = 1; n <= 12; n++) assert.equal(isValidHour12(n), true, `${n}`);
    assert.equal(isValidHour12(0), false);
    assert.equal(isValidHour12(13), false);
    assert.equal(isValidHour12(18), false, '18 (24h) must not pass the 12h validator');
    assert.equal(isValidHour12(23), false);
  });
  test('isValidMinute: 0..59 ok, -1 / 60 not', () => {
    assert.equal(isValidMinute(0),  true);
    assert.equal(isValidMinute(59), true);
    assert.equal(isValidMinute(-1), false);
    assert.equal(isValidMinute(60), false);
  });
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\n\x1b[31mFAILURES:\x1b[0m');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
