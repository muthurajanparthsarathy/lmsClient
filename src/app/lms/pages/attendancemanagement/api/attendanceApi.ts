// attendanceApi.ts — React Query service for per-day student attendance.
// Endpoints mirror server/routes/courses/attendanceRoutes.js.

import { http as apiClient } from "@/lib/http";

// ── Types ──────────────────────────────────────────────────────────────────
export type AttendanceStatus = "P" | "A" | "H";

export type HalfPeriod = "first" | "second" | "";

export interface AttendanceRecord {
  _id?: string;
  courseId: string;
  studentId: string;
  date: string;            // ISO
  status: AttendanceStatus;
  reason?: string;         // Filled for A / H marks, empty for P.
  halfPeriod?: HalfPeriod; // Only meaningful when status is 'H'.
  sessionId?: string | null;
  markedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Payload for a single cell change — status can be null/empty to clear.
export interface AttendanceMark {
  studentId: string;
  date: string;            // "YYYY-MM-DD" or ISO
  status: AttendanceStatus | "" | null;
  reason?: string;         // Required when status is A / H; ignored otherwise.
  halfPeriod?: HalfPeriod; // Required when status is 'H'.
  sessionId?: string | null;
}

// One batch of a course as the overview reports it.
export interface OverviewBatch {
  _id: string;
  batchName: string;
  studentCount: number;
  markedToday: boolean;
  // Whether the REQUESTER is enrolled in this batch (staff membership) —
  // always true for the batches a non-admin sees.
  mine: boolean;
  // This batch's training end ("YYYY-MM-DD") — deviations scoped to it
  // extend it past its siblings'. Empty when no end is computable yet.
  trainingEnd: string;
}

// One course row of the Attendance Management listing.
export interface OverviewCourse {
  _id: string;
  courseName: string;
  courseCode: string;
  category: string;
  serviceModal: string;
  clientName: string;
  coursePath: string;
  // The TRAINING window — what "active" means for attendance. hasSchedule
  // false = no Program Calendar saved, nothing to attend.
  hasSchedule: boolean;
  trainingStart: string; // "YYYY-MM-DD", empty without a schedule
  trainingEnd: string;   // latest batch end, empty when not computable
  batches: OverviewBatch[];
  totalStudents: number;
  legacyMarkedToday: boolean;
}

// ── Service ────────────────────────────────────────────────────────────────
/** Per-student P/A/H tallies over the requested range. The unmarked count is
 *  `workingDays - (p + a + h)`: a day carrying any mark is always a working
 *  day, so a student's marks in range ARE their marks on working days. */
export type AttendanceStudentTally = {
  studentId: string;
  p: number;
  a: number;
  h: number;
};

export type AttendanceSummary = {
  /** Days in range carrying at least one mark — what lets a marked Saturday
   *  count as a working day. */
  markedDays: string[];
  workingDayKeys: string[];
  workingDays: number;
  /** Every student holding records, WITHOUT the status filter applied, so the
   *  page can tell "filtered out" from "holds no records at all". */
  students: AttendanceStudentTally[];
  /** Per-day P/A/H over the students passing the filters — the trend and
   *  best-day series. */
  perDay: { key: string; P: number; A: number; H: number }[];
  totalRecords: number;
};

export const attendanceApi = {
  /** Fetch attendance for a course between two dates (inclusive), optionally
   *  scoped to one batch. */
  /** `studentId` narrows the response to ONE student's rows — the student
   *  dashboard's own read. Omitted, the whole course comes back, which is what
   *  the marking grid and the reports need. */
  /** `studentIds` narrows to a set of students — the Report grid renders
   *  cells only for the page of students on screen. */
  async list(courseId: string, from?: string, to?: string, batchId?: string, studentId?: string, studentIds?: string[], slim?: boolean): Promise<AttendanceRecord[]> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (batchId) params.batchId = batchId;
    if (studentId) params.studentId = studentId;
    if (studentIds && studentIds.length) params.studentIds = studentIds.join(",");
    if (slim) params.slim = "1";
    const { data } = await apiClient.get(`/attendance/get/${courseId}`, { params });
    return (data?.data as AttendanceRecord[]) || [];
  },

  /**
   * The Report/Analytics aggregates for a course over a date range.
   *
   * Both pages used to pull every record in the range and build a student x day
   * grid in the browser just to total it. Records grow as students x marked
   * days, so this returns the tallies instead: the working-day list, one P/A/H
   * row per student, and the per-day series behind the trend and best-day
   * cards. The page keeps its own status rule and applies it to these.
   *
   * `studentIds` scopes the whole summary to a SET of students — the Analytics
   * page sends its roster, because its charts count students rather than
   * records and a course can hold records for people who are in none of its
   * batches. Same precedence as the list endpoint: a single `student` wins,
   * and an empty list is no scope at all rather than "match nobody" — so
   * callers must not send one before their roster has loaded.
   */
  async summary(
    courseId: string,
    from?: string,
    to?: string,
    opts: { batchId?: string; student?: string; status?: string; studentIds?: string[] } = {},
  ): Promise<AttendanceSummary> {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    if (opts.batchId) params.batchId = opts.batchId;
    if (opts.student && opts.student !== "all") params.student = opts.student;
    if (opts.status && opts.status !== "all") params.status = opts.status;
    if (opts.studentIds && opts.studentIds.length) params.studentIds = opts.studentIds.join(",");
    const { data } = await apiClient.get(`/attendance/summary/${courseId}`, { params });
    return (data?.data as AttendanceSummary) || {
      markedDays: [], workingDayKeys: [], workingDays: 0, students: [], perDay: [], totalRecords: 0,
    };
  },

  /** Bulk upsert (empty status → delete). batchId scopes the marks to the
   *  batch they were taken under — part of the record's identity. */
  async bulkSave(courseId: string, records: AttendanceMark[], batchId?: string) {
    const { data } = await apiClient.post(`/attendance/save/${courseId}`, {
      records,
      ...(batchId ? { batchId } : {}),
    });
    return data as { upserted: number; deleted: number };
  },

  /** The batch's training window — the marking boundary the server enforces
   *  on save. exists:false = no Program Calendar (nothing to attend);
   *  endDate null = no computable end yet (hours/sessions missing), only the
   *  start bound applies. */
  async window(courseId: string, batchId?: string): Promise<{ exists: boolean; startDate?: string; endDate?: string | null }> {
    const params: Record<string, string> = {};
    if (batchId) params.batchId = batchId;
    const { data } = await apiClient.get(`/attendance/window/${courseId}`, { params });
    return (data?.data as { exists: boolean; startDate?: string; endDate?: string | null }) || { exists: false };
  },

  /** The Attendance Management listing in one request: every course the
   *  requester may mark (admin), review (viewer — POC / L&D Head / Sub Head),
   *  or is enrolled in (staff), with per-batch counts and marked-today flags.
   *  `date` is the requester's local day (YYYY-MM-DD). */
  async overview(date: string): Promise<{ role: 'admin' | 'viewer' | 'staff'; data: OverviewCourse[] }> {
    const { data } = await apiClient.get(`/attendance/overview`, { params: { date } });
    const role = data?.role === 'admin' ? 'admin' : data?.role === 'viewer' ? 'viewer' : 'staff';
    return { role, data: (data?.data as OverviewCourse[]) || [] };
  },

  /** Wipe attendance for a course (optionally scoped by a date range). */
  async reset(courseId: string, from?: string, to?: string) {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const { data } = await apiClient.delete(`/attendance/reset/${courseId}`, { params });
    return data as { deleted: number };
  },
};
