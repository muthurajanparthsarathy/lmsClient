import React from 'react';
import {
  Award, EyeOff, Hash, Layers, List, Plus, Shield, Terminal, Trash2,
} from 'lucide-react';
import { D, FONT } from '../shared/tokens';
import { InfoTooltip, ONumberInput } from '../shared/UIComponents';

// ── SectionHeading ───────────────────────────────────────────────────────────
// Same orange-title + hairline pattern used in ScheduleStep and
// NotificationsStep so all wizard steps read as one flat surface.
const SectionHeading: React.FC<{ children: React.ReactNode; right?: React.ReactNode }> = ({ children, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 10px' }}>
    <span style={{
      fontSize: 12, fontWeight: 700, color: D.orange, letterSpacing: '-.01em',
      whiteSpace: 'nowrap', textTransform: 'none', fontFamily: FONT,
    }}>
      {children}
    </span>
    <span aria-hidden style={{ flex: 1, height: 1, background: D.border }} />
    {right && <span className="flex items-center flex-shrink-0" style={{ gap: 8 }}>{right}</span>}
  </div>
);

// Recommended performance scale shown by default (percentage of Total Mark).
// Always rendered; teachers can edit labels/percentages, add rows, or remove them.
const DEFAULT_GRADE_BANDS = [
  { id: 'band_poor', label: 'Poor', fromPercent: 0, toPercent: 40 },
  { id: 'band_average', label: 'Average', fromPercent: 40, toPercent: 60 },
  { id: 'band_good', label: 'Good', fromPercent: 60, toPercent: 80 },
  { id: 'band_excellent', label: 'Excellent', fromPercent: 80, toPercent: 100 },
];

// ─── Demo-spec presentational helpers (styling only — no state, no logic) ────

const LEVEL_DOT: Record<'easy' | 'medium' | 'hard', string> = { easy: '#0F9D58', medium: '#F0A415', hard: '#E0503C' };
const LEVEL_TEXT: Record<'easy' | 'medium' | 'hard', string> = { easy: '#046C4E', medium: '#B54708', hard: '#B42318' };

const pill = (bg: string, line: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 23, padding: '0 9px',
  borderRadius: 999, fontSize: 10.8, fontWeight: 600, whiteSpace: 'nowrap',
  background: bg, border: `1px solid ${line}`, color,
});
const BLUE_PILL = pill('#EFF6FF', '#CFE0FB', '#175CD3');
const PURPLE_PILL = pill('#F4F0FF', '#DDD1FB', '#6941C6');
const ORANGE_PILL = pill('#FFF2E8', '#FBD8BE', '#D65A16');
const GREY_PILL = pill('#F4F4F5', '#E7E5E4', '#57606E');

// spec table header cell
const TH: React.CSSProperties = {
  fontSize: 10.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
  color: '#57606E', padding: '7px 9px',
};
// spec table wrapper: radius 10, 1px --line border
const TABLE_WRAP: React.CSSProperties = {
  borderRadius: 10, border: `1px solid ${D.border2}`, overflow: 'hidden', background: '#fff',
};
// spec input metrics layered onto the shared ONumberInput
const INPUT_STYLE: React.CSSProperties = { height: 34, borderRadius: 8, padding: '0 11px', fontSize: 12.6 };
const INPUT_SM_STYLE: React.CSSProperties = { height: 30, borderRadius: 8, padding: '0 9px', fontSize: 12 };

// 35×20 demo switch — green track when on
const SpecSwitch: React.FC<{ on: boolean; onClick: () => void; label: string }> = ({ on, onClick, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onClick}
    className="flex-shrink-0"
    style={{
      position: 'relative', width: 35, height: 20, borderRadius: 999, border: 'none', padding: 0,
      cursor: 'pointer', background: on ? D.emerald : '#DEDAD5', transition: 'background .16s',
    }}
  >
    <span
      style={{
        position: 'absolute', top: 2, left: 2, width: 16, height: 16, borderRadius: 999, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,.25)', transform: on ? 'translateX(15px)' : 'translateX(0)',
        transition: 'transform .16s',
      }}
    />
  </button>
);

// Flat section — SectionHeading + plain body. Replaces the old bordered
// SpecCard so the whole step reads as one flat surface, matching the
// ScheduleStep pattern. The `icon` slot from the old signature is ignored
// (SectionHeading has no icon slot); every call site's `right` and
// `bodyStyle` overrides still flow through unchanged.
const SpecCard: React.FC<{
  title: string; icon?: React.ReactNode; right?: React.ReactNode;
  bodyStyle?: React.CSSProperties; children: React.ReactNode;
}> = ({ title, right, bodyStyle, children }) => (
  <div>
    <SectionHeading right={right}>{title}</SectionHeading>
    <div style={bodyStyle}>{children}</div>
  </div>
);

// Row: label + control sit adjacent so the value never trails to the far
// right when the label is short. Fixed label column keeps rows lined up
// across the whole card, matching the ScheduleStep field-row pattern.
const MarkRow: React.FC<{
  icon?: React.ReactNode; label: React.ReactNode; info?: string; sub?: string;
  first?: boolean; right: React.ReactNode;
}> = ({ icon, label, info, sub, first, right }) => (
  <div
    className="flex items-center flex-wrap"
    style={{ gap: 12, padding: '9px 0', borderTop: first ? 'none' : `1px solid ${D.border}` }}
  >
    <div className="flex items-center" style={{ gap: 8, minWidth: 220 }}>
      {icon && <span className="flex items-center flex-shrink-0" style={{ color: D.textHint }}>{icon}</span>}
      <div>
        <div className="flex items-center" style={{ gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: FONT }}>{label}</span>
          {info && <InfoTooltip content={info} side="right" />}
        </div>
        {sub && <p style={{ fontSize: 11.4, color: D.textMuted, marginTop: 1 }}>{sub}</p>}
      </div>
    </div>
    <div className="flex-shrink-0">{right}</div>
  </div>
);

// read-only auto-calculated value: ink text + blue "Auto" pill (NOT an input)
const AutoValue: React.FC<{ value: number | string }> = ({ value }) => (
  <span style={{ fontSize: 12.6, fontWeight: 600, color: D.textMain }}>
    {value === 'Auto' ? '—' : value}
  </span>
);

interface GradeSettingsStepProps {
  formData: any;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  validationErrors: any;
  setValidationErrors: React.Dispatch<React.SetStateAction<any>>;
  touchedFields: Set<string>;
  markTouched: (field: string) => void;
  levelTotalsFromConfig: { easy?: number; medium?: number; hard?: number } | null | undefined;
}

export const GradeSettingsStep: React.FC<GradeSettingsStepProps> = ({
  formData,
  setFormData,
  validationErrors,
  setValidationErrors,
  touchedFields,
  markTouched,
  levelTotalsFromConfig,
}) => {
  const et = formData.exerciseType;
  const sep = formData.grades.separateMarks;
  const g = formData.grades;
  const ve = validationErrors;
  const tf = touchedFields;
  const diffEnabled = g.difficultyPassEnabled;

  // ── Grade bands (performance scale by % of Total Mark) — UI + state only ──
  const gradeBands: any[] = Array.isArray(g.gradeBands) ? g.gradeBands : DEFAULT_GRADE_BANDS;
  const updateGradeBands = (updater: (curr: any[]) => any[]) =>
    setFormData((prev: any) => ({
      ...prev,
      grades: {
        ...prev.grades,
        gradeBands: updater(Array.isArray(prev.grades.gradeBands) ? prev.grades.gradeBands : DEFAULT_GRADE_BANDS),
      },
    }));
  const updateGradeBand = (id: string, patch: any) =>
    updateGradeBands(curr => curr.map(b => (b.id === id ? { ...b, ...patch } : b)));
  const removeGradeBand = (id: string) =>
    updateGradeBands(curr => curr.filter(b => b.id !== id));
  const addGradeBand = () =>
    updateGradeBands(curr => [...curr, { id: `band_${Date.now()}`, label: '', fromPercent: 0, toPercent: 0 }]);

  const levelLabels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

  const isCombinedDiff = et === 'Combined';
  const showDifficultyPass = (et === 'Programming' || et === 'Other' || et === 'Combined') && !!levelTotalsFromConfig;

  const renderLevelTable = (titleLabel: string | null) => {
    if (!levelTotalsFromConfig) return null;
    const activeLevels = (['easy', 'medium', 'hard'] as const).filter(
      l => (levelTotalsFromConfig[l] ?? 0) > 0
    );
    if (activeLevels.length === 0) return null;
    return (
      <div style={{ ...TABLE_WRAP, marginTop: 8 }}>
        {titleLabel && (
          <div style={{ padding: '7px 9px', background: '#FCFBFA', borderBottom: `1px solid ${D.border}` }}>
            <span style={ORANGE_PILL}>{titleLabel}</span>
          </div>
        )}
        <div
          className="grid"
          style={{ gridTemplateColumns: '110px 1fr 1fr', background: '#FCFBFA', borderBottom: `1px solid ${D.border}` }}
        >
          <span style={TH}>Level</span>
          <span className="text-center" style={TH}>Total Marks</span>
          <span className="text-center" style={TH}>Mark to Pass</span>
        </div>

        {activeLevels.map((level, idx) => {
          const levelTotal = levelTotalsFromConfig[level] ?? 0;
          const passMarkKey = `${level}PassMark` as 'easyPassMark' | 'mediumPassMark' | 'hardPassMark';
          const passMarkValue = g[passMarkKey];
          const errorKey = `${level}PassMark`;
          const hasError = tf.has(errorKey) && !!(ve as any)[errorKey];

          return (
            <div
              key={level}
              className="grid items-center"
              style={{
                gridTemplateColumns: '110px 1fr 1fr',
                gap: 8,
                padding: '7px 9px',
                borderTop: idx > 0 ? `1px solid ${D.border}` : 'none',
                background: '#fff',
              }}
            >
              <div className="flex items-center" style={{ gap: 6 }}>
                <span className="flex-shrink-0" style={{ width: 7, height: 7, borderRadius: 999, background: LEVEL_DOT[level] }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: LEVEL_TEXT[level] }}>
                  {levelLabels[level]}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <span style={{ fontSize: 12.6, fontWeight: 600, color: D.textMain }}>{levelTotal}</span>
              </div>
              <div>
                <ONumberInput
                  value={passMarkValue ?? 0}
                  onChange={v => {
                    setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, [passMarkKey]: v } }));
                    if (v > 0) setValidationErrors((prev: any) => { const e = { ...prev }; delete (e as any)[errorKey]; return e; });
                  }}
                  onBlur={() => markTouched(errorKey)}
                  placeholder="0"
                  max={levelTotal}
                  error={(ve as any)[errorKey]}
                  touched={hasError}
                  style={INPUT_SM_STYLE}
                />
                {levelTotal > 0 && (passMarkValue ?? 0) > levelTotal && (
                  <p style={{ marginTop: 2, fontSize: 11.4, color: '#912018' }}>Cannot exceed {levelTotal}</p>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ padding: '7px 9px', background: '#FCFBFA', borderTop: `1px solid ${D.border}`, fontSize: 11.4, color: D.textMuted }}>
          Students must score at or above the level pass mark to pass that difficulty tier.
        </div>
      </div>
    );
  };

  const renderMcqTable = () => {
    const mcqTotal = formData.totalMarksMCQ || 0;
    const splitTotals = (() => {
      if (mcqTotal <= 0) return { easy: 0, medium: 0, hard: 0 };
      const base = Math.floor(mcqTotal / 3);
      const remainder = mcqTotal - base * 3;
      return { easy: base + remainder, medium: base, hard: base };
    })();

    const rows = [
      { level: 'easy' as const,   label: 'Easy',   total: splitTotals.easy,   stateKey: 'mcqEasyPassMark'   as const },
      { level: 'medium' as const, label: 'Medium', total: splitTotals.medium, stateKey: 'mcqMediumPassMark' as const },
      { level: 'hard' as const,   label: 'Hard',   total: splitTotals.hard,   stateKey: 'mcqHardPassMark'   as const },
    ];

    return (
      <div style={{ ...TABLE_WRAP, marginTop: 8 }}>
        <div style={{ padding: '7px 9px', background: '#FCFBFA', borderBottom: `1px solid ${D.border}` }}>
          <span style={BLUE_PILL}>MCQ Section</span>
        </div>
        <div
          className="grid"
          style={{ gridTemplateColumns: '110px 1fr 1fr', background: '#FCFBFA', borderBottom: `1px solid ${D.border}` }}
        >
          <span style={TH}>Level</span>
          <span className="text-center" style={TH}>Total Marks</span>
          <span className="text-center" style={TH}>Mark to Pass</span>
        </div>

        {rows.map((row, idx) => {
          const value = g[row.stateKey];
          return (
            <div
              key={row.level}
              className="grid items-center"
              style={{
                gridTemplateColumns: '110px 1fr 1fr',
                gap: 8,
                padding: '7px 9px',
                background: '#fff',
                borderTop: idx === 0 ? 'none' : `1px solid ${D.border}`,
              }}
            >
              <div className="flex items-center" style={{ gap: 6 }}>
                <span className="flex-shrink-0" style={{ width: 7, height: 7, borderRadius: 999, background: LEVEL_DOT[row.level] }} />
                <span style={{ fontSize: 11.5, fontWeight: 600, color: LEVEL_TEXT[row.level] }}>
                  {row.label}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <span style={{ fontSize: 12.6, fontWeight: 600, color: D.textMain }}>{row.total}</span>
              </div>
              <div>
                <ONumberInput
                  value={value ?? 0}
                  onChange={v =>
                    setFormData((prev: any) => ({
                      ...prev,
                      grades: { ...prev.grades, [row.stateKey]: v },
                    }))
                  }
                  placeholder="0"
                  max={row.total || undefined}
                  style={INPUT_SM_STYLE}
                />
                {row.total > 0 && (value ?? 0) > row.total && (
                  <p style={{ marginTop: 2, fontSize: 11.4, color: '#912018' }}>Cannot exceed {row.total}</p>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ padding: '7px 9px', background: '#FCFBFA', borderTop: `1px solid ${D.border}`, fontSize: 11.4, color: D.textMuted }}>
          Students must score at or above each difficulty's pass mark to pass the MCQ section.
        </div>
      </div>
    );
  };

  const DifficultyPassSection = () => {
    if (!showDifficultyPass || !levelTotalsFromConfig) return null;
    const activeLevels = (['easy', 'medium', 'hard'] as const).filter(
      l => (levelTotalsFromConfig[l] ?? 0) > 0
    );
    if (activeLevels.length === 0) return null;

    return (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${D.border}` }}>
        <div className="flex items-center flex-wrap" style={{ gap: 12 }}>
          <div className="flex items-center" style={{ gap: 8, minWidth: 220 }}>
            <span className="flex items-center flex-shrink-0" style={{ color: D.textHint }}>
              <Hash size={13} />
            </span>
            <div>
              <div className="flex items-center" style={{ gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: FONT }}>
                  Mark to Pass by Difficulty
                </span>
                <span style={PURPLE_PILL}>Per level</span>
                <InfoTooltip
                  content="Set separate passing marks for each difficulty level. When enabled, the overall Mark to Pass field is hidden."
                  side="right"
                />
              </div>
              <p style={{ fontSize: 11.4, color: D.textMuted, marginTop: 1 }}>
                {isCombinedDiff
                  ? 'Configure MCQ and Programming pass marks separately — each section stores its own data.'
                  : 'Configure minimum passing marks per difficulty level'}
              </p>
            </div>
          </div>
          <SpecSwitch
            on={g.difficultyPassEnabled}
            onClick={() =>
              setFormData((prev: any) => ({
                ...prev,
                grades: { ...prev.grades, difficultyPassEnabled: !prev.grades.difficultyPassEnabled },
              }))
            }
            label="Mark to Pass by Difficulty"
          />
        </div>

        {g.difficultyPassEnabled && (
          isCombinedDiff ? (
            <div className="space-y-3">
              {renderMcqTable()}
              {renderLevelTable('Programming Section')}
            </div>
          ) : (
            renderLevelTable(null)
          )
        )}

        {g.difficultyPassEnabled && <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${D.border}` }}>
          <div className="flex items-start" style={{ gap: 7 }}>
            <input
              type="checkbox"
              id="overallMarkToPassEnabled"
              checked={g.overallMarkToPassEnabled ?? false}
              onChange={e => setFormData((prev: any) => ({
                ...prev,
                grades: { ...prev.grades, overallMarkToPassEnabled: e.target.checked, overallMarkToPass: e.target.checked ? prev.grades.overallMarkToPass : null }
              }))}
              className="cursor-pointer flex-shrink-0"
              style={{ width: 15, height: 15, accentColor: D.orange, marginTop: 2 }}
            />
            <div className="flex-1">
              <label htmlFor="overallMarkToPassEnabled" className="cursor-pointer" style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: FONT }}>
                Mark to Pass <span style={{ fontWeight: 400, color: D.textMuted }}>(Optional)</span>
              </label>
              <p style={{ fontSize: 11.4, color: D.textMuted, marginTop: 2 }}>
                When enabled, this single value overrides per-difficulty pass/fail rules.
              </p>
              {(g.overallMarkToPassEnabled) && (
                <div className="w-32" style={{ marginTop: 8 }}>
                  <ONumberInput
                    value={g.overallMarkToPass ?? 0}
                    onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, overallMarkToPass: v || null } }))}
                    placeholder="0"
                    min={0}
                    style={INPUT_STYLE}
                  />
                </div>
              )}
            </div>
          </div>
        </div>}
      </div>
    );
  };

  return (
    <div style={{ padding: '16px 32px 24px', maxWidth: 1200, fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Grading card: total mark / mark to pass / difficulty pass ── */}
      <SpecCard title="Grading" icon={<Award size={13} />} bodyStyle={{ padding: '2px 13px 6px' }}>

        {/* MCQ */}
        {et === 'MCQ' && (<>
          <MarkRow first icon={<List size={13} />} label="Total Mark"
            info="Auto-calculated from MCQ total marks"
            right={<AutoValue value={formData.totalMarks || 'Auto'} />} />
          <MarkRow icon={<Award size={13} />} label="Mark to Pass"
            info="Minimum marks to pass — cannot exceed Total Mark (optional)"
            right={
              <div className="w-32">
                <ONumberInput
                  value={g.mcqGradeToPass ?? 0}
                  onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, mcqGradeToPass: v } }))}
                  onBlur={() => markTouched('mcqGradeToPass')}
                  placeholder="0"
                  error={ve.mcqGradeToPass}
                  touched={tf.has('mcqGradeToPass')}
                  style={INPUT_STYLE}
                />
              </div>
            } />
        </>)}

        {/* Other */}
        {et === 'Other' && (<>
          <MarkRow first icon={<Terminal size={13} />} label="Total Mark"
            info="Auto-calculated from total marks"
            right={<AutoValue value={formData.totalMarks || 'Auto'} />} />
          {!diffEnabled && (
            <MarkRow icon={<Award size={13} />} label="Mark to Pass"
              info="Minimum marks required to pass — cannot exceed Total Mark (optional)"
              right={
                <div className="w-32">
                  <ONumberInput
                    value={g.programmingGradeToPass ?? 0}
                    onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, programmingGradeToPass: v } }))}
                    onBlur={() => markTouched('programmingGradeToPass')}
                    placeholder="0"
                    error={ve.programmingGradeToPass}
                    touched={tf.has('programmingGradeToPass')}
                    style={INPUT_STYLE}
                  />
                </div>
              } />
          )}
          {showDifficultyPass && (
            <DifficultyPassSection />
          )}
        </>)}

        {/* Programming */}
        {et === 'Programming' && (<>
          <MarkRow first icon={<Terminal size={13} />} label="Total Mark"
            info="Auto-calculated from Step 1 total marks — read only"
            right={<AutoValue value={formData.totalMarks || 'Auto'} />} />
          {!diffEnabled && (
            <MarkRow icon={<Award size={13} />} label="Mark to Pass"
              info="Minimum marks required to pass — cannot exceed Total Mark (optional)"
              right={
                <div className="w-32">
                  <ONumberInput
                    value={g.programmingGradeToPass ?? 0}
                    onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, programmingGradeToPass: v } }))}
                    onBlur={() => markTouched('programmingGradeToPass')}
                    placeholder="0"
                    error={ve.programmingGradeToPass}
                    touched={tf.has('programmingGradeToPass')}
                    style={INPUT_STYLE}
                  />
                </div>
              } />
          )}
          {showDifficultyPass && (
            <DifficultyPassSection />
          )}
        </>)}

        {/* Combined */}
        {et === 'Combined' && (<>
          <MarkRow first icon={<Layers size={13} />} label="Separate Marks"
            sub={'Mark each section (MCQ & Programming) independently'}
            right={
              <SpecSwitch
                on={sep}
                onClick={() => setFormData((prev: any) => {
                  const next = !sep;
                  return {
                    ...prev,
                    grades: {
                      ...prev.grades,
                      separateMarks: next,
                      ...(next ? { difficultyPassEnabled: false } : {}),
                    },
                  };
                })}
                label="Separate Marks"
              />
            } />

          {!sep ? (<>
            {(() => {
              const ag = (formData.totalMarksMCQ || 0) + (formData.totalMarksProgramming || 0);
              return (<>
                <MarkRow icon={<Layers size={13} />} label="Mark"
                  info="Auto-calculated: MCQ total + Programming total"
                  right={<AutoValue value={ag > 0 ? ag : 'Auto'} />} />
                {!diffEnabled && (
                  <MarkRow icon={<Award size={13} />} label="Mark to Pass"
                    info={`Overall passing marks — cannot exceed Mark${ag > 0 ? ` (${ag})` : ''} (optional)`}
                    right={
                      <div className="w-32">
                        <ONumberInput
                          value={g.combinedGradeToPass ?? 0}
                          onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, combinedGradeToPass: v } }))}
                          onBlur={() => markTouched('combinedGradeToPass')}
                          placeholder="0"
                          error={ve.combinedGradeToPass}
                          touched={tf.has('combinedGradeToPass')}
                          style={INPUT_STYLE}
                        />
                      </div>
                    } />
                )}
              </>);
            })()}
          </>) : (<>
            <div className="flex items-center" style={{ padding: '10px 0 4px', borderTop: `1px solid ${D.border}` }}>
              <span style={BLUE_PILL}>MCQ Section</span>
            </div>
            <MarkRow first icon={<List size={13} />} label="MCQ Mark"
              info="Auto-calculated from MCQ Marks in Exercise Details"
              right={<AutoValue value={formData.totalMarksMCQ || 'Auto'} />} />
            <MarkRow icon={<Award size={13} />} label="MCQ Mark to Pass"
              info="Minimum marks to pass the MCQ section (optional)"
              right={
                <div className="w-32">
                  <ONumberInput
                    value={g.mcqGradeToPass ?? 0}
                    onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, mcqGradeToPass: v } }))}
                    onBlur={() => markTouched('mcqGradeToPass')}
                    placeholder="0"
                    error={ve.mcqGradeToPass}
                    touched={tf.has('mcqGradeToPass')}
                    style={INPUT_STYLE}
                  />
                </div>
              } />
            <div className="flex items-center" style={{ padding: '10px 0 4px', borderTop: `1px solid ${D.border}` }}>
              <span style={ORANGE_PILL}>Programming Section</span>
            </div>
            <MarkRow first icon={<Terminal size={13} />} label="Programming Mark"
              info="Auto-calculated from Programming Marks in Exercise Details"
              right={<AutoValue value={formData.totalMarksProgramming || 'Auto'} />} />
            <MarkRow icon={<Award size={13} />} label="Programming Mark to Pass"
              info="Minimum marks to pass the programming section (optional)"
              right={
                <div className="w-32">
                  <ONumberInput
                    value={g.programmingGradeToPass ?? 0}
                    onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, programmingGradeToPass: v } }))}
                    onBlur={() => markTouched('programmingGradeToPass')}
                    placeholder="0"
                    error={ve.programmingGradeToPass}
                    touched={tf.has('programmingGradeToPass')}
                    style={INPUT_STYLE}
                  />
                </div>
              } />
          </>)}

          {!sep && showDifficultyPass && (
            <DifficultyPassSection />
          )}
        </>)}
      </SpecCard>

      {/* ── Grade Bands — performance scale by % of Total Mark (always shown) ── */}
      <SpecCard
        title="Grade Bands"
        icon={<List size={13} />}
        right={<>
          <span style={GREY_PILL}>Optional</span>
          <button
            type="button"
            onClick={addGradeBand}
            className="inline-flex items-center bg-white hover:bg-[#FAF9F8] transition-colors flex-shrink-0"
            style={{
              height: 29, padding: '0 10px', borderRadius: 8, border: `1px solid ${D.border2}`,
              fontSize: 11.5, fontWeight: 600, color: D.textMain, gap: 6, cursor: 'pointer',
            }}
          >
            <Plus size={12} /> Add
          </button>
        </>}
      >
        <p style={{ fontSize: 11.4, color: D.textMuted, marginBottom: 10 }}>
          Label performance by score percentage. Recommended values shown — edit, add or remove.
        </p>

        <div style={TABLE_WRAP}>
          <div
            className="grid"
            style={{ gridTemplateColumns: '1fr 190px 30px', gap: 8, background: '#FCFBFA', borderBottom: `1px solid ${D.border}` }}
          >
            <span style={TH}>Grade</span>
            <span className="text-center" style={TH}>Score Range (%)</span>
            <span />
          </div>
          {gradeBands.length === 0 ? (
            <div style={{ padding: '7px 9px', fontSize: 11.4, color: D.textMuted, background: '#fff' }}>
              No grade bands. Click <strong>Add</strong> to create one.
            </div>
          ) : (
            gradeBands.map((b: any, idx: number) => {
              const from = b.fromPercent ?? 0;
              const to = b.toPercent ?? 0;
              const invalid = from < 0 || to > 100 || from >= to;
              return (
                <div key={b.id} className="grid items-center"
                  style={{ gridTemplateColumns: '1fr 190px 30px', gap: 8, padding: '7px 9px', borderTop: idx > 0 ? `1px solid ${D.border}` : 'none', background: '#fff' }}>
                  <input
                    type="text"
                    value={b.label}
                    onChange={e => updateGradeBand(b.id, { label: e.target.value })}
                    placeholder="Grade name"
                    className="w-full border border-[#E9E5E1] bg-white outline-none transition-all focus:border-[#EE6A22] focus:shadow-[0_0_0_3px_rgba(238,106,34,0.13)]"
                    style={{ height: 30, borderRadius: 8, padding: '0 11px', fontSize: 12, color: D.textMain }}
                  />
                  <div>
                    <div className="flex items-center" style={{ gap: 5 }}>
                      <ONumberInput
                        value={from}
                        onChange={v => updateGradeBand(b.id, { fromPercent: v })}
                        placeholder="0"
                        min={0}
                        max={100}
                        style={INPUT_SM_STYLE}
                      />
                      <span className="flex-shrink-0" style={{ fontSize: 11.5, fontWeight: 600, color: D.textMuted }}>–</span>
                      <ONumberInput
                        value={to}
                        onChange={v => updateGradeBand(b.id, { toPercent: v })}
                        placeholder="0"
                        min={0}
                        max={100}
                        style={INPUT_SM_STYLE}
                      />
                      <span className="flex-shrink-0" style={{ fontSize: 11.5, fontWeight: 600, color: D.textMuted }}>%</span>
                    </div>
                    {invalid && (
                      <p style={{ marginTop: 2, fontSize: 11.4, color: '#912018' }}>From must be less than To (0–100)</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGradeBand(b.id)}
                    className="flex items-center justify-center bg-transparent text-[#6B7280] hover:text-[#D92D20] hover:bg-[#FEF3F2] transition-colors"
                    style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid transparent', padding: 0, cursor: 'pointer' }}
                    aria-label="Remove grade band"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })
          )}
          <div style={{ padding: '7px 9px', background: '#FCFBFA', borderTop: `1px solid ${D.border}`, fontSize: 11.4, color: D.textMuted }}>
            A student whose score percentage falls within a band's range earns that grade. Percentages are of the Total Mark.
          </div>
        </div>
      </SpecCard>

      {/* ── Additional Options ── */}
      <SpecCard title="Additional Options" icon={<Shield size={13} />} bodyStyle={{ padding: '2px 13px 6px' }}>
        {[
          {
            key: 'anonymousSubmissions',
            label: 'Anonymous Submissions',
            sub: "Enable for unbiased grading — graders won't see student names",
            icon: <EyeOff size={14} />,
            val: formData.additionalOptions.anonymousSubmissions,
          },
          {
            key: 'hideGraderIdentity',
            label: 'Hide Grader Identity',
            sub: 'Hide evaluator details from students',
            icon: <Shield size={14} />,
            val: formData.additionalOptions.hideGraderIdentity,
          },
        ].map((row, idx) => (
          <div key={row.key}
            className="flex items-center flex-wrap"
            style={{ gap: 12, padding: '9px 0', borderTop: idx > 0 ? `1px solid ${D.border}` : 'none' }}>
            <div className="flex items-center" style={{ gap: 8, minWidth: 220 }}>
              <span className="flex items-center flex-shrink-0" style={{ color: D.textHint }}>{row.icon}</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#101828', fontFamily: FONT }}>
                  {row.label}
                </div>
                <div style={{ fontSize: 11.4, color: D.textMuted, marginTop: 1 }}>{row.sub}</div>
              </div>
            </div>
            <SpecSwitch
              on={row.val}
              onClick={() => setFormData((prev: any) => ({
                ...prev,
                additionalOptions: { ...prev.additionalOptions, [row.key]: !row.val },
              }))}
              label={row.label}
            />
          </div>
        ))}
      </SpecCard>
    </div>
  );
};
