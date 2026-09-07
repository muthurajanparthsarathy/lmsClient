// schedulePicker.test.ts
// ─────────────────────────────────────────────────────────────────────────────
// Run with:
//
//   npx tsx src/app/lms/shared/schedulePicker.test.ts
//
// Same node:assert/strict + tiny-runner pattern as time12.test.ts,
// quotaModel.test.ts and assignmentState.test.ts.
//
// Covers the two bugs this module exists to prevent:
//   1. the AM/PM segmented control spilling out of the picker dialog, and
//   2. the dialog itself hanging off a viewport edge,
// plus the Availability-row interactions (open a picker, flip AM/PM, confirm
// a value, apply each quick-duration chip).

import assert from 'node:assert/strict';
import {
  measurePicker, clampPickerPosition,
  nextOpenField, setPeriodOnDV, setHour12OnDV, applyOffset, pickerRangeError,
  dateToDV, dvToDate,
  PICKER_W, PICKER_MIN_W, PICKER_GUTTER, PICKER_STACK_BELOW,
  TIME_PANE_W, TIME_PANE_CONTENT_W, TIME_PANE_PAD_L, TIME_PANE_PAD_R,
  PERIOD_COL_W, CAL_PANE_MIN_W, PANE_DIVIDER_W,
  type DV,
} from './schedulePicker';
import { formatDateTime12 } from './time12';

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

// Representative widths: wide desktop, the viewport the reference screenshots
// were taken at, laptop, tablet portrait/landscape, and phones.
const VIEWPORTS = [
  { name: 'wide desktop 1920', w: 1920 },
  { name: 'desktop 1440',      w: 1440 },
  { name: 'reference 1366',    w: 1366 },
  { name: 'laptop 1280',       w: 1280 },
  { name: 'tablet 1024',       w: 1024 },
  { name: 'tablet 768',        w: 768 },
  { name: 'phone 430',         w: 430 },
  { name: 'phone 390',         w: 390 },
  { name: 'phone 360',         w: 360 },
  { name: 'phone 320',         w: 320 },
];

group('TIME pane fits its own controls (the AM/PM clipping bug)', () => {
  test('pane width covers content + both paddings', () => {
    assert.equal(TIME_PANE_W, TIME_PANE_CONTENT_W + TIME_PANE_PAD_L + TIME_PANE_PAD_R);
  });
  test('the old 168px pane was too narrow for this content', () => {
    assert.ok(TIME_PANE_CONTENT_W > 168 - TIME_PANE_PAD_L - TIME_PANE_PAD_R,
      'regression fixture: the pre-fix pane could not hold its content');
  });
  test('AM/PM column has room for two >=44px touch targets', () => {
    assert.ok(PERIOD_COL_W >= 44 * 2, `PERIOD_COL_W=${PERIOD_COL_W}`);
  });
  test('right padding clears the PM segment corner', () => {
    assert.ok(TIME_PANE_PAD_R >= TIME_PANE_PAD_L, 'right padding is not tighter than left');
  });
  test('both panes fit inside the desktop dialog', () => {
    assert.ok(TIME_PANE_W + PANE_DIVIDER_W + CAL_PANE_MIN_W <= PICKER_W,
      `${TIME_PANE_W}+${PANE_DIVIDER_W}+${CAL_PANE_MIN_W} > ${PICKER_W}`);
  });
});

group('measurePicker — dialog stays inside every viewport', () => {
  for (const { name, w } of VIEWPORTS) {
    test(`${name}: dialog never wider than the viewport`, () => {
      const l = measurePicker(w);
      assert.ok(l.width <= w, `width ${l.width} > viewport ${w}`);
    });
    test(`${name}: TIME pane never narrower than its controls`, () => {
      const l = measurePicker(w);
      assert.ok(l.timePaneWidth >= TIME_PANE_W,
        `timePaneWidth ${l.timePaneWidth} < ${TIME_PANE_W}`);
    });
    test(`${name}: calendar pane keeps its 7 columns`, () => {
      const l = measurePicker(w);
      assert.ok(l.calendarPaneWidth >= CAL_PANE_MIN_W,
        `calendarPaneWidth ${l.calendarPaneWidth} < ${CAL_PANE_MIN_W}`);
    });
    test(`${name}: side-by-side panes sum to the dialog width`, () => {
      const l = measurePicker(w);
      if (l.stacked) return;
      assert.equal(l.calendarPaneWidth + PANE_DIVIDER_W + l.timePaneWidth, l.width);
    });
  }
  test('desktop keeps the panes side by side', () => {
    assert.equal(measurePicker(1366).stacked, false);
    assert.equal(measurePicker(1366).width, PICKER_W);
  });
  test('narrow viewports stack the TIME pane under the calendar', () => {
    assert.equal(measurePicker(PICKER_STACK_BELOW - 1).stacked, true);
    assert.equal(measurePicker(390).stacked, true);
  });
  test('phone dialog leaves a gutter on both sides', () => {
    const l = measurePicker(390);
    assert.equal(l.width, 390 - PICKER_GUTTER * 2);
  });
  test('never shrinks below the AM/PM control', () => {
    assert.equal(measurePicker(120).width, PICKER_MIN_W);
  });
});

group('clampPickerPosition — no edge leaves the viewport', () => {
  const anchor = (left: number, top: number) =>
    ({ left, top, right: left + 30, bottom: top + 30 });

  test('opens to the right of the anchor when there is room', () => {
    const { left } = clampPickerPosition({
      anchor: anchor(200, 300), popWidth: PICKER_W, popHeight: 380,
      viewportWidth: 1440, viewportHeight: 900,
    });
    assert.equal(left, 238); // 200 + 30 + 8
  });
  test('flips to the left of the anchor near the right edge', () => {
    const { left } = clampPickerPosition({
      anchor: anchor(1300, 300), popWidth: PICKER_W, popHeight: 380,
      viewportWidth: 1440, viewportHeight: 900,
    });
    assert.equal(left, 1300 - PICKER_W - 8);
  });
  test('a flip that would go off the LEFT edge still fits on screen', () => {
    // Pre-fix this clamped to 8 and let the right edge bleed off screen.
    const vw = 700;
    const { left } = clampPickerPosition({
      anchor: anchor(320, 100), popWidth: PICKER_W, popHeight: 380,
      viewportWidth: vw, viewportHeight: 900,
    });
    assert.ok(left >= PICKER_GUTTER, `left ${left}`);
    assert.ok(left + PICKER_W <= vw - PICKER_GUTTER,
      `right edge ${left + PICKER_W} > ${vw - PICKER_GUTTER}`);
  });
  test('clamps vertically so the footer stays on screen', () => {
    const { top } = clampPickerPosition({
      anchor: anchor(100, 860), popWidth: PICKER_W, popHeight: 420,
      viewportWidth: 1440, viewportHeight: 900,
    });
    assert.equal(top, 900 - 420 - PICKER_GUTTER);
  });
  test('every viewport keeps the whole dialog visible', () => {
    for (const { name, w } of VIEWPORTS) {
      const l = measurePicker(w);
      for (const ax of [0, Math.round(w / 2), Math.max(0, w - 40)]) {
        const { left, top } = clampPickerPosition({
          anchor: anchor(ax, 500), popWidth: l.width, popHeight: 420,
          viewportWidth: w, viewportHeight: 800,
        });
        assert.ok(left >= 0, `${name} @${ax}: left ${left}`);
        assert.ok(left + l.width <= w, `${name} @${ax}: right ${left + l.width} > ${w}`);
        assert.ok(top >= 0 && top + 420 <= 800, `${name} @${ax}: top ${top}`);
      }
    }
  });
});

group('opening a picker — one dialog, and only the named field', () => {
  test('clicking Start opens the Start picker', () => {
    assert.equal(nextOpenField(null, 'startDate'), 'startDate');
  });
  test('clicking End while Start is open moves to End', () => {
    assert.equal(nextOpenField('startDate', 'endDate'), 'endDate');
  });
  test('clicking the open row toggles it shut', () => {
    assert.equal(nextOpenField('endDate', 'endDate'), null);
  });
  test('Confirm only ever writes the field its header names', () => {
    // The row render hands onConfirm its own fieldKey, so a confirm from the
    // End dialog can only reach `endDate`. Model that contract here.
    const schedule: Record<string, DV> = {
      startDate: { day: 3, month: 9, year: 2026, hour: 9, minute: 0 },
      endDate: { day: 4, month: 9, year: 2026, hour: 17, minute: 0 },
    };
    const openField = 'endDate';
    const confirmed: DV = { day: 5, month: 9, year: 2026, hour: 18, minute: 30 };
    const next: Record<string, DV> = { ...schedule, [openField]: confirmed };
    assert.deepEqual(next.endDate, confirmed);
    assert.deepEqual(next.startDate, schedule.startDate, 'Start must not move');
  });
});

group('AM/PM selection', () => {
  const base: DV = { day: 3, month: 9, year: 2026, hour: 9, minute: 7 };

  test('AM to PM shifts the stored 24h hour by 12', () => {
    assert.equal(setPeriodOnDV(base, 'PM').hour, 21);
  });
  test('PM to AM shifts it back', () => {
    assert.equal(setPeriodOnDV({ ...base, hour: 21 }, 'AM').hour, 9);
  });
  test('re-picking the current period is a no-op', () => {
    assert.deepEqual(setPeriodOnDV(base, 'AM'), base);
  });
  test('flipping period leaves the date and minute alone', () => {
    const out = setPeriodOnDV(base, 'PM');
    assert.equal(out.day, 3); assert.equal(out.month, 9);
    assert.equal(out.year, 2026); assert.equal(out.minute, 7);
  });
  test('midnight is 12 AM, not 0 AM', () => {
    assert.equal(setPeriodOnDV({ ...base, hour: 12 }, 'AM').hour, 0);
  });
  test('noon is 12 PM', () => {
    assert.equal(setPeriodOnDV({ ...base, hour: 0 }, 'PM').hour, 12);
  });
  test('typing an hour keeps the selected period', () => {
    assert.equal(setHour12OnDV({ ...base, hour: 21 }, 3).hour, 15);
    assert.equal(setHour12OnDV({ ...base, hour: 9 }, 3).hour, 3);
  });
});

group('Confirm — range guard', () => {
  const fmt = (d: Date) => formatDateTime12(d);
  const start = new Date(2026, 8, 3, 18, 0);

  test('a later value confirms', () => {
    assert.equal(pickerRangeError({ day: 3, month: 9, year: 2026, hour: 19, minute: 0 }, start, fmt), null);
  });
  test('a same-day EARLIER time is rejected, not silently accepted', () => {
    const err = pickerRangeError({ day: 3, month: 9, year: 2026, hour: 17, minute: 0 }, start, fmt);
    assert.ok(err && err.startsWith('Must be on or after'), String(err));
  });
  test('the exact minimum is allowed', () => {
    assert.equal(pickerRangeError({ day: 3, month: 9, year: 2026, hour: 18, minute: 0 }, start, fmt), null);
  });
  test('no minDate means nothing to enforce', () => {
    assert.equal(pickerRangeError({ day: 1, month: 1, year: 2020, hour: 0, minute: 0 }, null, fmt), null);
  });
  test('an incomplete date never produces an error string', () => {
    assert.equal(pickerRangeError({ day: 0, month: 0, year: 0, hour: 0, minute: 0 }, start, fmt), null);
  });
});

group('quick-duration chips', () => {
  const start = new Date(2026, 8, 3, 18, 0); // Sep 3 2026, 6:00 PM
  const CHIPS = [
    { label: '+30m', ms: 30 * 60 * 1000, expect: '2026-09-03 18:30' },
    { label: '+1h', ms: 60 * 60 * 1000, expect: '2026-09-03 19:00' },
    { label: '+2h', ms: 2 * 60 * 60 * 1000, expect: '2026-09-03 20:00' },
    { label: '+1d', ms: 24 * 60 * 60 * 1000, expect: '2026-09-04 18:00' },
    { label: '+1w', ms: 7 * 24 * 60 * 60 * 1000, expect: '2026-09-10 18:00' },
  ];
  const stamp = (v: DV) =>
    `${v.year}-${String(v.month).padStart(2, '0')}-${String(v.day).padStart(2, '0')} ` +
    `${String(v.hour).padStart(2, '0')}:${String(v.minute).padStart(2, '0')}`;

  for (const c of CHIPS) {
    test(`${c.label} offsets from the previous row`, () => {
      assert.equal(stamp(applyOffset(start, c.ms)), c.expect);
    });
    test(`${c.label} lands after the base, so Confirm's guard passes`, () => {
      assert.equal(pickerRangeError(applyOffset(start, c.ms), start, formatDateTime12), null);
    });
  }
  test('+30m crossing midnight rolls the date', () => {
    assert.equal(stamp(applyOffset(new Date(2026, 8, 3, 23, 50), 30 * 60 * 1000)), '2026-09-04 00:20');
  });
  test('+1d crossing a month boundary rolls the month', () => {
    assert.equal(stamp(applyOffset(new Date(2026, 8, 30, 9, 0), 24 * 60 * 60 * 1000)), '2026-10-01 09:00');
  });
  test('DV and Date round-trip', () => {
    const d = new Date(2026, 8, 3, 18, 9);
    assert.equal(dvToDate(dateToDV(d))!.getTime(), d.getTime());
  });
});

console.log(`\n${failed === 0 ? '\x1b[32m' : '\x1b[31m'}${passed} passed, ${failed} failed\x1b[0m`);
if (failed) {
  console.log('\nFailures:');
  failures.forEach(f => console.log(`  • ${f}`));
  process.exit(1);
}
