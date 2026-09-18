"use client";

/**
 * The report preview. Owns the document order, assigns the section letters
 * (A, B, C… over whatever is visible, so hiding a section never leaves a
 * gap), places Grade Distribution beside Sub-category Performance when both
 * are on, and hosts the restore strip for sections hidden with ×.
 *
 * Everything it renders is derived in the container; this file only lays it
 * out.
 */

import React from "react";
import { Settings2 } from "lucide-react";
import type { QuestionBreakdownRow } from "@/app/lms/pages/courses/manageUsers/reports/utils/computeStudentMarks";
import { ExecutiveSummary } from "./ExecutiveSummary";
import { LearningJourneyCompletion, LearningPerformance } from "./LearningPathway";
import { GradeDistribution } from "./GradeDistribution";
import { SubcategoryPerformance } from "./SubcategoryPerformance";
import { CoursesTable } from "./CoursesTable";
import { LearnerRoster } from "./LearnerRoster";
import { AssessmentDetail } from "./AssessmentDetail";
import {
    CANVAS_ORDER,
    viewMeta,
    type ActivityStat,
    type PerformanceStat,
    type CatalogueEx,
    type ColKey,
    type COLUMNS,
    type ExRoster,
    type GradeSlice,
    type PerfCourseRow,
    type QColKey,
    type StatsStrip,
    type SubcatBar,
    type SumColKey,
    type ViewKey,
    type WorkingRow,
} from "../model";

export interface ReportCanvasProps {
    shouldShow: (k: ViewKey) => boolean;
    removed: Set<ViewKey>;
    onRestore: (k: ViewKey) => void;
    onRemove: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;

    courseName?: string;
    scopeLine: string;
    gradeLine: string;
    /** When the host page draws its own report title (e.g. the standalone
     *  Reports page's DesignerHeader replacement), the canvas skips its
     *  internal "Learner Progress & Performance Report" / scope line so
     *  the two don't duplicate each other. Defaults to true. */
    showTitleBlock?: boolean;

    workingRows: WorkingRow[];
    stats: StatsStrip;
    activitySplit: ActivityStat[];
    performanceSplit: PerformanceStat[];
    gradeSlices: GradeSlice[];
    subcatBars: SubcatBar[];
    courseRows: PerfCourseRow[];
    activeCols: (typeof COLUMNS)[number][];
    cellText: (r: WorkingRow, c: ColKey) => string;

    courseId?: string;
    courseLoading: boolean;
    catalogue: CatalogueEx[];
    exerciseRosters: ExRoster[];
    sumCols: Set<SumColKey>;
    qCols: Set<QColKey>;
    detailed: boolean;
    onDetailed: (v: boolean) => void;
    expanded: Set<string>;
    onToggleExpanded: (exId: string, pid: string) => void;
    breakdowns: Map<string, QuestionBreakdownRow[]>;
    onJumpToDrilldown: () => void;
}

export function ReportCanvas(p: ReportCanvasProps) {
    const visible = CANVAS_ORDER.filter(p.shouldShow);
    // Paired-column layouts. Learning Journey + Learning Performance sit
    // side-by-side on wide viewports so the L&D-Head reads "how much" and
    // "how well" as one spread. Learner Results + Activity Performance
    // share their own row for the same reason.
    const pairJourney = p.shouldShow("activities") && p.shouldShow("activitiesPerformance");
    const pair = p.shouldShow("gradePie") && p.shouldShow("subcatBars");
    // Old A./B./C. letter prefix removed 2026-09-04 — SectionFrame now
    // ignores the `letter` prop, so passing an empty string keeps the
    // interface stable without rendering the prefix.
    const L = (_k: ViewKey) => "";
    const total = p.workingRows.length;

    return (
        <div className="flex min-w-0 flex-1 flex-col bg-surface">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                {/* Report header — title plus a single compact scope line.
                    Skipped when the host draws its own title block (e.g.
                    the standalone Reports page passes `showTitleBlock=false`
                    because its page header already carries the title +
                    scope). */}
                {p.showTitleBlock !== false ? (
                    <div className="mb-4">
                        <h2 className="text-[18px] font-bold leading-tight tracking-[-0.015em] text-heading">Learner Progress &amp; Performance Report</h2>
                        <p className="mt-1 truncate text-[11.5px] text-subtle">
                            {p.scopeLine} · {p.gradeLine}
                        </p>
                    </div>
                ) : null}

                {/* Restore strip: sections hidden with × can be brought back here. */}
                {p.removed.size > 0 ? (
                    <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-control border border-dashed border-hairline bg-surface-sunken/40 px-3 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Hidden</span>
                        {[...p.removed].map((k) => (
                            <button
                                key={k}
                                type="button"
                                onClick={() => p.onRestore(k)}
                                title="Restore section"
                                className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface px-2 py-0.5 text-[10.5px] font-medium text-body transition-colors hover:border-brand-500 hover:text-brand-strong"
                            >
                                + {viewMeta(k).label}
                            </button>
                        ))}
                    </div>
                ) : null}

                {visible.length === 0 ? (
                    <div className="flex h-[60%] flex-col items-center justify-center gap-2 text-center">
                        <Settings2 className="h-8 w-8 text-faint" aria-hidden />
                        <p className="text-sm font-medium text-body">Nothing on the canvas yet</p>
                        <p className="text-xs text-subtle">Tick at least one section under 6. Include in Report.</p>
                    </div>
                ) : total === 0 ? (
                    <div className="flex h-[60%] flex-col items-center justify-center gap-1 text-center">
                        <p className="text-sm font-medium text-body">No learners match the selected filters.</p>
                        <p className="text-xs text-subtle">Loosen a learner, grade or stage choice in the drawer.</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {p.shouldShow("stats") ? (
                            <ExecutiveSummary letter={L("stats")} stats={p.stats} onRemove={p.onRemove} registerRef={p.registerRef} />
                        ) : null}

                        {/* Paired: Learning Journey — Completion + Learning
                            Performance. Side-by-side on wide viewports so
                            "how much" and "how well" sit as one spread;
                            stacks on narrow. Each renders alone when its
                            sibling is unticked. */}
                        {pairJourney ? (
                            <div className="grid gap-3 xl:grid-cols-2">
                                <LearningJourneyCompletion letter={L("activities")} activitySplit={p.activitySplit} onRemove={p.onRemove} registerRef={p.registerRef} />
                                <LearningPerformance letter={L("activitiesPerformance")} performanceSplit={p.performanceSplit} onRemove={p.onRemove} registerRef={p.registerRef} />
                            </div>
                        ) : (
                            <>
                                {p.shouldShow("activities") ? (
                                    <LearningJourneyCompletion letter={L("activities")} activitySplit={p.activitySplit} onRemove={p.onRemove} registerRef={p.registerRef} />
                                ) : null}
                                {p.shouldShow("activitiesPerformance") ? (
                                    <LearningPerformance letter={L("activitiesPerformance")} performanceSplit={p.performanceSplit} onRemove={p.onRemove} registerRef={p.registerRef} />
                                ) : null}
                            </>
                        )}

                        {pair ? (
                            <div className="grid gap-3 xl:grid-cols-[42fr_58fr]">
                                <GradeDistribution letter={L("gradePie")} slices={p.gradeSlices} total={total} onRemove={p.onRemove} registerRef={p.registerRef} />
                                <SubcategoryPerformance letter={L("subcatBars")} bars={p.subcatBars} onRemove={p.onRemove} registerRef={p.registerRef} />
                            </div>
                        ) : (
                            <>
                                {p.shouldShow("gradePie") ? (
                                    <GradeDistribution letter={L("gradePie")} slices={p.gradeSlices} total={total} onRemove={p.onRemove} registerRef={p.registerRef} />
                                ) : null}
                                {p.shouldShow("subcatBars") ? (
                                    <SubcategoryPerformance letter={L("subcatBars")} bars={p.subcatBars} onRemove={p.onRemove} registerRef={p.registerRef} />
                                ) : null}
                            </>
                        )}

                        {p.shouldShow("courses") ? (
                            <CoursesTable letter={L("courses")} rows={p.courseRows} onRemove={p.onRemove} registerRef={p.registerRef} />
                        ) : null}

                        {p.shouldShow("roster") ? (
                            <LearnerRoster letter={L("roster")} rows={p.workingRows} activeCols={p.activeCols} cellText={p.cellText} onRemove={p.onRemove} registerRef={p.registerRef} />
                        ) : null}

                        {p.shouldShow("exerciseDetail") ? (
                            <AssessmentDetail
                                letter={L("exerciseDetail")}
                                courseId={p.courseId}
                                loading={p.courseLoading}
                                catalogue={p.catalogue}
                                rosters={p.exerciseRosters}
                                students={total}
                                sumCols={p.sumCols}
                                qCols={p.qCols}
                                detailed={p.detailed}
                                onDetailed={p.onDetailed}
                                expanded={p.expanded}
                                onToggleExpanded={p.onToggleExpanded}
                                breakdowns={p.breakdowns}
                                onChangeSelection={p.onJumpToDrilldown}
                                onRemove={p.onRemove}
                                registerRef={p.registerRef}
                            />
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ReportCanvas;
