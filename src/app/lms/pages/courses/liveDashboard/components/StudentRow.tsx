"use client";

import React from "react";
import { ClipboardCheck, MessageSquare } from "lucide-react";
import type { StudentProgress, TestStatus } from "../types/liveDashboard.types";

interface StudentRowProps {
  student: StudentProgress;
  index: number;
  /** Click handler for the Send Message menu item. */
  onSendMessage: (studentId: string) => void;
  /**
   * Click handler for the Check Answers menu item. Wired by the parent — for
   * now the parent passes a no-op (the menu item is enabled only when the
   * student has submitted, but does nothing until we wire the answers view).
   */
  onCheckAnswers: (studentId: string) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
/**
 * Collapse the raw fields into the three-value status we render.
 *
 * Rules (per product feedback):
 *   - `submitted`   → has submitted their attempt.
 *   - `started`     → currently in the test live (active session). We use
 *                     ONLY `inProgress` here — `completed > 0` no longer
 *                     promotes a row to "started" because a student who
 *                     answered some questions earlier and walked away is
 *                     not actively attending.
 *   - `not-started` → everything else (truly never started, OR previously
 *                     started but no live session).
 */
export function deriveTestStatus(s: StudentProgress): TestStatus {
  if (s.submitted) return "submitted";
  if (s.inProgress) return "started";
  return "not-started";
}

/** Format seconds as `1h 23m 45s` / `12m 34s` / `34s` — compact, no leading zeros. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "—";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// High-contrast, solid-colour badges so the three states are instantly
// distinguishable at a glance (the previous pastel fills were hard to spot on
// a busy dashboard). White text on a saturated background, plus a small dot to
// reinforce the colour cue for users with mild colour-vision differences.
const STATUS_BADGE: Record<TestStatus, { label: string; cls: string; dot: string }> = {
  "not-started":  { label: "Not Started", cls: "bg-slate-500  text-white", dot: "bg-white/80" },
  "started":      { label: "Started",     cls: "bg-amber-500  text-white", dot: "bg-white" },
  "submitted":    { label: "Submitted",   cls: "bg-emerald-600 text-white", dot: "bg-white" },
};

// ─── Row ────────────────────────────────────────────────────────────────────
function StudentRowBase({ student, index, onSendMessage, onCheckAnswers }: StudentRowProps) {
  const s = student;
  const status = deriveTestStatus(s);
  const isCompleted = status === "submitted";

  // "Check Answer" visibility gate — mirrors the Manage Users page's
  // "Submitted / In Progress / Not Submitted" logic: if the student has
  // written even one answer to the DB (completedQuestions > 0) or has
  // finalized their attempt, they have something reviewable. A row that
  // is only "in the room" (inProgress with no persisted answer yet) or
  // truly never started renders no Check Answer button.
  const hasAnswerInDb = (s.completed || 0) > 0 || !!s.submitted;

  // Display ID prefers an explicit field; falls back to the raw id (truncated).
  const displayId = s.studentDisplayId || s.id || "";

  // Time Duration — dash unless completed AND backend supplied durationSeconds.
  const durationText = isCompleted && s.durationSeconds != null
    ? formatDuration(s.durationSeconds)
    : "—";

  const statusBadge = STATUS_BADGE[status];

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-[13px] text-gray-700 font-mono truncate max-w-[120px]" title={displayId}>
        {displayId}
      </td>
      <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{s.studentName}</td>
      <td className="px-4 py-3 text-[13px] text-gray-500">{s.email}</td>
      <td className="px-4 py-3 text-[13px] text-center">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap shadow-sm ${statusBadge.cls}`}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
          {statusBadge.label}
        </span>
      </td>
      <td className="px-4 py-3 text-[13px] text-center text-gray-700">{durationText}</td>
      <td className="px-4 py-3 text-[13px]">
        <div className="flex items-center justify-center gap-2">
          {hasAnswerInDb && (
            <button
              type="button"
              onClick={() => onCheckAnswers(s.id)}
              title="Review this student's answers"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-colors"
            >
              <ClipboardCheck size={13} />
              Check Answer
            </button>
          )}
          <button
            type="button"
            onClick={() => onSendMessage(s.id)}
            title="Send a message to this student"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-indigo-600 bg-white border border-indigo-200 hover:bg-indigo-50 transition-colors"
          >
            <MessageSquare size={13} />
            Send Message
          </button>
        </div>
      </td>
    </tr>
  );
}

// Re-render ONLY when this row's own student data (or index/handlers) changes.
function areEqual(prev: StudentRowProps, next: StudentRowProps) {
  if (prev.index !== next.index) return false;
  if (prev.onSendMessage !== next.onSendMessage) return false;
  if (prev.onCheckAnswers !== next.onCheckAnswers) return false;
  const a = prev.student;
  const b = next.student;
  return (
    a.id === b.id &&
    a.studentName === b.studentName &&
    a.email === b.email &&
    a.studentDisplayId === b.studentDisplayId &&
    a.completed === b.completed &&
    a.inProgress === b.inProgress &&
    a.submitted === b.submitted &&
    a.durationSeconds === b.durationSeconds
  );
}

export const StudentRow = React.memo(StudentRowBase, areEqual);
export default StudentRow;
