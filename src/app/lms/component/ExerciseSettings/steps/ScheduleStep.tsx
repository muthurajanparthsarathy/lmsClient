import { SettingsHelp } from '../SettingsHelp';
import { getToken } from "@/lib/session";
import { pageZoom } from "@/lib/pageZoom";
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Calendar, Clock,
  ChevronUp, ChevronDown, Check, AlertCircle,
} from 'lucide-react';
import { D as sharedColors, FONT } from '../../../pages/courses/uploadcourseresources/components/youdo/assessments/shared/tokens';
import { fetchApprovalHierarchy, type ApprovalStep } from '@/apiServices/userService';
import {
  to12, from12, formatDateTime12,
  type Period,
} from '@/app/lms/shared/time12';
// Picker geometry + the pure interaction helpers behind the Availability
// rows. Extracted so the widths that decide whether the AM/PM control fits
// inside the dialog are asserted by schedulePicker.test.ts rather than
// eyeballed — see that file's header for the bug this prevents.
import {
  measurePicker, clampPickerPosition,
  nextOpenField,
  pickerRangeError,
  EMPTY_DV, hasDate, dvToDate, dateToDV,
  CAL_CELL, CAL_PANE_PAD_X,
  TIME_COL_GAP, HOUR_COL_W, COLON_W, MINUTE_COL_W, PERIOD_COL_W,
  TIME_PANE_PAD_L, TIME_PANE_PAD_R,
  type DV,
} from '@/app/lms/shared/schedulePicker';

import styles from '../AssignmentSettings.module.css';

// Keep the reference palette local to this form and its calendar.
const D = { ...sharedColors, orange: '#EE6A22', orangeDark: '#D65A16', orangeLight: '#FDF0E9', orangeMed: '#FADFCE' };

// ── Props ────────────────────────────────────────────────────────────────────
// Loose types intentionally — the parent ExerciseSettings.tsx treats
// formData.schedule as `any` in most places, and we mirror that here so the
// extraction is purely structural (no behaviour change, no type tightening).
interface ScheduleStepProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  validationErrors: any;
  setValidationErrors: React.Dispatch<React.SetStateAction<any>>;
  touchedFields: Set<string>;
  isEditing: boolean;
  courseId?: string;
}

// ── Types / helpers ─────────────────────────────────────────────────────────
// DV, EMPTY_DV, hasDate, dvToDate and dateToDV now live in
// @/app/lms/shared/schedulePicker alongside the picker geometry they feed,
// so the green sibling ScheduleStep uses the identical definitions.
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// Preview banner format now comes from the shared 12-hour helper so the
// orange and green ScheduleSteps + the student assessment list all render
// the SAME string ("Sep 3, 2026, 6:09 PM" — no leading zero on hour).
const fmtDateTime = (v: DV) => formatDateTime12(hasDate(v) ? v : null);

const buildCalendarDays = (year: number, month: number) => {
  const dim = new Date(year, month, 0).getDate();
  const fd = new Date(year, month - 1, 1).getDay();
  const days: (number | null)[] = [];
  for (let i = 0; i < fd; i++) days.push(null);
  for (let i = 1; i <= dim; i++) days.push(i);
  return days;
};

// ── Shared control metrics ──────────────────────────────────────────────────
// Every interactive control in an Availability row and in the picker's TIME
// pane is CTRL_H tall with the same radius, so the Start row and the End row
// are literally the same measurements rather than two similar-looking ones.
const CTRL_H = 30;          // date + time inputs, AM/PM, calendar button
const CTRL_R = 6;           // border radius

// ── Spinner (up/down + value in orange circle) ──────────────────────────────
// `min` defaults to 0 so existing MINUTE call sites (0..59) still wrap
// cleanly through zero. Callers that need a 1-based range (HOUR12 = 1..12)
// pass min=1, which makes the wrap boundary min ↔ max instead of 0 ↔ max.
// `width` pins the column so the TIME pane's total width is the constant
// schedulePicker.ts advertises instead of a font-measurement guess.
const Spinner: React.FC<{
  value: number; max: number; min?: number; onChange: (v: number) => void;
  labelPad?: number; label: string; width: number;
}> = ({ value, max, min = 0, onChange, labelPad = 2, label, width }) => {
  const step = (d: 1 | -1) =>
    onChange(d === 1 ? (value >= max ? min : value + 1) : (value <= min ? max : value - 1));
  return (
    <div className="flex flex-col items-center gap-0.5" style={{ width, flexShrink: 0 }}>
      <button type="button" aria-label={`${label} up`} onClick={() => step(1)}
        className="sch-icon-btn w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
        <ChevronUp size={12} style={{ color: D.orange }} />
      </button>
      <div
        role="spinbutton"
        tabIndex={0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={String(value).padStart(labelPad, '0')}
        onKeyDown={e => {
          if (e.key === 'ArrowUp')   { e.preventDefault(); step(1); }
          if (e.key === 'ArrowDown') { e.preventDefault(); step(-1); }
        }}
        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
        style={{ background: D.orange, fontSize: 12, cursor: 'default' }}>
        {String(value).padStart(labelPad, '0')}
      </div>
      <button type="button" aria-label={`${label} down`} onClick={() => step(-1)}
        className="sch-icon-btn w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
        <ChevronDown size={12} style={{ color: D.orange }} />
      </button>
    </div>
  );
};

// ── PERIOD segmented AM/PM ──────────────────────────────────────────────────
// ONE component for both the Availability row and the picker's TIME pane, so
// height, radius, typography and the selected-state colour cannot drift
// between them. The segments are fixed-width halves of PERIOD_COL_W (45px
// each ≥ the 44px pointer-target floor) rather than text-sized: the old
// text-sized control was wider than the 168px TIME pane it lived in, which
// is what pushed the PM segment past the dialog's clipped right edge.
const PeriodSelector: React.FC<{
  value: Period;
  onChange: (p: Period) => void;
  /** Field this belongs to, so the group reads as "End Date & Time, AM or PM". */
  fieldLabel: string;
  /** Pill in the picker's TIME pane, squared-off in the compact row. */
  pill?: boolean;
}> = ({ value, onChange, fieldLabel, pill }) => (
  <div
    className="inline-flex select-none"
    role="group"
    aria-label={`${fieldLabel}, AM or PM`}
    style={{
      width: PERIOD_COL_W, height: CTRL_H, flexShrink: 0,
      border: '1px solid #D0D5DD', borderRadius: pill ? 999 : CTRL_R,
    }}
  >
    {(['AM', 'PM'] as const).map((p, i) => {
      const selected = value === p;
      const r = pill ? 999 : CTRL_R - 1;
      return (
        <button
          key={p}
          type="button"
          aria-pressed={selected}
          onClick={() => onChange(p)}
          className="sch-hit"
          style={{
            flex: '1 1 0', minWidth: 0, height: '100%', border: 'none',
            // Each segment owns its own outer corners instead of relying on
            // the wrapper's `overflow: hidden` — the filled PM segment keeps
            // its rounded right edge, and the 44px pointer overlay below is
            // free to extend past the wrapper.
            borderRadius: i === 0 ? `${r}px 0 0 ${r}px` : `0 ${r}px ${r}px 0`,
            background: selected ? D.orange : '#fff',
            color: selected ? '#fff' : D.textMuted,
            fontWeight: 700, fontSize: 11.5, letterSpacing: '.02em',
            cursor: 'pointer', fontFamily: FONT,
          }}
        >
          {p}
        </button>
      );
    })}
  </div>
);

// ── Calendar popup ──────────────────────────────────────────────────────────
const CalendarPopup: React.FC<{
  fieldLabel: string; value: DV; onConfirm: (v: DV) => void; onClose: () => void;
  minDate?: Date; anchorEl: HTMLElement | null;
}> = ({ fieldLabel, value, onConfirm, onClose, minDate, anchorEl }) => {
  const [calMonth, setCalMonth]   = useState(hasDate(value) ? value.month : new Date().getMonth() + 1);
  const [calYear, setCalYear]     = useState(hasDate(value) ? value.year  : new Date().getFullYear());
  const [selDay, setSelDay]       = useState(hasDate(value) ? value.day   : 0);
  const [selMonth, setSelMonth]   = useState(hasDate(value) ? value.month : 0);
  const [selYear, setSelYear]     = useState(hasDate(value) ? value.year  : 0);
  // Time is stored 24-hour internally (matches the DV contract downstream),
  // but the picker only ever shows the 12-hour derived view + AM/PM.
  const [hour, setHour]           = useState(value.hour);   // 0..23
  const [minute, setMinute]       = useState(value.minute); // 0..59
  const { h12, period }           = to12(hour);
  const setH12 = (n: number) => setHour(from12({ h12: n, period }));
  const setPeriod = (p: Period) => setHour(from12({ h12, period: p }));
  // Show inline validation when the picked datetime is earlier than the
  // parent's minDate (e.g. "End must be after Start"). Cleared any time
  // the user changes a component of the picked value.
  const [rangeError, setRangeError] = useState<string | null>(null);
  // Any change to the picked value clears the inline range message — day and
  // month/year included, which the old dep list promised but never did.
  useEffect(() => { setRangeError(null); }, [hour, minute, selDay, selMonth, selYear]);
  const popRef                    = useRef<HTMLDivElement>(null);
  const [pos, setPos]             = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, zIndex: 9999, visibility: 'hidden' });

  // The dialog's own box, derived from the viewport rather than hard-coded:
  // it never exceeds the viewport, never shrinks its TIME pane below the
  // AM/PM control, and stacks the two panes instead of clipping when narrow.
  const [layout, setLayout] = useState(() =>
    measurePicker(typeof window === 'undefined' ? 1440 : window.innerWidth));

  useEffect(() => {
    const onResize = () => setLayout(measurePicker(window.innerWidth));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Measure and place before the browser paints. This used to wait for a
  // requestAnimationFrame, which showed one unpositioned frame and — in a
  // throttled/background tab, where rAF may not fire at all — could leave the
  // dialog parked off-screen. useLayoutEffect can read the real box (the
  // popup is already in the DOM) and commit the position in the same frame.
  useLayoutEffect(() => {
    if (!anchorEl || !popRef.current) return;
    const r = anchorEl.getBoundingClientRect();
    // Measure the popup we actually rendered — including the TIME pane —
    // rather than assuming a fixed width, so the clamp below can't be
    // computed against a stale number.
    const pw = popRef.current.offsetWidth || layout.width;
    const ph = popRef.current.offsetHeight || 360;
    // The anchor rect and the viewport are on-screen pixels; the popup's own
    // offsetWidth/Height and the style we set are the zoomed page's CSS
    // pixels. Put everything in the latter, or the picker lands off its field.
    const z = pageZoom();
    const { top, left } = clampPickerPosition({
      anchor: { top: r.top / z, left: r.left / z, right: r.right / z, bottom: r.bottom / z },
      popWidth: pw, popHeight: ph,
      viewportWidth: window.innerWidth / z, viewportHeight: window.innerHeight / z,
    });
    setPos({ position: 'fixed', top, left, zIndex: 9999, visibility: 'visible' });
  }, [anchorEl, layout.width, layout.stacked]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (anchorEl?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [anchorEl, onClose]);

  // Opening a picker moves focus into the dialog — but only once it is
  // actually visible: the first commit renders off-screen with
  // `visibility: hidden` so it can be measured, and a hidden element is not
  // focusable, so focusing before then is silently a no-op.
  // (Focus is handed back to the calendar button by the row's close handler,
  // not by a cleanup here — an unmount cleanup fights React's dev-mode
  // double-invoke and can leave focus wherever the last pass put it.)
  const focusedRef = useRef(false);
  useEffect(() => {
    if (pos.visibility !== 'visible' || focusedRef.current) return;
    focusedRef.current = true;
    popRef.current?.focus({ preventScroll: true });
  }, [pos.visibility]);

  const isDisabled = (day: number) => {
    if (!minDate) return false;
    const d = new Date(calYear, calMonth - 1, day); d.setHours(0,0,0,0);
    const m = new Date(minDate); m.setHours(0,0,0,0);
    return d < m;
  };

  const prevMonth = () => calMonth === 1 ? (setCalMonth(12), setCalYear(y => y - 1)) : setCalMonth(m => m - 1);
  const nextMonth = () => calMonth === 12 ? (setCalMonth(1), setCalYear(y => y + 1)) : setCalMonth(m => m + 1);

  const today = new Date();
  const days = buildCalendarDays(calYear, calMonth);

  const selectDay = (day: number) => {
    if (isDisabled(day)) return;
    setSelDay(day); setSelMonth(calMonth); setSelYear(calYear);
  };

  const setNow = () => {
    const n = new Date();
    if (minDate && n < minDate) return;
    setSelDay(n.getDate()); setSelMonth(n.getMonth() + 1); setSelYear(n.getFullYear());
    setCalMonth(n.getMonth() + 1); setCalYear(n.getFullYear());
    setHour(n.getHours()); setMinute(n.getMinutes());
  };

  const confirm = () => {
    if (!selDay) return;
    // Time-aware minDate enforcement: the calendar disables earlier
    // DAYS via `isDisabled`, but a user can still pick a same-day time
    // that lands before minDate (e.g. Start = 6 PM, End = 5 PM same
    // day). Guard here so Confirm can't push an out-of-order value up
    // to the parent — matches the spec's "end must be later than
    // start" validation.
    const err = pickerRangeError(
      { day: selDay, month: selMonth, year: selYear, hour, minute },
      minDate,
      formatDateTime12,
    );
    if (err) { setRangeError(err); return; }
    onConfirm({ day: selDay, month: selMonth, year: selYear, hour, minute });
    onClose();
  };

  const selVal: DV = { day: selDay, month: selMonth, year: selYear, hour, minute };
  const { stacked } = layout;
  const colLabel: React.CSSProperties = {
    fontSize: 8.5, fontWeight: 700, color: D.textMuted,
    letterSpacing: '.08em', marginBottom: 2,
  };

  return (
    <div ref={popRef}
      role="dialog"
      aria-label={`Setting: ${fieldLabel}`}
      tabIndex={-1}
      onKeyDown={e => {
        // Scoped to the dialog so Escape dismisses the picker without also
        // closing the wizard behind it.
        if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      }}
      style={{
        ...pos, width: layout.width,
        border: `1px solid ${D.border2}`, borderRadius: 11,
        boxShadow: '0 12px 32px rgba(15,23,42,.14)', outline: 'none',
      }}
      className="sch-pop bg-white overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: D.border }}>
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: D.orangeLight }}>
          <Calendar size={11} style={{ color: D.orange }} />
        </div>
        <span className="text-xs font-semibold flex-shrink-0" style={{ color: D.textMuted }}>Setting:</span>
        <span className="text-xs font-bold truncate" style={{ color: D.orange }}>{fieldLabel}</span>
      </div>
      {/* Body — calendar beside the TIME pane on desktop, stacked under it
          once the viewport can no longer hold both without squeezing. */}
      <div
        className="flex"
        style={{
          flexDirection: stacked ? 'column' : 'row',
          borderBottom: `1px solid ${D.border}`,
        }}
      >
        <div
          className="py-2"
          style={{
            flex: '1 1 auto', minWidth: 0,
            paddingLeft: CAL_PANE_PAD_X, paddingRight: CAL_PANE_PAD_X,
            borderRight: stacked ? 'none' : `1px solid ${D.border}`,
          }}
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} aria-label="Previous month"
              className="sch-icon-btn w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 text-sm font-bold" style={{ color: D.textMuted }}>‹</button>
            <span className="text-xs font-bold" style={{ color: D.textMain }}>{MONTHS_FULL[calMonth - 1]} {calYear}</span>
            <button onClick={nextMonth} aria-label="Next month"
              className="sch-icon-btn w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 text-sm font-bold" style={{ color: D.textMuted }}>›</button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-0.5">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center py-0.5" style={{ fontSize: 9, fontWeight: 700, color: D.textMuted }}>{d}</div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              if (!day) return <div key={idx} />;
              const disabled = isDisabled(day);
              const isSelected = selDay === day && selMonth === calMonth && selYear === calYear;
              const isToday = day === today.getDate() && calMonth === today.getMonth() + 1 && calYear === today.getFullYear();
              return (
                <button key={idx} onClick={() => selectDay(day)} disabled={disabled}
                  aria-pressed={isSelected}
                  aria-label={`${day} ${MONTHS_FULL[calMonth - 1]} ${calYear}`}
                  className="sch-day rounded-lg flex items-center justify-center mx-auto transition-all"
                  style={{
                    width: CAL_CELL, height: CAL_CELL,
                    fontSize: 10,
                    background: isSelected ? D.orange : 'transparent',
                    color: isSelected ? '#fff' : disabled ? '#d1d5db' : D.textMain,
                    fontWeight: isToday && !isSelected ? 700 : 400,
                    outline: isToday && !isSelected ? `2px solid ${D.orange}` : 'none',
                    outlineOffset: '-2px',
                    cursor: disabled ? 'default' : 'pointer',
                  }}>
                  {day}
                </button>
              );
            })}
          </div>
        </div>
        {/* TIME pane — three explicit columns per the target image:
              HOUR (1-12), MINUTE (00-59), PERIOD (AM/PM segmented).
              No 24-hour values ever surface here; state stays 24-hour
              behind the scenes so downstream Date math is unaffected.
              The pane is sized from schedulePicker.ts so the PERIOD
              control can never reach the dialog's clipped edge again. */}
        <div
          className="flex flex-col items-center justify-center py-2"
          style={{
            width: stacked ? '100%' : layout.timePaneWidth,
            flexShrink: 0,
            gap: 8,
            paddingLeft: TIME_PANE_PAD_L, paddingRight: TIME_PANE_PAD_R,
            borderTop: stacked ? `1px solid ${D.border}` : 'none',
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: D.textMuted }}>TIME</span>
          {/* flex-wrap is a safety net for viewports narrower than any phone
              we support — it wraps rather than letting a control be sheared. */}
          <div className="flex items-start justify-center flex-wrap" style={{ gap: TIME_COL_GAP, rowGap: 8 }}>
            <div className="flex flex-col items-center">
              <span style={colLabel}>HOUR</span>
              <Spinner value={h12} min={1} max={12} onChange={setH12} label={`${fieldLabel} hour`} width={HOUR_COL_W} />
            </div>
            <span aria-hidden className="text-sm font-bold self-center"
              style={{ color: D.orange, marginTop: 12, width: COLON_W, textAlign: 'center' }}>:</span>
            <div className="flex flex-col items-center">
              <span style={colLabel}>MINUTE</span>
              <Spinner value={minute} min={0} max={59} onChange={setMinute} label={`${fieldLabel} minute`} width={MINUTE_COL_W} />
            </div>
            <div className="flex flex-col items-center" style={{ width: PERIOD_COL_W }}>
              <span style={colLabel}>PERIOD</span>
              <PeriodSelector value={period} onChange={setPeriod} fieldLabel={fieldLabel} pill />
            </div>
          </div>
        </div>
      </div>
      {/* Selected banner */}
      <div className="mx-3 my-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: D.orangeLight }}>
        <Check size={11} className="flex-shrink-0" style={{ color: D.orange }} />
        <span className="text-xs font-semibold truncate" style={{ color: D.orange }}>
          {selDay ? fmtDateTime(selVal) : 'No date selected'}
        </span>
      </div>
      {/* Inline range-error line — only shows when Confirm tried to close
          on an out-of-range time (see confirm() above). */}
      {rangeError && (
        <div className="mx-3 mb-2 flex items-start gap-1.5 px-3 py-1.5 rounded-lg" role="alert"
          style={{ background: '#FEF3F2', border: '1px solid #FBD3CE' }}>
          <AlertCircle size={11} className="flex-shrink-0 mt-[3px]" style={{ color: '#B42318' }} />
          <span className="text-xs font-semibold" style={{ color: '#B42318' }}>{rangeError}</span>
        </div>
      )}
      {/* Footer — Now on the left, the commit pair on the right. Wraps as a
          block instead of pushing Confirm past the dialog edge. */}
      <div className="flex items-center justify-between flex-wrap px-3.5 pb-3" style={{ gap: 10 }}>
        <button type="button" onClick={setNow} className="sch-link text-xs font-semibold" style={{ color: D.orange }}>Now</button>
        <div className="flex items-center" style={{ gap: 10 }}>
          <button type="button" onClick={onClose} className="sch-link text-xs font-semibold" style={{ color: D.textMuted }}>Cancel</button>
          <button type="button" onClick={confirm} disabled={!selDay}
            className="inline-flex items-center justify-center text-white transition-all"
            style={{ height: 29, padding: '0 12px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, background: '#0F172A', opacity: selDay ? 1 : 0.45, cursor: selDay ? 'pointer' : 'not-allowed' }}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

// Approval-scope options (same values/labels as before — layout is now a
// segmented control, so the hint of the active option renders below the track).
const SCOPE_OPTIONS = [
  { val: 'settings', label: 'Settings only', hint: 'Schedule, grade, notifications, security, etc.' },
  { val: 'settings_and_questions', label: 'Settings + Questions', hint: 'Everything above plus the actual question content.' },
] as const;

type DateSelectProps = {
  label: string;
  value: number | string;
  disabled?: boolean;
  kind?: 'month' | 'year' | 'period';
  options: { value: number | string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
};

function DateSelect({ label, value, disabled, kind, options, onChange, placeholder }: DateSelectProps) {
  const isEmpty = value === '' || value === 0 || value == null;
  const selectValue = isEmpty && placeholder ? '' : String(value);
  return (
    <span className={`${styles.dateSelect} ${kind === 'month' ? styles.monthSelect : kind === 'year' ? styles.yearSelect : kind === 'period' ? styles.periodSelect : ''}`}>
      <select aria-label={label} value={selectValue} disabled={disabled}
        onChange={event => onChange(event.target.value)}>
        {placeholder && <option value="" disabled hidden>{placeholder}</option>}
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <span className={styles.selectArrows} aria-hidden="true" />
    </span>
  );
}

// ── ScheduleStep ─────────────────────────────────────────────────────────────
export const ScheduleStep: React.FC<ScheduleStepProps> = ({
  formData, setFormData, validationErrors, setValidationErrors, touchedFields, isEditing, courseId,
}) => {
  const [openField, setOpenField] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Closing a picker returns focus to the calendar button that opened it, so
  // Tab order resumes where the user left it instead of jumping to the top of
  // the form. The button is still mounted, so this can run synchronously.
  const closePicker = (key: string) => {
    setOpenField(null);
    (rowRefs.current[key + '_btn'] as HTMLElement | null)?.focus?.({ preventScroll: true });
  };
  const approvalOn = !!(formData.schedule as any).requiresAdminApproval;
  const params = useParams() as any;
  const routeCourseId = typeof params?.id === 'string' ? params.id : null;
  const effectiveCourseId = courseId || (formData as any).courseId || routeCourseId || null;
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[] | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  useEffect(() => {
    if (!approvalOn || !effectiveCourseId) {
      setApprovalSteps(null);
      return;
    }
    const token = getToken();
    const institutionId = localStorage.getItem('smartcliff_institution');
    if (!token || !institutionId) return;
    let cancelled = false;
    setApprovalLoading(true);
    fetchApprovalHierarchy(effectiveCourseId, institutionId, token)
      .then((data) => { if (!cancelled) setApprovalSteps(data.steps || []); })
      .catch(() => { if (!cancelled) setApprovalSteps([]); })
      .finally(() => { if (!cancelled) setApprovalLoading(false); });
    return () => { cancelled = true; };
  }, [approvalOn, effectiveCourseId]);

  // Surface "no hierarchy configured" as a validation error so the parent
  // wizard can block Save. Clear it when toggle goes off or hierarchy fills.
  useEffect(() => {
    setValidationErrors((prev: any) => {
      const n = { ...prev };
      const empty = approvalOn && !approvalLoading && Array.isArray(approvalSteps) && approvalSteps.length === 0;
      if (empty) (n as any).approvalHierarchy = 'Course has no Approval Hierarchy configured.';
      else delete (n as any).approvalHierarchy;
      return n;
    });
  }, [approvalOn, approvalLoading, approvalSteps, setValidationErrors]);

  const getDV = (key: string): DV => (formData.schedule as any)[key] || EMPTY_DV;

  const setDV = (key: string, val: DV) => {
    setFormData((prev: any) => ({ ...prev, schedule: { ...prev.schedule, [key]: val } }));
    // End must be later than Start (and similarly cut-off ≥ end, grace ≥
    // end/cut-off). Inline SegInput edits bypass the CalendarPopup's own
    // guard, so re-check here. Popup-driven confirms hit this path too
    // and stay a no-op because they already passed the same test.
    setValidationErrors((prev: any) => {
      const n = { ...prev };
      if (key === 'startDate')       delete n.startDate;
      if (key === 'endDate')         delete n.endDate;
      if (key === 'cutOffDate')      delete (n as any).cutOffDate;
      if (key === 'gracePeriodDate') delete n.gracePeriod;
      const nextSched: any = { ...(formData as any).schedule, [key]: val };
      const toMs = (v: DV) => hasDate(v) ? dvToDate(v)!.getTime() : null;
      const startMs = toMs(nextSched.startDate || EMPTY_DV);
      const endMs   = toMs(nextSched.endDate   || EMPTY_DV);
      const cutMs   = toMs(nextSched.cutOffDate|| EMPTY_DV);
      const graceMs = toMs(nextSched.gracePeriodDate || EMPTY_DV);
      if (key === 'endDate' && startMs != null && endMs != null && endMs <= startMs) {
        n.endDate = 'End date & time must be later than Start.';
      }
      if (key === 'cutOffDate' && endMs != null && cutMs != null && cutMs < endMs) {
        (n as any).cutOffDate = 'Cut-off must be on or after End.';
      }
      if (key === 'gracePeriodDate' && graceMs != null) {
        const floor = cutMs ?? endMs;
        if (floor != null && graceMs < floor) n.gracePeriod = 'Grace deadline must be on or after End / Cut-off.';
      }
      return n;
    });
  };

  const toggleField = (enabledKey: string) => {
    setFormData((prev: any) => ({
      ...prev,
      schedule: { ...prev.schedule, [enabledKey]: !(prev.schedule as any)[enabledKey] },
    }));
  };

  const getMinDateFor = (key: string): Date | undefined => {
    const now = new Date();
    if (key === 'startDate') return isEditing ? undefined : now;
    if (key === 'endDate') {
      const s = getDV('startDate');
      // End must be at least 30 minutes after Start.
      return hasDate(s)
        ? new Date(s.year, s.month - 1, s.day, s.hour, s.minute + 30)
        : (isEditing ? undefined : now);
    }
    if (key === 'cutOffDate') {
      const e = getDV('endDate');
      return hasDate(e) ? new Date(e.year, e.month - 1, e.day, e.hour, e.minute) : undefined;
    }
    if (key === 'gracePeriodDate' || key === 'remindGradeBy') {
      const c = getDV('cutOffDate');
      if (hasDate(c) && (formData.schedule as any).cutOffEnabled)
        return new Date(c.year, c.month - 1, c.day, c.hour, c.minute);
      const e = getDV('endDate');
      return hasDate(e) ? new Date(e.year, e.month - 1, e.day, e.hour, e.minute) : undefined;
    }
    return undefined;
  };

  const getError = (key: string) => {
    if (key === 'startDate')       return validationErrors.startDate;
    if (key === 'endDate')         return validationErrors.endDate;
    if (key === 'cutOffDate')      return (validationErrors as any).cutOffDate;
    if (key === 'gracePeriodDate') return validationErrors.gracePeriod;
    if (key === 'remindGradeBy') return validationErrors.remindGradeBy;
    return undefined;
  };

  const isTouched = (key: string) =>
    touchedFields.has(key === 'gracePeriodDate' ? 'gracePeriod' : key);

  const fields = [
    { label: 'Start date', key: 'startDate', enabledKey: '', help: 'Students can begin submitting from this date. A start date is required.', required: true },
    { label: 'End date', key: 'endDate', enabledKey: '', help: 'The submission deadline. An end date is required.', required: true },
    { label: 'Cut off date', key: 'cutOffDate', enabledKey: 'cutOffEnabled', help: 'Submissions are no longer accepted after this date. Toggle Enable to set one.', required: false },
    { label: 'Grade by date', key: 'remindGradeBy', enabledKey: 'remindGradeByEnabled', help: 'The date by which grading should be completed. Toggle Enable to set one.', required: false },
  ];

  return (
    <div className={styles.availability}>
      {fields.map(({ label, key, enabledKey, help, required }) => {
        const value = getDV(key);
        const error = getError(key);
        const showError = !!error && isTouched(key);
        // Optional rows (Cut off / Grade by) sit behind an Enable checkbox —
        // the underlying date-picker stays but is disabled until the trainer
        // ticks Enable, so the row keeps its shape without demanding a value.
        // Required rows (Start / End) have no toggle and are always active.
        const isOptional = !!enabledKey;
        const enabled = !isOptional || !!formData.schedule[enabledKey];
        // No default-to-today anymore — empty state shows a "Select" placeholder
        // in every dropdown until the user picks values. `date` is only used to
        // clamp `day` against `daysInMonth` once month/year exist.
        const isSet = hasDate(value);
        const yearForDays = value.year > 0 ? value.year : new Date().getFullYear();
        const monthForDays = value.month > 0 ? value.month : new Date().getMonth() + 1;
        const daysInMonth = new Date(yearForDays, monthForDays, 0).getDate();
        // Patch a single field on the DV. When the user picks something in an
        // otherwise-empty row we auto-fill the year and month with sensible
        // defaults so day-clamping and cross-field validation keep working,
        // while the parts the user has NOT chosen yet stay as 0 (which drives
        // the "Select" placeholder in the other dropdowns).
        const update = (part: keyof DV, next: number) => {
          if (isOptional && !enabled) return; // Enable toggle is off — row is inert
          const updated: DV = { ...value, [part]: next };
          if (part !== 'year' && updated.year === 0) updated.year = new Date().getFullYear();
          if (part !== 'month' && updated.month === 0) updated.month = new Date().getMonth() + 1;
          if (updated.day > 0 && updated.year > 0 && updated.month > 0) {
            updated.day = Math.min(updated.day, new Date(updated.year, updated.month, 0).getDate());
          }
          setDV(key, updated);
        };
        const toggleEnable = () => {
          if (!enabledKey) return;
          setFormData((prev: any) => {
            const nextOn = !prev.schedule[enabledKey];
            return {
              ...prev,
              schedule: {
                ...prev.schedule,
                [enabledKey]: nextOn,
                // Clearing the flag also clears any stale date so re-enabling
                // starts from a clean "Select" state instead of resurrecting
                // whatever the trainer half-typed last time.
                ...(nextOn ? {} : { [key]: EMPTY_DV }),
              },
            };
          });
          if (openField === key) setOpenField(null);
        };
        // 12-hour view over the underlying 24-hour hour value.
        const hasHour = isSet;
        const t12 = hasHour ? to12(value.hour) : { h12: 0, period: '' as Period | '' };
        const yearNow = new Date().getFullYear();
        const yearFloor = Math.min(2020, value.year || yearNow);
        const yearCeil = Math.max(2099, value.year || yearNow);
        // Enter-key setter for h12/period pairs, keeping the AM/PM change from
        // silently flipping a completed row (e.g. 9 AM → 9 PM).
        const setHour12 = (h12: number, period: Period) => update('hour', from12({ h12, period }));
        return (
          <div key={key} className={styles.dateRow}>
            <div className={styles.dateLabel}>
              <span id={`${key}-label`}>{label}{required && <span className={styles.required} aria-label="required">*</span>}</span>
              <SettingsHelp content={help} />
            </div>
            <div className={styles.dateControls} role="group" aria-labelledby={`${key}-label`}>
              {isOptional ? (
                <label className={styles.enable}>
                  <input type="checkbox" checked={enabled} onChange={toggleEnable} aria-label={`Enable ${label}`} />
                  Enable
                </label>
              ) : (
                /* Required rows have no Enable toggle, but we reserve the
                   same slot so every row's Day/Month/Year… dropdowns start
                   on the same vertical line — otherwise the optional rows
                   shift right by the checkbox width. */
                <span className={styles.enable} aria-hidden="true" style={{ visibility: 'hidden' }} />
              )}
              <div className={styles.dateInputs}>
                <DateSelect label={`${label} day`} value={value.day || ''} placeholder="Day" disabled={!enabled}
                  options={Array.from({ length: daysInMonth }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                  onChange={day => update('day', Number(day))} />
                <DateSelect label={`${label} month`} value={value.month || ''} kind="month" placeholder="Month" disabled={!enabled}
                  options={MONTHS_FULL.map((month, index) => ({ value: index + 1, label: month }))}
                  onChange={month => update('month', Number(month))} />
                <DateSelect label={`${label} year`} value={value.year || ''} kind="year" placeholder="Year" disabled={!enabled}
                  options={Array.from({ length: yearCeil - yearFloor + 1 }, (_, i) => {
                    const year = yearFloor + i;
                    return { value: year, label: String(year) };
                  })}
                  onChange={year => update('year', Number(year))} />
                <DateSelect label={`${label} hour`} value={t12.h12 || ''} placeholder="HH" disabled={!enabled}
                  options={Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                  onChange={h => {
                    const h12 = Number(h);
                    const period: Period = t12.period === 'PM' ? 'PM' : 'AM';
                    setHour12(h12, period);
                  }} />
                <DateSelect label={`${label} minute`} value={hasHour ? String(value.minute).padStart(2, '0') : ''} placeholder="MM" disabled={!enabled}
                  options={Array.from({ length: 60 }, (_, minute) => ({ value: String(minute).padStart(2, '0'), label: String(minute).padStart(2, '0') }))}
                  onChange={minute => update('minute', Number(minute))} />
                <DateSelect label={`${label} AM/PM`} value={t12.period || ''} kind="period" placeholder="AM/PM" disabled={!enabled}
                  options={[{ value: 'AM', label: 'AM' }, { value: 'PM', label: 'PM' }]}
                  onChange={period => {
                    const p = (period === 'PM' ? 'PM' : 'AM') as Period;
                    const h12 = t12.h12 > 0 ? t12.h12 : 12;
                    setHour12(h12, p);
                  }} />
                <button type="button" className={styles.calendarButton} disabled={!enabled}
                  ref={element => { rowRefs.current[key + '_btn'] = element as unknown as HTMLDivElement | null; }}
                  aria-label={`Choose ${label} from a calendar`} aria-haspopup="dialog" aria-expanded={openField === key}
                  onClick={() => enabled && setOpenField(nextOpenField(openField, key))}>
                  <Calendar size={20} strokeWidth={2.5} />
                </button>
              </div>
              {showError && <p role="alert" className={styles.dateError}>{error}</p>}
            </div>
            {openField === key && enabled && <CalendarPopup fieldLabel={label} value={isSet ? value : dateToDV(new Date())}
              onConfirm={next => { setDV(key, next); closePicker(key); }}
              onClose={() => closePicker(key)} minDate={getMinDateFor(key)} anchorEl={rowRefs.current[key + '_btn']} />}
          </div>
        );
      })}
      <details className={styles.approval}>
        <summary>Approval settings</summary>
        <div className={styles.approvalContent}>
          <label>
            <input type="checkbox" checked={approvalOn} onChange={() => toggleField('requiresAdminApproval')} />
            Requires approval
          </label>
          {approvalOn && <>
            <p>Students see this exercise after the course approvers approve it.</p>
            {approvalLoading && <p>Loading approvers…</p>}
            {!approvalLoading && approvalSteps?.map((step: any, index: number) => (
              <span key={step.roleId || index}>{step.roleName || step.roleId}</span>
            ))}
            {!approvalLoading && approvalSteps?.length === 0 && <p role="alert" className={styles.issues}>Course has no Approval Hierarchy configured.</p>}
            <label htmlFor="assignment-approval-scope">Approval scope</label>
            <select id="assignment-approval-scope" value={formData.schedule.approvalScope || 'settings'}
              onChange={event => setFormData((previous: any) => ({ ...previous, schedule: { ...previous.schedule, approvalScope: event.target.value } }))}>
              {SCOPE_OPTIONS.map(option => <option key={option.val} value={option.val}>{option.label}</option>)}
            </select>
          </>}
        </div>
      </details>
    </div>
  );
};
