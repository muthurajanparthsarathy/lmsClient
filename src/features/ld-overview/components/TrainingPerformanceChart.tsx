"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Empty, Skeleton } from "./primitives";
import type { OverviewModel } from "../types";

/**
 * Training Performance Trend — the only genuinely dated series the platform
 * records.
 *
 * `questions[].submittedAt` is the single timestamp on a learner's work, so
 * these three lines are built from submissions, bucketed by ISO week
 * (`lib/metrics.ts` → `buildSeries`) and accumulated to date. Each line uses
 * the SAME construction as the KPI card it belongs to, so its final point
 * lands on that card's number instead of drifting beside it.
 *
 * The x-axis is real week-commencing dates from the data, never a synthetic
 * "Week 1…8" ladder, and it is clipped to the selected Time Period.
 *
 * Note on Course Progress: the platform dates practice submissions but not
 * I Do document completions, so the undated share is held flat across the
 * series. The line therefore understates growth early on but lands exactly on
 * the Course Progress KPI at the right-hand edge — a conservative curve rather
 * than an invented one.
 */

const SERIES = [
  { key: "progress" as const, label: "Course Progress", color: "var(--ch3, #1baf7a)" },
  { key: "mastery" as const, label: "Skill Mastery", color: "var(--ch2, #2a78d6)" },
  { key: "independent" as const, label: "Independent Performance (You Do)", color: "var(--accent)" },
];

export function TrainingPerformanceChart({ model }: { model: OverviewModel | null }) {
  if (!model) {
    return (
      <Card title="Training Performance Trend">
        <Skeleton h={196} />
      </Card>
    );
  }

  if (model.trend.length < 2) {
    return (
      <Card title="Training Performance Trend">
        <Empty
          title={model.signalsMissing ? "Trend data unavailable" : "Not enough history yet"}
          hint={
            model.signalsMissing
              ? "The practice signals request did not complete — the rest of the page is unaffected."
              : "A trend needs at least two weeks of submissions inside the selected period."
          }
        />
      </Card>
    );
  }

  return (
    <Card
      title="Training Performance Trend"
      right={
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {SERIES.map((s) => (
            <span key={s.key} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 10.5, color: "var(--muted)", fontWeight: 600 }}>
              <i style={{ width: 12, height: 2, borderRadius: 2, background: s.color }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
      }
    >
      <div style={{ height: 200, marginLeft: -10 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={model.trend} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10.5, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--grid)" }}
              interval="preserveStartEnd"
              minTickGap={18}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 10.5, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                fontSize: 11.5,
                boxShadow: "var(--shadow-sm)",
                color: "var(--ink)",
              }}
              labelStyle={{ color: "var(--muted)", fontSize: 10.5, marginBottom: 2 }}
              formatter={(v: any, name: any) => [v === null ? "—" : `${v}%`, name]}
              labelFormatter={(l) => `Week of ${l}`}
            />
            {SERIES.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={1.8}
                dot={false}
                activeDot={{ r: 3.5, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
