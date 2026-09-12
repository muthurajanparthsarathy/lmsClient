import axios from "axios";
import { getToken } from "@/lib/session";

// One record per You_Do assessment ("live session") returned by
// `GET /api/live-dashboard/sessions`. Server-side scoping (POC filter) is
// already applied, so every row here is one the caller can open.
export interface LiveSessionRow {
  id: string;
  title: string;
  subcategory: string;
  nodeType: "module" | "submodule" | "topic" | "subtopic";
  nodeId: string;
  nodeTitle: string;
  courseId: string;
  courseName: string;
  courseImage: string | null;
  participantCount: number;
  totalQuestions: number;
  totalMarks: number;
  startDate: string | null;
  endDate: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  submittedCount: number;
  inProgressCount: number;
  terminatedCount: number;
  status: "live" | "scheduled" | "completed";
}

export interface LiveSessionsCounts {
  all: number;
  live: number;
  scheduled: number;
  completed: number;
}

export interface LiveSessionsResponse {
  sessions: LiveSessionRow[];
  counts: LiveSessionsCounts;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com";

export const liveSessionsApi = {
  // React Query descriptor — cache key includes the filters so switching
  // between tabs / courses doesn't overwrite each other's page-1 result.
  list: (params: { status?: string; courseId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.courseId) qs.set("courseId", params.courseId);
    const query = qs.toString();
    return {
      queryKey: ["live-sessions", params.status || "all", params.courseId || ""] as const,
      queryFn: async (): Promise<LiveSessionsResponse> => {
        const token = getToken() || (typeof window !== "undefined" ? localStorage.getItem("token") : "") || "";
        const res = await axios.get(
          `${API_URL}/api/live-dashboard/sessions${query ? `?${query}` : ""}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        );
        return res.data;
      },
    };
  },
};
