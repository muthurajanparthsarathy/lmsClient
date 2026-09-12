"use client";

/**
 * The configuration drawer — sections 1–8 in priority order, an
 * independently scrolling body, and Reset pinned at the bottom.
 *
 * Presentational: every value and setter comes from the container, so this
 * file owns no report state. It does own one piece of UI state on the
 * container's behalf: which section is currently at the top of the scroll,
 * reported through `onActiveChange` so the icon rail can light it.
 */

import React, { useCallback, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { ScopeControl } from "./controls/ScopeControl";
import { LearnerSelector } from "./controls/LearnerSelector";
import { LearningStageSelector } from "./controls/LearningStageSelector";
import { SubcategorySelector } from "./controls/SubcategorySelector";
import { GradeBandSelector } from "./controls/GradeBandSelector";
import { ReportSectionSelector } from "./controls/ReportSectionSelector";
import { RosterColumnSelector } from "./controls/RosterColumnSelector";
import { ExerciseDrilldownControl } from "./controls/ExerciseDrilldownControl";
import { DRAWER_SECTIONS, type DrawerSectionId } from "./controls/sections";
import type { CatalogueEx, ColKey, GradeKey, QColKey, Stage, SubcatOpt, SumColKey, ViewKey } from "./model";

export interface ControlsDrawerProps {
    bodyRef: React.RefObject<HTMLDivElement | null>;
    onActiveChange: (id: DrawerSectionId) => void;
    onReset: () => void;

    clientName?: string;
    courseName?: string;

    studentOpts: { id: string; name: string; sub?: string }[];
    studentSel: Set<string> | null;
    onStudentSel: (v: Set<string> | null) => void;

    activityHas: Set<Stage>;
    activities: Set<Stage>;
    onToggleActivity: (s: Stage) => void;

    subcatOpts: SubcatOpt[];
    subcats: Set<string> | null;
    onSubcats: (v: Set<string> | null) => void;

    grades: Set<GradeKey> | null;
    onGrades: (v: Set<GradeKey> | null) => void;

    views: Set<ViewKey>;
    onToggleView: (k: ViewKey) => void;
    onAllViews: () => void;

    cols: Set<ColKey>;
    onToggleCol: (k: ColKey) => void;

    courseId?: string;
    courseLoading: boolean;
    catalogue: CatalogueEx[];
    exSel: Set<string> | null;
    onExSel: (v: Set<string> | null) => void;
    detailed: boolean;
    onDetailed: (v: boolean) => void;
    sumCols: Set<SumColKey>;
    onToggleSum: (k: SumColKey) => void;
    qCols: Set<QColKey>;
    onToggleQ: (k: QColKey) => void;
}

export function ControlsDrawer(p: ControlsDrawerProps) {
    // Which section is at the top of the viewport → the rail's highlight.
    const onScroll = useCallback(() => {
        const el = p.bodyRef.current;
        if (!el) return;
        const top = el.getBoundingClientRect().top + 24;
        let current: DrawerSectionId = DRAWER_SECTIONS[0].id;
        for (const s of DRAWER_SECTIONS) {
            const node = el.querySelector<HTMLElement>(`[data-section="${s.id}"]`);
            if (!node) continue;
            if (node.getBoundingClientRect().top <= top) current = s.id;
        }
        p.onActiveChange(current);
    }, [p.bodyRef, p.onActiveChange]);

    useEffect(() => { onScroll(); }, [onScroll]);

    return (
        <aside className="flex w-[400px] min-w-0 flex-shrink-0 flex-col border-r border-hairline bg-surface-sunken/40" aria-label="Report configuration">
            <div ref={p.bodyRef} onScroll={onScroll} className="min-h-0 flex-1 divide-y divide-hairline overflow-y-auto px-5 py-2">
                <ScopeControl clientName={p.clientName} courseName={p.courseName} />
                <LearnerSelector options={p.studentOpts} sel={p.studentSel} onChange={p.onStudentSel} />
                <LearningStageSelector available={p.activityHas} selected={p.activities} onToggle={p.onToggleActivity} />
                <SubcategorySelector options={p.subcatOpts} sel={p.subcats} onChange={p.onSubcats} />
                <GradeBandSelector sel={p.grades} onChange={p.onGrades} />
                <ReportSectionSelector views={p.views} onToggle={p.onToggleView} onSelectAll={p.onAllViews} />
                <RosterColumnSelector cols={p.cols} onToggle={p.onToggleCol} enabled={p.views.has("roster")} />
                <ExerciseDrilldownControl
                    enabled={p.views.has("exerciseDetail")}
                    courseId={p.courseId}
                    loading={p.courseLoading}
                    catalogue={p.catalogue}
                    exSel={p.exSel}
                    onExSel={p.onExSel}
                    detailed={p.detailed}
                    onDetailed={p.onDetailed}
                    sumCols={p.sumCols}
                    onToggleSum={p.onToggleSum}
                    qCols={p.qCols}
                    onToggleQ={p.onToggleQ}
                />
            </div>
            <footer className="flex-shrink-0 border-t border-hairline px-5 py-2.5">
                <button
                    type="button"
                    onClick={p.onReset}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-control border border-hairline bg-surface text-[11.5px] font-semibold text-body transition-colors hover:border-hairline-strong hover:bg-row-hover"
                >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                    Reset to defaults
                </button>
            </footer>
        </aside>
    );
}

export default ControlsDrawer;
