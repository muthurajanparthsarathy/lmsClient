"use client";

/**
 * Data access for the L&D Overview.
 *
 * Four reads, all on the app's SHARED React Query keys, so this page pays for
 * none of them twice and adds nothing to what the console already fetches:
 *
 *   analytics.staffStudents   the 12-second roll-up — already filled by the
 *                             dashboard and every report in this shell
 *   analytics.ldSignals       the only NEW request: attempt counts + the
 *                             weekly submission series
 *   courseStructures          rosters, for the trainer count
 *   attendance.overview       today's batches
 *
 * Filters (client / course / time period) are applied in `deriveOverview`, not
 * in a query key: every payload is institution-wide, so narrowing the scope
 * re-derives from cache instead of issuing another request. That is why
 * changing a filter never produces a network call.
 */

import { useMemo, useState } from "react";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import { readStoredUserData } from "@/app/lms/shared/ui/navItems";
import { attendanceApi } from "@/apiServices/attendanceApi";
import { courseStructureApi } from "@/apiServices/createCourseStucture";
import type { Async, OverviewFilter, OverviewModel } from "../types";
import { deriveOverview, parseOverviewAnalytics, parseSignals, type AnalyticsShape, type SignalCourse } from "../lib/metrics";

function useShared<T>(
  options: UseQueryOptions<any, Error, any, any>,
  map: (j: any) => T,
  fallback = "Could not load",
): Async<T> & { refetch: () => void; updatedAt: number } {
  const q = useQuery(options);
  const raw = q.data;
  const data = useMemo(
    () => (raw === undefined ? null : map(raw)),
    // `map` is intentionally excluded — callers pass inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw],
  );
  return {
    loading: q.isPending,
    error: q.isError ? (q.error as Error)?.message || fallback : "",
    data,
    refetch: () => void q.refetch(),
    updatedAt: q.dataUpdatedAt,
  };
}

function useUserId(): string | null {
  const [id] = useState<string | null>(() => readStoredUserData()?._id ?? null);
  return id;
}

export interface UseLdOverview {
  loading: boolean;
  error: string;
  model: OverviewModel | null;
  /** True while the secondary panels are still resolving. */
  partial: boolean;
  /** When the primary roll-up last landed, for the "updated N ago" chip. */
  updatedAt: number;
  refresh: () => void;
}

export function useLdOverview(filter: OverviewFilter): UseLdOverview {
  const userId = useUserId();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const analytics = useShared<AnalyticsShape>(
    {
      queryKey: queryKeys.analytics.staffStudents(userId),
      queryFn: () => api.get<any>("/analytics/staff/analytics/students"),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    parseOverviewAnalytics,
    "Could not load analytics",
  );

  const signals = useShared<SignalCourse[]>(
    {
      queryKey: queryKeys.analytics.ldSignals(userId),
      queryFn: () => api.get<any>("/analytics/staff/analytics/ld-signals"),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    parseSignals,
    "Could not load practice signals",
  );

  const roster = useShared<any[]>(
    courseStructureApi.getAll() as UseQueryOptions<any, Error, any, any>,
    (rows) => (Array.isArray(rows) ? rows : []),
    "Could not load courses",
  );

  const attendance = useShared<any[]>(
    {
      queryKey: queryKeys.attendance.overview(today),
      queryFn: () => attendanceApi.overview(today),
      staleTime: 30_000,
    },
    (j) => (Array.isArray(j?.data) ? j.data : []),
    "Could not load attendance",
  );

  const model = useMemo(() => {
    if (!analytics.data) return null;
    return deriveOverview({
      filter,
      analytics: analytics.data,
      // `null` (not `[]`) while loading or on failure, so the panels that need
      // it say "unavailable" instead of drawing a confident zero.
      signals: signals.loading || signals.error ? null : (signals.data ?? []),
      roster: roster.data ?? [],
      attendanceToday: attendance.data ?? [],
    });
    // `filter.clientOf` is a stable memo in the console; the value fields are
    // what actually change the model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    analytics.data,
    signals.data,
    signals.loading,
    signals.error,
    roster.data,
    attendance.data,
    filter.client,
    filter.course,
    filter.courseIds,
    filter.period,
  ]);

  return {
    loading: analytics.loading,
    error: analytics.error,
    model,
    partial: signals.loading || roster.loading || attendance.loading,
    updatedAt: analytics.updatedAt,
    refresh: () => {
      analytics.refetch();
      signals.refetch();
      roster.refetch();
      attendance.refetch();
    },
  };
}
