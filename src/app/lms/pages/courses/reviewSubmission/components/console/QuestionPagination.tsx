"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestionPaginationProps {
  page: number; // 1-based
  pageCount: number;
  onChange: (page: number) => void;
}

/** Windowed page numbers — the rail is 274px wide, so never show more than 5. */
function pageWindow(page: number, pageCount: number): number[] {
  const span = Math.min(5, pageCount);
  let start = Math.max(1, page - Math.floor(span / 2));
  if (start + span - 1 > pageCount) start = pageCount - span + 1;
  return Array.from({ length: span }, (_, i) => start + i);
}

export default function QuestionPagination({
  page,
  pageCount,
  onChange,
}: QuestionPaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Question pages"
      className="flex flex-none items-center justify-center gap-1 border-t border-[#EDF2F9] px-4 py-2.5"
    >
      <button
        type="button"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
        className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-[#53658C] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9] disabled:cursor-not-allowed disabled:text-[#C6D2E4] disabled:hover:bg-transparent"
      >
        <ChevronLeft className="h-[15px] w-[15px]" />
      </button>
      {pageWindow(page, pageCount).map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn(
            "flex h-[26px] min-w-[26px] items-center justify-center rounded-[6px] px-1 text-[12px] tabular-nums transition-colors",
            p === page
              ? "bg-[#0667F9] font-semibold text-white"
              : "font-medium text-[#53658C] hover:bg-[#F1F6FE] hover:text-[#0667F9]",
          )}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Next page"
        className="flex h-[26px] w-[26px] items-center justify-center rounded-[6px] text-[#53658C] transition-colors hover:bg-[#F1F6FE] hover:text-[#0667F9] disabled:cursor-not-allowed disabled:text-[#C6D2E4] disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-[15px] w-[15px]" />
      </button>
    </nav>
  );
}
