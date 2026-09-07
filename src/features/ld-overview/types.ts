/**
 * L&D Overview — domain types.
 *
 * Everything here is derived from endpoints the platform already exposes:
 *   `/analytics/staff/analytics/students`   course + per-learner progress
 *   `/analytics/staff/analytics/ld-signals` attempt counts + weekly series
 *   `/courses-structure/getAll`             rosters (trainer count)
 *   `/attendance/overview`                  today's batches
 * Nothing invents a field the API does not provide.
 */

import type { ComponentType } from "react";
import type { Tone } from "@/features/ld-dashboard/types";
import type { CourseStatus, ReadinessBandKey } from "./lib/readiness";

export type { Tone };

export type Icon = ComponentType<{
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean;
}>;

/** Activity window. `days: null` means "everything on record". */
export interface Period {
  value: string;
  label: string;
  days: number | null;
}

export const PERIODS: Period[] = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "all", label: "All time", days: null },
];

/** Scope handed down by the L&D console — client / course, plus the period
 *  this page owns. */
export interface OverviewFilter {
  client: string;
  course: string;
  courseIds: Set<string> | null;
  clientOf: (id: string) => string | undefined;
  period: Period;
}

/** A metric with a comparison against the preceding equal-length window.
 *  `delta` is in percentage POINTS and is null when no prior window exists. */
export interface Trended {
  value: number | null;
  delta: number | null;
  /** Weekly history for the sparkline; empty when the series is not real. */
  spark: number[];
}

export interface JourneyStage {
  key: "iDo" | "weDo" | "youDo";
  label: string;
  tag: string;
  value: number | null;
  tone: Tone;
}

export interface JourneyGap {
  label: string;
  /** Negative = a drop between the two stages, in percentage points. */
  delta: number;
  learners: number;
}

export interface ReadinessPart {
  /** Stable key — one of the four rows the readiness card renders. */
  key: "iDo" | "weDo" | "youDo" | "overall";
  /** Row title, e.g. "I Do Performance". */
  label: string;
  /** Sub-label under the title, e.g. "Concept Understanding". */
  description: string;
  /** 0–100, or null when this stage carries no score-based content in scope. */
  value: number | null;
  /** Change in percentage points vs the preceding equal-length window, when
   *  the weekly submission series supports it. Null when it does not. */
  delta: number | null;
  /** Fallback text for the value cell when `value === null`, e.g.
   *  "No score-based evaluation". */
  emptyLabel?: string;
}

export interface DistributionSlice {
  key: ReadinessBandKey;
  label: string;
  hint: string;
  count: number;
  pct: number;
  color: string;
  href: string;
}

export interface PracticeHealth {
  attempts: number | null;
  completionRate: number | null;
  avgAttempts: number | null;
  solvedIndependently: number | null;
  struggling: number | null;
}

export interface TrendPoint {
  label: string;
  progress: number | null;
  mastery: number | null;
  independent: number | null;
}

export interface PriorityAction {
  id: string;
  count: number;
  label: string;
  detail: string;
  href: string;
  tone: Tone;
}

export interface CourseHealthRow {
  id: string;
  name: string;
  client: string;
  learners: number;
  progress: number | null;
  practice: number | null;
  mastery: number | null;
  readiness: number | null;
  status: CourseStatus | null;
  spark: number[];
}

export interface OverviewModel {
  /** Portfolio counts — context, not headline metrics. */
  portfolio: { clients: number; courses: number; learners: number; trainers: number };

  /** KPI row. */
  active: Trended & { pct: number | null; window: number | null };
  progress: Trended;
  practice: Trended & { done: number; total: number };
  mastery: Trended;
  attention: { count: number; pct: number };

  journey: JourneyStage[];
  gap: JourneyGap | null;

  readiness: number | null;
  readinessDelta: number | null;
  readinessParts: ReadinessPart[];

  distribution: DistributionSlice[];
  distributionTotal: number;

  health: PracticeHealth;
  trend: TrendPoint[];
  actions: PriorityAction[];
  courses: CourseHealthRow[];

  /** True when any course is in scope at all. */
  hasData: boolean;
  /** True when the signals endpoint has not (or could not) load — the panels
   *  that depend on it say so rather than showing zeroes. */
  signalsMissing: boolean;
}

/** Async envelope so every panel degrades independently. */
export interface Async<T> {
  loading: boolean;
  error: string;
  data: T | null;
}
