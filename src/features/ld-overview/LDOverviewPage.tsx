"use client";

/**
 * L&D Overview — Reports ▸ Overview.
 *
 * ─── Reading order the page enforces ──────────────────────────────────────
 *   1. Report scope    Client → Course → Time Period (chosen first, not last)
 *   2. Headline        are learners active, progressing, completing, performing,
 *                      and how many need help
 *   3. Diagnosis       where in I Do → We Do → You Do they fall away, how
 *                      ready they are for industry, how the population splits
 *   4. Mechanism       practice at attempt level, the trajectory, the work queue
 *   5. Detail          which courses are carrying it and which are not
 *
 * Portfolio counts (12 Clients · 43 Courses · 83 Learners · 16 Trainers) were
 * removed from the top of this page in September 2026: the Dashboard already
 * shows them, and repeating them here pushed the actual report filters below
 * the fold. On a reporting page the first meaningful choice is the scope —
 * everything else waits until that has been made.
 *
 * ─── What it is NOT ────────────────────────────────────────────────────────
 * It is not a detailed report. Every card links into the console's existing
 * reports (#rep-performance, #rep-delivery, #perf-progress, #perf-results,
 * #attendance), which keep their own UI, filters, tables, pagination, sorting
 * and exports. The Overview is the way in, not a replacement.
 *
 * ─── Data ──────────────────────────────────────────────────────────────────
 * Four shared React Query entries, three of which the console already holds.
 * Client / course / period filtering happens in the derivation, so changing a
 * filter re-derives from cache and issues no request.
 */

import { useRef, type ReactNode } from "react";
import { LDO_CSS } from "./styles";
import { useLdOverview } from "./hooks/use-ld-overview";
import { OverviewHeader } from "./components/OverviewHeader";
import { KpiGrid } from "./components/KpiGrid";
import { LearningJourneyCard } from "./components/LearningJourneyCard";
import { IndustryReadinessCard } from "./components/IndustryReadinessCard";
import { LearnerDistributionCard } from "./components/LearnerDistributionCard";
import { PracticeHealthCard } from "./components/PracticeHealthCard";
import { TrainingPerformanceChart } from "./components/TrainingPerformanceChart";
import { PriorityActionsCard } from "./components/PriorityActionsCard";
import { CourseHealthTable } from "./components/CourseHealthTable";
import type { CourseHealthRow, OverviewFilter } from "./types";

export function LDOverviewPage({
  filter,
  filterControls,
  onCustomize,
  onExport,
  onOpenCourse,
}: {
  filter: OverviewFilter;
  /** Client / Course / Time Period pickers — rendered by the console so the
   *  filter state stays where the rest of the console's scope lives. The order
   *  the container ships them in is the order they render, left to right. */
  filterControls?: ReactNode;
  onCustomize: () => void;
  /** Hands the rendered overview to the console's existing print/export
   *  pipeline rather than owning a second one. */
  onExport: (html: string) => void;
  onOpenCourse?: (row: CourseHealthRow) => void;
}) {
  const { loading, error, model, partial, updatedAt, refresh } = useLdOverview(filter);
  const boxRef = useRef<HTMLDivElement>(null);

  // `null` while the primary roll-up is in flight — every card renders its own
  // skeleton from that, so the layout never reflows when the data lands.
  const m = loading ? null : model;

  return (
    <div className="ldo">
      <style>{LDO_CSS}</style>

      <OverviewHeader
        onCustomize={onCustomize}
        onExport={() => onExport(boxRef.current?.innerHTML ?? "")}
        onRefresh={refresh}
        updatedAt={updatedAt}
        busy={loading || partial}
        exportBusy={loading}
      />

      {error ? (
        <div className="ldo-err" role="alert">
          {error}. The detailed reports in the sidebar are unaffected — try Refresh, or open one of them directly.
        </div>
      ) : null}

      <div ref={boxRef} className="ldo-body">
        <div className="ldo-filters">{filterControls}</div>

        {m && !m.hasData ? (
          <div className="ldo-card">
            <div className="ldo-empty">
              <b>No training data available for the selected filters.</b>
              <span>No courses match this client and course combination.</span>
            </div>
          </div>
        ) : (
          <>
            <KpiGrid model={m} />

            {/* Diagnosis — where learners fall away, how ready they are, and
                how the population splits. */}
            <div className="ldo-row-a">
              <LearningJourneyCard model={m} />
              <IndustryReadinessCard model={m} />
              <LearnerDistributionCard model={m} />
            </div>

            {/* Mechanism — how practice is going, where it is heading, and what
                to do about it today. */}
            <div className="ldo-row-b">
              <PracticeHealthCard model={m} />
              <TrainingPerformanceChart model={m} />
              <PriorityActionsCard model={m} />
            </div>

            <CourseHealthTable model={m} onOpenCourse={onOpenCourse} />
          </>
        )}
      </div>

      <p className="ldo-kpi-c" style={{ margin: "2px 2px 0" }}>
        All figures respect the Client, Course and Time Period filters above. A metric shows “—”
        where the underlying content does not exist, so an unconfigured stage is never reported
        as 0%. Assigned Activities measures how much required work was <b>completed</b>; Average
        Score measures how <b>well</b> it was performed.
      </p>
    </div>
  );
}

export default LDOverviewPage;
