// ProgrammingConfiguration.tsx
import React from 'react';
import { Terminal, AlertCircle, Check, Shuffle, Calculator } from 'lucide-react';
import { D, formatDecimal, isApproximatelyEqual, configOptions, questionFlowOptions } from './constants';
import { BaseConfigProps } from './types';
import { SectionLabel, ODropdown, ONumberInput, OToggle } from './UIComponents';
import {
  EvaluationMethodConfig,
  DEFAULT_EVALUATION_METHOD,
  type EvaluationMethod,
} from '@/app/lms/component/evaluation/EvaluationMethodConfig';

// You_Do assessments only ever grade themselves — the whole point of the tab.
// Manual is deliberately absent: the config picker is Test Case OR AI, and the
// student's Submit routes to exactly the one method the trainer picked.
// EvaluationMethodConfig migrates any pre-restriction You_Do saved as Manual
// up to the first allowed method silently on mount, so switching to this
// narrower list can't strand an old exercise on an invalid value.
const YOUDO_ALLOWED_METHODS: EvaluationMethod[] = ['testcase', 'ai'];

export const ProgrammingConfiguration: React.FC<BaseConfigProps> = ({
  formData, setFormData, setValidationErrors, validationErrors, touchedFields, markTouched,
  InfoTooltip, SectionLabel, ODropdown, ONumberInput, OToggle,
  D: designTokens, configOptions, questionFlowOptions,
  getProgrammingTotalQuestions, programmingAllocatedMarks, programmingLevelMismatch,
  updateLevelScoringConfig
}) => {
  const isCombined = formData.exerciseType === 'Combined';
  const totalToUse = isCombined ? formData.totalMarksProgramming : formData.totalMarks;
  const isMatch = isApproximatelyEqual(programmingAllocatedMarks || 0, totalToUse);

  // Update marks when general question count changes
  const updateGeneralMarks = (questionCount: number) => {
    const newEqualDistribution = questionCount > 0 && totalToUse > 0 ? totalToUse / questionCount : 0;
    
    setFormData(prev => ({
      ...prev,
      programmingConfig: {
        ...prev.programmingConfig,
        generalQuestionCount: questionCount,
        scoreSettings: {
          ...prev.programmingConfig.scoreSettings,
          equalDistribution: newEqualDistribution
        }
      }
    }));
  };

  const scoringCounts = formData.programmingConfig.questionConfigType === 'selectionLevel'
    ? formData.programmingConfig.selectionLevelCounts
    : formData.programmingConfig.levelBasedCounts;
  const ls = formData.programmingConfig.scoreSettings.levelScoringConfiguration;
  const scoringErrors = (validationErrors.programmingLevelScoring as Record<string, string>) || {};
  const levelColors = { easy: designTokens.emerald, medium: designTokens.amber, hard: designTokens.red };

  return (
    <div className="px-4 py-3">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <Terminal size={16} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold leading-tight" style={{ color: designTokens.textMain }}>
              Programming Configuration
            </h2>
            {isCombined && totalToUse > 0 && (
              <p className="text-[10px] mt-0.5" style={{ color: designTokens.textMuted }}>
                Total Programming Marks: <strong style={{ color: designTokens.orange }}>{totalToUse}</strong>
              </p>
            )}
          </div>
        </div>
        {isMatch && programmingAllocatedMarks > 0 && totalToUse > 0 && (
          <div className="text-right">
            <div className="text-[10px] font-semibold" style={{ color: designTokens.emerald }}>Allocated</div>
            <div className="text-sm font-bold" style={{ color: designTokens.emerald }}>
              {formatDecimal(programmingAllocatedMarks)}<span className="text-xs font-normal" style={{ color: designTokens.textMuted }}>/{totalToUse}</span>
            </div>
          </div>
        )}
      </div>

      {programmingLevelMismatch && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: designTokens.red + '10', border: `1px solid ${designTokens.red}40` }}>
          <AlertCircle size={13} style={{ color: designTokens.red }} />
          <p className="text-xs font-semibold flex-1" style={{ color: designTokens.red }}>{programmingLevelMismatch}</p>
        </div>
      )}

      <div className="space-y-3" style={{ border: `1px solid ${designTokens.border}`, borderRadius: 14, background: '#fff', padding: '16px 18px' }}>
        {/* Config Strategy */}
        <div>
          <SectionLabel info="General: fixed question count; Level Based: questions by difficulty (Easy/Medium/Hard); Selection Level: pick up to 2 difficulty levels">
            Config Strategy
          </SectionLabel>
          <ODropdown
            value={formData.programmingConfig.questionConfigType}
            options={configOptions}
            onChange={v => {
              setFormData(prev => ({
                ...prev,
                programmingConfig: {
                  ...prev.programmingConfig,
                  questionConfigType: v as any,
                  ...(v === 'general'
                    ? { generalQuestionCount: 0, levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                    : { levelBasedCounts: { easy: 0, medium: 0, hard: 0 }, selectionLevelCounts: { easy: 0, medium: 0, hard: 0 } }
                  )
                }
              }));
            }}
          />
        </div>

        {/* General Configuration */}
        {formData.programmingConfig.questionConfigType === 'general' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <SectionLabel required info="Total number of programming questions">Total Questions</SectionLabel>
              <ONumberInput
                value={formData.programmingConfig.generalQuestionCount}
                onChange={v => {
                  updateGeneralMarks(v);
                  if (v > 0) {
                    setValidationErrors(prev => { const e = { ...prev }; delete e.programmingGeneralQuestionCount; return e; });
                  }
                }}
                onBlur={() => markTouched('programmingGeneralQuestionCount')}
                min={1}
                placeholder="e.g. 5"
                error={validationErrors.programmingGeneralQuestionCount}
                touched={touchedFields.has('programmingGeneralQuestionCount')}
              />
              {totalToUse <= 0 && (
                <p className="text-[10px] mt-1" style={{ color: designTokens.amber }}>
                  ⚠️ Set Programming marks in Exercise Details first
                </p>
              )}
            </div>
            <div>
              <SectionLabel info="Auto-calculated from total marks">Marks Per Question</SectionLabel>
              <div className="relative">
                <input
                  type="text"
                  value={formatDecimal(formData.programmingConfig.scoreSettings.equalDistribution)}
                  disabled
                  readOnly
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{ borderColor: designTokens.border, background: designTokens.surface, color: designTokens.textMuted }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color: designTokens.orange }}>Auto</span>
              </div>
              {formData.programmingConfig.generalQuestionCount > 0 && totalToUse > 0 && (
                <p className="mt-1 text-[11px]" style={{ color: designTokens.textMuted }}>
                  {totalToUse} ÷ {formData.programmingConfig.generalQuestionCount} = <strong style={{ color: designTokens.textSub }}>{formatDecimal(formData.programmingConfig.scoreSettings.equalDistribution)}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Level Based / Selection Level Configuration */}
        {(formData.programmingConfig.questionConfigType === 'levelBased' || formData.programmingConfig.questionConfigType === 'selectionLevel') && (
          <>
            <div className="flex items-center gap-1">
              <Calculator size={12} style={{ color: designTokens.textMuted }} />
              <span className="text-xs font-semibold" style={{ color: designTokens.textMain }}>Questions and Scoring Configuration</span>
            </div>

            {(() => {
              const isSelLevel = formData.programmingConfig.questionConfigType === 'selectionLevel';
              const gridCols = '70px 1fr 1fr 1fr';
              const rowStyle = { display: 'grid', gridTemplateColumns: gridCols, gap: '6px', marginBottom: '4px', alignItems: 'center' } as const;
              
              return (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '6px', marginBottom: '4px', alignItems: 'end' }}>
                    <div />
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      if (isSelLevel) {
                        const checked = (formData.programmingConfig.selectionLevelCounts?.[level] ?? 0) > 0;
                        return (
                          <div key={level}>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const nc = { ...formData.programmingConfig.selectionLevelCounts, [level]: e.target.checked ? 1 : 0 };
                                  const active = (['easy', 'medium', 'hard'] as const).filter(l => nc[l] > 0).length;
                                  if (active > 2) {
                                    setFormData(prev => ({
                                      ...prev,
                                      programmingConfig: {
                                        ...prev.programmingConfig,
                                        questionConfigType: 'levelBased',
                                        levelBasedCounts: { easy: nc.easy > 0 ? nc.easy : 1, medium: nc.medium > 0 ? nc.medium : 1, hard: nc.hard > 0 ? nc.hard : 1 },
                                        selectionLevelCounts: { easy: 0, medium: 0, hard: 0 }
                                      }
                                    }));
                                  } else {
                                    setFormData(prev => ({ ...prev, programmingConfig: { ...prev.programmingConfig, selectionLevelCounts: nc } }));
                                  }
                                }}
                                className="w-3 h-3 rounded"
                                style={{ accentColor: levelColors[level] }}
                              />
                              <span className="text-[10px] font-bold capitalize" style={{ color: levelColors[level] }}>{level}</span>
                            </label>
                          </div>
                        );
                      }
                      return <div key={level} className="text-[10px] font-bold capitalize" style={{ color: levelColors[level] }}>{level}</div>;
                    })}
                  </div>

                  <div style={rowStyle}>
                    <div className="text-[10px] font-semibold" style={{ color: designTokens.textMuted }}>Questions</div>
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      const checked = isSelLevel ? (formData.programmingConfig.selectionLevelCounts?.[level] ?? 0) > 0 : true;
                      const val = isSelLevel
                        ? (formData.programmingConfig.selectionLevelCounts?.[level] === 0 ? '' : formData.programmingConfig.selectionLevelCounts?.[level])
                        : (formData.programmingConfig.levelBasedCounts?.[level] === 0 ? '' : formData.programmingConfig.levelBasedCounts?.[level]);
                      const handleChange = isSelLevel
                        ? (v: number) => setFormData(prev => ({ ...prev, programmingConfig: { ...prev.programmingConfig, selectionLevelCounts: { ...prev.programmingConfig.selectionLevelCounts, [level]: v } } }))
                        : (v: number) => setFormData(prev => ({ ...prev, programmingConfig: { ...prev.programmingConfig, levelBasedCounts: { ...prev.programmingConfig.levelBasedCounts, [level]: v } } }));
                      return (
                        <div key={level}>
                          <ONumberInput
                            value={val}
                            onChange={handleChange}
                            onBlur={isSelLevel ? undefined : () => markTouched('programmingLevelCounts')}
                            disabled={isSelLevel && !checked}
                            min={0}
                            placeholder={isSelLevel && !checked ? '—' : 'Count'}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div style={rowStyle}>
                    <div className="text-[10px] font-semibold" style={{ color: designTokens.textMuted }}>Score Type</div>
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      const count = scoringCounts[level];
                      const scoring = ls[level];
                      const hasError = touchedFields.has(`scoring_${level}`) && !!scoringErrors[level];
                      return (
                        <div key={level} style={{ opacity: count === 0 ? 0.4 : 1, pointerEvents: count === 0 ? 'none' : 'auto' }}>
                          <select
                            value={scoring?.type || 'level_specific'}
                            onChange={e => updateLevelScoringConfig?.(level, {
                              type: e.target.value as any,
                              ...(e.target.value === 'level_specific' ? { marksPerQuestion: 2, totalMarks: undefined } : { totalMarks: 10, marksPerQuestion: undefined })
                            })}
                            className="w-full px-2 py-1.5 text-xs rounded-lg border outline-none"
                            style={{ borderColor: hasError ? designTokens.red + '60' : designTokens.border, background: '#fff', color: designTokens.textMain }}
                          >
                            <option value="level_specific">Level-specific</option>
                            <option value="question_specific">Question-specific</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  <div style={rowStyle}>
                    <div className="text-[10px] font-semibold" style={{ color: designTokens.textMuted }}>Marks</div>
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      const count = scoringCounts[level];
                      const scoring = ls[level];
                      const isQSpec = scoring?.type === 'question_specific';
                      const hasError = touchedFields.has(`scoring_${level}`) && !!scoringErrors[level];
                      return (
                        <div key={level} style={{ opacity: count === 0 ? 0.4 : 1, pointerEvents: count === 0 ? 'none' : 'auto' }}>
                          <ONumberInput
                            value={isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0)}
                            onChange={v => updateLevelScoringConfig?.(level, isQSpec ? { totalMarks: v } : { marksPerQuestion: v })}
                          />
                          {hasError && <span className="text-[10px]" style={{ color: designTokens.red }}>{scoringErrors[level]}</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '6px', alignItems: 'center' }}>
                    <div className="text-[10px] font-semibold" style={{ color: designTokens.textMuted }}>Total</div>
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      const count = scoringCounts[level];
                      if (count === 0) return <div key={level} />;
                      const scoring = ls[level];
                      const isQSpec = scoring?.type === 'question_specific';
                      const total = isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0) * count;
                      return (
                        <div key={level} className="text-center text-xs font-semibold py-1 rounded" style={{ background: levelColors[level] + '10', color: levelColors[level] }}>
                          {total} marks
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}

        <div style={{ borderTop: `1px solid ${designTokens.border}` }} />

        {/* Question Flow */}
        <div>
          <SectionLabel info="Free Flow: any order; Controlled: sequential">Question Flow</SectionLabel>
          <div className="flex gap-2">
            {questionFlowOptions.map(opt => {
              const sel = formData.programmingConfig.questionFlow === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, programmingConfig: { ...prev.programmingConfig, questionFlow: opt.value as any } }))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                  style={{
                    borderColor: sel ? designTokens.orange : designTokens.border,
                    background: sel ? designTokens.orangeLight : designTokens.bg,
                    color: sel ? designTokens.orange : designTokens.textMain,
                  }}
                >
                  <Shuffle size={11} style={{ color: sel ? designTokens.orange : designTokens.textMuted }} />
                  {opt.label}
                  {sel && <Check size={11} style={{ color: designTokens.orange }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Evaluation Method — Test Case OR AI (no Manual for You_Do; the
            allowed set is enforced by the shared config). The picked method is
            the single source of truth for the student's Submit: Test Case runs
            the question's authored cases via Piston; AI hands the (multi-file
            or single-file) submission to the shared client-side AI grader.
            See the You_Do editor's `resolveEvaluationMethod` branch. */}
        <div className="pt-3 border-t" style={{ borderColor: designTokens.border }}>
          <EvaluationMethodConfig
            value={formData.evaluationMethod || DEFAULT_EVALUATION_METHOD}
            onChange={next => setFormData(prev => ({ ...prev, evaluationMethod: next }))}
            D={designTokens}
            ODropdown={ODropdown}
            SectionLabel={SectionLabel}
            allowedMethods={YOUDO_ALLOWED_METHODS}
          />
        </div>

        {/* Attempt Limit */}
        <div className="pt-2 border-t" style={{ borderColor: designTokens.border }}>
          <OToggle
            enabled={formData.programmingConfig.attemptLimitEnabled}
            onChange={v => setFormData(prev => ({
              ...prev,
              programmingConfig: {
                ...prev.programmingConfig,
                attemptLimitEnabled: v,
                submissionAttempts: v ? prev.programmingConfig.submissionAttempts : 1
              }
            }))}
            label="Attempt Limit"
            description="Restrict the number of submission attempts"
          />
          {formData.programmingConfig.attemptLimitEnabled && (
            <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <SectionLabel info="Maximum number of times a student can submit their code (1–10)">Attempts Allowed</SectionLabel>
              <div className="w-28">
                <ONumberInput
                  value={formData.programmingConfig.submissionAttempts}
                  onChange={v => setFormData(prev => ({
                    ...prev,
                    programmingConfig: {
                      ...prev.programmingConfig,
                      submissionAttempts: Math.max(1, Math.min(10, v))
                    }
                  }))}
                  min={1}
                  max={10}
                />
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};