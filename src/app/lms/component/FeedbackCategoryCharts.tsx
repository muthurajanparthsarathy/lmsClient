"use client";

// ─── Feedback questions chart ────────────────────────────────────────────────
// A SINGLE compact bar chart used everywhere the feedback module needs to
// answer "how did each question do?" — the Report Designer modal and the
// detailed feedback report both consume this component so the two surfaces
// can never drift apart visually.
//
// Design intent (from the user, refined over two rounds):
//   • ONE chart, not a grid of per-category cards. Every rating question is
//     one bar. Long question titles are truncated with "…" on the X-axis
//     tick; the FULL question text lives in the tooltip on hover.
//   • Y-axis is the actual grade scale (usually /5, sometimes /4) — never
//     normalised. The tooltip prints the exact "avg / scale" for each bar.
//   • Bars are colour-coded by category, so a reader can see "these three
//     bars are all Trainer questions" even though there's only one chart.
//     Questions are pre-sorted by (category, form-order) so identical
//     colours cluster and read as visual blocks.
//   • Narrow bars packed close together (barSize 14, barCategoryGap 2) —
//     never the wide chunky bars the old parameterAverages chart drew.
//   • A legend below the chart maps colour → category, plus one weighted
//     "overall" chip and a rating-count meta line so the reader has the
//     numbers at a glance.
//   • Every question is drawn — no top-N cap that would hide the worst
//     performers, which is the reason to look at this chart in the first
//     place. If the count gets past what fits, callers can wrap the chart
//     in an overflow-x scroller.

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
  question: string; // full text — shown in the tooltip
  short: string; // x-axis tick label (truncated with "…" when long)
  avg: number; // 0..scale
  n: number; // rating count
  scale: number; // this question's own maxRating (4 or 5)
  category: string; // for colour + legend + tooltip
};

export type CategoryLegendEntry = {
  name: string; // "Other" when the form had no categories
  color: string;
};

// Palette matching the surrounding LMS charts. Kept in-file so this component
// stays self-contained even if callers use a different palette elsewhere.
export const CATEGORY_COLORS = [
  "#6366f1", // indigo — first category / "Overall"
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#f43f5e", // rose
  "#22c55e", // green
  "#eab308", // yellow
];

// Truncate a question to fit a rotated x-axis tick. The character budget
// depends on how many bars the chart is trying to draw — 12 chars is the
// most a -35° tick reliably shows at barSize 14 on a 720px chart.
export const truncateForTick = (
  question: string,
  maxChars: number = 14
): string => {
  if (!question) return "";
  const trimmed = question.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars - 1) + "…";
};

// Convenience helper for callers: build the per-question `short` label from
// its full text with a length that scales with the total bar count.
export const shortLabelsFor = (questions: string[]): string[] => {
  // With many bars the tick budget shrinks (chart width is roughly fixed).
  const budget =
    questions.length > 24 ? 8 : questions.length > 14 ? 10 : 14;
  return questions.map((q) => truncateForTick(q, budget));
};

export interface FeedbackQuestionsChartProps {
  /** Flat list of every rating question, pre-sorted by (category, form order). */
  questions: QuestionBar[];
  /** Category legend, in display order. Omit for a single-category form. */
  categories?: CategoryLegendEntry[];
  /** Y-axis domain max — the largest scale present across the questions. */
  scale: number;
  /** True when the questions span more than one grade scale (4 and 5). */
  scaleMixed?: boolean;
  /** Weighted average shown in the header chip. */
  overallAvg?: number;
  /** Total ratings across every question — meta line. */
  totalN?: number;
  /** Chart body height. */
  height?: number;
  /** Empty-state message when the questions array is empty. */
  emptyLabel?: string;
  className?: string;
}

export function FeedbackQuestionsChart({
  questions,
  categories,
  scale,
  scaleMixed,
  overallAvg,
  totalN,
  height = 320,
  emptyLabel = "No parameter data in the selection.",
  className,
}: FeedbackQuestionsChartProps) {
  if (!questions.length) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-subtle">
        {emptyLabel}
      </div>
    );
  }

  // Bar geometry: shrink barSize once the count gets past what a normal card
  // width comfortably shows, so we never fall back to the wide-bar look the
  // user asked us to fix.
  const barSize =
    questions.length > 18 ? 10 : questions.length > 10 ? 12 : 14;

  // Rotate x-axis ticks whenever we have more than a few bars — untangled
  // horizontal ticks stop overlapping.
  const rotate = questions.length > 5 ? -35 : 0;
  const bottomMargin = rotate ? 62 : 12;

  const totalWithFallback =
    totalN != null
      ? totalN
      : questions.reduce((s, q) => s + (q.n || 0), 0);

  const overallWithFallback =
    typeof overallAvg === "number"
      ? overallAvg
      : totalWithFallback > 0
        ? Math.round(
            (questions.reduce((s, q) => s + q.avg * q.n, 0) /
              totalWithFallback) *
              100
          ) / 100
        : 0;

  return (
    <div
      className={
        "rounded-lg border border-hairline bg-surface p-3 shadow-xs " +
        (className || "")
      }
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] text-subtle">
            {questions.length} question{questions.length === 1 ? "" : "s"}
            {" · "}
            {totalWithFallback} rating{totalWithFallback === 1 ? "" : "s"}
            {scaleMixed ? " · mixed scales" : ""}
          </p>
        </div>
        <div className="shrink-0 rounded-full border border-hairline bg-canvas px-2 py-0.5 text-[11px] font-semibold tabular-nums text-heading">
          {overallWithFallback.toFixed(2)}
          <span className="ml-0.5 text-subtle">/{scale}</span>
        </div>
      </header>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={questions}
            margin={{ top: 18, right: 12, bottom: bottomMargin, left: -12 }}
            barCategoryGap={2}
            barGap={2}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              vertical={false}
            />
            <XAxis
              dataKey="short"
              interval={0}
              tick={{ fontSize: 10, fill: "#6b7280" }}
              angle={rotate}
              textAnchor={rotate ? "end" : "middle"}
              height={rotate ? 62 : 24}
              tickLine={false}
              axisLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              domain={[0, scale]}
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              width={28}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine
              y={scale * 0.7}
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
                  <div className="max-w-[300px] rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[11px] shadow-md">
                    <div className="whitespace-normal font-medium text-heading">
                      {p.question}
                    </div>
                    <div className="mt-1 text-subtle">
                      <span
                        className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle"
                        style={{ backgroundColor: colourFor(p.category, categories) }}
                        aria-hidden
                      />
                      {p.category}
                    </div>
                    <div className="mt-0.5 text-subtle">
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
              {questions.map((q, i) => (
                <Cell key={i} fill={colourFor(q.category, categories)} />
              ))}
              <LabelList
                dataKey="avg"
                position="top"
                formatter={(v: any) =>
                  typeof v === "number" ? v.toFixed(1) : v
                }
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

      {categories && categories.length > 1 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-hairline pt-2 text-[11px] text-body">
          {categories.map((c) => (
            <span key={c.name} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ backgroundColor: c.color }}
                aria-hidden
              />
              <span className="text-subtle">{c.name}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function colourFor(
  category: string,
  categories?: CategoryLegendEntry[]
): string {
  if (!categories?.length) return CATEGORY_COLORS[0];
  const hit = categories.find((c) => c.name === category);
  return hit?.color || CATEGORY_COLORS[0];
}
