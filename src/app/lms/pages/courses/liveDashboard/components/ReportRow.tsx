"use client";

import React from "react";
import { MoreVertical, ChevronDown, MessageSquare, ClipboardCheck, BarChart3, ShieldCheck, ShieldX } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { StudentProgress } from "../types/liveDashboard.types";
import { deriveTestStatus } from "./StudentRow";
import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";

interface ReportRowProps {
  student: StudentProgress;
  index: number;
  /** Whether this row's inline detail panel is currently open. Controlled by
   *  the parent so only one row is expanded at a time (accordion). */
  isExpanded: boolean;
  /** Toggle the per-question breakdown for this student. */
  onToggleExpand: (studentId: string) => void;
  /** Wire the kebab's "Send Message" item. */
  onSendMessage: (studentId: string) => void;
  /** Wire the kebab's "Check Answer" item (only shown when submittable). */
  onCheckAnswers: (studentId: string) => void;
  /** Trainer approves the student's pending resume request. Only rendered
   *  when the row is in 'awaiting-approval' state. */
  onApproveResume?: (studentId: string) => void;
  /** Trainer rejects the student's pending resume request. Only rendered
   *  when the row is in 'awaiting-approval' state. */
  onRejectResume?: (studentId: string) => void;
  /** Per-question breakdown for THIS student. `null` while it's being
   *  computed, `undefined` for collapsed rows so memoization stays stable. */
  breakdown: QuestionBreakdownRow[] | null | undefined;
  /** Total column count for the detail panel's colSpan. */
  columnCount: number;
}

// High-contrast, solid-colour badges — mirrors StudentRow so the list and
// report views read identically.
const STATUS_BADGE = {
  "not-started":       { label: "Not Started",       cls: "bg-slate-500   text-white", dot: "bg-white/80" },
  "started":           { label: "In Progress",       cls: "bg-amber-500   text-white", dot: "bg-white"    },
  "disconnected":      { label: "Disconnected",      cls: "bg-orange-500  text-white", dot: "bg-white"    },
  "awaiting-approval": { label: "Awaiting Approval", cls: "bg-yellow-500  text-white", dot: "bg-white"    },
  "submitted":         { label: "Completed",         cls: "bg-emerald-600 text-white", dot: "bg-white"    },
  "terminated":        { label: "Terminated",        cls: "bg-red-600     text-white", dot: "bg-white"    },
} as const;

// Per-question status badge (used inside the expand panel).
const QUESTION_STATUS_META = {
  evaluated:    { label: "Evaluated",    cls: "bg-emerald-50 text-emerald-700" },
  submitted:    { label: "Submitted",    cls: "bg-green-50   text-green-700"   },
  not_answered: { label: "Not Answered", cls: "bg-rose-50    text-rose-600"    },
  pending:      { label: "Pending",      cls: "bg-gray-100   text-gray-500"    },
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
  student, index, isExpanded, onToggleExpand, onSendMessage, onCheckAnswers,
  onApproveResume, onRejectResume,
  breakdown, columnCount,
}: ReportRowProps) {
  const s = student;
  const status = deriveTestStatus(s);

  // ── Questions (Completed / Total + Remaining) ─────────────────────────────
  const total = s.totalQuestions ?? 0;
  const completed = s.completed ?? 0;
  const remaining = Math.max(0, total - completed);

  // ── Marks (Scored / Total) — see the previous version's note on why the
  // `hasScoredMarks` gate is the real "do we have data" check, not test status.
  const hasTotalMarks = typeof s.totalMarks === "number" && s.totalMarks > 0;
  const hasScoredMarks = typeof s.scoredMarks === "number";
  const canShowMarks = hasTotalMarks && hasScoredMarks;
  const marksText = canShowMarks ? `${s.scoredMarks} / ${s.totalMarks}` : "—";

  // ── Percentage — Scored / Total × 100, rounded to one decimal ─────────────
  const pctValue = canShowMarks
    ? ((s.scoredMarks as number) / (s.totalMarks as number)) * 100
    : null;
  const percentageText = pctValue == null ? "—" : `${Math.round(pctValue * 10) / 10}%`;
  const percentageCls = pctValue == null
    ? "text-gray-400"
    : pctValue >= 80 ? "text-green-600"
    : pctValue >= 50 ? "text-amber-600"
    : "text-rose-600";

  // ── Scale (performance band) — precomputed by the marks pipeline ─────────
  const scaleText = s.scaleLabel || "—";

  const statusBadge = STATUS_BADGE[status];

  // "Check Answer" is only meaningful when the student has data to review —
  // same gate StudentRow uses.
  const hasAnswerInDb = (s.completed || 0) > 0 || !!s.submitted;

  // ── Main row ──────────────────────────────────────────────────────────────
  // Expanded-state tint switched from indigo → neutral gray so the row match
  // es the We-Do list palette and nothing on the page reads as "blue".
  const mainRow = (
    <tr
      className={`hover:bg-gray-50 transition-colors ${
        isExpanded ? "bg-gray-50" : ""
      }`}
    >
      {/* "#" row-index — 1-based ordinal, matches the We-Do list. */}
      <td className="px-4 py-3 text-center align-top text-xs text-gray-500 tabular-nums w-12">
        {index + 1}
      </td>

      {/* Student — name (primary) + email (muted) stacked, one column */}
      <td className="px-4 py-3 align-top">
        <div className="text-sm font-medium text-gray-900 leading-tight">{s.studentName || "—"}</div>
        <div className="text-xs text-gray-500 mt-0.5">{s.email || "—"}</div>
      </td>

      {/* Questions — "X / Y" primary, "N Remaining" muted */}
      <td className="px-4 py-3 text-center align-top">
        <div className="text-sm font-semibold text-gray-900 tabular-nums">
          {total > 0 ? `${completed} / ${total}` : "—"}
        </div>
        {total > 0 && (
          <div className="text-xs text-gray-500 mt-0.5">
            {remaining} Remaining
          </div>
        )}
      </td>

      {/* Test Status */}
      <td className="px-4 py-3 text-center align-top">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${statusBadge.cls}`}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
          {statusBadge.label}
        </span>
      </td>

      {/* Marks — "X / Y" */}
      <td className="px-4 py-3 text-center align-top">
        <span
          className={`text-sm font-semibold tabular-nums ${
            marksText === "—" ? "text-gray-400" : "text-gray-900"
          }`}
        >
          {marksText}
        </span>
      </td>

      {/* Percentage — bracket-coloured for a glanceable scan */}
      <td className="px-4 py-3 text-center align-top">
        <span className={`text-sm font-semibold tabular-nums ${percentageCls}`}>
          {percentageText}
        </span>
      </td>

      {/* Scale — subtle gray pill (was indigo — matched the removed blue palette) */}
      <td className="px-4 py-3 text-center align-top">
        {scaleText === "—" ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span className="inline-flex items-center rounded-md px-2.5 py-0.5 text-[12px] font-semibold bg-gray-100 text-gray-700 whitespace-nowrap">
            {scaleText}
          </span>
        )}
      </td>

      {/* Trailing kebab — Send Message / Check Answer (when submittable) /
          View Detailed Report. Uses the shared shadcn DropdownMenu so the
          menu chrome matches the rest of the app. */}
      <td className="px-3 py-3 text-center align-top w-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Actions for ${s.studentName || "student"}`}
              className="inline-flex size-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <MoreVertical size={14} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Approve / Reject a student's pending Resume request. Only
                shown when the row is in `awaiting-approval` state. Sits at
                the top of the menu so the trainer sees it first. */}
            {status === "awaiting-approval" && (
              <>
                {onApproveResume && (
                  <DropdownMenuItem onClick={() => onApproveResume(s.id)} className="cursor-pointer">
                    <ShieldCheck className="h-4 w-4" style={{ color: "#16a34a" }} />
                    Approve Resume
                  </DropdownMenuItem>
                )}
                {onRejectResume && (
                  <DropdownMenuItem onClick={() => onRejectResume(s.id)} className="cursor-pointer">
                    <ShieldX className="h-4 w-4" style={{ color: "#dc2626" }} />
                    Reject Resume
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={() => onSendMessage(s.id)} className="cursor-pointer">
              <MessageSquare className="h-4 w-4" style={{ color: "#4f46e5" }} />
              Send Message
            </DropdownMenuItem>
            {hasAnswerInDb && (
              <DropdownMenuItem onClick={() => onCheckAnswers(s.id)} className="cursor-pointer">
                <ClipboardCheck className="h-4 w-4" style={{ color: "#059669" }} />
                Check Answer
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onToggleExpand(s.id)} className="cursor-pointer">
              <BarChart3 className="h-4 w-4" style={{ color: "#3b82f6" }} />
              {isExpanded ? "Hide Detailed Report" : "View Detailed Report"}
              {isExpanded && <ChevronDown size={13} className="ml-auto text-gray-400" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );

  // ── Expanded per-question detail panel ─────────────────────────────────────
  // Same panel that used to appear behind the header-level "Detailed" toggle,
  // now driven by the kebab's "View Detailed Report" item.
  let detailRow: React.ReactNode = null;
  if (isExpanded) {
    detailRow = (
      // Expanded panel palette dropped from indigo → neutral gray to match
      // the We-Do list style, so nothing on this page reads as blue.
      <tr className="bg-gray-50/50">
        <td colSpan={columnCount} className="px-4 py-3">
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[12.5px] font-semibold text-gray-700">
              Question-by-Question Details
              <span className="text-[11.5px] font-normal text-gray-500">
                · {s.studentName}
              </span>
            </div>
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
                            <span className="block max-w-[360px] truncate" title={q.title}>{q.title}</span>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600 uppercase tracking-wide text-[11.5px]">
                            {q.type}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${meta.cls}`}>
                              {meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-gray-700">{q.totalMark}</td>
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
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.onToggleExpand !== next.onToggleExpand) return false;
  if (prev.onSendMessage !== next.onSendMessage) return false;
  if (prev.onCheckAnswers !== next.onCheckAnswers) return false;
  if (prev.onApproveResume !== next.onApproveResume) return false;
  if (prev.onRejectResume !== next.onRejectResume) return false;
  if (prev.columnCount !== next.columnCount) return false;
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
    a.scaleLabel === b.scaleLabel &&
    // Recovery & Resume — the row must repaint when any of these flips so
    // the Awaiting-Approval badge and the Approve / Reject kebab items
    // appear as soon as the socket lands the state change.
    a.attemptStatus === b.attemptStatus &&
    a.isOnline === b.isOnline &&
    a.resumeState === b.resumeState
  );
}

export const ReportRow = React.memo(ReportRowBase, areEqual);
export default ReportRow;
