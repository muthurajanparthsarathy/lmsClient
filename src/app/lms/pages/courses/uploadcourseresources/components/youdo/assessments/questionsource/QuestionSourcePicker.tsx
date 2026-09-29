// QuestionSourcePicker.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The "Question Source" step — a row of compact selectable option tiles,
// shared by:
//
//   • ExerciseSettings.tsx (I_Do / We_Do assignment)  — the primary picker and
//                                                       the MCQ mirror in Combined
//   • youdo/assessments/QuestionSourceStep.tsx        — primary + MCQ mirror
//
// STORAGE CONTRACT (unchanged from the checkbox-row version this replaced):
//   0 checked   → { primary: '',         sub: [] }
//   1 checked   → { primary: <that one>, sub: [] }
//   2+ checked  → { primary: 'custom',   sub: [checked...] }
//
// Downstream (buildFullPayload, Manage Test → Add Question quotas, the
// distribution matrix, section-based per-part panels) all still read
// `questionSource` and `customSources`, so nothing else needs to change.
//
// A second variant handles the "MCQ Source" inside Combined, which carries an
// extra "Same as Programming" state (represented as primary: '' with sub: []).
// The picker exposes this as an OPTIONAL "Same as Programming" tile at the
// leftmost slot — ticking it clears every source tile; ticking any source
// tile auto-unticks it.

'use client';

import React, { useMemo } from 'react';
import { Check, Info, PencilLine, Sparkles, Link2, FolderOpen } from 'lucide-react';

export type QuestionSource = '' | 'scratch' | 'ai' | 'thirdParty' | 'custom';
export type CustomSubSource = 'scratch' | 'ai' | 'thirdParty';

export interface QuestionSourcePickerValue {
  primary: QuestionSource;
  sub: CustomSubSource[];
}

export interface QuestionSourceOption {
  value: CustomSubSource;
  label: string;
  hint: string;   // one-line hover tooltip
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>;
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

  /** Hide "Other Platform" — pure-MCQ contexts have no thirdParty import. */
  hideThirdParty?: boolean;

  /** Show a leftmost "inherit" tile that clears every source ("" state). */
  allowInherit?: boolean;
  inheritLabel?: string;
  inheritHint?: string;

  /**
   * Section heading. Rendered above the row with the required asterisk. If
   * omitted, the compact wash header is used instead so existing callers
   * (MCQ mirror in Combined etc.) keep their current chrome.
   */
  title?: string;

  /** Legacy label — the compact wash header. Ignored when `title` is passed. */
  label?: string;
  required?: boolean;

  /** Text shown when nothing is selected. */
  emptyHint?: string;

  /** Passthrough for host fonts (both wizards pin Poppins). */
  font?: string;

  disabled?: boolean;

  /** Optional test-id for e2e. */
  testId?: string;
}

// ─── Derived-state helpers ───────────────────────────────────────────────────

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

// ─── Constants ───────────────────────────────────────────────────────────────
const ORANGE = '#FF5A12';
const ORANGE_WASH = '#FFF4EE';
const BORDER = '#E4E7EC';
const BORDER_HOVER = '#F5C3A6';
const HOVER_WASH = '#FFF9F5';
const NAVY = '#101828';
const MUTED = '#667085';

// ─── Component ───────────────────────────────────────────────────────────────
export const QuestionSourcePicker: React.FC<Props> = ({
  value,
  onChange,
  D,
  hideThirdParty = false,
  allowInherit = false,
  inheritLabel = 'Same as Programming',
  inheritHint = 'Follow whatever the Programming picker chose.',
  title,
  label,
  required = false,
  emptyHint,
  font,
  disabled = false,
  testId,
}) => {
  const options: QuestionSourceOption[] = useMemo(
    () => [
      { value: 'scratch',    label: 'Manual',         hint: 'Add questions yourself',       Icon: PencilLine },
      { value: 'ai',         label: 'AI Automation',  hint: 'Generate questions with AI',   Icon: Sparkles },
      ...(hideThirdParty ? [] : [{ value: 'thirdParty' as CustomSubSource, label: 'Other Platform', hint: 'Import from another platform', Icon: Link2 }]),
    ],
    [hideThirdParty],
  );

  const checked = useMemo(
    () => storedToChecked(value, { hideThirdParty }),
    [value, hideThirdParty],
  );

  const isInheriting = allowInherit && checked.length === 0 && value.primary === '';

  const commit = (nextChecked: CustomSubSource[]) => {
    onChange(checkedToStored(nextChecked));
  };

  const toggle = (v: CustomSubSource) => {
    if (disabled) return;
    const next = checked.includes(v) ? checked.filter(x => x !== v) : [...checked, v];
    commit(next);
  };

  const setInherit = () => {
    if (disabled) return;
    if (!isInheriting) commit([]);
  };

  // Compact tile — 44px min height, checkbox + icon + label only. The former
  // one-line description is now the button's `title` (native hover tooltip).
  const cardStyle = (on: boolean): React.CSSProperties => ({
    flex: 1,
    minWidth: 180,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: 10,
    background: on ? ORANGE_WASH : '#fff',
    border: on ? `1.5px solid ${ORANGE}` : `1px solid ${BORDER}`,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    textAlign: 'left',
    fontFamily: font,
    boxSizing: 'border-box',
  });

  const checkboxStyle = (on: boolean): React.CSSProperties => ({
    width: 18,
    height: 18,
    borderRadius: 4,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: on ? ORANGE : '#fff',
    border: on ? `1.5px solid ${ORANGE}` : `1px solid #CBD0D9`,
    transition: 'background .15s, border-color .15s',
  });

  const iconStyle = (on: boolean): React.CSSProperties => ({
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: on ? ORANGE : MUTED,
    transition: 'color .15s',
  });

  const renderCard = (
    key: string,
    on: boolean,
    onClick: () => void,
    Icon: React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>,
    labelText: string,
    hint: string,
  ) => (
    <button
      key={key}
      type="button"
      role="checkbox"
      aria-checked={on}
      aria-label={labelText}
      title={hint}
      onClick={onClick}
      disabled={disabled}
      className="qsp-opt"
      style={cardStyle(on)}
    >
      <span aria-hidden="true" style={checkboxStyle(on)}>
        {on && <Check size={11} strokeWidth={3} style={{ color: '#fff' }} />}
      </span>
      <span aria-hidden="true" style={iconStyle(on)}>
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: NAVY, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {labelText}
      </span>
    </button>
  );

  return (
    <div data-testid={testId} style={{ fontFamily: font }}>
      <style>{`
        .qsp-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .qsp-row.qsp-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        @media (max-width: 900px) {
          .qsp-row, .qsp-row.qsp-two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .qsp-row, .qsp-row.qsp-two { grid-template-columns: 1fr; }
        }
        .qsp-opt { transition: background .15s ease, border-color .15s ease, box-shadow .15s ease; }
        .qsp-opt:hover:not(:disabled) { background: ${HOVER_WASH}; border-color: ${BORDER_HOVER}; }
        .qsp-opt:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(255,90,18,.22); border-color: ${ORANGE}; }
      `}</style>

      {/* When the caller passes `title`, the parent page already renders that
          heading, so the picker skips its own copy of it and shows a small
          one-line helper here instead: how the multi-select behaves + the
          required marker + a subtle count/hint icon once combining kicks in.
          The `label` variant below (compact wash header) is untouched — it's
          used by the MCQ mirror in Combined where no outer page heading
          announces the section. */}
      {title ? (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6, fontFamily: font }}>
          {required && (
            <span aria-label="required" style={{ fontSize: 12.5, fontWeight: 700, color: ORANGE, lineHeight: 1 }}>*</span>
          )}
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.4 }}>
            Tick one to use a single source, or two or more to combine.
          </span>
          {checked.length >= 2 && (
            <span
              title={`${checked.length} sources selected. Set the number of questions for each source.`}
              aria-label={`${checked.length} sources selected. Set the number of questions for each source.`}
              style={{ display: 'inline-flex', alignItems: 'center', color: MUTED, cursor: 'help', marginLeft: 'auto' }}
            >
              <Info size={13} />
            </span>
          )}
        </div>
      ) : label && (
        <div
          className="flex items-center"
          style={{
            padding: '9px 13px',
            background: '#FAF9F8',
            border: '1px solid #F1EEEA',
            borderRadius: 11,
            gap: 9,
            marginBottom: 12,
          }}
        >
          <FolderOpen size={12} style={{ color: MUTED }} />
          <span
            style={{
              fontSize: 11.2, fontWeight: 700, letterSpacing: '0.04em',
              textTransform: 'uppercase', color: '#3F4756', fontFamily: font,
            }}
          >
            {label}
            {required && <span style={{ color: ORANGE }}> *</span>}
          </span>
          {checked.length >= 2 && (
            <span
              title={`${checked.length} sources selected. Set the number of questions for each source.`}
              aria-label={`${checked.length} sources selected. Set the number of questions for each source.`}
              style={{ display: 'inline-flex', alignItems: 'center', color: MUTED, cursor: 'help', marginLeft: 2 }}
            >
              <Info size={12} />
            </span>
          )}
        </div>
      )}

      <div
        className={`qsp-row${!allowInherit && options.length === 2 ? ' qsp-two' : ''}`}
      >
        {allowInherit && renderCard(
          'inherit',
          isInheriting,
          setInherit,
          FolderOpen,
          inheritLabel,
          inheritHint,
        )}

        {options.map(opt => renderCard(
          opt.value,
          checked.includes(opt.value),
          () => toggle(opt.value),
          opt.Icon,
          opt.label,
          opt.hint,
        ))}
      </div>

      {checked.length === 0 && !isInheriting && emptyHint && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: MUTED, lineHeight: 1.5, fontFamily: font }}>
          {emptyHint}
        </p>
      )}
    </div>
  );
};

export default QuestionSourcePicker;
