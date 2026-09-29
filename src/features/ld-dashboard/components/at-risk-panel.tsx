"use client";

/**
 * At-risk students — learners who have started but sit below 50%.
 *
 * Rendered as a row list rather than a table on purpose: this panel occupies a
 * third of the grid (~380px at 1440), and a four-column table at that width
 * either truncates the student name or scrolls sideways. The row layout keeps
 * the name, the course, the number and the severity all legible from 320px up.
 *
 * Not-started students are excluded by design — they are a separate problem
 * (enrolment / onboarding) and appear in their own alert.
 */

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { RiskRow } from "../types";
import { pct, toneFill } from "../lib/format";
import { AllClearState } from "./states";
import { Chip, Monogram, ScrollArea, SectionCard } from "./ui-kit";

const MAX_ROWS = 6;

export function AtRiskPanel({ rows, className }: { rows: RiskRow[]; className?: string }) {
  const reduce = useReducedMotion();
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <SectionCard
      title="At-risk students"
      badge={rows.length}
      action={rows.length ? { label: "View all", href: "#perf-progress" } : undefined}
      className={className}
      bodyClassName={rows.length ? "p-2 sm:p-2" : undefined}
    >
      {rows.length === 0 ? (
        <AllClearState
          title="Everyone on track"
          hint="No active learner is below the 50% line in this view."
        />
      ) : (
        <>
          <ScrollArea>
            <ul className="grid gap-0.5">
              {shown.map((r, i) => (
                <motion.li
                  key={`${r.name}-${r.course}-${i}`}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.03 }}
                  className="rounded-control px-2.5 py-2 transition-colors duration-fast hover:bg-row-hover dark:hover:bg-ink-800/60"
                >
                  <div className="flex items-center gap-2.5">
                    <Monogram name={r.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-heading">{r.name}</p>
                      <p className="truncate text-2xs text-subtle">{r.course}</p>
                    </div>
                    <Chip tone={r.tone}>{r.level}</Chip>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 pl-[38px]">
                    <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                      <span
                        className={cn("block h-full rounded-full", toneFill[r.tone])}
                        style={{ width: `${Math.max(3, r.overall)}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-2xs font-semibold tabular-nums text-body">
                      {pct(r.overall)}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </ScrollArea>

          {rows.length > MAX_ROWS && (
            <p className="border-t border-hairline px-2.5 pt-2.5 text-2xs text-subtle">
              Showing {MAX_ROWS} of {rows.length.toLocaleString()}, worst first.
            </p>
          )}
        </>
      )}
    </SectionCard>
  );
}
