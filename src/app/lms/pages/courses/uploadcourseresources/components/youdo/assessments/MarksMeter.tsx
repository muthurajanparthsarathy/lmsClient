// MarksMeter.tsx
// Live "Total / Used / Remaining" marks pills — the same readout the We Do
// assignment shows beside Questions & Scoring — plus the helper that turns a
// level-based / selection-level config into a plain-language allocation issue.
// Every count and marks input in the configuration steps commits on each
// keystroke (ONumberInput liveUpdate), so the pills and the issue line
// re-validate while the trainer types.
import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDecimal } from './constants';

const pill = (bg: string, line: string, text: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 5, height: 23, padding: '0 9px',
  borderRadius: 999, fontSize: 10.8, fontWeight: 600, whiteSpace: 'nowrap',
  background: bg, border: `1px solid ${line}`, color: text,
});
const PILL = {
  green: pill('#ECFDF3', '#C7EBD5', '#046C4E'),
  amber: pill('#FFFAEB', '#F5DFA8', '#B54708'),
  red:   pill('#FEF3F2', '#FBD3CE', '#D92D20'),
  blue:  pill('#EFF6FF', '#CFE0FB', '#175CD3'),
  grey:  pill('#F4F4F5', '#E7E5E4', '#57606E'),
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const MarksMeter: React.FC<{ total: number; used: number }> = ({ total, used }) => {
  const t = Number(total) || 0;
  const u = round2(Number(used) || 0);
  const remaining = round2(t - u);
  const over = remaining < -0.005;
  const done = Math.abs(remaining) < 0.01 && t > 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }} aria-live="polite">
      <span style={PILL.blue}>Total <strong>{formatDecimal(t)}</strong></span>
      <span style={u > 0 ? (over ? PILL.red : PILL.green) : PILL.grey}>Used <strong>{formatDecimal(u)}</strong></span>
      <span style={done ? PILL.green : over ? PILL.red : PILL.amber}>
        {over ? 'Over by' : 'Remaining'} <strong>{formatDecimal(Math.abs(remaining))}</strong>
      </span>
    </div>
  );
};

/** Red/green line under the meter. `issue` null + something allocated = ok. */
export const MarksIssue: React.FC<{ issue: string | null; ok?: boolean }> = ({ issue, ok }) => {
  if (!issue && !ok) return null;
  const color = issue ? '#D92D20' : '#046C4E';
  return (
    <div role={issue ? 'alert' : undefined} className="flex items-center gap-2 px-3 py-2 rounded-lg"
      style={{ background: issue ? '#FEF3F2' : '#ECFDF3', border: `1px solid ${issue ? '#FBD3CE' : '#C7EBD5'}` }}>
      {issue ? <AlertCircle size={13} style={{ color }} /> : <CheckCircle2 size={13} style={{ color }} />}
      <p className="text-xs font-semibold flex-1" style={{ color }}>{issue || 'Marks match the total.'}</p>
    </div>
  );
};

const LEVELS = ['easy', 'medium', 'hard'] as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Marks one level contributes: count × per-question, or the level's total. */
export function levelMarks(cfg: any, level: (typeof LEVELS)[number]): number {
  const ct = cfg?.questionConfigType;
  const counts = (ct === 'selectionLevel' ? cfg?.selectionLevelCounts : cfg?.levelBasedCounts) || {};
  const c = Number(counts[level]) || 0;
  if (!c) return 0;
  const s = cfg?.scoreSettings?.levelScoringConfiguration?.[level];
  if (!s) return 0;
  return s.type === 'question_specific' ? Number(s.totalMarks) || 0 : (Number(s.marksPerQuestion) || 0) * c;
}

/**
 * What is wrong with a level-based / selection-level allocation right now,
 * or null when it is fine (or there is nothing to check yet). General configs
 * split the total automatically, so they never have an issue here.
 */
export function levelAllocationIssue(cfg: any, total: number): string | null {
  const ct = cfg?.questionConfigType;
  if (ct !== 'levelBased' && ct !== 'selectionLevel') return null;
  const counts = (ct === 'selectionLevel' ? cfg?.selectionLevelCounts : cfg?.levelBasedCounts) || {};
  const active = LEVELS.filter(l => (Number(counts[l]) || 0) > 0);
  if (!active.length) return null;
  const ls = cfg?.scoreSettings?.levelScoringConfiguration || {};
  const unset = active.filter(l => {
    const s = ls[l];
    const v = s?.type === 'question_specific' ? s?.totalMarks : s?.marksPerQuestion;
    return !(Number(v) > 0);
  });
  if (unset.length) return `Enter marks for ${unset.map(cap).join(', ')}.`;
  const t = Number(total) || 0;
  if (t <= 0) return 'Set the total marks in General first.';
  const sum = round2(active.reduce((s, l) => s + levelMarks(cfg, l), 0));
  const diff = round2(t - sum);
  if (Math.abs(diff) < 0.01) return null;
  return diff > 0
    ? `${formatDecimal(diff)} marks still to allocate — levels add up to ${formatDecimal(sum)} of ${formatDecimal(t)}.`
    : `Over by ${formatDecimal(-diff)} marks — levels add up to ${formatDecimal(sum)} of ${formatDecimal(t)}.`;
}
