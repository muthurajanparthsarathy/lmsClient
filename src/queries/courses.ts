import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { queryKeys } from "@/lib/queryKeys";
import {
  fetchCourseDetail,
  fetchCoursesList,
  uploadResource,
  CourseDetailResponse,
} from "@/lib/api/courses";
import { ApiError } from "@/lib/apiClient";
import type { Course } from "@/apiServices/studentcoursepage";

const FIVE_MIN = 5 * 60 * 1000;
const THREE_MIN = 3 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

export const useCoursesListQuery = (userId: string | null) =>
  useQuery<Course[], ApiError>({
    queryKey: queryKeys.courses.list(userId),
    queryFn: () => fetchCoursesList(userId),
    enabled: !!userId,
    staleTime: FIVE_MIN,
    gcTime: TEN_MIN,
    placeholderData: keepPreviousData,
  });

export const useCourseDetailQuery = (courseId: string | undefined) =>
  useQuery<CourseDetailResponse, ApiError>({
    queryKey: courseId ? queryKeys.courses.detail(courseId) : ["courses", "detail", "none"],
    queryFn: () => fetchCourseDetail(courseId as string),
    enabled: !!courseId,
    staleTime: THREE_MIN,
    gcTime: TEN_MIN,
    placeholderData: keepPreviousData,
  });

export const usePrefetchCourseDetail = () => {
  const qc = useQueryClient();
  return useCallback(
    (courseId: string) => {
      if (!courseId) return;
      qc.prefetchQuery({
        queryKey: queryKeys.courses.detail(courseId),
        queryFn: () => fetchCourseDetail(courseId),
        staleTime: THREE_MIN,
      });
    },
    [qc]
  );
};

export type UploadResourceVariables = {
  entityType: "module" | "submodule" | "topic" | "subtopic";
  entityId: string;
  courseId: string;
  formData: FormData;
  onProgress?: (e: { loaded: number; total?: number }) => void;
};

export const useUploadResourceMutation = () => {
  const qc = useQueryClient();
  return useMutation<unknown, ApiError, UploadResourceVariables>({
    mutationFn: ({ entityType, entityId, formData, onProgress }) =>
      uploadResource(entityType, entityId, formData, onProgress),
    onSuccess: (_data, vars) => {
      // Invalidate only this course's detail — siblings stay warm.
      qc.invalidateQueries({
        queryKey: queryKeys.courses.detail(vars.courseId),
      });
      // Legacy key used by the existing courseDataApi.getById hook.
      qc.invalidateQueries({ queryKey: ["course", vars.courseId] });
    },
  });
};

export const useFilteredCourses = (
  courses: Course[] | undefined,
  filters: { searchTerm: string; selectedCategory: string; selectedLevel: string }
) =>
  useMemo(() => {
    if (!courses) return [] as Course[];
    const term = filters.searchTerm.trim().toLowerCase();
    return courses.filter((course) => {
      const matchesSearch =
        term === "" || course.courseName.toLowerCase().includes(term);
      const matchesCategory =
        filters.selectedCategory === "All" ||
        course.serviceType === filters.selectedCategory;
      const matchesLevel =
        filters.selectedLevel === "All" ||
        course.courseLevel === filters.selectedLevel;
      return matchesSearch && matchesCategory && matchesLevel;
    });
  }, [courses, filters.searchTerm, filters.selectedCategory, filters.selectedLevel]);
