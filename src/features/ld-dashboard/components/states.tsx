"use client";

/**
 * Loading / empty / error states.
 *
 * The skeleton mirrors the real grid so the page does not reflow when data
 * lands — the single biggest cause of "janky" enterprise dashboards.
 */

import { AlertCircle, CheckCircle2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Icon } from "../types";

export function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-chip bg-ink-100 dark:bg-ink-800", className)}
      aria-hidden
    />
  );
}

/** Neutral "nothing here yet" — not a failure. */
export function EmptyState({
  icon: Ico = Inbox,
  title,
  hint,
  className,
}: {
  icon?: Icon;
  title: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-8 text-center", className)}>
      <span className="mb-2 inline-flex size-9 items-center justify-center rounded-full bg-ink-100 text-subtle dark:bg-ink-800">
        <Ico size={17} strokeWidth={2} aria-hidden />
      </span>
      <p className="text-sm font-medium text-body">{title}</p>
      {hint && <p className="mt-1 max-w-[38ch] text-xs text-subtle">{hint}</p>}
    </div>
  );
}

/** Positive empty state — used when "nothing to show" is good news. */
export function AllClearState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
      <span className="mb-2 inline-flex size-9 items-center justify-center rounded-full bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500">
        <CheckCircle2 size={18} strokeWidth={2.2} aria-hidden />
      </span>
      <p className="text-sm font-semibold text-heading">{title}</p>
      {hint && <p className="mt-1 max-w-[38ch] text-xs text-subtle">{hint}</p>}
    </div>
  );
}

export function ErrorState({ message, className }: { message: string; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-tile border border-danger-500/25 bg-danger-50 px-4 py-3 dark:bg-danger-500/10",
        className,
      )}
    >
      <AlertCircle size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-danger-700 dark:text-danger-500" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-danger-700 dark:text-danger-500">
          Could not load dashboard
        </p>
        <p className="mt-0.5 text-xs break-words text-body">{message}</p>
      </div>
    </div>
  );
}

/** Full-page skeleton matching the live grid's shape. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5" aria-busy aria-label="Loading dashboard">
      <Shimmer className="h-9 w-full rounded-tile" />

      {/* Mirrors the live grid's container-query breakpoints exactly, so the
          page does not reflow the moment data lands. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 @5xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={i} className="h-[124px] rounded-tile" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 @5xl:grid-cols-12 @5xl:gap-5">
        <Shimmer className="h-[300px] rounded-tile @5xl:col-span-8" />
        <Shimmer className="h-[300px] rounded-tile @5xl:col-span-4" />
      </div>

      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3 @5xl:gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Shimmer key={i} className="h-[286px] rounded-tile" />
        ))}
      </div>
    </div>
  );
}
