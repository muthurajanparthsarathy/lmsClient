'use client';

/**
 * Wizard step 3 — Question Source.
 *
 * Mirrors the You_Do QuestionSourceStep: a multi-select of Manual / AI
 * Automation / Other Platform, and — once more than one is ticked — a
 * distribution matrix where the author says how many questions come from each,
 * per difficulty row, with +/- steppers, per-row targets, a grand total, and
 * Split evenly / Reset shortcuts.
 *
 * The rows come from whatever Step 2 configured: a level-based config gives
 * Easy / Medium / Hard rows with their own targets; anything else gives one
 * "Questions" row targeting the total count. That coupling is the point — the
 * matrix must add up to the paper Step 2 described, or the two disagree.
 */

import React, { useCallback, useMemo } from 'react';
import { Folder, Layers, Info, Plus, Minus } from 'lucide-react';
import {
  D, SectionLabel, InfoTooltip,
} from './ui';
import type {
  ExternalSourceKey,
  ExternalCustomDistribution,
  ExternalSourceCounts,
} from '@/apiServices/externalAssessment';

const SOURCES: Array<{ value: ExternalSourceKey; label: string }> = [
  { value: 'scratch', label: 'Manual' },
  { value: 'ai', label: 'AI Automation' },
  { value: 'thirdParty', label: 'Other Platform' },
];

type RowKey = 'general' | 'easy' | 'medium' | 'hard';

const DIFF_COLORS: Record<string, string> = {
  easy: D.emerald,
  medium: D.amber,
  hard: D.red,
  general: D.textMain,
};

export interface QuestionSourceStepProps {
  sources: ExternalSourceKey[];
  onSourcesChange: (next: ExternalSourceKey[]) => void;
  distribution: ExternalCustomDistribution;
  onDistributionChange: (next: ExternalCustomDistribution) => void;
  /** Row key → how many questions that row must account for. */
  rowTargets: Partial<Record<RowKey, number>>;
  error?: string;
}

export default function QuestionSourceStep({
  sources, onSourcesChange, distribution, onDistributionChange, rowTargets, error,
}: QuestionSourceStepProps) {
  // Only rows Step 2 actually configured. A level-based config yields the
  // three difficulty rows; everything else yields the single `general` row.
  const rows = useMemo(
    () => (Object.keys(rowTargets) as RowKey[]).filter((r) => rowTargets[r] !== undefined),
    [rowTargets],
  );

  const activeCols = useMemo(
    () => SOURCES.filter((s) => sources.includes(s.value)),
    [sources],
  );

  // The matrix only earns its space once there is something to split.
  const showMatrix = activeCols.length > 1;

  const cell = (row: RowKey, src: ExternalSourceKey): number =>
    Number((distribution?.[row] as ExternalSourceCounts | undefined)?.[src] ?? 0);

  const rowSum = useCallback(
    (row: RowKey) => activeCols.reduce((sum, c) => sum + cell(row, c.value), 0),
    [activeCols, distribution],
  );

  const grandSum = rows.reduce((sum, r) => sum + rowSum(r), 0);
  const grandTarget = rows.reduce((sum, r) => sum + (rowTargets[r] ?? 0), 0);
  const balanced = rows.every((r) => rowSum(r) === (rowTargets[r] ?? 0));

  const setCell = (row: RowKey, src: ExternalSourceKey, delta: number) => {
    const current = cell(row, src);
    const next = Math.max(0, current + delta);
    onDistributionChange({
      ...distribution,
      [row]: { ...(distribution?.[row] || {}), [src]: next },
    });
  };

  /**
   * Spread each row's target across the ticked sources as evenly as it goes,
   * handing the remainder to the earliest columns — so 3 questions across 2
   * sources becomes 2 + 1 rather than 1 + 1 with one unallocated.
   */
  const splitEvenly = () => {
    const next: ExternalCustomDistribution = { ...distribution };
    for (const row of rows) {
      const target = rowTargets[row] ?? 0;
      const n = activeCols.length;
      if (!n) continue;
      const base = Math.floor(target / n);
      const remainder = target % n;
      const counts: ExternalSourceCounts = {};
      activeCols.forEach((c, i) => { counts[c.value] = base + (i < remainder ? 1 : 0); });
      next[row] = counts;
    }
    onDistributionChange(next);
  };

  const reset = () => {
    const next: ExternalCustomDistribution = { ...distribution };
    for (const row of rows) next[row] = { scratch: 0, ai: 0, thirdParty: 0 };
    onDistributionChange(next);
  };

  const toggleSource = (value: ExternalSourceKey) => {
    const has = sources.includes(value);
    // Never let the last source be unticked — a paper has to come from
    // somewhere, and an empty set would leave the matrix with no columns.
    if (has && sources.length === 1) return;
    onSourcesChange(has ? sources.filter((s) => s !== value) : [...sources, value]);
  };

  const card: React.CSSProperties = {
    border: `1px solid ${D.border}`,
    borderRadius: 14,
    background: '#fff',
    padding: '14px 16px',
  };

  return (
    <div className="space-y-4">
      {/* ── Source picker ── */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{ background: D.surface, borderBottom: `1px solid ${D.border}` }}
        >
          <Folder size={13} style={{ color: D.textMuted }} />
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: D.textSub }}>
            Question Source
          </span>
          <span className="text-[11px] font-bold" style={{ color: D.orange }}>*</span>
        </div>

        <div className="px-4 py-3.5">
          <div className="flex items-center gap-6 flex-wrap">
            {SOURCES.map((s) => {
              const on = sources.includes(s.value);
              const isLast = on && sources.length === 1;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => toggleSource(s.value)}
                  title={isLast ? 'At least one source is required' : undefined}
                  className={`flex items-center gap-2 ${isLast ? 'cursor-default' : ''}`}
                >
                  <span
                    className="inline-flex size-[18px] items-center justify-center rounded transition-colors"
                    style={{
                      background: on ? D.orange : '#fff',
                      border: `1.5px solid ${on ? D.orange : '#cbd5e1'}`,
                    }}
                  >
                    {on && (
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.2l2.4 2.4L9.6 3.9" stroke="#fff" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="text-[13px] font-semibold" style={{ color: on ? D.textMain : D.textMuted }}>
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>

          {showMatrix && (
            <div
              className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}
            >
              <Info size={14} className="mt-px shrink-0" style={{ color: '#2563eb' }} />
              <p className="text-[12px]" style={{ color: '#1d4ed8' }}>
                Combining {activeCols.length} sources — set the per-source count in the table below.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-2 text-[10px] font-medium" style={{ color: D.red }}>{error}</p>
          )}
        </div>
      </div>

      {/* ── Distribution matrix ── */}
      {showMatrix && (
        <div style={card}>
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Layers size={14} style={{ color: D.orange }} />
              <span className="text-[12px] font-bold" style={{ color: D.textMain }}>
                Distribute questions per source
              </span>
              <InfoTooltip content="Split each row's configured question count across the sources you ticked. Every row must add up to its target." />
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: balanced ? D.emerald : D.red }}
              >
                {grandSum} / {grandTarget}
              </span>
              <button
                type="button" onClick={splitEvenly}
                className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                style={{ border: `1px solid ${D.border2}`, color: D.textSub, background: '#fff' }}
              >
                Split evenly
              </button>
              <button
                type="button" onClick={reset}
                className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                style={{ border: `1px solid ${D.border2}`, color: D.textSub, background: '#fff' }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="text-left text-[10.5px] font-semibold pb-2" style={{ color: D.textMuted }}>
                    Difficulty
                  </th>
                  {activeCols.map((c) => (
                    <th key={c.value} className="text-center text-[10.5px] font-semibold pb-2" style={{ color: D.textMuted }}>
                      {c.label}
                    </th>
                  ))}
                  <th className="text-right text-[10.5px] font-semibold pb-2" style={{ color: D.textMuted }}>
                    Row total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const sum = rowSum(row);
                  const target = rowTargets[row] ?? 0;
                  return (
                    <tr key={row}>
                      <td className="py-1.5">
                        <span
                          className="text-[11px] font-bold capitalize"
                          style={{ color: DIFF_COLORS[row] || D.textMain }}
                        >
                          {row === 'general' ? 'Questions' : row}
                        </span>
                      </td>
                      {activeCols.map((c) => {
                        const val = cell(row, c.value);
                        // Cap at the row's target so a row cannot overflow the
                        // count Step 2 configured.
                        const plusDisabled = sum >= target;
                        return (
                          <td key={c.value} className="py-1.5 text-center">
                            <div
                              className="inline-flex items-center gap-1.5 px-1.5 py-1 rounded-lg"
                              style={{ border: `1px solid ${D.border2}`, background: D.surface }}
                            >
                              <button
                                type="button"
                                onClick={() => setCell(row, c.value, -1)}
                                disabled={val <= 0}
                                aria-label={`Decrease ${c.label}`}
                                className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                                style={{
                                  background: '#fff',
                                  border: `1px solid ${D.border2}`,
                                  color: val <= 0 ? D.border2 : D.textSub,
                                  cursor: val <= 0 ? 'default' : 'pointer',
                                }}
                              >
                                <Minus size={10} />
                              </button>
                              <span className="text-[11.5px] font-bold w-5 text-center tabular-nums" style={{ color: D.textMain }}>
                                {val}
                              </span>
                              <button
                                type="button"
                                onClick={() => setCell(row, c.value, 1)}
                                disabled={plusDisabled}
                                aria-label={`Increase ${c.label}`}
                                className="w-5 h-5 rounded flex items-center justify-center transition-colors"
                                style={{
                                  background: '#fff',
                                  border: `1px solid ${D.border2}`,
                                  color: plusDisabled ? D.border2 : D.textSub,
                                  cursor: plusDisabled ? 'default' : 'pointer',
                                }}
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-1.5 text-right">
                        <span
                          className="text-[11px] font-bold tabular-nums"
                          style={{ color: sum === target ? D.emerald : D.red }}
                        >
                          {sum} / {target}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {grandTarget === 0 && (
            <p className="mt-2 text-[10.5px]" style={{ color: D.textMuted }}>
              Set a question count on Step 2 to give these rows a target.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
