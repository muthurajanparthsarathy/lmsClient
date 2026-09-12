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
 * Row status (Recovery & Resume expansion).
 *
 *   • `terminated`   — server ended the attempt without an explicit submit
 *                      (timer expiry OR a security violation). Distinct from
 *                      `submitted` so trainers can spot enforcement.
 *   • `submitted`    — student pressed Submit (terminal, clean end).
 *   • `disconnected` — has an active attempt but the live socket is down
 *                      (browser closed / crashed / lost Wi-Fi). Attempt is
 *                      NOT lost — the recovery system will resume it.
 *   • `started`      — live session, actively in the attempt.
 *   • `not-started`  — truly never began.
 *
 * Rules:
 *   1. `attemptStatus === 'terminated'` → terminated (regardless of anything else).
 *   2. `attemptStatus === 'submitted'` OR `submitted` → submitted.
 *   3. `attemptStatus === 'active'` AND NOT online → disconnected.
 *   4. Live session (`inProgress`) OR any persisted answer → started.
 *   5. Fallback → not-started.
 */
export function deriveTestStatus(s: StudentProgress): TestStatus {
  if (s.attemptStatus === "terminated") return "terminated";
  if (s.submitted || s.attemptStatus === "submitted") return "submitted";
  // Awaiting approval takes precedence over disconnected — trainer should
  // spot pending requests first.
  if (s.resumeState === "awaiting_approval") return "awaiting-approval";
  if (s.attemptStatus === "active" && s.isOnline === false) return "disconnected";
  if (s.inProgress) return "started";
  if ((s.completed || 0) > 0) return "started";
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
  "not-started":       { label: "Not Started",       cls: "bg-slate-500   text-white",   dot: "bg-white/80" },
  "started":           { label: "In Progress",       cls: "bg-amber-500   text-white",   dot: "bg-white"    },
  "disconnected":      { label: "Disconnected",      cls: "bg-orange-500  text-white",   dot: "bg-white"    },
  "awaiting-approval": { label: "Awaiting Approval", cls: "bg-yellow-500  text-white",   dot: "bg-white"    },
  "submitted":         { label: "Submitted",         cls: "bg-emerald-600 text-white",   dot: "bg-white"    },
  "terminated":        { label: "Terminated",        cls: "bg-red-600     text-white",   dot: "bg-white"    },
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
    // Borderless row: no bottom hairline, no divider — rows separate only
    // via hover-tint, matching the borderless listing style the user asked
    // for. Typography aligned to the app's shared listing:
    //   • Name → text-sm font-medium text-gray-900 (heading)
    //   • Meta (email, id, duration) → text-sm text-gray-500 (subtle)
    // Same 14px baseline as Client Management + User Management rows.
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-4 py-3 text-sm text-gray-500 font-mono truncate max-w-[120px]" title={displayId}>
        {displayId}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.studentName}</td>
      <td className="px-4 py-3 text-sm text-gray-500">{s.email}</td>
      <td className="px-4 py-3 text-sm text-center">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${statusBadge.cls}`}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
          {statusBadge.label}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-center text-gray-500">{durationText}</td>
      <td className="px-4 py-3 text-sm">
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
    a.durationSeconds === b.durationSeconds &&
    // Recovery & Resume — repaint the badge when lifecycle / presence /
    // resume-permission state changes on the wire.
    a.attemptStatus === b.attemptStatus &&
    a.isOnline === b.isOnline &&
    a.resumeState === b.resumeState
  );
}

export const StudentRow = React.memo(StudentRowBase, areEqual);
export default StudentRow;
