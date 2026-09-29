"use client";

/**
 * Trainer performance.
 *
 * NOTE ON THE MISSING STAR RATING — the reference design shows a 1–5 star
 * rating per trainer. No endpoint in this platform returns one: feedback is
 * collected per *course*, not per trainer, so a trainer rating would have to be
 * fabricated or mis-attributed. Completion and average score across the courses
 * they actually teach are the honest equivalents, and both are already used to
 * flag the top and bottom performer below.
 */

import { motion, useReducedMotion } from "framer-motion";
import { TrendingDown, TrendingUp, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TrainerPerf } from "../types";
import { band, count, pct, plural, scoreBand, toneText } from "../lib/format";
import { EmptyState } from "./states";
import { Chip, Meter, Monogram, ScrollArea, SectionCard } from "./ui-kit";

const MAX_ROWS = 5;

export function TrainerPerformance({
  trainers,
  top,
  low,
  loading,
  className,
}: {
  trainers: TrainerPerf[];
  top: TrainerPerf | null;
  low: TrainerPerf | null;
  loading?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const shown = trainers.slice(0, MAX_ROWS);

  return (
    <SectionCard
      title="Trainer performance"
      action={trainers.length ? { label: "View all", href: "#trainers" } : undefined}
      className={className}
      bodyClassName={trainers.length ? "p-2 sm:p-2" : undefined}
    >
      {loading ? (
        <div className="grid gap-2 p-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-11 animate-pulse rounded-control bg-ink-100 dark:bg-ink-800" />
          ))}
        </div>
      ) : trainers.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No trainers on rosters"
          hint="Trainers appear once they are assigned to a course batch."
        />
      ) : (
        <>
          <ScrollArea>
            <ul className="grid gap-0.5">
              {shown.map((t, i) => (
                <motion.li
                  key={`${t.name}-${i}`}
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.03 }}
                  className="rounded-control px-2.5 py-2 transition-colors duration-fast hover:bg-row-hover dark:hover:bg-ink-800/60"
                >
                  <div className="flex items-center gap-2.5">
                    <Monogram name={t.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-heading">{t.name}</p>
                      <p className="truncate text-2xs text-subtle">
                        {plural(t.courses, "course")} · {plural(t.students, "learner")}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        toneText[scoreBand(t.score)],
                      )}
                      title="Average score across their courses"
                    >
                      {pct(t.score)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 pl-[38px]">
                    <Meter
                      value={t.comp}
                      tone={t.comp === null ? "neutral" : band(t.comp).tone}
                      className="flex-1"
                      label={`${t.name} completion`}
                    />
                    <span className="shrink-0 text-2xs font-semibold tabular-nums text-body">
                      {pct(t.comp)}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>
          </ScrollArea>

          {(top || trainers.length > MAX_ROWS) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-hairline px-2.5 pt-2.5">
              {top && (
                <Chip tone="success">
                  <TrendingUp size={11} strokeWidth={2.4} aria-hidden />
                  Top · {top.name}
                </Chip>
              )}
              {low && low !== top && (
                <Chip tone="warning">
                  <TrendingDown size={11} strokeWidth={2.4} aria-hidden />
                  Needs support · {low.name}
                </Chip>
              )}
              {trainers.length > MAX_ROWS && (
                <span className="ml-auto text-2xs text-subtle">
                  {MAX_ROWS} of {count(trainers.length)}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
