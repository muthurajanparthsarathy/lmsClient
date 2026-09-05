import { getToken } from "@/lib/session";
import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Calendar, Clock, Lock, Bell,
  ChevronUp, ChevronDown, Check, ShieldCheck, AlertCircle,
} from 'lucide-react';
import { D, FONT } from '../shared/tokens';
import { InfoTooltip } from '../shared/UIComponents';
import { fetchApprovalHierarchy, type ApprovalStep } from '@/apiServices/userService';
import {
  to12, from12, formatDateTime12, formatTime12,
  type Period,
} from '@/app/lms/shared/time12';

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
type DV = { day: number; month: number; year: number; hour: number; minute: number };
const EMPTY_DV: DV = { day: 0, month: 0, year: 0, hour: 0, minute: 0 };
const hasDate = (v: DV) => v.day > 0 && v.month > 0 && v.year > 0;
const dvToDate = (v: DV): Date | null =>
  hasDate(v) ? new Date(v.year, v.month - 1, v.day, v.hour, v.minute) : null;
const dateToDV = (d: Date): DV => ({
  day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(),
  hour: d.getHours(), minute: d.getMinutes(),
});
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

// ── SegInput: editable DD/MM/YYYY/HH/MM segment ─────────────────────────────
const SegInput: React.FC<{
  value: number; placeholder: string; min: number; max: number; onChange: (v: number) => void;
}> = ({ value, placeholder, min, max, onChange }) => {
  const pad = placeholder.length;
  const [raw, setRaw] = useState(value > 0 ? String(value).padStart(pad, '0') : '');
  useEffect(() => { setRaw(value > 0 ? String(value).padStart(pad, '0') : ''); }, [value, pad]);
  return (
    <input
      type="text" inputMode="numeric" value={raw} placeholder={placeholder} maxLength={pad}
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
      className="text-center font-medium bg-white outline-none transition-colors"
      style={{
        width: pad === 4 ? 50 : 34, height: 30, fontSize: 12, borderRadius: 6,
        border: '1px solid #D0D5DD', color: '#101828', fontFamily: FONT, padding: '0 4px',
      }}
      onFocus={e => { e.target.style.borderColor = D.orange; e.target.style.boxShadow = '0 0 0 2px rgba(255,90,18,.13)'; }}
      onBlurCapture={e => { e.target.style.borderColor = '#D0D5DD'; e.target.style.boxShadow = 'none'; }}
    />
  );
};

// ── Spinner (up/down + value in orange circle) ──────────────────────────────
// `min` defaults to 0 so existing MINUTE call sites (0..59) still wrap
// cleanly through zero. Callers that need a 1-based range (HOUR12 = 1..12)
// pass min=1, which makes the wrap boundary min ↔ max instead of 0 ↔ max.
const Spinner: React.FC<{
  value: number; max: number; min?: number; onChange: (v: number) => void;
  labelPad?: number;
}> = ({ value, max, min = 0, onChange, labelPad = 2 }) => (
  <div className="flex flex-col items-center gap-0.5">
    <button type="button"
      onClick={() => onChange(value >= max ? min : value + 1)}
      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
      <ChevronUp size={12} style={{ color: D.orange }} />
    </button>
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
      style={{ background: D.orange, fontSize: 12 }}>
      {String(value).padStart(labelPad, '0')}
    </div>
    <button type="button"
      onClick={() => onChange(value <= min ? max : value - 1)}
      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
      <ChevronDown size={12} style={{ color: D.orange }} />
    </button>
  </div>
);

// ── PERIOD segmented AM/PM ──────────────────────────────────────────────────
// Two-button vertical pill (AM on top / PM on bottom) so it fits alongside
// the HOUR + MINUTE spinner columns without stealing horizontal space in
// the narrow TIME pane. Selected = filled orange; unselected = plain.
const PeriodSelector: React.FC<{ value: Period; onChange: (p: Period) => void }> = ({
  value, onChange,
}) => (
  <div
    className="inline-flex overflow-hidden select-none"
    role="group"
    aria-label="AM or PM"
    style={{ border: `1px solid #E4E7EC`, borderRadius: 999, height: 30 }}
  >
    {(['AM', 'PM'] as const).map((p) => {
      const selected = value === p;
      return (
        <button
          key={p}
          type="button"
          aria-pressed={selected}
          onClick={() => onChange(p)}
          style={{
            padding: '0 12px', minWidth: 40, height: '100%', border: 'none',
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
  useEffect(() => { setRangeError(null); }, [hour, minute, /* day + month + year handled below */]);
  const popRef                    = useRef<HTMLDivElement>(null);
  const [pos, setPos]             = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, zIndex: 9999, visibility: 'hidden' });

  useEffect(() => {
    if (!anchorEl || !popRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (!anchorEl || !popRef.current) return;
      const r  = anchorEl.getBoundingClientRect();
      // Wider popup (was 360 px) to fit HOUR + MINUTE + PERIOD side-by-side.
      const pw = 440;
      const ph = popRef.current.offsetHeight || 360;
      let left = r.right + 8;
      if (left + pw > window.innerWidth - 8) left = r.left - pw - 8;
      left = Math.max(8, left);
      let top = r.top;
      top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));
      setPos({ position: 'fixed', top, left, zIndex: 9999, visibility: 'visible' });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchorEl]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (anchorEl?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [anchorEl, onClose]);

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
    if (minDate) {
      const picked = new Date(selYear, selMonth - 1, selDay, hour, minute);
      if (picked < minDate) {
        setRangeError(`Must be on or after ${formatDateTime12(minDate)}`);
        return;
      }
    }
    onConfirm({ day: selDay, month: selMonth, year: selYear, hour, minute });
    onClose();
  };

  const selVal: DV = { day: selDay, month: selMonth, year: selYear, hour, minute };

  return (
    <div ref={popRef}
      style={{ ...pos, border: `1px solid ${D.border2}`, borderRadius: 11, boxShadow: '0 12px 32px rgba(15,23,42,.14)' }}
      className="bg-white w-[440px] overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: D.border }}>
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: D.orangeLight }}>
          <Calendar size={11} style={{ color: D.orange }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: D.textMuted }}>Setting:</span>
        <span className="text-xs font-bold truncate" style={{ color: D.orange }}>{fieldLabel}</span>
      </div>
      {/* Body */}
      <div className="flex" style={{ borderBottom: `1px solid ${D.border}` }}>
        <div className="flex-1 px-3 py-2" style={{ borderRight: `1px solid ${D.border}` }}>
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 text-sm font-bold" style={{ color: D.textMuted }}>‹</button>
            <span className="text-xs font-bold" style={{ color: D.textMain }}>{MONTHS_FULL[calMonth - 1]} {calYear}</span>
            <button onClick={nextMonth} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 text-sm font-bold" style={{ color: D.textMuted }}>›</button>
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
                  className="h-7 w-7 rounded-lg flex items-center justify-center mx-auto transition-all"
                  style={{
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
              behind the scenes so downstream Date math is unaffected. */}
        <div className="flex flex-col items-center justify-center gap-2 px-3 py-2" style={{ width: 168 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: D.textMuted }}>TIME</span>
          <div className="flex items-start justify-center gap-2">
            <div className="flex flex-col items-center">
              <span style={{ fontSize: 8.5, fontWeight: 700, color: D.textMuted, letterSpacing: '.08em', marginBottom: 2 }}>HOUR</span>
              <Spinner value={h12} min={1} max={12} onChange={setH12} />
            </div>
            <span className="text-sm font-bold self-center" style={{ color: D.orange, marginTop: 12 }}>:</span>
            <div className="flex flex-col items-center">
              <span style={{ fontSize: 8.5, fontWeight: 700, color: D.textMuted, letterSpacing: '.08em', marginBottom: 2 }}>MINUTE</span>
              <Spinner value={minute} min={0} max={59} onChange={setMinute} />
            </div>
            <div className="flex flex-col items-center" style={{ marginLeft: 4 }}>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: D.textMuted, letterSpacing: '.08em', marginBottom: 2 }}>PERIOD</span>
              <PeriodSelector value={period} onChange={setPeriod} />
            </div>
          </div>
        </div>
      </div>
      {/* Selected banner */}
      <div className="mx-3 my-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: D.orangeLight }}>
        <Check size={11} style={{ color: D.orange }} />
        <span className="text-xs font-semibold truncate" style={{ color: D.orange }}>
          {selDay ? fmtDateTime(selVal) : 'No date selected'}
        </span>
      </div>
      {/* Inline range-error line — only shows when Confirm tried to close
          on an out-of-range time (see confirm() above). */}
      {rangeError && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: '#FEF3F2', border: '1px solid #FBD3CE' }}>
          <AlertCircle size={11} style={{ color: '#B42318' }} />
          <span className="text-xs font-semibold truncate" style={{ color: '#B42318' }}>{rangeError}</span>
        </div>
      )}
      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-2.5">
        <button onClick={setNow} className="text-xs font-semibold" style={{ color: D.orange }}>Now</button>
        <button onClick={onClose} className="text-xs font-semibold" style={{ color: D.textMuted }}>Cancel</button>
        <button onClick={confirm} disabled={!selDay}
          className="inline-flex items-center justify-center text-white transition-all"
          style={{ height: 29, padding: '0 10px', borderRadius: 8, fontSize: 11.5, fontWeight: 600, background: '#0F172A', opacity: selDay ? 1 : 0.45, cursor: selDay ? 'pointer' : 'not-allowed' }}>
          Confirm
        </button>
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
    setDV(key, dateToDV(new Date(base.getTime() + ms)));
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
    <div style={{ padding: '16px 32px 24px', maxWidth: 1200, fontFamily: FONT }}>
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

          return (
            <div
              key={fieldKey}
              ref={el => { rowRefs.current[fieldKey] = el; }}
              className="flex items-center flex-wrap relative"
              style={{
                gap: 12,
                paddingTop: 14, paddingBottom: 14,
                minHeight: 72,
                borderBottom: idx < FIELDS.length - 1 ? `1px solid ${D.border}` : 'none',
              }}
            >
              {/* Icon tile */}
              <div
                className="flex items-center justify-center flex-shrink-0"
                style={{ width: 36, height: 36, background: iconBg, color: iconColor, borderRadius: 8 }}
              >
                {icon}
              </div>

              {/* Label */}
              <div className="flex items-center" style={{ gap: 4, minWidth: 220 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: FONT }}>{label}</span>
                {required && <span style={{ fontSize: 11, fontWeight: 700, color: D.orange }}>*</span>}
                {tooltip && <InfoTooltip content={tooltip} side="right" />}
              </div>

              {/* Toggle */}
              {toggleable && (
                <SpecSwitch on={enabled} onClick={() => toggleField(enabledKey)} />
              )}

              {/* Date/time row */}
              {enabled ? (
                <div className="flex items-center flex-wrap" style={{ gap: 6 }}>
                  <span className="inline-flex items-center" style={{ gap: 4 }}>
                    <SegInput value={val.day}   placeholder="DD"   min={1}    max={31}   onChange={d => setDV(fieldKey, { ...val, day: d })} />
                    <span style={{ fontSize: 12, color: D.textHint, fontWeight: 500 }}>/</span>
                    <SegInput value={val.month} placeholder="MM"   min={1}    max={12}   onChange={m => setDV(fieldKey, { ...val, month: m })} />
                    <span style={{ fontSize: 12, color: D.textHint, fontWeight: 500 }}>/</span>
                    <SegInput value={val.year}  placeholder="YYYY" min={2020} max={2099} onChange={y => setDV(fieldKey, { ...val, year: y })} />
                  </span>
                  {/* Time row is now 12-hour with a small AM/PM chip.
                      The underlying `val.hour` stays 24-hour so the
                      parent's storage + downstream `dvToDate` /
                      `.toISOString()` UTC conversion don't change; we
                      only re-project into 12h at the input boundary. */}
                  <span className="inline-flex items-center" style={{ gap: 4, marginLeft: 8 }}>
                    {(() => {
                      const t = to12(val.hour || 0);
                      return (
                        <>
                          <SegInput
                            value={t.h12}
                            placeholder="HH"
                            min={1}
                            max={12}
                            onChange={h12 => setDV(fieldKey, { ...val, hour: from12({ h12, period: t.period }) })}
                          />
                          <span style={{ fontSize: 12, color: D.textHint, fontWeight: 500 }}>:</span>
                          <SegInput
                            value={val.minute}
                            placeholder="MM"
                            min={0}
                            max={59}
                            onChange={m => setDV(fieldKey, { ...val, minute: m })}
                          />
                          <div
                            className="inline-flex overflow-hidden"
                            role="group"
                            aria-label="AM or PM"
                            style={{ border: '1px solid #D0D5DD', borderRadius: 6, marginLeft: 4, height: 30 }}
                          >
                            {(['AM', 'PM'] as const).map((p) => {
                              const selected = t.period === p;
                              return (
                                <button
                                  key={p}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => setDV(fieldKey, { ...val, hour: from12({ h12: t.h12 || 12, period: p }) })}
                                  style={{
                                    height: '100%', minWidth: 30, padding: '0 8px', border: 'none',
                                    background: selected ? D.orange : '#fff',
                                    color: selected ? '#fff' : D.textMuted,
                                    fontWeight: 700, fontSize: 11, letterSpacing: '.02em',
                                    cursor: 'pointer', fontFamily: FONT,
                                  }}
                                >
                                  {p}
                                </button>
                              );
                            })}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 500, color: D.textHint, marginLeft: 6 }} title="12-hour clock — flip AM/PM to switch">
                            {formatTime12(val.hour || 0, val.minute || 0)}
                          </span>
                        </>
                      );
                    })()}
                  </span>
                  <button
                    ref={el => { rowRefs.current[fieldKey + '_btn'] = el as HTMLDivElement | null; }}
                    type="button"
                    onClick={() => setOpenField(isOpen ? null : fieldKey)}
                    className="flex items-center justify-center transition-all flex-shrink-0"
                    style={{
                      width: 30, height: 30, borderRadius: 6, marginLeft: 4,
                      background: isOpen ? D.orange : '#fff',
                      color: isOpen ? '#fff' : D.textMuted,
                      border: `1px solid ${isOpen ? D.orange : '#D0D5DD'}`,
                      cursor: 'pointer',
                    }}
                  >
                    <Calendar size={13} />
                  </button>

                  {showOffsets && (
                    <div className="flex items-center flex-wrap" style={{ gap: 4, marginLeft: 6 }}>
                      {QUICK_OFFSETS.map(o => (
                        <button
                          key={o.label}
                          type="button"
                          disabled={!canOffset}
                          onClick={() => applyOffset(fieldKey, o.ms)}
                          title={offsetBase
                            ? `Set to ${o.label} after ${fmtDateTime(dateToDV(offsetBase))}`
                            : 'Fill the previous date first'}
                          className="inline-flex items-center transition-all"
                          style={{
                            height: 26, padding: '0 10px', borderRadius: 999,
                            fontSize: 11, fontWeight: 600,
                            background: '#F4F4F5', border: '1px solid #E7E5E4', color: '#57606E',
                            opacity: canOffset ? 1 : 0.45,
                            cursor: canOffset ? 'pointer' : 'not-allowed',
                            fontFamily: FONT,
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
                </div>
              ) : (
                <div className="flex items-center" style={{ gap: 6, fontSize: 11.4, color: D.textMuted }}>
                  <Lock size={12} />
                  <span>Disabled</span>
                </div>
              )}

              {/* Error */}
              {error && touched && (
                <span style={{ fontSize: 11.4, color: D.red, marginLeft: 4 }}>{error}</span>
              )}

              {/* Popup */}
              {isOpen && enabled && (
                <CalendarPopup
                  fieldLabel={label}
                  value={val}
                  onConfirm={v => { setDV(fieldKey, v); setOpenField(null); }}
                  onClose={() => setOpenField(null)}
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
