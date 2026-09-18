"use client";

/**
 * Recent activity — approvals raised, feedback submitted, learners active.
 *
 * Merged from three sources and sorted by timestamp, so it reads as one
 * chronology rather than three separate mini-feeds. Items without a usable
 * timestamp are dropped upstream: an undated entry in a time-ordered list is
 * noise.
 */

import { motion, useReducedMotion } from "framer-motion";
import { Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "../types";
import { relDate, toneFill } from "../lib/format";
import { EmptyState } from "./states";
import { ScrollArea, SectionCard } from "./ui-kit";

export function ActivityFeed({
  items,
  className,
}: {
  items: ActivityItem[];
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <SectionCard title="Recent activity" className={className}>
      {items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Nothing recorded yet"
          hint="Approvals, feedback and learner activity land here as they happen."
        />
      ) : (
        <ScrollArea>
          <ol className="relative grid gap-0">
            {items.map((a, i) => (
              <motion.li
                key={`${a.at}-${i}`}
                initial={reduce ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.03 }}
                className="relative flex gap-3 pb-3.5 last:pb-0"
              >
                {/* Spine — stops at the last item so it never dangles. */}
                {i !== items.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-3 bottom-0 left-[3.5px] w-px bg-hairline"
                  />
                )}
                <span
                  aria-hidden
                  className={cn(
                    "relative mt-1.5 size-2 shrink-0 rounded-full ring-2 ring-surface",
                    toneFill[a.tone],
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-2xs text-faint">{relDate(a.at)}</p>
                  <p className="mt-0.5 text-xs leading-snug font-medium text-heading">{a.title}</p>
                  <p className="mt-0.5 truncate text-2xs text-subtle">{a.detail}</p>
                </div>
              </motion.li>
            ))}
          </ol>
        </ScrollArea>
      )}
    </SectionCard>
  );
}
