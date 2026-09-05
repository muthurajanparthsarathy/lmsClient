// time12.ts
// ─────────────────────────────────────────────────────────────────────────────
// Pure 12-hour time helpers used by the ScheduleStep pickers (Exercise
// Settings + CreateAssessment) and the student assessment list. Kept
// theme-agnostic so both the orange and green ScheduleSteps can import
// the same rules — the two files were near-duplicates and were drifting.
//
// Design notes:
//   • Internal storage stays 24-hour (0–23) so downstream Date math and
//     `.toISOString()` continue to serialize as UTC without change — the
//     UTC-on-save / local-on-display contract falls out for free from
//     JS's own Date semantics. The picker UI presents 12-hour + period
//     via `to12` / `from12` at the input boundary only.
//   • `formatDateTime12` renders "Sep 3, 2026, 6:09 PM" — no leading
//     zero on the hour, per the spec's target image.
//   • `isValidHour12` / `isValidMinute` are the exact input-clamps the
//     SegInputs use, so tests can pin them once instead of per-caller.

'use client';

export type Period = 'AM' | 'PM';

export interface Time12 {
  /** 1..12 */
  h12: number;
  period: Period;
}

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** 24-hour value → {1..12, AM|PM}. Wraps midnight to 12 AM and noon to 12 PM. */
export function to12(hour24: number): Time12 {
  const h = Number.isFinite(hour24) ? Math.floor(hour24) : 0;
  const period: Period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { h12, period };
}

/** {1..12, AM|PM} → 24-hour (0..23). Clamps out-of-range h12 into 1..12. */
export function from12(t: Time12): number {
  const raw = Number.isFinite(t.h12) ? Math.floor(t.h12) : 12;
  const h12 = Math.min(12, Math.max(1, raw));
  if (t.period === 'AM') return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
}

export function isValidHour12(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 12;
}

export function isValidMinute(n: number): boolean {
  return Number.isInteger(n) && n >= 0 && n <= 59;
}

/** "6:09 PM" — always two-digit minute, never leading-zero hour. */
export function formatTime12(hour24: number, minute: number): string {
  const { h12, period } = to12(hour24);
  const mm = String(Math.max(0, Math.min(59, minute))).padStart(2, '0');
  return `${h12}:${mm} ${period}`;
}

/**
 * "Sep 3, 2026, 6:09 PM" — matches the target-image preview banner.
 * Accepts a Date OR a raw DV-like `{year, month(1-12), day, hour(0-23), minute}`.
 * Returns '' when the input is null / incomplete so callers can render an
 * empty banner without extra guards.
 */
export function formatDateTime12(
  input:
    | Date
    | null
    | undefined
    | { year: number; month: number; day: number; hour: number; minute: number },
): string {
  if (input == null) return '';
  let y: number, mo: number, d: number, hr: number, mi: number;
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return '';
    y = input.getFullYear();
    mo = input.getMonth() + 1;
    d = input.getDate();
    hr = input.getHours();
    mi = input.getMinutes();
  } else {
    y = input.year; mo = input.month; d = input.day; hr = input.hour; mi = input.minute;
    if (!(d > 0 && mo > 0 && y > 0)) return '';
  }
  return `${MONTHS_SHORT[mo - 1]} ${d}, ${y}, ${formatTime12(hr, mi)}`;
}

/** "Sep 3, 2026" — the date half only, for compact table cells. */
export function formatDateShort(input: Date | null | undefined): string {
  if (!input || Number.isNaN(input.getTime())) return '';
  return `${MONTHS_SHORT[input.getMonth()]} ${input.getDate()}, ${input.getFullYear()}`;
}
