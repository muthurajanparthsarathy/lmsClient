import type * as React from "react";
import { cn } from "@/lib/utils";

export type StatusPillTone =
  | "success"
  | "warn"
  | "danger"
  | "info"
  | "brand"
  | "neutral";

const TONE_CLASSES: Record<StatusPillTone, string> = {
  success: "bg-success-50 text-success-700 ring-success-500/20",
  warn: "bg-warn-50 text-warn-700 ring-warn-500/20",
  danger: "bg-danger-50 text-danger-700 ring-danger-500/20",
  info: "bg-info-50 text-info-700 ring-info-500/20",
  brand: "bg-brand-wash text-brand-strong ring-brand-500/25",
  neutral: "bg-ink-100 text-ink-700 ring-ink-500/20",
};

const DOT_CLASSES: Record<StatusPillTone, string> = {
  success: "bg-success-500",
  warn: "bg-warn-500",
  danger: "bg-danger-500",
  info: "bg-info-500",
  brand: "bg-brand-500",
  neutral: "bg-ink-400",
};

export interface StatusPillProps {
  tone: StatusPillTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

/** Tinted status chip — the only rounded-full element the brief allows. */
export function StatusPill({
  tone,
  children,
  dot = false,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        // whitespace-nowrap: the pill is a fixed-height capsule — a wrapping
        // label breaks out of it vertically ("Partially configured" did).
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        TONE_CLASSES[tone],
        className
      )}
    >
      {dot ? (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[tone])}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
