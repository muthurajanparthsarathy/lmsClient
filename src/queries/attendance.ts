import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { attendanceApi, type AttendanceRecord, type AttendanceSummary } from "@/apiServices/attendanceApi";
import { courseRosterQuery, type CourseRoster } from "@/queries/courseRoster";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance shared queries.
//
// The management grid, the Report page, the Analytics page and the Report
// modal all read the SAME two things for a course: its enrolled-student roster
// and its attendance records for a date range. Each view used to keep its own
// query key for byte-identical requests — ["report-students"] vs
// ["analytics-students"] vs ["report-modal-batches"], and likewise for the
// records — so moving between views re-downloaded both.
//
// One key each now. The two roster shapes (a flat Student[] for the pages, a
// batch-grouped BatchGroup[] for the modal) are derived with `select`, which
// transforms per observer WITHOUT splitting the cache entry.
//
// The roster itself lives in queries/courseRoster.ts — shared with the
// enrollment tab and the feedback screens, which read the same request.
// ─────────────────────────────────────────────────────────────────────────────

export type Student = {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  userId: string;
};

export type BatchGroup = {
  id: string;
  name: string;
  students: Student[];
};

const TWO_MIN = 2 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

const toStudent = (user: any): Student => ({
  _id: user._id || user.id,
  firstName: user.firstName || "",
  lastName: user.lastName || "",
  email: user.email || "",
  userId: user.userId || user.employeeId || "",
});

const isStudent = (user: any): boolean => {
  const role =
    typeof user?.role === "string"
      ? user.role
      : user?.role?.renameRole || user?.role?.name || "";
  return String(role).toLowerCase() === "student";
};

/**
 * Every batch of the course with its enrolled students — including batches
 * whose student list is empty, so the flat projection below stays faithful to
 * the original `flatMap(batch => batch.users)` ordering. Consumers that want
 * only non-empty batches filter in their own `select`.
 *
 * Derived from the shared raw roster (queries/courseRoster.ts) rather than
 * fetched here: the feedback screens and the enrollment tab read the same
 * request, so a private key would re-fragment exactly what unifying it fixed.
 */
const toBatchGroups = (roster: CourseRoster): BatchGroup[] =>
  (roster?.batchAndParticipants || []).map((b) => ({
    id: String(b?._id || b?.batchName || Math.random()),
    name: String(b?.batchName || "Batch"),
    students: (b?.users || [])
      .map((e) => (e?.user || e) as any)
      .filter(isStudent)
      .map(toStudent),
  }));

/** Flat roster, in the original batch-then-user order. A student enrolled in
 *  two batches still appears twice — the pages' own de-duplication (or lack of
 *  it) is unchanged. */
export const useCourseStudentsQuery = (courseId: string, enabled = true) =>
  useQuery({
    ...courseRosterQuery(courseId, enabled),
    select: (roster: CourseRoster) => toBatchGroups(roster).flatMap((g) => g.students),
  });

/** Batch-grouped roster with empty batches dropped (the modal's batch picker
 *  only offers batches that actually have students). */
export const useCourseBatchGroupsQuery = (courseId: string, enabled = true) =>
  useQuery({
    ...courseRosterQuery(courseId, enabled),
    select: (roster: CourseRoster) =>
      toBatchGroups(roster).filter((g) => g.students.length > 0),
  });

export const useAttendanceRecordsQuery = (
  courseId: string,
  from?: string,
  to?: string,
  enabled = true,
) =>
  useQuery<AttendanceRecord[]>({
    queryKey: queryKeys.attendance.records(courseId, from, to),
    queryFn: () => attendanceApi.list(courseId, from, to),
    enabled: !!courseId && enabled,
    staleTime: TWO_MIN,
    gcTime: TEN_MIN,
  });

/**
 * Attendance cells for a SET of students — the page of rows on screen.
 *
 * The Report grid renders one cell per (visible student x working day), so it
 * asks for exactly those students' rows instead of the whole course's. Disabled
 * until there is at least one id, so an empty page fires no request.
 */
export const useAttendanceRecordsForQuery = (
  courseId: string,
  from: string,
  to: string,
  studentIds: string[],
  enabled = true,
) =>
  useQuery<AttendanceRecord[]>({
    queryKey: queryKeys.attendance.recordsFor(courseId, from, to, studentIds),
    // slim: the grid paints one letter per cell and reads nothing else.
    queryFn: () => attendanceApi.list(courseId, from, to, undefined, undefined, studentIds, true),
    enabled: !!courseId && studentIds.length > 0 && enabled,
    placeholderData: keepPreviousData,
    staleTime: TWO_MIN,
    gcTime: TEN_MIN,
  });

/**
 * The Report/Analytics aggregates over the whole selection.
 *
 * These are sums over every matching record — totals, bands, at-risk count,
 * trend, best day — so they cannot be derived from a page of rows. Computing
 * them in Mongo is what makes the grid above safe to scope to five students.
 *
 * `scope.studentIds` narrows the aggregation to a set of students; the
 * Analytics page passes its roster. An EMPTY array is no scope at all (the
 * server reads it the way the list endpoint does), so gate `enabled` on the
 * roster having arrived rather than relying on the empty list to match nobody.
 */
export const useAttendanceSummaryQuery = (
  courseId: string,
  from: string,
  to: string,
  scope: { batchId?: string; student?: string; status?: string; studentIds?: string[] } = {},
  enabled = true,
) =>
  useQuery<AttendanceSummary>({
    queryKey: queryKeys.attendance.summary(courseId, from, to, scope as Record<string, unknown>),
    queryFn: () => attendanceApi.summary(courseId, from, to, scope),
    enabled: !!courseId && enabled,
    placeholderData: keepPreviousData,
    staleTime: TWO_MIN,
    gcTime: TEN_MIN,
  });

/**
 * Refresh everything attendance-related after a write (reset / bulk save).
 * Prefix invalidation covers the overview's marked-today flags and every
 * cached date-range slice of records, whichever view populated them.
 */
export const useInvalidateAttendance = () => {
  const qc = useQueryClient();
  return useCallback(
    () => qc.invalidateQueries({ queryKey: queryKeys.attendance.all }),
    [qc],
  );
};
