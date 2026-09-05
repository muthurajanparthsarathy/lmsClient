import { getToken } from "@/lib/session";
// ScheduleStep.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Calendar, Clock, Lock, Bell, ChevronUp, ChevronDown, Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { D, generateCalendarDays } from './constants';
import { FormDataType, ValidationErrors } from './types';
import { InfoTooltip } from './UIComponents';
import { fetchApprovalHierarchy, type ApprovalStep } from '@/apiServices/userService';
// Shared 12-hour helpers — see client/src/app/lms/shared/time12.ts.
// Same import as the orange sibling so both files render identical
// preview strings and share the same input clamps + AM/PM conversion.
import {
  to12, from12, formatDateTime12, formatTime12,
  type Period,
} from '@/app/lms/shared/time12';

interface ScheduleStepProps {
  formData: FormDataType;
  setFormData: React.Dispatch<React.SetStateAction<FormDataType>>;
  setValidationErrors: React.Dispatch<React.SetStateAction<ValidationErrors>>;
  validationErrors: ValidationErrors;
  touchedFields: Set<string>;
  isEditing: boolean;
  courseId?: string;
}

type DateValue = { day: number; month: number; year: number; hour: number; minute: number };
const EMPTY: DateValue = { day: 0, month: 0, year: 0, hour: 0, minute: 0 };
const hasDate = (v: DateValue) => v.day > 0 && v.month > 0 && v.year > 0;

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const GRN = '#10b981';
const GRN_LIGHT = 'rgba(16,185,129,0.10)';

// Preview banner format lives in the shared 12h helper so orange +
// green ScheduleSteps + the student assessments list all render the
// same string ("Sep 3, 2026, 6:09 PM" — no leading zero on hour).
const fmtDateTime = (v: DateValue) => formatDateTime12(hasDate(v) ? v : null);

// ── Editable segment input (DD, MM, YYYY, HH, MM) ───────────────────────────
const SegInput: React.FC<{
  value: number;           // 0 = empty
  placeholder: string;    // 'DD' | 'MM' | 'YYYY' | 'HH' | 'MM'
  min: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ value, placeholder, min, max, onChange }) => {
  const pad = placeholder.length;
  const [raw, setRaw] = useState(value > 0 ? String(value).padStart(pad, '0') : '');

  useEffect(() => {
    setRaw(value > 0 ? String(value).padStart(pad, '0') : '');
  }, [value, pad]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={raw}
      placeholder={placeholder}
      maxLength={pad}
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
      className="text-center font-semibold bg-white rounded-md outline-none transition-colors"
      style={{
        width: pad === 4 ? 42 : 26,
        height: 24,
        fontSize: 11,
        border: '1.5px solid #ecedf1',
        color: '#1a1a2e',
      }}
      onFocus={e => (e.target.style.borderColor = GRN)}
      onBlurCapture={e => (e.target.style.borderColor = '#ecedf1')}
    />
  );
};

// ── Spinner (up/down arrows + value in green circle) ─────────────────────────
// `min` defaults to 0 (matches MINUTE 0..59). HOUR12 callers pass min=1 so
// the wrap boundary flips 12 ↔ 1 instead of 12 ↔ 0.
const Spinner: React.FC<{
  value: number; max: number; min?: number; onChange: (v: number) => void;
}> = ({ value, max, min = 0, onChange }) => (
  <div className="flex flex-col items-center gap-0.5">
    <button
      type="button"
      onClick={() => onChange(value >= max ? min : value + 1)}
      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
    >
      <ChevronUp size={12} style={{ color: GRN }} />
    </button>
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
      style={{ background: GRN, fontSize: 12 }}
    >
      {String(value).padStart(2, '0')}
    </div>
    <button
      type="button"
      onClick={() => onChange(value <= min ? max : value - 1)}
      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
    >
      <ChevronDown size={12} style={{ color: GRN }} />
    </button>
  </div>
);

// ── PERIOD segmented AM/PM (green theme) ────────────────────────────────────
const PeriodSelector: React.FC<{ value: Period; onChange: (p: Period) => void }> = ({
  value, onChange,
}) => (
  <div
    className="inline-flex overflow-hidden select-none"
    role="group"
    aria-label="AM or PM"
    style={{ border: `1px solid #ecedf1`, borderRadius: 999, height: 30 }}
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
            background: selected ? GRN : '#fff',
            color: selected ? '#fff' : '#6b6b7e',
            fontWeight: 700, fontSize: 11.5, letterSpacing: '.02em',
            cursor: 'pointer',
          }}
        >
          {p}
        </button>
      );
    })}
  </div>
);

// ── Calendar Popup ────────────────────────────────────────────────────────────
interface CalendarPopupProps {
  fieldLabel: string;
  value: DateValue;
  onConfirm: (v: DateValue) => void;
  onClose: () => void;
  minDate?: Date;
  anchorEl: HTMLElement | null;
}

const CalendarPopup: React.FC<CalendarPopupProps> = ({ fieldLabel, value, onConfirm, onClose, minDate, anchorEl }) => {
  const [calMonth, setCalMonth]     = useState(hasDate(value) ? value.month     : new Date().getMonth() + 1);
  const [calYear, setCalYear]       = useState(hasDate(value) ? value.year      : new Date().getFullYear());
  const [selDay, setSelDay]         = useState(hasDate(value) ? value.day       : 0);
  const [selMonth, setSelMonth]     = useState(hasDate(value) ? value.month     : 0);
  const [selYear, setSelYear]       = useState(hasDate(value) ? value.year      : 0);
  // Internal 24-hour storage, but the picker only shows the 12-hour view.
  const [hour, setHour]             = useState(value.hour);   // 0..23
  const [minute, setMinute]         = useState(value.minute); // 0..59
  const { h12, period }             = to12(hour);
  const setH12 = (n: number) => setHour(from12({ h12: n, period }));
  const setPeriod = (p: Period) => setHour(from12({ h12, period: p }));
  const [rangeError, setRangeError] = useState<string | null>(null);
  useEffect(() => { setRangeError(null); }, [hour, minute]);
  const popRef                      = useRef<HTMLDivElement>(null);
  const [pos, setPos]               = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, zIndex: 9999, visibility: 'hidden' });

  // Two-pass positioning: first render off-screen, then measure real height and snap into place
  useEffect(() => {
    if (!anchorEl || !popRef.current) return;
    // Let the browser paint once so offsetHeight is accurate
    const frame = requestAnimationFrame(() => {
      if (!anchorEl || !popRef.current) return;
      const r  = anchorEl.getBoundingClientRect();
      // Wider (was 360) to fit HOUR + MINUTE + PERIOD side by side.
      const pw = 440;
      const ph = popRef.current.offsetHeight || 360;   // real rendered height

      // Prefer right of anchor; flip left if no room
      let left = r.right + 8;
      if (left + pw > window.innerWidth - 8) left = r.left - pw - 8;
      left = Math.max(8, left);

      // Align popup top with anchor top; clamp so it never bleeds off screen
      let top = r.top;
      top = Math.max(8, Math.min(top, window.innerHeight - ph - 8));

      setPos({ position: 'fixed', top, left, zIndex: 9999, visibility: 'visible' });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchorEl]);

  // Outside click
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

  const prevMonth = () => calMonth === 1 ? (setCalMonth(12), setCalYear(y => y-1)) : setCalMonth(m => m-1);
  const nextMonth = () => calMonth === 12 ? (setCalMonth(1), setCalYear(y => y+1)) : setCalMonth(m => m+1);

  const today = new Date();
  const days = generateCalendarDays(calYear, calMonth);

  const selectDay = (day: number) => {
    if (isDisabled(day)) return;
    setSelDay(day); setSelMonth(calMonth); setSelYear(calYear);
  };

  const setNow = () => {
    const n = new Date();
    if (minDate && n < minDate) return;
    setSelDay(n.getDate()); setSelMonth(n.getMonth()+1); setSelYear(n.getFullYear());
    setCalMonth(n.getMonth()+1); setCalYear(n.getFullYear());
    setHour(n.getHours()); setMinute(n.getMinutes());
  };

  const confirm = () => {
    if (!selDay) return;
    // Time-aware minDate check — same guard as the orange sibling so a
    // same-day time earlier than minDate can't slip past Confirm.
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

  const selVal: DateValue = { day: selDay, month: selMonth, year: selYear, hour, minute };

  return (
    <div ref={popRef} style={pos} className="bg-white rounded-xl shadow-2xl border border-[#ecedf1] w-[440px] overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#ecedf1]">
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: GRN_LIGHT }}>
          <Calendar size={11} style={{ color: GRN }} />
        </div>
        <span className="text-xs font-semibold text-[#6b6b7e]">Setting:</span>
        <span className="text-xs font-bold truncate" style={{ color: GRN }}>{fieldLabel}</span>
      </div>

      {/* Body: calendar left + time right */}
      <div className="flex divide-x divide-[#ecedf1]">
        {/* Calendar */}
        <div className="flex-1 px-3 py-2">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 text-[#6b6b7e] text-sm font-bold">‹</button>
            <span className="text-xs font-bold text-[#1a1a2e]">{MONTHS_FULL[calMonth-1]} {calYear}</span>
            <button onClick={nextMonth} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-gray-100 text-[#6b6b7e] text-sm font-bold">›</button>
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
              const disabled   = isDisabled(day);
              const isSelected = selDay === day && selMonth === calMonth && selYear === calYear;
              const isToday    = day === today.getDate() && calMonth === today.getMonth()+1 && calYear === today.getFullYear();
              return (
                <button
                  key={idx}
                  onClick={() => selectDay(day)}
                  disabled={disabled}
                  className="h-7 w-7 rounded-lg flex items-center justify-center mx-auto transition-all"
                  style={{
                    fontSize: 10,
                    background: isSelected ? GRN : 'transparent',
                    color: isSelected ? '#fff' : disabled ? '#d1d5db' : '#1a1a2e',
                    fontWeight: isToday && !isSelected ? 700 : 400,
                    outline: isToday && !isSelected ? `2px solid ${GRN}` : 'none',
                    outlineOffset: '-2px',
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* TIME pane — three explicit columns per the target image:
              HOUR (1-12), MINUTE (00-59), PERIOD (AM/PM segmented). */}
        <div className="flex flex-col items-center justify-center gap-2 px-3 py-2" style={{ width: 168 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: D.textMuted }}>TIME</span>
          <div className="flex items-start justify-center gap-2">
            <div className="flex flex-col items-center">
              <span style={{ fontSize: 8.5, fontWeight: 700, color: D.textMuted, letterSpacing: '.08em', marginBottom: 2 }}>HOUR</span>
              <Spinner value={h12} min={1} max={12} onChange={setH12} />
            </div>
            <span className="text-sm font-bold self-center" style={{ color: GRN, marginTop: 12 }}>:</span>
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

      {/* Selected date banner */}
      <div className="mx-3 mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: GRN_LIGHT }}>
        <Check size={11} style={{ color: GRN }} />
        <span className="text-xs font-semibold truncate" style={{ color: GRN }}>
          {selDay ? fmtDateTime(selVal) : 'No date selected'}
        </span>
      </div>
      {rangeError && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: '#FEF3F2', border: '1px solid #FBD3CE' }}>
          <AlertCircle size={11} style={{ color: '#B42318' }} />
          <span className="text-xs font-semibold truncate" style={{ color: '#B42318' }}>{rangeError}</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-2.5">
        <button onClick={setNow} className="text-xs font-semibold" style={{ color: D.orange }}>Now</button>
        <button onClick={onClose} className="text-xs font-semibold text-[#6b6b7e]">Cancel</button>
        <button
          onClick={confirm}
          disabled={!selDay}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-all"
          style={{ background: selDay ? GRN : '#d1d5db' }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
};

// ── Helpers: DateValue ↔ Date ────────────────────────────────────────────────
const dvToDate = (v: DateValue): Date | null =>
  hasDate(v) ? new Date(v.year, v.month - 1, v.day, v.hour, v.minute) : null;
const dateToDV = (d: Date): DateValue => ({
  day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(),
  hour: d.getHours(), minute: d.getMinutes(),
});

// Quick offset presets — applied relative to the previous row's date.
const QUICK_OFFSETS: { label: string; ms: number }[] = [
  { label: '+30m', ms: 30 * 60 * 1000 },
  { label: '+1h',  ms: 60 * 60 * 1000 },
  { label: '+2h',  ms: 2 * 60 * 60 * 1000 },
  { label: '+1d',  ms: 24 * 60 * 60 * 1000 },
  { label: '+1w',  ms: 7 * 24 * 60 * 60 * 1000 },
];

// ── Schedule Step ─────────────────────────────────────────────────────────────
export const ScheduleStep: React.FC<ScheduleStepProps> = ({
  formData, setFormData, setValidationErrors, validationErrors, touchedFields, isEditing, courseId,
}) => {
  const [openField, setOpenField] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const approvalOn = !!(formData.schedule as any).requiresAdminApproval;
  const params = useParams() as any;
  const searchParams = useSearchParams();
  const routeCourseId = (typeof params?.id === 'string' ? params.id : null)
    || searchParams?.get('courseId')
    || null;
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

  useEffect(() => {
    setValidationErrors((prev: any) => {
      const n = { ...prev };
      const empty = approvalOn && !approvalLoading && Array.isArray(approvalSteps) && approvalSteps.length === 0;
      if (empty) (n as any).approvalHierarchy = 'Course has no Approval Hierarchy configured.';
      else delete (n as any).approvalHierarchy;
      return n;
    });
  }, [approvalOn, approvalLoading, approvalSteps, setValidationErrors]);

  const get = useCallback((key: string): DateValue => (formData.schedule as any)[key] || EMPTY, [formData.schedule]);

  const set = useCallback((key: string, val: DateValue) => {
    setFormData(prev => ({ ...prev, schedule: { ...prev.schedule, [key]: val } }));
    setValidationErrors(prev => {
      const n: any = { ...prev };
      if (key === 'startDate')      delete n.startDate;
      if (key === 'endDate')        delete n.endDate;
      if (key === 'cutOffDate')     delete n.cutOffDate;
      if (key === 'gracePeriodDate') delete n.gracePeriod;
      // End > Start / Cut-off ≥ End / Grace ≥ End|Cut-off — inline edits
      // bypass the CalendarPopup guard, so re-check here.
      const nextSched: any = { ...(formData as any).schedule, [key]: val };
      const toMs = (v: DateValue) => hasDate(v) ? dvToDate(v)!.getTime() : null;
      const startMs = toMs(nextSched.startDate || EMPTY);
      const endMs   = toMs(nextSched.endDate   || EMPTY);
      const cutMs   = toMs(nextSched.cutOffDate|| EMPTY);
      const graceMs = toMs(nextSched.gracePeriodDate || EMPTY);
      if (key === 'endDate' && startMs != null && endMs != null && endMs <= startMs) {
        n.endDate = 'End date & time must be later than Start.';
      }
      if (key === 'cutOffDate' && endMs != null && cutMs != null && cutMs < endMs) {
        n.cutOffDate = 'Cut-off must be on or after End.';
      }
      if (key === 'gracePeriodDate' && graceMs != null) {
        const floor = cutMs ?? endMs;
        if (floor != null && graceMs < floor) n.gracePeriod = 'Grace deadline must be on or after End / Cut-off.';
      }
      return n;
    });
  }, [setFormData, setValidationErrors, formData]);

  // The "base" date a quick-offset chip is added to.
  // endDate offsets from startDate; cutOffDate offsets from endDate;
  // gracePeriodDate offsets from cutOffDate (if enabled) else endDate.
  const getOffsetBase = useCallback((fieldKey: string): Date | null => {
    if (fieldKey === 'endDate')         return dvToDate(get('startDate'));
    if (fieldKey === 'cutOffDate')      return dvToDate(get('endDate'));
    if (fieldKey === 'gracePeriodDate') {
      const co = (formData.schedule as any).cutOffEnabled ? dvToDate(get('cutOffDate')) : null;
      return co ?? dvToDate(get('endDate'));
    }
    return null;
  }, [get, formData.schedule]);

  const applyOffset = useCallback((fieldKey: string, ms: number) => {
    const base = getOffsetBase(fieldKey);
    if (!base) return;
    set(fieldKey, dateToDV(new Date(base.getTime() + ms)));
  }, [getOffsetBase, set]);

  const toggle = useCallback((enabledKey: string) => {
    setFormData(prev => ({
      ...prev,
      schedule: { ...prev.schedule, [enabledKey]: !(prev.schedule as any)[enabledKey] },
    }));
  }, [setFormData]);

  const getMinDate = useCallback((key: string): Date | undefined => {
    const now = new Date();
    if (key === 'startDate') return isEditing ? undefined : now;
    if (key === 'endDate') {
      const s = get('startDate');
      // End must be at least 30 minutes after Start.
      return hasDate(s)
        ? new Date(s.year, s.month-1, s.day, s.hour, s.minute + 30)
        : (isEditing ? undefined : now);
    }
    if (key === 'cutOffDate') {
      const e = get('endDate');
      return hasDate(e) ? new Date(e.year, e.month-1, e.day, e.hour, e.minute) : undefined;
    }
    if (key === 'gracePeriodDate') {
      const c = get('cutOffDate');
      if (hasDate(c)) return new Date(c.year, c.month-1, c.day, c.hour, c.minute);
      const e = get('endDate');
      return hasDate(e) ? new Date(e.year, e.month-1, e.day, e.hour, e.minute) : undefined;
    }
  }, [get, isEditing]);

  const getError = (key: string) => {
    if (key === 'startDate')       return validationErrors.startDate;
    if (key === 'endDate')         return validationErrors.endDate;
    if (key === 'cutOffDate')      return (validationErrors as any).cutOffDate;
    if (key === 'gracePeriodDate') return validationErrors.gracePeriod;
  };

  const FIELDS = [
    { label: 'Start Date & Time',   fieldKey: 'startDate',      icon: <Calendar size={15} />, iconColor: D.emerald,  iconBg: 'rgba(16,185,129,0.10)', toggleable: false, enabledKey: '',                  required: true,  tooltip: 'The date from which students can start submitting.',     showOffsets: false },
    { label: 'End Date & Time',     fieldKey: 'endDate',        icon: <Clock size={15} />,    iconColor: D.amber,    iconBg: 'rgba(245,158,11,0.10)',  toggleable: false, enabledKey: '',                  required: true,  tooltip: 'The submission deadline. Quick-add adds time after start.', showOffsets: true  },
    { label: 'Cut-off Date & Time', fieldKey: 'cutOffDate',     icon: <Lock size={15} />,     iconColor: D.red,      iconBg: 'rgba(239,68,68,0.10)',   toggleable: true,  enabledKey: 'cutOffEnabled',      required: false, tooltip: 'Optional hard late boundary after end date.',            showOffsets: true  },
    { label: 'Remind Me to Mark By',fieldKey: 'gracePeriodDate',icon: <Bell size={15} />,     iconColor: D.purple,   iconBg: 'rgba(139,92,246,0.10)', toggleable: true,  enabledKey: 'gracePeriodEnabled', required: false, tooltip: 'Reminder to finish grading by this date.',               showOffsets: true  },
  ] as const;

  return (
    <div className="px-10 pt-4 pb-6">
      <div className="divide-y divide-[#eef0f4]">
        {/* Approval — sequential approval gate driven by course Approval Hierarchy. */}
        <div className="flex flex-col gap-2 py-3 relative">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(251,146,60,0.10)', color: '#fb923c' }}
            >
              <ShieldCheck size={15} />
            </div>
            <div className="flex items-center gap-1 w-40 flex-shrink-0">
              <span className="text-xs font-semibold text-[#1a1a2e]">Requires Approval</span>
              <InfoTooltip
                content="When ON, students see this assessment only after every approver in the course's Approval Hierarchy approves."
                side="right"
              />
            </div>
            <button
              type="button"
              onClick={() => toggle('requiresAdminApproval')}
              className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full p-[2px] transition-colors duration-200"
              style={{ background: approvalOn ? GRN : '#e2e3e8' }}
            >
              <span className={`inline-block h-[13px] w-[13px] rounded-full bg-white shadow transition-transform duration-200 ${approvalOn ? 'translate-x-[17px]' : 'translate-x-0'}`} />
            </button>
            <span className="text-xs font-semibold" style={{ color: approvalOn ? GRN : D.textMuted }}>
              {approvalOn ? 'Yes' : 'No'}
            </span>
          </div>

          {approvalOn && (
            <div className="ml-11 space-y-2">
              {approvalLoading && (
                <span className="text-xs" style={{ color: D.textMuted }}>Loading approvers…</span>
              )}
              {!approvalLoading && approvalSteps && approvalSteps.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {approvalSteps.map((s: any, i: number) => (
                    <React.Fragment key={s.roleId || i}>
                      {i > 0 && <span className="text-xs" style={{ color: D.textHint }}>→</span>}
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                        style={{ background: '#eef2ff', borderColor: '#c7d2fe', color: '#4338ca' }}
                      >
                        {i + 1}. {s.roleName}
                      </span>
                    </React.Fragment>
                  ))}
                  <span className="text-[11px] ml-1" style={{ color: D.textMuted }}>→ Students</span>
                </div>
              )}
              {!approvalLoading && Array.isArray(approvalSteps) && approvalSteps.length === 0 && (
                <div
                  className="flex items-start gap-1.5 text-xs px-2 py-1.5 rounded-md"
                  style={{ background: 'rgba(239,68,68,0.08)', color: D.red }}
                >
                  <AlertCircle size={12} className="mt-[1px] flex-shrink-0" />
                  <span>
                    Course has no Approval Hierarchy configured. Configure it on the course participants page first.
                  </span>
                </div>
              )}

              {/* Approval scope */}
              <div className="pt-1">
                <div className="text-[11px] font-semibold mb-1" style={{ color: D.textMuted }}>
                  What should approvers review?
                </div>
                <div className="flex flex-col gap-1">
                  {([
                    { val: 'settings', label: 'Settings only', hint: 'Schedule, grade, notifications, security, etc.' },
                    { val: 'settings_and_questions', label: 'Settings + Questions', hint: 'Everything above plus the actual question content.' },
                  ] as const).map(({ val, label, hint }) => {
                    const selected = ((formData.schedule as any).approvalScope || 'settings') === val;
                    return (
                      <label
                        key={val}
                        className="flex items-start gap-2 cursor-pointer p-1.5 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        <input
                          type="radio"
                          name="approvalScope-asm"
                          checked={selected}
                          onChange={() => setFormData((prev: any) => ({
                            ...prev,
                            schedule: { ...prev.schedule, approvalScope: val },
                          }))}
                          className="mt-[2px]"
                          style={{ accentColor: GRN }}
                        />
                        <span>
                          <span className="text-xs font-semibold text-[#1a1a2e]">{label}</span>
                          <span className="block text-[11px]" style={{ color: D.textMuted }}>{hint}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
        {FIELDS.map(({ label, fieldKey, icon, iconColor, iconBg, toggleable, enabledKey, required, tooltip, showOffsets }) => {
          const enabled  = !toggleable || !!(formData.schedule as any)[enabledKey];
          const val      = get(fieldKey);
          const hasDt    = hasDate(val);
          const error    = getError(fieldKey);
          const touched  = touchedFields.has(fieldKey === 'gracePeriodDate' ? 'gracePeriod' : fieldKey);
          const isOpen   = openField === fieldKey;
          const offsetBase = showOffsets ? getOffsetBase(fieldKey) : null;
          const canOffset  = showOffsets && enabled && !!offsetBase;

          return (
            <div
              key={fieldKey}
              ref={el => { rowRefs.current[fieldKey] = el; }}
              className="flex items-center gap-3 py-3 relative"
            >
              {/* Icon */}
              <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: iconColor }}>
                {icon}
              </div>

              {/* Label */}
              <div className="flex items-center gap-1 w-40 flex-shrink-0">
                <span className="text-xs font-semibold text-[#1a1a2e]">{label}</span>
                {required && <span className="text-xs font-bold" style={{ color: D.orange }}>*</span>}
                {tooltip && <InfoTooltip content={tooltip} side="right" />}
              </div>

              {/* Toggle (optional fields) */}
              {toggleable && (
                <button
                  type="button"
                  onClick={() => toggle(enabledKey)}
                  className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full p-[2px] transition-colors duration-200"
                  style={{ background: enabled ? D.orange : '#e2e3e8' }}
                >
                  <span className={`inline-block h-[13px] w-[13px] rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-[17px]' : 'translate-x-0'}`} />
                </button>
              )}

              {/* Date/time display OR disabled */}
              {enabled ? (
                <div className="flex items-center gap-1">
                  {/* DD / MM / YYYY — editable inputs */}
                  <span className="inline-flex items-center gap-1">
                    <SegInput value={val.day}   placeholder="DD"   min={1} max={31} onChange={d => set(fieldKey, { ...val, day: d })} />
                    <span className="text-[#9b9bae] text-xs font-bold">/</span>
                    <SegInput value={val.month} placeholder="MM"   min={1} max={12} onChange={m => set(fieldKey, { ...val, month: m })} />
                    <span className="text-[#9b9bae] text-xs font-bold">/</span>
                    <SegInput value={val.year}  placeholder="YYYY" min={2020} max={2099} onChange={y => set(fieldKey, { ...val, year: y })} />
                  </span>

                  {/* HH : MM — editable inputs */}
                  <span className="inline-flex items-center gap-1 ml-2">
                    {/* Hour is now 12h with an AM/PM chip; storage stays 24h so
                        downstream Date + UTC serialization is unaffected. */}
                    {(() => {
                      const t = to12(val.hour || 0);
                      return (
                        <>
                          <SegInput value={t.h12} placeholder="HH" min={1} max={12}
                            onChange={h12 => set(fieldKey, { ...val, hour: from12({ h12, period: t.period }) })} />
                        </>
                      );
                    })()}
                    <span className="text-[#9b9bae] text-xs font-bold">:</span>
                    <SegInput value={val.minute} placeholder="MM" min={0} max={59} onChange={m => set(fieldKey, { ...val, minute: m })} />
                    {/* AM/PM chip — flips the 24h stored hour without changing minute. */}
                    {(() => {
                      const t = to12(val.hour || 0);
                      return (
                        <div
                          className="inline-flex overflow-hidden ml-1"
                          role="group"
                          aria-label="AM or PM"
                          style={{ border: '1px solid #ecedf1', borderRadius: 6, height: 24 }}
                        >
                          {(['AM', 'PM'] as const).map((p) => {
                            const selected = t.period === p;
                            return (
                              <button
                                key={p}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => set(fieldKey, { ...val, hour: from12({ h12: t.h12 || 12, period: p }) })}
                                style={{
                                  height: '100%', minWidth: 26, padding: '0 6px', border: 'none',
                                  background: selected ? GRN : '#fff',
                                  color: selected ? '#fff' : '#6b6b7e',
                                  fontWeight: 700, fontSize: 10.5, letterSpacing: '.02em',
                                  cursor: 'pointer',
                                }}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                    <span className="text-[11px] text-[#9b9bae] ml-1" title="12-hour clock — flip AM/PM to switch">
                      {formatTime12(val.hour || 0, val.minute || 0)}
                    </span>
                  </span>

                  {/* Calendar icon button — triggers popup */}
                  <button
                    ref={el => { rowRefs.current[fieldKey + '_btn'] = el as HTMLDivElement | null; }}
                    type="button"
                    onClick={() => setOpenField(isOpen ? null : fieldKey)}
                    className="ml-2 w-8 h-8 rounded-xl flex items-center justify-center border transition-all flex-shrink-0"
                    style={{
                      background: isOpen ? GRN : '#f4f4f6',
                      color: isOpen ? '#fff' : '#6b6b7e',
                      borderColor: isOpen ? GRN : D.border,
                    }}
                  >
                    <Calendar size={14} />
                  </button>

                  {/* Quick-offset chips: auto-fill date relative to prior step */}
                  {showOffsets && (
                    <div className="ml-2 flex items-center gap-1 flex-wrap">
                      {QUICK_OFFSETS.map(o => (
                        <button
                          key={o.label}
                          type="button"
                          disabled={!canOffset}
                          onClick={() => applyOffset(fieldKey, o.ms)}
                          title={offsetBase
                            ? `Set to ${o.label} after ${fmtDateTime(dateToDV(offsetBase))}`
                            : 'Fill the previous date first'}
                          className="px-1.5 h-5 rounded-md border font-semibold transition-all"
                          style={{
                            fontSize: 10,
                            background: canOffset ? '#fff' : '#f8f9fb',
                            color: canOffset ? iconColor : D.textHint,
                            borderColor: canOffset ? iconColor + '55' : D.border,
                            cursor: canOffset ? 'pointer' : 'not-allowed',
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs" style={{ color: D.textMuted }}>
                  <Lock size={12} />
                  <span>Disabled</span>
                </div>
              )}

              {/* Validation error */}
              {error && touched && (
                <span className="text-xs ml-1" style={{ color: D.red }}>{error}</span>
              )}

              {/* Calendar popup — anchored to the calendar icon button */}
              {isOpen && enabled && (
                <CalendarPopup
                  fieldLabel={label}
                  value={val}
                  onConfirm={v => { set(fieldKey, v); setOpenField(null); }}
                  onClose={() => setOpenField(null)}
                  minDate={getMinDate(fieldKey)}
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
