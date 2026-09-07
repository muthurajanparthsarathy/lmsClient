"use client";

/**
 * Learning progress — cohort split (donut) plus the I Do / We Do / You Do
 * pedagogy funnel.
 *
 * The funnel is the part an L&D Head reads first: a healthy course loses a
 * little at each stage, so a big drop between "We Do" and "You Do" means
 * learners can follow along but cannot yet work unaided. That is a content
 * problem, not an engagement problem — and the two need different fixes.
 */

import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import type { DashboardModel } from "../types";
import { count, pct } from "../lib/format";
import { EmptyState, } from "./states";
import { Meter, SectionCard } from "./ui-kit";

/* One hue, three steps — NOT the semantic tone palette.
   Completed / In progress / Not started are three slices of a single quantity,
   which is ordinal: they have an order and they sum to the whole. The old
   green / orange / grey encoded them as if they were unrelated categories, and
   green additionally read as "good" on what is really just a position along a
   progression. A sequential ramp says "same measure, further along" — dark
   through to pale — which is what the data actually means. */
const SEGMENTS: {
  key: "completed" | "inProgress" | "notStarted";
  label: string;
  hex: string;
  swatch: string;
}[] = [
  { key: "completed", label: "Completed", hex: "#c2540f", swatch: "bg-brand-700" },
  { key: "inProgress", label: "In progress", hex: "#f97316", swatch: "bg-brand-500" },
  { key: "notStarted", label: "Not started", hex: "#ffe4d0", swatch: "bg-brand-200" },
];

export function LearningProgress({
  model,
  scopeLabel,
  className,
}: {
  model: DashboardModel;
  scopeLabel: string;
  className?: string;
}) {
  const reduce = useReducedMotion();

  const data = useMemo(
    () =>
      SEGMENTS.map((s) => ({
        name: s.label,
        value: model[s.key],
        fill: s.hex,
      })).filter((d) => d.value > 0),
    [model],
  );

  const hasStudents = model.students > 0;

  return (
    <SectionCard title="Learning progress" meta={scopeLabel} className={className}>
      {!hasStudents ? (
        <EmptyState
          title="No learners in this view"
          hint="Enrol students on a course, or widen the client / course filter above."
        />
      ) : (
        // 2fr / 3fr once the card is wide enough to hold both — the ~40/60 the
        // design calls for. Below that they stack, donut first.
        <div className="grid gap-5 @4xl:grid-cols-5 @4xl:gap-6">
          {/* Cohort split */}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6 @4xl:col-span-2">
            <div className="relative size-[132px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={62}
                    paddingAngle={data.length > 1 ? 2 : 0}
                    stroke="none"
                    isAnimationActive={!reduce}
                    animationDuration={520}
                  >
                    {data.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl leading-none font-semibold tabular-nums text-heading">
                  {pct(model.completedPct)}
                </span>
                <span className="mt-0.5 text-2xs text-subtle">completed</span>
              </div>
            </div>

            <dl className="grid w-full min-w-0 gap-2.5">
              {SEGMENTS.map((s) => {
                const value = model[s.key];
                const share = model[`${s.key}Pct` as "completedPct" | "inProgressPct" | "notStartedPct"];
                return (
                  <div key={s.key} className="flex min-w-0 items-center gap-2.5">
                    <span aria-hidden className={cn("size-2.5 shrink-0 rounded-sm", s.swatch)} />
                    <dt className="min-w-0 flex-1 truncate text-xs text-body">{s.label}</dt>
                    {/* Count first, share in parentheses: the headcount is the
                        fact, the percentage is the interpretation of it. */}
                    <dd className="shrink-0 text-xs font-semibold tabular-nums text-heading">
                      {count(value)}
                      <span className="ml-1.5 font-normal text-subtle">({pct(share)})</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          {/* Pedagogy funnel — occupies the slot the design gives a month-by-month
              line chart. There is no monthly series behind this dashboard (every
              endpoint returns a current snapshot), so this shows the real stage
              breakdown instead of a fabricated trend. */}
          <div className="border-t border-hairline pt-4 @4xl:col-span-3 @4xl:border-t-0 @4xl:border-l @4xl:pt-0 @4xl:pl-6">
            <p className="mb-3 text-2xs font-semibold tracking-wide text-subtle uppercase">
              Completion by stage
            </p>
            <ul className="grid gap-3.5">
              {model.stages.map((s) => (
                <li key={s.key} className="min-w-0">
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-heading">{s.label}</span>
                    <span className="min-w-0 flex-1 truncate text-2xs text-subtle">{s.tag}</span>
                    <span
                      className={cn(
                        "shrink-0 text-xs font-semibold tabular-nums",
                        s.value === null ? "text-faint" : "text-heading",
                      )}
                    >
                      {s.value === null ? "N/A" : pct(s.value)}
                    </span>
                  </div>
                  <Meter
                    value={s.value}
                    tone={s.value === null ? "neutral" : "brand"}
                    label={`${s.label} completion`}
                  />
                </li>
              ))}
            </ul>
            {model.stages.some((s) => s.value === null) && (
              <p className="mt-3 text-2xs text-faint">
                N/A means the stage has no content in this view — it is never counted as 0%.
              </p>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
