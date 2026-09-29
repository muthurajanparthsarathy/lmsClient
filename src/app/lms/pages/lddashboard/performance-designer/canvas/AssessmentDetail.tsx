"use client";

/**
 * F. Assignment / Assessment Detail — one card per selected exercise, each
 * with its roll-up strip and a roster of the configured summary columns.
 * The Summary / Detailed segmented control is bound to the SAME `detailed`
 * state as the drawer toggle; in Detailed mode a row expands into the
 * per-question table, which is computed only for expanded rows.
 */

import React from "react";
import { ChevronDown, ChevronRight, Loader2, Lock } from "lucide-react";
import type { QuestionBreakdownRow } from "@/app/lms/pages/courses/manageUsers/reports/utils/computeStudentMarks";
import { SectionFrame, CanvasEmpty } from "./SectionFrame";
import { renderQCell, renderSumCell, TD, TH } from "./cells";
import { Q_COLS, SUM_COLS, type CatalogueEx, type ExRoster, type QColKey, type SumColKey, type ViewKey } from "../model";

export function AssessmentDetail({
    letter,
    courseId,
    loading,
    catalogue,
    rosters,
    students,
    sumCols,
    qCols,
    detailed,
    onDetailed,
    expanded,
    onToggleExpanded,
    breakdowns,
    onChangeSelection,
    onRemove,
    registerRef,
}: {
    letter: string;
    courseId?: string;
    loading: boolean;
    catalogue: CatalogueEx[];
    rosters: ExRoster[];
    students: number;
    sumCols: Set<SumColKey>;
    qCols: Set<QColKey>;
    detailed: boolean;
    onDetailed: (v: boolean) => void;
    expanded: Set<string>;
    onToggleExpanded: (exId: string, pid: string) => void;
    breakdowns: Map<string, QuestionBreakdownRow[]>;
    onChangeSelection: () => void;
    onRemove: (k: ViewKey) => void;
    registerRef: (k: ViewKey, el: HTMLElement | null) => void;
}) {
    const activeSum = SUM_COLS.filter((c) => sumCols.has(c.key));
    const activeQ = Q_COLS.filter((c) => qCols.has(c.key));
    const names = rosters.map((r) => r.ex.name);

    return (
        <SectionFrame
            id="exerciseDetail"
            letter={letter}
            title="Assignments & Assessments"
            aside={
                courseId && rosters.length > 0 ? (
                    <>
                        <span className="hidden min-w-0 items-center gap-1.5 md:inline-flex">
                            <span className="text-faint">Selected item{names.length === 1 ? "" : "s"}:</span>
                            <span className="max-w-[260px] truncate font-medium text-body" title={names.join(", ")}>{names.join(", ")}</span>
                            <button type="button" onClick={onChangeSelection} className="font-semibold text-brand-strong hover:underline">Change</button>
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span className="text-faint">View:</span>
                            <span className="inline-flex rounded-chip border border-hairline bg-surface-sunken/60 p-0.5" role="group" aria-label="Detail level">
                                {(["Summary", "Detailed"] as const).map((m) => {
                                    const on = (m === "Detailed") === detailed;
                                    return (
                                        <button
                                            key={m}
                                            type="button"
                                            aria-pressed={on}
                                            onClick={() => onDetailed(m === "Detailed")}
                                            className={`rounded-[6px] px-2 py-0.5 text-[10.5px] font-semibold transition-colors ${on ? "bg-surface text-brand-strong shadow-xs" : "text-subtle hover:text-body"}`}
                                        >
                                            {m}
                                        </button>
                                    );
                                })}
                            </span>
                        </span>
                    </>
                ) : (
                    <span className="tabular-nums">{students} student{students === 1 ? "" : "s"} in scope</span>
                )
            }
            onRemove={onRemove}
            registerRef={registerRef}
        >
            {!courseId ? (
                <CanvasEmpty>
                    <span className="inline-flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" aria-hidden /> Select one course to view assignment and assessment details.</span>
                </CanvasEmpty>
            ) : loading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[11.5px] text-subtle">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading course pedagogy…
                </div>
            ) : rosters.length === 0 ? (
                <CanvasEmpty>
                    {catalogue.length === 0 ? (
                        "This course has no assignments or assessments."
                    ) : (
                        <>Pick one or more exercises in <button type="button" onClick={onChangeSelection} className="font-semibold text-brand-strong hover:underline">8. Drill-down</button> to see their detail.</>
                    )}
                </CanvasEmpty>
            ) : (
                <div className="flex flex-col gap-3">
                    {rosters.map((er) => (
                        <div key={er.ex.id} className="overflow-hidden rounded-control border border-hairline">
                            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-hairline bg-surface-sunken/40 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                    <h4 className="truncate text-[12px] font-bold text-heading">{er.ex.name}</h4>
                                    <p className="truncate text-[10px] text-subtle">
                                        {er.ex.path} · {er.ex.totalQuestions} question{er.ex.totalQuestions === 1 ? "" : "s"} · {er.ex.totalMarks} marks
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] tabular-nums text-subtle">
                                    <span>Submitted <b className="text-success-500">{er.stats.submitted}</b></span>
                                    <span>Started <b className="text-warn-500">{er.stats.started}</b></span>
                                    <span>Not started <b className="text-subtle">{er.stats.notStarted}</b></span>
                                    <span>Avg <b className="text-brand-strong">{er.stats.avgPct === null ? "—" : `${er.stats.avgPct}%`}</b></span>
                                    <span>Pass / Fail <b className="text-heading">{er.stats.passCount} / {er.stats.failCount}</b></span>
                                </div>
                            </header>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            {detailed ? <th className={`${TH} w-7`} /> : null}
                                            <th className={`${TH} w-9 text-left`}>#</th>
                                            <th className={`${TH} text-left`}>Student</th>
                                            {activeSum.map((c) => (
                                                <th key={c.key} className={`${TH} ${c.r ? "text-right" : "text-left"}`}>{c.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {er.rows.map((r, i) => {
                                            const key = `${er.ex.id}:${r.pid}`;
                                            const isOpen = expanded.has(key);
                                            const out: React.ReactNode[] = [
                                                <tr key={`${key}-sum`} className="h-[34px] border-b border-hairline last:border-0 hover:bg-row-hover">
                                                    {detailed ? (
                                                        <td className="w-7 px-1.5 py-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => onToggleExpanded(er.ex.id, r.pid)}
                                                                aria-label={isOpen ? "Collapse" : "Expand"}
                                                                aria-expanded={isOpen}
                                                                className="flex h-5 w-5 items-center justify-center rounded text-subtle transition-colors hover:bg-row-hover hover:text-heading"
                                                            >
                                                                {isOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                                                            </button>
                                                        </td>
                                                    ) : null}
                                                    <td className={`${TD} text-[10px] tabular-nums text-faint`}>{String(i + 1).padStart(2, "0")}</td>
                                                    <td className={TD}>
                                                        <div className="truncate text-[11.5px] font-semibold text-heading">{r.name}</div>
                                                        {r.email ? <div className="truncate text-[10px] text-subtle">{r.email}</div> : null}
                                                    </td>
                                                    {activeSum.map((c) => (
                                                        <td key={c.key} className={`${TD} ${c.r ? "text-right tabular-nums" : ""}`}>{renderSumCell(r, c.key)}</td>
                                                    ))}
                                                </tr>,
                                            ];
                                            if (detailed && isOpen) {
                                                const bd = breakdowns.get(key) || [];
                                                out.push(
                                                    <tr key={`${key}-detail`} className="bg-surface-sunken/30">
                                                        <td className="w-7 px-1.5" />
                                                        <td colSpan={2 + activeSum.length} className="border-b border-hairline px-3 py-2.5">
                                                            {bd.length === 0 ? (
                                                                <p className="text-[11px] text-subtle">No questions recorded for this student.</p>
                                                            ) : activeQ.length === 0 ? (
                                                                <p className="text-[11px] text-subtle">No question columns selected — enable some under 8. Drill-down → Question columns.</p>
                                                            ) : (
                                                                <div className="overflow-x-auto rounded-chip border border-hairline bg-surface">
                                                                    <table className="w-full border-collapse text-[11px]">
                                                                        <thead>
                                                                            <tr>
                                                                                {activeQ.map((qc) => (
                                                                                    <th key={qc.key} className={`${TH} ${qc.r ? "text-right" : "text-left"}`}>{qc.label}</th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {bd.map((q) => (
                                                                                <tr key={q.questionId} className="border-b border-hairline last:border-0">
                                                                                    {activeQ.map((qc) => (
                                                                                        <td key={qc.key} className={`${TD} ${qc.r ? "text-right tabular-nums" : ""}`}>{renderQCell(q, qc.key)}</td>
                                                                                    ))}
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>,
                                                );
                                            }
                                            return out;
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </SectionFrame>
    );
}

export default AssessmentDetail;
