"use client";

/**
 * Learner Results — a recharts donut of the surviving learners by band
 * with a count + share legend. `gradeSlices` is already filtered by the
 * drawer's grade selection (the rows were), so an unselected band reads 0.
 * Renamed 2026-09-04 from "Grade Distribution" for plain L&D language.
 *
 * The centre label is HTML over the chart; the PDF export rasterises the
 * recharts svg and redraws the legend itself, and the count table follows.
 */

import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { SectionFrame, CanvasEmpty } from "./SectionFrame";
import { GRADE_BANDS, type GradeSlice, type ViewKey } from "../model";

export function GradeDistribution({
    letter,
    slices,
    total,
    onRemove,
    registerRef,
}: {
    letter: string;
    slices: GradeSlice[];
    total: number;
    onRemove: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;
}) {
    const count = new Map(slices.map((s) => [s.key, s.value]));
    const legend = GRADE_BANDS.map((g) => ({
        key: g.key,
        label: `${g.label} (${g.range.replace(/\s/g, "")})`,
        value: count.get(g.key) ?? 0,
        color: g.color,
    }));

    return (
        <SectionFrame
            id="gradePie"
            letter={letter}
            title="Learner Results"
            aside={<span>Bands on the selected %</span>}
            onRemove={onRemove}
            registerRef={registerRef}
        >
            {slices.length === 0 ? (
                <CanvasEmpty>Nothing to grade in the current selection.</CanvasEmpty>
            ) : (
                <div className="grid grid-cols-[150px_1fr] items-center gap-3">
                    <div className="relative h-[150px] w-[150px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    dataKey="value"
                                    nameKey="name"
                                    data={slices}
                                    innerRadius={48}
                                    outerRadius={72}
                                    paddingAngle={2}
                                    stroke="none"
                                    isAnimationActive={false}
                                >
                                    {slices.map((s) => (
                                        <Cell key={s.key} fill={s.color} />
                                    ))}
                                </Pie>
                                <RTooltip
                                    formatter={((v: number, name: string) => [`${v} learner${v === 1 ? "" : "s"}`, name]) as any}
                                    contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #E4E7EC" }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[22px] font-bold leading-none tracking-[-0.03em] tabular-nums text-heading">{total}</span>
                            <span className="mt-0.5 text-[10px] text-subtle">Learners</span>
                        </div>
                    </div>
                    <ul className="min-w-0 space-y-1">
                        {legend.map((l) => (
                            <li key={l.key} className="flex items-center gap-2 text-[11px]">
                                <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: l.color }} aria-hidden />
                                <span className="min-w-0 flex-1 truncate text-body">{l.label}</span>
                                <span className="w-6 text-right font-semibold tabular-nums text-heading">{l.value}</span>
                                <span className="w-10 text-right tabular-nums text-subtle">
                                    ({total ? Math.round((l.value / total) * 100) : 0}%)
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </SectionFrame>
    );
}

export default GradeDistribution;
