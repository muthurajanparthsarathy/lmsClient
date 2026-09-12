"use client";

import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/http";

// ── The POC console's data layer ────────────────────────────────────────────
//
// Every endpoint below is ALREADY scoped server-side to the courses this POC is
// enrolled in (see server/utils/pocScope.js). Nothing here re-filters, and
// nothing here falls back to a wider query when the result is empty.
//
// That last part is the whole point. The trainer dashboard's scope hook returns
// `courseIds: null` when a trainer has no batch assignment, and downstream code
// reads null as "no filter" and shows every course in the institution. For a
// POC that behaviour would be a data leak, so an empty result stays empty.

// The `?summary=enrolled` projection ships each course's roster along with two
// server-computed helpers the dashboard leans on:
//   - `participantCount` — distinct users across every batch, with dangling
//     refs already removed server-side (see courseStructure.js:1310).
//   - `moduleCount` — direct count from the Module1 collection, not derived
//     from the roster payload.
// Status on the roster entries is what marks a learner "active" (matches the
// admin-analytics semantics in pedagogyView.js:1988).
export interface PocRosterUserRef {
  _id?: string;
  status?: string;
}
export interface PocRosterEntry {
  status?: string;
  user?: PocRosterUserRef | string | null;
}
export interface PocCourse {
  _id: string;
  courseName?: string;
  courseCode?: string;
  clientId?: string;
  clientName?: string;
  category?: string;
  courseLevel?: string;
  courseDuration?: string;
  serviceModal?: string;
  serviceType?: string;
  status?: string;
  createdAt?: string;
  moduleCount?: number;
  participantCount?: number;
  batchAndParticipants?: { users?: PocRosterEntry[] }[];
}

export interface PocClient {
  _id: string;
  clientCompany?: string;
  status?: string;
  businessModel?: string;
  clientAddress?: string;
  contactPersons?: { name?: string; email?: string; phoneNumber?: string }[];
  services?: { service?: string; year?: string; serviceModals?: string[] }[];
}

export interface PocMapping {
  _id: string;
  service?: string;
  year?: string;
  serviceModels?: string[];
  status?: string;
  courses?: { courseName?: string }[];
  client?: { _id?: string; clientCompany?: string } | string;
}

export interface PocAttendanceCourse {
  _id: string;
  courseName?: string;
  clientName?: string;
  hasSchedule?: boolean;
  trainingStart?: string;
  trainingEnd?: string;
  totalStudents?: number;
  batches?: {
    _id: string;
    batchName?: string;
    studentCount?: number;
    markedToday?: boolean;
    trainingEnd?: string;
  }[];
}

export const pocKeys = {
  all: ["poc"] as const,
  courses: () => [...pocKeys.all, "courses"] as const,
  clients: () => [...pocKeys.all, "clients"] as const,
  services: () => [...pocKeys.all, "services"] as const,
  attendance: () => [...pocKeys.all, "attendance"] as const,
};

// `?summary=enrolled` keeps the roster ids and hierarchy scalars but drops the
// heavy config subtrees — 78 KB instead of 348 KB on a full institution, and
// far less here because the row set is already narrowed to this POC.
const fetchCourses = async (): Promise<PocCourse[]> => {
  const { data } = await http.get("/courses-structure/getAll?summary=enrolled");
  if (!Array.isArray(data?.data)) throw new Error("Unexpected courses payload");
  return data.data;
};

const fetchClients = async (): Promise<PocClient[]> => {
  const { data } = await http.get("/client-management/getAll");
  if (!Array.isArray(data?.data)) throw new Error("Unexpected clients payload");
  return data.data;
};

const fetchServices = async (): Promise<PocMapping[]> => {
  const { data } = await http.get("/service-mapping/getAll");
  if (!Array.isArray(data?.data)) throw new Error("Unexpected services payload");
  return data.data;
};

const fetchAttendance = async (): Promise<PocAttendanceCourse[]> => {
  const { data } = await http.get("/attendance/overview");
  if (!Array.isArray(data?.data)) throw new Error("Unexpected attendance payload");
  return data.data;
};

export const usePocCourses = () =>
  useQuery({ queryKey: pocKeys.courses(), queryFn: fetchCourses, staleTime: 60_000 });

export const usePocClients = () =>
  useQuery({ queryKey: pocKeys.clients(), queryFn: fetchClients, staleTime: 60_000 });

export const usePocServices = () =>
  useQuery({ queryKey: pocKeys.services(), queryFn: fetchServices, staleTime: 60_000 });

export const usePocAttendance = () =>
  useQuery({ queryKey: pocKeys.attendance(), queryFn: fetchAttendance, staleTime: 60_000 });

/**
 * The console's headline numbers, composed from the scoped endpoints above
 * rather than a bespoke summary endpoint — so the dashboard and the individual
 * pages can never disagree, and both share one cache entry per endpoint.
 */
export const usePocSummary = () => {
  const courses = usePocCourses();
  const clients = usePocClients();
  const services = usePocServices();
  const attendance = usePocAttendance();

  const loading =
    courses.isLoading || clients.isLoading || services.isLoading || attendance.isLoading;
  const error =
    courses.error || clients.error || services.error || attendance.error;

  const courseRows = courses.data ?? [];
  const attendanceRows = attendance.data ?? [];

  // "Active" = the training window is open today; "completed" = it has passed.
  // Derived from the same window the attendance module computes, so the console
  // cannot disagree with the attendance screens about which courses are live.
  const today = new Date().toISOString().slice(0, 10);
  const scheduled = attendanceRows.filter((c) => c.hasSchedule);
  const active = scheduled.filter((c) => !c.trainingEnd || c.trainingEnd >= today);
  const completed = scheduled.filter((c) => c.trainingEnd && c.trainingEnd < today);

  // Roster-derived learner totals — mirrors the admin analytics semantics
  // (pedagogyView.js:1988) so the two dashboards agree on what "active" means:
  // distinct users across a course's batches, then filtered by user.status.
  let totalLearners = 0;
  let activeLearners = 0;
  let totalModules = 0;
  for (const course of courseRows) {
    const seen = new Set<string>();
    const seenActive = new Set<string>();
    (course.batchAndParticipants ?? []).forEach((batch) => {
      (batch.users ?? []).forEach((entry) => {
        const ref = entry?.user;
        const id =
          !ref
            ? null
            : typeof ref === "string"
            ? ref
            : ref._id ?? null;
        if (!id) return;
        const key = String(id);
        seen.add(key);
        const status =
          typeof ref === "object" && ref?.status ? ref.status : entry?.status;
        if (String(status || "").toLowerCase() === "active") seenActive.add(key);
      });
    });
    // Both counts come from the same enumeration so `active` can never exceed
    // `total`. `participantCount` from the server would be preferable for
    // totals (it also drops dangling user refs), but there's no matching
    // server-side active count — mixing the two produced active > total in
    // practice.
    totalLearners += seen.size;
    activeLearners += seenActive.size;
    totalModules += course.moduleCount ?? 0;
  }

  // Distinct clients as the admin dashboard measures them — courses with a
  // resolvable clientName. Falls back to the client-list length if the
  // course rows never carry the name (older payloads).
  const clientsFromCourses = new Set(
    courseRows.map((c) => c.clientName).filter(Boolean) as string[]
  );

  return {
    loading,
    error,
    // The empty state is the CURRENT normal case: no POC is enrolled in
    // anything until an admin enrols them.
    isEmpty: !loading && courseRows.length === 0,
    courses: courseRows,
    clients: clients.data ?? [],
    services: services.data ?? [],
    attendance: attendanceRows,
    refetch: () => {
      courses.refetch();
      clients.refetch();
      services.refetch();
      attendance.refetch();
    },
    isFetching:
      courses.isFetching ||
      clients.isFetching ||
      services.isFetching ||
      attendance.isFetching,
    stats: {
      totalCourses: courseRows.length,
      activeCourses: active.length,
      completedCourses: completed.length,
      unscheduledCourses: courseRows.length - scheduled.length,
      clients: clientsFromCourses.size || (clients.data ?? []).length,
      services: (services.data ?? []).length,
      students: totalLearners,
      activeStudents: activeLearners,
      modules: totalModules,
    },
  };
};
