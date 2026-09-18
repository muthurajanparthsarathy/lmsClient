/**
 * L&D Dashboard — domain types.
 *
 * These mirror the shapes the existing analytics endpoints already return
 * (`/analytics/staff/analytics/students`, `/courses-structure/getAll`,
 * `/attendance/overview`, `/approvals/pending`, `/getAll/feedback`). Nothing
 * here invents a field the API does not provide — the redesign changes the
 * presentation layer only, so every number on screen stays traceable.
 */

import type { ComponentType } from "react";

export type Icon = ComponentType<{
  size?: number | string;
  strokeWidth?: number;
  className?: string;
  "aria-hidden"?: boolean;
}>;

/** Semantic status used for chips, bars and tints. Never decorative. */
export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

/** Filter contract handed down by the LD shell (client / course scoping). */
export interface DashFilter {
  client: string;
  course: string;
  courseIds: Set<string> | null;
  clientOf: (id: string) => string | undefined;
  onReset: () => void;
}

/** One course row flattened out of the analytics payload. */
export interface CourseRow {
  id: string;
  name: string;
  code: string;
  client: string;
  students: number;
  /** Mean completion % across enrolled students. */
  avg: number;
  done: number;
  prog: number;
  not: number;
}

/** One student row flattened out of the analytics payload. */
export interface StudentRow {
  name: string;
  course: string;
  courseId: string;
  /** Overall completion %, 0–100. */
  overall: number;
  /** Per-stage completion %; `null` when the stage has no content at all. */
  iDo: number | null;
  weDo: number | null;
  youDo: number | null;
  /** Marks-weighted score across We Do / You Do; `null` when nothing is scored. */
  score: number | null;
  last: string | null;
}

export interface StageProgress {
  key: "iDo" | "weDo" | "youDo";
  label: string;
  tag: string;
  value: number | null;
}

export interface ClientPerf {
  name: string;
  students: number;
  avg: number | null;
  score: number | null;
  risk: number;
  attendance: { marked: number; total: number } | null;
  sparks: number[];
}

export interface TrainerPerf {
  name: string;
  courses: number;
  students: number;
  /** Mean completion across the trainer's courses. */
  comp: number | null;
  score: number | null;
}

export interface RiskRow {
  name: string;
  course: string;
  overall: number;
  level: "Critical" | "High" | "Medium";
  tone: Tone;
}

export interface ActivityItem {
  at: string;
  tone: Tone;
  title: string;
  detail: string;
}

export interface AlertItem {
  id: string;
  count: number;
  tone: Tone;
  icon: Icon;
  label: string;
  href: string;
}

export interface WeekPoint {
  label: string;
  value: number;
}

export interface FocusCourse {
  id: string;
  name: string;
  students: number;
  completion: number;
  score: number | null;
  assignments: number | null;
  attendance: number | null;
  weeks: WeekPoint[];
}

/** Everything the view renders, derived once from the raw payloads. */
export interface DashboardModel {
  scope: string;
  subline: string;
  filtered: boolean;

  // Portfolio counts — context, not headline metrics.
  clients: number;
  courses: number;
  activeCourses: number;
  students: number;
  trainers: number;

  // Outcome metrics — the headline four.
  completion: number;
  avgScore: number | null;
  atRiskCount: number;
  atRiskPct: number;
  active7: number;
  active7Pct: number;

  completed: number;
  inProgress: number;
  notStarted: number;
  completedPct: number;
  inProgressPct: number;
  notStartedPct: number;

  inactive7: number;
  pendingBatches: number;
  pendingApprovals: number;
  lowCourses: number;

  stages: StageProgress[];
  atRisk: RiskRow[];
  clientsPerf: ClientPerf[];
  trainers_: TrainerPerf[];
  topTrainer: TrainerPerf | null;
  lowTrainer: TrainerPerf | null;
  activity: ActivityItem[];
  alerts: AlertItem[];
  focus: FocusCourse | null;
}

/** Async envelope used by every panel so each degrades independently. */
export interface Async<T> {
  loading: boolean;
  error: string;
  data: T | null;
}
