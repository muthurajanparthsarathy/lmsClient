// EvaluationMethodConfig.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for the exercise-level "how is this evaluated?" config.
// Shared by BOTH authoring surfaces so the stored shape is identical:
//   • ExerciseSettings.tsx                    (I_Do / We_Do exercise wizard)
//   • youdo/assessments/ProgrammingConfiguration.tsx (You_Do Create Assessment)
//
// Exactly one method is chosen — test cases OR an AI evaluator. Picking AI
// reveals the evaluation-criteria checkboxes, laid out directly in the form
// (visible at a glance, no dropdown to open).
//
// SCOPE: this component only CAPTURES and STORES the choice. Nothing here runs
// an evaluation — the stored `evaluationMethod` is read later by whatever
// grading pipeline consumes it.
//
// The component is styling-agnostic: it takes the host's design tokens (`D`),
// font, and its OWN ODropdown / SectionLabel so the method select — including
// the opened option list — looks identical to the Config Strategy dropdown
// sitting right above it. A native <select> was wrong here: it renders the OS
// list instead of the app's portal dropdown.
import React from 'react';
import { Info, Check } from 'lucide-react';

// ─── Stored shape ────────────────────────────────────────────────────────────
// Manual  = student Submit posts score:0, no auto-eval; trainer grades on Review.
// testcase = client runs test cases via Piston at Submit, posts (passed/total)×maxMarks.
// ai      = client calls Gemini at Submit with the selected criteria, posts a
//           per-criterion breakdown + total.
export type EvaluationMethod = 'manual' | 'testcase' | 'ai';
export type AiCriterion =
  | 'correctness'
  | 'codeQuality'
  | 'efficiency'
  | 'readability'
  | 'edgeCases'
  | 'bestPractices';

/**
 * How the trainer configures the AI test-case count:
 * - 'common'      → one number for the whole exercise (evaluationMethod.ai.testCasesCount)
 * - 'perQuestion' → each Programming question carries its OWN count in its
 *                   authoring form (question.aiTestCasesCount); at Submit time
 *                   we read the specific question's field. Legacy questions
 *                   without the field fall back to the exercise's count so the
 *                   student's Submit is never blocked.
 */
export type AiTestCasesCountMode = 'common' | 'perQuestion';

export interface EvaluationMethodSetting {
  method: EvaluationMethod;
  /**
   * AI-mode extras. Persisted even when method !== 'ai' (harmless).
   * - `criteria`             — checkboxes the trainer picked for per-dimension scoring
   * - `testCasesCountMode`   — 'common' (one number for the exercise) OR 'perQuestion'
   *                            (each Programming question carries its own).
   * - `testCasesCount`       — the exercise-level count. Used when
   *                            testCasesCountMode === 'common', AND as fallback
   *                            for legacy questions in 'perQuestion' mode.
   */
  ai: {
    criteria: AiCriterion[];
    testCasesCountMode: AiTestCasesCountMode;
    testCasesCount: number;
  };
}

export const EVALUATION_METHOD_OPTIONS: { value: EvaluationMethod; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'testcase', label: 'Test Case Based' },
  { value: 'ai', label: 'AI Based' },
];

export const AI_CRITERIA_OPTIONS: { value: AiCriterion; label: string }[] = [
  { value: 'correctness', label: 'Correctness' },
  { value: 'codeQuality', label: 'Code Quality' },
  { value: 'efficiency', label: 'Efficiency' },
  { value: 'readability', label: 'Readability' },
  { value: 'edgeCases', label: 'Edge Cases' },
  { value: 'bestPractices', label: 'Best Practices' },
];

// The safest default is Manual — a Manual exercise never runs anything auto,
// so a mis-configured new exercise never triggers unintended Piston / Gemini
// calls. Each authoring surface that wants a different sensible default
// (e.g. You_Do assessments defaulting to Test Case to match their historical
// auto-scoring behaviour) overrides this at seed time.
// 20 AI-generated test cases is a sane default — big enough to cover edge
// cases, small enough that a single Gemini call stays under the token budget.
export const DEFAULT_AI_TEST_CASES_COUNT = 20;

export const DEFAULT_EVALUATION_METHOD: EvaluationMethodSetting = {
  method: 'manual',
  ai: {
    criteria: [],
    testCasesCountMode: 'common',
    testCasesCount: DEFAULT_AI_TEST_CASES_COUNT,
  },
};

/**
 * Hydrate a stored (or partially stored, or absent) value into a complete
 * `EvaluationMethodSetting`. Used on edit-load in both wizards so older
 * exercises without the field still render a valid form.
 *
 * Legacy fallback per tab-type is applied by the STUDENT editors, not here —
 * see `resolveEvaluationMethod` in the student editors. This function only
 * ever returns what the exercise doc explicitly stored (Manual by default).
 */
export const normalizeEvaluationMethod = (raw: any): EvaluationMethodSetting => {
  // `methods` (array) is a short-lived earlier shape — read its first entry so
  // anything already saved under it still loads correctly.
  const stored = raw?.method ?? (Array.isArray(raw?.methods) ? raw.methods[0] : undefined);
  const criteria = (Array.isArray(raw?.ai?.criteria) ? raw.ai.criteria : [])
    .filter((c: any): c is AiCriterion => AI_CRITERIA_OPTIONS.some(o => o.value === c));
  const method: EvaluationMethod =
    stored === 'ai' ? 'ai'
      : stored === 'testcase' ? 'testcase'
      : 'manual';
  // Clamp count to [0, 50] to keep single-call Gemini token cost bounded.
  const rawCount = Number(raw?.ai?.testCasesCount);
  const testCasesCount = Number.isFinite(rawCount) && rawCount >= 0
    ? Math.min(50, Math.floor(rawCount))
    : DEFAULT_AI_TEST_CASES_COUNT;
  const rawMode = raw?.ai?.testCasesCountMode;
  const testCasesCountMode: AiTestCasesCountMode =
    rawMode === 'perQuestion' ? 'perQuestion' : 'common';
  return { method, ai: { criteria, testCasesCountMode, testCasesCount } };
};

// ─── Component ───────────────────────────────────────────────────────────────
type Tokens = {
  orange: string; orangeLight: string; bg: string; surface: string; border: string;
  textMain: string; textSub: string; textMuted: string; red: string;
};

const INFO = "How programming submissions are scored — against the question's test cases, or by an AI evaluator.";
const CRITERIA_INFO = 'What the AI evaluator should judge submissions on. Tick one or more.';

type ODropdownComponent = React.FC<{
  value: string;
  options: { label: string; value: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  touched?: boolean;
  className?: string;
}>;

interface Props {
  value: EvaluationMethodSetting;
  onChange: (next: EvaluationMethodSetting) => void;
  D: Tokens;
  /**
   * The HOST's dropdown, so the opened list matches the wizard it lives in.
   * Both trees export an ODropdown with this exact prop shape.
   */
  ODropdown: ODropdownComponent;
  /**
   * The host's SectionLabel. Supplied by the assessments wizard (whose rows all
   * use it); ExerciseSettings omits it because its programming rows use inline
   * black labels instead — see the fallback below.
   */
  SectionLabel?: React.FC<{ children: React.ReactNode; required?: boolean; info?: string }>;
  font?: string;
  /** Locked once the config is committed (mirrors the Config Strategy lock). */
  disabled?: boolean;
  /** Constrains the control width to match the denser ExerciseSettings rows. */
  dense?: boolean;
  /**
   * The evaluation methods the caller wants to expose.
   *
   * Undefined (default) → every method in EVALUATION_METHOD_OPTIONS is shown.
   * This is what I_Do / We_Do (ExerciseSettings) uses.
   *
   * Passed → the option list AND validation are narrowed to this set. Used by
   * You_Do assessments to hide Manual so trainers can only pick Test Case or
   * AI — Manual is not a valid outcome for a You_Do (per the product rule that
   * a You_Do must auto-grade end-to-end, either against test cases or by AI).
   *
   * If the stored value is NOT in this set (e.g. a legacy You_Do saved as
   * Manual before this restriction landed), it is promoted to allowedMethods[0]
   * on mount via onChange so the picker never renders a value not in its
   * list — the migration is silent, not blocking.
   */
  allowedMethods?: EvaluationMethod[];
}

export const EvaluationMethodConfig: React.FC<Props> = ({
  value, onChange, D, ODropdown, SectionLabel, font, disabled = false, dense = false,
  allowedMethods,
}) => {
  const v = normalizeEvaluationMethod(value);

  // Narrowed option list, if the caller passed one. The `allowedMethods`
  // reference itself is stable across renders in the callers we have (both
  // pass a module-scope literal), so the useMemo dependency is on the array's
  // JSON — cheap for 3 values and avoids re-filtering on every keystroke.
  const options = React.useMemo(
    () =>
      Array.isArray(allowedMethods) && allowedMethods.length > 0
        ? EVALUATION_METHOD_OPTIONS.filter(o => allowedMethods.includes(o.value))
        : EVALUATION_METHOD_OPTIONS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(allowedMethods)],
  );

  // Silently promote a stored method that's outside the allowed set (e.g. a
  // pre-restriction You_Do saved as Manual) up to the first allowed method.
  // The picker never renders a value not in its list, and the promoted value
  // is persisted immediately so the next save is coherent.
  React.useEffect(() => {
    if (!Array.isArray(allowedMethods) || allowedMethods.length === 0) return;
    if (disabled) return;
    if (allowedMethods.includes(v.method)) return;
    onChange({ ...v, method: allowedMethods[0] });
    // Depend only on the current stored method + the allowed set. `v` and
    // `onChange` change identity every render and would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.method, JSON.stringify(allowedMethods), disabled]);

  const toggleCriterion = (c: AiCriterion) => {
    if (disabled) return;
    const has = v.ai.criteria.includes(c);
    onChange({
      ...v,
      ai: { ...v.ai, criteria: has ? v.ai.criteria.filter(x => x !== c) : [...v.ai.criteria, c] },
    });
  };

  // Spec info dot — 13×13 circle, 1px #D6D3D1 border, 8.5px/700 "i" in #9CA3AF.
  // Keeps the `title` tooltip the old lucide icon carried.
  const infoDot = (info: string) => (
    <span
      title={info}
      style={{
        width: 13, height: 13, borderRadius: '50%', border: '1px solid #D6D3D1',
        fontSize: 8.5, fontWeight: 700, color: '#9CA3AF', lineHeight: 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'help', marginLeft: 4, flexShrink: 0,
      }}
    >i</span>
  );

  // Inline label fallback — spec label metrics (11px/600 #4B5563, 5px gap
  // below), matching the restyled ExerciseSettings programming rows.
  const inlineLabel = (text: string, info: string) => (
    <div className="flex items-center" style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: '#4B5563', fontFamily: font }}>
        {text} <span style={{ color: D.orange }}>*</span>
      </span>
      {infoDot(info)}
      {disabled && (
        <span style={{
          height: 23, display: 'inline-flex', alignItems: 'center', padding: '0 9px',
          borderRadius: 999, fontSize: 10.8, fontWeight: 600,
          background: '#FFFAEB', color: '#B54708', border: '1px solid #F5DFA8', marginLeft: 6,
        }}>Locked</span>
      )}
    </div>
  );

  return (
    <div style={{ fontFamily: font }}>
      {/* Scoped, styling-only CSS: hide number spinners + spec orange focus ring. */}
      <style>{`
        .emc-num::-webkit-outer-spin-button, .emc-num::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .emc-num { -moz-appearance: textfield; }
        .emc-num:focus { border-color: #EE6A22 !important; box-shadow: 0 0 0 3px rgba(238,106,34,.13); }
      `}</style>
      {SectionLabel
        ? <SectionLabel required info={INFO}>Evaluation Method</SectionLabel>
        : inlineLabel('Evaluation Method', INFO)}

      <div style={dense ? { maxWidth: '45%' } : undefined}>
        <ODropdown
          value={v.method}
          options={options}
          disabled={disabled}
          onChange={m => onChange({ ...v, method: m as EvaluationMethod })}
        />
      </div>

      {/* AI Evaluation Setup — criteria as plain visible checkboxes, only when
          AI is picked. Deliberately NOT a dropdown: all options and their
          checked state stay visible at a glance. */}
      {v.method === 'ai' && (
        <div className="mt-3">
          {SectionLabel
            ? <SectionLabel required info={CRITERIA_INFO}>Evaluation Criteria</SectionLabel>
            : inlineLabel('Evaluation Criteria', CRITERIA_INFO)}

          <div className="flex flex-wrap" style={{ gap: 6 }}>
            {AI_CRITERIA_OPTIONS.map(opt => {
              const on = v.ai.criteria.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCriterion(opt.value)}
                  disabled={disabled}
                  className="inline-flex items-center flex-shrink-0 transition-colors"
                  style={{
                    // Spec pill: 23px tall, radius 999, 10.8px/600 — grey when
                    // off, orange-soft/#D65A16 with an orange border when on.
                    height: 23, padding: '0 9px', borderRadius: 999, gap: 5,
                    fontSize: 10.8, fontWeight: 600,
                    background: on ? '#FFF2E8' : '#F4F4F5',
                    color: on ? '#D65A16' : '#57606E',
                    border: `1px solid ${on ? D.orange : '#E7E5E4'}`,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.45 : 1,
                    fontFamily: font,
                  }}
                >
                  {on && <Check size={10} strokeWidth={3} style={{ flexShrink: 0 }} />}
                  {opt.label}
                </button>
              );
            })}
          </div>

          {v.ai.criteria.length === 0 && (
            <p
              className="mt-2 flex items-start"
              style={{
                gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 11.4, lineHeight: 1.5,
                background: '#FEF3F2', border: '1px solid #FBD3CE', color: '#912018',
              }}
            >
              Select at least one criterion for the AI evaluator.
            </p>
          )}

          {/* ── AI Test Cases Count mode + input ────────────────────────
              Trainer picks whether ONE count applies to every Programming
              question in the exercise ('common') or each question carries
              its own count ('perQuestion'). In perQuestion mode the count
              is a REQUIRED field on the Programming question authoring form;
              legacy questions without it fall back to the exercise's count
              (still stored below as safety net). */}
          <div className="mt-3">
            <div className="flex items-center" style={{ marginBottom: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#4B5563', fontFamily: font }}>
                AI Test Cases Count <span style={{ color: D.orange }}>*</span>
              </span>
              {infoDot('Choose whether one count applies to every question in the exercise, or each Programming question has its own count entered in the question authoring form.')}
            </div>
            {/* Spec segmented control — the two modes are mutually exclusive,
                so the old radio pair maps 1:1 onto the demo's 2-way segment. */}
            <div
              className="mb-2 inline-flex max-w-full flex-wrap"
              style={{
                background: '#F5F3F1', border: '1px solid #E9E5E1', borderRadius: 8,
                padding: 3, gap: 3, opacity: disabled ? 0.45 : 1,
              }}
            >
              {([
                { value: 'common' as const, label: 'Common (one for the exercise)' },
                { value: 'perQuestion' as const, label: 'Per Question (each question’s own count)' },
              ]).map(opt => {
                const on = v.ai.testCasesCountMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onChange({ ...v, ai: { ...v.ai, testCasesCountMode: opt.value } })}
                    disabled={disabled}
                    className="transition-colors"
                    style={{
                      height: 27, padding: '0 12px', borderRadius: 5,
                      fontSize: 12, fontWeight: 600,
                      background: on ? '#fff' : 'transparent',
                      color: on ? '#D65A16' : '#6B7280',
                      border: 'none',
                      boxShadow: on ? '0 1px 3px rgba(15,23,42,.1)' : 'none',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      fontFamily: font,
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Exercise-level count input — shown only in Common mode.
              Also stored (but hidden) in Per Question mode as the fallback
              default for any question that doesn't carry its own count. */}
          {v.ai.testCasesCountMode === 'common' && (
          <div className="mt-3">
            {SectionLabel
              ? <SectionLabel info="How many test cases the AI generates + evaluates against the student's code. Cached per question so every student sees the same set.">AI Test Cases</SectionLabel>
              : (
                <div className="flex items-center" style={{ marginBottom: 5 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#4B5563', fontFamily: font }}>
                    AI Test Cases <span style={{ color: D.orange }}>*</span>
                  </span>
                  {infoDot("How many test cases the AI generates + evaluates against the student's code. Cached per question so every student sees the same set.")}
                </div>
              )}
            <div style={{ maxWidth: dense ? '30%' : 160 }}>
              <input
                type="number"
                min={0}
                max={50}
                value={v.ai.testCasesCount}
                disabled={disabled}
                onChange={e => {
                  const raw = e.target.value === '' ? 0 : Math.max(0, Math.min(50, Math.floor(Number(e.target.value) || 0)));
                  onChange({ ...v, ai: { ...v.ai, testCasesCount: raw } });
                }}
                className="emc-num"
                style={{
                  // Spec small input: 30px tall, 12px text, 8px radius,
                  // 1px #E9E5E1 border; readonly/disabled goes wash + muted.
                  width: '100%',
                  height: 30,
                  padding: '0 10px',
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #E9E5E1',
                  background: disabled ? '#FAF9F8' : '#fff',
                  color: disabled ? '#6B7280' : '#1D2433',
                  outline: 'none',
                  fontFamily: font,
                }}
              />
            </div>
            <div
              className="mt-2 flex items-start"
              style={{
                gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 11.4, lineHeight: 1.5,
                background: '#EFF6FF', border: '1px solid #CFE0FB', color: '#1B4DA8',
              }}
            >
              <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Judged alongside any test cases already on the question. Max 50.</span>
            </div>
          </div>
          )}

          {v.ai.testCasesCountMode === 'perQuestion' && (
            <div
              className="mt-3 flex items-start"
              style={{
                gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 11.4, lineHeight: 1.5,
                background: '#EFF6FF', border: '1px solid #CFE0FB', color: '#1B4DA8', fontFamily: font,
              }}
            >
              <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                Per-question mode is on — enter the AI test case count on each
                Programming question in its authoring form. It's a required field
                there. Questions authored before this feature will fall back to
                the exercise's saved default.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EvaluationMethodConfig;
