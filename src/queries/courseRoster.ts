import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { http } from "@/lib/http";

// ─────────────────────────────────────────────────────────────────────────────
// The course roster — `GET /getAll/courses-data/:courseId?roster=1`.
//
// ONE cache entry for a payload that eleven-plus places used to fetch on their
// own: the attendance grid/report/analytics, the enrollment tab, and every
// feedback screen (form, list, report, report filters, workbook export). Each
// one called the endpoint bare, which returns the entire course — every
// module and submodule and topic with its pedagogy tree, plus each enrolled
// user's complete record. Measured on the demo course: 896,864 bytes, for
// consumers that only ever read `batchAndParticipants` and a handful of
// scalars. With ?roster=1 the same reads cost 6,330 bytes.
//
// This hook deliberately returns the RAW course object rather than a shaped
// one. Its consumers want genuinely different things from it — students only,
// students grouped by batch, trainers, batch names, a participant count, the
// course header — so each derives its own view with `select`, which transforms
// per observer without splitting the cache entry.
//
// NOTE for the persister: the "courseRoster" root is in NON_PERSISTED_KEYS
// (student names + emails) — see queryPersister.ts before renaming this key.
// ─────────────────────────────────────────────────────────────────────────────

/** One entry of `batchAndParticipants[].users[]` — the enrollment, whose
 *  `user` is populated and whose own `status` is the enrolment status. */
export interface RosterEnrollment {
  user?: {
    _id?: string;
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    userId?: string;
    employeeId?: string;
    role?: string | { renameRole?: string; name?: string; roleValue?: string; originalRole?: string };
  };
  status?: string;
  [key: string]: unknown;
}

export interface RosterBatch {
  _id?: string;
  batchName?: string;
  users?: RosterEnrollment[];
  [key: string]: unknown;
}

export interface CourseRoster {
  _id?: string;
  courseName?: string;
  courseCode?: string;
  mappingId?: string;
  clientId?: string;
  clientName?: string;
  studentType?: string;
  degree?: string;
  semester?: string;
  batchAndParticipants?: RosterBatch[];
  [key: string]: unknown;
}

const TWO_MIN = 2 * 60 * 1000;
const TEN_MIN = 10 * 60 * 1000;

export const fetchCourseRoster = async (courseId: string): Promise<CourseRoster> => {
  const institutionId =
    typeof window !== "undefined"
      ? localStorage.getItem("smartcliff_institution") || ""
      : "";
  const { data } = await http.get(`/getAll/courses-data/${courseId}`, {
    params: { roster: 1 },
    // Preserved from the raw fetches this replaces. The endpoint does not read
    // this header, but sending it keeps the request identical.
    headers: { institution: institutionId },
  });
  return (data?.data || data) as CourseRoster;
};

/** Options shared by every roster reader. Spread this and add a `select`. */
export const courseRosterQuery = (courseId: string, enabled = true) => ({
  queryKey: queryKeys.courseRoster.detail(courseId),
  queryFn: () => fetchCourseRoster(courseId),
  enabled: !!courseId && enabled,
  staleTime: TWO_MIN,
  gcTime: TEN_MIN,
});

/** The raw roster, for consumers that pick several unrelated fields off it. */
export const useCourseRosterQuery = (courseId: string, enabled = true) =>
  useQuery(courseRosterQuery(courseId, enabled));

// ── Shared derivations ───────────────────────────────────────────────────────

export const isStudentUser = (user: unknown): boolean => {
  const u = user as RosterEnrollment["user"];
  const role =
    typeof u?.role === "string"
      ? u.role
      : (u?.role as { renameRole?: string; name?: string })?.renameRole ||
        (u?.role as { renameRole?: string; name?: string })?.name ||
        "";
  return String(role).toLowerCase() === "student";
};

/** `batchAndParticipants[].users[]` flattened to the enrollment entries, in
 *  batch-then-user order. */
export const rosterEnrollments = (roster?: CourseRoster): RosterEnrollment[] =>
  (roster?.batchAndParticipants || []).flatMap((b) => b?.users || []);
