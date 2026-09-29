"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import QuestionListItem from "./QuestionListItem";
import QuestionPagination from "./QuestionPagination";
import DifficultySelect, { type QuestionFilterOption } from "./DifficultySelect";
import { difficultyPill } from "./tokens";
import type { ConsoleQuestion } from "./types";

const PAGE_SIZE = 10;

export type { QuestionFilterOption };

interface AssessmentQuestionSidebarProps {
  questions: ConsoleQuestion[];
  selectedId: string | null;
  filter: string;
  filterOptions: QuestionFilterOption[];
  onFilterChange: (value: string) => void;
  onSelect: (question: ConsoleQuestion) => void;
  onPreview: (question: ConsoleQuestion) => void;
  showScore: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * Left rail. Deliberately has NO assessment-wide progress bar under the title —
 * the only "x / y, %" on this screen is the Overall Marks ring in the grading
 * column, so the two can never disagree.
 */
export default function AssessmentQuestionSidebar({
  questions,
  selectedId,
  filter,
  filterOptions,
  onFilterChange,
  onSelect,
  onPreview,
  showScore,
  collapsed,
  onToggleCollapsed,
}: AssessmentQuestionSidebarProps) {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(questions.length / PAGE_SIZE));

  // Follow the selection when it moves from outside the rail (header arrows,
  // Previous / Next, save-and-advance) so the highlighted row is never on a
  // page the trainer isn't looking at.
  useEffect(() => {
    const idx = questions.findIndex((q) => q.id === selectedId);
    if (idx >= 0) setPage(Math.floor(idx / PAGE_SIZE) + 1);
  }, [selectedId, questions]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const visible = useMemo(
    () => questions.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [questions, page],
  );

  // Collapsed: a numbered strip, so the trainer keeps question-to-question
  // navigation while the editor takes the reclaimed width.
  if (collapsed) {
    return (
      <aside className="flex w-[52px] flex-none flex-col border-r border-[#E5E7EB] bg-white">
        <div className="flex h-[46px] flex-none items-center justify-center border-b border-[#EDF2F9]">
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Expand question list"
            aria-label="Expand question list"
            aria-expanded={false}
            className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[#53658C] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9]"
          >
            <PanelLeftOpen className="h-[16px] w-[16px]" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-1.5 custom-scrollbar">
          {questions.map((q) => {
            const active = q.id === selectedId;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onSelect(q)}
                title={`${q.number}. ${q.title}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-[6px] text-[11px] font-bold tabular-nums transition-colors",
                  active
                    ? "bg-[#0667F9] text-white"
                    : "text-[#53658C] hover:bg-[#F1F6FE] hover:text-[#0667F9]",
                )}
              >
                {q.number}
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex w-[262px] flex-none flex-col border-r border-[#E5E7EB] bg-white">
      <div className="flex-none px-4 pb-3.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate text-[14px] font-bold tracking-[-0.01em] text-[#0B1437]">
            Assessment Questions
          </h2>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse question list"
            aria-label="Collapse question list"
            aria-expanded
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[#8090AF] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9]"
          >
            <PanelLeftClose className="h-[15px] w-[15px]" />
          </button>
        </div>

        <div className="mt-4">
          <DifficultySelect
            label="Difficulty"
            value={filter}
            options={filterOptions}
            onChange={onFilterChange}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#EDF2F9] custom-scrollbar">
        {visible.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] font-medium text-[#8090AF]">
            No questions match this filter.
          </p>
        ) : (
          visible.map((q) => (
            <QuestionListItem
              key={q.id}
              question={q}
              selected={q.id === selectedId}
              showScore={showScore}
              onSelect={() => onSelect(q)}
              onPreview={() => onPreview(q)}
            />
          ))
        )}
      </div>

      <QuestionPagination page={page} pageCount={pageCount} onChange={setPage} />
    </aside>
  );
}

/** Dot colours for the difficulty options, kept beside the pill palette. */
export const DIFFICULTY_TONES: Record<string, string> = {
  easy: "#12A15C",
  medium: "#DE8100",
  hard: "#DE3450",
};

export { difficultyPill };
