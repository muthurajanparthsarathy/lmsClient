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
  batchAndParticipants?: { users?: unknown[] }[];
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
    stats: {
      totalCourses: courseRows.length,
      activeCourses: active.length,
      completedCourses: completed.length,
      unscheduledCourses: courseRows.length - scheduled.length,
      clients: (clients.data ?? []).length,
      services: (services.data ?? []).length,
      students: attendanceRows.reduce((n, c) => n + (c.totalStudents || 0), 0),
    },
  };
};
