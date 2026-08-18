// DocQuestionPicker — selection step between "parse an uploaded .txt" and
// "inject into the question form". Lists every parsed question with a
// checkbox; ticking is clamped to the remaining MANUAL quota (overall count
// for general configs, per-difficulty caps for levelBased/selectionLevel —
// the same SelectionQuota contract the Question Bank picker uses). The
// confirmed subset flows into the form's review-then-save funnel exactly
// like bank picks, so the trainer still reviews each question (Save & Next).
import React, { useMemo, useState } from 'react';
import { X, FileText, CheckSquare, Square, FlaskConical, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import type { SelectionQuota } from './mcq/QuestionBankSelector';

const JKT: React.CSSProperties = {
  fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
};

type Diff = 'easy' | 'medium' | 'hard';
const diffOf = (d: any): Diff => (d === 'easy' || d === 'hard' ? d : 'medium');
const DIFF_STYLE: Record<Diff, { color: string; bg: string }> = {
  easy: { color: '#059669', bg: 'rgba(5,150,105,0.09)' },
  medium: { color: '#d97706', bg: 'rgba(217,119,6,0.09)' },
  hard: { color: '#dc2626', bg: 'rgba(220,38,38,0.09)' },
};

interface DocQuestionPickerProps {
  /** Parsed questions; each must carry a stable `_previewId`. */
  questions: any[];
  /** Remaining manual-slot caps. Omitted → no cap (legacy exercises). */
  selectionQuota?: SelectionQuota;
  onConfirm: (selected: any[]) => void;
  onClose: () => void;
}

const DocQuestionPicker: React.FC<DocQuestionPickerProps> = ({
  questions, selectionQuota, onConfirm, onClose,
}) => {
  // Greedily pre-tick as many as the open slots allow (document order,
  // per level) — mirrors the assessment-side picker's behavior.
  const [selected, setSelected] = useState<Set<string>>(() => {
    const sel = new Set<string>();
    const counts: Record<Diff, number> = { easy: 0, medium: 0, hard: 0 };
    for (const q of questions) {
      if (selectionQuota?.mode === 'general' && sel.size >= Math.max(0, selectionQuota.remainingTotal)) break;
      if (selectionQuota?.mode === 'difficulty') {
        const d = diffOf(q.difficulty);
        if (counts[d] >= Math.max(0, selectionQuota.remainingByDifficulty[d] ?? 0)) continue;
        counts[d]++;
      }
      sel.add(q._previewId);
    }
    return sel;
  });

  const selectedByDiff = useMemo(() => {
    const counts: Record<Diff, number> = { easy: 0, medium: 0, hard: 0 };
    questions.forEach(q => { if (selected.has(q._previewId)) counts[diffOf(q.difficulty)]++; });
    return counts;
  }, [questions, selected]);

  const capFor = (d: Diff): number | null => {
    if (!selectionQuota) return null;
    if (selectionQuota.mode === 'general') return null; // total cap handled separately
    return Math.max(0, selectionQuota.remainingByDifficulty[d] ?? 0);
  };
  const totalCap = selectionQuota?.mode === 'general' ? Math.max(0, selectionQuota.remainingTotal) : null;

  const toggle = (q: any) => {
    const id = q._previewId;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); return next; }

      if (totalCap !== null && next.size >= totalCap) {
        toast(`Only ${totalCap} open Manual slot${totalCap === 1 ? '' : 's'} — deselect one to swap.`, { icon: 'ℹ️', id: 'doc-cap' });
        return prev;
      }
      if (selectionQuota?.mode === 'difficulty') {
        const d = diffOf(q.difficulty);
        const cap = capFor(d) ?? 0;
        if (cap === 0) {
          const open = (['easy', 'medium', 'hard'] as Diff[])
            .filter(k => (capFor(k) ?? 0) > 0)
            .map(k => `${k} (${capFor(k)})`);
          toast(
            open.length
              ? `This exercise has no open ${d} slots. Open: ${open.join(', ')}.`
              : 'All Manual slots are already used.',
            { icon: 'ℹ️', id: 'doc-cap' },
          );
          return prev;
        }
        if (selectedByDiff[d] >= cap) {
          toast(`All ${cap} ${d} slot${cap === 1 ? '' : 's'} ticked — deselect a ${d} question to swap.`, { icon: 'ℹ️', id: 'doc-cap' });
          return prev;
        }
      }
      next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const next = new Set<string>();
    const counts: Record<Diff, number> = { easy: 0, medium: 0, hard: 0 };
    for (const q of questions) {
      if (totalCap !== null && next.size >= totalCap) break;
      if (selectionQuota?.mode === 'difficulty') {
        const d = diffOf(q.difficulty);
        if (counts[d] >= (capFor(d) ?? 0)) continue;
        counts[d]++;
      }
      next.add(q._previewId);
    }
    if (next.size < questions.length) {
      toast(`Selected ${next.size} of ${questions.length} — the rest exceed the open Manual slots.`, { icon: 'ℹ️', id: 'doc-cap' });
    }
    setSelected(next);
  };

  const quotaChip = () => {
    if (!selectionQuota) return `${selected.size} selected`;
    if (selectionQuota.mode === 'general') return `${selected.size} / ${totalCap} open slots`;
    const parts = (['easy', 'medium', 'hard'] as Diff[])
      .filter(d => (capFor(d) ?? 0) > 0 || selectedByDiff[d] > 0)
      .map(d => `${d[0].toUpperCase()}${d.slice(1)} ${selectedByDiff[d]}/${capFor(d)}`);
    return parts.length ? parts.join(' · ') : 'No open slots';
  };

  return (
    <>
      <div className="fixed inset-0 z-[120]" style={{ background: 'rgba(26,26,46,0.45)', backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div className="fixed inset-0 z-[121] flex items-center justify-center p-4" style={{ pointerEvents: 'none' }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
          style={{ ...JKT, border: '1px solid #e4e4ed', maxHeight: '84vh', pointerEvents: 'auto' }}>

          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-4 py-3" style={{ borderBottom: '1px solid #e4e4ed' }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(8,145,178,0.1)' }}>
                <FileText size={14} style={{ color: '#0891b2' }} />
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-bold" style={{ color: '#1a1a2e' }}>Select questions to import</div>
                <div className="text-[10.5px]" style={{ color: '#8b8b9e' }}>
                  {questions.length} parsed from document — imports use the Manual quota
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ cursor: 'pointer', color: '#bcbccc', lineHeight: 0, padding: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#6b6b7e')}
              onMouseLeave={e => (e.currentTarget.style.color = '#bcbccc')}>
              <X size={15} />
            </button>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5" style={{ scrollbarWidth: 'thin' }}>
            {questions.map(q => {
              const isSel = selected.has(q._previewId);
              const d = diffOf(q.difficulty);
              const ds = DIFF_STYLE[d];
              const tcs = Array.isArray(q.testCases) ? q.testCases : [];
              const hidden = tcs.filter((t: any) => t?.isHidden).length;
              return (
                <button key={q._previewId} onClick={() => toggle(q)}
                  className="w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2.5 transition-all"
                  style={{ border: `1px solid ${isSel ? '#F27757' : '#ecedf1'}`, background: isSel ? 'rgba(242,119,87,0.04)' : '#fff', cursor: 'pointer' }}>
                  {isSel
                    ? <CheckSquare size={15} className="flex-shrink-0" style={{ color: '#F27757' }} />
                    : <Square size={15} className="flex-shrink-0" style={{ color: '#cfcfda' }} />}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold truncate" style={{ color: '#1a1a2e' }}>{q.title || 'Untitled question'}</div>
                    {tcs.length > 0 && (
                      <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: '#8b8b9e' }}>
                        <span className="inline-flex items-center gap-1"><FlaskConical size={9} />{tcs.length} test case{tcs.length === 1 ? '' : 's'}</span>
                        {hidden > 0 && <span className="inline-flex items-center gap-1"><EyeOff size={9} />{hidden} hidden</span>}
                      </div>
                    )}
                  </div>
                  <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 capitalize"
                    style={{ color: ds.color, background: ds.bg }}>
                    {d}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid #e4e4ed', background: '#fafafa' }}>
            <span className="text-[10.5px] font-semibold flex-1 min-w-0 truncate" style={{ color: '#6b6b7e' }}>{quotaChip()}</span>
            <button onClick={selectAll}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
              style={{ border: '1px solid #e4e4ed', color: '#6b6b7e', background: '#fff', cursor: 'pointer' }}>
              Select all
            </button>
            <button onClick={onClose}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
              style={{ border: '1px solid #e4e4ed', color: '#6b6b7e', background: '#fff', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={() => {
                if (selected.size === 0) { toast('Tick at least one question.', { icon: 'ℹ️', id: 'doc-cap' }); return; }
                onConfirm(questions.filter(q => selected.has(q._previewId)));
              }}
              className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white transition-all"
              style={{ background: selected.size ? '#F27757' : '#f3c1b2', cursor: selected.size ? 'pointer' : 'not-allowed', border: 'none' }}>
              Use {selected.size} selected
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default DocQuestionPicker;
