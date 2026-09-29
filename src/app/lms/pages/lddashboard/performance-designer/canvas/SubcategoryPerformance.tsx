"use client";

/**
 * Activity Performance — one vertical column per DISCOVERED activity type
 * (Assignment, Assessment, Practical, Test Your Skills, and anything else
 * the selected courses expose). Same clustered column style as
 * Learning Journey / Learning Performance so the three chart cards read as
 * one system.
 *
 * The incoming `bars` are keyed per (stage, sub-category) — e.g.
 *   "We Do · Assignment" (avg 44, learners 60)
 *   "You Do · Assignment" (avg 32, learners 40)
 * — so we aggregate them into ONE Assignment column by taking a
 * learner-count-weighted average. That matches the reader's intent
 * ("how do learners perform in Assignments overall?") without changing
 * the container's derivation, which stays the source of truth for the
 * raw stage × sub-category signal.
 *
 * Design rules matched to StageColumns in LearningPathway.tsx:
 *   • 0–100% Y-axis with dashed grid at 25/50/75/100, solid baseline at 0
 *   • Thick evenly-spaced columns (fixed 88 px), brand-orange fill
 *   • Value printed above the column in bold orange
 *   • Activity name printed under the column
 *   • MIN_BAR_PX floor so a small % still renders as a proper column
 *   • N/A = dashed neutral placeholder (never a fake zero)
 *   • No icons, no legends, no explanatory paragraph
 *
 * PDF export: matching column SVG carries the same `data-export-chart`
 * slug so `svgToPng` picks it up.
 */

import React from "react";
import { SectionFrame, CanvasEmpty } from "./SectionFrame";
import { type SubcatBar, type ViewKey } from "../model";

const CHART_H = 220;
const MIN_BAR_PX = 12;
const NA_PLACEHOLDER_PX = 44;
const BAR_FILL = "#F97316";
const BAR_TINT = "rgba(249, 115, 22, 0.10)";

type ActivityCol = {
    key: string;
    label: string;
    avg: number | null;
    learners: number;
};

/** "We Do · Assignment" → "Assignment"; a plain label stays as-is so
 *  activity types that don't include a stage prefix (a future data change)
 *  still render sensibly. */
const activityName = (label: string): string => {
    const parts = label.split(" · ");
    return parts.length > 1 ? parts.slice(1).join(" · ") : label;
};

/** Aggregate per-stage rows into one row per activity type using a
 *  learner-count-weighted average. When no bar for an activity has a
 *  measurable value, its aggregate stays null → the column renders N/A. */
function aggregateByActivity(bars: SubcatBar[]): ActivityCol[] {
    const map = new Map<string, { sumWeighted: number; sumLearners: number; anyMeasured: boolean }>();
    for (const b of bars) {
        const name = activityName(b.label);
        const cur = map.get(name) || { sumWeighted: 0, sumLearners: 0, anyMeasured: false };
        const learners = Number.isFinite(b.learners) ? b.learners : 0;
        const avg = typeof b.avg === "number" ? b.avg : null;
        if (avg !== null && learners > 0) {
            cur.sumWeighted += avg * learners;
            cur.sumLearners += learners;
            cur.anyMeasured = true;
        }
        map.set(name, cur);
    }
    return Array.from(map.entries())
        .map(([name, agg]) => ({
            key: name,
            label: name,
            avg: agg.anyMeasured && agg.sumLearners > 0
                ? Math.round(agg.sumWeighted / agg.sumLearners)
                : null,
            learners: agg.sumLearners,
        }))
        // Stable, meaningful order: measured columns first (descending),
        // N/A columns after, alphabetical within each group. Reads as
        // "strongest → weakest → no data" so a glance answers "where are
        // learners weakest?"
        .sort((a, b) => {
            const aNA = a.avg === null;
            const bNA = b.avg === null;
            if (aNA !== bNA) return aNA ? 1 : -1;
            if (!aNA && !bNA) return (b.avg as number) - (a.avg as number);
            return a.label.localeCompare(b.label);
        });
}

// ─── The vertical column chart body ───────────────────────────────────────────
function ActivityColumns({ cols }: { cols: ActivityCol[] }) {
    // Column width shrinks a touch when many activity types are on screen,
    // so a five-column card still leaves visible gutters.
    const colW = cols.length <= 3 ? 96 : cols.length <= 4 ? 84 : 72;
    return (
        <div className="rounded-control bg-surface px-3 pt-3 pb-2">
            <div className="relative" style={{ height: CHART_H + 44 }}>
                {/* Plot area with the Y-axis grid */}
                <div className="absolute left-8 right-2 top-2" style={{ height: CHART_H }}>
                    {[100, 75, 50, 25].map((v) => (
                        <div
                            key={v}
                            className="absolute inset-x-0 flex items-center"
                            style={{ bottom: `${v}%`, transform: "translateY(50%)" }}
                        >
                            <span className="absolute -left-8 w-6 text-right text-[10px] tabular-nums text-faint">{v}</span>
                            <span
                                className="h-px flex-1"
                                style={{
                                    backgroundImage: "linear-gradient(to right, #E4E7EC 50%, transparent 0)",
                                    backgroundSize: "6px 1px",
                                    backgroundRepeat: "repeat-x",
                                }}
                            />
                        </div>
                    ))}
                    <div className="absolute inset-x-0 bottom-0 flex items-center">
                        <span className="absolute -left-8 w-6 text-right text-[10px] tabular-nums text-faint">0</span>
                        <span className="h-px flex-1 bg-hairline" />
                    </div>
                    {/* Columns */}
                    <div className="absolute inset-0 flex items-end justify-around">
                        {cols.map((c) => {
                            const na = c.avg === null;
                            const rawH = na
                                ? 0
                                : (Math.max(0, Math.min(100, c.avg as number)) / 100) * CHART_H;
                            const h = na ? NA_PLACEHOLDER_PX : Math.max(MIN_BAR_PX, rawH);
                            return (
                                <div key={c.key} className="flex flex-col items-center" style={{ width: colW }}>
                                    <span
                                        className={`mb-1 text-[13px] font-bold leading-none tabular-nums ${na ? "text-faint" : ""}`}
                                        style={na ? undefined : { color: BAR_FILL }}
                                    >
                                        {na ? "N/A" : `${c.avg}%`}
                                    </span>
                                    {na ? (
                                        <div
                                            className="w-full rounded-t-md border-2 border-dashed"
                                            style={{
                                                height: h,
                                                borderColor: "#D0D5DD",
                                                borderBottomStyle: "none",
                                                background:
                                                    "repeating-linear-gradient(45deg, #F2F4F7, #F2F4F7 4px, #FFFFFF 4px, #FFFFFF 8px)",
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
                {/* Activity name under each column */}
                <div className="absolute inset-x-0 flex justify-around pl-8 pr-2" style={{ bottom: 8 }}>
                    {cols.map((c) => (
                        <div key={c.key} className="text-center" style={{ width: colW }}>
                            <p className="truncate text-[12px] font-semibold text-heading" title={c.label}>{c.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function SubcategoryPerformance({
    letter,
    bars,
    onRemove,
    registerRef,
}: {
    letter: string;
    bars: SubcatBar[];
    onRemove: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;
}) {
    const cols = aggregateByActivity(bars);
    return (
        <SectionFrame
            id="subcatBars"
            letter={letter}
            title="Activity Performance"
            aside={<span>Score by activity type</span>}
            onRemove={onRemove}
            registerRef={registerRef}
        >
            {cols.length === 0 ? (
                <CanvasEmpty>No learning activities are available for the selected stages.</CanvasEmpty>
            ) : (
                <>
                    <ActivityColumns cols={cols} />
                    <ActivityExportSvg cols={cols} />
                </>
            )}
        </SectionFrame>
    );
}

/**
 * PDF export version — matches the on-screen chart. Fixed hex colours
 * and system fonts because the rasteriser can't see the app's stylesheet
 * or CSS variables.
 */
function ActivityExportSvg({ cols }: { cols: ActivityCol[] }) {
    const W = Math.max(720, 120 + cols.length * 110);
    const H = 300;
    const pad = { l: 44, r: 20, t: 30, b: 46 };
    const plotH = H - pad.t - pad.b;
    const plotW = W - pad.l - pad.r;
    const colW = cols.length <= 3 ? 96 : cols.length <= 4 ? 84 : 72;
    const step = plotW / cols.length;
    const MIN_H = 14;
    const NA_H = 60;
    const ORANGE = "#F97316";
    return (
        <svg
            data-export-chart="subcatBars"
            width={W}
            height={H}
            viewBox={`0 0 ${W} ${H}`}
            aria-hidden
            style={{ position: "absolute", left: -10000, top: 0, pointerEvents: "none" }}
        >
            <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
            <defs>
                <pattern id="ac-hash" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="4" height="8" fill="#F2F4F7" />
                    <rect x="4" width="4" height="8" fill="#FFFFFF" />
                </pattern>
            </defs>
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
            {cols.map((c, i) => {
                const cx = pad.l + step * i + step / 2;
                const x = cx - colW / 2;
                const na = c.avg === null;
                const raw = na ? 0 : (plotH * Math.max(0, Math.min(100, c.avg as number))) / 100;
                const h = na ? NA_H : Math.max(MIN_H, raw);
                const y = pad.t + plotH - h;
                return (
                    <g key={c.key}>
                        <text x={cx} y={y - 8} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={13} fontWeight={700} fill={na ? "#98A2B3" : ORANGE}>
                            {na ? "N/A" : `${c.avg}%`}
                        </text>
                        {na ? (
                            <rect x={x} y={y} width={colW} height={h} fill="url(#ac-hash)" stroke="#D0D5DD" strokeWidth={2} strokeDasharray="4 3" rx={4} />
                        ) : (
                            <rect x={x} y={y} width={colW} height={h} fill={ORANGE} rx={4} />
                        )}
                        <text x={cx} y={pad.t + plotH + 22} textAnchor="middle" fontFamily="Helvetica, Arial, sans-serif" fontSize={12} fontWeight={700} fill="#101828">
                            {c.label}
                        </text>
                    </g>
                );
            })}
        </svg>
    );
}

export default SubcategoryPerformance;
