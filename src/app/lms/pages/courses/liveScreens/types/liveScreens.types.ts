// ─── Live Screen Monitoring shared types ────────────────────────────────────

export type ScreenStatus = "sharing" | "online" | "offline";

export interface ScreenStudent {
  id: string;
  studentName: string;
  email: string;
  registerNumber: string;
  isSharingScreen: boolean;
  warningCount: number;
  status: ScreenStatus;
  startedAt: string | null;
  lastActivity: string;
  submitted: boolean;
}

export interface LiveScreensResponse {
  assessmentName: string;
  totalStudents: number;
  students: ScreenStudent[];
}

export interface ScreenViolationItem {
  id: string;
  type: string;   // share_stopped | not_full_screen | tab_switch | reconnect | manual_warning | other
  detail: string;
  at: string | null;
}

export interface ScreenViolationsResponse {
  studentName: string;
  email: string;
  registerNumber: string;
  isSharingScreen: boolean;
  warningCount: number;
  startedAt: string | null;
  submitted: boolean;
  lastActivity: string;
  violations: ScreenViolationItem[];
}

// ─── Socket event payloads (server → proctor dashboard) ──────────────────────

/** "screen:active_students" — full list when the proctor first joins. */
export interface ScreenActiveStudents {
  students: Array<{ studentId: string; studentName: string; email: string; startedAt: number }>;
}

/** "screen:student_available" — a student started sharing. */
export interface ScreenStudentAvailable {
  studentId: string;
  studentName: string;
  email: string;
  startedAt: number;
  warningCount: number;
}

/** "screen:student_stopped" — a student stopped/ended/disconnected. */
export interface ScreenStudentStopped {
  studentId: string;
  reason: string;
  warningCount?: number;
}

/** "screen:student_violation" — a violation was logged for a student. */
export interface ScreenStudentViolation {
  studentId: string;
  type: string;
  detail: string;
  warningCount: number;
}
