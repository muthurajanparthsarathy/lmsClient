import React from "react";
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import {
  courseMatchesUserHierarchy,
  getStoredHierarchyUser,
  isStudentRole,
} from "@/lib/api/courses";

export interface BatchUser {
  user: string | { $oid: string } | { _id: string };
  status: string;
  joinedAt?: string;
  updatedAt?: string;
  _id: string;
}

export interface CourseBatch {
  _id: string;
  batchName: string;
  batchDescription?: string;
  batchStartDate: string | null;
  batchEndDate: string | null;
  users: BatchUser[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseDepartmentSection {
  department?: string;
  sections?: string[];
  semesters?: string[];
}

export interface CourseClientConfiguration {
  batch?: string;
  degree?: string;
  departments?: CourseDepartmentSection[];
}

export interface Course {
  _id: string;
  courseName: string;
  courseDescription: string;
  courseDuration: string;
  courseLevel: string;
  serviceType: string;
  courseImage: string;
  clientName: string;
  createdAt: string;
  updatedAt: string;
  batchAndParticipants?: CourseBatch[];
  groups?: string[];
  // Service-mapping hierarchy (present on courses created with a client config)
  clientId?: string;
  studentType?: string;
  batch?: string;
  skillingBatches?: string[];
  degree?: string;
  departmentSections?: CourseDepartmentSection[];
  clientConfigurations?: CourseClientConfiguration[];
  // Attached by /courses-structure/getAll in the same pass that populates
  // batches: real module count, distinct participant count, calendar gate.
  moduleCount?: number;
  participantCount?: number;
  hasModuleHours?: boolean;
}

// /courses-structure/getAll returns { message, data } — it has never paged,
// so there is no `pagination` block to describe here.
interface CoursesApiResponse {
  data: Course[];
  message?: string;
  success?: boolean;
}

interface CoursesQueryError {
  message: string;
  status?: number;
}

const normalizeMongoId = (id: any): string => {
  if (!id) return "";
  if (typeof id === "string") return id;
  if (typeof id === "object") {
    if (id.$oid) return id.$oid;
    // `batchAndParticipants.users.user` is populated server-side into a full
    // LMS-User document ({ _id, name, email, ... }). Unwrap its _id so enrolment
    // matching works — otherwise String(object) → "[object Object]" never
    // matches and the student sees zero courses.
    if (id._id) return normalizeMongoId(id._id);
  }
  return String(id);
};

export const getCurrentUserIdFromAuth = (): string | null => {
  if (typeof window === "undefined") return null;

  const userId =
    localStorage.getItem("smartcliff_userId") ||
    localStorage.getItem("user_id") ||
    sessionStorage.getItem("smartcliff_userId") ||
    sessionStorage.getItem("user_id");

  if (userId) return userId;

  try {
    const userDataStr =
      localStorage.getItem("user_data") || sessionStorage.getItem("user_data");

    if (userDataStr) {
      const userData = JSON.parse(userDataStr);
      return normalizeMongoId(userData._id || userData.id || "");
    }
  } catch (error) {
    console.error("Error parsing user data:", error);
  }

  return null;
};

// `?summary=enrolled`: the listing projection plus the roster ids/statuses and
// the hierarchy scalars the filter below reads — everything the grades pages
// render (_id, courseImage, courseLevel, courseName, institution, serviceType)
// and nothing else. Measured on the wire, 68 courses: 348,390 B full vs
// 78,358 B here. Plain `?summary=1` is NOT usable: it strips batchAndParticipants
// and the hierarchy fields, so every user would filter down to zero courses.
// An older server that ignores the param returns the full document — a
// superset, so this keeps working against it.
const fetchCourses = async (
  token: string,
  userId: string | null,
): Promise<CoursesApiResponse> => {
  if (!token) {
    throw new Error("Authentication token not found");
  }

  // Shared client: base URL from NEXT_PUBLIC_API_URL, Authorization attached
  // by the interceptor, and errors carry `.status` for the retry predicate
  // below. Was a hardcoded https://lmsserver-yeve.onrender.com fetch, dev-machine only.
  const data = await api.get<CoursesApiResponse>(
    "/courses-structure/getAll?summary=enrolled"
  );

  if (!data.data || !Array.isArray(data.data)) {
    throw new Error("Invalid data format received from API");
  }

  let filteredCourses = data.data;

  if (userId) {
    const normalizedUserId = normalizeMongoId(userId);
    const hierarchyUser = isStudentRole() ? getStoredHierarchyUser() : null;

    filteredCourses = data.data.filter((course) => {
      const batches = course.batchAndParticipants;

      // Enrolled if the user appears with an active status in any batch.
      const isEnrolled =
        Array.isArray(batches) &&
        batches.some((batch) =>
          (batch.users || []).some((batchUser: BatchUser) => {
            // Handle both string user ID and populated user object
            const participantUserId = normalizeMongoId(batchUser.user);

            const matches =
              participantUserId === normalizedUserId &&
              batchUser.status === "active";

            if (matches) {
              console.log('User found in course:', course.courseName);
            }

            return matches;
          })
        );
      if (isEnrolled) return true;

      // Students also see courses mapped to their own hierarchy
      // (client → batch → degree → department → section/semester), even
      // without being added via Add Participant.
      return courseMatchesUserHierarchy(course, hierarchyUser);
    });
  }

  console.log('Filtered courses count:', filteredCourses.length);
  console.log('All courses count:', data.data.length);

  return {
    ...data,
    data: filteredCourses,
  };
};

export const coursesQueryKeys = {
  all: ["courses"] as const,
  lists: () => [...coursesQueryKeys.all, "list"] as const,
  list: (filters: Record<string, any>) =>
    [...coursesQueryKeys.lists(), { filters }] as const,
  details: () => [...coursesQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...coursesQueryKeys.details(), id] as const,
};

// There was a useCoursesInfiniteQuery here. It could not page: its queryFn
// destructured `pageParam` and dropped it, fetchCourses takes no page
// argument, and getNextPageParam read a `pagination` block this endpoint has
// never returned — so hasNextPage was permanently false and the scroll
// handlers on the grades pages were decoration. Its key also included the
// search term, so every keystroke opened a new cache entry and refetched the
// whole list. The endpoint returns all courses in one response; the plain
// query below is what that actually is. Restore an infinite query only
// alongside real server-side pagination.

export const useCoursesQuery = (
  token: string | null,
  userId: string | null
): UseQueryResult<Course[], CoursesQueryError> => {
  return useQuery({
    queryKey: [...coursesQueryKeys.lists(), userId],
    queryFn: () => fetchCourses(token!, userId).then((res) => res.data),
    enabled: !!token && !!userId,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) {
        return false;
      }
      return failureCount < 2;
    },
  });
};

export const useFilteredCourses = (
  courses: Course[] | undefined,
  filters: {
    searchTerm: string;
    selectedCategory: string;
  }
) => {
  return React.useMemo(() => {
    if (!courses) return [];

    return courses.filter((course) => {
      const matchesSearch =
        filters.searchTerm === "" ||
        course.courseName
          .toLowerCase()
          .includes(filters.searchTerm.toLowerCase());

      const matchesCategory =
        filters.selectedCategory === "All" ||
        course.serviceType === filters.selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [courses, filters.searchTerm, filters.selectedCategory]);
};

export const getAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("smartcliff_token");
};

export const getCurrentUserId = (): string | null => {
  return getCurrentUserIdFromAuth();
};

export const prefetchCourses = (
  queryClient: any,
  token: string,
  userId: string
) => {
  queryClient.prefetchQuery({
    queryKey: [...coursesQueryKeys.lists(), userId],
    queryFn: () => fetchCourses(token, userId).then((res) => res.data),
    staleTime: 10 * 60 * 1000,
  });
};

export const invalidateCoursesCache = (queryClient: any) => {
  queryClient.invalidateQueries({
    queryKey: coursesQueryKeys.all,
  });
};

export const backgroundRefreshCourses = (
  queryClient: any,
  token: string,
  userId: string
) => {
  queryClient.refetchQueries({
    queryKey: [...coursesQueryKeys.lists(), userId],
  });
};
