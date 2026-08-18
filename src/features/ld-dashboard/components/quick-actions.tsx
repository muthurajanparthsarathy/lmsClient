"use client";

/**
 * Quick actions rail.
 *
 * Deliberately does NOT repeat the alert counts as a second list — those now
 * lead the page in the triage bar. Showing the same six numbers twice was the
 * clearest redundancy in the previous layout. Here the counts appear only as
 * badges on the destination they belong to, so the number and the way to act
 * on it are the same control.
 */

import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  ClipboardList,
  FileText,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardModel, Icon, Tone } from "../types";
import { toneBg, toneText } from "../lib/format";
import { SectionCard } from "./ui-kit";

interface Action {
  label: string;
  hint: string;
  icon: Icon;
  tone: Tone;
  href: string;
  badge?: number;
}

export function QuickActions({ model, className }: { model: DashboardModel; className?: string }) {
  const reduce = useReducedMotion();

  const actions: Action[] = [
    {
      label: "Approval queue",
      hint: "Assessments awaiting sign-off",
      icon: ClipboardList,
      tone: "warning",
      href: "#appr-queue",
      badge: model.pendingApprovals,
    },
    {
      label: "Attendance register",
      hint: "Mark today's batches",
      icon: CalendarCheck,
      tone: "info",
      href: "#attendance",
      badge: model.pendingBatches,
    },
    {
      label: "At-risk students",
      hint: "Below the 50% line",
      icon: AlertTriangle,
      tone: "danger",
      href: "#perf-progress",
      badge: model.atRiskCount,
    },
    {
      label: "Course insight",
      hint: "Structure and delivery health",
      icon: BookOpen,
      tone: "brand",
      href: "#courses",
    },
    {
      label: "Trainer allocation",
      hint: "Who is teaching what",
      icon: Users,
      tone: "brand",
      href: "#trainers",
    },
    {
      label: "Generate report",
      hint: "Client-ready export",
      icon: FileText,
      tone: "neutral",
      href: "#reports",
    },
  ];

  return (
    <SectionCard title="Quick actions" className={className} bodyClassName="p-2 sm:p-2">
      <ul className="grid gap-0.5">
        {actions.map((a, i) => (
          <motion.li
            key={a.label}
            initial={reduce ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1], delay: reduce ? 0 : i * 0.03 }}
          >
            <a
              href={a.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-control px-2.5 py-2 outline-none",
                "transition-colors duration-fast hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-ink-800/60",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-7 shrink-0 items-center justify-center rounded-chip",
                  toneBg[a.tone],
                  toneText[a.tone],
                )}
              >
                <a.icon size={14} strokeWidth={2.2} aria-hidden />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-heading">{a.label}</span>
                <span className="block truncate text-2xs text-subtle">{a.hint}</span>
              </span>

              {a.badge !== undefined && a.badge > 0 && (
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums",
                    toneBg[a.tone],
                    toneText[a.tone],
                  )}
                >
                  {a.badge.toLocaleString()}
                </span>
              )}

              <ChevronRight
                size={14}
                aria-hidden
                className="shrink-0 text-faint transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-subtle"
              />
            </a>
          </motion.li>
        ))}
      </ul>
    </SectionCard>
  );
}
