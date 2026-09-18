"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  X, Download, Printer, Share2, CheckCircle2, XCircle, MinusCircle, HelpCircle,
  ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";

import type { StudentProgress } from "../types/liveDashboard.types";
import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";
import ShareReportDialog, { type Recipient } from "./ShareReportDialog";

// ── Individual student report modal (Screen 7) ──────────────────────────────
//
// Large centered overlay opened by clicking a student row. Reads the same
// courses-data-derived per-question breakdown the Students matrix uses, so
// numbers here always agree with numbers there. Missing per-question values
// render as em-dashes, never as zero, per the spec's "Missing result handling"
// rule.

export interface StudentReportModalProps {
  student: StudentProgress;
  assessmentName: string;
  breakdown: QuestionBreakdownRow[];
  /** Candidate recipients for the Share dialog (usually the course's trainers
   *  + staff). Passed straight through to ShareReportDialog. */
  recipients?: Recipient[];
  /** Fires when a share request completes so the parent can raise a toast.
   *  Modal closes itself along with the ShareReportDialog. */
  onShareSent?: (recipients: Recipient[]) => void;
  /** Route the trainer into the existing per-student grading console. When
   *  set, a "Review Submission" primary button is shown alongside Share. */
  onOpenReview?: () => void;
  onClose: () => void;
}

const initialsOf = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
};

const formatSeconds = (s: number | null | undefined) => {
  if (s == null || !Number.isFinite(s) || s <= 0) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return rem ? `${m}m ${rem}s` : `${m}m`;
};

const CELL_TONE = {
  submitted: "bg-emerald-500 text-white",
  evaluated: "bg-emerald-500 text-white",
  not_answered: "bg-slate-200 text-slate-500",
  pending: "bg-amber-100 text-amber-700",
} as const;

// Per-question status shorthand shown in the numbered navigator.
function statusIcon(status: QuestionBreakdownRow["status"], correct: boolean) {
  if (status === "not_answered") return <MinusCircle size={12} className="text-slate-500" />;
  if (status === "pending") return <HelpCircle size={12} className="text-amber-500" />;
  return correct
    ? <CheckCircle2 size={12} className="text-emerald-600" />
    : <XCircle size={12} className="text-red-600" />;
}

export default function StudentReportModal({
  student,
  assessmentName,
  breakdown,
  recipients,
  onShareSent,
  onOpenReview,
  onClose,
}: StudentReportModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);

  // Focus trap + Escape + background-scroll lock.
  useEffect(() => {
    const previousActive = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
      if (e.key === "Tab" && containerRef.current) {
        // Simple focus trap over focusable elements inside the modal.
        const focusables = containerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = priorOverflow;
      previousActive?.focus?.();
    };
  }, [onClose]);

  const legend = useMemo(() => {
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    let pending = 0;
    for (const q of breakdown) {
      if (q.status === "not_answered") skipped++;
      else if (q.status === "pending") pending++;
      else if (q.scoredMark >= q.totalMark && q.totalMark > 0) correct++;
      else if (q.scoredMark > 0) correct++;
      else incorrect++;
    }
    return { correct, incorrect, skipped, pending };
  }, [breakdown]);

  const answered = legend.correct + legend.incorrect;
  const totalQuestions = breakdown.length;

  // Accuracy — earned points across graded submissions. Falls to em-dash when
  // nothing has been graded yet.
  const accuracy = useMemo(() => {
    const scoredRows = breakdown.filter((q) => q.status === "submitted" || q.status === "evaluated");
    if (!scoredRows.length) return null;
    const earned = scoredRows.reduce((s, q) => s + q.scoredMark, 0);
    const available = scoredRows.reduce((s, q) => s + q.totalMark, 0);
    return available > 0 ? Math.round((earned / available) * 100) : null;
  }, [breakdown]);

  const totalScore = student.scoredMarks ?? null;
  const outOf = student.totalMarks || 0;

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const studentName = student.studentName || "Student";

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-6 bg-black/40"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-report-title"
        className="bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{
          width: "min(1120px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 80px)",
        }}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 text-[13px] font-semibold flex items-center justify-center flex-shrink-0">
              {initialsOf(studentName)}
            </div>
            <div className="min-w-0">
              <div id="student-report-title" className="text-[15px] font-semibold text-gray-900 truncate">
                {studentName}
              </div>
              <div className="text-[12px] text-gray-500 truncate">
                <span className="text-gray-700">{assessmentName}</span>
                {student.email && <> · {student.email}</>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100" aria-label="Print" onClick={() => window.print()}>
              <Printer size={15} />
            </button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Share2 size={13} />
              Share
            </button>
            {onOpenReview && (
              <button
                type="button"
                onClick={onOpenReview}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12.5px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                <ExternalLink size={13} />
                Review Submission
              </button>
            )}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 ml-1"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="p-5 flex flex-col gap-4">
            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <SummaryCell label="Accuracy" value={accuracy == null ? "—" : `${accuracy}%`} />
              <SummaryCell
                label="Marks"
                value={totalScore == null ? "—" : `${Math.round(totalScore * 10) / 10}${outOf > 0 ? ` / ${outOf}` : ""}`}
              />
              <SummaryCell label="Answered" value={totalQuestions ? `${answered} / ${totalQuestions}` : "—"} />
              <SummaryCell label="Time" value={formatSeconds(student.durationSeconds)} />
            </div>

            {/* Numbered navigator */}
            {breakdown.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[11px] uppercase tracking-wider text-gray-500 font-semibold">
                  Question map
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {breakdown.map((q) => {
                    const correct = q.scoredMark >= q.totalMark && q.totalMark > 0;
                    const tone = q.status === "not_answered"
                      ? "bg-slate-100 text-slate-500 border border-slate-200"
                      : q.status === "pending"
                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                        : correct
                          ? "bg-emerald-500 text-white"
                          : q.scoredMark > 0
                            ? "bg-amber-400 text-white"
                            : "bg-red-500 text-white";
                    return (
                      <a
                        key={q.questionId}
                        href={`#q-${q.questionId}`}
                        onClick={() => setExpanded((prev) => new Set(prev).add(q.questionId))}
                        className={`w-8 h-8 rounded flex items-center justify-center text-[11.5px] font-semibold tabular-nums ${tone} hover:opacity-90`}
                        aria-label={`Question ${q.questionNo} — ${q.status}`}
                      >
                        {q.questionNo}
                      </a>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-500">
                  <LegendDot color="bg-emerald-500" label={`${legend.correct} correct`} />
                  <LegendDot color="bg-red-500" label={`${legend.incorrect} incorrect`} />
                  <LegendDot color="bg-slate-300" label={`${legend.skipped} skipped`} />
                  {legend.pending > 0 && <LegendDot color="bg-amber-400" label={`${legend.pending} pending`} />}
                </div>
              </div>
            )}

            {/* Per-question accordion */}
            <div className="flex flex-col gap-2">
              {breakdown.length === 0 ? (
                <div className="p-6 text-center text-[13px] text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  This student has no recorded responses yet.
                </div>
              ) : (
                breakdown.map((q) => {
                  const isOpen = expanded.has(q.questionId);
                  const correct = q.scoredMark >= q.totalMark && q.totalMark > 0;
                  const tone = q.status === "not_answered"
                    ? "border-slate-200"
                    : q.status === "pending"
                      ? "border-amber-200"
                      : correct
                        ? "border-emerald-200"
                        : "border-red-200";
                  return (
                    <div
                      key={q.questionId}
                      id={`q-${q.questionId}`}
                      className={`border rounded-lg bg-white ${tone}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpand(q.questionId)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                        aria-expanded={isOpen}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-[11px] font-semibold text-gray-700 flex-shrink-0">
                            {q.questionNo}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10.5px] uppercase tracking-wide text-gray-400">{q.type}</div>
                            <div className="text-[13px] text-gray-900 truncate max-w-[520px]" title={q.title}>{q.title}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 text-[11.5px] text-gray-500">
                          {statusIcon(q.status, correct)}
                          <span className="tabular-nums">{formatSeconds(q.timeTakenSeconds)}</span>
                          <span className="tabular-nums font-medium text-gray-700">
                            {q.status === "not_answered" || q.status === "pending"
                              ? "—"
                              : `${Math.round(q.scoredMark * 10) / 10}/${q.totalMark}`}
                          </span>
                          {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                        </div>
                      </button>
                      {isOpen && (
                        <div className="border-t border-gray-100 px-4 py-3 text-[12.5px] text-gray-600 space-y-2">
                          {q.status === "not_answered" ? (
                            <div className="text-gray-500 italic">Skipped by student.</div>
                          ) : q.status === "pending" ? (
                            <div className="text-amber-700">Awaiting response — still live.</div>
                          ) : (
                            <>
                              <div className="text-gray-700">
                                Response captured{" "}
                                {q.submittedAt ? (
                                  <span className="text-gray-500">on {new Date(q.submittedAt).toLocaleString()}</span>
                                ) : null}
                                .
                              </div>
                              <div className="text-gray-500">
                                {correct
                                  ? `Full marks — ${q.totalMark} / ${q.totalMark} Marks.`
                                  : q.scoredMark > 0
                                    ? `Partial marks — ${Math.round(q.scoredMark * 10) / 10} / ${q.totalMark} Marks.`
                                    : `No marks — 0 / ${q.totalMark} Marks.`}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {shareOpen && (
        <ShareReportDialog
          onClose={() => setShareOpen(false)}
          studentName={studentName}
          assessmentName={assessmentName}
          recipients={recipients}
          onSent={(rs) => {
            setShareOpen(false);
            onShareSent?.(rs);
            // Return to the Students tab per the spec — the parent handles
            // the toast; we close the report modal here so the flow lands
            // back on the matrix.
            onClose();
          }}
        />
      )}
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-md border border-gray-200 bg-gray-50/60">
      <span className="text-[10.5px] uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-[15px] font-semibold text-gray-900 tabular-nums">{value}</span>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
