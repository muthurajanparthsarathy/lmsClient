"use client";

import React, { useEffect, useRef } from "react";
import { X, CheckCircle2, MinusCircle, HelpCircle, Clock, ExternalLink } from "lucide-react";

import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";

// ── Question-cell popover ───────────────────────────────────────────────────
//
// Anchored to the matrix cell the caller clicked. Compact per-response view
// with a single primary action: "Review Submission" — the trainer's existing
// grading console. No competing grade fields, no fake scoring UI — grading
// happens in one place, the review page.

export interface QuestionCellPopoverProps {
  row: QuestionBreakdownRow;
  studentName: string;
  anchor: { left: number; top: number; width: number; height: number };
  /** Optional — parent hands this in when it can navigate into the grader.
   *  Absent when the popover is rendered outside a routed context. */
  onOpenReview?: () => void;
  onClose: () => void;
}

const STATUS_META: Record<string, { label: string; icon: React.ReactNode; tone: string }> = {
  evaluated: { label: "Manually Evaluated", icon: <CheckCircle2 size={14} className="text-emerald-600" />, tone: "text-emerald-700 bg-emerald-50" },
  submitted: { label: "Auto Evaluated", icon: <CheckCircle2 size={14} className="text-emerald-600" />, tone: "text-emerald-700 bg-emerald-50" },
  not_answered: { label: "Not Attempted", icon: <MinusCircle size={14} className="text-slate-500" />, tone: "text-slate-700 bg-slate-100" },
  pending: { label: "Needs Review", icon: <HelpCircle size={14} className="text-amber-500" />, tone: "text-amber-700 bg-amber-50" },
};

const formatSeconds = (s: number | null | undefined) => {
  if (s == null || !Number.isFinite(s) || s <= 0) return "—";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
};

export default function QuestionCellPopover({
  row,
  studentName,
  anchor,
  onOpenReview,
  onClose,
}: QuestionCellPopoverProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const width = 320;
  const height = onOpenReview ? 250 : 200;
  const spaceBelow = typeof window !== "undefined" ? window.innerHeight - (anchor.top + anchor.height) : 500;
  const showAbove = spaceBelow < height + 12;
  const top = showAbove ? anchor.top - height - 8 : anchor.top + anchor.height + 8;
  const rightBoundary = typeof window !== "undefined" ? window.innerWidth : 1280;
  const left = Math.max(8, Math.min(rightBoundary - width - 8, anchor.left));

  const meta = STATUS_META[row.status] || STATUS_META.pending;
  const marksLabel = row.status === "pending" || row.status === "not_answered"
    ? "—"
    : `${Math.round(row.scoredMark * 10) / 10} / ${row.totalMark} Marks`;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Question ${row.questionNo} response`}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl"
      style={{ top, left, width }}
    >
      <div className="flex items-start justify-between gap-2 px-3 py-2.5 border-b border-gray-100">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-wide text-gray-400">
            Question {row.questionNo} · {row.type}
          </div>
          <div className="text-[13px] font-medium text-gray-900 truncate" title={row.title}>{row.title}</div>
          <div className="text-[11px] text-gray-500 truncate">{studentName}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded hover:bg-gray-100 text-gray-400"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${meta.tone}`}>
          {meta.icon}
          {meta.label}
        </div>
        <div className="grid grid-cols-2 gap-2 text-[12px]">
          <div className="flex items-center gap-1.5 text-gray-500">
            <Clock size={12} className="text-gray-400" />
            <span>Time:</span>
            <span className="font-medium text-gray-800 tabular-nums">{formatSeconds(row.timeTakenSeconds)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-gray-500">
            <span>Marks:</span>
            <span className="font-medium text-gray-800 tabular-nums">{marksLabel}</span>
          </div>
        </div>
        {row.submittedAt && (
          <div className="text-[11px] text-gray-500">
            Submitted <span className="text-gray-700">{new Date(row.submittedAt).toLocaleString()}</span>
          </div>
        )}
      </div>
      {onOpenReview && (
        <div className="px-3 py-2.5 border-t border-gray-100 bg-gray-50/60">
          <button
            type="button"
            onClick={onOpenReview}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
          >
            <ExternalLink size={12} />
            Review Submission
          </button>
        </div>
      )}
    </div>
  );
}
