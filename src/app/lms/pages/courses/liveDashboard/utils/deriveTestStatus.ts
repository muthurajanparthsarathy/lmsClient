import type { StudentProgress, TestStatus } from "../types/liveDashboard.types";

/**
 * Row status — the trainer sees exactly three buckets on the Live Dashboard:
 *
 *   • `started`      — the learner is attending right now (in the test, or
 *                      has the assignment editor open), or began and has not
 *                      finished yet.
 *   • `submitted`    — finished, and not working in it right now. Rendered
 *                      as the "Completed" chip.
 *   • `not-started`  — has not begun.
 *
 * Trainer feedback: earlier extra states ("terminated", "awaiting approval",
 * "disconnected") added noise without changing what the trainer could do
 * next. They're all collapsed here — a terminated attempt without an
 * explicit submit reads as `not-started` or `started` by its answers, an
 * in-flight approval reads as `started`.
 *
 * Attending wins over stored completion. Saving one answer of a multi-question
 * or multi-file assignment is not finishing it, and a learner who re-opens a
 * finished assignment is working again. A submitted You Do attempt can't be
 * re-entered, and the server never reports one as attending.
 */
export function deriveTestStatus(s: StudentProgress): TestStatus {
  // Attending right now → Started.
  if (s.inProgress) return "started";
  if (s.attemptStatus === "active" && s.isOnline !== false) return "started";

  // Finished → Completed. `attemptStatus` is the server's word (the You Do
  // exam session, or a We Do assignment's Finish); `parentSubmitted` is the
  // stored answer's own final status from the course payload.
  if (s.attemptStatus === "submitted" || s.parentSubmitted) return "submitted";

  // Began but neither attending nor finished → still Started.
  if ((s.completed || 0) > 0 || s.submitted) return "started";

  return "not-started";
}
