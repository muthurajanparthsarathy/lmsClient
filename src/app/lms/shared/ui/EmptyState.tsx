import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

/**
 * Designed empty state for data views. Icon sits in a 44px brand-wash tile
 * with a subtle dotted-arc accent drawn inline (no external images).
 */
export function EmptyState({
  icon: Icon,
  title,
  message,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const hasActions = Boolean(primaryAction) || Boolean(secondaryAction);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="relative mb-4">
          <svg
            className="pointer-events-none absolute left-1/2 top-1/2 h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 text-brand-300"
            viewBox="0 0 72 72"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M10 51 A 30 30 0 1 1 62 51"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="1 7"
            />
          </svg>
          <div className="relative flex h-11 w-11 items-center justify-center rounded-tile bg-brand-wash">
            <Icon className="h-5 w-5 text-brand-strong" aria-hidden="true" />
          </div>
        </div>
      ) : null}
      <h3 className="text-md font-semibold text-heading">{title}</h3>
      {message ? (
        <p className="mt-1 max-w-sm text-sm text-subtle">{message}</p>
      ) : null}
      {hasActions ? (
        <div className="mt-4 flex items-center gap-2">
          {secondaryAction}
          {primaryAction}
        </div>
      ) : null}
    </div>
  );
}
