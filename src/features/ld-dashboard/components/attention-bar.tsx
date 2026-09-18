"use client";

/**
 * Triage bar.
 *
 * WHY THIS EXISTS — in the previous layout the "Alerts" panel sat in the
 * bottom-right corner, below the fold on a 1366×768 laptop. It is the single
 * most actionable widget on the page (every row is a work queue), so it now
 * leads the view: an L&D Head should learn what needs doing before they learn
 * how many clients they have.
 *
 * When there is genuinely nothing pending it collapses to one slim positive
 * line rather than disappearing — absence of alerts is itself information.
 */

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AlertItem } from "../types";

export function AttentionBar({ alerts }: { alerts: AlertItem[] }) {
  const reduce = useReducedMotion();
  const total = alerts.reduce((s, a) => s + a.count, 0);

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2.5 rounded-tile border border-success-500/25 bg-success-50 px-4 py-2.5 dark:bg-success-500/10">
        <CheckCircle2
          size={16}
          strokeWidth={2.2}
          className="shrink-0 text-success-700 dark:text-success-500"
          aria-hidden
        />
        <p className="text-sm font-medium text-success-700 dark:text-success-500">
          All clear — no pending work in this view.
        </p>
      </div>
    );
  }

  // Most urgent first: danger before warning, then by size.
  const rank = { danger: 0, warning: 1, neutral: 2 } as Record<string, number>;
  const ranked = [...alerts].sort(
    (a, b) => (rank[a.tone] ?? 3) - (rank[b.tone] ?? 3) || b.count - a.count,
  );

  // metrics.ts can emit up to SIX queues. Past four, each section is narrow
  // enough that labels like "Batches awaiting attendance today" wrap to three
  // lines and the bar doubles in height — so the strip shows the four most
  // severe and the rest stay one click away behind "Review all".
  // This is NOT a silent truncation: the summary beside it reads
  // "N across <total> queues" off `alerts.length`, so the real number is on
  // screen even when the fifth and sixth are not drawn.
  const SHOWN = 4;
  const ordered = ranked.slice(0, SHOWN);
  const hidden = ranked.length - ordered.length;

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
      aria-label="Items needing attention"
      className="overflow-hidden rounded-tile border border-brand-200 bg-brand-50 shadow-sm dark:border-brand-500/25 dark:bg-brand-500/10"
    >
      {/* Equal sections divided by hairlines rather than free-floating chips.
          Each queue is flex-1, so the sections stay equal whether metrics.ts
          returns three queues or six — the layout does not assume exactly four. */}
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3">
          <TriangleAlert
            size={18}
            strokeWidth={2.2}
            aria-hidden
            className="shrink-0 text-brand-500 dark:text-brand-400"
          />
          <div className="min-w-0">
            <p className="text-sm leading-tight font-semibold text-heading">Needs attention</p>
            {/* alerts.length, not ordered.length — this must report every queue
                that has items, including the ones the strip did not draw. */}
            <p className="text-2xs leading-tight text-subtle">
              {total.toLocaleString()} across {alerts.length} queue{alerts.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {ordered.map((a) => (
          <a
            key={a.id}
            href={a.href}
            className={cn(
              "group flex min-w-0 flex-1 items-center gap-2.5 px-4 py-3 outline-none",
              "border-t border-brand-200/80 sm:border-t-0 sm:border-l dark:border-brand-500/20",
              "transition-colors duration-fast hover:bg-brand-100/70 focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-inset dark:hover:bg-brand-500/15",
            )}
          >
            <a.icon
              size={18}
              strokeWidth={2.2}
              aria-hidden
              className="shrink-0 text-brand-500 dark:text-brand-400"
            />
            <p className="min-w-0 text-xs leading-tight text-subtle">
              <span className="text-sm font-semibold tabular-nums text-heading">
                {a.count.toLocaleString()}
              </span>{" "}
              {a.label.toLowerCase()}
            </p>
          </a>
        ))}

        <div className="flex items-center border-t border-brand-200/80 px-4 py-3 sm:border-t-0 sm:border-l dark:border-brand-500/20">
          <a
            href="#perf-progress"
            className="inline-flex shrink-0 items-center gap-1 rounded-chip px-1 text-xs font-semibold whitespace-nowrap text-brand-500 outline-none transition-colors duration-fast hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-400"
          >
            {hidden > 0 ? `Review all +${hidden}` : "Review all"}
            <ArrowRight size={13} aria-hidden />
          </a>
        </div>
      </div>
    </motion.section>
  );
}
