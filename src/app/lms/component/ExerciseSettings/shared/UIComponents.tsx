import React, { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, ArrowUpRight, Calendar, Check,
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Info, Lock, Square,
} from 'lucide-react';
import { D, FONT } from './tokens';

// ─── InfoTooltip ─────────────────────────────────────────────────────────────
export const InfoTooltip: React.FC<{
  content: string;
  side?: 'top' | 'bottom' | 'left' | 'right';
}> = ({ content, side = 'top' }) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (show && btnRef.current && tipRef.current) {
      const b = btnRef.current.getBoundingClientRect();
      const t = tipRef.current.getBoundingClientRect();
      let left = 0, top = 0;
      if (side === 'top') { left = b.left + b.width / 2 - t.width / 2; top = b.top - t.height - 8; }
      else if (side === 'bottom') { left = b.left + b.width / 2 - t.width / 2; top = b.bottom + 8; }
      else if (side === 'left') { left = b.left - t.width - 8; top = b.top + b.height / 2 - t.height / 2; }
      else if (side === 'right') { left = b.right + 8; top = b.top + b.height / 2 - t.height / 2; }
      if (left + t.width > window.innerWidth - 10) left = window.innerWidth - t.width - 10;
      if (left < 10) left = 10;
      if (top + t.height > window.innerHeight - 10) top = window.innerHeight - t.height - 10;
      if (top < 10) top = 10;
      setPos({ left, top });
    }
  }, [show, side]);

  return (
    <div className="relative inline-block ml-1 align-middle">
      <button ref={btnRef} type="button"
        onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
        className="focus:outline-none transition-colors"
        style={{ color: D.textHint }}
        aria-label="Information">
        <Info size={12} />
      </button>
      {show && (
        <div ref={tipRef}
          className="fixed z-[9999] p-2.5 text-xs rounded-xl shadow-2xl leading-relaxed"
          style={{ left: pos.left, top: pos.top, maxWidth: 'min(280px,calc(100vw - 40px))', width: 'max-content', background: D.textMain, color: '#fff', fontFamily: FONT }}>
          {content}
        </div>
      )}
    </div>
  );
};

// ─── OInput ──────────────────────────────────────────────────────────────────
export const OInput: React.FC<{
  type?: 'text' | 'number' | 'textarea'; value: string | number; onChange: (v: string) => void;
  onBlur?: () => void; placeholder?: string; className?: string; disabled?: boolean;
  readOnly?: boolean; id?: string; error?: string; touched?: boolean;
}> = ({ type = 'text', value, onChange, onBlur, placeholder, className = '', disabled, readOnly, id, error, touched }) => {
  const [internal, setInternal] = useState(value.toString());
  const timer = useRef<NodeJS.Timeout | undefined>(undefined);

  const isFocused = useRef(false);
  useEffect(() => {
    if (!isFocused.current) {
      setInternal(value.toString());
    }
  }, [value]);
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInternal(e.target.value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(e.target.value), 50);
  };

  const baseClass = [
    'w-full px-3 py-2 text-sm rounded-lg border transition-all duration-150 outline-none',
    'font-sans',
    error && touched
      ? 'border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-1 focus:ring-red-100'
      : 'border-[#eef0f4] bg-white focus:border-[#E8640C] focus:ring-1 focus:ring-[rgba(232,100,12,0.10)]',
    disabled ? 'bg-[#f8fafc] text-[#94A3B8] cursor-not-allowed' : 'text-[#0F172A]',
    readOnly ? 'bg-[#f8fafc] cursor-default text-[#94A3B8]' : '',
    className,
  ].filter(Boolean).join(' ');

  if (type === 'textarea') return (
    <div className="w-full">
      <textarea
        value={internal}
        onChange={handleChange as any}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; onChange(internal); onBlur?.(); }}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        id={id}
        rows={2}
        className={baseClass + ' resize-none leading-relaxed'} />
      {error && touched && <p className="mt-1 text-xs" style={{ color: D.red }}>{error}</p>}
    </div>
  );
  return (
    <div className="w-full">
      <input
        type={type}
        value={internal}
        onChange={handleChange as any}
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; onChange(internal); onBlur?.(); }}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        id={id}
        className={baseClass} />
      {error && touched && <p className="mt-1 text-xs" style={{ color: D.red }}>{error}</p>}
    </div>
  );
};

// ─── ONumberInput ─────────────────────────────────────────────────────────────
export const ONumberInput: React.FC<{
  value: number; onChange: (v: number) => void; onBlur?: () => void;
  min?: number; max?: number; placeholder?: string; className?: string;
  id?: string; error?: string; touched?: boolean; disabled?: boolean; style?: React.CSSProperties;
  liveUpdate?: boolean;
}> = ({ value, onChange, onBlur, min = 0, max = 1000, placeholder, className = '', id, error, touched, disabled, style, liveUpdate = false }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState<string>(value === 0 ? '' : value.toString());
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value === 0 ? '' : value.toString());
    }
  }, [value, isFocused]);

  const handleFocus = () => { setIsFocused(true); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      setLocalValue(raw);
      if (liveUpdate) {
        if (raw === '') { onChange(0); }
        else {
          const parsed = parseFloat(raw);
          if (!isNaN(parsed) && parsed >= min && parsed <= max) onChange(parsed);
        }
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    let finalValue: number;
    const parsed = parseFloat(localValue);
    if (localValue === '' || localValue === '.' || isNaN(parsed)) finalValue = 0;
    else finalValue = Math.min(max, Math.max(min, parsed));
    const displayValue = finalValue === 0 ? '' : finalValue % 1 === 0 ? finalValue.toString() : finalValue.toFixed(2);
    setLocalValue(displayValue);
    if (finalValue !== value) onChange(finalValue);
    onBlur?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { handleBlur(); inputRef.current?.blur(); }
  };

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        id={id}
        disabled={disabled}
        style={style}
        className={[
          'w-full px-3 py-2 text-sm rounded-lg border transition-all duration-150 outline-none font-sans',
          error && touched
            ? 'border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-1 focus:ring-red-100'
            : 'border-[#eef0f4] bg-white focus:border-[#E8640C] focus:ring-1 focus:ring-[rgba(232,100,12,0.10)]',
          disabled ? 'bg-[#f8fafc] text-[#94A3B8] cursor-not-allowed' : 'text-[#0F172A]',
          className,
        ].filter(Boolean).join(' ')}
      />
      {error && touched && (
        <p className="mt-1 text-xs" style={{ color: D.red }}>{error}</p>
      )}
    </div>
  );
};

// ─── OToggle ──────────────────────────────────────────────────────────────────
export const OToggle: React.FC<{
  enabled: boolean; onChange: (v: boolean) => void;
  label?: string; description?: string; className?: string; inline?: boolean;
}> = ({ enabled, onChange, label, description, className = '', inline = false }) => (
  <div className={className}>
    <div className={`flex items-center ${inline ? 'gap-2.5' : 'justify-between'}`}>
      {label && <div className="text-sm font-semibold" style={{ color: D.textMain }}>{label}</div>}
      <button type="button" role="switch" aria-checked={enabled} onClick={() => onChange(!enabled)}
        className="relative inline-flex items-center h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 focus:outline-none p-[2px]"
        style={{ background: enabled ? D.orange : '#e5e7eb' }}>
        <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
      {inline && (
        <span className="text-[10px] font-bold" style={{ color: enabled ? D.emerald : D.red }}>
          {enabled ? 'On' : 'Off'}
        </span>
      )}
    </div>
    {description && <div className="text-xs mt-0.5 leading-relaxed" style={{ color: D.textMuted }}>{description}</div>}
  </div>
);

// ─── PortalDropdown ──────────────────────────────────────────────────────────
export const PortalDropdown: React.FC<{
  isOpen: boolean; onClose: () => void; triggerRef: React.RefObject<HTMLButtonElement>; children: React.ReactNode; minWidth?: number;
}> = ({ isOpen, onClose, triggerRef, children, minWidth }) => {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    }
  }, [isOpen, triggerRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('scroll', onClose, true);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('scroll', onClose, true); };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return typeof document !== 'undefined'
    ? require('react-dom').createPortal(
      <div ref={dropRef}
        style={{
          position: 'absolute', top: coords.top, left: coords.left,
          width: Math.max(coords.width, minWidth || 0), zIndex: 9999,
          background: D.bg, border: `1px solid ${D.border}`, borderRadius: 12,
          overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
        }}>
        {children}
      </div>,
      document.body
    )
    : null;
};

// ─── ExpandableSection ────────────────────────────────────────────────────────
export const ExpandableSection: React.FC<{
  id: string; title: string; subtitle: string; icon: React.ReactNode;
  isExpanded: boolean; onToggle: (id: string) => void; children: React.ReactNode;
  onCollapse?: () => void; headerExtra?: React.ReactNode; accent?: string;
}> = ({ id, title, subtitle, icon, isExpanded, onToggle, children, onCollapse, headerExtra, accent = D.orange }) => {
  const handleToggle = () => { if (isExpanded && onCollapse) onCollapse(); onToggle(id); };

  return (
    <div className="rounded-lg border overflow-hidden transition-all duration-200"
      style={{ borderColor: isExpanded ? accent + '40' : D.border, background: D.bg }}>
      <button type="button" onClick={handleToggle} aria-expanded={isExpanded}
        className="w-full flex items-center gap-2 px-3 py-2 text-left focus:outline-none transition-colors hover:bg-[#f8fafc]">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isExpanded ? accent + '15' : D.surface, color: isExpanded ? accent : D.textMuted }}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold" style={{ color: D.textMain, fontFamily: FONT }}>{title}</div>
          <div className="text-[10px]" style={{ color: D.textMuted }}>{subtitle}</div>
        </div>
        {headerExtra && <span className="flex-shrink-0" onClick={e => e.stopPropagation()}>{headerExtra}</span>}
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all duration-200"
          style={{ background: isExpanded ? accent + '15' : 'transparent', color: isExpanded ? accent : D.textMuted, transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <ChevronDown size={13} />
        </div>
      </button>
      {isExpanded && (
        <div className="border-t px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ borderColor: accent + '25', background: '#fdfcfc' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ─── TimePicker ───────────────────────────────────────────────────────────────
export const TimePicker: React.FC<{
  value: { hour: number; minute: number };
  onChange: (t: { hour: number; minute: number }) => void;
  disabled?: boolean;
  fieldKey?: string;
  currentDate?: { day: number; month: number; year: number };
  compareWithDate?: { day: number; month: number; year: number; hour: number; minute: number };
}> = ({ value, onChange, disabled, fieldKey, currentDate, compareWithDate }) => {
  const [open, setOpen] = useState(false);
  const [tempHour, setTempHour] = useState(value.hour);
  const [tempMinute, setTempMinute] = useState(value.minute);

  useEffect(() => { setTempHour(value.hour); setTempMinute(value.minute); }, [value]);

  const fmt = (h: number, m: number) => {
    const p = h >= 12 ? 'PM' : 'AM';
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${dh.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${p}`;
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const mins = Array.from({ length: 60 }, (_, i) => i);

  const isSameDay = useCallback((): boolean => {
    if (!compareWithDate || !currentDate) return false;
    return currentDate.day === compareWithDate.day &&
      currentDate.month === compareWithDate.month &&
      currentDate.year === compareWithDate.year;
  }, [currentDate, compareWithDate]);

  const isHourDisabled = (hour: number): boolean => {
    if (!compareWithDate || !currentDate) return false;
    if (isSameDay()) return hour < compareWithDate.hour;
    return false;
  };

  const isMinuteDisabled = (hour: number, minute: number): boolean => {
    if (!compareWithDate || !currentDate) return false;
    if (isSameDay()) {
      if (hour === compareWithDate.hour) return minute <= compareWithDate.minute;
      if (hour < compareWithDate.hour) return true;
    }
    return false;
  };

  const handleHourSelect = (hour: number) => {
    if (isHourDisabled(hour)) return;
    setTempHour(hour);
    if (isSameDay() && hour > compareWithDate!.hour) {
      setTempMinute(0);
      onChange({ hour, minute: 0 });
    } else if (isSameDay() && hour === compareWithDate!.hour) {
      const newMinute = compareWithDate!.minute + 1;
      setTempMinute(newMinute);
      onChange({ hour, minute: newMinute });
    } else {
      onChange({ hour, minute: tempMinute });
    }
  };

  const handleMinuteSelect = (minute: number) => {
    if (isMinuteDisabled(tempHour, minute)) return;
    setTempMinute(minute);
    onChange({ hour: tempHour, minute });
  };

  return (
    <div className="relative inline-block">
      <button type="button"
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-semibold transition-all"
        style={{
          borderColor: open ? D.orange : D.border,
          background: D.bg,
          color: D.textMain,
          fontFamily: FONT
        }}>
        <Clock size={13} style={{ color: D.orange }} />
        {fmt(value.hour, value.minute)}
        <ChevronDown size={11} style={{ color: D.textMuted, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {open && !disabled && (
        <div className="absolute top-full left-0 mt-2 p-3 rounded-xl shadow-2xl border z-50"
          style={{ background: D.bg, borderColor: D.border, width: 240 }}>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: D.textMuted }}>Hour</div>
              <div className="h-28 overflow-y-auto rounded-lg border" style={{ borderColor: D.border }}>
                {hours.map(hour => {
                  const active = tempHour === hour;
                  const isDisabled = isHourDisabled(hour);
                  const dh = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                  const p = hour >= 12 ? 'PM' : 'AM';
                  const isCompareHour = isSameDay() && hour === compareWithDate?.hour;
                  return (
                    <button key={hour}
                      onClick={() => handleHourSelect(hour)}
                      disabled={isDisabled}
                      className="w-full text-left px-2 py-1 text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: active ? D.orangeLight : 'transparent',
                        color: active ? D.orange : isDisabled ? D.textHint : D.textSub,
                        fontWeight: active ? 700 : 500,
                        fontFamily: FONT,
                        borderLeft: isCompareHour && !active ? `2px solid ${D.orange}` : 'none'
                      }}>
                      {`${dh}:00 ${p}`}
                      {isCompareHour && !active && (
                        <span className="ml-1 text-[8px]" style={{ color: D.orange }}>(after)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: D.textMuted }}>Minute</div>
              <div className="h-28 overflow-y-auto rounded-lg border" style={{ borderColor: D.border }}>
                {mins.map(minute => {
                  const active = tempMinute === minute;
                  const isDisabled = isMinuteDisabled(tempHour, minute);
                  const isFirstEnabledMinute = isSameDay() &&
                    tempHour === compareWithDate?.hour &&
                    minute === (compareWithDate?.minute ?? -2) + 1;
                  return (
                    <button key={minute}
                      onClick={() => handleMinuteSelect(minute)}
                      disabled={isDisabled}
                      className="w-full text-left px-2 py-1 text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      style={{
                        background: active ? D.orangeLight : 'transparent',
                        color: active ? D.orange : isDisabled ? D.textHint : D.textSub,
                        fontWeight: active ? 700 : 500,
                        fontFamily: FONT,
                        borderTop: isFirstEnabledMinute ? `1px dashed ${D.orange}` : 'none'
                      }}>
                      {String(minute).padStart(2, '0')}
                      {isFirstEnabledMinute && (
                        <span className="ml-1 text-[8px]" style={{ color: D.orange }}>✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {isSameDay() && (
            <div className="mt-2 pt-2 text-[10px] border-t" style={{ borderColor: D.border, color: D.orange }}>
              ⏰ Available times must be after {String(compareWithDate!.hour).padStart(2, '0')}:{String(compareWithDate!.minute).padStart(2, '0')}
            </div>
          )}
          <div className="mt-2 pt-2 flex justify-between border-t" style={{ borderColor: D.border }}>
            <button
              onClick={() => {
                const n = new Date();
                const newHour = n.getHours();
                const newMinute = n.getMinutes();
                if (isSameDay()) {
                  if (newHour > compareWithDate!.hour ||
                    (newHour === compareWithDate!.hour && newMinute > compareWithDate!.minute)) {
                    onChange({ hour: newHour, minute: newMinute });
                    setTempHour(newHour); setTempMinute(newMinute);
                    setOpen(false);
                  }
                } else {
                  onChange({ hour: newHour, minute: newMinute });
                  setTempHour(newHour); setTempMinute(newMinute);
                  setOpen(false);
                }
              }}
              className="text-xs font-bold transition-colors"
              style={{ color: D.orange }}>
              Now
            </button>
            <button onClick={() => setOpen(false)} className="text-xs font-medium" style={{ color: D.textMuted }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── SectionLabel ────────────────────────────────────────────────────────────
export const SectionLabel: React.FC<{ children: React.ReactNode; required?: boolean; info?: string }> = ({ children, required, info }) => (
  <div className="flex items-center gap-1 mb-1">
    <label className="text-xs font-semibold" style={{ color: D.textSub, fontFamily: FONT }}>{children}</label>
    {required && <span className="text-xs font-bold" style={{ color: D.orange }}>*</span>}
    {info && <InfoTooltip content={info} />}
  </div>
);

// ─── ODropdown ────────────────────────────────────────────────────────────────
export const ODropdown: React.FC<{
  value: string; options: { label: string; value: string }[]; onChange: (v: string) => void;
  placeholder?: string; disabled?: boolean; error?: string; touched?: boolean; className?: string;
}> = ({ value, options, onChange, placeholder = 'Select…', disabled, error, touched, className = '' }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = options.find(o => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <button ref={btnRef} type="button" onClick={() => !disabled && setOpen(v => !v)} disabled={disabled}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm font-semibold text-left transition-all outline-none"
        style={{
          borderColor: open ? D.orange : error && touched ? D.red : D.border,
          background: disabled ? D.surface : D.bg,
          color: selected ? D.textMain : D.textMuted,
          fontFamily: FONT,
          boxShadow: open ? `0 0 0 2px ${D.orangeLight}` : '',
        }}>
        <span className="truncate">{selected?.label || placeholder}</span>
        {!disabled && <ChevronDown size={14} style={{ color: D.textMuted, flexShrink: 0, transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />}
        {disabled && <Lock size={12} style={{ color: D.textMuted, flexShrink: 0 }} />}
      </button>
      {error && touched && <p className="mt-1 text-xs" style={{ color: D.red }}>{error}</p>}
      <PortalDropdown isOpen={open} onClose={() => setOpen(false)} triggerRef={btnRef}>
        <div className="py-1">
          {options.map(opt => (
            <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm font-semibold flex items-center justify-between transition-colors hover:bg-[#f8fafc]"
              style={{ color: value === opt.value ? D.orange : D.textSub, fontFamily: FONT }}>
              {opt.label}
              {value === opt.value && <Check size={13} style={{ color: D.orange }} />}
            </button>
          ))}
        </div>
      </PortalDropdown>
    </div>
  );
};

// ─── SpinField — tiny up/down number spinner ──────────────────────────────────
export const SpinField: React.FC<{
  value: number; min: number; max: number; width?: number;
  disabled?: boolean; onChange: (v: number) => void; pad?: number;
}> = ({ value, min, max, width = 38, disabled, onChange, pad = 2 }) => {
  const [raw, setRaw] = useState(value === 0 ? '' : String(value).padStart(pad, '0'));
  useEffect(() => { setRaw(value === 0 ? '' : String(value).padStart(pad, '0')); }, [value, pad]);

  const commit = (v: string) => {
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= min && n <= max) onChange(n);
    else setRaw(value === 0 ? '' : String(value).padStart(pad, '0'));
  };

  return (
    <div className="flex flex-col items-center" style={{ width }}>
      <button type="button" disabled={disabled}
        onClick={() => { const n = (value || min) < max ? (value || min) + 1 : min; onChange(n); }}
        className="w-full flex items-center justify-center h-4 rounded-t border-x border-t transition-colors hover:bg-[#f8fafc] disabled:opacity-40"
        style={{ borderColor: D.border }}>
        <ChevronUp size={9} style={{ color: D.textMuted }} />
      </button>
      <input
        type="text" inputMode="numeric" value={raw} disabled={disabled}
        onChange={e => setRaw(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(raw); }}
        className="w-full text-center border-x text-[11px] font-bold py-0.5 outline-none transition-all disabled:opacity-40"
        style={{ borderColor: D.border, color: D.textMain, background: disabled ? D.surface : '#fff', fontFamily: FONT }}
      />
      <button type="button" disabled={disabled}
        onClick={() => { const n = (value || min) > min ? (value || min) - 1 : max; onChange(n); }}
        className="w-full flex items-center justify-center h-4 rounded-b border-x border-b transition-colors hover:bg-[#f8fafc] disabled:opacity-40"
        style={{ borderColor: D.border }}>
        <ChevronDown size={9} style={{ color: D.textMuted }} />
      </button>
    </div>
  );
};

// ─── MonthDropField — inline month dropdown ───────────────────────────────────
export const MonthDropField: React.FC<{ value: number; disabled?: boolean; onChange: (v: number) => void }> = ({ value, disabled, onChange }) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return (
    <select
      value={value || ''}
      disabled={disabled}
      onChange={e => onChange(parseInt(e.target.value, 10))}
      className="border rounded text-[11px] font-bold px-1 py-0 h-[46px] outline-none transition-all disabled:opacity-40 cursor-pointer"
      style={{ borderColor: D.border, color: value ? D.textMain : D.textMuted, background: disabled ? D.surface : '#fff', fontFamily: FONT, width: 80 }}
    >
      <option value="">Month</option>
      {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
    </select>
  );
};

// ─── DateRowPicker ────────────────────────────────────────────────────────────
export const DateRowPicker: React.FC<{
  label: string; fieldKey: string; icon: string; color: string; toggleable: boolean;
  data: any; isEnabled: boolean; activePicker: { field: string | null; type: string | null };
  setActivePicker: (v: { field: string | null; type: string | null }) => void;
  onUpdate: (field: string, type: string, value: any) => void;
  onToggleEnable: () => void;
  hasError?: string; isTouched: boolean;
  generateCalendarDays: (year: number, month: number) => (number | null)[];
  isDateDisabled: (year: number, month: number, day: number, fieldKey: string) => boolean;
  isEmptyDate?: boolean; tooltip?: string;
}> = ({
  label, fieldKey, icon, color, toggleable, data, isEnabled, activePicker,
  setActivePicker, onUpdate, onToggleEnable, hasError, isTouched,
  generateCalendarDays, isDateDisabled, isEmptyDate = false, tooltip
}) => {
  const [calMonth, setCalMonth] = useState(data?.month && !isNaN(data.month) ? Number(data.month) : new Date().getMonth() + 1);
  const [calYear, setCalYear] = useState(data?.year && !isNaN(data.year) ? Number(data.year) : new Date().getFullYear());
  const calBtnRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const monthsFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const day = data?.day ?? 0;
  const month = data?.month ?? 0;
  const year = data?.year ?? 0;
  const hour = data?.hour ?? 0;
  const minute = data?.minute ?? 0;

  const isOpen = (type: string) => activePicker?.field === fieldKey && activePicker?.type === type;
  const closePicker = () => setActivePicker({ field: null, type: null });

  useEffect(() => {
    if (!isOpen('date')) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        calBtnRef.current && !calBtnRef.current.contains(e.target as Node)) closePicker();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen('date')]);

  const [pickerPos, setPickerPos] = useState<'top' | 'bottom'>('bottom');
  useEffect(() => {
    if (isOpen('date') && calBtnRef.current) {
      const r = calBtnRef.current.getBoundingClientRect();
      setPickerPos(window.innerHeight - r.bottom < 320 && r.top > 320 ? 'top' : 'bottom');
    }
  }, [isOpen('date')]);

  return (
    <div className="transition-all duration-200 relative overflow-visible"
      style={{
        background: !isEnabled ? D.surface : '#fff',
        opacity: !isEnabled ? 0.65 : 1,
      }}>
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap">
        {toggleable && (
          <button type="button" onClick={onToggleEnable}
            className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
            style={{ background: isEnabled ? D.orange : '#e5e7eb' }}>
            <span className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${isEnabled ? 'translate-x-[17px]' : 'translate-x-0'}`} />
          </button>
        )}
        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: color + '12', color }}>
          {icon === '▶' && <ArrowRight size={11} />}
          {icon === '⏹' && <Square size={11} />}
          {icon === '↗' && <ArrowUpRight size={11} />}
        </div>
        <div className="w-[130px] flex-shrink-0 flex items-center gap-0.5">
          <div className="text-[11px] font-bold leading-tight"
            style={{ color: isEnabled ? '#000000' : D.textMuted, fontFamily: FONT }}>
            {label}
          </div>
          {tooltip && <InfoTooltip content={tooltip} side="right" />}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <SpinField value={day} min={1} max={31} width={36} disabled={!isEnabled} pad={2}
            onChange={v => onUpdate(fieldKey, 'day', v)} />
          <MonthDropField value={month} disabled={!isEnabled}
            onChange={v => onUpdate(fieldKey, 'month', v)} />
          <SpinField value={year} min={2020} max={2099} width={50} disabled={!isEnabled} pad={4}
            onChange={v => onUpdate(fieldKey, 'year', v)} />
          <div className="w-px h-8 flex-shrink-0 mx-0.5" style={{ background: D.border }} />
          <SpinField value={hour} min={0} max={23} width={34} disabled={!isEnabled} pad={2}
            onChange={v => onUpdate(fieldKey, 'hour', v)} />
          <span className="text-sm font-bold flex-shrink-0" style={{ color: D.textMuted }}>:</span>
          <SpinField value={minute} min={0} max={59} width={34} disabled={!isEnabled} pad={2}
            onChange={v => onUpdate(fieldKey, 'minute', v)} />
          <button
            ref={calBtnRef}
            type="button"
            disabled={!isEnabled}
            onClick={() => {
              if (!isEnabled) return;
              setCalMonth(month > 0 ? month : new Date().getMonth() + 1);
              setCalYear(year > 0 ? year : new Date().getFullYear());
              setActivePicker(isOpen('date') ? { field: null, type: null } : { field: fieldKey, type: 'date' });
            }}
            className="w-8 h-[46px] rounded-lg flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
            style={{
              border: 'none',
              background: isOpen('date') ? color + '10' : D.surface,
              color: isEnabled ? color : D.textMuted,
            }}>
            <Calendar size={13} />
          </button>
        </div>
      </div>
      {isOpen('date') && (
        <div ref={pickerRef}
          className="fixed z-[200] p-3 rounded-xl shadow-2xl"
          style={{
            background: D.bg, width: 270,
            top: calBtnRef.current
              ? (pickerPos === 'bottom'
                ? calBtnRef.current.getBoundingClientRect().bottom + window.scrollY + 6
                : calBtnRef.current.getBoundingClientRect().top + window.scrollY - 326)
              : 'auto',
            left: calBtnRef.current
              ? Math.min(Math.max(calBtnRef.current.getBoundingClientRect().left + window.scrollX - 220, 10), window.innerWidth - 280)
              : 'auto',
          }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => { if (calMonth === 1) { setCalMonth(12); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-[#f4f5f7]" style={{ color: D.textMuted }}>
              <ChevronLeft size={13} />
            </button>
            <span className="text-xs font-bold" style={{ color: '#000000', fontFamily: FONT }}>
              {monthsFull[calMonth - 1]} {calYear}
            </span>
            <button onClick={() => { if (calMonth === 12) { setCalMonth(1); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
              className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-[#f4f5f7]" style={{ color: D.textMuted }}>
              <ChevronRight size={13} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-center text-[9px] font-bold py-0.5" style={{ color: D.textHint }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {generateCalendarDays(calYear, calMonth).map((d, idx) => {
              const dis = d ? isDateDisabled(calYear, calMonth, d, fieldKey) : false;
              const sel = data?.day === d && data?.month === calMonth && data?.year === calYear;
              return (
                <button key={idx}
                  onClick={() => {
                    if (d && !dis) {
                      onUpdate(fieldKey, 'day', d);
                      onUpdate(fieldKey, 'month', calMonth);
                      onUpdate(fieldKey, 'year', calYear);
                      closePicker();
                    }
                  }}
                  disabled={!d || dis}
                  className="h-7 w-7 mx-auto text-[11px] rounded-lg flex items-center justify-center transition-all"
                  style={{
                    background: sel ? color : 'transparent',
                    color: sel ? '#fff' : dis ? D.textHint : '#000000',
                    cursor: !d || dis ? 'default' : 'pointer',
                    fontWeight: sel ? 700 : 500,
                    fontFamily: FONT,
                  }}>
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-2 pt-2 flex justify-between" style={{ borderTop: 'none' }}>
            <button onClick={closePicker} className="text-xs font-bold" style={{ color: D.textMuted }}>Close</button>
            <button
              onClick={() => {
                const t = new Date();
                onUpdate(fieldKey, 'day', t.getDate());
                onUpdate(fieldKey, 'month', t.getMonth() + 1);
                onUpdate(fieldKey, 'year', t.getFullYear());
                onUpdate(fieldKey, 'hour', t.getHours());
                onUpdate(fieldKey, 'minute', t.getMinutes());
                closePicker();
              }}
              className="text-xs font-bold" style={{ color }}>
              Today
            </button>
          </div>
        </div>
      )}
      {hasError && isTouched && (
        <div className="px-3 pb-2 flex items-center gap-1.5" style={{ color: D.red }}>
          <AlertCircle size={11} /><p className="text-xs">{hasError}</p>
        </div>
      )}
    </div>
  );
};

// ─── GradeRow ────────────────────────────────────────────────────────────────
// Module-level so its component identity is stable across renders — placing it
// inside a callback would cause ONumberInput to remount between keystrokes.
export const GradeRow = React.memo(({
  icon, color, label, info, fieldKey, value, onChange, onBlur,
  autoValue, error, errorTouched, optional,
}: {
  icon: React.ReactNode; color: string; label: string; info: string;
  fieldKey?: string;
  value?: number | null; onChange?: (v: number) => void; onBlur?: () => void;
  autoValue?: number | string; error?: string; errorTouched?: boolean;
  optional?: boolean;
}) => (
  <div className="flex items-center justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: D.border }}>
    <div className="flex items-center gap-2.5 flex-1 mr-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: color + '12', color }}>{icon}</div>
      <div>
        <div className="flex items-center gap-0.5">
          <span className="text-xs font-semibold" style={{ color: D.textMain, fontFamily: FONT }}>{label}</span>
          {!autoValue && !optional && <span className="text-xs font-bold" style={{ color: D.orange }}>*</span>}
          <InfoTooltip content={info} side="right" />
        </div>
        {error && errorTouched && <p className="text-[10.5px] mt-0.5" style={{ color: D.red }}>{error}</p>}
      </div>
    </div>
    <div className="w-32 flex-shrink-0">
      {autoValue !== undefined ? (
        <div className="relative">
          <input disabled value={autoValue} placeholder="Auto"
            className="w-full px-3 py-1.5 text-sm rounded-lg border"
            style={{ borderColor: D.border, background: D.surface, color: D.textMuted }} />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: D.orange }}>Auto</span>
        </div>
      ) : (
        <ONumberInput
          value={value ?? 0}
          onChange={onChange!}
          onBlur={onBlur}
          placeholder="0"
          error={error}
          touched={errorTouched}
        />
      )}
    </div>
  </div>
));
GradeRow.displayName = 'GradeRow';
