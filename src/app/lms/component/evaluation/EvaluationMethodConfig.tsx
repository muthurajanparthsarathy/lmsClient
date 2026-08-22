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

  // Inline label fallback — mirrors the "Config Strategy *" labels used by the
  // surrounding ExerciseSettings programming rows.
  const inlineLabel = (text: string, info: string) => (
    <div className="flex items-center gap-1 mb-1.5">
      <span className="text-xs font-semibold" style={{ color: '#000000', fontFamily: font }}>
        {text} <span style={{ color: D.orange }}>*</span>
      </span>
      <span title={info} style={{ display: 'inline-flex', color: D.textMuted, cursor: 'help' }}>
        <Info size={12} />
      </span>
      {disabled && (
        <span style={{
          fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 10,
          background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', marginLeft: 3,
        }}>Locked</span>
      )}
    </div>
  );

  return (
    <div style={{ fontFamily: font }}>
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

          <div className="flex flex-wrap" style={{ gap: '6px 16px' }}>
            {AI_CRITERIA_OPTIONS.map(opt => {
              const on = v.ai.criteria.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleCriterion(opt.value)}
                  disabled={disabled}
                  className="flex items-center gap-2 py-1 text-sm font-semibold transition-colors"
                  style={{
                    color: on ? D.textMain : D.textSub,
                    fontFamily: font,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                    background: 'transparent',
                    border: 'none',
                    padding: '4px 0',
                  }}
                >
                  {/* Checkbox — orange accent, matches the app's selection colour */}
                  <span
                    className="flex items-center justify-center flex-shrink-0 rounded"
                    style={{
                      width: 15, height: 15,
                      border: `1.5px solid ${on ? D.orange : D.border}`,
                      background: on ? D.orange : D.bg,
                      transition: 'all 0.15s',
                    }}
                  >
                    {on && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
                  </span>
                  {opt.label}
                </button>
              );
            })}
          </div>

          {v.ai.criteria.length === 0 && (
            <p className="mt-1 text-[10px]" style={{ color: D.red }}>
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
            <div className="flex items-center gap-1 mb-1.5">
              <span className="text-xs font-semibold" style={{ color: '#000000', fontFamily: font }}>
                AI Test Cases Count <span style={{ color: D.orange }}>*</span>
              </span>
              <span
                title="Choose whether one count applies to every question in the exercise, or each Programming question has its own count entered in the question authoring form."
                style={{ display: 'inline-flex', color: D.textMuted, cursor: 'help' }}
              >
                <Info size={12} />
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mb-2">
              {([
                { value: 'common' as const, label: 'Common (one for the exercise)' },
                { value: 'perQuestion' as const, label: 'Per Question (each question’s own count)' },
              ]).map(opt => {
                const on = v.ai.testCasesCountMode === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ ...v, ai: { ...v.ai, testCasesCountMode: opt.value } })}
                    disabled={disabled}
                    className="flex items-center gap-2 py-1 text-sm font-semibold transition-colors"
                    style={{
                      color: on ? D.textMain : D.textSub,
                      fontFamily: font,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                    }}
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0 rounded-full"
                      style={{
                        width: 14, height: 14,
                        border: `1.5px solid ${on ? D.orange : D.border}`,
                        background: D.bg,
                      }}
                    >
                      {on && (
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: D.orange, display: 'inline-block',
                        }} />
                      )}
                    </span>
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
                <div className="flex items-center gap-1 mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: '#000000', fontFamily: font }}>
                    AI Test Cases <span style={{ color: D.orange }}>*</span>
                  </span>
                  <span
                    title="How many test cases the AI generates + evaluates against the student's code. Cached per question so every student sees the same set."
                    style={{ display: 'inline-flex', color: D.textMuted, cursor: 'help' }}
                  >
                    <Info size={12} />
                  </span>
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
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: `1px solid ${D.border}`,
                  background: disabled ? D.surface : D.bg,
                  color: D.textMain,
                  outline: 'none',
                  fontFamily: font,
                }}
              />
            </div>
            <p className="mt-1 text-[10px]" style={{ color: D.textMuted }}>
              Judged alongside any test cases already on the question. Max 50.
            </p>
          </div>
          )}

          {v.ai.testCasesCountMode === 'perQuestion' && (
            <p className="mt-3 text-[10.5px]" style={{ color: D.textMuted, fontFamily: font }}>
              Per-question mode is on — enter the AI test case count on each
              Programming question in its authoring form. It's a required field
              there. Questions authored before this feature will fall back to
              the exercise's saved default.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default EvaluationMethodConfig;
