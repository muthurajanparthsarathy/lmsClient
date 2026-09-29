"use client";

/**
 * Data access + derivation for the Trainer dashboard.
 *
 * Mirrors the L&D dashboard's hook (`features/ld-dashboard`) — same endpoints,
 * same derivation layer — but scoped to the signed-in trainer:
 *
 *   • The analytics endpoint (`/analytics/staff/analytics/students`) is
 *     institution-wide on the server (`staffId` is never applied), so scope is
 *     resolved client-side: a course is "mine" when the signed-in user appears
 *     inside `batchAndParticipants[].users[]` on the roster, or when the
 *     attendance overview marks one of its batches `mine` (that endpoint IS
 *     staff-scoped server-side for non-admins).
 *   • If neither source yields a course (trainer not on any batch roster yet)
 *     the dashboard falls back to institution-wide data and says so in the
 *     subline, rather than rendering an empty page.
 *   • L&D alert destinations are `#hash` views inside the L&D console; they
 *     are remapped here to real trainer routes / in-page anchors.
 */

import { useMemo } from "react";
import type { DashboardModel, DashFilter } from "@/features/ld-dashboard/types";
import { deriveModel, pickFocusCourse } from "@/features/ld-dashboard/lib/metrics";
import { plural } from "@/features/ld-dashboard/lib/format";
// The five reads are IDENTICAL to the L&D dashboard's, so they share its
// query hooks rather than keeping a second uncached copy of the fetch layer.
// Same shared cache keys, so a trainer who opens both surfaces (or the L&D
// console) pays for each endpoint once, not once per page and per view mount.
import {
  useAnalyticsPayload,
  useAttendanceOverviewDay,
  useCourseAttendanceRecords,
  useFeedbackActivity,
  usePendingApprovalsList,
  useRosterList,
} from "@/features/ld-dashboard/hooks/use-ld-dashboard";

/* ── trainer-view shapes ─────────────────────────────────────────────────── */

export interface TrainerCourseOpt {
  id: string;
  label: string;
}

export interface CoursePerfRow {
  id: string;
  name: string;
  code: string;
  students: number;
  /** Mean completion %; null when the course has no learners. */
  avg: number | null;
  score: number | null;
  risk: number;
  attendance: { marked: number; total: number } | null;
  /** Per-student overall %, sorted low→high — a distribution, not a trend. */
  sparks: number[];
}

export interface BatchToday {
  key: string;
  batchName: string;
  courseName: string;
  courseId: string;
  students: number;
  marked: boolean;
  mine: boolean;
}

export interface UseTrainerDashboard {
  loading: boolean;
  error: string;
  model: DashboardModel | null;
  /** True while secondary panels are still resolving. */
  partial: boolean;
  /** True when the view is narrowed to the trainer's own courses. */
  scoped: boolean;
  coursePerf: CoursePerfRow[];
  batchesToday: BatchToday[];
  courseOptions: TrainerCourseOpt[];
  /** Active permission keys — panels use these to hide dead destinations. */
  permissionKeys: Set<string>;
}

export function useTrainerDashboard(course: string, onReset: () => void): UseTrainerDashboard {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const analytics = useAnalyticsPayload();
  const roster = useRosterList();
  const attendance = useAttendanceOverviewDay(today);
  const approvals = usePendingApprovalsList();
  const feedback = useFeedbackActivity();

  const me = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(localStorage.getItem("smartcliff_userData") || "null");
    } catch {
      return null;
    }
  }, []);

  const permissionKeys = useMemo(() => {
    const keys = new Set<string>();
    (me?.permissions || []).forEach((p: any) => {
      if (p?.isActive) keys.add(String(p.permissionKey || "").toLowerCase());
    });
    return keys;
  }, [me]);

  /* ── my courses: roster self-match ∪ attendance "mine" batches ─────────── */
  // Scope is only trustworthy once BOTH scope sources have settled (success or
  // error) — otherwise institution-wide data would flash under a "My teaching
  // overview" heading before the roster narrows it.
  const scopeResolved = !roster.loading && !attendance.loading;

  const { courseIds, scoped } = useMemo<{ courseIds: Set<string> | null; scoped: boolean }>(() => {
    if (!roster.data && !attendance.data) return { courseIds: null, scoped: false };
    const ids = new Set<string>();
    const myId = me?._id ? String(me._id) : "";
    const myEmail = String(me?.email || "").toLowerCase();

    (roster.data ?? []).forEach((c: any) => {
      (Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : []).forEach((b: any) => {
        (Array.isArray(b.users) ? b.users : []).forEach((u: any) => {
          const uu = u?.user;
          if (!uu) return;
          const matches =
            (myId && String(uu._id) === myId) ||
            (myEmail && String(uu.email || "").toLowerCase() === myEmail);
          if (matches) ids.add(String(c._id));
        });
      });
    });

    (attendance.data ?? []).forEach((c: any) => {
      if ((Array.isArray(c.batches) ? c.batches : []).some((b: any) => b.mine)) {
        ids.add(String(c._id));
      }
    });

    return ids.size > 0 ? { courseIds: ids, scoped: true } : { courseIds: null, scoped: false };
  }, [roster.data, attendance.data, me]);

  const clientOf = useMemo(() => {
    const m = new Map<string, string>();
    (roster.data ?? []).forEach((c: any) => m.set(String(c._id), c.clientName || "Unassigned"));
    return (id: string) => m.get(id);
  }, [roster.data]);

  const filter: DashFilter = useMemo(
    () => ({ client: "all", course, courseIds, clientOf, onReset }),
    [course, courseIds, clientOf, onReset],
  );

  const focusId = useMemo(() => {
    if (!analytics.data) return null;
    const inClient = (id: string) => courseIds === null || courseIds.has(id);
    return pickFocusCourse(analytics.data.rows, course, inClient);
  }, [analytics.data, course, courseIds]);

  const focusAttendance = useCourseAttendanceRecords(focusId);

  const inScope = useMemo(
    () => (id: string) =>
      (courseIds === null || courseIds.has(id)) && (course === "all" || id === course),
    [courseIds, course],
  );

  /* ── the model, re-perspectived for a trainer ──────────────────────────── */
  const model = useMemo<DashboardModel | null>(() => {
    if (!analytics.data) return null;
    const base = deriveModel({
      filter,
      analytics: analytics.data,
      roster: roster.data ?? [],
      attendanceToday: attendance.data ?? [],
      approvals: approvals.data ?? [],
      feedback: feedback.data ?? [],
      focusAttendance: focusAttendance.data ?? [],
      focusId,
    });

    // L&D alert hrefs are console hash views; point them at trainer surfaces.
    // `null` drops the alert (destination the trainer cannot open).
    const HREFS: Record<string, string | null> = {
      att: permissionKeys.has("attendancemanagement")
        ? "/lms/pages/attendancemanagement"
        : "#todays-batches",
      risk: "#at-risk",
      idle: "#at-risk",
      new: "#at-risk",
      low: "#course-performance",
      appr: permissionKeys.has("approvals") ? "/lms/pages/approvals" : null,
    };
    const alerts = base.alerts
      .filter((a) => !(a.id in HREFS) || HREFS[a.id] !== null)
      .map((a) => (a.id in HREFS ? { ...a, href: HREFS[a.id] as string } : a));

    const courseRow = course !== "all" ? analytics.data.rows.find((r) => r.id === course) : null;
    const scope = courseRow ? courseRow.name : "My teaching overview";
    const subline =
      base.courses === 0
        ? "No courses on your roster yet"
        : `${plural(base.courses, "course")} · ${base.students.toLocaleString()} students enrolled` +
          (scoped ? "" : " · showing all courses (no batch assignment found)");
    // The unscoped-fallback claim is only honest once the scope sources settled.

    return { ...base, scope, subline, filtered: course !== "all", alerts };
    // filter.onReset is a stable callback from the page; scope by value fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    analytics.data,
    roster.data,
    attendance.data,
    approvals.data,
    feedback.data,
    focusAttendance.data,
    focusId,
    course,
    courseIds,
    scoped,
    permissionKeys,
  ]);

  /* ── per-course performance (replaces the L&D client/trainer panels) ───── */
  const coursePerf = useMemo<CoursePerfRow[]>(() => {
    if (!analytics.data) return [];
    const rows = analytics.data.rows.filter((r) => inScope(r.id));
    const studs = analytics.data.students.filter((s) => inScope(s.courseId));

    const scoreAgg = new Map<string, { s: number; n: number }>();
    const riskAgg = new Map<string, number>();
    const sparkAgg = new Map<string, number[]>();
    studs.forEach((x) => {
      if (x.score !== null) {
        const e = scoreAgg.get(x.courseId) || { s: 0, n: 0 };
        e.s += x.score;
        e.n += 1;
        scoreAgg.set(x.courseId, e);
      }
      if (x.overall > 0 && x.overall < 50) {
        riskAgg.set(x.courseId, (riskAgg.get(x.courseId) || 0) + 1);
      }
      const sp = sparkAgg.get(x.courseId) || [];
      sp.push(x.overall);
      sparkAgg.set(x.courseId, sp);
    });

    const attMap = new Map<string, { marked: number; total: number }>();
    (attendance.data ?? []).forEach((c: any) => {
      if (!c.hasSchedule) return;
      const id = String(c._id);
      if (!inScope(id)) return;
      const e = { marked: 0, total: 0 };
      (Array.isArray(c.batches) ? c.batches : []).forEach((b: any) => {
        e.total += 1;
        if (b.markedToday) e.marked += 1;
      });
      attMap.set(id, e);
    });

    return rows
      .map((r) => {
        const sc = scoreAgg.get(r.id);
        return {
          id: r.id,
          name: r.name,
          code: r.code,
          students: r.students,
          avg: r.students > 0 ? r.avg : null,
          score: sc && sc.n ? Math.round(sc.s / sc.n) : null,
          risk: riskAgg.get(r.id) || 0,
          attendance: attMap.get(r.id) || null,
          sparks: (sparkAgg.get(r.id) || []).slice().sort((a, b) => a - b),
        };
      })
      .sort((a, b) => b.students - a.students);
  }, [analytics.data, attendance.data, inScope]);

  /* ── today's batches (attendance overview, pending first) ──────────────── */
  const batchesToday = useMemo<BatchToday[]>(() => {
    const out: BatchToday[] = [];
    (attendance.data ?? []).forEach((c: any) => {
      if (!c.hasSchedule) return;
      const id = String(c._id);
      if (!inScope(id)) return;
      (Array.isArray(c.batches) ? c.batches : []).forEach((b: any, i: number) => {
        out.push({
          key: `${id}-${b._id || b.batchName || i}`,
          batchName: b.batchName || "Batch",
          courseName: c.courseName || "Course",
          courseId: id,
          students: Number(b.studentCount) || 0,
          marked: !!b.markedToday,
          mine: !!b.mine,
        });
      });
    });
    return out.sort((a, b) => Number(a.marked) - Number(b.marked));
  }, [attendance.data, inScope]);

  /* ── course filter options (ids stay unique across same-name records) ──── */
  const courseOptions = useMemo<TrainerCourseOpt[]>(() => {
    if (!analytics.data) return [];
    const rows = analytics.data.rows.filter((r) => courseIds === null || courseIds.has(r.id));
    const nameCount = new Map<string, number>();
    rows.forEach((r) => nameCount.set(r.name, (nameCount.get(r.name) || 0) + 1));
    return rows
      .map((r) => ({
        id: r.id,
        label:
          (nameCount.get(r.name) || 0) > 1 && r.code && r.code !== "—"
            ? `${r.name} (${r.code})`
            : r.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [analytics.data, courseIds]);

  return {
    // Hold the skeleton until the scope sources settle so institution-wide
    // numbers never masquerade as "my courses" for a frame.
    loading: analytics.loading || !scopeResolved,
    error: analytics.error,
    model,
    partial: roster.loading || attendance.loading || approvals.loading || feedback.loading,
    scoped,
    coursePerf,
    batchesToday,
    courseOptions,
    permissionKeys,
  };
}
