"use client";

/**
 * Trainer dashboard — the trainer-perspective counterpart of the L&D Head
 * dashboard (`features/ld-dashboard`). Same layout rhythm, ordered by
 * decision urgency:
 *
 *   1. Triage      — what needs action right now (attendance, at-risk, …)
 *   2. Scope       — the trainer's teaching footprint (courses / batches /
 *                    students / clients), one slim strip
 *   3. Outcomes    — completion, score, at-risk, weekly activity
 *   4. Diagnosis   — cohort split + I Do / We Do / You Do funnel, plus the
 *                    quick-actions rail routed to real trainer pages
 *   5. Who         — at-risk learners, per-course health, today's batches
 *   6. Detail      — the weakest course, and the running chronology
 *
 * Perspective changes vs the L&D view: no client/trainer comparison panels
 * (the trainer IS the subject), alerts link to trainer routes instead of L&D
 * console hash views, and every figure is scoped to the courses the signed-in
 * trainer actually teaches (see use-trainer-dashboard.ts for how that scope
 * is resolved).
 */

import { useCallback, useState } from "react";
import { Activity, AlertTriangle, Star, Target } from "lucide-react";
import { StaffLayout } from "@/app/lms/component/stafflayout/staff-layout";
import { count, pct } from "@/features/ld-dashboard/lib/format";
import { KpiCard } from "@/features/ld-dashboard/components/kpi-card";
import { AttentionBar } from "@/features/ld-dashboard/components/attention-bar";
import { LearningProgress } from "@/features/ld-dashboard/components/learning-progress";
import { CourseAnalytics } from "@/features/ld-dashboard/components/course-analytics";
import { ActivityFeed } from "@/features/ld-dashboard/components/activity-feed";
import { DashboardSkeleton, ErrorState } from "@/features/ld-dashboard/components/states";
import { useTrainerDashboard } from "./hooks/use-trainer-dashboard";
import {
  CoursePerformancePanel,
  TodaysBatchesPanel,
  TrainerAtRiskPanel,
  TrainerHeader,
  TrainerPortfolioStrip,
  TrainerQuickActions,
} from "./components/trainer-panels";

export default function StaffDashboardPage() {
  const [course, setCourse] = useState("all");
  const onReset = useCallback(() => setCourse("all"), []);

  const {
    loading,
    error,
    model,
    partial,
    coursePerf,
    batchesToday,
    courseOptions,
    permissionKeys,
  } = useTrainerDashboard(course, onReset);

  // `@container` makes every grid respond to the CONTENT width rather than the
  // viewport — the shell's sidebar takes 244px, so viewport breakpoints would
  // overpack the cards (same rationale as the L&D dashboard).
  const shell = "@container w-full space-y-4 sm:space-y-5";

  const attendanceHref = permissionKeys.has("attendancemanagement")
    ? "/lms/pages/attendancemanagement"
    : "#todays-batches";

  if (loading) {
    return (
      <StaffLayout>
        <div className={shell}>
          <TrainerHeader
            scope="My teaching overview"
            subline="Loading your courses…"
            filtered={false}
            onReset={onReset}
            course={course}
            courseOptions={[]}
            onCourse={setCourse}
          />
          <DashboardSkeleton />
        </div>
      </StaffLayout>
    );
  }

  if (error || !model) {
    return (
      <StaffLayout>
        <div className={shell}>
          <TrainerHeader
            scope="My teaching overview"
            subline=""
            filtered={false}
            onReset={onReset}
            course={course}
            courseOptions={[]}
            onCourse={setCourse}
          />
          <ErrorState message={error || "No data returned for this view."} />
        </div>
      </StaffLayout>
    );
  }

  const scopeLabel = course !== "all" ? "this course" : "your courses";
  // Real per-course completion values — a distribution, never a fabricated
  // time series (the analytics endpoint has no history to plot).
  const courseSpread = coursePerf
    .filter((c) => c.students > 0 && c.avg !== null)
    .map((c) => c.avg as number);

  return (
    <StaffLayout>
      <div className={shell}>
        <TrainerHeader
          scope={model.scope}
          subline={model.subline}
          filtered={model.filtered}
          onReset={onReset}
          course={course}
          courseOptions={courseOptions}
          onCourse={setCourse}
        />

        {/* 1 · Triage */}
        <AttentionBar alerts={model.alerts} />

        {/* 2 · Scope */}
        <TrainerPortfolioStrip
          model={model}
          batchesToday={batchesToday}
          attendanceHref={attendanceHref}
        />

        {/* 3 · Outcomes — the four headline numbers on one line */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 @3xl:grid-cols-4">
          <KpiCard
            index={0}
            label="Overall completion"
            value={model.students === 0 ? "—" : pct(model.completion)}
            caption="Share of exercises finished"
            icon={Target}
            tone="brand"
            meter={model.students ? model.completion : 0}
            spread={courseSpread}
            spreadLabel={`Spread across ${count(courseSpread.length)} active courses`}
            href="#course-performance"
          />
          <KpiCard
            index={1}
            label="Average score"
            value={pct(model.avgScore)}
            caption="Marks-weighted · We Do & You Do"
            icon={Star}
            tone="success"
            meter={model.avgScore}
          />
          <KpiCard
            index={2}
            label="At-risk learners"
            value={count(model.atRiskCount)}
            caption={`${model.atRiskPct}% of enrolled · below 50%`}
            icon={AlertTriangle}
            tone={model.atRiskCount > 0 ? "danger" : "success"}
            meter={model.atRiskPct}
            href="#at-risk"
          />
          <KpiCard
            index={3}
            label="Active this week"
            value={count(model.active7)}
            caption={`of ${count(model.students)} enrolled · last 7 days`}
            icon={Activity}
            tone="info"
            meter={model.active7Pct}
          />
        </div>

        {/* 4 · Diagnosis + act */}
        <div className="grid grid-cols-1 gap-4 @5xl:grid-cols-12 @5xl:gap-5">
          <LearningProgress model={model} scopeLabel={scopeLabel} className="@5xl:col-span-8" />
          <TrainerQuickActions
            model={model}
            permissionKeys={permissionKeys}
            className="@5xl:col-span-4"
          />
        </div>

        {/* 5 · Who — at-risk learners, per-course health, today's batches */}
        <div
          id="at-risk"
          className="grid scroll-mt-4 grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3 @5xl:gap-5"
        >
          <TrainerAtRiskPanel rows={model.atRisk} />
          <div id="course-performance" className="scroll-mt-4 min-w-0">
            <CoursePerformancePanel rows={coursePerf} className="h-full" />
          </div>
          <div id="todays-batches" className="scroll-mt-4 min-w-0 @3xl:col-span-2 @6xl:col-span-1">
            <TodaysBatchesPanel
              batches={batchesToday}
              loading={partial && batchesToday.length === 0}
              attendanceHref={attendanceHref}
              className="h-full"
            />
          </div>
        </div>

        {/* 6 · Detail */}
        <div className="grid grid-cols-1 gap-4 @5xl:grid-cols-12 @5xl:gap-5">
          <CourseAnalytics
            focus={model.focus}
            loading={partial && !model.focus?.weeks.length}
            className="@5xl:col-span-8"
          />
          <ActivityFeed items={model.activity} className="@5xl:col-span-4" />
        </div>

        <p className="pb-2 text-2xs text-faint">
          All figures respect the course filter above and cover the courses you teach. Percentages
          show “—” or “N/A” where the underlying content does not exist, so an empty stage is never
          reported as 0%.
        </p>
      </div>
    </StaffLayout>
  );
}
