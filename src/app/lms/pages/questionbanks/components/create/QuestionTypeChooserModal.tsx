'use client';

/**
 * Step 1 of the Create Question flow: pick Programming or MCQ.
 * Compact premium modal matching the questionbanks design tokens.
 */

import React from 'react';
import { X, Code2, ListChecks, ChevronRight } from 'lucide-react';

export type CreateQType = 'programming' | 'mcq';

const CARDS: { key: CreateQType; title: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'programming', title: 'Programming Question', desc: 'Coding problem with constraints, starter code and test cases', icon: <Code2 size={18} /> },
  { key: 'mcq', title: 'MCQ Question', desc: 'Choice, true/false, matching, ordering, numeric and more', icon: <ListChecks size={18} /> },
];

const QuestionTypeChooserModal = ({ recommended, onPick, onClose }: {
  recommended?: CreateQType;
  onPick: (t: CreateQType) => void;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-[115] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-hairline bg-surface shadow-2xl">
      <div className="flex items-start justify-between border-b border-hairline px-5 py-4">
        <div>
          <h2 className="text-[15px] font-bold text-heading">Create Question</h2>
          <p className="mt-0.5 text-[12px] text-subtle">Choose the type of question to add to your question bank.</p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-faint transition-colors hover:bg-row-hover hover:text-subtle" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="space-y-2.5 p-4">
        {CARDS.map(c => (
          <button key={c.key} type="button" onClick={() => onPick(c.key)}
            className="group flex w-full items-center gap-3 rounded-xl border border-hairline bg-surface p-4 text-left shadow-xs transition-all duration-150 hover:border-brand-500/40 hover:bg-brand-wash/40 hover:shadow-brand/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-wash text-brand-strong">
              {c.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-heading">
                {c.title}
                {recommended === c.key && (
                  <span className="rounded-full border border-brand-500/30 bg-brand-wash px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-brand-strong">
                    Recommended
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11.5px] text-subtle">{c.desc}</div>
            </div>
            <ChevronRight size={15} className="shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>
      <div className="px-4 pb-4">
        <button onClick={onClose}
          className="h-9 w-full rounded-control border border-hairline-strong bg-surface text-[12.5px] font-medium text-subtle transition-colors hover:bg-row-hover">
          Cancel
        </button>
      </div>
    </div>
  </div>
);

export default QuestionTypeChooserModal;
