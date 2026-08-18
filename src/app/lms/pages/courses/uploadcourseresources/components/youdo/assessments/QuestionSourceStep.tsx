// assessments/QuestionSourceStep.tsx
// "Question Source" step for the Create Assessment modal — parity port of the
// ExerciseSettings 'Add Questions' source picker, re-skinned to this modal's
// design language (testType-style selection cards + D tokens), NOT the
// ExerciseSettings dropdown look.
//
// The chosen source is persisted TOP-LEVEL on the exercise doc
// (questionSource / customSources / customDistribution / saveToBank — same
// contract as ExerciseSettings.tsx buildFullPayload) and is what the Manage
// Test → Add Question flow reads via fullExerciseData.questionSource to gate
// Manual / Question Bank / AI / Other Platform entries and their quotas.
import React, { useEffect, useMemo } from 'react';
import { Layers, FolderOpen, Minus, Plus, Check } from 'lucide-react';
import { D } from './constants';
import { FormDataType } from './types';

export type QuestionSource = '' | 'scratch' | 'ai' | 'thirdParty' | 'custom';
export type CustomSubSource = 'scratch' | 'ai' | 'thirdParty';
export type CustomCell = { scratch: number; ai: number; thirdParty: number };
export type CustomDistribution = { easy: CustomCell; medium: CustomCell; hard: CustomCell };
// Section-based: allocation is stored per section (keyed by section id) so
// each part carries its own Manual / AI / Other Platform split per difficulty.
// Downstream (QuestionsTest routing, Add Question quota accounting) reads the
// section's entry to decide what's usable for that specific slot.
export type CustomDistributionBySection = Record<string, CustomDistribution>;

export const emptyCustomDist = (): CustomDistribution => ({
  easy: { scratch: 0, ai: 0, thirdParty: 0 },
  medium: { scratch: 0, ai: 0, thirdParty: 0 },
  hard: { scratch: 0, ai: 0, thirdParty: 0 },
});

// Selection accent — same hard-coded violet the testType picker and the
// modal sidebar use (not part of D).
const ACC = '#7c3aed';

// Same options/labels as ExerciseSettings' source dropdown — internal ids
// (scratch / ai / thirdParty / custom) are the storage contract.
const SOURCE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'scratch', label: 'Manual' },
  { value: 'ai', label: 'AI Automation' },
  { value: 'thirdParty', label: 'Other Platform' },
  { value: 'custom', label: 'Custom — combine two or more sources' },
];

const SUB_OPTIONS: Array<{ value: CustomSubSource; label: string }> = [
  { value: 'scratch', label: 'Manual' },
  { value: 'ai', label: 'AI Automation' },
  { value: 'thirdParty', label: 'Other Platform' },
];

const DIFFS = ['easy', 'medium', 'hard'] as const;
const DIFF_COLORS: Record<(typeof DIFFS)[number], string> = {
  easy: D.emerald, medium: D.amber, hard: D.red,
};

interface QuestionSourceStepProps {
  questionSource: QuestionSource;
  setQuestionSource: (v: QuestionSource) => void;
  customSources: CustomSubSource[];
  setCustomSources: React.Dispatch<React.SetStateAction<CustomSubSource[]>>;
  customDistribution: CustomDistribution;
  setCustomDistribution: React.Dispatch<React.SetStateAction<CustomDistribution>>;
  // Combined-only: the MCQ part's own source ('' = inherit) + its
  // single-cell Custom split (Manual/AI counts summing to the MCQ total).
  questionSourceMcq: QuestionSource;
  setQuestionSourceMcq: (v: QuestionSource) => void;
  customSourcesMcq: CustomSubSource[];
  setCustomSourcesMcq: React.Dispatch<React.SetStateAction<CustomSubSource[]>>;
  customDistributionMcq: CustomCell;
  setCustomDistributionMcq: React.Dispatch<React.SetStateAction<CustomCell>>;
  formData: FormDataType;
  isSectionBased: boolean;
  InfoTooltip: React.ComponentType<any>;
  ODropdown: React.ComponentType<any>;
  // Section-based only: per-section allocation matrix, keyed by section id.
  // The exercise-wide `customDistribution` above stays used for non-section flow.
  customDistributionBySection: CustomDistributionBySection;
  setCustomDistributionBySection: React.Dispatch<React.SetStateAction<CustomDistributionBySection>>;
}

export const QuestionSourceStep: React.FC<QuestionSourceStepProps> = ({
  questionSource, setQuestionSource,
  customSources, setCustomSources,
  customDistribution, setCustomDistribution,
  questionSourceMcq, setQuestionSourceMcq,
  customSourcesMcq, setCustomSourcesMcq,
  customDistributionMcq, setCustomDistributionMcq,
  formData, isSectionBased,
  InfoTooltip, ODropdown,
  customDistributionBySection, setCustomDistributionBySection,
}) => {
  // Pattern totals the custom split must add up to — mirrors the target
  // derivation in ExerciseSettings' Add Questions step. Section-based tests
  // configure counts per section, so there is no exercise-level pattern and
  // the matrix stays hidden (same net effect as ExerciseSettings' render
  // condition of E/M/H total > 0).
  const target = useMemo(() => {
    if (isSectionBased) return { total: 0, easy: 0, medium: 0, hard: 0 };
    const et = formData.exerciseType;
    if (et === 'MCQ') {
      return { total: formData.mcqConfig?.generalQuestionCount || 0, easy: 0, medium: 0, hard: 0 };
    }
    const cfg: any = et === 'Other' ? formData.othersConfig : formData.programmingConfig;
    if (!cfg) return { total: 0, easy: 0, medium: 0, hard: 0 };
    if (cfg.questionConfigType === 'general') {
      return { total: cfg.generalQuestionCount || 0, easy: 0, medium: 0, hard: 0 };
    }
    const counts = (cfg.questionConfigType === 'selectionLevel'
      ? cfg.selectionLevelCounts
      : cfg.levelBasedCounts) || {};
    const easy = counts.easy || 0, medium = counts.medium || 0, hard = counts.hard || 0;
    return { total: easy + medium + hard, easy, medium, hard };
  }, [formData, isSectionBased]);

  // Pure-MCQ assessments have no Other Platform import path — the MCQ
  // question form only offers Manual / Bank / AI — so don't offer a source
  // that would dead-end in Manage Test. (Combined keeps it: its programming
  // side does support Other Platform. Section-based can mix types, so it
  // keeps the full list too.)
  const hideThirdParty = !isSectionBased && formData.exerciseType === 'MCQ';
  const isCombined = !isSectionBased && formData.exerciseType === 'Combined';
  const sourceOptions = hideThirdParty ? SOURCE_OPTIONS.filter(o => o.value !== 'thirdParty') : SOURCE_OPTIONS;
  const subOptions = hideThirdParty ? SUB_OPTIONS.filter(o => o.value !== 'thirdParty') : SUB_OPTIONS;

  // If the exercise type was switched to MCQ after Other Platform was picked,
  // clear the now-hidden selection instead of persisting an unusable source.
  useEffect(() => {
    if (!hideThirdParty) return;
    if (questionSource === 'thirdParty') setQuestionSource('');
    if (customSources.includes('thirdParty')) {
      setCustomSources(prev => prev.filter(s => s !== 'thirdParty'));
      setCustomDistribution(d => ({
        easy: { ...d.easy, thirdParty: 0 },
        medium: { ...d.medium, thirdParty: 0 },
        hard: { ...d.hard, thirdParty: 0 },
      }));
    }
  }, [hideThirdParty, questionSource, customSources, setQuestionSource, setCustomSources, setCustomDistribution]);

  // Level-based patterns split per difficulty. MCQ and General-count configs
  // have no levels — they get a single "Questions" row whose split lives in
  // the neutral 'medium' bucket (the same bucket difficulty-less questions
  // are normalized into when quota slices are counted).
  const hasLevels = (target.easy + target.medium + target.hard) > 0;
  const rowTargets: Record<(typeof DIFFS)[number], number> = hasLevels
    ? { easy: target.easy, medium: target.medium, hard: target.hard }
    : { easy: 0, medium: target.total, hard: 0 };
  const rowCaption = (d: (typeof DIFFS)[number]) => (hasLevels ? d : d === 'medium' ? 'Questions' : d);

  // Section-based assessments carry their configs on the sections themselves,
  // not on `formData`, so `target.total` is 0 here even though the trainer has
  // definitely configured question counts. Force the matrix visible so they
  // can still allocate across Manual / AI / Other Platform. Non-section flow
  // keeps the target-driven guard (empty matrix would be confusing there).
  const showMatrix =
    questionSource === 'custom' &&
    customSources.length >= 2 &&
    (target.total > 0 || isSectionBased);

  const activeCols = subOptions.filter(o => customSources.includes(o.value));

  const rowSum = (diff: (typeof DIFFS)[number]) =>
    activeCols.reduce((s, c) => s + (customDistribution[diff]?.[c.value] || 0), 0);
  const grandSum = DIFFS.reduce((s, d) => s + rowSum(d), 0);
  // Green only when EVERY row matches its target (mirrors ExerciseSettings'
  // grandBalanced) — a grand-total-only check can read green while one row is
  // over and another under. For section-based we have no aggregate target,
  // so treat any non-empty entry as valid (the sections themselves already
  // enforce their own counts at save time).
  const allRowsBalanced = isSectionBased
    ? grandSum > 0
    : DIFFS.every(d => rowSum(d) === rowTargets[d]);
  // Keep a row on screen while it still holds counts, even after its
  // configured target dropped to 0 — hiding it would trap stale counts the
  // user can no longer see or decrement. For section-based show all three
  // difficulty rows unconditionally so the trainer has full latitude.
  const visibleRows = isSectionBased
    ? DIFFS
    : DIFFS.filter(d => rowTargets[d] > 0 || rowSum(d) > 0);

  const setCell = (diff: (typeof DIFFS)[number], src: CustomSubSource, delta: number) => {
    setCustomDistribution(prev => {
      const cur = prev[diff]?.[src] || 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [diff]: { ...prev[diff], [src]: next } };
    });
  };

  const splitEvenly = () => {
    setCustomDistribution(() => {
      const next = emptyCustomDist();
      DIFFS.forEach(diff => {
        const rowTarget = rowTargets[diff];
        if (rowTarget <= 0 || activeCols.length === 0) return;
        const base = Math.floor(rowTarget / activeCols.length);
        let remainder = rowTarget - base * activeCols.length;
        activeCols.forEach(c => {
          next[diff][c.value] = base + (remainder > 0 ? 1 : 0);
          if (remainder > 0) remainder--;
        });
      });
      return next;
    });
  };

  const toggleSub = (v: CustomSubSource) => {
    setCustomSources(prev => {
      const next = prev.includes(v) ? prev.filter(s => s !== v) : [...prev, v];
      // Zero out the column of an un-ticked source so stale counts don't
      // linger in the persisted matrix.
      if (prev.includes(v)) {
        setCustomDistribution(d => ({
          easy: { ...d.easy, [v]: 0 },
          medium: { ...d.medium, [v]: 0 },
          hard: { ...d.hard, [v]: 0 },
        }));
      }
      return next;
    });
  };

  const card: React.CSSProperties = {
    border: `1px solid ${D.border}`, borderRadius: 14, background: '#fff', padding: '16px 18px',
  };

  return (
    <div className="px-10 pt-4 pb-6 space-y-4">
      {/* ── Source picker ── */}
      <div>
        <div className="flex flex-wrap items-center gap-3">
          {isCombined && (
            <div className="flex items-center gap-1.5">
              <FolderOpen size={12} style={{ color: D.textMuted }} />
              <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: D.textMuted }}>
                Programming Source <span style={{ color: D.orange }}>*</span>
              </span>
            </div>
          )}
          <div style={{ minWidth: 260, flex: '0 0 280px' }}>
            <ODropdown
              value={questionSource || ''}
              options={sourceOptions}
              onChange={(v: string) => {
                setQuestionSource(v as QuestionSource);
                if (v !== 'custom') setCustomSources([]);
              }}
            />
          </div>
          {questionSource === 'custom' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold" style={{ color: D.textMuted }}>Combine (pick 2 or more):</span>
              {subOptions.map(opt => {
                const checked = customSources.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleSub(opt.value)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                    style={{
                      background: checked ? D.orange + '15' : '#fff',
                      color: checked ? D.orange : D.textMain,
                      border: `1px solid ${checked ? D.orange : D.border}`,
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded pointer-events-none"
                      style={{
                        border: `1.5px solid ${checked ? D.orange : D.textMuted}`,
                        background: checked ? D.orange : '#fff',
                      }}
                    >
                      {checked && <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {questionSource === 'custom' && customSources.length > 0 && customSources.length < 2 && (
          <p className="mt-2 text-[11px]" style={{ color: D.red }}>Pick at least two sources for Custom mode.</p>
        )}
        {!questionSource && (
          <p className="mt-2 text-[11px]" style={{ color: D.textMuted }}>Pick a source to see how to add questions.</p>
        )}
      </div>

      {/* Combined: the MCQ part's own source — defaults to inheriting the
          programming source; separate it only when required. Custom split is
          a single row (Manual/AI) summing to the MCQ question count. */}
      {isCombined && (() => {
        const mcqSrcOptions = [
          { value: '', label: 'Same as Programming' },
          { value: 'scratch', label: 'Manual' },
          { value: 'ai', label: 'AI Automation' },
          { value: 'custom', label: 'Custom — combine Manual + AI' },
        ];
        const mcqSubOptions: Array<{ value: CustomSubSource; label: string }> = [
          { value: 'scratch', label: 'Manual' },
          { value: 'ai', label: 'AI Automation' },
        ];
        const mcqTotal = formData.mcqConfig?.generalQuestionCount || 0;
        const mcqSplitSum = customDistributionMcq.scratch + customDistributionMcq.ai + customDistributionMcq.thirdParty;
        const showMcqSplit = questionSourceMcq === 'custom' && customSourcesMcq.length >= 2 && mcqTotal > 0;
        const bumpMcq = (c: CustomSubSource, delta: number) =>
          setCustomDistributionMcq(prev => ({ ...prev, [c]: Math.max(0, (prev as any)[c] + delta) }));
        return (
          <div className="px-3 py-2.5 rounded-md" style={{ background: '#FAFAF7', border: `1px solid ${D.border}` }}>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <FolderOpen size={12} style={{ color: D.textMuted }} />
                <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: D.textMuted }}>
                  MCQ Source
                </span>
              </div>
              <div style={{ minWidth: 260, flex: '0 0 280px' }}>
                <ODropdown
                  value={questionSourceMcq || ''}
                  options={mcqSrcOptions}
                  onChange={(v: string) => {
                    setQuestionSourceMcq(v as QuestionSource);
                    if (v !== 'custom') setCustomSourcesMcq([]);
                  }}
                />
              </div>
              {questionSourceMcq === 'custom' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold" style={{ color: D.textMuted }}>Combine (pick 2):</span>
                  {mcqSubOptions.map(opt => { const checked = customSourcesMcq.includes(opt.value); return (
                    <button key={opt.value} type="button" aria-pressed={checked}
                      onClick={() => setCustomSourcesMcq(prev => prev.includes(opt.value) ? prev.filter(x => x !== opt.value) : [...prev, opt.value])}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold"
                      style={{ background: checked ? D.orange + '15' : '#fff', color: checked ? D.orange : D.textMain, border: `1px solid ${checked ? D.orange : D.border}`, cursor: 'pointer' }}>
                      <span aria-hidden="true" className="inline-flex items-center justify-center w-3.5 h-3.5 rounded pointer-events-none"
                        style={{ border: `1.5px solid ${checked ? D.orange : D.textMuted}`, background: checked ? D.orange : '#fff' }}>
                        {checked && <Check size={9} strokeWidth={3} style={{ color: '#fff' }} />}
                      </span>
                      {opt.label}
                    </button>
                  ); })}
                </div>
              )}
            </div>
            {questionSourceMcq === 'custom' && customSourcesMcq.length > 0 && customSourcesMcq.length < 2 && (
              <p className="mt-2 text-[11px]" style={{ color: D.red }}>Pick both sources for Custom mode.</p>
            )}
            {showMcqSplit && (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-[11px] font-bold" style={{ color: D.textMain }}>MCQ Questions:</span>
                {mcqSubOptions.filter(o => customSourcesMcq.includes(o.value)).map(o => (
                  <span key={o.value} className="inline-flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold" style={{ color: D.textMuted }}>{o.label}</span>
                    <button type="button" onClick={() => bumpMcq(o.value, -1)} disabled={(customDistributionMcq as any)[o.value] === 0}
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ border: `1px solid ${D.border}`, background: '#fff', color: D.textMuted, cursor: (customDistributionMcq as any)[o.value] === 0 ? 'not-allowed' : 'pointer', opacity: (customDistributionMcq as any)[o.value] === 0 ? 0.5 : 1 }}>
                      <Minus size={10} />
                    </button>
                    <span className="w-6 text-center text-[11px] font-bold" style={{ color: D.textMain }}>{(customDistributionMcq as any)[o.value]}</span>
                    <button type="button" onClick={() => bumpMcq(o.value, +1)} disabled={mcqSplitSum >= mcqTotal}
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ border: `1px solid ${D.border}`, background: '#fff', color: D.orange, cursor: mcqSplitSum >= mcqTotal ? 'not-allowed' : 'pointer', opacity: mcqSplitSum >= mcqTotal ? 0.5 : 1 }}>
                      <Plus size={10} />
                    </button>
                  </span>
                ))}
                <span className="text-[11px] font-bold" style={{ color: mcqSplitSum === mcqTotal ? D.emerald : D.red }}>
                  {mcqSplitSum} / {mcqTotal}
                </span>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Section-based per-section allocation panels ── */}
      {/* Each part (Part A / Part B / …) gets its own matrix targeted to that */}
      {/* section's configured counts. Trainer allocates that section's total */}
      {/* across Manual / AI / Other Platform, per difficulty. Downstream */}
      {/* (QuestionsTest routing) reads `customDistributionBySection[sectionId]` */}
      {/* to decide what's still addable for that specific slot. */}
      {isSectionBased && questionSource === 'custom' && customSources.length >= 2 && (() => {
        const sectionConfigs: Record<string, any> = (formData as any)?.sectionConfigs || {};
        const sectionKeys = Object.keys(sectionConfigs).sort((a, b) => {
          const orderA = sectionConfigs[a]?.sectionNumber || sectionConfigs[a]?.order || 0;
          const orderB = sectionConfigs[b]?.sectionNumber || sectionConfigs[b]?.order || 0;
          return orderA - orderB;
        });
        if (sectionKeys.length === 0) {
          return (
            <div style={card}>
              <div className="text-[11.5px]" style={{ color: D.textMuted }}>
                Configure sections in Step 2 first — the per-section allocation panels appear here once your parts are set up.
              </div>
            </div>
          );
        }
        // Derive per-section targets from that section's config. MCQ →
        // generalQuestionCount as the medium bucket; Programming → per-diff or
        // general depending on questionConfigType; Combined → sum of both parts.
        const sectionTarget = (cfg: any): { total: number; easy: number; medium: number; hard: number } => {
          const et = cfg?.exerciseType;
          const mcqCount = cfg?.mcqConfig?.generalQuestionCount || cfg?.mcqConfig?.totalMcqQuestions || 0;
          const pc: any = cfg?.programmingConfig || {};
          const pcType = pc.questionConfigType || 'general';
          let progEasy = 0, progMedium = 0, progHard = 0, progTotal = 0;
          if (pcType === 'general') {
            progTotal = pc.generalQuestionCount || 0;
          } else {
            const c = (pcType === 'selectionLevel' ? pc.selectionLevelCounts : pc.levelBasedCounts) || {};
            progEasy = c.easy || 0; progMedium = c.medium || 0; progHard = c.hard || 0;
            progTotal = progEasy + progMedium + progHard;
          }
          if (et === 'MCQ') return { total: mcqCount, easy: 0, medium: mcqCount, hard: 0 };
          if (et === 'Programming') {
            if (pcType === 'general') return { total: progTotal, easy: 0, medium: progTotal, hard: 0 };
            return { total: progTotal, easy: progEasy, medium: progMedium, hard: progHard };
          }
          if (et === 'Combined') {
            if (pcType === 'general') return { total: mcqCount + progTotal, easy: 0, medium: mcqCount + progTotal, hard: 0 };
            return { total: mcqCount + progTotal, easy: progEasy, medium: mcqCount + progMedium, hard: progHard };
          }
          return { total: 0, easy: 0, medium: 0, hard: 0 };
        };
        // Deep-clone helpers avoid any accidental reference-sharing between
        // section entries in `customDistributionBySection` — a single shared
        // sub-object could silently mask updates in React's shallow re-render
        // check. Every mutation writes a fresh nested structure.
        const cloneDist = (d: CustomDistribution): CustomDistribution => ({
          easy:   { scratch: d.easy.scratch,   ai: d.easy.ai,   thirdParty: d.easy.thirdParty },
          medium: { scratch: d.medium.scratch, ai: d.medium.ai, thirdParty: d.medium.thirdParty },
          hard:   { scratch: d.hard.scratch,   ai: d.hard.ai,   thirdParty: d.hard.thirdParty },
        });
        const setSectionCell = (sid: string, diff: 'easy'|'medium'|'hard', src: CustomSubSource, delta: number) => {
          setCustomDistributionBySection(prev => {
            const cur = prev[sid] ? cloneDist(prev[sid]) : emptyCustomDist();
            const nextVal = Math.max(0, (cur[diff][src] || 0) + delta);
            cur[diff][src] = nextVal;
            return { ...prev, [sid]: cur };
          });
        };
        const resetSection = (sid: string) => {
          setCustomDistributionBySection(prev => ({ ...prev, [sid]: emptyCustomDist() }));
        };
        const splitSectionEvenly = (sid: string, tgt: { easy: number; medium: number; hard: number }) => {
          const cols = subOptions.filter(o => customSources.includes(o.value));
          setCustomDistributionBySection(prev => {
            const next = emptyCustomDist();
            DIFFS.forEach(diff => {
              const rowTarget = tgt[diff];
              if (rowTarget <= 0 || cols.length === 0) return;
              const base = Math.floor(rowTarget / cols.length);
              let remainder = rowTarget - base * cols.length;
              cols.forEach(c => {
                next[diff][c.value] = base + (remainder > 0 ? 1 : 0);
                if (remainder > 0) remainder--;
              });
            });
            return { ...prev, [sid]: next };
          });
        };
        return (
          <div className="space-y-3">
            {sectionKeys.map((sid, idx) => {
              const cfg = sectionConfigs[sid];
              const name = cfg?.name || `Part ${String.fromCharCode(65 + idx)}`;
              const tgt = sectionTarget(cfg);
              const hasSecLevels = (tgt.easy + tgt.hard) > 0;
              const rowTargetsSec: Record<'easy'|'medium'|'hard', number> = hasSecLevels
                ? { easy: tgt.easy, medium: tgt.medium, hard: tgt.hard }
                : { easy: 0, medium: tgt.total, hard: 0 };
              const dist = customDistributionBySection[sid] || emptyCustomDist();
              const rowSumSec = (d: 'easy'|'medium'|'hard') => activeCols.reduce((s, c) => s + (dist[d]?.[c.value] || 0), 0);
              const grandSumSec = DIFFS.reduce((s, d) => s + rowSumSec(d), 0);
              const balancedSec = DIFFS.every(d => rowSumSec(d) === rowTargetsSec[d]);
              const visibleSecRows = DIFFS.filter(d => rowTargetsSec[d] > 0 || rowSumSec(d) > 0);
              return (
                <div key={sid} style={card}>
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Layers size={14} style={{ color: ACC }} />
                      <span className="text-[12px] font-bold" style={{ color: D.textMain }}>{name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: D.orange + '15', color: D.orange, border: `1px solid ${D.orange}30` }}>
                        {cfg?.exerciseType || '—'}
                      </span>
                      <span className="text-[10.5px]" style={{ color: D.textMuted }}>Target: {tgt.total} questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold" style={{ color: balancedSec ? D.emerald : D.red }}>
                        {grandSumSec} / {tgt.total}
                      </span>
                      <button type="button" onClick={() => splitSectionEvenly(sid, rowTargetsSec)}
                        className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg"
                        style={{ border: `1px solid ${D.border}`, color: D.textSub, background: D.bg }}>
                        Split evenly
                      </button>
                      <button type="button" onClick={() => resetSection(sid)}
                        className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg"
                        style={{ border: `1px solid ${D.border}`, color: D.textSub, background: D.bg }}>
                        Reset
                      </button>
                    </div>
                  </div>
                  {tgt.total === 0 ? (
                    <div className="text-[11px]" style={{ color: D.textMuted }}>
                      No questions configured for this section yet — set counts in the Section Configuration step.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                        <thead>
                          <tr>
                            <th className="text-left text-[10.5px] font-semibold pb-2" style={{ color: D.textMuted }}>Difficulty</th>
                            {activeCols.map(c => (
                              <th key={c.value} className="text-center text-[10.5px] font-semibold pb-2" style={{ color: D.textMuted }}>{c.label}</th>
                            ))}
                            <th className="text-right text-[10.5px] font-semibold pb-2" style={{ color: D.textMuted }}>Row total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleSecRows.map(diff => {
                            const rSum = rowSumSec(diff);
                            const rTarget = rowTargetsSec[diff];
                            return (
                              <tr key={diff}>
                                <td className="py-1.5">
                                  <span className="text-[11px] font-bold capitalize" style={{ color: hasSecLevels ? DIFF_COLORS[diff] : D.textMain }}>
                                    {hasSecLevels ? diff : diff === 'medium' ? 'Questions' : diff}
                                  </span>
                                </td>
                                {activeCols.map(c => {
                                  const val = dist[diff]?.[c.value] || 0;
                                  // Only clamp when there IS a target to clamp to. A stale
                                  // row (rTarget=0 with a leftover rowSum from a prior
                                  // section-config shape) was hard-disabling every + because
                                  // `0 >= 0` is true — trainer clicks silently. Mirrors the
                                  // guard on the non-section matrix below.
                                  const plusDisabled = rTarget > 0 && rSum >= rTarget;
                                  return (
                                    <td key={c.value} className="py-1.5 text-center">
                                      <div className="inline-flex items-center gap-1.5 px-1.5 py-1 rounded-lg"
                                        style={{ border: `1px solid ${D.border}`, background: D.surface }}>
                                        <button type="button" onClick={() => setSectionCell(sid, diff, c.value, -1)} disabled={val <= 0}
                                          className="w-5 h-5 rounded flex items-center justify-center"
                                          style={{ background: D.bg, border: `1px solid ${D.border}`, color: val <= 0 ? D.border : D.textSub, cursor: val <= 0 ? 'default' : 'pointer' }}>
                                          <Minus size={10} />
                                        </button>
                                        <span className="text-[11.5px] font-bold w-5 text-center" style={{ color: D.textMain }}>{val}</span>
                                        <button type="button" onClick={() => setSectionCell(sid, diff, c.value, 1)} disabled={plusDisabled}
                                          className="w-5 h-5 rounded flex items-center justify-center"
                                          style={{ background: D.bg, border: `1px solid ${D.border}`, color: plusDisabled ? D.border : D.textSub, cursor: plusDisabled ? 'default' : 'pointer' }}>
                                          <Plus size={10} />
                                        </button>
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="py-1.5 text-right">
                                  <span className="text-[11px] font-bold" style={{ color: rSum === rTarget ? D.emerald : D.red }}>
                                    {rSum} / {rTarget}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Non-section aggregate distribution matrix ── */}
      {!isSectionBased && showMatrix && (
        <div style={card}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Layers size={14} style={{ color: ACC }} />
              <span className="text-[12px] font-bold" style={{ color: D.textMain }}>Distribute questions per source</span>
              <InfoTooltip content="Split each difficulty's configured question count across the sources you ticked. Every row must add up to its configured count." />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold"
                style={{ color: allRowsBalanced ? D.emerald : D.red }}>
                {/* Section-based has no aggregate target here (sections carry */}
                {/* their own counts), so show a bare total instead of "N / 0". */}
                {isSectionBased ? `${grandSum} total` : `${grandSum} / ${target.total}`}
              </span>
              <button type="button" onClick={splitEvenly}
                className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                style={{ border: `1px solid ${D.border}`, color: D.textSub, background: D.bg }}>
                Split evenly
              </button>
              <button type="button" onClick={() => setCustomDistribution(emptyCustomDist())}
                className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                style={{ border: `1px solid ${D.border}`, color: D.textSub, background: D.bg }}>
                Reset
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="text-left text-[10.5px] font-semibold pb-2" style={{ color: D.textMuted }}>Difficulty</th>
                  {activeCols.map(c => (
                    <th key={c.value} className="text-center text-[10.5px] font-semibold pb-2" style={{ color: D.textMuted }}>{c.label}</th>
                  ))}
                  <th className="text-right text-[10.5px] font-semibold pb-2" style={{ color: D.textMuted }}>Row total</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(diff => {
                  const rSum = rowSum(diff);
                  const rTarget = rowTargets[diff];
                  return (
                    <tr key={diff}>
                      <td className="py-1.5">
                        <span className="text-[11px] font-bold capitalize" style={{ color: hasLevels ? DIFF_COLORS[diff] : D.textMain }}>{rowCaption(diff)}</span>
                      </td>
                      {activeCols.map(c => {
                        const val = customDistribution[diff]?.[c.value] || 0;
                        // Section-based has no per-difficulty target — allow
                        // the trainer to increment freely; validation happens
                        // per-section elsewhere. Non-section keeps the target
                        // cap so a row can't overflow its configured count.
                        const plusDisabled = !isSectionBased && rSum >= rTarget;
                        return (
                          <td key={c.value} className="py-1.5 text-center">
                            <div className="inline-flex items-center gap-1.5 px-1.5 py-1 rounded-lg"
                              style={{ border: `1px solid ${D.border}`, background: D.surface }}>
                              <button type="button" onClick={() => setCell(diff, c.value, -1)} disabled={val <= 0}
                                className="w-5 h-5 rounded flex items-center justify-center transition-all"
                                style={{ background: D.bg, border: `1px solid ${D.border}`, color: val <= 0 ? D.border : D.textSub, cursor: val <= 0 ? 'default' : 'pointer' }}>
                                <Minus size={10} />
                              </button>
                              <span className="text-[11.5px] font-bold w-5 text-center" style={{ color: D.textMain }}>{val}</span>
                              <button type="button" onClick={() => setCell(diff, c.value, 1)} disabled={plusDisabled}
                                className="w-5 h-5 rounded flex items-center justify-center transition-all"
                                style={{ background: D.bg, border: `1px solid ${D.border}`, color: plusDisabled ? D.border : D.textSub, cursor: plusDisabled ? 'default' : 'pointer' }}>
                                <Plus size={10} />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-1.5 text-right">
                        <span className="text-[11px] font-bold"
                          style={{ color: isSectionBased ? D.textMain : (rSum === rTarget ? D.emerald : D.red) }}>
                          {isSectionBased ? rSum : `${rSum} / ${rTarget}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default QuestionSourceStep;
