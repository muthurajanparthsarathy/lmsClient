"use client";

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { StudentProgress } from "../types/reports.types";
import { deriveTestStatus } from "../utils/helpers";
import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";

interface ReportRowProps {
  student: StudentProgress;
  index: number;
  /** When true, the leading chevron column is rendered and the row can be
   *  expanded inline. When false the chevron column is absent entirely — the
   *  row matches the column layout `REPORT_HEADERS_BASE` defines. */
  isDetailedReport: boolean;
  /** Whether this row's inline detail panel is currently open. Controlled
   *  from the parent so only one row is expanded at a time (accordion). */
  isExpanded: boolean;
  /** Called with this student's id when the chevron is clicked. */
  onToggleExpand: (studentId: string) => void;
  /** Per-question breakdown for THIS student. Passed only when expanded —
   *  `null` while it's still being computed, `undefined` for collapsed rows
   *  so memoized siblings stay stable. */
  breakdown: QuestionBreakdownRow[] | null | undefined;
  /** Total column count for the detail panel's colSpan. The parent owns the
   *  header layout so it's the source of truth. */
  columnCount: number;
}

// High-contrast, solid-colour badges — mirrors StudentRow so the list and
// report views read identically. White text on a saturated background plus a
// small dot so the three states stay distinct even on dense rows.
const STATUS_BADGE = {
  "not-started":  { label: "Not Started",  cls: "bg-slate-500   text-white", dot: "bg-white/80" },
  "started":      { label: "Started",      cls: "bg-amber-500   text-white", dot: "bg-white"    },
  "submitted":    { label: "Submitted",    cls: "bg-emerald-600 text-white", dot: "bg-white"    },
} as const;

// ─── Per-question status badge (used inside the expand panel) ──────────────
// Note: there's no "In Progress" at the per-question level. "In Progress" is
// a TEST-level concept (the student is currently attending). At the question
// level, once the test is submitted, a skipped question is "Not Answered";
// while the test is still live, it's "Pending".
const QUESTION_STATUS_META = {
  evaluated:    { label: "Evaluated",   cls: "bg-emerald-50 text-emerald-700" },
  submitted:    { label: "Submitted",   cls: "bg-green-50   text-green-700"   },
  not_answered: { label: "Not Answered", cls: "bg-rose-50   text-rose-600"    },
  pending:      { label: "Pending",     cls: "bg-gray-100   text-gray-500"    },
} as const;

const formatTimeTaken = (secs: number): string => {
  if (!Number.isFinite(secs) || secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const formatSubmittedAt = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

function ReportRowBase({
  student, index, isDetailedReport, isExpanded, onToggleExpand, breakdown, columnCount,
}: ReportRowProps) {
  const s = student;
  const status = deriveTestStatus(s);
  const total = s.totalQuestions ?? 0;
  const completed = s.completed ?? 0;
  const nonCompleted = Math.max(0, total - completed);

  // ── Marks columns ──────────────────────────────────────────────────────────
  // We deliberately do NOT gate Scored Marks behind `status !== "not-started"`.
  // The dashboard's Test Status is a *live session* signal: a student who
  // answered questions earlier (auto-graded by the code-editor / MCQ) but
  // isn't currently in the room AND hasn't pressed Submit shows "Not Started"
  // — but their stored, scored answers should still surface on the report.
  // `hasScoredMarks` (set by `computeStudentMarks` only when at least one
  // submission exists for this assessment) is the real "do we have data" gate.
  const hasTotalMarks = typeof s.totalMarks === "number" && s.totalMarks > 0;
  const hasScoredMarks = typeof s.scoredMarks === "number";
  const totalMarksText = hasTotalMarks ? String(s.totalMarks) : "—";
  const scoredMarksText = hasScoredMarks ? String(s.scoredMarks) : "—";

  // ── Percentage (Reports view only — list view doesn't render this row) ────
  // Computed whenever we have both a positive max and a non-null scored
  // value. Rounded to one decimal so 13/50 reads "26%" not "26.0000%".
  const canShowPct = hasTotalMarks && hasScoredMarks;
  const pctValue = canShowPct
    ? ((s.scoredMarks as number) / (s.totalMarks as number)) * 100
    : null;
  const percentageText = pctValue == null ? "—" : `${Math.round(pctValue * 10) / 10}%`;
  // Color-code so the eye picks scoring brackets out at a glance —
  // mirrors the per-question Scored Mark coloring rules:
  //   green ≥ 80, amber ≥ 50, rose < 50, gray for "—".
  const percentageCls = pctValue == null
    ? "text-gray-400"
    : pctValue >= 80 ? "text-green-600"
    : pctValue >= 50 ? "text-amber-600"
    : "text-rose-600";

  // ── Scale (performance band) ───────────────────────────────────────────────
  // Precomputed in the dashboard marks pipeline from the exercise's Grade
  // Settings bands (e.g. 50% → "Average"). "—" when there's no band/percentage.
  const scaleText = s.scaleLabel || "—";

  const statusBadge = STATUS_BADGE[status];

  // ── Main row ──────────────────────────────────────────────────────────────
  const mainRow = (
    <tr
      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        isExpanded ? "bg-indigo-50/30" : ""
      }`}
    >
      {/* S. No. cell removed — name + email already identify the row. */}
      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{s.studentName}</td>
      <td className="px-4 py-3 text-[13px] text-gray-500">{s.email}</td>
      <td className="px-4 py-3 text-[13px] text-center text-gray-700">{total}</td>
      <td className="px-4 py-3 text-[13px] text-center font-semibold text-green-600">{completed}</td>
      <td className="px-4 py-3 text-[13px] text-center font-semibold text-amber-600">{nonCompleted}</td>
      <td className="px-4 py-3 text-[13px] text-center">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap shadow-sm ${statusBadge.cls}`}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
          {statusBadge.label}
        </span>
      </td>
      <td className="px-4 py-3 text-[13px] text-center text-gray-700">{totalMarksText}</td>
      <td
        className={`px-4 py-3 text-[13px] text-center font-semibold ${
          scoredMarksText === "—" ? "text-gray-400" : "text-green-600"
        }`}
      >
        {scoredMarksText}
      </td>
      {/* Percentage — Reports view only. Color reflects the bracket
          (>=80 green, >=50 amber, <50 rose, "—" gray) so callers can spot
          struggling students at a glance. */}
      <td className={`px-4 py-3 text-[13px] text-center font-semibold ${percentageCls}`}>
        {percentageText}
      </td>
      {/* Scale — the configured performance band for this percentage
          (e.g. 50% → "Average"). Rendered as a subtle pill; gray "—" when
          there's no percentage to map. */}
      <td className="px-4 py-3 text-[13px] text-center">
        {scaleText === "—" ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold bg-indigo-50 text-indigo-700 whitespace-nowrap">
            {scaleText}
          </span>
        )}
      </td>
      {/* Trailing expand affordance — only when the Detailed Report toggle
          is on. Blue link-style label ("View detailed report") with the
          chevron icon LEFT of the text. The whole row is the click target
          so users don't have to aim at the icon. */}
      {isDetailedReport && (
        <td className="px-3 py-3 text-center whitespace-nowrap">
          <button
            type="button"
            onClick={() => onToggleExpand(s.id)}
            aria-label={isExpanded ? "Hide detailed report" : "View detailed report"}
            aria-expanded={isExpanded}
            className="inline-flex items-center gap-1.5 px-1 py-1 rounded-md text-[12.5px] font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <span>View detailed report</span>
          </button>
        </td>
      )}
    </tr>
  );

  // ── Expanded detail panel ─────────────────────────────────────────────────
  // Renders as a SECOND <tr> that spans the full table width. Wraps the
  // per-question breakdown in a card-styled inner table — visual hierarchy
  // matching the reference screenshot (a nested table inside a tinted box).
  let detailRow: React.ReactNode = null;
  if (isDetailedReport && isExpanded) {
    detailRow = (
      <tr className="bg-indigo-50/20">
        <td colSpan={columnCount} className="px-4 py-3">
          <div className="border border-indigo-100 rounded-lg bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50/60 border-b border-indigo-100 text-[12.5px] font-semibold text-indigo-700">
              Question-by-Question Details
              <span className="text-[11.5px] font-normal text-indigo-500/80">
                · {s.studentName}
              </span>
            </div>
            {/* Loading / empty / data states for the breakdown */}
            {breakdown === null ? (
              <div className="px-4 py-6 text-center text-[12px] text-gray-400">
                Loading per-question details…
              </div>
            ) : !breakdown || breakdown.length === 0 ? (
              <div className="px-4 py-6 text-center text-[12px] text-gray-400">
                No questions found for this assessment.
              </div>
            ) : (
              <div className="overflow-x-auto lmsd-scroll">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-white border-b border-gray-100">
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Q. No.</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Title</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Type</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Status</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Total Mark</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Scored Mark</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Submitted At</th>
                      <th className="px-3 py-2 text-center font-semibold text-gray-600">Time Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.map((q) => {
                      const meta = QUESTION_STATUS_META[q.status];
                      return (
                        <tr key={q.questionId} className="border-b border-gray-50 last:border-b-0">
                          <td className="px-3 py-2 text-gray-500">{q.questionNo}</td>
                          <td className="px-3 py-2 text-gray-800">
                            {/* Long titles are common — clamp with a tooltip
                                fallback so the row height stays calm. */}
                            <span className="block max-w-[360px] truncate" title={q.title}>{q.title}</span>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600 uppercase tracking-wide text-[11.5px]">
                            {q.type}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${meta.cls}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-700">{q.totalMark}</td>
                          {/* Color coding:
                              - gray "—" for a question with no submission yet (pending while
                                test is live; not_answered if test is done — both render as "—"
                                because there's no meaningful score to display)
                              - green for full marks
                              - rose for zero out of non-zero max
                              - amber for partial credit. */}
                          <td className={`px-3 py-2 text-center font-semibold ${
                            q.status === "pending" || q.status === "not_answered"
                              ? "text-gray-400"
                              : q.scoredMark === q.totalMark
                                ? "text-green-600"
                                : q.scoredMark === 0
                                  ? "text-rose-600"
                                  : "text-amber-600"
                          }`}>
                            {q.status === "pending" || q.status === "not_answered" ? "—" : q.scoredMark}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">
                            {formatSubmittedAt(q.submittedAt)}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600 whitespace-nowrap">
                            {formatTimeTaken(q.timeTakenSeconds)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </td>
      </tr>
    );
  }

  return (
    <React.Fragment>
      {mainRow}
      {detailRow}
    </React.Fragment>
  );
}

function areEqual(prev: ReportRowProps, next: ReportRowProps) {
  if (prev.index !== next.index) return false;
  if (prev.isDetailedReport !== next.isDetailedReport) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.onToggleExpand !== next.onToggleExpand) return false;
  if (prev.columnCount !== next.columnCount) return false;
  // Breakdown identity matters only when expanded. Collapsed rows never
  // render it, so its reference identity is irrelevant to them.
  if (prev.isExpanded && prev.breakdown !== next.breakdown) return false;
  const a = prev.student;
  const b = next.student;
  return (
    a.id === b.id &&
    a.studentName === b.studentName &&
    a.email === b.email &&
    a.totalQuestions === b.totalQuestions &&
    a.completed === b.completed &&
    a.inProgress === b.inProgress &&
    a.submitted === b.submitted &&
    a.totalMarks === b.totalMarks &&
    a.scoredMarks === b.scoredMarks &&
    a.scaleLabel === b.scaleLabel
  );
}

export const ReportRow = React.memo(ReportRowBase, areEqual);
export default ReportRow;
