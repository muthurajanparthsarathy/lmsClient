"use client";

/**
 * Page header.
 *
 * The global chrome (client / course pickers, search, notifications, avatar)
 * belongs to the LD shell, so this header does one job: state what you are
 * looking at and how wide the scope is. Every figure below it is scoped to this
 * line, which is why the denominator is always spelled out.
 */

import { useEffect, useState, type ReactNode } from "react";
import { RotateCcw } from "lucide-react";
import { getSessionJSON, SESSION_KEYS } from "@/lib/session";

function useFirstName(): string {
  const [name, setName] = useState("");
  useEffect(() => {
    const u = getSessionJSON<{ firstName?: string }>(SESSION_KEYS.userData);
    setName(u?.firstName?.trim() || "");
  }, []);
  return name;
}

export function PageHeader({
  scope,
  subline,
  filtered,
  onReset,
  controls,
}: {
  scope: string;
  subline: string;
  filtered: boolean;
  onReset: () => void;
  /** Page-owned scope pickers (the shell's top bar no longer hosts them). */
  controls?: ReactNode;
}) {
  const first = useFirstName();

  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-[-0.02em] text-heading sm:text-3xl">
          {scope}
        </h1>
        <p className="mt-1 text-sm text-subtle">
          {first && (
            <>
              <span className="text-body">Welcome back, {first}</span>
              <span aria-hidden className="mx-1.5 text-faint">
                ·
              </span>
            </>
          )}
          {subline}
        </p>
      </div>

      {(controls || filtered) && (
        /* sm:mr-12 keeps the controls clear of the shell's corner-pinned
           notification bell. */
        <div className="flex shrink-0 flex-wrap items-center gap-2 self-start sm:mr-12">
          {controls}
          {filtered && (
            <button
              type="button"
              onClick={onReset}
              /* Orange outline on white, per the design's header-action treatment.
                 The design labels this button "Customize view"; that is left for
                 when such a feature exists — a control that looks primary and does
                 nothing is worse than no control. This one clears the filter. */
              className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-control border border-brand-500/50 bg-surface px-3 py-1.5 text-xs font-semibold text-brand-500 shadow-xs outline-none transition-colors duration-fast hover:border-brand-500 hover:bg-brand-50 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              <RotateCcw size={13} strokeWidth={2.2} aria-hidden />
              Clear filters
            </button>
          )}
        </div>
      )}
    </header>
  );
}
