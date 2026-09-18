"use client";

/**
 * Student Performance Details modal — question-level analysis for one learner.
 *
 * Opened from the "View details" action on a row of the Report Summary table.
 * Shows the same items the row was scored on, grouped by I Do / We Do / You Do,
 * with each item collapsible into a per-question table. Nothing is fabricated:
 *
 *   • We Do / You Do question-level data comes from `getStudentQuestionsBreakdown`,
 *     the same helper the L&D console's designer modal uses.
 *   • I Do question-level data comes from the raw `answers.I_Do[fileId].answers[]`
 *     records on the participant document (latest attempt per question), matched
 *     to `file.mcqQuestions[]` for the question text and total mark.
 *
 * All state is local: the modal owns which sections are expanded, and closes
 * on the backdrop click, the header ×, or Escape.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import { computeStudentMarks, getStudentQuestionsBreakdown, type QuestionBreakdownRow } from "@/app/lms/pages/courses/manageUsers/reports/utils/computeStudentMarks";
import { computeIDoMarks, type IDoFile } from "@/app/lms/pages/lddashboard/performance-designer/idoCatalogue";
import { prettySubcat, type CatalogueEx } from "@/app/lms/pages/lddashboard/performance-designer/model";

/** Row shape both branches feed into — matches `QuestionBreakdownRow` except
 *  `questionNo` is stringified (I Do rows number themselves as strings). */
interface QRow {
    questionNo: string;
    title: string;
    type: string;
    status: "evaluated" | "submitted" | "not_answered" | "pending";
    totalMark: number;
    scoredMark: number;
    submittedAt: string | null;
    timeTakenSeconds: number | null;
}

export interface StudentDetailStudent {
    pid: string;
    name: string;
    email: string;
    overallPct: number | null;
    overallScored: number;
    overallTotal: number;
    progressPct: number;
    attemptedCount: number;
}

export interface StudentDetailGroup {
    stage: "I_Do" | "We_Do" | "You_Do";
    subcat: string;
    exercises?: CatalogueEx[];
    idoFiles?: IDoFile[];
}

export function StudentDetailModal({
    open,
    student,
    groups,
    courseId,
    courseName,
    courseData,
    participant,
    onClose,
}: {
    open: boolean;
    student: StudentDetailStudent | null;
    groups: StudentDetailGroup[];
    courseId: string;
    courseName?: string;
    courseData: any;
    /** Participant document from `courseData.batchAndParticipants[].users[]` —
     *  needed by both the We Do / You Do breakdown and the I Do lookup. */
    participant: any;
    onClose: () => void;
}) {
    // Escape closes the modal.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    // Reset expansion when the modal opens on a new learner.
    useEffect(() => {
        if (open && student) setExpanded(new Set());
    }, [open, student?.pid]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!open || !student) return null;

    const toggle = (key: string) => setExpanded((prev) => {
        const n = new Set(prev);
        if (n.has(key)) n.delete(key); else n.add(key);
        return n;
    });

    // Human labels for the stage titles.
    const stageLabel = (s: StudentDetailGroup["stage"]) =>
        s === "I_Do" ? "I Do" : s === "We_Do" ? "We Do" : "You Do";

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-detail-title"
            className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/55 backdrop-blur-[2px] p-3"
            onClick={onClose}
        >
            <div
                className="relative flex h-[88vh] w-[92vw] max-w-[1200px] flex-col overflow-hidden rounded-tile border border-hairline bg-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header — student identity + overall metrics. */}
                <header className="sticky top-0 z-10 flex flex-shrink-0 items-start justify-between gap-4 border-b border-hairline bg-surface px-5 py-4 sm:px-6">
                    <div className="min-w-0 flex-1">
                        <h2 id="student-detail-title" className="truncate text-[16px] font-bold tracking-[-0.015em] text-heading">
                            Student Performance Details
                        </h2>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11.5px] text-subtle">
                            <span className="font-semibold text-body">{student.name}</span>
                            {student.email ? <span className="text-subtle">{student.email}</span> : null}
                            {courseName ? <span className="text-subtle">· {courseName}</span> : null}
                        </p>
                    </div>
                    <div className="hidden shrink-0 gap-6 sm:flex">
                        <HeaderStat label="Overall Score" value={student.overallPct} />
                        <HeaderStat label="Progress" value={student.progressPct} />
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-8 items-center justify-center rounded-chip text-subtle transition-colors hover:bg-row-hover hover:text-heading"
                    >
                        <X size={16} />
                    </button>
                </header>

                {/* Body — one card per group, one collapsible row per item. */}
                <div className="min-h-0 flex-1 overflow-y-auto bg-surface-sunken/30 px-4 py-4 sm:px-6">
                    {groups.length === 0 ? (
                        <div className="flex h-full items-center justify-center px-4 text-center text-[12px] text-subtle">
                            No exercises are selected — pick some in Report Setup to see the breakdown here.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {groups.map((g) => (
                                <section key={`${g.stage}:${g.subcat}`} className="overflow-hidden rounded-tile border border-hairline bg-surface">
                                    <header className="border-b border-hairline bg-surface px-4 py-2.5">
                                        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-subtle">
                                            {stageLabel(g.stage)} <span className="text-faint">·</span> {prettySubcat(g.subcat)}
                                        </p>
                                    </header>
                                    <ul className="divide-y divide-hairline">
                                        {g.stage === "I_Do"
                                            ? (g.idoFiles ?? []).map((file) => {
                                                const key = `${g.stage}:${file.id}`;
                                                const isOpen = expanded.has(key);
                                                const marks = computeIDoMarks({ participant, courseId, file });
                                                return (
                                                    <IDoItemRow
                                                        key={key}
                                                        file={file}
                                                        open={isOpen}
                                                        onToggle={() => toggle(key)}
                                                        marks={marks}
                                                        participant={participant}
                                                        courseId={courseId}
                                                    />
                                                );
                                            })
                                            : (g.exercises ?? []).map((ex) => {
                                                const key = `${g.stage}:${ex.id}`;
                                                const isOpen = expanded.has(key);
                                                return (
                                                    <ExerciseItemRow
                                                        key={key}
                                                        ex={ex}
                                                        open={isOpen}
                                                        onToggle={() => toggle(key)}
                                                        participant={participant}
                                                        courseId={courseId}
                                                        courseData={courseData}
                                                    />
                                                );
                                            })}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function HeaderStat({ label, value }: { label: string; value: number | null }) {
    const color = value === null
        ? "var(--color-faint)"
        : value >= 80
            ? "var(--color-success-700)"
            : value >= 60
                ? "var(--color-warn-700)"
                : value >= 45
                    ? "var(--color-brand-strong)"
                    : "var(--color-danger-700)";
    return (
        <div className="flex flex-col items-end leading-tight">
            <span className="text-[10px] font-medium uppercase tracking-wider text-subtle">{label}</span>
            <span className="mt-0.5 text-[18px] font-bold tabular-nums" style={{ color }}>
                {value === null ? "—" : `${value}%`}
            </span>
        </div>
    );
}

function ItemSummary({
    title,
    subtitle,
    pct,
    scored,
    total,
    completed,
    totalCount,
    open,
    onToggle,
}: {
    title: string;
    subtitle?: string;
    pct: number | null;
    scored: number;
    total: number;
    completed: number;
    totalCount: number;
    open: boolean;
    onToggle: () => void;
}) {
    const color = pct === null
        ? "var(--color-faint)"
        : pct >= 80
            ? "var(--color-success-700)"
            : pct >= 60
                ? "var(--color-warn-700)"
                : pct >= 45
                    ? "var(--color-brand-strong)"
                    : "var(--color-danger-700)";
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-row-hover"
        >
            <span className="flex size-5 flex-shrink-0 items-center justify-center text-subtle">
                {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-heading">{title}</p>
                {subtitle ? <p className="mt-0.5 truncate text-[10.5px] text-subtle">{subtitle}</p> : null}
            </div>
            <div className="flex items-center gap-4 text-[11px] tabular-nums text-subtle">
                <span>Completed <b className="text-body">{completed} / {totalCount}</b></span>
                <span>Score <b className="text-body">{scored} / {total}</b></span>
                <span
                    className="rounded-chip px-2 py-0.5 text-[11.5px] font-bold"
                    style={{
                        background: pct === null ? "var(--color-ink-100)" : `${color}15`,
                        color,
                    }}
                >
                    {pct === null ? "—" : `${pct}%`}
                </span>
            </div>
        </button>
    );
}

function ExerciseItemRow({
    ex,
    open,
    onToggle,
    participant,
    courseId,
    courseData,
}: {
    ex: CatalogueEx;
    open: boolean;
    onToggle: () => void;
    participant: any;
    courseId: string;
    courseData: any;
}) {
    const marks = useMemo(
        () => computeStudentMarks({ courseData, courseId, exerciseId: ex.id, participant }),
        [courseData, courseId, ex.id, participant],
    );
    const pct = marks.hasSubmitted && marks.totalMarks > 0
        ? Math.round((marks.scoredMarks / marks.totalMarks) * 100)
        : null;

    // Load per-question rows only when expanded — a modal with dozens of
    // exercises would otherwise walk the whole answer tree for each on open.
    const [rows, setRows] = useState<QRow[] | null>(null);
    const loadedRef = useRef(false);
    useEffect(() => {
        if (!open || loadedRef.current || !participant) return;
        loadedRef.current = true;
        try {
            const bd: QuestionBreakdownRow[] = getStudentQuestionsBreakdown({
                courseData,
                courseId,
                exerciseId: ex.id,
                participant,
                studentSubmitted: true,
            });
            // Adapt to the shared QRow shape — questionNo becomes a string so
            // the same QuestionTable can render I Do rows too.
            setRows(bd.map((q) => ({
                questionNo: String(q.questionNo),
                title: q.title,
                type: q.type,
                status: q.status,
                totalMark: q.totalMark,
                scoredMark: q.scoredMark,
                submittedAt: q.submittedAt,
                timeTakenSeconds: q.timeTakenSeconds,
            })));
        } catch (e) {
            console.error("question breakdown failed", e);
            setRows([]);
        }
    }, [open, participant, courseData, courseId, ex.id]);

    return (
        <li>
            <ItemSummary
                title={ex.name}
                subtitle={ex.path}
                pct={pct}
                scored={marks.scoredMarks}
                total={marks.totalMarks}
                completed={marks.completedQuestions}
                totalCount={marks.totalQuestions}
                open={open}
                onToggle={onToggle}
            />
            {open ? (
                <div className="bg-surface-sunken/30 px-4 pb-3 pt-1">
                    {rows === null ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-[11px] text-subtle">
                            <Loader2 size={12} className="animate-spin" /> Loading questions…
                        </div>
                    ) : rows.length === 0 ? (
                        <p className="py-3 text-center text-[11px] text-subtle">No questions recorded for this exercise.</p>
                    ) : (
                        <QuestionTable rows={rows} />
                    )}
                </div>
            ) : null}
        </li>
    );
}

function IDoItemRow({
    file,
    open,
    onToggle,
    marks,
    participant,
    courseId,
}: {
    file: IDoFile;
    open: boolean;
    onToggle: () => void;
    marks: ReturnType<typeof computeIDoMarks>;
    participant: any;
    courseId: string;
}) {
    // Latest attempt per question, joined against the file's MCQ definition
    // so we can show the question title + total mark alongside the student's
    // submission. Computed lazily when the row expands.
    const rows = useMemo<QRow[]>(() => {
        if (!open || !participant) return [];
        const userDoc = participant?.user ?? participant;
        const enrolled = (userDoc?.courses || []).find((c: any) =>
            String(c?.courseId || "") === String(courseId || ""),
        );
        const ans = enrolled?.answers?.I_Do?.[file.id];
        const answersArr: any[] = Array.isArray(ans?.answers) ? ans.answers : [];
        const latestByQ = new Map<string, any>();
        for (const r of answersArr) {
            const qid = r?.questionId ? String(r.questionId) : `${r?.pageNumber ?? ""}-${r?.questionTitle ?? ""}`;
            const prev = latestByQ.get(qid);
            if (!prev || new Date(r.submittedAt || 0) >= new Date(prev.submittedAt || 0)) {
                latestByQ.set(qid, r);
            }
        }
        const questions: any[] = Array.isArray(file.file?.mcqQuestions)
            ? file.file.mcqQuestions.filter((q: any) => q && q.isActive !== false)
            : [];
        return questions.map((q, i) => {
            const qid = q?._id ? String(q._id) : "";
            const r = latestByQ.get(qid);
            const attempted = !!r;
            const isCorrect = r?.isCorrect === true;
            const totalMark = Number(q?.marks) || 1;
            return {
                questionNo: String(i + 1),
                title: q?.question || q?.questionTitle || "Untitled MCQ",
                type: "MCQ",
                status: (attempted ? (isCorrect ? "evaluated" : "submitted") : "not_answered") as QRow["status"],
                totalMark,
                scoredMark: attempted ? (isCorrect ? totalMark : 0) : 0,
                submittedAt: r?.submittedAt || null,
                timeTakenSeconds: typeof r?.timeTakenSeconds === "number" ? r.timeTakenSeconds : null,
            };
        });
    }, [open, participant, courseId, file]);

    return (
        <li>
            <ItemSummary
                title={file.name}
                subtitle={file.path}
                pct={marks.pct}
                scored={marks.correctMcq}
                total={marks.totalMcq}
                completed={marks.attemptedMcq}
                totalCount={marks.totalMcq}
                open={open}
                onToggle={onToggle}
            />
            {open ? (
                <div className="bg-surface-sunken/30 px-4 pb-3 pt-1">
                    {rows.length === 0 ? (
                        <p className="py-3 text-center text-[11px] text-subtle">
                            {marks.hasAttempted ? "No individual question records for this file." : "This learner hasn't attended this MCQ yet."}
                        </p>
                    ) : (
                        <QuestionTable rows={rows} showTime={false} />
                    )}
                </div>
            ) : null}
        </li>
    );
}

/**
 * Small typed table shared by We Do / You Do (from `QuestionBreakdownRow`)
 * and I Do (from the locally-computed `IdoQRow`). Both rows carry the same
 * fields, so one table renders both.
 */
function QuestionTable({
    rows,
    showTime = true,
}: {
    rows: QRow[];
    showTime?: boolean;
}) {
    const statusTone = (s: string) =>
        s === "evaluated"
            ? "bg-success-500/15 text-success-700"
            : s === "submitted"
                ? "bg-brand-500/15 text-brand-strong"
                : s === "not_answered"
                    ? "bg-danger-500/15 text-danger-700"
                    : "bg-ink-100 text-subtle";
    const statusLabel = (s: string) =>
        s === "not_answered" ? "Not Answered" : s.charAt(0).toUpperCase() + s.slice(1);
    const fmtDate = (iso: string | null) => {
        if (!iso) return "—";
        try { return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); }
        catch { return iso; }
    };
    const fmtTime = (s: number | null) => {
        if (typeof s !== "number" || !Number.isFinite(s) || s <= 0) return "—";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };
    return (
        <div className="overflow-x-auto rounded-chip border border-hairline bg-surface">
            <table className="w-full border-collapse text-[11px]">
                <thead>
                    <tr>
                        {["Q. No.", "Question", "Type", "Status", "Total", "Scored", "Submitted", ...(showTime ? ["Time"] : [])].map((h) => (
                            <th key={h} className="border-b border-hairline bg-surface-sunken/60 px-2.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((r, i) => (
                        <tr key={i} className="border-b border-hairline last:border-b-0">
                            <td className="px-2.5 py-1.5 tabular-nums text-body">{r.questionNo}</td>
                            <td className="px-2.5 py-1.5 text-body"><span className="line-clamp-2">{r.title}</span></td>
                            <td className="px-2.5 py-1.5 uppercase tracking-wide text-subtle">{r.type}</td>
                            <td className="px-2.5 py-1.5">
                                <span className={`inline-flex rounded-chip px-1.5 py-0.5 text-[10px] font-semibold ${statusTone(r.status)}`}>
                                    {statusLabel(r.status)}
                                </span>
                            </td>
                            <td className="px-2.5 py-1.5 tabular-nums text-body">{r.totalMark}</td>
                            <td className="px-2.5 py-1.5 tabular-nums font-semibold text-heading">{r.scoredMark}</td>
                            <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums text-subtle">{fmtDate(r.submittedAt)}</td>
                            {showTime ? <td className="px-2.5 py-1.5 whitespace-nowrap tabular-nums text-subtle">{fmtTime(r.timeTakenSeconds)}</td> : null}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default StudentDetailModal;
