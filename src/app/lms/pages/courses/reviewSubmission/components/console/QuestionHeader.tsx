"use client";

import { ChevronLeft, ChevronRight, Diamond, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { difficultyPill } from "./tokens";

interface QuestionHeaderProps {
  number: number;
  title: string;
  difficulty: string;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
}

export default function QuestionHeader({
  number,
  title,
  difficulty,
  onPrev,
  onNext,
  canPrev,
  canNext,
  expanded,
  onToggleExpand,
}: QuestionHeaderProps) {
  const Expand = expanded ? Minimize2 : Maximize2;

  return (
    <div className="flex min-h-[36px] flex-none items-center gap-3">
      <Diamond className="h-[16px] w-[16px] shrink-0 text-[#53658C]" strokeWidth={1.8} />

      <h1
        className="min-w-0 truncate text-[14.5px] font-bold tracking-[-0.01em] text-[#0B1437]"
        title={title}
      >
        {number}. {title}
      </h1>

      {difficulty && (
        <span
          className={cn(
            "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2.5 text-[12px] font-semibold",
            difficultyPill(difficulty),
          )}
        >
          {difficulty}
        </span>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="flex h-[34px] items-center gap-1.5 rounded-[8px] border border-[#DEE7F3] bg-white pl-2.5 pr-3.5 text-[13px] font-medium text-[#39496B] transition-colors hover:border-[#B9CDEA] hover:bg-[#F7FAFF] disabled:cursor-not-allowed disabled:text-[#B9C6DC] disabled:hover:bg-white"
        >
          <ChevronLeft className="h-[15px] w-[15px]" />
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="flex h-[34px] items-center gap-1.5 rounded-[8px] bg-[#0667F9] pl-4 pr-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#0559DC] disabled:cursor-not-allowed disabled:bg-[#A9C8F7]"
        >
          Next
          <ChevronRight className="h-[15px] w-[15px]" />
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          title={expanded ? "Exit fullscreen" : "Fullscreen"}
          aria-label={expanded ? "Exit fullscreen" : "Fullscreen"}
          className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] text-[#53658C] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9]"
        >
          <Expand className="h-[17px] w-[17px]" />
        </button>
      </div>
    </div>
  );
}
