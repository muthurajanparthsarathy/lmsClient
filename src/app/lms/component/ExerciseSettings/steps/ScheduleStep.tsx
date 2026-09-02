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

const fmtDateTime = (v: DV) => {
  if (!hasDate(v)) return '';
  const h = v.hour, m = v.minute;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${MONTHS_SHORT[v.month - 1]} ${v.day}, ${v.year}, ${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
};

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
const Spinner: React.FC<{ value: number; max: number; onChange: (v: number) => void }> = ({ value, max, onChange }) => (
  <div className="flex flex-col items-center gap-0.5">
    <button type="button"
      onClick={() => onChange(value >= max ? 0 : value + 1)}
      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
      <ChevronUp size={12} style={{ color: D.orange }} />
    </button>
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
      style={{ background: D.orange, fontSize: 12 }}>
      {String(value).padStart(2, '0')}
    </div>
    <button type="button"
      onClick={() => onChange(value <= 0 ? max : value - 1)}
      className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 transition-colors">
      <ChevronDown size={12} style={{ color: D.orange }} />
    </button>
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
  const [hour, setHour]           = useState(value.hour);
  const [minute, setMinute]       = useState(value.minute);
  const popRef                    = useRef<HTMLDivElement>(null);
  const [pos, setPos]             = useState<React.CSSProperties>({ position: 'fixed', top: -9999, left: -9999, zIndex: 9999, visibility: 'hidden' });

  useEffect(() => {
    if (!anchorEl || !popRef.current) return;
    const frame = requestAnimationFrame(() => {
      if (!anchorEl || !popRef.current) return;
      const r  = anchorEl.getBoundingClientRect();
      const pw = 360;
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
    onConfirm({ day: selDay, month: selMonth, year: selYear, hour, minute });
    onClose();
  };

  const selVal: DV = { day: selDay, month: selMonth, year: selYear, hour, minute };

  return (
    <div ref={popRef}
      style={{ ...pos, border: `1px solid ${D.border2}`, borderRadius: 11, boxShadow: '0 12px 32px rgba(15,23,42,.14)' }}
      className="bg-white w-[360px] overflow-hidden select-none">
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
        <div className="w-24 flex flex-col items-center justify-center gap-2 px-2 py-2">
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: D.textMuted }}>TIME</span>
          <div className="flex items-center gap-1">
            <Spinner value={hour}   max={23} onChange={setHour} />
            <span className="text-sm font-bold" style={{ color: D.orange }}>:</span>
            <Spinner value={minute} max={59} onChange={setMinute} />
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
    setValidationErrors((prev: any) => {
      const n = { ...prev };
      if (key === 'startDate')       delete n.startDate;
      if (key === 'endDate')         delete n.endDate;
      if (key === 'cutOffDate')      delete (n as any).cutOffDate;
      if (key === 'gracePeriodDate') delete n.gracePeriod;
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
                  <span className="inline-flex items-center" style={{ gap: 4, marginLeft: 8 }}>
                    <SegInput value={val.hour}   placeholder="HH" min={0} max={23} onChange={h => setDV(fieldKey, { ...val, hour: h })} />
                    <span style={{ fontSize: 12, color: D.textHint, fontWeight: 500 }}>:</span>
                    <SegInput value={val.minute} placeholder="MM" min={0} max={59} onChange={m => setDV(fieldKey, { ...val, minute: m })} />
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
