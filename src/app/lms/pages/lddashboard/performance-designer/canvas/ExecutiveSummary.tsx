"use client";

/**
 * Summary — a single compact metric strip.
 *
 * Simplified 2026-09-04 to match the L&D-Head redesign brief: the old
 * grid of colored KPI cards read as another dashboard, not a report.
 * The five values now sit in one horizontal row separated by hairlines,
 * so the reader takes them in as one thought (headcount → completion →
 * performance → risk) before moving on to the charts below.
 *
 *   Learners             total learners in scope
 *   Average Completion   overall picked % (falls back to overall %)
 *   Average Score        marks-weighted score (N/A when no score-based
 *                        activity is in scope — never 0%)
 *   At Risk              learners with picked % between 1 and 39
 *   Not Started          learners with picked % of 0
 *
 * There is no period-over-period delta: the analytics payload is a
 * snapshot with no history, so the strip stops at the value.
 */

import React from "react";
import { SectionFrame } from "./SectionFrame";
import { type StatsStrip, type ViewKey } from "../model";

export function ExecutiveSummary({
    letter,
    stats,
    onRemove,
    registerRef,
}: {
    letter: string;
    stats: StatsStrip;
    onRemove: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;
}) {
    // Prefer the picked % for "Average Completion" — that's the number
    // the drawer's stage + activity choices decide. Falls back to the
    // flat overall % when the selection has no completion signal (mostly
    // during first paint before workingRows populate).
    const avgCompletion = stats.avgSelected ?? stats.avgOverall;
    return (
        <SectionFrame
            id="stats"
            letter={letter}
            title="Summary"
            onRemove={onRemove}
            registerRef={registerRef}
        >
            <dl className="grid grid-cols-2 divide-x divide-hairline rounded-control border border-hairline bg-surface-sunken/30 md:grid-cols-5">
                <Metric label="Learners" value={String(stats.total)} />
                <Metric label="Average Completion" value={`${avgCompletion}%`} />
                <Metric
                    label="Average Score"
                    value={stats.avgScore === null ? "N/A" : `${stats.avgScore}%`}
                    muted={stats.avgScore === null}
                />
                <Metric label="At Risk" value={String(stats.atRisk)} tone="danger" />
                <Metric label="Not Started" value={String(stats.notStarted)} muted />
            </dl>
        </SectionFrame>
    );
}

function Metric({
    label,
    value,
    muted,
    tone,
}: {
    label: string;
    value: string;
    muted?: boolean;
    tone?: "danger";
}) {
    const valueCls = tone === "danger"
        ? "text-danger-700"
        : muted
            ? "text-faint"
            : "text-heading";
    return (
        <div className="flex flex-col gap-0.5 px-4 py-3">
            <dt className="text-[10.5px] font-medium uppercase tracking-wider text-subtle">{label}</dt>
            <dd className={`text-[22px] font-bold leading-none tracking-[-0.02em] tabular-nums ${valueCls}`}>{value}</dd>
        </div>
    );
}

export default ExecutiveSummary;
