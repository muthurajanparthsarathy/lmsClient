// schedulePicker.ts
// ─────────────────────────────────────────────────────────────────────────────
// Geometry + pure interaction helpers for the Schedule step's date/time
// picker dialog. Shared by the orange ScheduleStep (Exercise Settings) and
// the green one (Create Assessment) — the two files are near-duplicates and
// were drifting, exactly like `time12.ts` was extracted to stop the 12-hour
// rules drifting.
//
// Why the numbers live here instead of inline in the JSX:
//   • The dialog used to be a hard-coded `w-[440px]` with a hard-coded
//     168px TIME pane. The TIME pane's own content (HOUR + MINUTE + the
//     AM/PM segmented control) needs ~204px, so the PERIOD selector spilled
//     past the pane and the dialog's `overflow-hidden` sheared the right
//     edge (and the rounded corner) off the selected PM segment.
//   • Keeping every contributing width as a named constant lets
//     `schedulePicker.test.ts` assert the invariant that caused the bug
//     — "the TIME pane is wide enough for its own controls, and both panes
//     fit inside the dialog" — instead of eyeballing a screenshot.
//
// Run the tests with:
//
//   npx tsx src/app/lms/shared/schedulePicker.test.ts

'use client';

import { from12, to12, type Period } from './time12';

// ── Dialog geometry ─────────────────────────────────────────────────────────

/** Minimum breathing room between the dialog and each viewport edge. */
export const PICKER_GUTTER = 12;

/** Gap between the anchor button and the dialog. */
export const PICKER_ANCHOR_GAP = 8;

// Calendar pane — 7 day columns of 28px plus the pane's own padding.
export const CAL_CELL = 28;
export const CAL_COLS = 7;
export const CAL_PANE_PAD_X = 12;
export const CAL_PANE_MIN_W = CAL_COLS * CAL_CELL + CAL_PANE_PAD_X * 2; // 220

// TIME pane — three explicit columns (HOUR, MINUTE, PERIOD) separated by a
// colon. Every column gets a fixed width so the pane's content width is a
// constant instead of a font-measurement guess.
export const TIME_COL_GAP = 8;
export const HOUR_COL_W = 34;
export const COLON_W = 8;
export const MINUTE_COL_W = 46;
/** AM/PM segmented control — two 45px segments + 1px border each side. */
export const PERIOD_COL_W = 92;
export const TIME_PANE_PAD_L = 12;
/** Extra right padding so the PM segment's rounded corner clears the edge. */
export const TIME_PANE_PAD_R = 14;

export const TIME_PANE_CONTENT_W =
  HOUR_COL_W + TIME_COL_GAP +
  COLON_W + TIME_COL_GAP +
  MINUTE_COL_W + TIME_COL_GAP +
  PERIOD_COL_W; // 204

export const TIME_PANE_W =
  TIME_PANE_CONTENT_W + TIME_PANE_PAD_L + TIME_PANE_PAD_R; // 230

/** Hairline between the calendar and TIME panes when they sit side by side. */
export const PANE_DIVIDER_W = 1;

/** Desktop dialog width — both panes plus slack for the calendar. */
export const PICKER_W = 468;

/**
 * Never shrink the dialog below the TIME pane's own content, otherwise we are
 * back to clipping the AM/PM control. Under ~254px of viewport the dialog
 * pokes into the gutter instead — a far better failure mode than shearing a
 * control in half.
 */
export const PICKER_MIN_W = TIME_PANE_W;

/** Below this viewport width the panes stack instead of squeezing. */
export const PICKER_STACK_BELOW = PICKER_W + PICKER_GUTTER * 2; // 492

export interface PickerLayout {
  /** Rendered dialog width in px. */
  width: number;
  /** true → TIME pane sits under the calendar instead of beside it. */
  stacked: boolean;
  /** Width for the TIME pane; stacked panes span the dialog. */
  timePaneWidth: number;
  /** Width left for the calendar pane (border box). */
  calendarPaneWidth: number;
}

/** Resolve the dialog's box for a given viewport width. */
export function measurePicker(viewportWidth: number): PickerLayout {
  const available = viewportWidth - PICKER_GUTTER * 2;
  const width = Math.max(PICKER_MIN_W, Math.min(PICKER_W, available));
  const stacked = viewportWidth < PICKER_STACK_BELOW;
  return {
    width,
    stacked,
    timePaneWidth: stacked ? width : TIME_PANE_W,
    calendarPaneWidth: stacked ? width : width - TIME_PANE_W - PANE_DIVIDER_W,
  };
}

export interface AnchorRect { top: number; left: number; right: number; bottom: number }

/**
 * Place the dialog beside its anchor, then clamp so no edge — rounded corner
 * included — leaves the viewport. The old version clamped `left` upward only,
 * so a dialog wider than the space to its left still bled off the right side.
 */
export function clampPickerPosition(input: {
  anchor: AnchorRect;
  popWidth: number;
  popHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gutter?: number;
}): { top: number; left: number } {
  const {
    anchor: a, popWidth: w, popHeight: h,
    viewportWidth: vw, viewportHeight: vh,
  } = input;
  const g = input.gutter ?? PICKER_GUTTER;

  let left = a.right + PICKER_ANCHOR_GAP;
  if (left + w > vw - g) left = a.left - w - PICKER_ANCHOR_GAP;
  const maxLeft = Math.max(g, vw - w - g);
  left = Math.min(Math.max(g, left), maxLeft);

  const maxTop = Math.max(g, vh - h - g);
  const top = Math.min(Math.max(g, a.top), maxTop);

  return { top, left };
}

// ── Pure interaction helpers ────────────────────────────────────────────────
// The Availability rows drive these; keeping them out of the JSX means the
// behaviours the UI promises (open the right picker, flip AM/PM without
// disturbing the date, confirm only when in range, offset from the previous
// row) are assertable without a DOM.

export type DV = {
  day: number; month: number; year: number; hour: number; minute: number;
};

export const EMPTY_DV: DV = { day: 0, month: 0, year: 0, hour: 0, minute: 0 };

export const hasDate = (v: DV) => v.day > 0 && v.month > 0 && v.year > 0;

export const dvToDate = (v: DV): Date | null =>
  hasDate(v) ? new Date(v.year, v.month - 1, v.day, v.hour, v.minute) : null;

export const dateToDV = (d: Date): DV => ({
  day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(),
  hour: d.getHours(), minute: d.getMinutes(),
});

/**
 * Clicking a row's calendar button toggles that row's picker and closes any
 * other one — only ever a single open dialog, and Confirm can only ever
 * reach the field named in its header.
 */
export const nextOpenField = (current: string | null, key: string): string | null =>
  current === key ? null : key;

/** Flip AM/PM on a stored 24-hour value; date and minute are untouched. */
export function setPeriodOnDV(v: DV, period: Period): DV {
  const { h12 } = to12(v.hour || 0);
  return { ...v, hour: from12({ h12: h12 || 12, period }) };
}

/** Set the 12-hour hour, keeping the value's current AM/PM. */
export function setHour12OnDV(v: DV, h12: number): DV {
  const { period } = to12(v.hour || 0);
  return { ...v, hour: from12({ h12, period }) };
}

/** Quick-duration chip: `base` + `ms`, projected back into a DV. */
export function applyOffset(base: Date, ms: number): DV {
  return dateToDV(new Date(base.getTime() + ms));
}

/**
 * Confirm guard. The calendar greys out earlier *days*, but a same-day time
 * can still land before `minDate` (Start 6 PM → End 5 PM), so Confirm
 * re-checks with the time included. Returns null when the value may be
 * committed, or the message to show inline.
 */
export function pickerRangeError(
  picked: DV,
  minDate: Date | null | undefined,
  format: (d: Date) => string,
): string | null {
  if (!hasDate(picked) || !minDate) return null;
  const d = dvToDate(picked)!;
  return d < minDate ? `Must be on or after ${format(minDate)}` : null;
}
