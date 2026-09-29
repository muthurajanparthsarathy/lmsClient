
import React, { useEffect, useMemo } from 'react';
import { Minus, Plus } from 'lucide-react';
import { D } from './constants';
import { FormDataType } from './types';
import { QuestionSourcePicker } from '@/app/lms/pages/courses/uploadcourseresources/components/youdo/assessments/questionsource/QuestionSourcePicker';
import { SectionHeading, StepShell } from './UIComponents';
import { DistributionMatrix } from './questionsource/DistributionMatrix';

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

type SourceTarget = { total: number; easy: number; medium: number; hard: number };

/** Question counts a Custom split must add up to (0s for section-based). */
export function sourceTarget(formData: FormDataType, isSectionBased: boolean): SourceTarget {
  const none = { total: 0, easy: 0, medium: 0, hard: 0 };
  if (isSectionBased) return none;
  const et = formData.exerciseType;
  if (et === 'MCQ') return { ...none, total: formData.mcqConfig?.generalQuestionCount || 0 };
  const cfg: any = et === 'Other' ? formData.othersConfig : formData.programmingConfig;
  if (!cfg) return none;
  if (cfg.questionConfigType === 'general') return { ...none, total: cfg.generalQuestionCount || 0 };
  const counts = (cfg.questionConfigType === 'selectionLevel' ? cfg.selectionLevelCounts : cfg.levelBasedCounts) || {};
  const easy = counts.easy || 0, medium = counts.medium || 0, hard = counts.hard || 0;
  return { total: easy + medium + hard, easy, medium, hard };
}

/**
 * Why the Custom split does not add up yet, or null when it does (or there
 * is no split to check). Same rule as the matrix's green state: every row
 * must equal its target.
 */
export function distributionIssue(
  dist: CustomDistribution, cols: CustomSubSource[], target: SourceTarget,
): string | null {
  if (cols.length < 2 || target.total <= 0) return null;
  const hasLevels = (target.easy + target.medium + target.hard) > 0;
  const rowTarget = hasLevels ? target : { easy: 0, medium: target.total, hard: 0 };
  const rowSum = (r: 'easy' | 'medium' | 'hard') => cols.reduce((s, c) => s + (dist?.[r]?.[c] || 0), 0);
  const sum = rowSum('easy') + rowSum('medium') + rowSum('hard');
  const bad = (['easy', 'medium', 'hard'] as const).filter(r => rowSum(r) !== rowTarget[r]);
  if (!bad.length) return null;
  if (!hasLevels) return `Split the questions across sources — ${sum} of ${target.total} placed`;
  return `Split ${bad.map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')} across sources — ${sum} of ${target.total} placed`;
}

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
  const target = useMemo(() => sourceTarget(formData, isSectionBased), [formData, isSectionBased]);

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

      {/* ── Distribution: section-based — one We Do matrix per part ── */}
      {/* Each part (Part A / Part B / …) splits its own configured count across */}
      {/* the ticked sources. Downstream (QuestionsTest routing) reads */}
      {/* `customDistributionBySection[sectionId]` for that slot. */}
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
        // Per-section targets from that section's config. MCQ / General →
        // one "Questions" row; level-based Programming → per difficulty;
        // Combined → MCQ count joins the medium row.
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
          const flat = (total: number) => ({ total, easy: 0, medium: 0, hard: 0 });
          if (et === 'MCQ') return flat(mcqCount);
          if (et === 'Programming') {
            return pcType === 'general' ? flat(progTotal) : { total: progTotal, easy: progEasy, medium: progMedium, hard: progHard };
          }
          if (et === 'Combined') {
            return pcType === 'general'
              ? flat(mcqCount + progTotal)
              : { total: mcqCount + progTotal, easy: progEasy, medium: mcqCount + progMedium, hard: progHard };
          }
          return flat(0);
        };
        // Fresh nested objects on every write so no two sections ever share
        // a sub-object (a shared one could mask updates in React's check).
        const cloneDist = (d: CustomDistribution): CustomDistribution => ({
          easy:   { ...d.easy },
          medium: { ...d.medium },
          hard:   { ...d.hard },
        });
        return (
          <div style={{ marginTop: 20 }}>
            <SectionHeading>Distribution</SectionHeading>
            <div className="space-y-4">
              {sectionKeys.map((sid, idx) => {
                const cfg = sectionConfigs[sid];
                const name = cfg?.name || `Part ${String.fromCharCode(65 + idx)}`;
                const tgt = sectionTarget(cfg);
                if (tgt.total === 0) {
                  return (
                    <div key={sid} className="text-[11px]" style={{ color: D.textMuted }}>
                      <strong style={{ color: D.textMain }}>{name}</strong> — no questions configured yet. Set counts in the Section Configuration step.
                    </div>
                  );
                }
                return (
                  <DistributionMatrix key={sid}
                    cols={activeCols.map(c => c.value)}
                    value={customDistributionBySection[sid] || emptyCustomDist()}
                    update={fn => setCustomDistributionBySection(prev => ({
                      ...prev,
                      [sid]: fn(prev[sid] ? cloneDist(prev[sid]) : emptyCustomDist()),
                    }))}
                    target={tgt}
                    title={`${name} · ${cfg?.exerciseType || '—'}`}
                    D={D}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Distribution: whole assessment — the We Do matrix ── */}
      {!isSectionBased && showMatrix && (
        <div style={{ marginTop: 20 }}>
          <DistributionMatrix
            cols={activeCols.map(c => c.value)}
            value={customDistribution}
            update={fn => setCustomDistribution(prev => fn(prev))}
            target={target}
            D={D}
          />
        </div>
      )}
    </StepShell>
  );
};

export default QuestionSourceStep;
