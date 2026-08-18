"use client";

/**
 * Shared atoms for the L&D dashboard.
 *
 * Everything here reads from the project's design tokens (surface / hairline /
 * heading / body / subtle / brand-*) rather than hardcoded hex, so the whole
 * dashboard flips with the `.dark` class for free.
 */

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Icon, Tone } from "../types";
import { barWidth, initials, toneBg, toneFill, toneText } from "../lib/format";

/* ── Panel shell ──────────────────────────────────────────────────────────── */

interface SectionCardProps {
  title: string;
  /** Right-aligned context, e.g. "all courses". */
  meta?: ReactNode;
  /** Count badge beside the title. */
  badge?: number;
  action?: { label: string; href: string };
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  meta,
  badge,
  action,
  className,
  bodyClassName,
  children,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-tile border border-hairline bg-surface shadow-xs",
        "transition-shadow duration-base ease-standard hover:shadow-md",
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-hairline px-4 py-3 sm:px-5">
        <h2 className="truncate text-md font-semibold tracking-[-0.01em] text-heading">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className="shrink-0 rounded-full bg-danger-50 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-danger-700 dark:bg-danger-500/15 dark:text-danger-500">
            {badge}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {meta && <span className="hidden text-xs text-subtle sm:inline">{meta}</span>}
          {action && (
            <a
              href={action.href}
              className="inline-flex items-center gap-0.5 rounded-chip text-xs font-medium text-brand-500 outline-none transition-colors duration-fast hover:text-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-400 dark:hover:text-brand-300"
            >
              {action.label}
              <ChevronRight size={13} aria-hidden />
            </a>
          )}
        </div>
      </header>
      <div className={cn("min-w-0 flex-1 p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ── Chip ─────────────────────────────────────────────────────────────────── */

export function Chip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-2xs font-semibold whitespace-nowrap",
        toneBg[tone],
        toneText[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ── Icon badge ───────────────────────────────────────────────────────────── */

export function IconBadge({
  icon: Ico,
  tone = "brand",
  size = "md",
}: {
  icon: Icon;
  tone?: Tone;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-chip",
        size === "sm" ? "size-6" : "size-8",
        toneBg[tone],
        toneText[tone],
      )}
    >
      <Ico size={size === "sm" ? 13 : 15} strokeWidth={2.2} aria-hidden />
    </span>
  );
}

/* ── Meter ────────────────────────────────────────────────────────────────── */

export function Meter({
  value,
  tone = "brand",
  className,
  label,
}: {
  value: number | null;
  tone?: Tone;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="progressbar"
      aria-valuenow={value ?? 0}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        "block h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800",
        className,
      )}
    >
      <span
        className={cn("block h-full rounded-full transition-[width] duration-slow ease-standard", toneFill[tone])}
        style={{ width: barWidth(value) }}
      />
    </span>
  );
}

/* ── Monogram avatar ──────────────────────────────────────────────────────── */

const MONO_TONES: Tone[] = ["brand", "info", "success", "warning", "danger"];

export function Monogram({ name, className }: { name: string; className?: string }) {
  // Stable per-name tint so the same person keeps the same colour across panels.
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const tone = MONO_TONES[hash % MONO_TONES.length];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold",
        toneBg[tone],
        toneText[tone],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/* ── Label / value pair ───────────────────────────────────────────────────── */

export function MetricPair({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  title?: string;
}) {
  return (
    <div className="min-w-0" title={title}>
      <dt className="truncate text-2xs font-medium text-subtle">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone ? toneText[tone] : "text-heading",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/* ── Scroll region ────────────────────────────────────────────────────────── */

/** Caps a list's height on desktop while letting it flow naturally on mobile. */
export function ScrollArea({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Height caps only once cards sit side by side — measured against the
        // dashboard's @container, so a single-column phone layout scrolls the
        // page rather than trapping a scrollbar inside a card.
        "min-w-0 @3xl:max-h-[268px] @3xl:overflow-y-auto @3xl:pr-1",
        "@3xl:[scrollbar-width:thin] @3xl:[scrollbar-color:var(--color-line-hover)_transparent]",
        className,
      )}
    >
      {children}
    </div>
  );
}
