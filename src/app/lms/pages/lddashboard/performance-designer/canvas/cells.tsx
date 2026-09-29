"use client";

/**
 * Cell renderers shared by the canvas tables. `renderSumCell` and
 * `renderQCell` are moved verbatim from the modal; `GradePill` is the roster's
 * grade badge, pulled out so the roster and the summary can share it.
 */

import React from "react";
import type { QuestionBreakdownRow } from "@/app/lms/pages/courses/manageUsers/reports/utils/computeStudentMarks";
import {
    fmtDateT,
    fmtTime,
    gradeColor,
    gradeLabel,
    Q_STATUS_LABEL,
    Q_STATUS_TONE,
    type ExRosterRow,
    type GradeKey,
    type QColKey,
    type SumColKey,
} from "../model";

export function GradePill({ grade }: { grade: GradeKey }) {
    const color = gradeColor(grade);
    return (
        <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
            style={{ background: `${color}17`, color }}
        >
            {gradeLabel(grade)}
        </span>
    );
}

// Per-exercise summary-cell renderer.
export function renderSumCell(r: ExRosterRow, k: SumColKey): React.ReactNode {
    switch (k) {
        case "totalQ":
            return r.totalQuestions;
        case "completed":
            return <span className="font-semibold text-success-500">{r.completed}</span>;
        case "nonCompleted":
            return <span className="font-semibold text-warn-500">{r.nonCompleted}</span>;
        case "testStatus": {
            const meta =
                r.testStatus === "submitted"
                    ? { label: "Submitted", cls: "bg-success-500/15 text-success-500" }
                    : r.testStatus === "started"
                        ? { label: "Started", cls: "bg-warn-500/15 text-warn-500" }
                        : { label: "Not Started", cls: "bg-subtle/15 text-subtle" };
            return (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${meta.cls}`}>
                    {meta.label}
                </span>
            );
        }
        case "totalMarks":
            return r.totalMarks > 0 ? r.totalMarks : "—";
        case "scoredMarks":
            return typeof r.scoredMarks === "number" ? (
                <span className="font-semibold text-success-500">{r.scoredMarks}</span>
            ) : (
                <span className="text-faint">—</span>
            );
        case "percentage":
            if (r.percentage === null) return <span className="text-faint">—</span>;
            {
                const pctv = r.percentage;
                const cls =
                    pctv >= 80
                        ? "text-success-500"
                        : pctv >= 50
                            ? "text-warn-500"
                            : "text-danger-500";
                return <span className={`font-semibold ${cls}`}>{pctv}%</span>;
            }
        case "scale":
            return r.scale ? (
                <span className="inline-flex items-center rounded-full bg-brand-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-brand-strong">
                    {r.scale}
                </span>
            ) : (
                <span className="text-faint">—</span>
            );
        default:
            return "";
    }
}

export function renderQCell(q: QuestionBreakdownRow, k: QColKey): React.ReactNode {
    switch (k) {
        case "qno":
            return q.questionNo;
        case "title":
            return (
                <span className="text-body" title={q.title}>
                    {q.title || "—"}
                </span>
            );
        case "type":
            return <span className="uppercase tracking-wide text-subtle">{q.type || "—"}</span>;
        case "status":
            return (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${Q_STATUS_TONE[q.status]}`}>
                    {Q_STATUS_LABEL[q.status]}
                </span>
            );
        case "totalMark":
            return q.totalMark;
        case "scoredMark":
            if (q.status === "pending" || q.status === "not_answered") return <span className="text-faint">—</span>;
            {
                const cls =
                    q.scoredMark === q.totalMark
                        ? "text-success-500"
                        : q.scoredMark === 0
                            ? "text-danger-500"
                            : "text-warn-500";
                return <span className={`font-semibold ${cls}`}>{q.scoredMark}</span>;
            }
        case "submittedAt":
            return <span className="whitespace-nowrap">{fmtDateT(q.submittedAt)}</span>;
        case "timeTaken":
            return <span className="whitespace-nowrap">{fmtTime(q.timeTakenSeconds)}</span>;
        default:
            return "";
    }
}

/** Table header cell — one style for every table on the canvas. */
export const TH = "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline whitespace-nowrap";
export const TD = "px-3 py-1.5 text-[11.5px] text-body";
