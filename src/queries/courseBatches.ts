import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { queryKeys } from "@/lib/queryKeys";
import { http } from "@/lib/http";

// ─────────────────────────────────────────────────────────────────────────────
// `GET /courses/:courseId/batches`
//
// One response serves the whole batch → section → participant drill-down: the
// batch list plus the course header (name, code, mappingId) and the degree
// hierarchy (degree, departmentSections, semesters).
//
// The three pages of that drill-down each fetched it on their own, with a
// hand-rolled fetch into useState and no cache, so walking Batches → Sections
// → Participants issued three identical requests. One key now — moving between
// the pages paints from cache.
//
// The `institution` header is preserved from the fetches this replaces.
// ─────────────────────────────────────────────────────────────────────────────

export interface DepartmentSection {
  department: string;
  sections: string[];
  semesters?: string[];
}

/** Mirrors the batch objects `getCourseBatches` emits — verified against the
 *  live response, not inferred. */
export interface CourseBatch {
  _id: string;
  batchName: string;
  batchDescription: string;
  batchStartDate: string | null;
  batchEndDate: string | null;
  status: string;
  enrolledCount: number;
  /** Whether the REQUESTER belongs to this batch (staff membership). */
  mine?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseBatchesData {
  courseId: string;
  courseName: string;
  courseCode: string;
  mappingId: string;
  studentType: string;
  degree: string;
  semester?: string;
  departmentSections: DepartmentSection[];
  clientConfigurations: unknown[];
  batches: CourseBatch[];
}

const TWO_MIN = 2 * 60 * 1000;

const institutionHeader = () => {
  const institutionId =
    typeof window !== "undefined"
      ? localStorage.getItem("smartcliff_institution")
      : null;
  return institutionId ? { institution: institutionId } : {};
};

export const useCourseBatchesQuery = (courseId: string | null) =>
  useQuery<CourseBatchesData>({
    queryKey: queryKeys.courseBatches.detail(courseId || ""),
    queryFn: async () => {
      const { data } = await http.get(`/courses/${courseId}/batches`, {
        headers: institutionHeader(),
      });
      // The pages treated a `success: false` body as a failure even on HTTP
      // 200 — throwing keeps that, and keeps the error out of the cache.
      if (!data?.success) {
        throw new Error(data?.message || "Failed to load the course hierarchy");
      }
      return data.data as CourseBatchesData;
    },
    enabled: !!courseId,
    staleTime: TWO_MIN,
  });

export const useInvalidateCourseBatches = () => {
  const qc = useQueryClient();
  return useCallback(
    (courseId?: string) =>
      qc.invalidateQueries({
        queryKey: courseId
          ? queryKeys.courseBatches.detail(courseId)
          : queryKeys.courseBatches.all,
      }),
    [qc]
  );
};

export interface UpdateBatchPayload {
  batchName?: string;
  batchDescription?: string;
  batchStartDate?: string | null;
  batchEndDate?: string | null;
  status?: string;
}

export const useUpdateBatchMutation = (courseId: string | null) => {
  const invalidate = useInvalidateCourseBatches();
  return useMutation({
    mutationFn: async (vars: { batchId: string; payload: UpdateBatchPayload }) => {
      const { data } = await http.put(
        `/courses/${courseId}/batches/${vars.batchId}`,
        vars.payload,
        { headers: institutionHeader() }
      );
      if (!data?.success) {
        throw new Error(data?.message || "Failed to update the batch");
      }
      return data;
    },
    onSuccess: () => invalidate(courseId || undefined),
  });
};
