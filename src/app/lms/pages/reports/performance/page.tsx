"use client";

/**
 * Standalone Performance Report — /lms/pages/reports/performance
 *
 * The SAME Performance Report the L&D console owns (lddashboard #rep-performance),
 * rendered WITHOUT the L&D shell so the POC and trainer rails can open it from
 * their own "Report" entry without landing in the L&D sidebar.
 *
 *  • POC — opens inside the admin shell (DashboardLayout → POC rail). Client /
 *    course options come from the summary endpoint, which attachPocScope
 *    already narrows to the POC's enrolled courses server-side; the analytics
 *    endpoint is NOT scoped server-side, so the report is additionally pinned
 *    to those course ids client-side.
 *  • Trainer — opens inside StaffLayout. The client/course pickers offer ONLY
 *    the trainer's own courses: self-match over the roster
 *    (batchAndParticipants[].users[].user by id/email) ∪ attendance batches
 *    flagged `mine` — the same derivation the trainer dashboard uses.
 *  • Anyone else (admin / L&D who lands here) sees the unscoped report.
 *
 * Report component, CSS and ViewFilter contract are imported from the L&D
 * console module rather than forked — one report, three entry points.
 */

import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/app/lms/component/layout";
import { StaffLayout } from "@/app/lms/component/stafflayout/staff-layout";
import { LDX_CSS, type CourseOpt } from "@/app/lms/component/ldshell/LDLayout";
import { PerformanceReport, LDC_CSS, type ViewFilter } from "@/app/lms/pages/lddashboard/page";
import { courseStructuresSummaryQuery, courseStructureApi } from "@/apiServices/createCourseStucture";
import { attendanceApi } from "@/apiServices/attendanceApi";
import { queryKeys } from "@/lib/queryKeys";
import { isPocSession } from "@/lib/session";
import { Loading } from "@/components/loading-ui/loading";

/* The .ldx block styles a full L&D viewport (flex row, 100vh canvas). Here it
   only exists to carry the palette + control styles the report classes read,
   so flatten it into a plain padded block that fills whichever shell hosts it. */
const STANDALONE_CSS = `
.ldx.ldx-standalone{display:block; min-height:100%; height:auto; background:var(--page); padding:20px 26px 36px;}
@media (min-width:1600px){ .ldx.ldx-standalone{padding:24px 36px 40px;} }
`;

const readMe = (): any => {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(localStorage.getItem("smartcliff_userData") || "null");
  } catch {
    return null;
  }
};

type Mode = { shell: "admin" | "staff"; poc: boolean };

export default function StandalonePerformanceReport() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [client, setClient] = useState("all");
  const [course, setCourse] = useState("all");

  // Shell + scoping mode from the stored session — same split grades/page.tsx
  // uses, with POC pinned to the admin shell (its rail lives in sidebar.tsx).
  useEffect(() => {
    const poc = isPocSession();
    const u = readMe();
    const role = u?.role;
    const roleStr = String(
      (typeof role === "object" ? role?.roleValue || role?.originalRole || role?.renameRole : role) ||
        localStorage.getItem("smartcliff_originalRole") ||
        "",
    )
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const adminish = ["admin", "ldhead", "subhead", "programcoordinator"].some((r) => roleStr.includes(r));
    setMode({ shell: poc || adminish ? "admin" : "staff", poc });
  }, []);

  /* ── course options (summary projection — 3 scalars per course) ────────── */
  const summaryQ = useQuery(courseStructuresSummaryQuery());
  const allCourses = useMemo<CourseOpt[]>(
    () =>
      (Array.isArray(summaryQ.data) ? summaryQ.data : []).map((c: any) => ({
        id: String(c._id),
        name: c.courseName || "Untitled",
        client: c.clientName || "Unassigned",
      })),
    [summaryQ.data],
  );

  /* ── trainer scope: roster self-match ∪ attendance "mine" batches ──────── */
  const isStaff = mode?.shell === "staff";
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const rosterQ = useQuery({ ...(courseStructureApi.getAll() as any), enabled: isStaff });
  const attnQ = useQuery({
    queryKey: queryKeys.attendance.overview(today),
    queryFn: () => attendanceApi.overview(today),
    staleTime: 30_000,
    enabled: isStaff,
  });

  const trainerIds = useMemo<Set<string> | null>(() => {
    if (!isStaff) return null;
    const me = readMe();
    const myId = me?._id ? String(me._id) : "";
    const myEmail = String(me?.email || "").toLowerCase();
    const ids = new Set<string>();

    const roster: any[] = Array.isArray(rosterQ.data) ? (rosterQ.data as any[]) : [];
    roster.forEach((c: any) => {
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

    // Cached shape for this shared key is the { role, data } envelope.
    ((attnQ.data as any)?.data ?? []).forEach((c: any) => {
      if ((Array.isArray(c.batches) ? c.batches : []).some((b: any) => b.mine)) {
        ids.add(String(c._id));
      }
    });

    return ids;
  }, [isStaff, rosterQ.data, attnQ.data]);

  /* ── effective scope: trainer → own courses; POC → summary (server-scoped);
        anything else → unscoped ─────────────────────────────────────────── */
  const baseIds = useMemo<Set<string> | null>(() => {
    if (isStaff) return trainerIds;
    if (mode?.poc) return new Set(allCourses.map((c) => c.id));
    return null;
  }, [isStaff, trainerIds, mode?.poc, allCourses]);

  const scopedCourses = useMemo(
    () => (baseIds === null ? allCourses : allCourses.filter((c) => baseIds.has(c.id))),
    [allCourses, baseIds],
  );
  const clients = useMemo(
    () => Array.from(new Set(scopedCourses.map((c) => c.client).filter(Boolean))).sort(),
    [scopedCourses],
  );
  const courseOpts = useMemo(
    () => (client === "all" ? scopedCourses : scopedCourses.filter((c) => c.client === client)),
    [scopedCourses, client],
  );
  const clientById = useMemo(() => new Map(scopedCourses.map((c) => [c.id, c.client])), [scopedCourses]);
  const clientOf = useMemo(() => (id: string) => clientById.get(id), [clientById]);

  // Intersection of the caller's scope and the selected client — the set the
  // report's inScope() reads (the course picker narrows further via f.course).
  const courseIds = useMemo<Set<string> | null>(() => {
    const clientIds = client === "all" ? null : new Set(courseOpts.map((c) => c.id));
    if (baseIds === null) return clientIds;
    if (clientIds === null) return baseIds;
    return new Set([...baseIds].filter((id) => clientIds.has(id)));
  }, [baseIds, client, courseOpts]);

  const f = useMemo<ViewFilter>(
    () => ({
      client,
      course,
      clients,
      courseOpts,
      courseIds,
      clientOf,
      onClient: (v: string) => {
        setClient(v);
        setCourse("all");
      },
      onCourse: (v: string) => setCourse(v),
    }),
    [client, course, clients, courseOpts, courseIds, clientOf],
  );

  if (!mode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loading size="size-8" />
      </div>
    );
  }

  // For a trainer, hold the report until both scope sources settle — otherwise
  // institution-wide numbers flash before the roster narrows them.
  const scopeSettling = isStaff && (rosterQ.isLoading || attnQ.isLoading);

  const content = (
    <div className="ldx ldx-standalone">
      <style>{LDX_CSS}</style>
      <style>{LDC_CSS}</style>
      <style>{STANDALONE_CSS}</style>
      {scopeSettling ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
          <Loading size="size-8" />
        </div>
      ) : (
        <PerformanceReport f={f} />
      )}
    </div>
  );

  return mode.shell === "admin" ? (
    <DashboardLayout>{content}</DashboardLayout>
  ) : (
    <StaffLayout>{content}</StaffLayout>
  );
}
