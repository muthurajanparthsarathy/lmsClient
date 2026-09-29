'use client';

// Question Bank listing — proper multi-column table (matches Client Management
// density: h-8 header @ text-[10px], h-11 row @ text-[12px], flat wrapper).
// Every field the row previously stacked as a chip is now its own column.

import React from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Eye, ListChecks, MoreVertical, Pencil, Power, SearchX, Terminal, Trash2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/app/lms/shared/ui';
import type { Question } from '@/apiServices/type/question';
import {
  formatDifficulty, getDescriptionText, getDifficulty,
  getQuestionTitleText, getQuestionTypeInfo, getScore, isMcqQuestion, stripHtml,
} from './lib';

interface QuestionsTableProps {
  questions: Question[];
  isLoading: boolean;
  isFiltered: boolean;
  // Kept for API compatibility with QuestionBanksPage; the row layout is now
  // a single-line table and no longer varies by density.
  density?: 'list' | 'compact';
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onPreview: (question: Question) => void;
  onEdit: (question: Question) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: boolean) => Promise<void> | void;
  onClearFilters: () => void;
  onCreateMcq: () => void;
  onCreateProgramming: () => void;
  /** Skeleton rows to draw while loading. Pass the page size so the placeholder
   *  is the same height as the list that replaces it — otherwise the table
   *  jumps as the real rows land. */
  skeletonRows?: number;
  maxBodyHeight?: string;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canToggle?: boolean;
  canCreate?: boolean;
}

// Widths as percentages summing to 100 — `table-layout: fixed` fills the
// container edge-to-edge with no horizontal scrollbar; long values truncate.
// Status / Created By / Created columns dropped — status lives in the kebab,
// and the audit columns crowded out the real content.
const COL = {
  check: 'w-[4%] pl-4 sm:pl-5 pr-0 text-left',
  num: 'w-[4%] px-3 text-left',
  title: 'w-[32%] px-3 text-left',
  type: 'w-[12%] px-3 text-left',
  category: 'w-[18%] px-3 text-left',
  difficulty: 'w-[14%] px-3 text-left',
  marks: 'w-[8%] px-3 text-left',
};

const HEAD_CELL =
  'h-8 text-[10px] font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap';
const BODY_CELL = 'h-11 align-middle text-[12px] text-body';
const ACTIONS_HEAD = 'w-[8%] no-print pl-2 pr-4 sm:pr-5 text-right';

function RowActions({ q, onPreview, onEdit, onDelete, onToggleStatus, canView, canEdit, canDelete, canToggle }: {
  q: Question;
  onPreview: (q: Question) => void;
  onEdit: (q: Question) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: boolean) => Promise<void> | void;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canToggle: boolean;
}) {
  if (!canView && !canEdit && !canDelete && !canToggle) return null;
  const showSeparator = canDelete && (canView || canEdit || canToggle);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Question actions" className="inline-flex size-7 items-center justify-center rounded-chip text-subtle transition-colors duration-150 hover:bg-ink-100 hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 data-[state=open]:bg-ink-100 data-[state=open]:text-heading">
          <MoreVertical size={14} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="w-44">
        {canView && <DropdownMenuItem onSelect={() => onPreview(q)}><Eye size={14} /> View details</DropdownMenuItem>}
        {canEdit && <DropdownMenuItem onSelect={() => onEdit(q)}><Pencil size={14} /> Edit</DropdownMenuItem>}
        {canToggle && (
          <DropdownMenuItem onSelect={() => q._id && onToggleStatus(q._id, !q.isActive)}>
            <Power size={14} className={q.isActive ? undefined : 'text-success-700'} /> {q.isActive ? 'Archive (deactivate)' : 'Activate'}
          </DropdownMenuItem>
        )}
        {showSeparator && <DropdownMenuSeparator />}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onSelect={() => q._id && onDelete(q._id)}><Trash2 size={14} /> Delete</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function QuestionsTable({
  questions, isLoading, isFiltered, selectedIds, onSelectionChange,
  onPreview, onEdit, onDelete, onToggleStatus, onClearFilters, onCreateMcq, onCreateProgramming,
  skeletonRows = 8,
  canView = true, canEdit = true, canDelete = true, canToggle = true, canCreate = true,
}: QuestionsTableProps) {
  const ids = questions.map((q, i) => q._id || `q-${i}`);
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  const someSelected = ids.some((id) => selectedIds.includes(id));
  const toggleAll = () => onSelectionChange(allSelected ? selectedIds.filter((id) => !ids.includes(id)) : Array.from(new Set([...selectedIds, ...ids])));
  const toggleOne = (id: string) => onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  if (!isLoading && questions.length === 0) {
    return (
      <div className="py-12">
        {isFiltered ? (
          <EmptyState icon={SearchX} title="No questions match your filters" message="Try a different search term, or clear the filters to see the full question library." primaryAction={<Button size="sm" variant="outline" onClick={onClearFilters}>Clear filters</Button>} />
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No questions yet"
            message="Build your assessment library by creating an MCQ or programming question."
            primaryAction={canCreate ? <Button size="sm" onClick={onCreateMcq}><ListChecks size={14} /> New MCQ question</Button> : undefined}
            secondaryAction={canCreate ? <Button size="sm" variant="outline" onClick={onCreateProgramming}><Terminal size={14} /> New programming question</Button> : undefined}
          />
        )}
      </div>
    );
  }

  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const COL_SPAN = 8;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* overflow-y-auto, NOT overflow-hidden. The internal bank auto-fits its
          page size to this slot, so it rarely overflows — but the External bank
          asks for a FIXED 10 rows, and on a short viewport the last rows do not
          fit. Hidden dropped them with no scrollbar and no other clue: the grid
          showed 8 rows while the footer paged in tens. The sticky header stays
          pinned inside the scroll container.

          overflow-x stays clipped: table-layout is fixed at 100 % width, so
          there is nothing to scroll sideways to. */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead className="sticky top-0 z-sticky">
            <tr>
              <th className={`${HEAD_CELL} ${COL.check}`}>
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  aria-label="Select all questions"
                  checked={allSelected}
                  onChange={toggleAll}
                  disabled={isLoading || questions.length === 0}
                  className="size-4 rounded border-hairline-strong accent-brand cursor-pointer align-middle disabled:opacity-40"
                />
              </th>
              <th className={`${HEAD_CELL} ${COL.num}`}>#</th>
              <th className={`${HEAD_CELL} ${COL.title}`}>Title</th>
              <th className={`${HEAD_CELL} ${COL.type}`}>Type</th>
              <th className={`${HEAD_CELL} ${COL.category}`}>Category</th>
              <th className={`${HEAD_CELL} ${COL.difficulty}`}>Difficulty</th>
              <th className={`${HEAD_CELL} ${COL.marks}`}>Marks</th>
              <th className={`${HEAD_CELL} ${ACTIONS_HEAD}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: Math.max(1, skeletonRows) }).map((_, i) => (
                <tr key={i} className="border-b border-hairline">
                  <td className={`${COL.check} ${BODY_CELL}`}>
                    <div className="size-4 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </td>
                  <td className={`${COL.num} ${BODY_CELL}`}>
                    <div className="h-3 w-4 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </td>
                  <td className={`${COL.title} ${BODY_CELL}`}>
                    <div className="h-3 w-3/4 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </td>
                  <td className={`${COL.type} ${BODY_CELL}`}>
                    <div className="h-3 w-16 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </td>
                  <td className={`${COL.category} ${BODY_CELL}`}>
                    <div className="h-3 w-20 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </td>
                  <td className={`${COL.difficulty} ${BODY_CELL}`}>
                    <div className="h-3 w-16 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </td>
                  <td className={`${COL.marks} ${BODY_CELL}`}>
                    <div className="h-3 w-8 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </td>
                  <td className={`${ACTIONS_HEAD} ${BODY_CELL}`}>
                    <div className="ml-auto size-4 rounded bg-ink-100 animate-pulse" style={{ animationDelay: `${i * 55}ms` }} />
                  </td>
                </tr>
              ))
            ) : (
              questions.map((q, i) => {
                const id = q._id || `q-${i}`;
                const selected = selectedIds.includes(id);
                const title = getQuestionTitleText(q);
                const snippet = stripHtml(getDescriptionText(q));
                const typeInfo = getQuestionTypeInfo(q);
                const difficulty = getDifficulty(q);
                const score = getScore(q);
                const showScore = isMcqQuestion(q) || score > 0;
                return (
                  <motion.tr
                    key={id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.015 }}
                    className={`group border-b border-hairline last:border-0 transition-colors duration-150 ${selected ? 'bg-brand-wash/50 hover:bg-brand-wash' : 'hover:bg-row-hover'}`}
                  >
                    <td className={`${COL.check} ${BODY_CELL}`}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${title || 'question'}`}
                        checked={selected}
                        onChange={() => toggleOne(id)}
                        className="size-4 rounded border-hairline-strong accent-brand cursor-pointer align-middle"
                      />
                    </td>
                    <td className={`${COL.num} ${BODY_CELL} text-faint tabular-nums`}>{i + 1}</td>
                    <td className={`${COL.title} ${BODY_CELL} font-medium text-heading`}>
                      <button
                        type="button"
                        onClick={() => onPreview(q)}
                        title={snippet ? `${title || 'Untitled Question'} — ${snippet}` : (title || 'Untitled Question')}
                        className="block w-full truncate text-left hover:text-brand-strong focus-visible:outline-none"
                      >
                        {title || 'Untitled Question'}
                      </button>
                    </td>
                    <td className={`${COL.type} ${BODY_CELL}`}>
                      <span className="block truncate" title={typeInfo.label}>{typeInfo.label}</span>
                    </td>
                    <td className={`${COL.category} ${BODY_CELL}`}>
                      {q.questionCategory
                        ? <span className="block truncate" title={q.questionCategory}>{q.questionCategory}</span>
                        : <span className="text-line-muted">—</span>}
                    </td>
                    <td className={`${COL.difficulty} ${BODY_CELL}`}>{formatDifficulty(difficulty)}</td>
                    <td className={`${COL.marks} ${BODY_CELL} tabular-nums`}>{showScore ? score : '—'}</td>
                    <td className={`${ACTIONS_HEAD} ${BODY_CELL}`}>
                      <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          q={q}
                          onPreview={onPreview}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onToggleStatus={onToggleStatus}
                          canView={canView}
                          canEdit={canEdit}
                          canDelete={canDelete}
                          canToggle={canToggle}
                        />
                      </div>
                    </td>
                  </motion.tr>
                );
              })
            )}
            {!isLoading && questions.length === 0 && (
              <tr>
                <td colSpan={COL_SPAN} className="py-12" />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
