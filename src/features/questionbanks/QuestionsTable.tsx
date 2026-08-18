'use client';

// The Question Bank listing as a premium selectable list (List / Compact
// density) — replaces the plain data table. Purely presentational: every action
// funnels into the exact same page callbacks, and the optimistic toggle
// busy-state (togglingId) is preserved.

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, Eye, ListChecks, MoreVertical, Pencil, Power, SearchX, Tag, Terminal, Trash2, Calendar, User,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { EmptyState, StatusPill } from '@/app/lms/shared/ui';
import type { Question } from '@/apiServices/type/question';
import {
  difficultyTone, formatDifficulty, getDescriptionText, getDifficulty,
  getQuestionTitleText, getQuestionTypeInfo, getScore, isMcqQuestion, stripHtml,
} from './lib';

const fmtShort = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface QuestionsTableProps {
  questions: Question[];
  isLoading: boolean;
  isFiltered: boolean;
  density: 'list' | 'compact';
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onPreview: (question: Question) => void;
  onEdit: (question: Question) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, status: boolean) => Promise<void> | void;
  onClearFilters: () => void;
  onCreateMcq: () => void;
  onCreateProgramming: () => void;
  maxBodyHeight: string;
  canView?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canToggle?: boolean;
  canCreate?: boolean;
}

function TypeBadge({ q }: { q: Question }) {
  const info = getQuestionTypeInfo(q);
  const Icon = info.icon;
  return <StatusPill tone={info.tone} className="whitespace-nowrap"><Icon size={11} aria-hidden="true" />{info.label}</StatusPill>;
}

function MetaChips({ q }: { q: Question }) {
  const difficulty = getDifficulty(q);
  const score = getScore(q);
  const showScore = isMcqQuestion(q) || score > 0;
  return (
    <>
      <StatusPill tone={difficultyTone(difficulty)} dot>{formatDifficulty(difficulty)}</StatusPill>
      {showScore && <span className="inline-flex h-[22px] items-center rounded-chip bg-ink-100 px-2 text-2xs font-semibold tabular-nums text-ink-700">{score} marks</span>}
      {q.questionCategory && (
        <span className="inline-flex h-[22px] max-w-[160px] items-center gap-1 rounded-chip border border-hairline bg-canvas px-2 text-2xs text-body">
          <Tag size={10} className="shrink-0 text-faint" aria-hidden="true" />
          <span className="truncate">{q.questionCategory}</span>
        </span>
      )}
    </>
  );
}

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
          <MoreVertical size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={4} className="w-44">
        {canView && <DropdownMenuItem onSelect={() => onPreview(q)}><Eye size={15} /> View details</DropdownMenuItem>}
        {canEdit && <DropdownMenuItem onSelect={() => onEdit(q)}><Pencil size={15} /> Edit</DropdownMenuItem>}
        {canToggle && (
          <DropdownMenuItem onSelect={() => q._id && onToggleStatus(q._id, !q.isActive)}>
            <Power size={15} className={q.isActive ? undefined : 'text-success-700'} /> {q.isActive ? 'Archive (deactivate)' : 'Activate'}
          </DropdownMenuItem>
        )}
        {showSeparator && <DropdownMenuSeparator />}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onSelect={() => q._id && onDelete(q._id)}><Trash2 size={15} /> Delete</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function QuestionsTable({
  questions, isLoading, isFiltered, density, selectedIds, onSelectionChange,
  onPreview, onEdit, onDelete, onToggleStatus, onClearFilters, onCreateMcq, onCreateProgramming, maxBodyHeight,
  canView = true, canEdit = true, canDelete = true, canToggle = true, canCreate = true,
}: QuestionsTableProps) {
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleToggle = async (id: string, next: boolean) => {
    setTogglingId(id);
    try { await onToggleStatus(id, next); } finally { setTogglingId(null); }
  };

  const ids = questions.map((q, i) => q._id || `q-${i}`);
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds.includes(id));
  const someSelected = ids.some((id) => selectedIds.includes(id));
  const toggleAll = () => onSelectionChange(allSelected ? selectedIds.filter((id) => !ids.includes(id)) : Array.from(new Set([...selectedIds, ...ids])));
  const toggleOne = (id: string) => onSelectionChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const compact = density === 'compact';

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
            primaryAction={canCreate ? <Button size="sm" onClick={onCreateMcq}><ListChecks size={15} /> New MCQ question</Button> : undefined}
            secondaryAction={canCreate ? <Button size="sm" variant="outline" onClick={onCreateProgramming}><Terminal size={15} /> New programming question</Button> : undefined}
          />
        )}
      </div>
    );
  }

  return (
    // Panel-height layout: the card wrapper (in QuestionBanksPage) gives us
    // a bounded flex slot; header keeps its natural height, body flex-1's
    // and scrolls internally. That way the outer page never scrolls and
    // the pagination footer under this card stays in view.
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-hairline bg-canvas px-4 py-2">
        <input
          type="checkbox"
          aria-label="Select all questions"
          checked={allSelected}
          ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
          onChange={toggleAll}
          disabled={isLoading || questions.length === 0}
          className="size-4 rounded border-hairline-strong accent-brand"
        />
        <span className="text-2xs font-semibold uppercase tracking-wider text-subtle">Question</span>
        <span className="ml-auto text-2xs font-semibold uppercase tracking-wider text-subtle">Status</span>
        <span className="w-7" />
      </div>

      {/* Body — flex-1 min-h-0 so the rows scroll internally while the
          card's pagination footer stays pinned. `maxBodyHeight` is left
          on the prop shape for API stability (callers may still pass a
          viewport-height calc) but a bounded parent makes the flex chain
          the source of truth for how tall the scroll region ends up. */}
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar" style={maxBodyHeight && maxBodyHeight !== 'none' ? { maxHeight: maxBodyHeight } : undefined}>
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`flex items-center gap-3 border-b border-hairline px-4 ${compact ? 'py-2.5' : 'py-4'}`}>
              <div className="size-4 shrink-0 animate-pulse rounded bg-ink-100" style={{ animationDelay: `${i * 55}ms` }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/5 animate-pulse rounded bg-ink-100" style={{ animationDelay: `${i * 55}ms` }} />
                {!compact && <div className="h-2.5 w-3/5 animate-pulse rounded bg-ink-100" style={{ animationDelay: `${i * 55}ms` }} />}
                <div className="flex gap-1.5"><div className="h-5 w-20 animate-pulse rounded-full bg-ink-100" /><div className="h-5 w-16 animate-pulse rounded-full bg-ink-100" /></div>
              </div>
              <div className="h-6 w-16 shrink-0 animate-pulse rounded-full bg-ink-100" />
            </div>
          ))
        ) : (
          questions.map((q, i) => {
            const id = q._id || `q-${i}`;
            const selected = selectedIds.includes(id);
            const title = getQuestionTitleText(q);
            const snippet = stripHtml(getDescriptionText(q));
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.16, delay: Math.min(i, 10) * 0.015 }}
                className={`group flex gap-3 border-b border-hairline transition-colors duration-150 last:border-0 ${compact ? 'items-center px-4 py-2.5' : 'items-start px-4 py-4'} ${selected ? 'bg-brand-wash/50' : 'hover:bg-row-hover'}`}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${title || 'question'}`}
                  checked={selected}
                  onChange={() => toggleOne(id)}
                  className={`size-4 shrink-0 rounded border-hairline-strong accent-brand ${compact ? '' : 'mt-1'}`}
                />
                <span className={`shrink-0 text-2xs tabular-nums text-faint ${compact ? '' : 'mt-1'}`}>{i + 1}</span>

                <button type="button" onClick={() => onPreview(q)} title="Preview question" className="min-w-0 flex-1 text-left focus-visible:outline-none">
                  <span className="block truncate text-sm font-medium text-heading transition-colors duration-150 group-hover:text-brand-strong">{title || 'Untitled Question'}</span>
                  {!compact && snippet && <span className="mt-0.5 line-clamp-2 block text-xs text-subtle">{snippet}</span>}
                  <span className={`flex flex-wrap items-center gap-1.5 ${compact ? '' : 'mt-2'}`}>
                    <TypeBadge q={q} />
                    <MetaChips q={q} />
                  </span>
                </button>

                {!compact && (
                  <div className="hidden shrink-0 flex-col items-end gap-1 text-2xs text-subtle lg:flex">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap"><Calendar size={11} className="text-faint" /> {fmtShort(q.updatedAt || q.createdAt)}</span>
                    {q.createdBy && <span className="inline-flex max-w-[140px] items-center gap-1 truncate"><User size={11} className="text-faint" /> <span className="truncate">{q.createdBy}</span></span>}
                  </div>
                )}

                <div className={`flex shrink-0 items-center gap-2 ${compact ? '' : 'mt-0.5'}`} onClick={(e) => e.stopPropagation()}>
                  {canToggle && (
                    <Switch
                      checked={q.isActive || false}
                      disabled={togglingId === id}
                      onCheckedChange={() => q._id && handleToggle(q._id, !q.isActive)}
                      aria-label={q.isActive ? 'Deactivate question' : 'Activate question'}
                    />
                  )}
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
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
