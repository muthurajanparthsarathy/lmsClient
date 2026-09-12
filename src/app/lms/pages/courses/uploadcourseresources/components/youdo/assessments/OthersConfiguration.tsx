// assessments/OthersConfiguration.tsx
import React from 'react';
import { FolderOpen, AlertCircle, Check, Shuffle, Calculator } from 'lucide-react';
import { D, formatDecimal, isApproximatelyEqual } from './constants';
import { BaseConfigProps } from './types';

export const OthersConfiguration: React.FC<BaseConfigProps> = ({
  formData, setFormData, setValidationErrors, validationErrors, touchedFields, markTouched,
  InfoTooltip, SectionLabel, ODropdown, ONumberInput, OToggle,
  D: designTokens, configOptions, questionFlowOptions,
  othersAllocatedMarks, othersLevelMismatch, updateOthersLevelScoringConfig
}) => {
  const totalToUse = formData.totalMarks;
  const isMatch = isApproximatelyEqual(othersAllocatedMarks || 0, totalToUse);

  const scoringCounts = formData.othersConfig.questionConfigType === 'selectionLevel'
    ? formData.othersConfig.selectionLevelCounts
    : formData.othersConfig.levelBasedCounts;
  const ls = formData.othersConfig.scoreSettings.levelScoringConfiguration;
  const scoringErrors = (validationErrors.othersLevelScoring as Record<string, string>) || {};
  const levelColors = { easy: designTokens.emerald, medium: designTokens.amber, hard: designTokens.red };

  return (
    <div className="px-4 py-3">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#ede9fe', color: '#7c3aed' }}>
            <FolderOpen size={16} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold leading-tight" style={{ color: designTokens.textMain }}>Others Configuration</h2>
            <p className="text-xs mt-0.5" style={{ color: designTokens.textMuted }}>Configure other-type question marks and distribution.</p>
          </div>
        </div>
        {isMatch && othersAllocatedMarks > 0 && (
          <div className="text-right">
            <div className="text-[10px] font-semibold" style={{ color: designTokens.emerald }}>Allocated</div>
            <div className="text-sm font-bold" style={{ color: designTokens.emerald }}>
              {formatDecimal(othersAllocatedMarks)}<span className="text-xs font-normal" style={{ color: designTokens.textMuted }}>/{totalToUse}</span>
            </div>
          </div>
        )}
      </div>

      {othersLevelMismatch && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: designTokens.red + '10', border: `1px solid ${designTokens.red}40` }}>
          <AlertCircle size={13} style={{ color: designTokens.red }} />
          <p className="text-xs font-semibold flex-1" style={{ color: designTokens.red }}>{othersLevelMismatch}</p>
        </div>
      )}

      <div className="space-y-3" style={{ border: `1px solid ${designTokens.border}`, borderRadius: 14, background: '#fff', padding: '16px 18px' }}>
        {/* Config Strategy */}
        <div>
          <SectionLabel info="General: fixed question count; Level Based: questions by difficulty (Easy/Medium/Hard); Selection Level: pick up to 2 difficulty levels">
            Config Strategy
          </SectionLabel>
          <ODropdown
            value={formData.othersConfig.questionConfigType}
            options={configOptions}
            onChange={v => {
              setFormData(prev => ({
                ...prev,
                othersConfig: {
                  ...prev.othersConfig,
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
        {formData.othersConfig.questionConfigType === 'general' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <SectionLabel required info="Total number of questions">Total Questions</SectionLabel>
              <ONumberInput
                value={formData.othersConfig.generalQuestionCount}
                onChange={v => {
                  if (v > 0) setValidationErrors(prev => { const e = { ...prev }; delete e.othersGeneralQuestionCount; return e; });
                  setFormData(prev => ({
                    ...prev,
                    othersConfig: {
                      ...prev.othersConfig,
                      generalQuestionCount: v,
                      scoreSettings: {
                        ...prev.othersConfig.scoreSettings,
                        equalDistribution: v > 0 && totalToUse > 0 ? totalToUse / v : 0
                      }
                    }
                  }));
                }}
                onBlur={() => markTouched('othersGeneralQuestionCount')}
                min={0}
                placeholder="e.g. 5"
                error={validationErrors.othersGeneralQuestionCount}
                touched={touchedFields.has('othersGeneralQuestionCount')}
              />
            </div>
            <div>
              <SectionLabel info="Auto-calculated from total marks">Marks Per Question</SectionLabel>
              <div className="relative">
                <input
                  type="text"
                  value={formatDecimal(formData.othersConfig.scoreSettings.equalDistribution)}
                  disabled
                  readOnly
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{ borderColor: designTokens.border, background: designTokens.surface, color: designTokens.textMuted }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold" style={{ color: designTokens.orange }}>Auto</span>
              </div>
            </div>
          </div>
        )}

        {/* Level Based / Selection Level Configuration */}
        {(formData.othersConfig.questionConfigType === 'levelBased' || formData.othersConfig.questionConfigType === 'selectionLevel') && (
          <>
            <div className="flex items-center gap-1">
              <Calculator size={12} style={{ color: designTokens.textMuted }} />
              <span className="text-xs font-semibold" style={{ color: designTokens.textMain }}>Questions and Scoring Configuration</span>
            </div>

            {(() => {
              const isSelLevel = formData.othersConfig.questionConfigType === 'selectionLevel';
              const gridCols = '70px 1fr 1fr 1fr';
              const rowStyle = { display: 'grid', gridTemplateColumns: gridCols, gap: '6px', marginBottom: '4px', alignItems: 'center' } as const;
              
              return (
                <div>
                  {/* Header */}
                  <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '6px', marginBottom: '4px', alignItems: 'end' }}>
                    <div />
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      if (isSelLevel) {
                        const checked = (formData.othersConfig.selectionLevelCounts?.[level] ?? 0) > 0;
                        return (
                          <div key={level}>
                            <label className="flex items-center gap-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const nc = { ...formData.othersConfig.selectionLevelCounts, [level]: e.target.checked ? 1 : 0 };
                                  const active = (['easy', 'medium', 'hard'] as const).filter(l => nc[l] > 0).length;
                                  if (active > 2) {
                                    setFormData(prev => ({
                                      ...prev,
                                      othersConfig: {
                                        ...prev.othersConfig,
                                        questionConfigType: 'levelBased',
                                        levelBasedCounts: { easy: nc.easy > 0 ? nc.easy : 1, medium: nc.medium > 0 ? nc.medium : 1, hard: nc.hard > 0 ? nc.hard : 1 },
                                        selectionLevelCounts: { easy: 0, medium: 0, hard: 0 }
                                      }
                                    }));
                                  } else {
                                    setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, selectionLevelCounts: nc } }));
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

                  {/* Questions Row */}
                  <div style={rowStyle}>
                    <div className="text-[10px] font-semibold" style={{ color: designTokens.textMuted }}>Questions</div>
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      const checked = isSelLevel ? (formData.othersConfig.selectionLevelCounts?.[level] ?? 0) > 0 : true;
                      const ek = `othersLevelCounts_${level.charAt(0).toUpperCase() + level.slice(1)}`;
                      const val = isSelLevel
                        ? (formData.othersConfig.selectionLevelCounts?.[level] === 0 ? '' : formData.othersConfig.selectionLevelCounts?.[level])
                        : (formData.othersConfig.levelBasedCounts?.[level] === 0 ? '' : formData.othersConfig.levelBasedCounts?.[level]);
                      const handleChange = isSelLevel
                        ? (v: number) => setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, selectionLevelCounts: { ...prev.othersConfig.selectionLevelCounts, [level]: v } } }))
                        : (v: number) => {
                            setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, levelBasedCounts: { ...prev.othersConfig.levelBasedCounts, [level]: v } } }));
                            if (v > 0) setValidationErrors(prev => { const e = { ...prev }; delete e[ek]; return e; });
                          };
                      return (
                        <div key={level}>
                          <ONumberInput
                            value={val}
                            onChange={handleChange}
                            onBlur={isSelLevel ? undefined : () => markTouched('othersLevelCounts')}
                            disabled={isSelLevel && !checked}
                            min={0}
                            placeholder={isSelLevel && !checked ? '—' : 'Count'}
                            error={!isSelLevel ? validationErrors[ek] : undefined}
                            touched={!isSelLevel ? touchedFields.has('othersLevelCounts') : undefined}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Score Type Row */}
                  <div style={rowStyle}>
                    <div className="text-[10px] font-semibold" style={{ color: designTokens.textMuted }}>Score Type</div>
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      const count = scoringCounts[level];
                      const scoring = ls[level];
                      const hasError = touchedFields.has(`scoring_others_${level}`) && !!scoringErrors[level];
                      return (
                        <div key={level} style={{ opacity: count === 0 ? 0.4 : 1, pointerEvents: count === 0 ? 'none' : 'auto' }}>
                          <select
                            value={scoring?.type || 'level_specific'}
                            onChange={e => updateOthersLevelScoringConfig?.(level, {
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

                  {/* Marks Row */}
                  <div style={rowStyle}>
                    <div className="text-[10px] font-semibold" style={{ color: designTokens.textMuted }}>Marks</div>
                    {(['easy', 'medium', 'hard'] as const).map(level => {
                      const count = scoringCounts[level];
                      const scoring = ls[level];
                      const isQSpec = scoring?.type === 'question_specific';
                      const hasError = touchedFields.has(`scoring_others_${level}`) && !!scoringErrors[level];
                      return (
                        <div key={level} style={{ opacity: count === 0 ? 0.4 : 1, pointerEvents: count === 0 ? 'none' : 'auto' }}>
                          <ONumberInput
                            value={isQSpec ? (scoring?.totalMarks || 0) : (scoring?.marksPerQuestion || 0)}
                            onChange={v => updateOthersLevelScoringConfig?.(level, isQSpec ? { totalMarks: v } : { marksPerQuestion: v })}
                          />
                          {hasError && <span className="text-[10px]" style={{ color: designTokens.red }}>{scoringErrors[level]}</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Total Row */}
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
              const sel = formData.othersConfig.questionFlow === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, othersConfig: { ...prev.othersConfig, questionFlow: opt.value as any } }))}
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

        {/* Attempt Limit */}
        <div className="pt-2 border-t" style={{ borderColor: designTokens.border }}>
          <OToggle
            enabled={formData.othersConfig.attemptLimitEnabled}
            onChange={v => setFormData(prev => ({
              ...prev,
              othersConfig: {
                ...prev.othersConfig,
                attemptLimitEnabled: v,
                submissionAttempts: v ? prev.othersConfig.submissionAttempts : 1
              }
            }))}
            label="Attempt Limit"
            description="Restrict the number of submission attempts"
          />
          {formData.othersConfig.attemptLimitEnabled && (
            <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <SectionLabel info="Maximum number of times a student can submit (1–10)">Attempts Allowed</SectionLabel>
              <div className="w-28">
                <ONumberInput
                  value={formData.othersConfig.submissionAttempts}
                  onChange={v => setFormData(prev => ({
                    ...prev,
                    othersConfig: {
                      ...prev.othersConfig,
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