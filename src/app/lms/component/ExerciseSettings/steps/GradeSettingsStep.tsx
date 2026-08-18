import React from 'react';
import {
  Award, EyeOff, Hash, Layers, List, Plus, Shield, Terminal, Trash2,
} from 'lucide-react';
import { D, FONT } from '../shared/tokens';
import { GradeRow, InfoTooltip, ONumberInput } from '../shared/UIComponents';

// Recommended performance scale shown by default (percentage of Total Mark).
// Always rendered; teachers can edit labels/percentages, add rows, or remove them.
const DEFAULT_GRADE_BANDS = [
  { id: 'band_poor', label: 'Poor', fromPercent: 0, toPercent: 40 },
  { id: 'band_average', label: 'Average', fromPercent: 40, toPercent: 60 },
  { id: 'band_good', label: 'Good', fromPercent: 60, toPercent: 80 },
  { id: 'band_excellent', label: 'Excellent', fromPercent: 80, toPercent: 100 },
];

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

  const levelColors = { easy: D.emerald, medium: D.amber, hard: D.red };
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
      <div className="rounded-xl overflow-hidden mt-2" style={{ border: `1px solid ${D.purple}25` }}>
        {titleLabel && (
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: D.orangeLight, color: D.orange, borderBottom: `1px solid ${D.purple}20` }}>
            {titleLabel}
          </div>
        )}
        <div
          className="grid px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
          style={{
            background: D.purple + '08',
            borderBottom: `1px solid ${D.purple}20`,
            gridTemplateColumns: '80px 1fr 1fr',
            color: D.textMuted,
          }}
        >
          <span>Level</span>
          <span className="text-center">Total Marks</span>
          <span className="text-center">Mark to Pass</span>
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
              className="grid items-center px-3 py-2"
              style={{
                gridTemplateColumns: '80px 1fr 1fr',
                gap: '8px',
                borderTop: idx > 0 ? `1px solid ${D.border}` : 'none',
                background: D.bg,
              }}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: levelColors[level] }} />
                <span className="text-xs font-bold capitalize" style={{ color: levelColors[level], fontFamily: FONT }}>
                  {levelLabels[level]}
                </span>
              </div>
              <div className="relative flex justify-center">
                <div
                  className="px-3 py-1.5 rounded-lg border text-sm font-bold text-center w-full"
                  style={{ borderColor: D.border, background: levelColors[level] + '0d', color: levelColors[level], fontFamily: FONT }}
                >
                  {levelTotal}
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: levelColors[level] + 'aa' }}>
                    Auto
                  </span>
                </div>
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
                />
                {levelTotal > 0 && (passMarkValue ?? 0) > levelTotal && (
                  <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>Cannot exceed {levelTotal}</p>
                )}
              </div>
            </div>
          );
        })}

        <div
          className="px-3 py-2 text-[10.5px] font-medium"
          style={{ background: D.purple + '06', borderTop: `1px solid ${D.purple}15`, color: D.textMuted }}
        >
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
      { level: 'easy' as const,   label: 'Easy',   color: D.emerald, total: splitTotals.easy,   stateKey: 'mcqEasyPassMark'   as const },
      { level: 'medium' as const, label: 'Medium', color: D.amber,   total: splitTotals.medium, stateKey: 'mcqMediumPassMark' as const },
      { level: 'hard' as const,   label: 'Hard',   color: D.red,     total: splitTotals.hard,   stateKey: 'mcqHardPassMark'   as const },
    ];

    return (
      <div className="rounded-xl overflow-hidden mt-2" style={{ border: `1px solid ${D.blue}25` }}>
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ background: D.blue + '12', color: D.blue, borderBottom: `1px solid ${D.blue}20` }}>
          MCQ Section
        </div>
        <div
          className="grid px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
          style={{
            background: D.blue + '08',
            borderBottom: `1px solid ${D.blue}20`,
            gridTemplateColumns: '80px 1fr 1fr',
            color: D.textMuted,
          }}
        >
          <span>Level</span>
          <span className="text-center">Total Marks</span>
          <span className="text-center">Mark to Pass</span>
        </div>

        {rows.map((row, idx) => {
          const value = g[row.stateKey];
          return (
            <div
              key={row.level}
              className="grid items-center px-3 py-2"
              style={{
                gridTemplateColumns: '80px 1fr 1fr',
                gap: '8px',
                background: D.bg,
                borderTop: idx === 0 ? 'none' : `1px solid ${D.blue}10`,
              }}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                <span className="text-xs font-bold" style={{ color: row.color, fontFamily: FONT }}>
                  {row.label}
                </span>
              </div>
              <div className="relative flex justify-center">
                <div
                  className="px-3 py-1.5 rounded-lg border text-sm font-bold text-center w-full"
                  style={{ borderColor: D.border, background: D.blue + '0d', color: D.blue, fontFamily: FONT }}
                >
                  {row.total}
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold" style={{ color: D.blue + 'aa' }}>
                    Auto
                  </span>
                </div>
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
                />
                {row.total > 0 && (value ?? 0) > row.total && (
                  <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>Cannot exceed {row.total}</p>
                )}
              </div>
            </div>
          );
        })}

        <div
          className="px-3 py-2 text-[10.5px] font-medium"
          style={{ background: D.blue + '06', borderTop: `1px solid ${D.blue}15`, color: D.textMuted }}
        >
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
      <div className="mt-3 pt-3 border-t" style={{ borderColor: D.border }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ background: D.purple + '15', color: D.purple }}>
              <Hash size={11} />
            </div>
            <div>
              <span className="text-xs font-semibold" style={{ color: D.textMain, fontFamily: FONT }}>
                Mark to Pass by Difficulty
              </span>
              <InfoTooltip
                content="Set separate passing marks for each difficulty level. When enabled, the overall Mark to Pass field is hidden."
                side="right"
              />
              <p className="text-[10.5px]" style={{ color: D.textMuted }}>
                {isCombinedDiff
                  ? 'Configure MCQ and Programming pass marks separately — each section stores its own data.'
                  : 'Configure minimum passing marks per difficulty level'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              setFormData((prev: any) => ({
                ...prev,
                grades: { ...prev.grades, difficultyPassEnabled: !prev.grades.difficultyPassEnabled },
              }))
            }
            className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
            style={{ background: g.difficultyPassEnabled ? D.purple : '#e5e7eb' }}
          >
            <span
              className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${g.difficultyPassEnabled ? 'translate-x-[17px]' : 'translate-x-0'}`}
            />
          </button>
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

        {g.difficultyPassEnabled && <div className="mt-3 pt-3 border-t" style={{ borderColor: D.border }}>
          <div className="flex items-start gap-2.5">
            <input
              type="checkbox"
              id="overallMarkToPassEnabled"
              checked={g.overallMarkToPassEnabled ?? false}
              onChange={e => setFormData((prev: any) => ({
                ...prev,
                grades: { ...prev.grades, overallMarkToPassEnabled: e.target.checked, overallMarkToPass: e.target.checked ? prev.grades.overallMarkToPass : null }
              }))}
              className="mt-0.5 w-3.5 h-3.5 rounded cursor-pointer"
              style={{ accentColor: D.orange }}
            />
            <div className="flex-1">
              <label htmlFor="overallMarkToPassEnabled" className="text-xs font-semibold cursor-pointer" style={{ color: D.textMain, fontFamily: FONT }}>
                Mark to Pass <span className="font-normal" style={{ color: D.textMuted }}>(Optional)</span>
              </label>
              <p className="text-[10.5px] mt-0.5" style={{ color: D.textMuted }}>
                When enabled, this single value overrides per-difficulty pass/fail rules.
              </p>
              {(g.overallMarkToPassEnabled) && (
                <div className="mt-2 w-32 animate-in fade-in slide-in-from-top-1 duration-200">
                  <ONumberInput
                    value={g.overallMarkToPass ?? 0}
                    onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, overallMarkToPass: v || null } }))}
                    placeholder="0"
                    min={0}
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
    <div className="px-10 pt-4 pb-6">
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${D.border}` }}>
        <div className="px-3">

          {/* MCQ */}
          {et === 'MCQ' && (<>
            <GradeRow icon={<List size={13} />} color={D.blue} label="Total Mark"
              info="Auto-calculated from MCQ total marks"
              autoValue={formData.totalMarks || 'Auto'} />
            <GradeRow icon={<Award size={13} />} color={D.blue} label="Mark to Pass"
              info="Minimum marks to pass — cannot exceed Total Mark (optional)"
              fieldKey="mcqGradeToPass" value={g.mcqGradeToPass}
              onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, mcqGradeToPass: v } }))}
              onBlur={() => markTouched('mcqGradeToPass')}
              error={ve.mcqGradeToPass} errorTouched={tf.has('mcqGradeToPass')} optional />
          </>)}

          {/* Other */}
          {et === 'Other' && (<>
            <GradeRow icon={<Terminal size={13} />} color={D.orange} label="Total Mark"
              info="Auto-calculated from total marks"
              autoValue={formData.totalMarks || 'Auto'} />
            {!diffEnabled && (
              <GradeRow icon={<Award size={13} />} color={D.orange} label="Mark to Pass"
                info="Minimum marks required to pass — cannot exceed Total Mark (optional)"
                fieldKey="programmingGradeToPass" value={g.programmingGradeToPass}
                onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, programmingGradeToPass: v } }))}
                onBlur={() => markTouched('programmingGradeToPass')}
                error={ve.programmingGradeToPass} errorTouched={tf.has('programmingGradeToPass')} optional />
            )}
            {showDifficultyPass && (
              <div className="pb-2"><DifficultyPassSection /></div>
            )}
          </>)}

          {/* Programming */}
          {et === 'Programming' && (<>
            <GradeRow icon={<Terminal size={13} />} color={D.orange} label="Total Mark"
              info="Auto-calculated from Step 1 total marks — read only"
              autoValue={formData.totalMarks || 'Auto'} />
            {!diffEnabled && (
              <GradeRow icon={<Award size={13} />} color={D.orange} label="Mark to Pass"
                info="Minimum marks required to pass — cannot exceed Total Mark (optional)"
                fieldKey="programmingGradeToPass" value={g.programmingGradeToPass}
                onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, programmingGradeToPass: v } }))}
                onBlur={() => markTouched('programmingGradeToPass')}
                error={ve.programmingGradeToPass} errorTouched={tf.has('programmingGradeToPass')} optional />
            )}
            {showDifficultyPass && (
              <div className="pb-2"><DifficultyPassSection /></div>
            )}
          </>)}

          {/* Combined */}
          {et === 'Combined' && (<>
            <div className="flex items-center justify-between py-2.5 border-b" style={{ borderColor: D.border }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: D.purple + '12', color: D.purple }}>
                  <Layers size={13} />
                </div>
                <div>
                  <span className="text-xs font-semibold" style={{ color: D.textMain, fontFamily: FONT }}>
                    Separate Marks
                  </span>
                  <p className="text-[10.5px]" style={{ color: D.textMuted }}>
                    Mark each section (MCQ &amp; Programming) independently
                  </p>
                </div>
              </div>
              <button type="button"
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
                className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
                style={{ background: sep ? D.orange : '#e5e7eb' }}>
                <span className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${sep ? 'translate-x-[17px]' : 'translate-x-0'}`} />
              </button>
            </div>

            {!sep ? (<>
              {(() => {
                const ag = (formData.totalMarksMCQ || 0) + (formData.totalMarksProgramming || 0);
                return (<>
                  <GradeRow icon={<Layers size={13} />} color={D.emerald} label="Mark"
                    info="Auto-calculated: MCQ total + Programming total"
                    autoValue={ag > 0 ? ag : 'Auto'} />
                  {!diffEnabled && (
                    <GradeRow icon={<Award size={13} />} color={D.emerald} label="Mark to Pass"
                      info={`Overall passing marks — cannot exceed Mark${ag > 0 ? ` (${ag})` : ''} (optional)`}
                      fieldKey="combinedGradeToPass" value={g.combinedGradeToPass}
                      onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, combinedGradeToPass: v } }))}
                      onBlur={() => markTouched('combinedGradeToPass')}
                      error={ve.combinedGradeToPass} errorTouched={tf.has('combinedGradeToPass')} optional />
                  )}
                </>);
              })()}
            </>) : (<>
              <div className="pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: D.blue }}>MCQ Section</div>
              <GradeRow icon={<List size={13} />} color={D.blue} label="MCQ Mark"
                info="Auto-calculated from MCQ Marks in Exercise Details"
                autoValue={formData.totalMarksMCQ || 'Auto'} />
              <GradeRow icon={<Award size={13} />} color={D.blue} label="MCQ Mark to Pass"
                info="Minimum marks to pass the MCQ section (optional)"
                fieldKey="mcqGradeToPass" value={g.mcqGradeToPass}
                onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, mcqGradeToPass: v } }))}
                onBlur={() => markTouched('mcqGradeToPass')}
                error={ve.mcqGradeToPass} errorTouched={tf.has('mcqGradeToPass')} optional />
              <div className="pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide" style={{ color: D.orange }}>Programming Section</div>
              <GradeRow icon={<Terminal size={13} />} color={D.orange} label="Programming Mark"
                info="Auto-calculated from Programming Marks in Exercise Details"
                autoValue={formData.totalMarksProgramming || 'Auto'} />
              <GradeRow icon={<Award size={13} />} color={D.orange} label="Programming Mark to Pass"
                info="Minimum marks to pass the programming section (optional)"
                fieldKey="programmingGradeToPass" value={g.programmingGradeToPass}
                onChange={v => setFormData((prev: any) => ({ ...prev, grades: { ...prev.grades, programmingGradeToPass: v } }))}
                onBlur={() => markTouched('programmingGradeToPass')}
                error={ve.programmingGradeToPass} errorTouched={tf.has('programmingGradeToPass')} optional />
            </>)}

            {!sep && showDifficultyPass && (
              <div className="pb-2"><DifficultyPassSection /></div>
            )}
          </>)}

          {/* ── Grade Bands — performance scale by % of Total Mark (always shown) ── */}
          <div className="py-3 border-t" style={{ borderColor: D.border }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: D.purple + '15', color: D.purple }}>
                  <Award size={11} />
                </div>
                <div>
                  <span className="text-xs font-semibold" style={{ color: D.textMain, fontFamily: FONT }}>
                    Grade Bands <span className="font-normal" style={{ color: D.textMuted }}>(Optional)</span>
                  </span>
                  <p className="text-[10.5px]" style={{ color: D.textMuted }}>
                    Label performance by score percentage. Recommended values shown — edit, add or remove.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={addGradeBand}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0"
                style={{ background: D.purple + '12', color: D.purple, fontFamily: FONT }}
              >
                <Plus size={12} /> Add
              </button>
            </div>

            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${D.purple}25` }}>
              <div className="grid px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
                style={{ background: D.purple + '08', borderBottom: `1px solid ${D.purple}20`, gridTemplateColumns: '1fr 190px 28px', gap: '8px', color: D.textMuted }}>
                <span>Grade</span>
                <span className="text-center">Score Range (%)</span>
                <span />
              </div>
              {gradeBands.length === 0 ? (
                <div className="px-3 py-2 text-[11px]" style={{ color: D.textMuted, background: D.bg }}>
                  No grade bands. Click <strong>Add</strong> to create one.
                </div>
              ) : (
                gradeBands.map((b: any, idx: number) => {
                  const from = b.fromPercent ?? 0;
                  const to = b.toPercent ?? 0;
                  const invalid = from < 0 || to > 100 || from >= to;
                  return (
                    <div key={b.id} className="grid items-center px-3 py-2"
                      style={{ gridTemplateColumns: '1fr 190px 28px', gap: '8px', borderTop: idx > 0 ? `1px solid ${D.border}` : 'none', background: D.bg }}>
                      <input
                        type="text"
                        value={b.label}
                        onChange={e => updateGradeBand(b.id, { label: e.target.value })}
                        placeholder="Grade name"
                        className="px-2 py-1.5 text-xs rounded-lg border w-full"
                        style={{ borderColor: D.border, fontFamily: FONT, color: D.textMain, background: D.bg }}
                      />
                      <div>
                        <div className="flex items-center gap-1">
                          <ONumberInput
                            value={from}
                            onChange={v => updateGradeBand(b.id, { fromPercent: v })}
                            placeholder="0"
                            min={0}
                            max={100}
                          />
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: D.textMuted, fontFamily: FONT }}>–</span>
                          <ONumberInput
                            value={to}
                            onChange={v => updateGradeBand(b.id, { toPercent: v })}
                            placeholder="0"
                            min={0}
                            max={100}
                          />
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: D.textMuted, fontFamily: FONT }}>%</span>
                        </div>
                        {invalid && (
                          <p className="mt-0.5 text-[10px]" style={{ color: D.red }}>From must be less than To (0–100)</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeGradeBand(b.id)}
                        className="w-6 h-6 rounded flex items-center justify-center"
                        style={{ background: D.red + '12', color: D.red }}
                        aria-label="Remove grade band"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })
              )}
              <div className="px-3 py-2 text-[10.5px] font-medium"
                style={{ background: D.purple + '06', borderTop: `1px solid ${D.purple}15`, color: D.textMuted }}>
                A student whose score percentage falls within a band's range earns that grade. Percentages are of the Total Mark.
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Additional Options */}
      <div className="mt-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield size={13} style={{ color: D.purple }} />
          <span className="text-xs font-bold" style={{ color: D.textMain, fontFamily: FONT }}>
            Additional Options
          </span>
        </div>
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${D.border}` }}>
          {[
            {
              key: 'anonymousSubmissions',
              label: 'Anonymous Submissions',
              sub: "Enable for unbiased grading — graders won't see student names",
              icon: <EyeOff size={14} />,
              color: D.purple,
              val: formData.additionalOptions.anonymousSubmissions,
            },
            {
              key: 'hideGraderIdentity',
              label: 'Hide Grader Identity',
              sub: 'Hide evaluator details from students',
              icon: <Shield size={14} />,
              color: D.blue,
              val: formData.additionalOptions.hideGraderIdentity,
            },
          ].map((row, idx) => (
            <div key={row.key}
              className="flex items-center justify-between px-3 py-2.5 transition-all"
              style={{ background: D.bg, borderTop: idx > 0 ? `1px solid ${D.border}` : 'none' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: row.color + '12', color: row.color }}>
                  {row.icon}
                </div>
                <div>
                  <div className="text-xs font-semibold" style={{ color: D.textMain, fontFamily: FONT }}>
                    {row.label}
                  </div>
                  <div className="text-[10.5px]" style={{ color: D.textMuted }}>{row.sub}</div>
                </div>
              </div>
              <button type="button"
                onClick={() => setFormData((prev: any) => ({
                  ...prev,
                  additionalOptions: { ...prev.additionalOptions, [row.key]: !row.val },
                }))}
                className="relative inline-flex items-center h-5 w-9 flex-shrink-0 rounded-full border-transparent transition-colors duration-200 p-[2px]"
                style={{ background: row.val ? D.orange : '#e5e7eb' }}>
                <span className={`inline-block h-[13px] w-[13px] transform rounded-full bg-white shadow transition-transform duration-200 ${row.val ? 'translate-x-[17px]' : 'translate-x-0'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
