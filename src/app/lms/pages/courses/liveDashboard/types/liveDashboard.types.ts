// ─── Live Dashboard shared types ────────────────────────────────────────────

export interface StudentProgress {
  id: string;
  studentName: string;
  email: string;
  totalQuestions: number;
  completed: number;
  yetToComplete: number;
  notAttempted: number;
  inProgress: boolean;
  completionPercent: number;
  lastActivity: string;
  submitted: boolean;
  /** Recovery & Resume — live socket-presence flag. `false` means the student's
   *  tab is currently disconnected (may still be in an active attempt). Distinct
   *  from `inProgress` which the socket already flips after the 30s grace. */
  isOnline?: boolean;
  /** Server-side attempt lifecycle. `active` while the attempt is in progress;
   *  `submitted` after explicit submit; `terminated` after server-side timer
   *  expiry or an admin/proctor action. Present only after the student has
   *  actually started the assessment. */
  attemptStatus?: 'active' | 'submitted' | 'terminated';
  /** Why a `terminated`/`submitted` attempt ended. Null while active. */
  terminationReason?: 'submit' | 'timer' | 'security' | null;
  /** Resume permission-gate state (see attemptController.js). Drives the
   *  Approve / Reject action in the dashboard row's kebab. */
  resumeState?: 'active' | 'awaiting_approval' | 'approved_for_resume' | 'rejected';
  resumeRequestedAt?: string | null;
  resumeApprovedAt?: string | null;
  /** Display id for the Dashboard Student ID column. Falls back to `id` when absent. */
  studentDisplayId?: string;
  /** Total seconds the student spent on the test (start → submit). Populated by
   *  backend on submission. UI shows the duration only when status === 'completed'. */
  durationSeconds?: number;
  /** Maximum possible marks for the assessment (sum of every question's max).
   *  Computed frontend-side by `computeStudentMarks` (in `utils/computeStudentMarks.ts`)
   *  from the same `/getAll/courses-data/{courseId}` payload reviewSubmission
   *  uses. Optional because the field is undefined for the live-dashboard's
   *  initial render before the course payload lands. */
  totalMarks?: number;
  /** Marks the student has actually earned. Auto-graded MCQs contribute
   *  `isCorrect ? maxScore : 0`; programming / manually-graded questions
   *  contribute the persisted `submission.score` (capped at maxScore).
   *  Undefined while the course payload is still loading OR when the student
   *  has not yet attempted any question — UI renders "—" in those cases. */
  scoredMarks?: number;
  /** Performance-scale label for this student's percentage, derived from the
   *  exercise's Grade Settings bands (e.g. 50% → "Average"). Undefined when
   *  there's no percentage to map (no marks yet) or no bands configured.
   *  Computed in the dashboard marks pipeline so every consumer (report table,
   *  export) reads the same value. */
  scaleLabel?: string;
}

/**
 * Row-status used by the Dashboard table.
 *
 * Recovery & Resume expansion — the base states (`not-started` / `started` /
 * `submitted`) still mean the same thing. Two new states surface the
 * attempt-lifecycle nuances the recovery system exposes:
 *   - `disconnected` → started an attempt, live socket is currently down
 *                      (browser closed / crashed / lost Wi-Fi) but attempt is
 *                      still `active` on the server. Distinct from `started`
 *                      because there's no live presence to show.
 *   - `terminated`   → server ended the attempt without an explicit submit —
 *                      timer expiry OR a security violation. Kept separate
 *                      from `submitted` so trainers can spot enforcement.
 */
export type TestStatus = 'not-started' | 'started' | 'disconnected' | 'awaiting-approval' | 'submitted' | 'terminated';

export interface LiveDashboardResponse {
  assessmentName: string;
  courseName?: string;
  startDate: string;
  endDate: string;
  totalStudents: number;
  students: StudentProgress[];
}

// ─── Student details (per-student question view) ─────────────────────────────

export type QuestionStatus = "submitted" | "pending" | "in_progress";

export interface StudentQuestion {
  id: string;
  questionNo: string;
  questionTitle: string;
  questionType: string;
  marks: number;
  status: QuestionStatus;
  submittedAt: string | null;
  timeTakenSeconds: number;
}

export interface StudentDetailsInfo {
  studentName: string;
  email: string;
  assessmentName: string;
  totalQuestions: number;
  completed: number;
  yetToComplete: number;
  completionPercent: number;
}

export interface StudentDetailsResponse extends StudentDetailsInfo {
  questions: StudentQuestion[];
}

// ─── Socket event payloads (server → teacher dashboard) ──────────────────────

/** "dashboard:student_update" — partial stats for one student row. */
export interface DashboardStudentUpdate {
  studentId: string;
  completed?: number;
  yetToComplete?: number;
  notAttempted?: number;
  completionPercent?: number;
  inProgress?: boolean;
  lastActivity?: string;
  submitted?: boolean;
  durationSeconds?: number;
  /** Auto-graded MCQ marks + persisted manual grading. Emitted whenever a
   *  student submits an answer or a grader saves a score. */
  scoredMarks?: number;
  /** Rarely changes (only if the question pool is reshaped mid-session) but
   *  carried on the same event for completeness. */
  totalMarks?: number;
  /** Recovery & Resume — socket presence + attempt lifecycle. Emitted by the
   *  sweep job (`liveDashboardSocket.js:startExpirySweep`) and the offline
   *  grace timer (`scheduleOfflineFlip`). */
  isOnline?: boolean;
  attemptStatus?: 'active' | 'submitted' | 'terminated';
  terminationReason?: 'submit' | 'timer' | 'security' | null;
  resumeState?: 'active' | 'awaiting_approval' | 'approved_for_resume' | 'rejected';
  resumeRequestedAt?: string | null;
  resumeApprovedAt?: string | null;
}

/** "dashboard:student_joined" — a full new student row. */
export type DashboardStudentJoined = StudentProgress;

/** "student:question_update" — one question row for the details view. */
export interface StudentQuestionUpdate {
  studentId: string;
  questionId: string;
  status: QuestionStatus;
  submittedAt: string | null;
  timeTakenSeconds: number;
}
