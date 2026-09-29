"use client";

/**
 * Data access for the L&D dashboard.
 *
 * Each endpoint is fetched independently so one failing source degrades a
 * single panel rather than the whole page — the primary analytics call is the
 * only one that gates the layout.
 *
 * Every read rides the app's SHARED React Query keys instead of a private
 * useState + useEffect + fetch. Before, this hook and the L&D console's own
 * views each kept their own uncached copy of the same five requests — the
 * 12-second analytics call among them — and remade all of them on every
 * rail-view switch. These are the same cache entries the console, Attendance
 * Management and the Approvals page fill, so each endpoint is requested once
 * and survives navigation. The trainer dashboard imports the same hooks
 * (features/dashboard/hooks/use-trainer-dashboard.ts) rather than keeping a
 * second copy of the fetch layer.
 */

import { useMemo, useState } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { api } from "@/app/lms/pages/clientmanagement/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import { readStoredUserData } from "@/app/lms/shared/ui/navItems";
import { attendanceApi } from "@/app/lms/pages/attendancemanagement/api/attendanceApi";
import { courseStructureApi } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import type { Async, DashFilter, DashboardModel } from "../types";
import { deriveModel, parseAnalytics, parseFeedback, pickFocusCourse } from "../lib/metrics";

/**
 * Run a shared query entry and shape its payload for this caller.
 *
 * `map` runs in a useMemo keyed on the raw payload rather than through React
 * Query's `select`: parseAnalytics walks every student in the institution and
 * an inline lambda handed to `select` re-runs on every render. One map per
 * payload change is also what the old hand-rolled hook did.
 */
function useShared<T>(
  options: UseQueryOptions<any, Error, any, any>,
  map: (j: any) => T,
  fallback = "Could not load",
): Async<T> {
  const q = useQuery(options);
  const raw = q.data;
  const data = useMemo(
    () => (raw === undefined ? null : map(raw)),
    // `map` is intentionally excluded — callers pass inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw],
  );
  // A gated query (`enabled: false`) is idle, not loading — reporting it as
  // loading would hold the dashboard on a permanent skeleton.
  const idle = options.enabled === false;
  return {
    loading: !idle && q.isPending,
    error: q.isError ? (q.error as Error)?.message || fallback : "",
    data,
  };
}

const arr = (j: any) => (Array.isArray(j?.data) ? j.data : []);
const rows = (j: any) => (Array.isArray(j) ? j : []);

/** The signed-in user's id, read once — per-user cache keys need it so a
 *  shared browser never paints one account's approval queue for another. */
export function useUserId(): string | null {
  const [id] = useState<string | null>(() => readStoredUserData()?._id ?? null);
  return id;
}

/** The staff / L&D analytics roll-up, already parsed into rows + students.
 *  Shared queryKeys.analytics.staffStudents(userId) — the slowest call in the
 *  app (~12 s of server-side computation), so it must be paid once. */
export function useAnalyticsPayload() {
  const userId = useUserId();
  return useShared(
    {
      queryKey: queryKeys.analytics.staffStudents(userId),
      queryFn: () => api.get<any>("/analytics/staff/analytics/students"),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    parseAnalytics,
    "Could not load analytics",
  );
}

/** FULL course-structure list — shared ['courseStructures'] entry. The
 *  trainer join below walks batchAndParticipants[].users[].user, which the
 *  ?summary=1 projection drops entirely, so this cannot use the summary. */
export function useRosterList(): Async<any[]> {
  return useShared(
    courseStructureApi.getAll() as UseQueryOptions<any, Error, any, any>,
    rows,
    "Could not load courses",
  );
}

/** Attendance overview for one day — shared queryKeys.attendance.overview(date),
 *  through the same fetcher Attendance Management uses, so the cached shape
 *  stays `{ role, data }` and both surfaces share one entry. */
export function useAttendanceOverviewDay(date: string): Async<any[]> {
  return useShared(
    {
      queryKey: queryKeys.attendance.overview(date),
      queryFn: () => attendanceApi.overview(date),
      staleTime: 30_000,
    },
    arr,
    "Could not load attendance",
  );
}

/** The caller's approval queue — shared queryKeys.approvals.pending(userId).
 *  `refetchOnMount: "always"` matches the Approvals page: items are acted on
 *  from view-resources, which does not invalidate this key. */
export function usePendingApprovalsList(): Async<any[]> {
  const userId = useUserId();
  return useShared(
    {
      queryKey: queryKeys.approvals.pending(userId),
      queryFn: () => api.get<any>("/approvals/pending"),
      enabled: !!userId,
      staleTime: 30_000,
      refetchOnMount: "always",
    },
    arr,
    "Could not load approvals",
  );
}

/** Feedback responses flattened into the activity feed's shape. Shared
 *  queryKeys.feedback.list() — the raw envelope is cached, the parse is per
 *  caller. Root excluded from persistence (student names / free text). */
export function useFeedbackActivity() {
  return useShared(
    {
      queryKey: queryKeys.feedback.list(),
      queryFn: () => api.get<any>("/getAll/feedback"),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    parseFeedback,
    "Could not load feedback",
  );
}

/** One course's attendance records — shared queryKeys.attendance.records().
 *  A null courseId leaves the query idle (the focus course is not known until
 *  analytics resolves), exactly as the old optional-path fetch did. */
export function useCourseAttendanceRecords(courseId: string | null): Async<any[]> {
  return useShared(
    {
      queryKey: queryKeys.attendance.records(courseId || ""),
      queryFn: () => attendanceApi.list(courseId || ""),
      enabled: !!courseId,
      staleTime: 2 * 60 * 1000,
    },
    rows,
    "Could not load attendance",
  );
}

export interface UseLdDashboard {
  loading: boolean;
  error: string;
  model: DashboardModel | null;
  /** True while secondary panels are still resolving. */
  partial: boolean;
}

export function useLdDashboard(filter: DashFilter): UseLdDashboard {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const analytics = useAnalyticsPayload();
  const roster = useRosterList();
  const attendance = useAttendanceOverviewDay(today);
  const approvals = usePendingApprovalsList();
  const feedback = useFeedbackActivity();

  const { course, courseIds } = filter;
  const focusId = useMemo(() => {
    if (!analytics.data) return null;
    const inScope = (id: string) => courseIds === null || courseIds.has(id);
    return pickFocusCourse(analytics.data.rows, course, inScope);
  }, [analytics.data, course, courseIds]);

  const focusAttendance = useCourseAttendanceRecords(focusId);

  const model = useMemo(() => {
    if (!analytics.data) return null;
    return deriveModel({
      filter,
      analytics: analytics.data,
      roster: roster.data ?? [],
      attendanceToday: attendance.data ?? [],
      approvals: approvals.data ?? [],
      feedback: feedback.data ?? [],
      focusAttendance: focusAttendance.data ?? [],
      focusId,
    });
    // `filter.onReset` is a new closure each render; scope by its value fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    analytics.data,
    roster.data,
    attendance.data,
    approvals.data,
    feedback.data,
    focusAttendance.data,
    focusId,
    filter.client,
    filter.course,
    filter.courseIds,
  ]);

  return {
    loading: analytics.loading,
    error: analytics.error,
    model,
    partial: roster.loading || attendance.loading || approvals.loading || feedback.loading,
  };
}
