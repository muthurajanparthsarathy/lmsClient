// DistributionMatrix.tsx
// The We Do assignment's Custom-source distribution matrix: rows = difficulty
// (or a single "Questions" row when the pattern has no levels), columns = the
// ticked sources, −/+ steppers per cell, a live "Row / Target" column that is
// green only when the row adds up, COLUMN totals, and Split evenly / Reset.
// + is disabled once a row reaches its target, so a row can never overshoot.
import React from 'react';
import { Check, Circle, Layers, Minus, Plus, Shuffle } from 'lucide-react';
import { FONT } from '../constants';

type Sub = 'scratch' | 'ai' | 'thirdParty';
type Row = 'easy' | 'medium' | 'hard';
type Dist = Record<Row, Record<Sub, number>>;

const ROWS: Row[] = ['easy', 'medium', 'hard'];
const empty = (): Dist => ({
  easy: { scratch: 0, ai: 0, thirdParty: 0 },
  medium: { scratch: 0, ai: 0, thirdParty: 0 },
  hard: { scratch: 0, ai: 0, thirdParty: 0 },
});
const colLabel = (c: Sub) => (c === 'scratch' ? 'Manual' : c === 'ai' ? 'AI Automation' : 'Other Platform');

export interface DistributionMatrixProps {
  /** Ticked sources, in display order. */
  cols: Sub[];
  value: Dist;
  /** Functional update of this matrix's distribution. */
  update: (fn: (prev: Dist) => Dist) => void;
  /** Per-difficulty targets; used as-is when `hasLevels`. */
  target: { total: number; easy: number; medium: number; hard: number };
  /** Header caption; defaults to "Distribution". */
  title?: React.ReactNode;
  D: any;
}

export const DistributionMatrix: React.FC<DistributionMatrixProps> = ({ cols, value, update, target, title, D }) => {
  const hasLevels = (target.easy + target.medium + target.hard) > 0;
  const rowCaption = (r: Row) => (hasLevels ? r : r === 'medium' ? 'Questions' : r);
  const rowTarget: Record<Row, number> = hasLevels
    ? { easy: target.easy, medium: target.medium, hard: target.hard }
    : { easy: 0, medium: target.total, hard: 0 };
  const cell = (r: Row, c: Sub) => value?.[r]?.[c] || 0;
  const rowSum = (r: Row) => cols.reduce((s, c) => s + cell(r, c), 0);
  // Single-row mode still shows any bucket that HOLDS counts (a stale split
  // from a level-based phase) so a red total always has a visible cause.
  const rows = ROWS.filter(r => hasLevels || r === 'medium' || rowSum(r) > 0);
  const colSum = (c: Sub) => ROWS.reduce((s, r) => s + cell(r, c), 0);
  const grandSum = ROWS.reduce((s, r) => s + rowSum(r), 0);
  const balanced = grandSum === target.total && ROWS.every(r => rowSum(r) === rowTarget[r]);

  const bump = (r: Row, c: Sub, delta: number) =>
    update(prev => {
      const base = prev || empty();
      return { ...base, [r]: { ...base[r], [c]: Math.max(0, (base[r]?.[c] || 0) + delta) } };
    });

  const splitEvenly = () => {
    const n = Math.max(1, cols.length);
    const next = empty();
    ROWS.forEach(r => {
      const t = rowTarget[r];
      const base = Math.floor(t / n);
      const rem = t - base * n;
      cols.forEach((c, i) => { next[r][c] = base + (i < rem ? 1 : 0); });
    });
    update(() => next);
  };

  const stepBtn = (disabled: boolean, color: string): React.CSSProperties => ({
    border: `1px solid ${D.border}`, background: '#fff', color,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
  });

  return (
    <div className="rounded-md" style={{ background: '#FAFAF7', border: `1px solid ${D.border}` }}>
      <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: D.border }}>
        <div className="flex items-center gap-1.5">
          <Layers size={12} style={{ color: D.textMuted }} />
          <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: D.textMuted, fontFamily: FONT }}>
            {title ?? 'Distribution'}
          </span>
        </div>
        <span className="text-[13px] font-semibold" aria-live="polite" style={{ color: balanced ? D.emerald : D.red }}>
          {grandSum} / {target.total} {balanced && <Check size={10} style={{ display: 'inline' }} />}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#fff' }}>
              <th className="px-2 py-1.5 text-left font-semibold" style={{ color: D.textMuted, borderBottom: `1px solid ${D.border}` }}></th>
              {cols.map(c => (
                <th key={c} className="px-2 py-1.5 text-center font-semibold" style={{ color: D.textMain, borderBottom: `1px solid ${D.border}` }}>{colLabel(c)}</th>
              ))}
              <th className="px-2 py-1.5 text-center font-semibold" style={{ color: D.textMuted, borderBottom: `1px solid ${D.border}` }}>Row / Target</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const rColor = !hasLevels ? D.textMain : r === 'easy' ? D.emerald : r === 'medium' ? D.amber : D.red;
              const full = rowSum(r) >= rowTarget[r];
              const rBalanced = rowSum(r) === rowTarget[r];
              return (
                <tr key={r}>
                  <td className="px-2 py-1.5 font-semibold capitalize" style={{ color: rColor, borderBottom: `1px solid ${D.border}` }}>
                    <span className="inline-flex items-center gap-1">
                      <Circle size={8} fill={rColor} style={{ color: rColor }} /> {rowCaption(r)}
                    </span>
                  </td>
                  {cols.map(c => {
                    const v = cell(r, c);
                    return (
                      <td key={c} className="px-2 py-1.5 text-center" style={{ borderBottom: `1px solid ${D.border}` }}>
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => bump(r, c, -1)} disabled={v === 0}
                            aria-label={`Fewer ${colLabel(c)} ${rowCaption(r)} questions`}
                            className="w-5 h-5 rounded flex items-center justify-center" style={stepBtn(v === 0, D.textMuted)}>
                            <Minus size={10} />
                          </button>
                          <span className="w-6 text-center font-semibold" style={{ color: D.textMain }}>{v}</span>
                          <button type="button" onClick={() => bump(r, c, +1)} disabled={full}
                            aria-label={`More ${colLabel(c)} ${rowCaption(r)} questions`}
                            className="w-5 h-5 rounded flex items-center justify-center" style={stepBtn(full, D.orange)}>
                            <Plus size={10} />
                          </button>
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center font-semibold" style={{ color: rBalanced ? D.emerald : D.red, borderBottom: `1px solid ${D.border}` }}>
                    {rowSum(r)} / {rowTarget[r]} {rBalanced && <Check size={10} style={{ display: 'inline' }} />}
                  </td>
                </tr>
              );
            })}
            <tr style={{ background: '#fff' }}>
              <td className="px-2 py-1.5 font-semibold uppercase text-[12px]" style={{ color: D.textMuted }}>Column</td>
              {cols.map(c => (
                <td key={c} className="px-2 py-1.5 text-center font-semibold" style={{ color: D.textMain }}>{colSum(c)}</td>
              ))}
              <td className="px-2 py-1.5 text-center font-semibold" style={{ color: balanced ? D.emerald : D.red }}>
                {grandSum} / {target.total}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="px-3 py-2 border-t flex items-center justify-between" style={{ borderColor: D.border }}>
        <button type="button" onClick={splitEvenly}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold"
          style={{ background: 'transparent', color: D.orange, border: `1px solid ${D.orange}` }}>
          <Shuffle size={11} /> Split evenly
        </button>
        <button type="button" onClick={() => update(() => empty())}
          className="text-[11px] font-semibold underline" style={{ color: D.textMuted }}>Reset</button>
      </div>
    </div>
  );
};

export default DistributionMatrix;
