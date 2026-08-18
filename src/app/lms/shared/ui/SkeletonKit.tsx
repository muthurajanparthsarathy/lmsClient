import { cn } from "@/lib/utils";

/* Skeletons must match the final geometry of the content they stand in for —
   no spinner-only loads. All bars pulse on ink-100 per the design brief. */

export interface SkeletonProps {
  className?: string;
}

/** Base skeleton bar. Size it with className (h-*, w-*, rounded-*). */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-ink-100", className)}
      aria-hidden="true"
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/** Paragraph ghost — the last line is intentionally shorter. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

/* Deterministic width cycle so cells vary without hydration mismatches. */
const CELL_WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5"];

/**
 * Mimics the DataTable anatomy: a canvas header row of short bars, then
 * h-12 rows of varied-width cells. Render inside a card — the parent
 * provides the border, radius and toolbar.
 */
export function SkeletonTable({ rows = 6, cols = 4 }: SkeletonTableProps) {
  return (
    <div aria-hidden="true">
      <div className="flex h-10 items-center gap-4 border-b border-hairline bg-canvas px-4">
        {Array.from({ length: cols }).map((_, col) => (
          <div key={col} className="flex-1">
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div
          key={row}
          className="flex h-12 items-center gap-4 border-b border-hairline px-4 last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, col) => (
            <div key={col} className="flex-1">
              <Skeleton
                className={cn(
                  "h-3.5",
                  CELL_WIDTHS[(row + col) % CELL_WIDTHS.length]
                )}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export interface SkeletonCardsProps {
  count?: number;
  className?: string;
}

/** Grid of card ghosts matching the StatCard / card geometry. */
export function SkeletonCards({ count = 3, className }: SkeletonCardsProps) {
  return (
    <div
      className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-hairline bg-surface p-5 shadow-xs"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-8 w-20" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export interface SkeletonFormProps {
  fields?: number;
}

/** Stack of label + control ghosts matching the FieldKit geometry. */
export function SkeletonForm({ fields = 4 }: SkeletonFormProps) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-10 w-full rounded-control" />
        </div>
      ))}
    </div>
  );
}
