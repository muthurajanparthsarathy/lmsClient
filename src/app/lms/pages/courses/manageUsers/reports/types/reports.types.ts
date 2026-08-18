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
 * Collapsed three-value status used by the Dashboard table.
 *
 * Semantics (per product feedback):
 *   - `started`     → student is CURRENTLY attending the test live right now.
 *                     They have an active session — `inProgress === true`.
 *   - `not-started` → catch-all "not currently in the test". Covers both the
 *                     truly-never-started case AND the case where a student
 *                     began at some point but has since walked away (no
 *                     active session, no submission). The previous
 *                     "In Progress" status has been removed — partial
 *                     progress without a live session is treated as
 *                     not-started.
 *   - `submitted`   → student has submitted their attempt (final).
 */
export type TestStatus = 'not-started' | 'started' | 'submitted';

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
