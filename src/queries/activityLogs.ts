import { useInfiniteQuery, useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchLoginLogs,
  fetchLoginLogsPage,
  fetchCourseReport,
  fetchCourseReportPage,
  fetchCourseReportAll,
  fetchCourseReportFacets,
  fetchCourseReportStats,
  reportFilterKey,
  LoginLogEntry,
  LoginLogFilters,
  ReportSession,
  ReportFilters,
  CourseReportFacets,
  CourseReportStats,
} from "@/apiServices/activityLog";

// ─────────────────────────────────────────────────────────────────────────────
// Logs pages (`LogsPage`, `LogsReportPage`) — both read the same login-log
// list and, for a given course, the same course activity report. Sharing one
// query per key means clicking "Generate Report" (which navigates with the
// course id already loaded by LogsPage) paints from cache instead of
// re-fetching the whole unfiltered session list a second time.
//
// Data is append-only (new rows on login/activity events), so a short
// staleTime is enough to dedupe rapid mount/tab-switch/navigate cycles
// without serving noticeably stale data.
// ─────────────────────────────────────────────────────────────────────────────

const ONE_MIN = 60 * 1000;
const FIVE_MIN = 5 * 60 * 1000;

export const useLoginLogsQuery = (enabled: boolean = true) =>
  useQuery<LoginLogEntry[]>({
    queryKey: queryKeys.activityLogs.logins(),
    queryFn: fetchLoginLogs,
    enabled,
    staleTime: ONE_MIN,
    gcTime: FIVE_MIN,
  });

/** Rows per scroll-load on the login tab. */
export const LOGIN_PAGE_SIZE = 50;

/**
 * The login feed, loaded a page at a time as the table is scrolled.
 *
 * The list is one long scrolling table, so it stays one long scrolling table —
 * it just stops arriving all at once. The filters live in the key because the
 * server applies them now; changing a date range or the search starts a fresh
 * feed rather than re-filtering something already in memory.
 */
export const useLoginLogsInfiniteQuery = (
  filters: LoginLogFilters,
  enabled: boolean = true,
) =>
  useInfiniteQuery({
    queryKey: queryKeys.activityLogs.loginsPage(filters as Record<string, unknown>),
    queryFn: ({ pageParam }) => fetchLoginLogsPage(filters, pageParam as number, LOGIN_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
    staleTime: ONE_MIN,
    gcTime: FIVE_MIN,
  });

/**
 * One page of the login feed — page-based (classic pagination), not
 * infinite scroll. Sibling of the infinite version above so both share the
 * same "activityLogs","logins","page" prefix; either callsite reads live
 * against the same cache root and refetches after mutations. Filters and
 * the page number are the identity because filtering runs server-side.
 *
 * `keepPreviousData` holds the current page on screen while the next one
 * loads so paging does not blank the table.
 */
export const useLoginLogsPageQuery = (
  filters: LoginLogFilters,
  page: number,
  pageSize: number = LOGIN_PAGE_SIZE,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: [
      ...queryKeys.activityLogs.loginsPage(filters as Record<string, unknown>),
      { page, pageSize, mode: "paged" },
    ] as const,
    queryFn: () => fetchLoginLogsPage(filters, page, pageSize),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: ONE_MIN,
    gcTime: FIVE_MIN,
  });

export const useCourseActivityReportQuery = (courseId: string) =>
  useQuery<ReportSession[]>({
    queryKey: queryKeys.activityLogs.courseReport(courseId),
    queryFn: () => fetchCourseReport(courseId),
    enabled: !!courseId,
    staleTime: ONE_MIN,
    gcTime: FIVE_MIN,
  });

/** Rows per page on the course tab and the report's detail table. */
export const COURSE_PAGE_SIZE = 10;

/**
 * One page of the course report.
 *
 * `placeholderData: keepPreviousData` holds the previous page on screen while
 * the next one loads, so paging does not blank the table and bounce the
 * scroll position back to the top.
 */
export const useCourseReportPageQuery = (
  courseId: string,
  filters: ReportFilters,
  page: number,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: queryKeys.activityLogs.courseReportPage(courseId, reportFilterKey(filters), page),
    queryFn: () => fetchCourseReportPage(courseId, filters, page, COURSE_PAGE_SIZE),
    enabled: enabled && !!courseId,
    placeholderData: keepPreviousData,
    staleTime: ONE_MIN,
    gcTime: FIVE_MIN,
  });

/**
 * The filter dropdowns, over the whole course.
 *
 * Deliberately NOT keyed on the filters: these options describe the course, and
 * rebuilding them from the filtered set would let a filter remove the very
 * option needed to clear it.
 */
export const useCourseReportFacetsQuery = (courseId: string, enabled: boolean = true) =>
  useQuery<CourseReportFacets>({
    queryKey: queryKeys.activityLogs.courseReportFacets(courseId),
    queryFn: () => fetchCourseReportFacets(courseId),
    enabled: enabled && !!courseId,
    staleTime: ONE_MIN,
    gcTime: FIVE_MIN,
  });

/**
 * Every row matching a filter set.
 *
 * The print view renders each session it covers, so it genuinely needs them
 * all — this is the one place a whole selection is still fetched, and it is
 * gated on the user opening that view rather than run on page load.
 */
export const useCourseReportAllQuery = (
  courseId: string,
  filters: ReportFilters,
  enabled: boolean,
) =>
  useQuery<ReportSession[]>({
    queryKey: queryKeys.activityLogs.courseReportAll(courseId, reportFilterKey(filters)),
    queryFn: () => fetchCourseReportAll(courseId, filters),
    enabled: enabled && !!courseId,
    staleTime: ONE_MIN,
    gcTime: FIVE_MIN,
  });

/** The report's aggregates over the whole selection — totals, donut, trend. */
export const useCourseReportStatsQuery = (
  courseId: string,
  filters: ReportFilters,
  enabled: boolean = true,
) =>
  useQuery<CourseReportStats>({
    queryKey: queryKeys.activityLogs.courseReportStats(courseId, reportFilterKey(filters)),
    queryFn: () => fetchCourseReportStats(courseId, filters),
    enabled: enabled && !!courseId,
    staleTime: ONE_MIN,
    gcTime: FIVE_MIN,
  });
