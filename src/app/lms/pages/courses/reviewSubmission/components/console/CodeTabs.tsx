"use client";

import { cn } from "@/lib/utils";
import type { CodeTabId } from "./types";

export const CODE_TABS: { id: CodeTabId; label: string }[] = [
  { id: "editor", label: "Student Answer" },
  { id: "problem", label: "Problem Statement" },
  { id: "testcases", label: "Test Cases" },
  { id: "solution", label: "Solution" },
];

interface CodeTabsProps {
  active: CodeTabId;
  onChange: (tab: CodeTabId) => void;
}

export default function CodeTabs({ active, onChange }: CodeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Submission views"
      className="flex h-[42px] flex-none items-center gap-9 border-b border-[#E7EEF8] px-4"
    >
      {CODE_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex h-full items-center text-[13.5px] transition-colors",
              isActive
                ? "font-semibold text-[#0667F9]"
                : "font-medium text-[#66789C] hover:text-[#39496B]",
            )}
          >
            {tab.label}
            {isActive && (
              <span
                className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[#0667F9]"
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
