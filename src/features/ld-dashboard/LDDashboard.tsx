"use client";

/**
 * L&D Head dashboard.
 *
 * ─── Layout rationale ──────────────────────────────────────────────────────
 * The page is ordered by decision urgency, not by data category:
 *
 *   1. Triage      — what needs action right now
 *   2. Scope       — how big the portfolio is (context, one slim strip)
 *   3. Outcomes    — the four metrics that say how delivery is going
 *   4. Diagnosis   — where the drop-off is (stage funnel) + how to act on it
 *   5. Who         — which learners, clients and trainers are involved
 *   6. Detail      — the weakest course, and the running chronology
 *
 * The reference layout led with eight equal-weight counters, which forces the
 * reader to work out the hierarchy themselves every time they open the page.
 *
 * ─── Grid ──────────────────────────────────────────────────────────────────
 *   <640      1 column, KPIs 2-up, all tables become row lists
 *   640–1023  1 column, KPIs 2-up, "who" panels 2-up from 768
 *   1024+     12-column grid, KPIs 4-up, 8/4 splits
 *   1280+     "who" panels 3-up
 *   1680      max width — long line lengths read as unfinished, not spacious
 */

import { Activity, AlertTriangle, Star, Target } from "lucide-react";
import type { ReactNode } from "react";
import type { DashFilter } from "./types";
import { useLdDashboard } from "./hooks/use-ld-dashboard";
import { count, pct } from "./lib/format";
import { ActivityFeed } from "./components/activity-feed";
import { AtRiskPanel } from "./components/at-risk-panel";
import { AttentionBar } from "./components/attention-bar";
import { ClientPerformance } from "./components/client-performance";
import { CourseAnalytics } from "./components/course-analytics";
import { KpiCard } from "./components/kpi-card";
import { LearningProgress } from "./components/learning-progress";
import { PageHeader } from "./components/page-header";
import { PortfolioStrip } from "./components/portfolio-strip";
import { QuickActions } from "./components/quick-actions";
import { TrainerPerformance } from "./components/trainer-performance";
import { DashboardSkeleton, ErrorState } from "./components/states";

export function LDDashboard({ filter, filterControls }: { filter: DashFilter; filterControls?: ReactNode }) {
  const { loading, error, model, partial } = useLdDashboard(filter);

  // Full-bleed: the shell's `wide` variant removes the 1120px measure and owns
  // the outer padding, so this only sets vertical rhythm. No max-width — a card
  // grid subdivides its own space, so filling the viewport stays readable in a
  // way a column of prose would not.
  //
  // `@container` makes every grid below respond to the CONTENT width rather
  // than the viewport. That matters because the shell's sidebar takes 244px:
  // at a 1280px viewport the content box is only ~990px, so a viewport-based
  // `xl:grid-cols-3` would pack three cards into 317px each. Container queries
  // measure the space that actually exists, and they keep working if the
  // sidebar is ever collapsed or resized.
  const shell = "@container w-full space-y-4 sm:space-y-5";

  if (loading) {
    return (
      <div className={shell}>
        <PageHeader scope="Portfolio overview" subline="Loading your courses…" filtered={false} onReset={filter.onReset} controls={filterControls} />
        <DashboardSkeleton />
      </div>
    );
  }

  if (error || !model) {
    return (
      <div className={shell}>
        <PageHeader scope="Portfolio overview" subline="" filtered={false} onReset={filter.onReset} controls={filterControls} />
        <ErrorState message={error || "No data returned for this view."} />
      </div>
    );
  }

  const scopeLabel = filter.course !== "all" ? "this course" : "all courses";
  // Real per-course values — a distribution, never a fabricated time series.
  const courseSpread = model.clientsPerf.flatMap((c) => c.sparks);

  return (
    <div className={shell}>
      <PageHeader
        scope={model.scope}
        subline={model.subline}
        filtered={model.filtered}
        onReset={filter.onReset}
        controls={filterControls}
      />

      {/* 1 · Triage */}
      <AttentionBar alerts={model.alerts} />

      {/* 2 · Scope */}
      <PortfolioStrip model={model} />

      {/* 3 · Outcomes — the four headline numbers belong on one line so they
          read as a single row of outcomes. 4-up from a 768px content box
          (~180px per card); 2-up only on genuinely narrow screens. */}
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
          href="#perf-progress"
        />
        <KpiCard
          index={1}
          label="Average score"
          value={pct(model.avgScore)}
          caption="Marks-weighted · We Do & You Do"
          icon={Star}
          tone="success"
          meter={model.avgScore}
          href="#perf-results"
        />
        <KpiCard
          index={2}
          label="At-risk learners"
          value={count(model.atRiskCount)}
          caption={`${model.atRiskPct}% of enrolled · below 50%`}
          icon={AlertTriangle}
          tone={model.atRiskCount > 0 ? "danger" : "success"}
          meter={model.atRiskPct}
          href="#perf-progress"
        />
        <KpiCard
          index={3}
          label="Active this week"
          value={count(model.active7)}
          caption={`of ${count(model.students)} enrolled · last 7 days`}
          icon={Activity}
          tone="brand"
          meter={model.active7Pct}
          href="#perf-progress"
        />
      </div>

      {/* 4 · Diagnosis — full width, so the donut and the stage breakdown sit
             side by side rather than stacked in a two-thirds column. */}
      <LearningProgress model={model} scopeLabel={scopeLabel} />

      {/* 5 · Who — 3-up only once each column clears ~360px */}
      <div className="grid grid-cols-1 gap-4 @3xl:grid-cols-2 @6xl:grid-cols-3 @5xl:gap-5">
        <AtRiskPanel rows={model.atRisk} />
        <ClientPerformance clients={model.clientsPerf} />
        <TrainerPerformance
          trainers={model.trainers_}
          top={model.topTrainer}
          low={model.lowTrainer}
          loading={partial && model.trainers_.length === 0}
          className="@3xl:col-span-2 @6xl:col-span-1"
        />
      </div>

      {/* Quick actions moved down out of the diagnosis row — it is navigation,
          not analysis, so it belongs after the numbers rather than beside them. */}
      <QuickActions model={model} />

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
        All figures respect the client and course filter above. Percentages show “—” where the
        underlying content does not exist, so an empty stage is never reported as 0%.
      </p>
    </div>
  );
}

export default LDDashboard;
