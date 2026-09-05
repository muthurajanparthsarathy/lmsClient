"use client";

/**
 * 8. Drill-down — assignment / assessment detail.
 *
 * Locked until the page's Course filter names ONE course: the per-question
 * data rides on the heavy `/getAll/courses-data` payload, which the
 * container only requests in that case, so nothing here can trigger it.
 * Below the exercise picker: the Detailed-mode toggle, then the two column
 * groups (summary / per-question) as collapsibles — advanced settings that
 * should be reachable, not prominent.
 */

import React, { useState } from "react";
import { ChevronRight, Loader2, Lock } from "lucide-react";
import { DrawerSection } from "./DrawerSection";
import { MultiPickBox } from "../MultiPickBox";
import { Q_COLS, SUM_COLS, type CatalogueEx, type QColKey, type SumColKey } from "../model";

export function ExerciseDrilldownControl({
    enabled,
    courseId,
    loading,
    catalogue,
    exSel,
    onExSel,
    detailed,
    onDetailed,
    sumCols,
    onToggleSum,
    qCols,
    onToggleQ,
}: {
    /** The Assignment / Assessment Detail section is included in the report. */
    enabled: boolean;
    courseId?: string;
    loading: boolean;
    catalogue: CatalogueEx[];
    exSel: Set<string> | null;
    onExSel: (v: Set<string> | null) => void;
    detailed: boolean;
    onDetailed: (v: boolean) => void;
    sumCols: Set<SumColKey>;
    onToggleSum: (k: SumColKey) => void;
    qCols: Set<QColKey>;
    onToggleQ: (k: QColKey) => void;
}) {
    const unlocked = !!courseId;
    const picked = exSel === null ? catalogue.length : exSel.size;

    return (
        <DrawerSection
            id="drilldown"
            n={8}
            title="Drill-down"
            info="Assignment and assessment detail is available when one course is selected."
            disabled={!enabled}
        >
            {!unlocked ? (
                <div className="rounded-control border border-dashed border-hairline bg-surface-sunken/50 px-2.5 py-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-medium text-body">
                        <Lock className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
                        Select a single course to unlock exercise drill-down
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-faint">
                        Assignment and assessment detail is available when one course is selected.
                    </p>
                </div>
            ) : loading ? (
                <div className="flex h-9 items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-[11px] text-subtle">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading exercises…
                </div>
            ) : catalogue.length === 0 ? (
                <p className="rounded-control border border-dashed border-hairline bg-surface-sunken/50 px-2.5 py-2 text-[10.5px] text-subtle">
                    No assignments or assessments on this course.
                </p>
            ) : (
                <MultiPickBox
                    label="Exercises"
                    placeholder="Search assignments & assessments…"
                    options={catalogue.map((e) => ({
                        id: e.id,
                        name: e.name,
                        sub: `${e.subCategory} · ${e.totalQuestions} Q · ${e.totalMarks} marks`,
                    }))}
                    sel={exSel}
                    onChange={onExSel}
                    empty="No exercises match"
                    summary={(c, t) =>
                        c === 0 ? "Real exercises & assessments — pick one or more" : c === t ? `All ${t} exercises` : `${c} of ${t} exercises`
                    }
                />
            )}

            {/* Detailed mode */}
            <div className={`mt-2.5 flex items-start justify-between gap-3 ${unlocked ? "" : "opacity-50 pointer-events-none"}`}>
                <div className="min-w-0">
                    <p className="text-[11.5px] font-semibold text-heading" title="Adds per-question learner attempt details to the report.">
                        Detailed mode
                    </p>
                    <p className="text-[10.5px] text-faint">Show individual attempts and question-level data</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={detailed}
                    aria-label="Detailed mode"
                    onClick={() => onDetailed(!detailed)}
                    className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
                        detailed ? "bg-brand-500" : "bg-hairline-strong"
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${detailed ? "translate-x-[18px]" : "translate-x-0.5"}`}
                        aria-hidden
                    />
                </button>
            </div>

            {/* Advanced column groups */}
            <div className={`mt-2.5 divide-y divide-hairline rounded-control border border-hairline ${unlocked && picked > 0 ? "" : "opacity-50 pointer-events-none"}`}>
                <ColumnGroup
                    title="Summary columns"
                    hint="Student name + email are always shown"
                    count={sumCols.size}
                    total={SUM_COLS.length}
                >
                    {SUM_COLS.map((c) => (
                        <Toggle key={c.key} label={c.label} hint={c.hint} on={sumCols.has(c.key)} onChange={() => onToggleSum(c.key)} />
                    ))}
                </ColumnGroup>
                <ColumnGroup
                    title="Question columns"
                    hint={detailed ? "Shown when a learner row is expanded" : "Turn on Detailed mode to use these"}
                    count={qCols.size}
                    total={Q_COLS.length}
                    muted={!detailed}
                >
                    {Q_COLS.map((c) => (
                        <Toggle key={c.key} label={c.label} hint={c.hint} on={qCols.has(c.key)} onChange={() => onToggleQ(c.key)} />
                    ))}
                </ColumnGroup>
            </div>
        </DrawerSection>
    );
}

function ColumnGroup({
    title,
    hint,
    count,
    total,
    muted,
    children,
}: {
    title: string;
    hint: string;
    count: number;
    total: number;
    muted?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className={muted ? "opacity-60" : ""}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-row-hover"
            >
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-subtle transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
                <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold text-body">{title}</span>
                    <span className="block truncate text-[10px] text-faint">{hint}</span>
                </span>
                <span className="text-[10px] tabular-nums text-subtle">
                    {count}/{total}
                </span>
            </button>
            {open ? <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 border-t border-hairline px-2 py-1.5">{children}</div> : null}
        </div>
    );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint: string; on: boolean; onChange: () => void }) {
    return (
        <label className="flex cursor-pointer items-center gap-1.5 rounded-chip px-1 py-0.5 hover:bg-row-hover" title={hint}>
            <input
                type="checkbox"
                checked={on}
                onChange={onChange}
                className="size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <span className={`truncate text-[10.5px] font-medium ${on ? "text-body" : "text-subtle"}`}>{label}</span>
        </label>
    );
}

export default ExerciseDrilldownControl;
