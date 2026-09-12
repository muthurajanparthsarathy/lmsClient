import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./SkeletonKit";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; positive?: boolean };
  icon?: LucideIcon;
  hint?: string;
  /** Trend values; needs at least two points to draw. Renders a small brand
   *  sparkline at the right edge of the footer row. */
  spark?: number[];
  loading?: boolean;
  className?: string;
}

// Tiny inline-SVG trend line derived from the real values, normalised into the
// box. Mirrors shared/listing/StatCards.tsx's Sparkline, minus the path-draw
// animation so this file stays server-renderable.
function Sparkline({ points }: { points: number[] }) {
  const w = 72;
  const h = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => {
    // Inset top and bottom so peaks aren't clipped by the viewBox.
    const y = h - 3 - ((p - min) / span) * (h - 6);
    return [i * step, y] as const;
  });
  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={`${line} L${w},${h} L0,${h} Z`}
        fill="var(--color-brand-500)"
        fillOpacity={0.12}
      />
      <path
        d={line}
        stroke="var(--color-brand-500)"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.25} fill="var(--color-brand-500)" />
    </svg>
  );
}

/**
 * KPI stat tile. `loading` renders a skeleton with identical geometry so the
 * page never shifts when data lands.
 */
export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  hint,
  spark,
  loading = false,
  className,
}: StatCardProps) {
  const cardClass = cn(
    "rounded-xl border border-hairline bg-surface p-5 shadow-xs",
    className
  );
  const hasSpark = Boolean(spark && spark.length > 1);
  const hasFooter = Boolean(delta) || Boolean(hint) || hasSpark;

  if (loading) {
    return (
      <div className={cardClass} aria-hidden="true">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1 h-8 w-20" />
          </div>
          {Icon ? <Skeleton className="h-9 w-9 shrink-0 rounded-chip" /> : null}
        </div>
        {hasFooter ? (
          <Skeleton className="mt-3 h-5 w-24 rounded-full" />
        ) : null}
      </div>
    );
  }

  return (
    <div className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">
            {label}
          </p>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-heading">
            {value}
          </div>
        </div>
        {Icon ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-brand-wash">
            <Icon className="h-[18px] w-[18px] text-brand-strong" aria-hidden="true" />
          </div>
        ) : null}
      </div>
      {hasFooter ? (
        <div className="mt-3 flex items-center gap-2">
          {hasSpark ? (
            <span className="order-last ml-auto shrink-0">
              <Sparkline points={spark as number[]} />
            </span>
          ) : null}
          {delta ? (
            <span
              className={cn(
                "inline-flex h-5 items-center gap-0.5 rounded-full px-2 text-xs font-medium ring-1 ring-inset",
                delta.positive
                  ? "bg-success-50 text-success-700 ring-success-500/20"
                  : "bg-danger-50 text-danger-700 ring-danger-500/20"
              )}
            >
              {delta.positive ? (
                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
              )}
              {delta.value}
            </span>
          ) : null}
          {hint ? <span className="text-xs text-faint">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
