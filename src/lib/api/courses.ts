import { api } from "../apiClient";
import type { Course, BatchUser } from "@/apiServices/studentcoursepage";

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

export interface CoursesApiResponse {
  data: Course[];
  message?: string;
  success?: boolean;
}

// ── Hierarchy-based visibility ────────────────────────────────────────────────
// A student whose own hierarchy (client → batch → degree → department →
// section/semester) matches a course's service-mapping configuration sees that
// course as enrolled, even without being added via Add Participant.

export interface HierarchyUser {
  _id?: string;
  batch?: string;
  degree?: string;
  department?: string;
  semester?: string;
  section?: string;
  studentType?: string;
  clientId?: unknown;
  clientName?: string;
}

const norm = (v: unknown): string => String(v ?? "").trim().toLowerCase();

export const getStoredHierarchyUser = (): HierarchyUser | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("smartcliff_userData");
    return raw ? (JSON.parse(raw) as HierarchyUser) : null;
  } catch {
    return null;
  }
};

export const isStudentRole = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    const original = localStorage.getItem("smartcliff_originalRole");
    if (original) return original.toLowerCase() === "student";
    const roleValue = localStorage.getItem("smartcliff_roleValue");
    return !!roleValue && roleValue.toLowerCase().includes("student");
  } catch {
    return false;
  }
};

export const courseMatchesUserHierarchy = (
  course: Course,
  user: HierarchyUser | null
): boolean => {
  if (!user) return false;
  const c = course as any;
  const uBatch = norm(user.batch);
  const uDegree = norm(user.degree);
  const uDept = norm(user.department);
  const uSection = norm(user.section);
  const uSemester = norm(user.semester);
  // A user with no hierarchy of their own can't match anything.
  if (!uBatch && !uDegree && !uDept) return false;

  // The course must belong to the same client (id preferred, name fallback —
  // legacy courses store an ObjectId string in clientName, which never
  // collides with a readable name).
  const courseClientId = normalizeMongoId(c.clientId);
  const userClientId = normalizeMongoId(user.clientId);
  const clientOk =
    (!!courseClientId && !!userClientId && courseClientId === userClientId) ||
    (!!norm(c.clientName) && norm(c.clientName) === norm(user.clientName));
  if (!clientOk) return false;

  // Skilling engagements target whole batches — no degree/department drill-in.
  const skillingBatches: unknown[] = Array.isArray(c.skillingBatches)
    ? c.skillingBatches
    : [];
  if (norm(c.studentType) === "skilling" || skillingBatches.length > 0) {
    return skillingBatches.some((b) => norm(b) === uBatch);
  }

  // An empty list on the course side means "no restriction at that level".
  const listHas = (list: unknown, value: string): boolean =>
    !Array.isArray(list) || list.length === 0 || list.some((s) => norm(s) === value);
  const eqOrWild = (courseValue: unknown, userValue: string): boolean =>
    !norm(courseValue) || norm(courseValue) === userValue;

  // Prefer the full configuration blocks; older courses only carry the
  // top-level batch/degree + departmentSections mirror.
  const configs: any[] =
    Array.isArray(c.clientConfigurations) && c.clientConfigurations.length > 0
      ? c.clientConfigurations
      : [{ batch: c.batch, degree: c.degree, departments: c.departmentSections }];

  return configs.some((cfg) => {
    if (!cfg) return false;
    const departments: any[] = Array.isArray(cfg.departments) ? cfg.departments : [];
    // A course with no hierarchy at all must not leak to every student.
    if (!norm(cfg.batch) && !norm(cfg.degree) && departments.length === 0) return false;
    if (!eqOrWild(cfg.batch, uBatch)) return false;
    if (!eqOrWild(cfg.degree, uDegree)) return false;
    if (departments.length === 0) return true;
    return departments.some(
      (d) =>
        d &&
        norm(d.department) === uDept &&
        listHas(d.sections, uSection) &&
        listHas(d.semesters, uSemester)
    );
  });
};

export const fetchCoursesList = async (
  userId: string | null
): Promise<Course[]> => {
  const res = await api.get<CoursesApiResponse>(
    "/courses-structure/getAll"
  );
  if (!res.data || !Array.isArray(res.data)) {
    throw new Error("Invalid data format received from API");
  }
  if (!userId) return res.data;

  const normalizedUserId = normalizeMongoId(userId);
  const hierarchyUser = isStudentRole() ? getStoredHierarchyUser() : null;
  return res.data.filter((course) => {
    const batches = course.batchAndParticipants;
    // Enrolled if the user appears with an active status in any batch.
    const isEnrolled =
      Array.isArray(batches) &&
      batches.some((batch) =>
        (batch.users || []).some(
          (batchUser: BatchUser) =>
            normalizeMongoId(batchUser.user) === normalizedUserId &&
            batchUser.status === "active"
        )
      );
    if (isEnrolled) return true;
    // Students also see courses mapped to their own hierarchy.
    return courseMatchesUserHierarchy(course, hierarchyUser);
  });
};

export interface CourseDetailResponse {
  data: {
    _id: string;
    courseName: string;
    courseDescription?: string;
    modules?: unknown[];
    batchAndParticipants?: unknown[];
    I_Do?: unknown;
    We_Do?: unknown;
    You_Do?: unknown;
    // Server-computed per-node completion for the sidebar tick. Keyed by
    // node `_id`; entries populate only when the caller is authenticated.
    // See server/utils/topicCompletion.js for the aggregation rules and
    // `TopicProgressEntry` in coursesdetailedview/components/types/types.ts
    // for the entry shape.
    topicProgress?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export const fetchCourseDetail = async (
  courseId: string
): Promise<CourseDetailResponse> => {
  return api.get<CourseDetailResponse>(`/getAll/courses-data/${courseId}`);
};

export const uploadResource = async (
  entityType: "module" | "submodule" | "topic" | "subtopic",
  entityId: string,
  formData: FormData,
  onUploadProgress?: (e: { loaded: number; total?: number }) => void
) => {
  const modelMap = {
    module: "modules",
    submodule: "submodules",
    topic: "topics",
    subtopic: "subtopics",
  } as const;
  return api.putForm<{ data?: unknown; message?: string }>(
    `/uploadResourses/${modelMap[entityType]}/${entityId}`,
    formData,
    {
      timeout: 20000000,
      onUploadProgress,
    }
  );
};
