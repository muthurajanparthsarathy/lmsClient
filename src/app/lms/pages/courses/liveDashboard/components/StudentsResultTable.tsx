"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

import type { StudentProgress } from "../types/liveDashboard.types";
import { getExerciseGradeBands, scaleForPercent, type GradeBand } from "../utils/computeStudentMarks";
import { deriveTestStatus } from "../utils/deriveTestStatus";

// ── Overview tab — the learner list ─────────────────────────────────────────
//
// Five columns only:
//
//   Student · Test Status · Marks · Percentage · Scale
//
// Row click routes into the trainer's existing per-student grader. The
// per-question matrix, the assessment analytics strip, the printable-report
// modal and the popover have all moved out of this tab — either into the
// Questions tab or into the review page — so the Overview stays focussed on
// "who scored what".

export interface StudentsResultTableProps {
  students: StudentProgress[];
  assessmentId: string;
  assessmentName: string;
  courseData: any | null;
  courseId: string;
  isLoading: boolean;
  onOpenReview?: (studentId: string) => void;
  search?: string;
  statusFilter?: string;
}

const initialsOf = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
};

const COMPLETION_STYLES: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  submitted: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  started: { label: "In Progress", bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-500" },
  disconnected: { label: "Disconnected", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
  "awaiting-approval": { label: "Needs Approval", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  terminated: { label: "Terminated", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  "not-started": { label: "Not Started", bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" },
};

function TestStatusPill({ status }: { status: string }) {
  const s = COMPLETION_STYLES[status] || COMPLETION_STYLES["not-started"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

// Colour the scale badge by band position — lowest band → red, top band →
// emerald, mid bands → amber → sky (four-band default). Works for any
// custom band count the exercise's Grade Settings may configure.
function scaleTone(bandIndex: number, bandCount: number): {
  badgeBg: string; badgeText: string; barColor: string; dot: string;
} {
  if (bandCount <= 1) return { badgeBg: "bg-slate-50", badgeText: "text-slate-700", barColor: "bg-slate-400", dot: "bg-slate-400" };
  // Normalise into [0, 1]. 0 = worst, 1 = best.
  const t = bandIndex / (bandCount - 1);
  if (t < 0.25) return { badgeBg: "bg-red-50", badgeText: "text-red-700", barColor: "bg-red-500", dot: "bg-red-500" };
  if (t < 0.6) return { badgeBg: "bg-amber-50", badgeText: "text-amber-800", barColor: "bg-amber-500", dot: "bg-amber-500" };
  if (t < 0.85) return { badgeBg: "bg-sky-50", badgeText: "text-sky-700", barColor: "bg-sky-500", dot: "bg-sky-500" };
  return { badgeBg: "bg-emerald-50", badgeText: "text-emerald-700", barColor: "bg-emerald-500", dot: "bg-emerald-500" };
}

function ScaleBadge({
  label, percent, bandIndex, bandCount,
}: { label: string; percent: number; bandIndex: number; bandCount: number }) {
  const tone = scaleTone(bandIndex, bandCount);
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2 min-w-[132px]">
      <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
        <div className={`h-full ${tone.barColor} rounded-full`} style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${tone.badgeBg} ${tone.badgeText}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}

const PAGE_SIZE_OPTIONS = [10, 20, 25] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

export default function StudentsResultTable({
  students,
  assessmentId,
  courseData,
  isLoading,
  onOpenReview,
  search = "",
  statusFilter = "all",
}: StudentsResultTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(10);

  // Per-exercise grade bands — configured by the trainer under Grade
  // Settings; falls back to the LMS default (Poor / Average / Good /
  // Excellent) when the exercise has none.
  const bands: GradeBand[] = useMemo(
    () => getExerciseGradeBands(courseData, assessmentId),
    [courseData, assessmentId],
  );
  const bandIndexOf = useCallback((label: string): number => {
    for (let i = 0; i < bands.length; i++) if (bands[i].label === label) return i;
    return -1;
  }, [bands]);

  // Filter by search + Test Status — same shape SessionDetail hands in.
  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q) {
        const name = (s.studentName || "").toLowerCase();
        const email = (s.email || "").toLowerCase();
        const regNo = (s.studentDisplayId || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !regNo.includes(q)) return false;
      }
      if (statusFilter && statusFilter !== "all") {
        if (deriveTestStatus(s) !== statusFilter) return false;
      }
      return true;
    });
  }, [students, search, statusFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter, students.length, pageSize]);

  const totalFiltered = filteredStudents.length;
  const pageCount = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, pageCount);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalFiltered);
  const pagedStudents = filteredStudents.slice(startIdx, endIdx);

  const handleRowClick = useCallback((student: StudentProgress) => {
    if (onOpenReview) onOpenReview(student.id);
  }, [onOpenReview]);

  if (isLoading && students.length === 0) {
    return <div className="p-8 text-center text-[13px] text-gray-400">Loading learners…</div>;
  }

  if (!students.length) {
    return <div className="p-8 text-center text-[13px] text-gray-400">No learners are enrolled in this assessment yet.</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <div className="overflow-auto">
          <table className="min-w-full text-[12.5px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-gray-500 min-w-[220px]">
                  Student
                </th>
                <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-gray-500 min-w-[140px]">
                  Test Status
                </th>
                <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-wider text-gray-500 min-w-[110px]">
                  Marks
                </th>
                <th className="px-3 py-2 text-right text-[10.5px] font-semibold uppercase tracking-wider text-gray-500 min-w-[100px]">
                  Percentage
                </th>
                <th className="px-3 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wider text-gray-500 min-w-[170px]">
                  Scale
                </th>
                <th className="px-3 py-2 text-center text-[10.5px] font-semibold uppercase tracking-wider text-gray-500 min-w-[170px]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {pagedStudents.map((s) => {
                const status = deriveTestStatus(s);
                const finished = status === "submitted";
                const marksPending = s.scoredMarks == null;
                const scored = s.scoredMarks == null ? null : Math.round((s.scoredMarks) * 10) / 10;
                const outOf = s.totalMarks ?? 0;
                const marksDisplay = scored == null
                  ? "—"
                  : `${scored}${outOf > 0 ? ` / ${outOf}` : ""}`;
                const percent = scored != null && outOf > 0
                  ? Math.round((scored / outOf) * 100)
                  : null;
                const scaleLabel = percent != null ? scaleForPercent(percent, bands) : "";
                const bandIndex = scaleLabel ? bandIndexOf(scaleLabel) : -1;
                return (
                  <tr
                    key={s.id}
                    className="border-b border-gray-100 hover:bg-indigo-50/40 group cursor-pointer h-[46px]"
                    onClick={() => handleRowClick(s)}
                    title="Open the review submission for this learner in a new tab"
                  >
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-[10.5px] font-semibold flex items-center justify-center flex-shrink-0">
                          {initialsOf(s.studentName)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12.5px] font-semibold text-gray-900 truncate max-w-[220px]">{s.studentName}</div>
                          <div className="text-[10.5px] text-gray-500 truncate max-w-[220px]">
                            {s.studentDisplayId ? `${s.studentDisplayId}${s.email ? " · " : ""}` : ""}
                            {s.email || (s.studentDisplayId ? "" : "—")}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      <TestStatusPill status={status} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {marksPending && !finished ? (
                        <span className="text-[12.5px] text-gray-400">—</span>
                      ) : marksPending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700">
                          Pending
                        </span>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-gray-800 tabular-nums">
                          {marksDisplay}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {percent == null ? (
                        <span className="text-[12.5px] text-gray-400">—</span>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-gray-800 tabular-nums">{percent}%</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {percent == null || !scaleLabel ? (
                        <span className="text-[12.5px] text-gray-400">—</span>
                      ) : (
                        <ScaleBadge
                          label={scaleLabel}
                          percent={percent}
                          bandIndex={bandIndex}
                          bandCount={bands.length}
                        />
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                      {onOpenReview ? (
                        <button
                          type="button"
                          onClick={() => onOpenReview(s.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11.5px] font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
                          title="Open the review submission for this learner in a new tab"
                        >
                          <ExternalLink size={11} />
                          Review Submission
                        </button>
                      ) : (
                        <span className="text-[11.5px] text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pagedStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[12.5px] text-gray-400">
                    No learners match this search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 text-[11.5px] text-gray-500 mt-1">
        <div>
          {totalFiltered === 0
            ? "0 learners"
            : `Showing ${startIdx + 1}–${endIdx} of ${totalFiltered} learners`}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 flex items-center justify-center"
              aria-label="Previous page"
            >
              <ChevronLeft size={12} />
            </button>
            {Array.from({ length: pageCount }, (_, i) => i + 1)
              .filter((n) => Math.abs(n - safePage) <= 2 || n === 1 || n === pageCount)
              .reduce((acc: (number | "gap")[], n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push("gap");
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) => n === "gap" ? (
                <span key={`g${i}`} className="px-1 text-gray-400">…</span>
              ) : (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n as number)}
                  className={`h-7 min-w-[28px] px-1 rounded-md border text-[11.5px] tabular-nums ${
                    n === safePage
                      ? "bg-gray-900 text-white border-gray-900"
                      : "text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {n}
                </button>
              ))}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              disabled={safePage >= pageCount}
              className="h-7 w-7 rounded-md border border-gray-200 text-gray-600 disabled:opacity-40 hover:bg-gray-50 flex items-center justify-center"
              aria-label="Next page"
            >
              <ChevronRight size={12} />
            </button>
          </div>
          <label className="flex items-center gap-1 text-[11px] text-gray-500 ml-1">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
              className="h-7 rounded-md border border-gray-200 bg-white px-1.5 text-[11.5px] text-gray-700 outline-none focus:border-indigo-400"
              aria-label="Rows per page"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>/ page</span>
          </label>
        </div>
      </div>
    </div>
  );
}
