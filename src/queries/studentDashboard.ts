import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { queryKeys } from "@/lib/queryKeys";
import { getStudentDashboardAnalytics, getUserSpecificAnalytics } from "@/apiServices/studentAnalytics";
import { attendanceApi, type AttendanceRecord } from "@/apiServices/attendanceApi";
import { fetchMyLearningTime, type LearningTimeSummary } from "@/apiServices/activityLog";

// ─────────────────────────────────────────────────────────────────────────────
// Student dashboard data.
//
// The page used to do all of this in one `useEffect` with four `useState`s and
// no cache, so every visit re-ran the whole chain. The three reads are now
// separate cached queries, which also lets the two secondary ones stay
// non-blocking exactly as the hand-rolled version intended: attendance and
// measured study time resolve after the dashboard is already useful.
//
// Keys deliberately ride roots that are ALREADY excluded from persistence
// ("analytics", "attendance", "activityLogs") — every one of these payloads is
// a specific student's own record and must not be written to localStorage.
// ─────────────────────────────────────────────────────────────────────────────

const FIVE_MIN = 5 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

/** The 180-day window the dashboard reports attendance over. Computed once per
 *  render pass so every per-course key in a given session agrees. */
export const attendanceWindow = () => {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  return { from, to };
};

/**
 * The student's own analytics — `?mine=1`, so the server returns only the
 * courses they are enrolled in instead of every course in the institution.
 * Keyed per user: the payload is caller-scoped, so two accounts on one browser
 * must never share it.
 */
export const useStudentAnalyticsQuery = (userId: string | null) =>
  useQuery({
    queryKey: queryKeys.analytics.studentDashboard(userId),
    queryFn: () => getStudentDashboardAnalytics({ mine: true }),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    gcTime: TEN_MIN,
  });

/**
 * The student's own attendance, one query per enrolled course.
 *
 * This is still N requests — the endpoint is per-course — but each is now
 * server-filtered to this student (`studentId`) and independently cached,
 * where before the page fetched every classmate's records for the whole
 * 180-day window and threw all but its own away (150 records across 10
 * students, to keep 15; 55,940 -> 5,659 bytes per course).
 */
export const useMyAttendanceQuery = (
  courseIds: string[],
  studentId: string | null,
  window: { from: string; to: string },
) => {
  const results = useQueries({
    queries: (studentId ? courseIds : []).map((courseId) => ({
      queryKey: queryKeys.attendance.myRecords(courseId, studentId as string, window.from, window.to),
      queryFn: () =>
        attendanceApi.list(courseId, window.from, window.to, undefined, studentId as string),
      staleTime: FIVE_MIN,
      gcTime: TEN_MIN,
    })),
  });

  // Flatten to the single array the dashboard's metrics expect. A course whose
  // read fails contributes nothing rather than taking the page down — the
  // hand-rolled version used Promise.allSettled for the same reason.
  //
  // `useQueries` returns a NEW array identity every render, so the memo is keyed
  // on a signature of what actually changed. It has to cover the loading flags
  // as well as `dataUpdatedAt`: keyed on timestamps alone, `isLoading` would go
  // stale the moment a query started fetching without its data changing.
  const signature = results.map((r) => `${r.dataUpdatedAt}:${r.isLoading ? 1 : 0}`).join(",");
  return useMemo(
    () => ({
      records: results.flatMap((r) => (r.data as AttendanceRecord[] | undefined) ?? []),
      isLoading: results.some((r) => r.isLoading),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature],
  );
};

/** The signed-in student's measured study time. Self-scoped server-side. */
export const useMyLearningTimeQuery = (userId: string | null) =>
  useQuery<LearningTimeSummary | null>({
    queryKey: queryKeys.activityLogs.myLearningTime(userId),
    queryFn: () => fetchMyLearningTime(),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    gcTime: TEN_MIN,
  });

export { getUserSpecificAnalytics };
