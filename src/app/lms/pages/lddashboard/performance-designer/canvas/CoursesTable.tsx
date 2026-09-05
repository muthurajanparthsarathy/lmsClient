"use client";

/**
 * Course Table — one row per course that still has learners after the
 * filters. Kept as its own optional section (it is not in the reference
 * screenshot, but it is an existing view the export supports).
 */

import React from "react";
import { SectionFrame, CanvasEmpty } from "./SectionFrame";
import { TD, TH } from "./cells";
import type { PerfCourseRow, ViewKey } from "../model";

export function CoursesTable({
    letter,
    rows,
    onRemove,
    registerRef,
}: {
    letter: string;
    rows: PerfCourseRow[];
    onRemove: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;
}) {
    return (
        <SectionFrame
            id="courses"
            letter={letter}
            title="Course Table"
            aside={<span className="tabular-nums">{rows.length} in scope</span>}
            onRemove={onRemove}
            registerRef={registerRef}
            bodyClassName="px-0 pb-0"
        >
            {rows.length === 0 ? (
                <div className="px-4 pb-4"><CanvasEmpty>No courses with learners in the current selection.</CanvasEmpty></div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                {["Course", "Client", "Students", "Avg %", "Completed", "In progress", "Not started"].map((h, i) => (
                                    <th key={h} className={`${TH} ${i > 1 ? "text-right" : "text-left"}`}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((c) => (
                                <tr key={c.id} className="h-[34px] border-b border-hairline last:border-0 hover:bg-row-hover">
                                    <td className={`${TD} font-semibold text-heading`}>{c.name}</td>
                                    <td className={TD}>{c.client}</td>
                                    <td className={`${TD} text-right tabular-nums`}>{c.students}</td>
                                    <td className={`${TD} text-right tabular-nums`}>
                                        <span className={`font-semibold ${c.avg >= 80 ? "text-success-500" : c.avg >= 40 ? "text-warn-500" : "text-danger-500"}`}>{c.avg}%</span>
                                    </td>
                                    <td className={`${TD} text-right tabular-nums`}>{c.done}</td>
                                    <td className={`${TD} text-right tabular-nums`}>{c.prog}</td>
                                    <td className={`${TD} text-right tabular-nums`}>{c.not}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </SectionFrame>
    );
}

export default CoursesTable;
