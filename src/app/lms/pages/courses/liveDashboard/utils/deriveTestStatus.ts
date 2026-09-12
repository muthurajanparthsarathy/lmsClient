import type { StudentProgress, TestStatus } from "../types/liveDashboard.types";

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
 * ── Why "Completed" requires `attemptStatus === 'submitted'` ────────────────
 * The row's `submitted` boolean is NOT a reliable "the student pressed
 * Finish" signal — several per-question paths set it while the student is
 * still mid-test. `ExamSession.status = 'submitted'` has exactly one writer:
 * `finaliseAttempt` (POST /courses/attempt/submit), which only the Finish /
 * Submit-Test action calls. Gating on it means a trainer sees "Completed"
 * only once the student has actually finished. Timer expiry and security
 * stops still land on `terminated`, which the first rule catches.
 */
export function deriveTestStatus(s: StudentProgress): TestStatus {
  if (s.attemptStatus === "terminated") return "terminated";
  if (s.attemptStatus === "submitted") return "submitted";
  if (s.resumeState === "awaiting_approval") return "awaiting-approval";
  if (s.attemptStatus === "active" && s.isOnline === false) return "disconnected";
  if (s.inProgress) return "started";
  if ((s.completed || 0) > 0 || s.submitted) return "started";
  return "not-started";
}
