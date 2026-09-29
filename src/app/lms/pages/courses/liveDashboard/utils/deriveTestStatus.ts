import type { StudentProgress, TestStatus } from "../types/liveDashboard.types";

/**
 * Row status — the trainer sees exactly three buckets on the Live Dashboard:
 *
 *   • `submitted`    — student pressed Submit (terminal, clean end). Rendered
 *                      as the "Completed" chip.
 *   • `started`      — the student is currently attending the test.
 *   • `not-started`  — the student has not begun (or is no longer attending
 *                      and hasn't submitted).
 *
 * Trainer feedback: earlier extra states ("terminated", "awaiting approval",
 * "disconnected") added noise without changing what the trainer could do
 * next. They're all collapsed here — a terminated attempt without an
 * explicit submit reads as `not-started`, an in-flight approval reads as
 * `started`, and any offline signal reads as `not-started`.
 *
 * ── Why "Completed" requires `attemptStatus === 'submitted'` ────────────────
 * The row's `submitted` boolean is NOT a reliable "the student pressed
 * Finish" signal — several per-question paths set it while the student is
 * still mid-test. `ExamSession.status = 'submitted'` has exactly one writer:
 * `finaliseAttempt` (POST /courses/attempt/submit), which only the Finish /
 * Submit-Test action calls. Gating on it means a trainer sees "Completed"
 * only once the student has actually finished.
 */
export function deriveTestStatus(s: StudentProgress): TestStatus {
  // Explicit submit → Completed. Anything else short of that stays in the
  // Started / Not-Started split.
  if (s.attemptStatus === "submitted") return "submitted";

  // Currently attending → Started. Covers the active socket AND the
  // reactive "student has completed some questions but the session flag
  // hasn't flipped yet" transitional state.
  if (s.attemptStatus === "active" && s.isOnline !== false) return "started";
  if (s.inProgress) return "started";
  if ((s.completed || 0) > 0 || s.submitted) return "started";

  // Everything else — never began, or was terminated / walked away without
  // submitting, or is offline — reads as Not Started per the trainer's
  // "if not attending → not started" rule.
  return "not-started";
}
