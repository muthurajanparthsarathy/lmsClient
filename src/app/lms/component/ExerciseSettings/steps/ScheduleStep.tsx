import { getToken } from "@/lib/session";
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Calendar, Clock, Lock, Bell,
  ChevronUp, ChevronDown, Check, ShieldCheck, AlertCircle,
} from 'lucide-react';
import { D, FONT } from '../../../pages/courses/uploadcourseresources/components/youdo/assessments/shared/tokens';
import { InfoTooltip } from '../../../pages/courses/uploadcourseresources/components/youdo/assessments/shared/UIComponents';
import { fetchApprovalHierarchy, type ApprovalStep } from '@/apiServices/userService';
import {
  to12, from12, formatDateTime12, formatTime12,
  type Period,
} from '@/app/lms/shared/time12';
// Picker geometry + the pure interaction helpers behind the Availability
// rows. Extracted so the widths that decide whether the AM/PM control fits
// inside the dialog are asserted by schedulePicker.test.ts rather than
// eyeballed — see that file's header for the bug this prevents.
import {
  measurePicker, clampPickerPosition,
  nextOpenField, setPeriodOnDV, setHour12OnDV, applyOffset as offsetToDV,
  pickerRangeError,
  EMPTY_DV, hasDate, dvToDate, dateToDV,
  CAL_CELL, CAL_PANE_PAD_X,
  TIME_COL_GAP, HOUR_COL_W, COLON_W, MINUTE_COL_W, PERIOD_COL_W,
  TIME_PANE_PAD_L, TIME_PANE_PAD_R,
  type DV,
} from '@/app/lms/shared/schedulePicker';

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
const SEG_W = 34;           // DD / MM / HH / MM inputs
const SEG_YEAR_W = 50;      // YYYY
const CAL_BTN = 34;         // icon-only calendar trigger
const CHIP_H = 26;          // quick-duration chips
const FMT_W = 54;           // "12:00 PM" read-out — fixed so rows stay aligned

// ── SegInput: editable DD/MM/YYYY/HH/MM segment ─────────────────────────────
const SegInput: React.FC<{
  value: number; placeholder: string; min: number; max: number;
  onChange: (v: number) => void;
  /** Screen-reader name — "DD" alone doesn't say which field it belongs to. */
  ariaLabel: string;
  inputRef?: React.Ref<HTMLInputElement>;
}> = ({ value, placeholder, min, max, onChange, ariaLabel, inputRef }) => {
  const pad = placeholder.length;
  const [raw, setRaw] = useState(value > 0 ? String(value).padStart(pad, '0') : '');
  useEffect(() => { setRaw(value > 0 ? String(value).padStart(pad, '0') : ''); }, [value, pad]);
  return (
    <input
      ref={inputRef}
      type="text" inputMode="numeric" value={raw} placeholder={placeholder} maxLength={pad}
      aria-label={ariaLabel}
      onChange={e => {
        const v = e.target.value.replace(/\D/g, '').slice(0, pad);
        setRaw(v);
        const n = parseInt(v, 10);
        if (!isNaN(n)) onChange(Math.min(n, max));
      }}
      onBlur={() => {
        const n = parseInt(raw, 10);
        if (isNaN(n) || n < min) { setRaw(''); onChange(0); }
        else {
          const c = Math.min(Math.max(n, min), max);
          setRaw(String(c).padStart(pad, '0'));
          onChange(c);
        }
      }}
      className="sch-seg text-center font-medium bg-white outline-none transition-colors"
      style={{
        width: pad === 4 ? SEG_YEAR_W : SEG_W, height: CTRL_H, fontSize: 12,
        borderRadius: CTRL_R, flexShrink: 0,
        border: '1px solid #D0D5DD', color: '#101828', fontFamily: FONT, padding: '0 4px',
      }}
    />
  );
};

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
    const { top, left } = clampPickerPosition({
      anchor: { top: r.top, left: r.left, right: r.right, bottom: r.bottom },
      popWidth: pw, popHeight: ph,
      viewportWidth: window.innerWidth, viewportHeight: window.innerHeight,
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

// ── Quick-offset presets ─────────────────────────────────────────────────────
const QUICK_OFFSETS = [
  { label: '+30m', ms: 30 * 60 * 1000 },
  { label: '+1h',  ms: 60 * 60 * 1000 },
  { label: '+2h',  ms: 2 * 60 * 60 * 1000 },
  { label: '+1d',  ms: 24 * 60 * 60 * 1000 },
  { label: '+1w',  ms: 7 * 24 * 60 * 60 * 1000 },
];

// ── Presentational primitives (switch + section heading) ─────────────────────
// SectionHeading mirrors the pattern used in ExerciseDetailsStep — orange
// title with a thin hairline divider extending to the right. Replaces the
// old bordered `Card` wrapper so the whole page reads as one flat surface.
const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 10px' }}>
    <span style={{
      fontSize: 12, fontWeight: 700, color: D.orange, letterSpacing: '-.01em',
      whiteSpace: 'nowrap', textTransform: 'none', fontFamily: FONT,
    }}>
      {children}
    </span>
    <span aria-hidden style={{ flex: 1, height: 1, background: D.border }} />
  </div>
);

const SpecSwitch: React.FC<{ on: boolean; onClick: () => void }> = ({ on, onClick }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={onClick}
    className="relative flex-shrink-0"
    style={{
      width: 35, height: 20, borderRadius: 999, padding: 0, border: 'none',
      background: on ? D.emerald : '#DEDAD5', cursor: 'pointer', transition: 'background .16s',
    }}
  >
    <span
      style={{
        position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: '50%',
        background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        transition: 'transform .16s', transform: on ? 'translateX(15px)' : 'translateX(0)',
      }}
    />
  </button>
);

// Approval-scope options (same values/labels as before — layout is now a
// segmented control, so the hint of the active option renders below the track).
const SCOPE_OPTIONS = [
  { val: 'settings', label: 'Settings only', hint: 'Schedule, grade, notifications, security, etc.' },
  { val: 'settings_and_questions', label: 'Settings + Questions', hint: 'Everything above plus the actual question content.' },
] as const;

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

  const getOffsetBase = (key: string): Date | null => {
    if (key === 'endDate')         return dvToDate(getDV('startDate'));
    if (key === 'cutOffDate')      return dvToDate(getDV('endDate'));
    if (key === 'gracePeriodDate' || key === 'remindGradeBy') {
      const co = (formData.schedule as any).cutOffEnabled ? dvToDate(getDV('cutOffDate')) : null;
      return co ?? dvToDate(getDV('endDate'));
    }
    return null;
  };

  const applyOffset = (key: string, ms: number) => {
    const base = getOffsetBase(key);
    if (!base) return;
    setDV(key, offsetToDV(base, ms));
  };

  const getError = (key: string) => {
    if (key === 'startDate')       return validationErrors.startDate;
    if (key === 'endDate')         return validationErrors.endDate;
    if (key === 'cutOffDate')      return (validationErrors as any).cutOffDate;
    if (key === 'gracePeriodDate') return validationErrors.gracePeriod;
    return undefined;
  };

  const isTouched = (key: string) =>
    touchedFields.has(key === 'gracePeriodDate' ? 'gracePeriod' : key);

  const FIELDS: Array<{
    label: string; fieldKey: string; icon: React.ReactNode; iconColor: string; iconBg: string;
    toggleable: boolean; enabledKey: string; required: boolean; tooltip: string; showOffsets: boolean;
  }> = [
    { label: 'Start Date & Time',    fieldKey: 'startDate',     icon: <Calendar size={15} />, iconColor: D.emerald, iconBg: 'rgba(16,185,129,0.10)',  toggleable: false, enabledKey: '',                     required: true,  tooltip: 'The date from which students can start submitting.',         showOffsets: false },
    { label: 'End Date & Time',      fieldKey: 'endDate',       icon: <Clock size={15} />,    iconColor: D.amber,   iconBg: 'rgba(245,158,11,0.10)',  toggleable: false, enabledKey: '',                     required: true,  tooltip: 'The submission deadline. Quick-add fills time after start.', showOffsets: true  },
    { label: 'Cut-off Date & Time',  fieldKey: 'cutOffDate',    icon: <Lock size={15} />,     iconColor: D.red,     iconBg: 'rgba(239,68,68,0.10)',   toggleable: true,  enabledKey: 'cutOffEnabled',         required: false, tooltip: 'Optional hard late boundary after end date.',                showOffsets: true  },
    { label: 'Remind Me to Mark By', fieldKey: 'remindGradeBy', icon: <Bell size={15} />,     iconColor: D.purple,  iconBg: 'rgba(139,92,246,0.10)',  toggleable: true,  enabledKey: 'remindGradeByEnabled',  required: false, tooltip: 'Reminder to finish grading by this date.',                   showOffsets: true  },
  ];

  return (
    <div className="sch-step" style={{ padding: '16px 32px 24px', maxWidth: 1200, fontFamily: FONT }}>
      <style>{`
        /* ── Availability rows ────────────────────────────────────────────
           Every row — Start, End, Cut-off, Remind — is the SAME two-column
           grid: a fixed-width head (icon | label | toggle slot) plus the
           control cell. Because the head is identical on every row, the
           Start and End control groups begin on exactly the same pixel, and
           the End row no longer drops its controls to a second line. */
        .sch-step { --sch-label-w: 176px; }
        .sch-row {
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr);
          align-items: center;
          column-gap: 12px;
          row-gap: 10px;
        }
        .sch-row-head {
          display: grid;
          grid-template-columns: 36px var(--sch-label-w) 44px;
          align-items: center;
          gap: 12px;
        }
        .sch-row-ctrl {
          min-width: 0;
          display: flex; align-items: center; flex-wrap: wrap; gap: 10px;
        }
        /* The date/time controls stay together as one unit; only the
           quick-duration chip group after them may drop to the next line. */
        .sch-primary { display: flex; align-items: center; flex-wrap: nowrap; gap: 6px; }
        .sch-chips   { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
        .sch-date, .sch-time { display: inline-flex; align-items: center; gap: 4px; }

        /* Keyboard focus is visible on every control type, in both the row
           and the picker dialog. */
        .sch-step :is(button, input, [role="spinbutton"], [role="switch"]):focus-visible,
        .sch-pop  :is(button, input, [role="spinbutton"]):focus-visible {
          outline: 2px solid ${D.orange};
          outline-offset: 2px;
          position: relative;
          z-index: 1;
        }
        .sch-seg:focus { border-color: ${D.orange}; box-shadow: 0 0 0 2px ${D.orangeMed}; }
        .sch-link:hover { text-decoration: underline; }
        .sch-icon-btn:hover { background: ${D.surface2}; }
        .sch-day:not(:disabled):hover { background: ${D.orangeLight}; }

        /* Compact controls keep their density but claim a 44px-tall pointer
           target. Vertical only by default: the rows have slack above and
           below, whereas horizontal growth would overlap the next control. */
        .sch-hit { position: relative; }
        .sch-hit::after {
          content: ''; position: absolute; left: 0; right: 0;
          top: 50%; height: 44px; transform: translateY(-50%);
        }
        /* The icon-only calendar trigger sits inside 10px gaps, so it has
           room to reach 44px in both directions. */
        .sch-cal-btn::after { left: -5px; right: -5px; }

        @media (max-width: 1180px) { .sch-step { --sch-label-w: 150px; } }
        @media (max-width: 820px) {
          /* Tablet / phone — a deliberate stack, not an accidental wrap. */
          .sch-step { padding: 14px 16px 20px !important; }
          .sch-row { grid-template-columns: minmax(0, 1fr); }
          .sch-row-head { grid-template-columns: 36px minmax(0, 1fr) auto; }
        }
        @media (max-width: 620px) {
          /* Below this the primary group must break too — but it breaks at
             the date / time / button seams, never inside a control. */
          .sch-primary { flex-wrap: wrap; row-gap: 8px; }
        }
      `}</style>
      {/* Page heading is rendered by the parent wizard from STEP_META so we
          don't stack a duplicate here — mirrors the Question sources pattern. */}

      {/* ── APPROVAL ─────────────────────────────────────────────── */}
      <SectionHeading>Approval</SectionHeading>
      <div
        className="flex flex-col"
        style={{ gap: 10, paddingTop: 6, paddingBottom: 6, borderBottom: `1px solid ${D.border}` }}
      >
        <div className="flex items-center flex-wrap" style={{ gap: 12, minHeight: 56 }}>
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 36, height: 36, background: '#FFF2E8', color: D.orangeDark, borderRadius: 8 }}
          >
            <ShieldCheck size={16} />
          </div>
          <div className="flex items-center" style={{ gap: 4, minWidth: 220 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: FONT }}>
              Requires Approval
            </span>
            <InfoTooltip
              content="When ON, students see this exercise only after every approver in the course's Approval Hierarchy approves."
              side="right"
            />
          </div>
          <div className="flex items-center" style={{ gap: 8, marginLeft: 4 }}>
            <SpecSwitch on={approvalOn} onClick={() => toggleField('requiresAdminApproval')} />
            <span style={{ fontSize: 11, fontWeight: 700, color: approvalOn ? D.emerald : D.textHint }}>
              {approvalOn ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {approvalOn && (
          <div style={{ paddingLeft: 48, display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
            {approvalLoading && (
              <span style={{ fontSize: 11.4, color: D.textMuted }}>Loading approvers…</span>
            )}
            {!approvalLoading && approvalSteps && approvalSteps.length > 0 && (
              <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
                {approvalSteps.map((s: any, i: number) => (
                  <React.Fragment key={s.roleId || i}>
                    {i > 0 && <span style={{ fontSize: 11, color: D.textHint }}>→</span>}
                    <span
                      className="inline-flex items-center"
                      style={{ height: 23, padding: '0 9px', borderRadius: 999, fontSize: 10.8, fontWeight: 600, background: '#F4F4F5', border: '1px solid #E7E5E4', color: '#57606E' }}
                    >
                      {i + 1}. {s.roleName}
                    </span>
                  </React.Fragment>
                ))}
                <span style={{ fontSize: 10.8, color: D.textMuted, marginLeft: 4 }}>→ Students</span>
              </div>
            )}
            {!approvalLoading && Array.isArray(approvalSteps) && approvalSteps.length === 0 && (
              <div
                className="flex items-start"
                style={{ gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 11.4, lineHeight: 1.5, background: '#FEF3F2', border: '1px solid #FBD3CE', color: '#912018' }}
              >
                <AlertCircle size={12} className="mt-[2px] flex-shrink-0" />
                <span>
                  Course has no Approval Hierarchy configured. Configure it on the course participants page first.
                </span>
              </div>
            )}

            <div style={{ paddingTop: 4 }}>
              <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#101828', marginBottom: 5, fontFamily: FONT }}>
                What should approvers review?
              </span>
              <div className="inline-flex" style={{ background: D.surface2, border: `1px solid ${D.border2}`, borderRadius: 8, padding: 3, gap: 3 }}>
                {SCOPE_OPTIONS.map(({ val, label, hint }) => {
                  const selected = ((formData.schedule as any).approvalScope || 'settings') === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      aria-pressed={selected}
                      title={hint}
                      onClick={() => setFormData((prev: any) => ({
                        ...prev,
                        schedule: { ...prev.schedule, approvalScope: val },
                      }))}
                      className="flex items-center justify-center transition-all"
                      style={{
                        height: 27, padding: '0 12px', borderRadius: 5, fontSize: 12, fontWeight: 600,
                        border: 'none', cursor: 'pointer',
                        background: selected ? '#fff' : 'transparent',
                        color: selected ? D.orangeDark : D.textMuted,
                        boxShadow: selected ? '0 1px 3px rgba(15,23,42,.1)' : 'none',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.4, lineHeight: 1.5, color: D.textMuted, marginTop: 5 }}>
                {SCOPE_OPTIONS.find(o => o.val === ((formData.schedule as any).approvalScope || 'settings'))?.hint}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── AVAILABILITY ─────────────────────────────────────────── */}
      <div style={{ marginTop: 20 }}>
        <SectionHeading>Availability</SectionHeading>
        {FIELDS.map(({ label, fieldKey, icon, iconColor, iconBg, toggleable, enabledKey, required, tooltip, showOffsets }, idx) => {
          const enabled  = !toggleable || !!(formData.schedule as any)[enabledKey];
          const val      = getDV(fieldKey);
          const error    = getError(fieldKey);
          const touched  = isTouched(fieldKey);
          const isOpen   = openField === fieldKey;
          const minDate  = getMinDateFor(fieldKey);
          const offsetBase = showOffsets ? getOffsetBase(fieldKey) : null;
          const canOffset = showOffsets && enabled && !!offsetBase;

          const t = to12(val.hour || 0);
          const errId = `${fieldKey}-error`;
          const showError = !!error && touched;

          return (
            <div
              key={fieldKey}
              ref={el => { rowRefs.current[fieldKey] = el; }}
              className="sch-row relative"
              style={{
                paddingTop: 14, paddingBottom: 14,
                minHeight: 72,
                borderBottom: idx < FIELDS.length - 1 ? `1px solid ${D.border}` : 'none',
              }}
            >
              {/* Head — icon | label | toggle slot. Identical width on every
                  row, which is what keeps the control groups aligned. */}
              <div className="sch-row-head">
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 36, height: 36, background: iconBg, color: iconColor, borderRadius: 8 }}
                >
                  {icon}
                </div>

                <div className="flex items-center" style={{ gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: FONT }}>{label}</span>
                  {required && <span style={{ fontSize: 11, fontWeight: 700, color: D.orange }} aria-hidden>*</span>}
                  {tooltip && <InfoTooltip content={tooltip} side="right" />}
                </div>

                {/* The toggle column is reserved even on the always-on rows,
                    so Start/End controls line up with Cut-off/Remind. */}
                {toggleable
                  ? <SpecSwitch on={enabled} onClick={() => toggleField(enabledKey)} />
                  : <span aria-hidden />}
              </div>

              {/* Controls */}
              <div className="sch-row-ctrl">
                {enabled ? (
                  <>
                    {/* One unbroken group: date, time, AM/PM, the formatted
                        read-out and the calendar trigger. */}
                    <div className="sch-primary">
                      <span className="sch-date">
                        <SegInput value={val.day}   placeholder="DD"   min={1}    max={31}   ariaLabel={`${label} day`}
                          onChange={d => setDV(fieldKey, { ...val, day: d })} />
                        <span aria-hidden style={{ fontSize: 12, color: D.textHint, fontWeight: 500 }}>/</span>
                        <SegInput value={val.month} placeholder="MM"   min={1}    max={12}   ariaLabel={`${label} month`}
                          onChange={m => setDV(fieldKey, { ...val, month: m })} />
                        <span aria-hidden style={{ fontSize: 12, color: D.textHint, fontWeight: 500 }}>/</span>
                        <SegInput value={val.year}  placeholder="YYYY" min={2020} max={2099} ariaLabel={`${label} year`}
                          onChange={y => setDV(fieldKey, { ...val, year: y })} />
                      </span>

                      {/* Time is 12-hour with an AM/PM chip. The stored
                          `val.hour` stays 24-hour so the parent's storage and
                          downstream `dvToDate` / `.toISOString()` UTC
                          conversion don't change; we only re-project into 12h
                          at the input boundary. */}
                      <span className="sch-time" style={{ marginLeft: 4 }}>
                        <SegInput
                          value={t.h12} placeholder="HH" min={1} max={12}
                          ariaLabel={`${label} hour`}
                          onChange={h12 => setDV(fieldKey, setHour12OnDV(val, h12))}
                        />
                        <span aria-hidden style={{ fontSize: 12, color: D.textHint, fontWeight: 500 }}>:</span>
                        <SegInput
                          value={val.minute} placeholder="MM" min={0} max={59}
                          ariaLabel={`${label} minute`}
                          onChange={m => setDV(fieldKey, { ...val, minute: m })}
                        />
                        <PeriodSelector
                          value={t.period}
                          fieldLabel={label}
                          onChange={p => setDV(fieldKey, setPeriodOnDV(val, p))}
                        />
                        {/* Fixed width: "12:00 PM" is wider than "5:30 PM", and
                            a text-sized read-out would shift the calendar
                            button to a different x on every row. */}
                        <span
                          style={{
                            fontSize: 11, fontWeight: 500, color: D.textHint,
                            marginLeft: 2, whiteSpace: 'nowrap',
                            width: FMT_W, flexShrink: 0,
                          }}
                          title="12-hour clock — flip AM/PM to switch"
                        >
                          {formatTime12(val.hour || 0, val.minute || 0)}
                        </span>
                      </span>

                      <button
                        ref={el => { rowRefs.current[fieldKey + '_btn'] = el as HTMLDivElement | null; }}
                        type="button"
                        onClick={() => setOpenField(nextOpenField(openField, fieldKey))}
                        aria-label={`Choose ${label} from a calendar`}
                        aria-haspopup="dialog"
                        aria-expanded={isOpen}
                        className="sch-hit sch-cal-btn flex items-center justify-center transition-all flex-shrink-0"
                        style={{
                          width: CAL_BTN, height: CAL_BTN, borderRadius: CTRL_R, marginLeft: 4,
                          background: isOpen ? D.orange : '#fff',
                          color: isOpen ? '#fff' : D.textMuted,
                          border: `1px solid ${isOpen ? D.orange : '#D0D5DD'}`,
                          cursor: 'pointer',
                        }}
                      >
                        <Calendar size={14} />
                      </button>
                    </div>

                    {/* Quick-duration chips sit AFTER the calendar button and
                        are the only part of the row allowed to wrap — they
                        move as a block, leaving the inputs above untouched. */}
                    {showOffsets && (
                      <div className="sch-chips" role="group" aria-label={`${label} quick durations`}>
                        {QUICK_OFFSETS.map(o => (
                          <button
                            key={o.label}
                            type="button"
                            disabled={!canOffset}
                            onClick={() => applyOffset(fieldKey, o.ms)}
                            title={offsetBase
                              ? `Set to ${o.label} after ${fmtDateTime(dateToDV(offsetBase))}`
                              : 'Fill the previous date first'}
                            className="sch-hit inline-flex items-center transition-all"
                            style={{
                              height: CHIP_H, padding: '0 10px', borderRadius: 999,
                              fontSize: 11, fontWeight: 600,
                              background: '#F4F4F5', border: '1px solid #E7E5E4', color: '#57606E',
                              opacity: canOffset ? 1 : 0.45,
                              cursor: canOffset ? 'pointer' : 'not-allowed',
                              fontFamily: FONT, whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={e => {
                              if (!canOffset) return;
                              e.currentTarget.style.background = '#FFF2E8';
                              e.currentTarget.style.borderColor = '#FBD8BE';
                              e.currentTarget.style.color = D.orangeDark;
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.background = '#F4F4F5';
                              e.currentTarget.style.borderColor = '#E7E5E4';
                              e.currentTarget.style.color = '#57606E';
                            }}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center" style={{ gap: 6, fontSize: 11.4, color: D.textMuted, minHeight: CTRL_H }}>
                    <Lock size={12} />
                    <span>Disabled</span>
                  </div>
                )}

                {/* Error — inside the control cell so it lines up under the
                    inputs it refers to instead of shoving them sideways. */}
                {showError && (
                  <span id={errId} role="alert"
                    style={{ fontSize: 11.4, color: D.red, flexBasis: '100%' }}>
                    {error}
                  </span>
                )}
              </div>

              {/* Popup */}
              {isOpen && enabled && (
                <CalendarPopup
                  fieldLabel={label}
                  value={val}
                  onConfirm={v => { setDV(fieldKey, v); closePicker(fieldKey); }}
                  onClose={() => closePicker(fieldKey)}
                  minDate={minDate}
                  anchorEl={rowRefs.current[fieldKey + '_btn']}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
