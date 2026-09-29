"use client";

import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { difficultyPill } from "./tokens";
import type { ConsoleQuestion } from "./types";

interface QuestionListItemProps {
  question: ConsoleQuestion;
  selected: boolean;
  /** Hide the score column on non-graded exercises. */
  showScore: boolean;
  onSelect: () => void;
  onPreview: () => void;
}

/**
 * One rail row, two lines total: number + title on the first, difficulty and
 * mark on the second.
 *
 * The title is ONE line with an ellipsis — a rail this narrow can never show a
 * full DSA title anyway, and letting it wrap cost every row ~18px. The full
 * text is on the row's tooltip and in the question header above the editor.
 *
 * Deliberately carries no question-type badge (CODE / MCQ / FRONTEND): the type
 * is obvious from the workspace the row opens.
 */
export default function QuestionListItem({
  question,
  selected,
  showScore,
  onSelect,
  onPreview,
}: QuestionListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      title={question.title}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group relative cursor-pointer border-b border-[#EDF2F9] px-4 py-2 outline-none transition-colors last:border-b-0",
        selected
          ? "bg-[#EEF5FF]"
          : "bg-white hover:bg-[#F7FAFF] focus-visible:bg-[#F7FAFF]",
      )}
    >
      {selected && (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-[#0667F9]" aria-hidden />
      )}

      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "shrink-0 text-[12px] font-bold leading-[17px] tabular-nums",
            selected ? "text-[#0667F9]" : "text-[#8090AF]",
          )}
        >
          {question.number}.
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[12.5px] leading-[17px]",
            selected ? "font-semibold text-[#0667F9]" : "font-medium text-[#39496B]",
          )}
        >
          {question.title}
        </span>
        <button
          type="button"
          title="View question details"
          aria-label={`View details for question ${question.number}`}
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className={cn(
            "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-full border transition-colors",
            selected
              ? "border-[#A9CBFF] text-[#0667F9] hover:bg-white"
              : "border-[#D8E2F0] text-[#9DAECA] hover:border-[#0667F9] hover:text-[#0667F9]",
          )}
        >
          <Eye className="h-[10px] w-[10px]" />
        </button>
      </div>

      <div className="mt-[5px] flex items-center justify-between gap-2 pl-[16px]">
        {question.difficulty ? (
          <span
            className={cn(
              "inline-flex h-[17px] items-center rounded-[4px] px-1.5 text-[10px] font-semibold",
              difficultyPill(question.difficulty),
            )}
          >
            {question.difficulty}
          </span>
        ) : (
          <span />
        )}
        {showScore && (
          <span
            className={cn(
              "shrink-0 text-[11px] tabular-nums",
              selected
                ? "font-bold text-[#0667F9]"
                : question.score > 0
                  ? "font-bold text-[#39496B]"
                  : "font-semibold text-[#8090AF]",
            )}
          >
            {question.score} / {question.maxScore}
          </span>
        )}
      </div>
    </div>
  );
}
