"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { CARD } from "./tokens";

export const FEEDBACK_MAX = 1000;

/** Canned remarks the trainer can drop into the box instead of retyping. */
export const QUICK_COMMENTS: string[] = [
  "Correct approach and a clean, readable solution. Well done.",
  "Logic is right, but the solution can be simplified.",
  "Works for the sample input but fails on edge cases — re-check the boundaries.",
  "Time complexity can be improved; look for a single-pass solution.",
  "Variable naming and formatting need work — keep the code readable.",
  "Partially correct. Revisit the problem statement and resubmit.",
];

type FeedbackTab = "write" | "quick";

interface FeedbackCardProps {
  value: string;
  onChange: (value: string) => void;
  tab: FeedbackTab;
  onTabChange: (tab: FeedbackTab) => void;
  /** Collapsed by default — most saves are a mark, not an essay. */
  open: boolean;
  onToggleOpen: () => void;
}

export default function FeedbackCard({
  value,
  onChange,
  tab,
  onTabChange,
  open,
  onToggleOpen,
}: FeedbackCardProps) {
  const append = (comment: string) => {
    const next = value.trim() ? `${value.trim()} ${comment}` : comment;
    onChange(next.slice(0, FEEDBACK_MAX));
    onTabChange("write");
  };

  return (
    <section className={CARD}>
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-[#F8FAFE]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="text-[14px] font-bold tracking-[-0.01em] text-[#0B1437]">
            Feedback for Student
          </span>
          {/* Say whether there IS feedback, so a collapsed card never hides
              the fact that something was written. */}
          {value.trim() && (
            <span className="shrink-0 rounded-[5px] bg-[#E8F1FE] px-1.5 py-[2px] text-[10px] font-semibold text-[#0B66F6]">
              {value.length}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-[16px] w-[16px] shrink-0 text-[#53658C] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-[#E7EEF8] px-4 pb-4 pt-3">
          <div
            role="tablist"
            aria-label="Feedback entry mode"
            className="flex items-center gap-7 border-b border-[#E7EEF8]"
          >
            {(
              [
                { id: "write", label: "Write Feedback" },
                { id: "quick", label: "Quick Comments" },
              ] as const
            ).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(t.id)}
                  className={cn(
                    "relative pb-2 text-[12.5px] transition-colors",
                    active
                      ? "font-semibold text-[#0667F9]"
                      : "font-medium text-[#66789C] hover:text-[#39496B]",
                  )}
                >
                  {t.label}
                  {active && (
                    <span
                      className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#0667F9]"
                      aria-hidden
                    />
                  )}
                </button>
              );
            })}
          </div>

          {tab === "write" ? (
            <>
              <textarea
                value={value}
                maxLength={FEEDBACK_MAX}
                onChange={(e) => onChange(e.target.value.slice(0, FEEDBACK_MAX))}
                placeholder="Write detailed feedback for the student..."
                aria-label="Feedback for student"
                className="mt-3 h-[78px] w-full resize-none rounded-[8px] border border-[#E5E7EB] bg-white p-2.5 text-[12.5px] leading-[1.55] text-[#0B1437] outline-none transition-colors placeholder:text-[#A6B4CC] focus:border-[#0667F9] focus:ring-2 focus:ring-[#0667F9]/12"
              />
              <div className="mt-1.5 text-right text-[11.5px] font-medium tabular-nums text-[#8090AF]">
                {value.length} / {FEEDBACK_MAX}
              </div>
            </>
          ) : (
            // No max-height / scroll here: the card is collapsed by default,
            // so when it IS open the whole list should just be readable.
            <ul className="mt-3 space-y-1.5">
              {QUICK_COMMENTS.map((c) => (
                <li key={c}>
                  <button
                    type="button"
                    onClick={() => append(c)}
                    className="w-full rounded-[7px] border border-[#E5E7EB] bg-[#F8FAFE] px-2.5 py-1.5 text-left text-[12px] font-medium leading-[1.45] text-[#39496B] transition-colors hover:border-[#0667F9] hover:bg-[#EEF5FF] hover:text-[#0667F9]"
                  >
                    {c}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
