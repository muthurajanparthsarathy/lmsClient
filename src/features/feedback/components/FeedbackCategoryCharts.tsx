"use client";

// ─── Feedback category charts ─────────────────────────────────────────────────
// A grid of compact per-category bar charts used everywhere the feedback module
// needs to answer "how did each parameter do?" — the Report Designer modal and
// the detailed feedback report both consume this component so the two surfaces
// can never drift apart visually.
//
// Design intent (from the user, verbatim: "each metrics like engagement so
// according 4 or 5 like thing… each bar not so far near proper and
// understandable"):
//   • One card per feedback CATEGORY (parameter). If a form has no categories,
//     the caller feeds one group named "Other" and this renders as a single
//     wide card with every question on its X-axis.
//   • Within a card, X-axis = questions, Y-axis = raw rating on THAT question's
//     own scale (4 or 5) — never squashed to a common scale, since the user
//     asked for the actual grade shown.
//   • Narrow bars packed close together (barSize=16, barCategoryGap=2), not the
//     wide chunky bars the old parameterAverages chart drew.
//   • Colour-banded by score so the reader can glance and see the low ones.
//   • Every question is drawn — no top-N cap that would hide the worst
//     performers, which is the reason to look at this chart in the first place.
//
// Mixed-scale handling: the accumulator on both call sites keys questions by
// (category, questionText, scale) so a 4-scale and 5-scale question that
// happen to share text are NOT merged. Within a group we pick the largest
// present scale for the Y-axis domain and expose scaleMixed so the header can
// warn the reader when a card blends two scales.

import * as React from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  LabelList,
} from "recharts";

export type QuestionBar = {
  question: string; // full text, shown in the tooltip
  short: string; // x-axis tick label (truncated or Q1/Q2 depending on count)
  avg: number; // 0..scale
  n: number; // rating count
  scale: number; // this question's own maxRating (4 or 5)
};

export type CategoryGroup = {
  category: string; // "Other" when the form had no categories
  scale: number; // Y-axis domain — max of the group's question scales
  scaleMixed: boolean; // true when the group mixes 4- and 5-scale questions
  weightedAvg: number; // header chip, weighted by rating count per question
  totalN: number; // sum of ratings behind this card
  questions: QuestionBar[]; // preserved in caller-provided order
};

const bandColour = (avg: number, scale: number): string => {
  const r = scale > 0 ? avg / scale : 0;
  // Thresholds match the LMS "positive feedback" convention (≥ 70% is passing),
  // extended with a stronger "good" band at ≥ 80% so a category with everyone
  // in the mid-70s still reads as amber rather than fully green.
  if (r >= 0.8) return "#16a34a"; // green — good
  if (r >= 0.6) return "#f59e0b"; // amber — watch
  return "#ef4444"; // red — needs attention
};

// Callers build the group's `short` labels themselves so this component doesn't
// have to know whether the caller wants ordinal (Q1/Q2/…) or truncated titles.
// The helper is exported to keep both surfaces consistent.
export const shortLabelsFor = (questions: string[]): string[] => {
  if (questions.length === 0) return [];
  // ≤ 6 questions fit as truncated text; more than that and ordinal Q1..Qn is
  // the only thing that stays readable at 16px bars.
  if (questions.length <= 6) {
    return questions.map((q) => (q.length > 16 ? q.slice(0, 15) + "…" : q));
  }
  return questions.map((_, i) => `Q${i + 1}`);
};

function CategoryChartCard({ group }: { group: CategoryGroup }) {
  const data = group.questions;
  // Auto-rotate ticks above the density where horizontal starts to overlap.
  const rotate = data.length > 6 ? -30 : 0;
  const bottomMargin = rotate ? 46 : 8;
  const barSize = data.length > 12 ? 12 : 16;

  return (
    <div className="rounded-lg border border-hairline bg-surface p-3 shadow-xs">
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-[12px] font-semibold text-heading">
            {group.category}
          </h4>
          <p className="mt-0.5 text-[10px] text-subtle">
            {data.length} question{data.length === 1 ? "" : "s"}
            {" · "}
            {group.totalN} rating{group.totalN === 1 ? "" : "s"}
            {group.scaleMixed ? " · mixed scales" : ""}
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-hairline bg-canvas px-2 py-0.5 text-[11px] font-semibold tabular-nums text-heading">
          {group.weightedAvg.toFixed(2)}
          <span className="ml-0.5 text-subtle">/{group.scale}</span>
        </div>
      </header>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 18, right: 8, bottom: bottomMargin, left: -18 }}
            barCategoryGap={2}
            barGap={2}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="short"
              interval={0}
              tick={{ fontSize: 10, fill: "#6b7280" }}
              angle={rotate}
              textAnchor={rotate ? "end" : "middle"}
              height={rotate ? 46 : 22}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              domain={[0, group.scale]}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              width={28}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine
              y={group.scale * 0.7}
              stroke="#d1d5db"
              strokeDasharray="3 3"
              strokeWidth={1}
              ifOverflow="hidden"
            />
            <RTooltip
              cursor={{ fill: "rgba(99,102,241,0.06)" }}
              content={({ active, payload }: any) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as QuestionBar;
                return (
                  <div className="rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11px] shadow-md">
                    <div className="max-w-[260px] whitespace-normal font-medium text-heading">
                      {p.question}
                    </div>
                    <div className="mt-1 text-subtle">
                      <span className="font-semibold tabular-nums text-heading">
                        {p.avg.toFixed(2)}
                      </span>
                      {" / "}
                      {p.scale}
                      {" · "}
                      {p.n} rating{p.n === 1 ? "" : "s"}
                    </div>
                  </div>
                );
              }}
            />
            <Bar
              dataKey="avg"
              barSize={barSize}
              radius={[3, 3, 0, 0]}
              minPointSize={2}
              isAnimationActive={false}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={bandColour(d.avg, d.scale)} />
              ))}
              <LabelList
                dataKey="avg"
                position="top"
                formatter={(v: any) => (typeof v === "number" ? v.toFixed(1) : v)}
                style={{
                  fontSize: 10,
                  fill: "#374151",
                  fontWeight: 600,
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export interface FeedbackCategoryChartsProps {
  groups: CategoryGroup[];
  emptyLabel?: string;
  className?: string;
}

export function FeedbackCategoryCharts({
  groups,
  emptyLabel = "No parameter data in the selection.",
  className,
}: FeedbackCategoryChartsProps) {
  if (!groups.length) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-subtle">
        {emptyLabel}
      </div>
    );
  }
  // One group → single wide card (no wasted whitespace); 2+ → responsive grid.
  const gridClass =
    groups.length === 1
      ? "grid grid-cols-1 gap-3"
      : "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3";
  return (
    <div className={[gridClass, className].filter(Boolean).join(" ")}>
      {groups.map((g) => (
        <CategoryChartCard key={g.category} group={g} />
      ))}
    </div>
  );
}
