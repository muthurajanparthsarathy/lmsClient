// assessments/QuestionSourceStep.tsx
// "Question Source" step for the Create Assessment modal — parity port of the
// ExerciseSettings 'Add Questions' source picker, re-skinned to this modal's
// design language.
//
// Restyled 2026-09-01 to match the ExerciseSettings design system —
// `StepShell` wrapper, `SectionHeading` groups for "Question sources" and
// "Distribution", table chrome rebuilt with the D.border2 / D.surface /
// D.textSub tokens, and each cell's manual +/- pair replaced by the shared
// `ONumberInput` so every input matches the 34px/orange-focus design. The
// per-difficulty label cells now carry a small color-coded dot (easy=emerald,
// medium=amber, hard=red).
//
// The chosen source is persisted TOP-LEVEL on the exercise doc
// (questionSource / customSources / customDistribution / saveToBank — same
// contract as ExerciseSettings.tsx buildFullPayload) and is what the Manage
// Test → Add Question flow reads via fullExerciseData.questionSource to gate
// Manual / Question Bank / AI / Other Platform entries and their quotas.
import React, { useEffect, useMemo } from 'react';
import { Layers, Minus, Plus } from 'lucide-react';
import { D } from './constants';
import { FormDataType } from './types';
import { QuestionSourcePicker } from '@/app/lms/component/questionsource/QuestionSourcePicker';
import { SectionHeading, StepShell, ONumberInput } from './UIComponents';

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

// The SOURCE / SUB option constants are gone — QuestionSourcePicker owns the
// visible option list now (Manual / AI Automation / Other Platform). The
// three-part storage contract (`questionSource` = '' | 'scratch' | 'ai' |
// 'thirdParty' | 'custom', `customSources` = the picks when it's 'custom')
// still ships identically to the server, derived by the picker from the
// checkbox state — see `checkedToStored` in QuestionSourcePicker.tsx.
const SUB_OPTIONS: Array<{ value: CustomSubSource; label: string }> = [
  { value: 'scratch', label: 'Manual' },
  { value: 'ai', label: 'AI Automation' },
  { value: 'thirdParty', label: 'Other Platform' },
];

const DIFFS = ['easy', 'medium', 'hard'] as const;
const DIFF_COLORS: Record<(typeof DIFFS)[number], string> = {
  easy: D.emerald, medium: D.amber, hard: D.red,
};

// ─── Table token styles ──────────────────────────────────────────────────────
// Shared across every table this step renders (per-section panels and the
// non-section aggregate matrix) so all distribution tables read as one system.
const tableWrap: React.CSSProperties = {
  border: `1px solid ${D.border2}`,
  borderRadius: 10,
  background: '#fff',
  overflow: 'hidden',
};
const headerCell: React.CSSProperties = {
  background: D.surface,
  color: D.textSub,
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '.03em',
  padding: '10px 12px',
  borderBottom: `1px solid ${D.border}`,
  textAlign: 'left',
};
const bodyCellBase: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12.5,
  color: D.textMain,
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
  // Only `subOptions` is still needed — the section-based per-part matrix reads
  // it to lay out column headers. The primary picker itself owns its option
  // list internally.
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

  // Full-value setter used by ONumberInput onChange in the aggregate matrix.
  const setCellValue = (diff: (typeof DIFFS)[number], src: CustomSubSource, val: number) => {
    setCustomDistribution(prev => ({
      ...prev,
      [diff]: { ...prev[diff], [src]: Math.max(0, val || 0) },
    }));
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

  return (
    <StepShell>
      {/* ── Question sources ─────────────────────────────────────────────── */}
      <SectionHeading>Question sources</SectionHeading>
      <QuestionSourcePicker
        value={{ primary: questionSource, sub: customSources }}
        onChange={next => {
          setQuestionSource(next.primary);
          setCustomSources(next.sub);
          // When the trainer un-ticks a source that was carrying counts, zero
          // its column across every difficulty. Otherwise stale counts survive
          // in `customDistribution` invisibly and the matrix's grand total
          // reads red for a source no longer on screen.
          const prevActive = new Set<CustomSubSource>(customSources);
          const nextActive = new Set<CustomSubSource>(next.sub);
          (['scratch', 'ai', 'thirdParty'] as const).forEach(src => {
            if (prevActive.has(src) && !nextActive.has(src)) {
              setCustomDistribution(d => ({
                easy: { ...d.easy, [src]: 0 },
                medium: { ...d.medium, [src]: 0 },
                hard: { ...d.hard, [src]: 0 },
              }));
            }
          });
        }}
        D={D}
        hideThirdParty={hideThirdParty}
        title={isCombined ? 'Programming sources' : 'Question sources'}
        required
        emptyHint="Pick a source to see how to add questions."
      />

      {/* Combined: MCQ side picker + count splitter. */}
      {isCombined && (() => {
        const mcqTotal = formData.mcqConfig?.generalQuestionCount || 0;
        const mcqSplitSum = customDistributionMcq.scratch + customDistributionMcq.ai + customDistributionMcq.thirdParty;
        const showMcqSplit = questionSourceMcq === 'custom' && customSourcesMcq.length >= 2 && mcqTotal > 0;
        const bumpMcq = (c: CustomSubSource, delta: number) =>
          setCustomDistributionMcq(prev => ({ ...prev, [c]: Math.max(0, (prev as any)[c] + delta) }));
        return (
          <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, background: D.surface, border: `1px solid ${D.border2}` }}>
            <QuestionSourcePicker
              value={{ primary: questionSourceMcq, sub: customSourcesMcq }}
              onChange={next => {
                setQuestionSourceMcq(next.primary);
                setCustomSourcesMcq(next.sub);
                // Zero any un-ticked column's counts so a switch away doesn't
                // leave orphaned MCQ counts sitting in the distribution.
                const prev = new Set<CustomSubSource>(customSourcesMcq);
                const cur = new Set<CustomSubSource>(next.sub);
                (['scratch', 'ai', 'thirdParty'] as const).forEach(src => {
                  if (prev.has(src) && !cur.has(src)) {
                    setCustomDistributionMcq(d => ({ ...d, [src]: 0 }));
                  }
                });
              }}
              D={D}
              // MCQ mirror never offers Other Platform — the MCQ question form
              // has no thirdParty import path.
              hideThirdParty
              allowInherit
              label="MCQ Source"
            />
            {showMcqSplit && (() => {
              // MCQ Manual/AI splitter — a small local option list so the row
              // stays independent of the picker's own internal options.
              const mcqSubOptions: Array<{ value: CustomSubSource; label: string }> = [
                { value: 'scratch', label: 'Manual' },
                { value: 'ai', label: 'AI Automation' },
              ];
              return (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="text-[11px] font-bold" style={{ color: D.textMain }}>MCQ Questions:</span>
                  {mcqSubOptions.filter(o => customSourcesMcq.includes(o.value)).map(o => (
                    <span key={o.value} className="inline-flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: D.textMuted }}>{o.label}</span>
                      <button type="button" onClick={() => bumpMcq(o.value, -1)} disabled={(customDistributionMcq as any)[o.value] === 0}
                        className="w-5 h-5 rounded flex items-center justify-center"
                        style={{ border: `1px solid ${D.border2}`, background: '#fff', color: D.textMuted, cursor: (customDistributionMcq as any)[o.value] === 0 ? 'not-allowed' : 'pointer', opacity: (customDistributionMcq as any)[o.value] === 0 ? 0.5 : 1 }}>
                        <Minus size={10} />
                      </button>
                      <span className="w-6 text-center text-[11px] font-bold" style={{ color: D.textMain }}>{(customDistributionMcq as any)[o.value]}</span>
                      <button type="button" onClick={() => bumpMcq(o.value, +1)} disabled={mcqSplitSum >= mcqTotal}
                        className="w-5 h-5 rounded flex items-center justify-center"
                        style={{ border: `1px solid ${D.border2}`, background: '#fff', color: D.orange, cursor: mcqSplitSum >= mcqTotal ? 'not-allowed' : 'pointer', opacity: mcqSplitSum >= mcqTotal ? 0.5 : 1 }}>
                        <Plus size={10} />
                      </button>
                    </span>
                  ))}
                  <span className="text-[11px] font-bold" style={{ color: mcqSplitSum === mcqTotal ? D.emerald : D.red }}>
                    {mcqSplitSum} / {mcqTotal}
                  </span>
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* ── Distribution: section-based per-section panels ── */}
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
            <div style={{ marginTop: 20 }}>
              <SectionHeading>Distribution</SectionHeading>
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
        const setSectionValue = (sid: string, diff: 'easy'|'medium'|'hard', src: CustomSubSource, val: number) => {
          setCustomDistributionBySection(prev => {
            const cur = prev[sid] ? cloneDist(prev[sid]) : emptyCustomDist();
            cur[diff][src] = Math.max(0, val || 0);
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
          <div style={{ marginTop: 20 }}>
            <SectionHeading>Distribution</SectionHeading>
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
                <div key={sid} style={{ marginTop: idx > 0 ? 20 : 8 }}>
                  <div className="flex items-center justify-between flex-wrap" style={{ gap: 8, marginBottom: 10 }}>
                    <div className="flex items-center flex-wrap" style={{ gap: 8 }}>
                      <Layers size={14} style={{ color: D.textSub }} />
                      <span className="text-[12px] font-bold" style={{ color: D.textMain }}>{name}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: D.orangeLight, color: D.orange, border: `1px solid ${D.orange}30` }}>
                        {cfg?.exerciseType || '—'}
                      </span>
                      <span className="text-[10.5px]" style={{ color: D.textMuted }}>Target: {tgt.total} questions</span>
                    </div>
                    <div className="flex items-center" style={{ gap: 8 }}>
                      <span className="text-[11px] font-bold" style={{ color: balancedSec ? D.emerald : D.red }}>
                        {grandSumSec} / {tgt.total}
                      </span>
                      <button type="button" onClick={() => splitSectionEvenly(sid, rowTargetsSec)}
                        className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg"
                        style={{ border: `1px solid ${D.border2}`, color: D.textSub, background: '#fff' }}>
                        Split evenly
                      </button>
                      <button type="button" onClick={() => resetSection(sid)}
                        className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg"
                        style={{ border: `1px solid ${D.border2}`, color: D.textSub, background: '#fff' }}>
                        Reset
                      </button>
                    </div>
                  </div>
                  {tgt.total === 0 ? (
                    <div className="text-[11px]" style={{ color: D.textMuted }}>
                      No questions configured for this section yet — set counts in the Section Configuration step.
                    </div>
                  ) : (
                    <div style={tableWrap}>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={headerCell}>Difficulty</th>
                              {activeCols.map(c => (
                                <th key={c.value} style={{ ...headerCell, textAlign: 'center' }}>{c.label}</th>
                              ))}
                              <th style={{ ...headerCell, textAlign: 'right' }}>Row total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleSecRows.map((diff, i) => {
                              const rSum = rowSumSec(diff);
                              const rTarget = rowTargetsSec[diff];
                              const isLast = i === visibleSecRows.length - 1;
                              const cellBase: React.CSSProperties = { ...bodyCellBase, borderBottom: isLast ? 'none' : `1px solid ${D.border}` };
                              return (
                                <tr key={diff}>
                                  <td style={{ ...cellBase, fontWeight: 600 }}>
                                    <span className="inline-flex items-center capitalize" style={{ gap: 8, color: D.textMain }}>
                                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasSecLevels ? DIFF_COLORS[diff] : D.textHint, flexShrink: 0 }} />
                                      {hasSecLevels ? diff : diff === 'medium' ? 'Questions' : diff}
                                    </span>
                                  </td>
                                  {activeCols.map(c => {
                                    const val = dist[diff]?.[c.value] || 0;
                                    return (
                                      <td key={c.value} style={{ ...cellBase, textAlign: 'center' }}>
                                        <div style={{ display: 'inline-block', width: 96 }}>
                                          <ONumberInput
                                            value={val}
                                            onChange={(nv: number) => setSectionValue(sid, diff, c.value, nv)}
                                            placeholder="0"
                                            min={0}
                                            max={rTarget > 0 ? rTarget : undefined}
                                          />
                                        </div>
                                      </td>
                                    );
                                  })}
                                  <td style={{ ...cellBase, textAlign: 'right' }}>
                                    <span className="text-[11px] font-bold"
                                      style={{ color: rSum === rTarget ? D.emerald : D.red }}>
                                      {rSum} / {rTarget}
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
            })}
          </div>
        );
      })()}

      {/* ── Distribution: non-section aggregate matrix ── */}
      {!isSectionBased && showMatrix && (
        <div style={{ marginTop: 20 }}>
          <SectionHeading
            right={
              <div className="flex items-center" style={{ gap: 8 }}>
                <span className="text-[11px] font-bold"
                  style={{ color: allRowsBalanced ? D.emerald : D.red }}>
                  {/* Section-based has no aggregate target here (sections carry */}
                  {/* their own counts), so show a bare total instead of "N / 0". */}
                  {isSectionBased ? `${grandSum} total` : `${grandSum} / ${target.total}`}
                </span>
                <button type="button" onClick={splitEvenly}
                  className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                  style={{ border: `1px solid ${D.border2}`, color: D.textSub, background: '#fff' }}>
                  Split evenly
                </button>
                <button type="button" onClick={() => setCustomDistribution(emptyCustomDist())}
                  className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg transition-all"
                  style={{ border: `1px solid ${D.border2}`, color: D.textSub, background: '#fff' }}>
                  Reset
                </button>
              </div>
            }
          >
            <span className="inline-flex items-center gap-1">
              Distribution
              <InfoTooltip content="Split each difficulty's configured question count across the sources you ticked. Every row must add up to its configured count." />
            </span>
          </SectionHeading>

          <div style={tableWrap}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={headerCell}>Difficulty</th>
                    {activeCols.map(c => (
                      <th key={c.value} style={{ ...headerCell, textAlign: 'center' }}>{c.label}</th>
                    ))}
                    <th style={{ ...headerCell, textAlign: 'right' }}>Row total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((diff, i) => {
                    const rSum = rowSum(diff);
                    const rTarget = rowTargets[diff];
                    const isLast = i === visibleRows.length - 1;
                    const cellBase: React.CSSProperties = { ...bodyCellBase, borderBottom: isLast ? 'none' : `1px solid ${D.border}` };
                    return (
                      <tr key={diff}>
                        <td style={{ ...cellBase, fontWeight: 600 }}>
                          <span className="inline-flex items-center capitalize" style={{ gap: 8, color: D.textMain }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: hasLevels ? DIFF_COLORS[diff] : D.textHint, flexShrink: 0 }} />
                            {rowCaption(diff)}
                          </span>
                        </td>
                        {activeCols.map(c => {
                          const val = customDistribution[diff]?.[c.value] || 0;
                          // Section-based has no per-difficulty target — allow
                          // the trainer to enter freely; validation happens
                          // per-section elsewhere. Non-section keeps the target
                          // cap so a row can't overflow its configured count.
                          return (
                            <td key={c.value} style={{ ...cellBase, textAlign: 'center' }}>
                              <div style={{ display: 'inline-block', width: 96 }}>
                                <ONumberInput
                                  value={val}
                                  onChange={(nv: number) => setCellValue(diff, c.value, nv)}
                                  placeholder="0"
                                  min={0}
                                  max={!isSectionBased && rTarget > 0 ? rTarget : undefined}
                                />
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ ...cellBase, textAlign: 'right' }}>
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
        </div>
      )}
    </StepShell>
  );
};

export default QuestionSourceStep;
