// Small controlled inputs shared across the Programming form.
// Extracted 2026-08-30 from ProgrammingQuestionForm.tsx.
//
// TA — a plain `lms-textarea` with error / mono / rows props.
// NI — a text-typed number input that keeps its own display state so the
//      caller can render "" instead of the awkward "0" while typing; commits
//      to the outer number on every valid keystroke and clamps to `min` on
//      blur.

import React, { useState, useEffect } from 'react';

export const TA: React.FC<{
  value: string; onChange: (v: string) => void; onBlur?: () => void;
  placeholder?: string; rows?: number; mono?: boolean; err?: boolean; disabled?: boolean;
}> = ({ value, onChange, onBlur, placeholder, rows = 3, mono, err, disabled }) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    onBlur={onBlur}
    placeholder={placeholder}
    rows={rows}
    disabled={disabled}
    className={`lms-textarea${mono ? ' mono' : ''}${err ? ' err' : ''}`}
  />
);

export const NI: React.FC<{
  value: number; onChange: (v: number) => void; onBlur?: () => void;
  min?: number; max?: number; disabled?: boolean; cls?: string; err?: boolean;
}> = ({ value, onChange, onBlur, min = 0, max = 9999, disabled, cls = '', err }) => {
  const [v, sv] = useState(value === 0 ? '' : String(value));
  useEffect(() => { sv(value === 0 ? '' : String(value)); }, [value]);
  return (
    <input
      type="text"
      inputMode="numeric"
      value={v}
      disabled={disabled}
      onChange={e => {
        const r = e.target.value;
        if (/^\d*\.?\d*$/.test(r)) {
          sv(r);
          const n = parseFloat(r);
          if (!isNaN(n) && n >= min && n <= max) onChange(n);
          if (r === '') onChange(0);
        }
      }}
      onBlur={() => {
        const n = parseFloat(v);
        if (isNaN(n) || n < min) { sv(String(min)); onChange(min); }
        onBlur?.();
      }}
      className={`lms-input${err ? ' err' : ''} ${cls}`}
      style={{ width: cls.includes('w-') ? undefined : '100%' }}
    />
  );
};
