"use client";

/**
 * Course analytics — focused on ONE course at a time.
 *
 * Which course? The one currently filtered, or, when viewing the whole
 * portfolio, the *weakest* course that has learners on it. A dashboard that
 * shows the top course is flattering; one that shows the weakest is useful.
 */

import { useReducedMotion } from "framer-motion";
import { BookOpen } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FocusCourse } from "../types";
import { band, count, pct, toneHex } from "../lib/format";
import { EmptyState } from "./states";
import { Chip, MetricPair, SectionCard } from "./ui-kit";

function AttendanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-chip border border-hairline bg-surface px-2.5 py-1.5 shadow-md">
      <p className="text-2xs text-subtle">Week of {label}</p>
      <p className="text-xs font-semibold tabular-nums text-heading">{payload[0].value}% present</p>
    </div>
  );
}

export function CourseAnalytics({
  focus,
  loading,
  className,
}: {
  focus: FocusCourse | null;
  loading?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const health = focus ? band(focus.completion) : null;

  return (
    <SectionCard
      title="Course analytics"
      meta={focus ? focus.name : undefined}
      className={className}
    >
      {!focus ? (
        <EmptyState
          icon={BookOpen}
          title="No active course to analyse"
          hint="A course appears here once it has enrolled learners."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-heading">
              {focus.name}
            </p>
            {health && <Chip tone={health.tone}>{health.label}</Chip>}
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-control border border-hairline bg-surface-sunken p-3 sm:grid-cols-3 lg:grid-cols-5 dark:bg-ink-800/40">
            <MetricPair label="Students" value={count(focus.students)} />
            <MetricPair
              label="Completion"
              value={pct(focus.completion)}
              tone={band(focus.completion).tone}
            />
            <MetricPair label="Avg score" value={pct(focus.score)} />
            <MetricPair label="Assignments" value={pct(focus.assignments)} />
            <MetricPair label="Attendance" value={pct(focus.attendance)} />
          </dl>

          <div>
            <p className="mb-2 text-2xs font-semibold tracking-wide text-subtle uppercase">
              Weekly attendance
            </p>

            {loading ? (
              <div className="h-[132px] animate-pulse rounded-control bg-ink-100 dark:bg-ink-800" />
            ) : focus.weeks.length === 0 ? (
              <EmptyState title="No attendance records yet" className="py-6" />
            ) : (
              <div className="h-[132px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={focus.weeks}
                    margin={{ top: 4, right: 4, bottom: 0, left: -22 }}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid
                      vertical={false}
                      stroke="var(--color-hairline)"
                      strokeDasharray="3 3"
                    />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--color-subtle)" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      ticks={[0, 50, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--color-faint)" }}
                      tickFormatter={(v) => `${v}`}
                      width={40}
                    />
                    <Tooltip
                      content={<AttendanceTooltip />}
                      cursor={{ fill: "var(--color-row-hover)" }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={!reduce}
                      animationDuration={480}
                      maxBarSize={44}
                    >
                      {focus.weeks.map((w, i) => (
                        <Cell
                          key={i}
                          fill={
                            w.value >= 85
                              ? toneHex.success
                              : w.value < 50
                                ? toneHex.danger
                                : toneHex.brand
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
