"use client";

/**
 * The Learning Journey / Learning Performance pair — the report's
 * centrepiece. Split 2026-09-04 from the old single "Learning Pathway"
 * section into two paired sections so completion and performance can
 * never be confused:
 *
 *   Learning Journey     How much of each stage's activities the learners
 *                        completed. Reads `ActivityStat.avg` (a per-stage
 *                        COMPLETION percentage).
 *
 *   Learning Performance How WELL learners scored on the score-based
 *                        activities in each stage. Reads
 *                        `PerformanceStat.avg` (a per-stage score-weighted
 *                        percentage). Stages with no score-based bucket
 *                        show "N/A" instead of a misleading 0%.
 *
 * The two sections render an identical simple 0–100% vertical bar chart —
 * three bars, stage name under each, percentage over each — so the
 * L&D-Head sees "how much" and "how well" as one spread. The old icons,
 * role descriptors, insight banner and paragraph footnotes were dropped
 * per the redesign brief: the chart title, values and axis labels
 * explain the meaning on their own. A single-line "Biggest drop: … · N
 * pts" note appears under the Completion chart when there is one; that
 * is the whole insight, no banner card.
 *
 * PDF export: each section renders a matching off-screen SVG carrying a
 * unique `data-export-chart` slug so the container's `svgToPng` picks up
 * the exact chart the reader sees, not a stand-in.
 */

import React from "react";
import { SectionFrame, CanvasEmpty } from "./SectionFrame";
import {
    biggestStageGap,
    stageColor,
    type ActivityStat,
    type PerformanceStat,
    type ViewKey,
} from "../model";

type Row = {
    key: ActivityStat["key"];
    label: string;
    avg: number | null;
    color: string;
    learners: number;
};

// ─── Shared 3-stage clustered column chart ────────────────────────────────────
// Matches the L&D-Head mockup: a proper column chart with a 0–100 Y-axis,
// dashed grid lines at 25/50/75/100, and three thick vertical columns for
// I Do / We Do / You Do. The label above each column carries the value
// (bold orange) so a small percentage stays instantly readable.
//
// Two rules make small values still land as PROPER BARS, not slivers:
//   1. Non-zero values get a MIN_BAR_PX floor — a 2% column can't render
//      shorter than the eye can find. The percentage above it still
//      reads the true value; only the visual height is nudged up.
//   2. N/A stages render a NEUTRAL DASHED PLACEHOLDER column at a
//      fixed neutral height with the label "N/A" above — the reader
//      sees the stage exists but no measurement applies, and the
//      dashed style is unmistakably different from a filled orange bar.
//
// Brand orange is the accent for every filled column, matching the
// L&D-Head mockup's "clean orange columns" style instead of per-stage
// grade-band colors (grade colouring lives on the roster and the donut).
const CHART_H = 220;                 // plot area, px
const MIN_BAR_PX = 12;               // min visible height for a non-zero bar
const NA_PLACEHOLDER_PX = 44;        // fixed neutral column height for N/A
const BAR_FILL = "#F97316";          // brand orange (matches the mockup)
const BAR_TINT = "rgba(249, 115, 22, 0.10)";

function StageColumns({ rows }: { rows: Row[] }) {
    return (
        <div className="rounded-control bg-surface px-3 pt-3 pb-2">
            <div className="relative" style={{ height: CHART_H + 44 }}>
                {/* Plot area — 0..100 with dashed grid lines at 25/50/75/100.
                    Sits above the 44-px space at the bottom reserved for
                    the stage label under each column. */}
                <div className="absolute left-8 right-2 top-2" style={{ height: CHART_H }}>
                    {[100, 75, 50, 25].map((v) => (
                        <div
                            key={v}
                            className="absolute inset-x-0 flex items-center"
                            style={{ bottom: `${v}%`, transform: "translateY(50%)" }}
                        >
                            <span className="absolute -left-8 w-6 text-right text-[10px] tabular-nums text-faint">{v}</span>
                            <span className="h-px flex-1" style={{ backgroundImage: "linear-gradient(to right, #E4E7EC 50%, transparent 0)", backgroundSize: "6px 1px", backgroundRepeat: "repeat-x" }} />
                        </div>
                    ))}
                    {/* Solid baseline at 0 */}
                    <div className="absolute inset-x-0 bottom-0 flex items-center">
                        <span className="absolute -left-8 w-6 text-right text-[10px] tabular-nums text-faint">0</span>
                        <span className="h-px flex-1 bg-hairline" />
                    </div>
                    {/* Bars */}
                    <div className="absolute inset-0 flex items-end justify-around">
                        {rows.map((r) => {
                            const na = r.avg === null;
                            const rawH = na ? 0 : Math.max(0, Math.min(100, r.avg as number)) / 100 * CHART_H;
                            // MIN_BAR_PX floor: a 2 % bar would render at
                            // ~4 px otherwise, which reads as "empty". The
                            // number above still shows the true value.
                            const h = na ? NA_PLACEHOLDER_PX : Math.max(MIN_BAR_PX, rawH);
                            return (
                                <div key={r.key} className="flex flex-col items-center" style={{ width: 88 }}>
                                    <span
                                        className={`mb-1 text-[13px] font-bold leading-none tabular-nums ${na ? "text-faint" : ""}`}
                                        style={na ? undefined : { color: BAR_FILL }}
                                    >
                                        {na ? "N/A" : `${r.avg}%`}
                                    </span>
                                    {na ? (
                                        // Dashed neutral placeholder — visible
                                        // presence, unmistakably NOT a filled
                                        // bar and NOT a zero bar.
                                        <div
                                            className="w-full rounded-t-md border-2 border-dashed"
                                            style={{
                                                height: h,
                                                borderColor: "#D0D5DD",
                                                borderBottomStyle: "none",
                                                background: "repeating-linear-gradient(45deg, #F2F4F7, #F2F4F7 4px, #FFFFFF 4px, #FFFFFF 8px)",
                                            }}
                                            aria-hidden
                                        />
                                    ) : (
                                        <div
                                            className="w-full rounded-t-md"
                                            style={{
                                                height: h,
                                                background: BAR_TINT,
                                                borderTop: `3px solid ${BAR_FILL}`,
                                                boxShadow: `inset 0 -${h}px 0 0 ${BAR_FILL}`,
                                            }}
                                            aria-hidden
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
                {/* Stage labels under each column */}
                <div className="absolute inset-x-0 flex justify-around pl-8 pr-2" style={{ bottom: 8 }}>
                    {rows.map((r) => (
                        <div key={r.key} className="text-center" style={{ width: 88 }}>
                            <p className="text-[12px] font-semibold text-heading">{r.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const toRows = (
    split: (ActivityStat | PerformanceStat)[],
): Row[] =>
    split.map((a) => ({
        key: a.key,
        label: a.label,
        avg: a.avg,
        color: stageColor(a.avg),
        learners: a.learners,
    }));

// ─── Learning Journey (Completion) ────────────────────────────────────────────
export function LearningJourneyCompletion({
    letter,
    activitySplit,
    onRemove,
    registerRef,
}: {
    letter: string;
    activitySplit: ActivityStat[];
    onRemove: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;
}) {
    const measured = activitySplit.some((a) => a.avg !== null);
    const rows = toRows(activitySplit);
    const gap = biggestStageGap(activitySplit);
    return (
        <SectionFrame
            id="activities"
            letter={letter}
            title="Learning Journey"
            aside={<span>Stage completion</span>}
            onRemove={onRemove}
            registerRef={registerRef}
        >
            {!measured ? (
                <CanvasEmpty>No activity progress in the current selection.</CanvasEmpty>
            ) : (
                <div className="flex flex-col gap-2">
                    <StageColumns rows={rows} />
                    {gap.kind === "drop" ? (
                        <p className="pl-1 text-[10.5px] tabular-nums text-warn-700 dark:text-warn-500">
                            Biggest drop: {gap.label} · {Math.abs(gap.delta)} pts
                        </p>
                    ) : null}
                    <StageExportSvg slug="activities" rows={rows} />
                </div>
            )}
        </SectionFrame>
    );
}

// ─── Learning Performance ─────────────────────────────────────────────────────
export function LearningPerformance({
    letter,
    performanceSplit,
    onRemove,
    registerRef,
}: {
    letter: string;
    performanceSplit: PerformanceStat[];
    onRemove: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;
}) {
    const measured = performanceSplit.some((a) => a.avg !== null);
    const rows = toRows(performanceSplit);
    return (
        <SectionFrame
            id="activitiesPerformance"
            letter={letter}
            title="Learning Performance"
            aside={<span>Stage score</span>}
            onRemove={onRemove}
            registerRef={registerRef}
        >
            {!measured ? (
                <CanvasEmpty>No score-based evaluation in the current selection.</CanvasEmpty>
            ) : (
                <div className="flex flex-col gap-2">
                    <StageColumns rows={rows} />
                    <StageExportSvg slug="activitiesPerformance" rows={rows} />
                </div>
            )}
        </SectionFrame>
    );
}

/**
 * Export-only rendition — a clustered column chart that mirrors the
 * on-screen version. Fixed hex colours and system fonts on purpose: the
 * PDF rasteriser serialises this SVG into an <img>, where neither the
 * page's stylesheet nor its CSS variables exist. Positioned off-canvas
 * rather than `display:none` so it still has a bounding box to size the
 * PNG from.
 */
function StageExportSvg({ slug, rows }: { slug: string; rows: Row[] }) {
    const W = 720;
    const H = 300;
    const pad = { l: 44, r: 20, t: 30, b: 46 };
    const plotH = H - pad.t - pad.b;
    const plotW = W - pad.l - pad.r;
    const colW = 96;
    const step = plotW / rows.length;
    const MIN_H = 14;
    const NA_H = 60;
    const ORANGE = "#F97316";
    return (
        <svg
            data-export-chart={slug}
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            aria-hidden
            style={{ position: "absolute", left: -10000, top: 0, pointerEvents: "none" }}
        >
            <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
            <defs>
                <pattern id={`hash-${slug}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="4" height="8" fill="#F2F4F7" />
                    <rect x="4" width="4" height="8" fill="#FFFFFF" />
                </pattern>
            </defs>
            {/* Dashed grid at 25/50/75/100; solid baseline at 0 */}
            {[100, 75, 50, 25].map((v) => {
                const y = pad.t + (plotH * (100 - v)) / 100;
                return (
                    <g key={v}>
                        <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#E4E7EC" strokeWidth={1} strokeDasharray="3 4" />
                        <text x={pad.l - 8} y={y + 3} textAnchor="end" fontFamily="Helvetica, Arial, sans-serif" fontSize={10} fill="#98A2B3">{v}</text>
                    </g>
                );
            })}
            <line x1={pad.l} y1={pad.t + plotH} x2={W - pad.r} y2={pad.t + plotH} stroke="#D0D5DD" strokeWidth={1} />
            <text x={pad.l - 8} y={pad.t + plotH + 3} textAnchor="end" fontFamily="Helvetica, Arial, sans-serif" fontSize={10} fill="#98A2B3">0</text>
            {/* Columns */}
            {rows.map((r, i) => {
                const cx = pad.l + step * i + step / 2;
                const x = cx - colW / 2;
                const na = r.avg === null;
                const raw = na ? 0 : (plotH * Math.max(0, Math.min(100, r.avg as number))) / 100;
                const h = na ? NA_H : Math.max(MIN_H, raw);
                const y = pad.t + plotH - h;
                return (
                    <g key={r.key}>
                        <text x={cx} y={y - 8} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={13} fontWeight={700} fill={na ? "#98A2B3" : ORANGE}>
                            {na ? "N/A" : `${r.avg}%`}
                        </text>
                        {na ? (
                            <rect x={x} y={y} width={colW} height={h} fill={`url(#hash-${slug})`} stroke="#D0D5DD" strokeWidth={2} strokeDasharray="4 3" rx={4} />
                        ) : (
                            <rect x={x} y={y} width={colW} height={h} fill={ORANGE} rx={4} />
                        )}
                        <text x={cx} y={pad.t + plotH + 22} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={12} fontWeight={700} fill="#101828">
                            {r.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

// Legacy export — kept so any stale importer still compiles. Points at the
// completion section (its historic behaviour); the paired Performance card
// is exported alongside.
export { LearningJourneyCompletion as LearningPathway };

export default LearningJourneyCompletion;
