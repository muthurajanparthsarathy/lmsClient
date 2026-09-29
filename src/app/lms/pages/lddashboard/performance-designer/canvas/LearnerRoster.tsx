"use client";

/**
 * E. Learner Roster — the configured columns over the surviving learners.
 *
 * The preview shows the first PREVIEW_ROWS and offers "View full roster";
 * that is a screen optimisation only — the Excel and PDF exports iterate
 * `workingRows` in full regardless of what is expanded here.
 */

import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { SectionFrame, CanvasEmpty } from "./SectionFrame";
import { GradePill, TD, TH } from "./cells";
import type { ColKey, COLUMNS, ViewKey, WorkingRow } from "../model";

const PREVIEW_ROWS = 5;

export function LearnerRoster({
    letter,
    rows,
    activeCols,
    cellText,
    onRemove,
    registerRef,
}: {
    letter: string;
    rows: WorkingRow[];
    activeCols: (typeof COLUMNS)[number][];
    cellText: (r: WorkingRow, c: ColKey) => string;
    onRemove: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;
}) {
    const [all, setAll] = useState(false);
    const shown = all ? rows : rows.slice(0, PREVIEW_ROWS);
    const more = rows.length - shown.length;

    return (
        <SectionFrame
            id="roster"
            letter={letter}
            title="Learners"
            aside={
                <span className="tabular-nums">
                    {all || rows.length <= PREVIEW_ROWS ? `${rows.length} learner${rows.length === 1 ? "" : "s"}` : `Top ${shown.length} of ${rows.length}`} · {activeCols.length + 1} columns
                </span>
            }
            onRemove={onRemove}
            registerRef={registerRef}
            bodyClassName="px-0 pb-0"
        >
            {rows.length === 0 ? (
                <div className="px-4 pb-4"><CanvasEmpty>No learners match the selected filters.</CanvasEmpty></div>
            ) : (
                <>
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={`${TH} w-9 text-left`}>#</th>
                                    <th className={`${TH} text-left`}>Student</th>
                                    {activeCols.map((c) => (
                                        <th key={c.key} className={`${TH} ${c.r ? "text-right" : "text-left"}`}>{c.label}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((r, i) => (
                                    <tr key={`${r.pid}-${r.courseId}`} className="h-[34px] border-b border-hairline last:border-0 hover:bg-row-hover">
                                        <td className={`${TD} text-[10px] tabular-nums text-faint`}>{String(i + 1).padStart(2, "0")}</td>
                                        <td className={`${TD} font-semibold text-heading`}>
                                            <span className="block max-w-[220px] truncate">{r.name}</span>
                                        </td>
                                        {activeCols.map((c) => (
                                            <td key={c.key} className={`${TD} ${c.r ? "text-right tabular-nums" : ""}`}>
                                                {c.key === "grade" ? <GradePill grade={r.grade} /> : c.key === "email" ? <span className="block max-w-[240px] truncate text-subtle">{cellText(r, c.key)}</span> : cellText(r, c.key)}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {rows.length > PREVIEW_ROWS ? (
                        <div className="border-t border-hairline px-4 py-2 text-center">
                            <button
                                type="button"
                                onClick={() => setAll((v) => !v)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-strong hover:underline"
                            >
                                {all ? (
                                    <>Show top {PREVIEW_ROWS} <ChevronUp className="h-3.5 w-3.5" aria-hidden /></>
                                ) : (
                                    <>View full roster ({rows.length} learners{more ? `, ${more} more` : ""}) <ChevronDown className="h-3.5 w-3.5" aria-hidden /></>
                                )}
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </SectionFrame>
    );
}

export default LearnerRoster;
