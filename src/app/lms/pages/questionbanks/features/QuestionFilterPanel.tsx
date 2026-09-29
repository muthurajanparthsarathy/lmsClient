'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

// Inline filter panel for the Question Bank — expands on the SAME screen under
// the toolbar (no drawer). DRAFT model: edits stay local until "Apply Filters"
// commits them to the page's filter state; Reset clears both; Apply collapses.

export interface QuestionFilters {
  type: string;     // '' | 'MCQ' | 'Programming'
  category: string;
  difficulty: string;
  marks: string;    // '' | '1-5' | '6-10' | '11-20' | '20+'
  status: string;   // '' | 'true' | 'false'
  createdBy: string;
  date: string;     // '' | '7' | '30' | '90' | 'year'
}

export const EMPTY_QUESTION_FILTERS: QuestionFilters = {
  type: '', category: '', difficulty: '', marks: '', status: '', createdBy: '', date: '',
};

interface Option { value: string; label: string }

interface QuestionFilterPanelProps {
  open: boolean;
  onClose: () => void;
  current: QuestionFilters;
  categoryOptions: Option[];
  createdByOptions: Option[];
  onApply: (filters: QuestionFilters) => void;
  onReset: () => void;
}

const SELECT_CLS =
  'w-full h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm text-body ' +
  'focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150';

const TYPE_OPTIONS: Option[] = [{ value: 'MCQ', label: 'MCQ' }, { value: 'Programming', label: 'Programming' }];
const DIFFICULTY_OPTIONS: Option[] = [{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }];
const MARKS_OPTIONS: Option[] = [{ value: '1-5', label: '1 – 5 marks' }, { value: '6-10', label: '6 – 10 marks' }, { value: '11-20', label: '11 – 20 marks' }, { value: '20+', label: '20+ marks' }];
const STATUS_OPTIONS: Option[] = [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }];
const DATE_OPTIONS: Option[] = [{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: 'year', label: 'This year' }];

function Field({ label, value, onChange, allLabel, options }: { label: string; value: string; onChange: (v: string) => void; allLabel: string; options: Option[] }) {
  return (
    <div>
      <span className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-subtle">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={SELECT_CLS}>
        <option value="">{allLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export default function QuestionFilterPanel({ open, onClose, current, categoryOptions, createdByOptions, onApply, onReset }: QuestionFilterPanelProps) {
  const [draft, setDraft] = useState<QuestionFilters>(current);

  useEffect(() => {
    if (open) setDraft(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key: keyof QuestionFilters) => (v: string) => setDraft((d) => ({ ...d, [key]: v }));
  const draftActive = Object.values(draft).some(Boolean);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-3 rounded-xl border border-hairline bg-surface p-4 shadow-xs sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-heading">Filters</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setDraft(EMPTY_QUESTION_FILTERS); onReset(); }}
                  disabled={!draftActive}
                  className="inline-flex h-8 items-center gap-1.5 rounded-control border border-hairline-strong bg-surface px-3 text-xs font-medium text-body transition-colors duration-150 hover:bg-row-hover hover:text-heading disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <RotateCcw size={13} /> Reset
                </button>
                <button
                  type="button"
                  onClick={() => { onApply(draft); onClose(); }}
                  className="inline-flex h-8 items-center rounded-control bg-brand-strong px-3.5 text-xs font-semibold text-white shadow-xs transition-colors duration-150 hover:bg-brand-800"
                >
                  Apply Filters
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Question Type" value={draft.type} onChange={set('type')} allLabel="All types" options={TYPE_OPTIONS} />
              <Field label="Category" value={draft.category} onChange={set('category')} allLabel="All categories" options={categoryOptions} />
              <Field label="Difficulty" value={draft.difficulty} onChange={set('difficulty')} allLabel="All difficulties" options={DIFFICULTY_OPTIONS} />
              <Field label="Marks" value={draft.marks} onChange={set('marks')} allLabel="Any marks" options={MARKS_OPTIONS} />
              <Field label="Status" value={draft.status} onChange={set('status')} allLabel="Any status" options={STATUS_OPTIONS} />
              <Field label="Created By" value={draft.createdBy} onChange={set('createdBy')} allLabel="Anyone" options={createdByOptions} />
              <Field label="Created Date" value={draft.date} onChange={set('date')} allLabel="Any time" options={DATE_OPTIONS} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
