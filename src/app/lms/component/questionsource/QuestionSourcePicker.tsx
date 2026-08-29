// QuestionSourcePicker.tsx
// ─────────────────────────────────────────────────────────────────────────────
// One always-visible checkbox row for the "Question Source" step, shared by:
//
//   • ExerciseSettings.tsx (I_Do / We_Do assignment)  — the primary picker and
//                                                       the MCQ mirror in Combined
//   • youdo/assessments/QuestionSourceStep.tsx        — primary + MCQ mirror
//
// Before this the same three sources (Manual / AI / Other Platform) were
// offered TWICE in the UI: first as a 4-option dropdown (Manual / AI / Other /
// "Custom — combine two or more"), and — only if the trainer picked Custom —
// again as a chip row to combine two of the same three. That double-select was
// the complaint: the "Custom" option isn't a source at all, it's just a hint
// that the trainer wants more than one, so the picker should be a plain
// multi-select and derive Custom from "the trainer ticked more than one".
//
// STORAGE CONTRACT (unchanged):
//   0 checked   → { primary: '',         sub: [] }
//   1 checked   → { primary: <that one>, sub: [] }
//   2+ checked  → { primary: 'custom',   sub: [checked...] }
//
// Downstream (buildFullPayload, Manage Test → Add Question quotas, the custom
// distribution matrix, section-based per-part panels) all still read
// `questionSource` and `customSources`, so nothing there needs to change.
//
// A second variant handles the "MCQ Source" inside Combined, which carries an
// extra "Same as Programming" state (represented as primary: '' with sub: []).
// The picker exposes this as an OPTIONAL "Same as Programming" chip at the
// leftmost slot — ticking it clears every source chip; ticking any source
// chip auto-unticks it. That mirrors how the old dropdown had a distinct
// "Same as Programming" entry.

'use client';

import React, { useMemo } from 'react';
import { Check, FolderOpen, Info } from 'lucide-react';

export type QuestionSource = '' | 'scratch' | 'ai' | 'thirdParty' | 'custom';
export type CustomSubSource = 'scratch' | 'ai' | 'thirdParty';

export interface QuestionSourcePickerValue {
  primary: QuestionSource;
  sub: CustomSubSource[];
}

export interface QuestionSourceOption {
  value: CustomSubSource;
  label: string;
}

// Design tokens the callers already pass around (`D` in both wizards). Only
// the handful the picker actually reads, so callers don't need to invent extra
// fields to satisfy a wide interface.
export interface QuestionSourcePickerTokens {
  orange: string;
  border: string;
  textMain: string;
  textMuted: string;
  red: string;
}

interface Props {
  value: QuestionSourcePickerValue;
  onChange: (next: QuestionSourcePickerValue) => void;
  D: QuestionSourcePickerTokens;

  /**
   * Suppress "Other Platform" — pure MCQ contexts have no Other Platform
   * import path (MCQ question form only offers Manual / Bank / AI), so
   * offering it would dead-end at Manage Test. When true, an already-picked
   * `thirdParty` value is also stripped from the outgoing storage on next
   * onChange to keep the persisted state consistent.
   */
  hideThirdParty?: boolean;

  /**
   * Show an extra leftmost chip that means "inherit the source from another
   * picker" (empty state). Used for the MCQ mirror in Combined exercises so
   * the MCQ part can defer to whatever the Programming picker chose.
   * Clicking it clears every source chip. Clicking any source chip un-ticks
   * the inherit chip.
   */
  allowInherit?: boolean;
  inheritLabel?: string;

  /**
   * Header rendered on the left of the row. Callers pass "Question Source",
   * "Programming Source", or "MCQ Source" depending on context. If absent,
   * the row starts with the chips only.
   */
  label?: string;
  required?: boolean;

  /**
   * Text shown under the row while the picker holds no selection at all —
   * useful for the primary picker where an empty state blocks downstream
   * steps. Omit for the MCQ mirror (empty === "same as programming").
   */
  emptyHint?: string;

  /** Passthrough for host fonts (both wizards pin Poppins). */
  font?: string;

  /** Optional test-id for e2e. */
  testId?: string;
}

// ─── Derived-state helpers ───────────────────────────────────────────────────
//
// Kept as pure module-scope functions so callers can reuse them if they need
// to convert a raw payload into checkbox state without instantiating the
// component (e.g. seeding a form's initial state from a stored exercise doc).

/** Reduce a checkbox set to the (primary, sub) storage shape. */
export function checkedToStored(checked: CustomSubSource[]): QuestionSourcePickerValue {
  if (checked.length === 0) return { primary: '', sub: [] };
  if (checked.length === 1) return { primary: checked[0], sub: [] };
  return { primary: 'custom', sub: [...checked] };
}

/** Read the current stored value back into a checkbox set. */
export function storedToChecked(
  v: QuestionSourcePickerValue,
  opts?: { hideThirdParty?: boolean },
): CustomSubSource[] {
  let picks: CustomSubSource[];
  if (v.primary === 'custom') {
    picks = Array.isArray(v.sub) ? v.sub : [];
  } else if (v.primary === 'scratch' || v.primary === 'ai' || v.primary === 'thirdParty') {
    picks = [v.primary];
  } else {
    picks = [];
  }
  if (opts?.hideThirdParty) picks = picks.filter(p => p !== 'thirdParty');
  return picks;
}

// ─── Component ───────────────────────────────────────────────────────────────
export const QuestionSourcePicker: React.FC<Props> = ({
  value,
  onChange,
  D,
  hideThirdParty = false,
  allowInherit = false,
  inheritLabel = 'Same as Programming',
  label,
  required = false,
  emptyHint,
  font,
  testId,
}) => {
  const options: QuestionSourceOption[] = useMemo(
    () => [
      { value: 'scratch', label: 'Manual' },
      { value: 'ai', label: 'AI Automation' },
      ...(hideThirdParty ? [] : [{ value: 'thirdParty' as CustomSubSource, label: 'Other Platform' }]),
    ],
    [hideThirdParty],
  );

  const checked = useMemo(
    () => storedToChecked(value, { hideThirdParty }),
    [value, hideThirdParty],
  );

  // "inherit" only applies when the caller opted in AND nothing is checked.
  // When any source is ticked, the inherit chip becomes unticked visually.
  const isInheriting = allowInherit && checked.length === 0 && value.primary === '';

  const commit = (nextChecked: CustomSubSource[]) => {
    onChange(checkedToStored(nextChecked));
  };

  const toggle = (v: CustomSubSource) => {
    const next = checked.includes(v) ? checked.filter(x => x !== v) : [...checked, v];
    commit(next);
  };

  const setInherit = () => {
    // Inherit means "no source" for storage purposes — clear everything.
    // Deliberately not a toggle: the way to leave inherit is to tick a source
    // chip, so clicking the inherit chip only ever CLEARS (idempotent when
    // already inheriting).
    if (!isInheriting) commit([]);
  };

  // Spec checkbox row item — the chip chrome is gone: each option is a plain
  // 15×15 orange-accent checkbox with a 12.3px label (demo Checkbox metrics).
  const chipStyle = (on: boolean): React.CSSProperties => ({
    background: 'transparent',
    color: D.textMain,
    border: 'none',
    padding: 0,
    gap: 7,
    fontSize: 12.3,
    fontWeight: on ? 600 : 500,
    cursor: 'pointer',
    fontFamily: font,
  });

  const boxStyle = (on: boolean): React.CSSProperties => ({
    width: 15, height: 15, borderRadius: 4,
    border: `1px solid ${on ? D.orange : D.textMuted}`,
    background: on ? D.orange : '#fff',
    transition: 'all .15s',
  });

  return (
    // Spec card: 1px #E9E5E1 border, 11px radius, white body; the label rides
    // in a wash header (9px 13px, #FAF9F8, uppercase 11.2px/700 title).
    <div
      style={{
        fontFamily: font,
        border: '1px solid #E9E5E1',
        borderRadius: 11,
        background: '#fff',
        overflow: 'hidden',
      }}
      data-testid={testId}
    >
      {label && (
        <div
          className="flex items-center"
          style={{
            padding: '9px 13px', background: '#FAF9F8',
            borderBottom: '1px solid #F1EEEA', gap: 9,
          }}
        >
          <FolderOpen size={12} style={{ color: D.textMuted }} />
          <span
            style={{
              fontSize: 11.2, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: '#3F4756', fontFamily: font,
            }}
          >
            {label}
            {required && <span style={{ color: D.orange }}> *</span>}
          </span>
        </div>
      )}

      <div style={{ padding: 13 }}>
        {/* Source checkboxes — one row, 16px gaps. */}
        <div className="flex flex-wrap items-center" style={{ gap: 16 }}>
          {allowInherit && (
            <button
              type="button"
              aria-pressed={isInheriting}
              onClick={setInherit}
              className="inline-flex items-center"
              style={chipStyle(isInheriting)}
              title="Use whatever source is picked for the other part."
            >
              <span
                aria-hidden="true"
                className="inline-flex items-center justify-center flex-shrink-0 pointer-events-none"
                style={boxStyle(isInheriting)}
              >
                {isInheriting && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
              </span>
              {inheritLabel}
            </button>
          )}

          {options.map(opt => {
            const on = checked.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(opt.value)}
                className="inline-flex items-center"
                style={chipStyle(on)}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex items-center justify-center flex-shrink-0 pointer-events-none"
                  style={boxStyle(on)}
                >
                  {on && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Trailing hints — same copy the old dropdown-flow surfaced, just now
            driven off the derived state instead of the primary === 'custom'
            branch. When the trainer ticks two or more sources, the numeric
            distribution matrix rendered by the caller becomes required and
            shows a running total there; no need to repeat that here. */}
        {checked.length === 0 && !isInheriting && emptyHint && (
          <p className="mt-2" style={{ fontSize: 11.4, lineHeight: 1.5, color: D.textMuted }}>
            {emptyHint}
          </p>
        )}
        {checked.length >= 2 && (
          <div
            className="mt-2 flex items-start"
            style={{
              gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 11.4, lineHeight: 1.5,
              background: '#EFF6FF', border: '1px solid #CFE0FB', color: '#1B4DA8',
            }}
          >
            <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Combining {checked.length} sources — set the per-source count in the table below.</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionSourcePicker;
