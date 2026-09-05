import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { api, ApiError } from "@/app/lms/pages/clientmanagement/lib/apiClient";

// ─────────────────────────────────────────────────────────────────────────────
// Admin dashboard analytics — `GET /student-Dashboard/courses-data/analytics`.
//
// The dashboard renders ONLY the totals, the level/service summaries and each
// course's metadata + stats, so it requests the `?light=1` projection: the
// server omits the embedded `modules[]` pedagogy trees and `participants[]`
// (the multi-MB part of the full payload). An older server that doesn't know
// the param simply returns the full payload — the same fields are read either
// way, so the page works against both.
//
// NOTE for the persister: this key's root ("analytics") is listed in
// NON_PERSISTED_KEYS — see queryPersister.ts before renaming it.
// ─────────────────────────────────────────────────────────────────────────────

const FIVE_MIN = 5 * 60 * 1000;

export interface AdminCourseStats {
  participants: number;
  activeParticipants: number;
  modules: number;
  subModules: number;
  topics: number;
  subTopics: number;
}

export interface AdminAnalyticsCourse {
  _id: string;
  courseName?: string;
  courseCode?: string;
  description?: string;
  courseDuration?: string;
  courseLevel?: string;
  serviceType?: string;
  courseImage?: string;
  clientName?: string;
  createdAt?: string;
  updatedAt?: string;
  stats?: AdminCourseStats;
}

export interface AdminAnalyticsTotals {
  totalCourses: number;
  totalModules: number;
  totalSubModules: number;
  totalTopics: number;
  totalSubTopics: number;
  totalParticipants: number;
  totalActiveParticipants: number;
}

export interface AdminAnalyticsSummary {
  coursesByLevel: Record<string, number>;
  coursesByService: Record<string, number>;
}

export interface AdminAnalyticsResponse {
  success: boolean;
  // When the institution has no courses yet the server returns `data: []`
  // instead of the object — the optional fields make both shapes read safely.
  data?: {
    courses?: AdminAnalyticsCourse[];
    analytics?: AdminAnalyticsTotals;
    summary?: AdminAnalyticsSummary;
  };
  message?: string;
}

const fetchAdminAnalytics = () =>
  api.get<AdminAnalyticsResponse>(
    "/student-Dashboard/courses-data/analytics",
    { params: { light: 1 } }
  );

export const useAdminAnalyticsQuery = (userId: string | null) =>
  useQuery<AdminAnalyticsResponse, ApiError>({
    queryKey: queryKeys.analytics.adminDashboard(userId),
    queryFn: fetchAdminAnalytics,
    enabled: !!userId,
    staleTime: FIVE_MIN,
    // Preserved from the page's original inline query: one retry, and no
    // special 401 redirect — auth failures land on the page's error state.
    retry: 1,
  });
