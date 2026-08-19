"use client";

/**
 * L&D Head console — self-contained area inside the dedicated LDLayout shell.
 * View switching is hash-driven (mirrors the approved wireframe). Views wire to
 * real endpoints where the platform already exposes the data:
 *   Dashboard / Student Performance → /analytics/staff/analytics/students
 *   Course Insight / Trainers / Rules → /courses-structure/getAll
 *   Approval Queue → /approvals/pending      Schedule → /program-calendar/getAll
 *   Attendance → /attendance/overview        Profile → local session
 * Feedback (rail item) reuses the finished Feedback Report — one
 * implementation behind both #fb-summary and Reports ▸ #rep-feedback.
 */

import { Fragment, Suspense, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  Target, Users, CheckCircle2, AlertTriangle, Building2, BookOpen,
  Activity, GraduationCap, ArrowUpRight, FileText, Eye, EyeOff,
  ChevronRight, ChevronLeft, ChevronDown, Check, ClipboardList, CalendarCheck, Star, Clock, UserCheck,
  Search, Bell, Settings, SlidersHorizontal, ArrowLeft, X, Printer, Download, FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import LDLayout, { LDView, CourseOpt, LDSelect } from "../../component/ldshell/LDLayout";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsPreviewingAsStudent } from "../../component/useAccountMenu";
import ApprovalHierarchyModal from "../../component/ApprovalHierarchyModal";
// Redesigned dashboard view. Owns its own data fetching and derivations
// (src/features/ld-dashboard) — the legacy DashboardView below is superseded.
import { LDDashboard } from "@/features/ld-dashboard";
import { DataTable, type Column } from "@/components/data-table";
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import { readStoredUserData } from "@/app/lms/shared/ui/navItems";
import { useClients } from "@/apiServices/clientManagementService";
import { useServiceMappings } from "@/apiServices/serviceMappingService";
import { courseStructureApi, courseStructuresSummaryQuery } from "@/apiServices/createCourseStucture";
import { attendanceApi } from "@/apiServices/attendanceApi";
import { programCalendarApi } from "@/apiServices/programCalendarApi";
import { fetchAllPedagogyViews } from "@/apiServices/pedagogyAndModuleAdd/pedagogy";
import CourseActionsMenu from "../coursestructure/components/CourseActionsMenu";
import dynamic from "next/dynamic";

/* The real screens, hosted in this shell instead of navigated to. Loaded on
   demand: each is a large client bundle and none of them is needed until a
   course's Manage-course menu asks for it. They keep working as their own
   routes for admin — this console just renders the same components. */
const PedagogyManagementContent = dynamic(
  () => import("../coursestructure/pedagogy2/PedagogyManagementContent"),
  { ssr: false, loading: () => <Loading /> },
);
const ProgramCalendarContent = dynamic(
  () => import("../coursestructure/programcalendar/ProgramCalendarContent"),
  { ssr: false, loading: () => <Loading /> },
);
const CourseParticipantsContent = dynamic(
  () => import("../coursestructure/course-participants/CourseParticipantsContent"),
  { ssr: false, loading: () => <Loading /> },
);
/* The feedback screen's own per-form report modal — detailed view, response
   filters, column pickers and Print / Excel / PDF. On demand: it ships
   exceljs + jspdf, which must not join this page's bundle. */
const FeedbackFormReportModal = dynamic(
  () => import("../coursestructure/feedback/report/FeedbackReportExportModal"),
  { ssr: false },
);
/* Course-level attendance report — daily register + per-student summary +
   charts. On demand: ships ExcelJS + jspdf + jspdf-autotable + file-saver via
   its Download modal, which must not join this page's initial bundle. */
const AttendanceReportPage = dynamic(
  () => import("@/features/attendancemanagement/AttendanceReportPage"),
  { ssr: false, loading: () => <Loading /> },
);
/* Detailed Report designer for #rep-performance — Canva-style overlay with
   activity / sub-category / grade pickers, removable preview sections, and
   Excel / PDF exports. Dynamic so exceljs + jspdf never join the page
   bundle until a head actually opens the designer. */
const PerformanceReportDesignerModal = dynamic(
  () => import("./PerformanceReportDesignerModal"),
  { ssr: false },
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com";
const getToken = () =>
  typeof window === "undefined"
    ? ""
    : localStorage.getItem("smartcliff_token") || localStorage.getItem("token") || "";
const authGet = async (path: string) => {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
};
const n = (v: unknown) => (typeof v === "number" && !isNaN(v) ? v : 0);
const pct = (v: number) => `${Math.round(v)}%`;
const roleName = (role: any): string => {
  if (!role) return "";
  if (typeof role === "string") return role;
  return (role.renameRole || role.originalRole || role.roleValue || role.name || "").toString();
};

const VIEWS: LDView[] = [
  "dashboard", "appr-queue", "appr-rules", "clients", "courses", "content", "schedule",
  "trainers", "attendance", "perf-progress", "perf-results",
  "fb-summary", "reports", "profile",
  "rep-performance", "rep-attendance", "rep-delivery", "rep-feedback", "rep-clients",
  "course-structure", "course-calendar", "course-enrollment",
];

/**
 * Scope handed to every list view.
 *
 * The selected client/course live in LDConsole, above the hash router, so they
 * survive view changes by construction — a card on the dashboard can navigate
 * to a list and the list opens already narrowed. `onClient`/`onCourse` let a
 * row drill further in without the user going back to the filter bar.
 */
type ViewFilter = {
  client: string;
  course: string;
  /* Option lists for the page-owned ScopeFilters pickers. */
  clients: string[];
  courseOpts: CourseOpt[];
  courseIds: Set<string> | null;
  clientOf: (id: string) => string | undefined;
  onClient: (v: string) => void;
  onCourse: (v: string) => void;
};

/** True when a course id is inside the current client + course selection. */
const inScope = (f: ViewFilter, id: string) =>
  (f.courseIds === null || f.courseIds.has(id)) && (f.course === "all" || f.course === id);

/** "Kanban Ltd · Java Basics" — what the current selection actually is. */
const scopeLabel = (f: ViewFilter, courseName?: string) => {
  const bits: string[] = [];
  if (f.client !== "all") bits.push(f.client);
  if (f.course !== "all" && courseName) bits.push(courseName);
  return bits.length ? bits.join(" · ") : "";
};
function useHashView(): LDView {
  const [v, setV] = useState<LDView>("dashboard");
  useEffect(() => {
    const read = () => {
      const h = (window.location.hash || "").replace("#", "") as LDView;
      setV(VIEWS.includes(h) ? h : "dashboard");
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return v;
}

/* generic states */
const Loading = () => <div className="ldc-empty">Loading…</div>;
const ErrBox = ({ m }: { m: string }) => <div className="ldc-empty ldc-err">{m}</div>;
/* Page header. The breadcrumb trail is gone — the rail is always visible with
   the active item lit, so the trail only repeated it. Views with NO rail entry
   (Course Insight, Trainers, Schedule, hosted course screens) pass `showBack`
   to get a lone chip back to the dashboard instead. `eyebrow` stays in the
   type so the many existing call sites keep compiling; it is not rendered. */
const Head = ({ title, sub, back = "#dashboard", right, showBack }: { eyebrow?: string; title: string; sub?: string; back?: string; right?: ReactNode; showBack?: boolean }) => (
  <div className={sub ? "ldc-head" : "ldc-head nosub"}>
    <div className="ldc-head-l">
    {showBack ? (
      <a
        href={back}
        className="mb-2 inline-flex items-center gap-1 rounded-chip px-1 py-0.5 text-xs font-medium text-brand-700 outline-none transition-colors duration-fast hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:text-brand-400 dark:hover:bg-brand-500/15"
      >
        <ArrowLeft size={13} strokeWidth={2.4} aria-hidden />
        Back to Dashboard
      </a>
    ) : null}
    <h1>{title}</h1>
    {sub ? <p>{sub}</p> : null}
    </div>
    {right ? <div className="ldc-head-r">{right}</div> : null}
  </div>
);
const Note = ({ children }: { children: ReactNode }) => <p className="ldc-note">{children}</p>;

/* ── Page-owned scope pickers ─────────────────────────────────────────────
   The shell's top bar no longer hosts the Client/Course filters. Each view
   renders only the dimension that changes what it shows, in its own header
   row (Head's `right` slot). The STATE still lives in LDConsole, so a
   selection keeps surviving view switches exactly as before. */
type ScopeBar = {
  client: string; course: string;
  clients: string[]; courseOpts: CourseOpt[];
  onClient: (v: string) => void; onCourse: (v: string) => void;
};
function ScopeFilters({ f, client = true, course = true, reset = true }: { f: ScopeBar; client?: boolean; course?: boolean; reset?: boolean }) {
  const clientOptions = [
    { value: "all", label: "All clients" },
    ...f.clients.map((c) => ({ value: c, label: c })),
  ];
  const courseOptions = [
    { value: "all", label: `All courses (${f.courseOpts.length})` },
    ...f.courseOpts.map((c) => ({ value: c.id, label: c.name })),
  ];
  const isFiltered = (client && f.client !== "all") || (course && f.course !== "all");
  return (
    <>
      {client ? <FloatingPicker label="Client" minWidth="min-w-[180px]" value={f.client} options={clientOptions} onChange={f.onClient} searchable={clientOptions.length > 8} /> : null}
      {course ? <FloatingPicker label="Course" minWidth="min-w-[220px]" value={f.course} options={courseOptions} onChange={f.onCourse} searchable={courseOptions.length > 8} /> : null}
      {reset && isFiltered ? <button className="ldx-add" type="button" onClick={() => f.onClient("all")}>Reset</button> : null}
    </>
  );
}

/* ───────── shared list primitives (used by the DataTable-backed views) ─────────
   These read from the project's design tokens rather than the legacy `ldc-*`
   CSS string, so they inherit dark mode and stay consistent with the redesigned
   dashboard. Tailwind needs whole class names at build time, hence the literal
   maps rather than string interpolation. */
type StatusTone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

const TONE_CHIP: Record<StatusTone, string> = {
  neutral: "bg-ink-100 text-subtle dark:bg-ink-800",
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400",
  success: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  warning: "bg-warn-50 text-warn-700 dark:bg-warn-500/15 dark:text-warn-500",
  danger: "bg-danger-50 text-danger-700 dark:bg-danger-500/15 dark:text-danger-500",
  info: "bg-info-50 text-info-700 dark:bg-info-500/15 dark:text-info-500",
};
const TONE_FILL: Record<StatusTone, string> = {
  neutral: "bg-ink-300 dark:bg-ink-600",
  brand: "bg-brand-500",
  success: "bg-success-500",
  warning: "bg-warn-500",
  danger: "bg-danger-500",
  info: "bg-info-500",
};

function StatusChip({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-chip px-2 py-0.5 text-2xs font-semibold whitespace-nowrap ${TONE_CHIP[tone]}`}>
      {children}
    </span>
  );
}

/* `value === null` means the metric does not apply (e.g. a stage with no
   content). It renders an empty track with NO fill — the old behaviour clamped
   every bar to a 3% minimum, so an N/A stage showed a sliver that read as
   "a little progress" rather than "nothing here to measure". */
function StatusMeter({ value, tone = "brand" }: { value: number | null; tone?: StatusTone }) {
  const na = value === null;
  return (
    <span
      role={na ? undefined : "progressbar"}
      aria-valuenow={na ? undefined : Math.round(value)}
      aria-valuemin={na ? undefined : 0}
      aria-valuemax={na ? undefined : 100}
      className="block h-1.5 w-full min-w-10 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
    >
      {!na && (
        <span
          className={`block h-full rounded-full transition-[width] duration-slow ${TONE_FILL[tone]}`}
          style={{ width: `${Math.max(3, Math.min(100, value))}%` }}
        />
      )}
    </span>
  );
}

const MONO_TONES: StatusTone[] = ["brand", "info", "success", "warning", "danger"];
function Monogram({ name }: { name: string }) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const init = parts.length === 0 ? "?" : parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span aria-hidden className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-2xs font-semibold ${TONE_CHIP[MONO_TONES[hash % MONO_TONES.length]]}`}>
      {init}
    </span>
  );
}

const TONE_TEXT: Record<StatusTone, string> = {
  neutral: "text-subtle",
  brand: "text-brand-700 dark:text-brand-400",
  success: "text-success-700 dark:text-success-500",
  warning: "text-warn-700 dark:text-warn-500",
  danger: "text-danger-700 dark:text-danger-500",
  info: "text-info-700 dark:text-info-500",
};

/* The I Do → We Do → You Do funnel for one learner, as a single compact cell.
   Read as a set: a learner strong on I Do but weak on You Do can follow along
   but cannot yet work unaided — a different problem from one who never started. */
function StageTriple({ iDo, weDo, youDo }: { iDo: number | null; weDo: number | null; youDo: number | null }) {
  const stages: { label: string; short: string; v: number | null }[] = [
    { label: "I Do", short: "I", v: iDo },
    { label: "We Do", short: "W", v: weDo },
    { label: "You Do", short: "Y", v: youDo },
  ];
  return (
    <span className="grid w-full min-w-0 grid-cols-3 gap-2">
      {stages.map((s) => (
        <span key={s.label} className="min-w-0" title={`${s.label}: ${s.v === null ? "no content in this course" : `${s.v}% complete`}`}>
          <span className="flex items-baseline gap-1">
            <span className="text-2xs font-medium text-subtle">{s.label}</span>
            <b className={`ml-auto text-2xs font-semibold tabular-nums ${s.v === null ? "text-faint" : "text-heading"}`}>
              {s.v === null ? "N/A" : `${s.v}%`}
            </b>
          </span>
          <StatusMeter
            value={s.v}
            tone={s.v === null ? "neutral" : s.v >= 85 ? "success" : s.v < 50 ? "danger" : "brand"}
          />
        </span>
      ))}
    </span>
  );
}

type StudentPerfRow = {
  name: string; course: string; courseId: string; progress: number;
  iDo: number | null; weDo: number | null; youDo: number | null; score: number | null;
};

/* ═════════ Data access ═════════
   Every read on this console used to be its own useState + useEffect + fetch
   (`useData`): no cache, no request dedup, nothing shared between views. Ten
   components asked for /courses-structure/getAll and made ten requests of
   348 KB each; the 12-second analytics call was made four times; and every
   rail-view switch unmounted the lot and paid for all of it again.

   The hooks below keep the `{ loading, error, data }` triple the views
   already destructure — only the transport changes. Each one rides the app's
   SHARED query key for its endpoint (the same cache entries Course Setup,
   Business Management, Attendance Management and the Approvals page fill),
   so the reads collapse into ONE request per endpoint, survive view switches,
   and are refreshed by the mutations those other pages already invalidate.
   Nothing here invents a parallel key. */

type Async<T> = { loading: boolean; error: string; data: T | null };

/** Run a shared query entry and shape its payload for this call site.
 *
 *  `map` runs in a useMemo keyed on the raw payload rather than through React
 *  Query's `select`: several of these maps walk every student in the
 *  institution, and an inline lambda handed to `select` re-runs on every
 *  render. One map per payload change is also exactly what the old hook did. */
function useShared<T>(
  options: UseQueryOptions<any, Error, any, any>,
  map: (j: any) => T,
  fallback = "Could not load",
): Async<T> {
  const q = useQuery(options);
  const raw = q.data;
  const data = useMemo(
    () => (raw === undefined ? null : map(raw)),
    // `map` is intentionally excluded — call sites pass inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw],
  );
  // A gated query (`enabled: false`) is idle, not loading — reporting it as
  // loading would hang the view on a permanent skeleton.
  const idle = options.enabled === false;
  return {
    // `isPending` is false the moment a cached entry exists, which is what
    // stops the "Loading…" flash on every rail switch.
    loading: !idle && q.isPending,
    error: q.isError ? (q.error as Error)?.message || fallback : "",
    data,
  };
}

/** Adapt a service's own hook (which already owns the shared key) to the same
 *  triple, so the call sites read identically either way. */
function asAsync<T>(
  q: { isPending: boolean; isError: boolean; error: unknown; data: T | undefined },
  fallback: string,
): Async<T> {
  return {
    loading: q.isPending,
    error: q.isError ? (q.error as Error)?.message || fallback : "",
    data: q.data ?? null,
  };
}

/** The signed-in user's id, read once. Per-user cache keys need it: a shared
 *  browser must never paint one account's approval queue for another. */
function useUserId(): string | null {
  const [id] = useState<string | null>(() => readStoredUserData()?._id ?? null);
  return id;
}

/* ── course structures: FULL vs SUMMARY ──────────────────────────────
   `?summary=1` is 43,189 B against 348,390 B for the same 68 courses, but the
   projection drops batchAndParticipants outright (along with I_Do / We_Do /
   You_Do, courseHierarchy and testConfiguration — see the .select() in
   server/controllers/courses/courseStructure.js). Checked field by field,
   only two readers on this page stay inside it: the shell's course picker
   (_id / courseName / clientName) and Rules & Approvers (approvalHierarchy,
   defaultApproverRole and the name/code/client scalars). Every other reader
   counts batches, names trainers or tallies students per batch off the
   roster, so it stays on the full payload. */

/** Full course-structure list — shared ['courseStructures'] entry. */
const useCourseStructures = (): Async<any[]> =>
  useShared(
    courseStructureApi.getAll() as UseQueryOptions<any, Error, any, any>,
    (rows) => (Array.isArray(rows) ? rows : []) as any[],
    "Could not load courses",
  );

/** Listing projection — shared ['courseStructures','summary'] entry. Only for
 *  readers that touch nothing outside the summary's fields. */
const useCourseStructuresSummary = (): Async<any[]> =>
  useShared(
    courseStructuresSummaryQuery() as UseQueryOptions<any, Error, any, any>,
    (rows) => (Array.isArray(rows) ? rows : []) as any[],
    "Could not load courses",
  );

/** Client registry — shared clientManagementKeys.lists() entry. */
const useClientRegistry = (): Async<any[]> =>
  asAsync(useClients() as any, "Could not load clients");

/** Service mappings — shared serviceMappingKeys.lists() entry. */
const useServiceMappingList = (): Async<any[]> =>
  asAsync(useServiceMappings() as any, "Could not load service mappings");

/** The caller's approval queue — shared queryKeys.approvals.pending(userId).
 *
 *  `refetchOnMount: "always"` is deliberate and copied from the Approvals
 *  page: items are acted on from view-resources, which does not invalidate
 *  this key, so a view that shows the queue must re-ask when it mounts.
 *  Mounting a new observer refetches; merely switching between other rail
 *  views no longer does, which is what the sidebar badge used to force on
 *  every hop. */
function usePendingApprovals(): Async<any[]> {
  const userId = useUserId();
  return useShared(
    {
      queryKey: queryKeys.approvals.pending(userId),
      queryFn: () => api.get<any>("/approvals/pending"),
      enabled: !!userId,
      staleTime: 30_000,
      refetchOnMount: "always",
    },
    (j) => (Array.isArray(j?.data) ? j.data : []) as any[],
    "Could not load approvals",
  );
}

/** The staff / L&D analytics roll-up. Cached as the RAW envelope because the
 *  four readers each want a different slice of it — the shaping stays at the
 *  call site, the 12-second request happens once. */
function useStaffAnalytics<T>(map: (j: any) => T): Async<T> {
  const userId = useUserId();
  return useShared(
    {
      queryKey: queryKeys.analytics.staffStudents(userId),
      queryFn: () => api.get<any>("/analytics/staff/analytics/students"),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    map,
    "Could not load analytics",
  );
}

/** Attendance overview for one day — shared queryKeys.attendance.overview(date),
 *  through the same fetcher Attendance Management uses, so the cached shape
 *  stays `{ role, data }` and both pages share one entry. */
function useAttendanceOverview<T>(date: string, map: (j: any) => T): Async<T> {
  return useShared(
    {
      queryKey: queryKeys.attendance.overview(date),
      queryFn: () => attendanceApi.overview(date),
      staleTime: 30_000,
    },
    map,
    "Could not load attendance",
  );
}

/** One course's attendance records — shared queryKeys.attendance.records().
 *  A null courseId leaves the query idle, as the old useDataOpt did. */
const useAttendanceRecords = (courseId: string | null): Async<any[]> =>
  useShared(
    {
      queryKey: queryKeys.attendance.records(courseId || ""),
      queryFn: () => attendanceApi.list(courseId || ""),
      enabled: !!courseId,
      staleTime: 2 * 60 * 1000,
    },
    (rows) => (Array.isArray(rows) ? rows : []) as any[],
    "Could not load attendance",
  );

/** Every feedback form in the institution. Cached as the raw envelope — the
 *  two readers shape it differently (response rows vs form rows). */
function useAllFeedback<T>(map: (j: any) => T): Async<T> {
  return useShared(
    {
      queryKey: queryKeys.feedback.list(),
      queryFn: () => api.get<any>("/getAll/feedback"),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    map,
    "Could not load feedback",
  );
}

/** Published program calendars — shared ['programCalendars'] entry. */
const useProgramCalendars = (): Async<any[]> =>
  useShared(
    programCalendarApi.getAll() as UseQueryOptions<any, Error, any, any>,
    (rows) => (Array.isArray(rows) ? rows : []) as any[],
    "Could not load calendars",
  );

/** Pedagogy views (planned hours) — shared queryKeys.pedagogy.views() entry.
 *  Not institution-scoped server-side; callers narrow by course id. */
const usePedagogyViews = (): Async<any[]> =>
  useShared(
    {
      queryKey: queryKeys.pedagogy.views(),
      queryFn: fetchAllPedagogyViews,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    (rows) => (Array.isArray(rows) ? rows : []) as any[],
    "Could not load pedagogy plans",
  );

/* ───────── Dashboard ───────── */
const stageVal = (p: any, k: string): number => {
  const v = p?.[k];
  if (typeof v === "number") return v;
  if (v && typeof v === "object") {
    const a = Object.values(v).filter((x) => typeof x === "number") as number[];
    return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  }
  return 0;
};

// Per-stage completion %, consistent with `overall` (attempts/exercises done).
// A stage is an object of sub-types, e.g. I_Do: { Video: {completed,total,...} }.
// Returns completed/total across sub-types, or null when the stage has NO
// content (total 0) — null means "not applicable", never counted as 0%.
const stageDone = (p: any, k: string): number | null => {
  const v = p?.[k];
  if (!v || typeof v !== "object") return null;
  let comp = 0, tot = 0;
  Object.values(v).forEach((sub: any) => {
    if (sub && typeof sub === "object" && ("total" in sub)) {
      comp += Number(sub.completed) || 0;
      tot += Number(sub.total) || 0;
    }
  });
  return tot > 0 ? Math.round((comp / tot) * 100) : null;
};

// Score metric (distinct from completion): the per-category `percentage` on
// We_Do/You_Do is score-weighted server-side (marks earned vs marks possible),
// so its mean is an honest "average score". I_Do is excluded — its percentage
// mirrors MCQ-doc completion, not marks.
const scoreOf = (p: any): number | null => {
  const vals: number[] = [];
  ["We_Do", "You_Do"].forEach((k) => {
    const v = p?.[k];
    if (!v || typeof v !== "object") return;
    Object.values(v).forEach((sub: any) => {
      if (sub && typeof sub === "object" && Number(sub.total) > 0 && typeof sub.percentage === "number") vals.push(Number(sub.percentage) || 0);
    });
  });
  return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
};

// ISO-week bucketing for the focus-course attendance chart.
const mondayKey = (d: Date): string => {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};
const wkLabel = (k: string): string => {
  const d = new Date(`${k}T00:00:00Z`);
  return isNaN(d.getTime()) ? k : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

type DashFilter = { client: string; course: string; courseIds: Set<string> | null; clientOf: (id: string) => string | undefined; onReset: () => void };

const STAGE_META = [
  { key: "iDo", label: "I Do", tag: "concept MCQs" },
  { key: "weDo", label: "We Do", tag: "guided practice" },
  { key: "youDo", label: "You Do", tag: "independent exercises" },
] as const;
const band = (v: number): [string, string] => (v >= 85 ? ["good", "On track"] : v < 50 ? ["bad", "Needs attention"] : ["warn", "In progress"]);

/* ── shared presentational atoms (student-dashboard style, ember palette) ── */
type Ico = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
const TINT: Record<string, string> = { ember: "#E2670F", good: "#0E9F6E", bad: "#B42318", violet: "#7C5CFC", blue: "#2E90C4", amber: "#C77700" };

function IconChip({ icon: Icon, tint }: { icon: Ico; tint: string }) {
  const c = TINT[tint] || TINT.ember;
  return <span className="ldc-ichip" style={{ background: `${c}17`, color: c }}><Icon size={17} strokeWidth={2.1} /></span>;
}

// Mini distribution bars (a shape, not a time-trend — honest with our data).
function Spark({ data, tint }: { data: number[]; tint: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const c = TINT[tint] || TINT.ember;
  return (
    <span className="ldc-spark">
      {data.slice(0, 16).map((v, i) => <i key={i} style={{ height: `${Math.max(10, (v / max) * 100)}%`, background: c, opacity: 0.35 + 0.65 * (v / max) }} />)}
    </span>
  );
}

function StatTile({ tint, icon, label, value, sub, spark, bar, delta }: {
  tint: string; icon: Ico; label: string; value: ReactNode; sub: string; spark?: number[]; bar?: number; delta?: string;
}) {
  return (
    <div className="ldc-stat">
      <div className="ldc-stat-top">
        <IconChip icon={icon} tint={tint} />
        {spark && spark.length ? <Spark data={spark} tint={tint} /> : delta ? <span className="ldc-delta"><ArrowUpRight size={12} strokeWidth={2.5} />{delta}</span> : null}
      </div>
      <div className="ldc-stat-v">{value}</div>
      <div className="ldc-stat-k">{label}</div>
      {typeof bar === "number" ? <span className="ldc-statbar"><i style={{ width: `${Math.min(100, Math.max(0, bar))}%`, background: TINT[tint] }} /></span> : null}
      <div className="ldc-stat-s">{sub}</div>
    </div>
  );
}

function Ring({ pct: p }: { pct: number }) {
  const size = 150, sw = 13, r = (size - sw) / 2, C = 2 * Math.PI * r;
  const off = C - (Math.min(100, Math.max(0, p)) / 100) * C;
  return (
    <svg width={size} height={size} className="ldc-ring" viewBox={`0 0 ${size} ${size}`}>
      <defs><linearGradient id="ldcring" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F0872E" /><stop offset="100%" stopColor="#B94E08" /></linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in srgb,var(--muted) 15%,transparent)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ldcring)" strokeWidth={sw} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function ProgBar({ label, tag, v }: { label: string; tag: string; v: number | null }) {
  const na = v === null;
  return (
    <div className="ldc-pb">
      <div className="ldc-pb-h"><span className="ldc-pb-l"><b>{label}</b><small>{tag}</small></span><span className="ldc-pb-v">{na ? <em className="ldc-na">N/A</em> : pct(v)}</span></div>
      <span className="ldc-pb-tk"><i className={na ? "" : band(v)[0]} style={{ width: `${na ? 0 : Math.max(2, Math.min(100, v))}%` }} /></span>
    </div>
  );
}

// Segmented donut (completed / in progress / not started) with center caption.
function Donut({ segs, center, sub, size = 128, sw = 15 }: { segs: { v: number; c: string }[]; center: string; sub: string; size?: number; sw?: number }) {
  const total = segs.reduce((s, x) => s + x.v, 0);
  const r = (size - sw) / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ldc-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="color-mix(in srgb,var(--muted) 15%,transparent)" strokeWidth={sw} />
      {total > 0 ? segs.map((s, i) => {
        const frac = s.v / total;
        const el = frac > 0 ? (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.c} strokeWidth={sw}
            strokeDasharray={`${frac * C} ${C}`} strokeDashoffset={-acc * C} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ) : null;
        acc += frac;
        return el;
      }) : null}
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="central" className="ldc-donut-n">{center}</text>
      <text x="50%" y="61%" textAnchor="middle" dominantBaseline="central" className="ldc-donut-l">{sub}</text>
    </svg>
  );
}

// Initials avatar, deterministic tint per name.
const AV_TINTS = ["ember", "good", "violet", "blue", "amber", "bad"];
function Av({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const init = ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return <span className="ldm-av" style={{ background: TINT[AV_TINTS[Math.abs(h) % AV_TINTS.length]] }}>{init}</span>;
}

function DashboardView({ filter }: { filter: DashFilter }) {
  const { client, course, courseIds, clientOf, onReset } = filter;
  const inClient = (id: string) => courseIds === null || courseIds.has(id);
  const todayKey = new Date().toISOString().slice(0, 10);

  // Primary payload — KPIs, progress, at-risk, client rollups.
  const main = useStaffAnalytics((j) => {
    const d = j?.data ?? j ?? {};
    const courses: any[] = Array.isArray(d.courses) ? d.courses : [];
    const rows: any[] = []; const students: any[] = [];
    courses.forEach((c) => {
      const co = c.course ?? {}; const s = c.stats ?? {};
      const cid = String(co._id || c._id || "");
      rows.push({ id: cid, name: co.courseName || c.courseName || "Untitled", code: co.courseCode || "—",
        client: co.clientName || "Unassigned", students: n(s.totalStudents ?? co.totalStudents), avg: n(s.averageProgress),
        done: n(s.completedStudents), prog: n(s.inProgressStudents), not: n(s.notStartedStudents) });
      (Array.isArray(c.students) ? c.students : []).forEach((stu: any) => {
        const p = stu.progress ?? stu; const st = stu.student ?? stu;
        students.push({
          name: `${st.firstName || ""} ${st.lastName || ""}`.trim() || st.email || "Student",
          course: co.courseName || c.courseName || "Course",
          courseId: cid,
          overall: n(p.overall ?? stu.overall),
          iDo: stageDone(p, "I_Do"), weDo: stageDone(p, "We_Do"), youDo: stageDone(p, "You_Do"),
          score: scoreOf(p), last: stu.lastActivity || null,
        });
      });
    });
    return { rows, students };
  });
  // Secondary sources — each panel degrades on its own if one fails.
  const roster = useCourseStructures();
  const attnDay = useAttendanceOverview(todayKey, (j) => (Array.isArray(j?.data) ? j.data : []));
  const appr = usePendingApprovals();
  const fbk = useAllFeedback((j) => {
    const docs = Array.isArray(j?.getAllFeedback) ? j.getAllFeedback : [];
    const out: any[] = [];
    docs.forEach((f: any) => (Array.isArray(f.studentResponses) ? f.studentResponses : []).forEach((r: any) => out.push({
      t: r.submittedAt || "", name: r.studentName || "Student",
      rating: typeof r.overallRating === "number" ? r.overallRating : null,
      title: f.feedbackTitle || "Feedback", courseId: String(f.courseId || ""),
    })));
    return out;
  });
  // Course Analytics focus: the filtered course, else the weakest active one —
  // the course the L&D Head should look at first.
  const focusId = useMemo(() => {
    if (!main.data) return null;
    const rs = (main.data.rows as any[]).filter((r) => inClient(r.id) && (course === "all" || r.id === course));
    if (course !== "all") return rs.find((r) => r.id === course)?.id ?? null;
    const active = rs.filter((r) => r.students > 0);
    return active.length ? [...active].sort((a, b) => a.avg - b.avg)[0].id : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [main.data, course, courseIds]);
  const attFocus = useAttendanceRecords(focusId);

  if (main.loading) return <><DashHead scope="All courses overview" sub="Loading your courses…" filtered={false} onReset={onReset} /><DashSkeleton /></>;
  if (main.error || !main.data) return <><DashHead scope="All courses overview" sub="" filtered={false} onReset={onReset} /><ErrBox m={main.error || "No data"} /></>;

  // Filter (client-side). Bridge the client filter through course IDs — the
  // analytics rows don't reliably carry clientName, so we match on ID.
  const filtered = client !== "all" || course !== "all";
  const rows = (main.data.rows as any[]).filter((r) => inClient(r.id) && (course === "all" || r.id === course));
  const studs = (main.data.students as any[]).filter((s) => inClient(s.courseId) && (course === "all" || s.courseId === course));

  // ── portfolio aggregates ────────────────────────────────────────────────
  const totalCourses = rows.length;
  const students = rows.reduce((s, r) => s + r.students, 0);
  const activeRows = rows.filter((r) => r.students > 0);
  const avg = activeRows.length ? Math.round(activeRows.reduce((s, r) => s + r.avg, 0) / activeRows.length) : 0;
  const st = rows.reduce((a, r) => ({ done: a.done + r.done, prog: a.prog + r.prog, not: a.not + r.not }), { done: 0, prog: 0, not: 0 });
  const donePct = students ? Math.round((st.done / students) * 100) : 0;
  const clientsInScope = new Set(rows.map((r) => clientOf(r.id) || r.client)).size;

  // marks-weighted score (We Do / You Do `percentage`), portfolio + per course
  const scored = studs.map((x) => x.score).filter((v): v is number => v !== null);
  const avgScore = scored.length ? Math.round(scored.reduce((s, v) => s + v, 0) / scored.length) : null;
  const scoreAgg = new Map<string, { s: number; n: number }>();
  studs.forEach((x) => { if (x.score !== null) { const e = scoreAgg.get(x.courseId) || { s: 0, n: 0 }; e.s += x.score; e.n++; scoreAgg.set(x.courseId, e); } });
  const courseScore = (id: string): number | null => { const e = scoreAgg.get(id); return e && e.n ? Math.round(e.s / e.n) : null; };

  // at-risk (started but below 50%), worst first — Critical rows sort to the top
  const atRisk = studs.filter((x) => x.overall > 0 && x.overall < 50).sort((a, b) => a.overall - b.overall);
  const atRiskPct = students ? Math.round((atRisk.length / students) * 100) : 0;
  const riskOf = (o: number): [string, string] => (o < 35 ? ["bad", "Critical"] : o < 45 ? ["bad", "High"] : ["warn", "Medium"]);

  // activity recency (lastAccessed — stamped on answer/progress writes)
  const now = Date.now();
  const DAY = 86400000;
  const active7 = studs.filter((x) => x.last && now - +new Date(x.last) <= 7 * DAY).length;
  const inactive7 = studs.filter((x) => x.overall > 0 && x.overall < 80 && x.last && now - +new Date(x.last) > 7 * DAY).length;

  // stage funnel (null = stage has no content → N/A)
  const mean = (k: "iDo" | "weDo" | "youDo") => {
    const vs = studs.map((x) => x[k]).filter((v): v is number => v !== null);
    return vs.length ? Math.round(vs.reduce((s, v) => s + v, 0) / vs.length) : null;
  };
  const funnel = STAGE_META.map((m) => ({ ...m, v: mean(m.key as "iDo" | "weDo" | "youDo") }));

  // ── attendance today (overview), scoped ─────────────────────────────────
  const ovRows = (attnDay.data || []).filter((c: any) => inClient(String(c._id)) && (course === "all" || String(c._id) === course));
  let batchT = 0, batchM = 0;
  const attByClient = new Map<string, { m: number; t: number }>();
  ovRows.forEach((c: any) => {
    if (!c.hasSchedule) return;
    const cn = clientOf(String(c._id)) || c.clientName || "Unassigned";
    const e = attByClient.get(cn) || { m: 0, t: 0 };
    (Array.isArray(c.batches) ? c.batches : []).forEach((b: any) => { batchT++; e.t++; if (b.markedToday) { batchM++; e.m++; } });
    attByClient.set(cn, e);
  });
  const pendingBatches = batchT - batchM;

  // ── client performance rollup ───────────────────────────────────────────
  const cMap = new Map<string, { students: number; avgs: number[]; scores: number[]; risk: number }>();
  rows.forEach((r) => {
    const cn = clientOf(r.id) || r.client || "Unassigned";
    const e = cMap.get(cn) || { students: 0, avgs: [], scores: [], risk: 0 };
    e.students += r.students;
    if (r.students > 0) e.avgs.push(r.avg);
    const sc = courseScore(r.id); if (sc !== null) e.scores.push(sc);
    cMap.set(cn, e);
  });
  atRisk.forEach((x) => { const cn = clientOf(x.courseId) || "Unassigned"; const e = cMap.get(cn); if (e) e.risk++; });
  const clientsPerf = [...cMap.entries()].map(([name, e]) => ({
    name, students: e.students,
    avg: e.avgs.length ? Math.round(e.avgs.reduce((s, v) => s + v, 0) / e.avgs.length) : null,
    score: e.scores.length ? Math.round(e.scores.reduce((s, v) => s + v, 0) / e.scores.length) : null,
    risk: e.risk, att: attByClient.get(name) || null,
    sparks: rows.filter((r) => (clientOf(r.id) || r.client || "Unassigned") === name && r.students > 0).map((r) => r.avg),
  })).sort((a, b) => b.students - a.students);

  // ── trainer performance (roster join → analytics rows by course _id) ────
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const tMap = new Map<string, { label: string; courses: Set<string>; students: Set<string> }>();
  (roster.data || []).filter((c: any) => inClient(String(c._id)) && (course === "all" || String(c._id) === course)).forEach((c: any) => {
    (Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : []).forEach((b: any) => {
      const us = Array.isArray(b.users) ? b.users : [];
      const batchStudents = us.filter((u: any) => { const rn = roleName(u.user?.role).toLowerCase(); return rn.includes("student") || rn === ""; });
      us.forEach((u: any) => {
        const rn = roleName(u.user?.role).toLowerCase();
        if (!rn.includes("trainer") && !rn.includes("faculty")) return;
        const email = u.user?.email || "";
        const key = String(u.user?._id || email || "trainer");
        const label = `${u.user?.firstName || ""} ${u.user?.lastName || ""}`.trim() || (email ? email.split("@")[0] : "Trainer");
        const e = tMap.get(key) || { label, courses: new Set<string>(), students: new Set<string>() };
        e.courses.add(String(c._id));
        batchStudents.forEach((s2: any) => e.students.add(String(s2.user?._id || s2.user?.email || s2._id)));
        tMap.set(key, e);
      });
    });
  });
  const trainerRows = [...tMap.values()].map((t) => {
    const cs = [...t.courses].map((id) => rowById.get(id)).filter(Boolean) as any[];
    const withStud = cs.filter((c) => c.students > 0);
    const comp = withStud.length ? Math.round(withStud.reduce((s, c) => s + c.avg, 0) / withStud.length) : null;
    const scores = [...t.courses].map((id) => courseScore(id)).filter((v): v is number => v !== null);
    const score = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
    return { name: t.label, courses: t.courses.size, students: t.students.size, comp, score };
  }).sort((a, b) => b.students - a.students);
  const rated = trainerRows.filter((t) => t.comp !== null);
  const topTrainer = rated.length > 1 ? [...rated].sort((a, b) => (b.comp as number) - (a.comp as number))[0] : null;
  const lowTrainer = rated.length > 1 ? [...rated].sort((a, b) => (a.comp as number) - (b.comp as number))[0] : null;

  // ── approvals + feedback (scoped) → recent activity feed ────────────────
  const apprRows = (appr.data || []).filter((a: any) => inClient(String(a.courseId || "")) && (course === "all" || String(a.courseId) === course));
  const fbRows = (fbk.data || []).filter((f: any) => inClient(f.courseId) && (course === "all" || f.courseId === course));
  const acts: { t: string; tint: string; main: string; sub: string }[] = [];
  apprRows.forEach((a: any) => acts.push({
    t: a.initiatedAt || "", tint: "amber",
    main: `${a.exerciseName || "Exercise"} sent for approval`,
    sub: `${a.tabType === "You_Do" ? "Assessment" : "Assignment"} · step ${n(a.currentStep) || 1} of ${n(a.totalSteps) || 1}`,
  }));
  fbRows.forEach((f: any) => acts.push({
    t: f.t, tint: "violet",
    main: `${f.name} submitted feedback${f.rating !== null ? ` · ${f.rating}/10` : ""}`,
    sub: f.title,
  }));
  [...studs].filter((x) => x.last).sort((a, b) => +new Date(b.last) - +new Date(a.last)).slice(0, 3)
    .forEach((x) => acts.push({ t: x.last, tint: "good", main: `${x.name} active in course`, sub: x.course }));
  const feed = acts.filter((a) => a.t).sort((a, b) => +new Date(b.t) - +new Date(a.t)).slice(0, 7);

  // ── alerts — every row is a real work queue, linked to its view ─────────
  const lowCourses = activeRows.filter((r) => r.avg < 50).length;
  const alerts: { n: number; cls: string; icon: Ico; txt: string; href: string }[] = [
    { n: pendingBatches, cls: "bad", icon: CalendarCheck, txt: "batches attendance pending today", href: "#attendance" },
    { n: atRisk.length, cls: "bad", icon: AlertTriangle, txt: "students at risk (below 50%)", href: "#perf-progress" },
    { n: inactive7, cls: "warn", icon: Clock, txt: "students inactive 7+ days", href: "#perf-progress" },
    { n: apprRows.length, cls: "warn", icon: ClipboardList, txt: "items awaiting your approval", href: "#appr-queue" },
    { n: lowCourses, cls: "bad", icon: BookOpen, txt: "courses below 50% completion", href: "#courses" },
    { n: st.not, cls: "neutral", icon: Users, txt: "students not started", href: "#perf-progress" },
  ].filter((a) => a.n > 0);

  // ── focus course metrics (Course Analytics panel) ───────────────────────
  const focus = focusId ? (rowById.get(focusId) as any) : null;
  const focusStuds = studs.filter((s) => s.courseId === focusId);
  const fMean = (k: "iDo" | "weDo" | "youDo") => {
    const vs = focusStuds.map((x) => x[k]).filter((v): v is number => v !== null);
    return vs.length ? Math.round(vs.reduce((s, v) => s + v, 0) / vs.length) : null;
  };
  const attRecs = attFocus.data || [];
  let attPresent = 0;
  attRecs.forEach((r: any) => { if (r.status === "P") attPresent++; else if (r.status === "H") attPresent += 0.5; });
  const attPct = attRecs.length ? Math.round((attPresent / attRecs.length) * 100) : null;
  const wkMap = new Map<string, { p: number; t: number }>();
  attRecs.forEach((r: any) => {
    const d = new Date(r.date); if (isNaN(d.getTime())) return;
    const k = mondayKey(d);
    const e = wkMap.get(k) || { p: 0, t: 0 };
    e.t++; if (r.status === "P") e.p++; else if (r.status === "H") e.p += 0.5;
    wkMap.set(k, e);
  });
  const weeks = [...wkMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-6)
    .map(([k, e]) => ({ label: wkLabel(k), v: Math.round((e.p / e.t) * 100) }));

  // ── header scope + sub-line (always denominatored) ───────────────────────
  const courseRow = course !== "all" ? rows.find((r) => r.id === course) : null;
  const clientLabel = client !== "all" ? client : courseRow ? (clientOf(courseRow.id) || "Unassigned") : "All clients";
  const scope = courseRow ? courseRow.name : client !== "all" ? client : "All courses overview";
  const subline = totalCourses === 0
    ? "No courses in this view"
    : courseRow
      ? `${clientLabel} · ${students.toLocaleString()} students enrolled`
      : `${clientLabel} · ${totalCourses} course${totalCourses === 1 ? "" : "s"} · ${students.toLocaleString()} students enrolled`;

  return (
    <>
      <DashHead scope={scope} sub={subline} filtered={filtered} onReset={onReset} alerts={alerts.reduce((s, a) => s + a.n, 0)} />

      {/* ── KPI grid (counts + health) · Quick Actions rail ── */}
      <div className="ldm-top">
        <div className="ldm-kpis">
          <StatTile tint="blue" icon={Building2} label="Clients" value={clientsInScope.toLocaleString()} sub={`${totalCourses} course${totalCourses === 1 ? "" : "s"} in scope`} />
          <StatTile tint="ember" icon={BookOpen} label="Courses" value={totalCourses.toLocaleString()} sub={`${activeRows.length} with enrolled students`} />
          <StatTile tint="violet" icon={GraduationCap} label="Students" value={students.toLocaleString()} sub={`${st.done.toLocaleString()} completed · ${st.not.toLocaleString()} not started`} />
          <StatTile tint="amber" icon={UserCheck} label="Trainers" value={roster.loading ? "…" : trainerRows.length.toLocaleString()} sub="assigned via course batches" />
          <StatTile tint="ember" icon={Target} label="Overall completion" value={students === 0 ? "—" : pct(avg)} bar={students ? avg : 0} sub="share of exercises finished" />
          <StatTile tint="good" icon={Star} label="Average score" value={avgScore === null ? "—" : pct(avgScore)} bar={avgScore ?? 0} sub="marks-weighted · We Do & You Do" />
          <StatTile tint="bad" icon={AlertTriangle} label="At-risk students" value={atRisk.length.toLocaleString()} bar={atRiskPct} sub={`${atRiskPct}% of enrolled · below 50%`} />
          <StatTile tint="good" icon={Activity} label="Active this week" value={active7.toLocaleString()} bar={students ? Math.round((active7 / students) * 100) : 0} sub={`of ${students.toLocaleString()} enrolled · last 7 days`} />
        </div>
        <div className="ldc-panel ldm-qa">
          <div className="ldc-panel-h"><h2>Quick Actions</h2></div>
          <a className="ldm-qa-i" href="#appr-queue"><IconChip icon={ClipboardList} tint="ember" /><span>Approval queue</span>{apprRows.length ? <b className="ldm-qa-b">{apprRows.length}</b> : null}<ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#courses"><IconChip icon={BookOpen} tint="blue" /><span>Course insight</span><ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#trainers"><IconChip icon={Users} tint="violet" /><span>Trainer allocation</span><ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#attendance"><IconChip icon={CalendarCheck} tint="good" /><span>Attendance register</span>{pendingBatches > 0 ? <b className="ldm-qa-b">{pendingBatches}</b> : null}<ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#perf-progress"><IconChip icon={AlertTriangle} tint="bad" /><span>View at-risk students</span><ChevronRight className="chev" size={14} /></a>
          <a className="ldm-qa-i" href="#rep-clients"><IconChip icon={FileText} tint="amber" /><span>Client & services report</span><ChevronRight className="chev" size={14} /></a>
        </div>
      </div>

      {/* ── Overall Progress · At Risk Students · Client Performance ── */}
      <div className="ldm-mid ldc-sec">
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Overall Progress</h2><span>{course !== "all" ? "this course" : "all courses"}</span></div>
          {studs.length === 0
            ? <div className="ldc-empty">No student progress in this view yet.</div>
            : <>
              <div className="ldc-progbars">{funnel.map((f) => <ProgBar key={f.key} label={f.label} tag={f.tag} v={f.v} />)}</div>
              <div className="ldm-donutrow">
                <Donut center={students ? pct(donePct) : "—"} sub="completed"
                  segs={[{ v: st.done, c: "var(--good)" }, { v: st.prog, c: "var(--accent)" }, { v: st.not, c: "#C9C1B8" }]} />
                <div className="ldc-legend">
                  <span className="lg"><span className="dot" style={{ background: "var(--good)" }} />Completed <b>{donePct}% ({st.done.toLocaleString()})</b></span>
                  <span className="lg"><span className="dot" style={{ background: "var(--accent)" }} />In progress <b>{students ? Math.round((st.prog / students) * 100) : 0}% ({st.prog.toLocaleString()})</b></span>
                  <span className="lg"><span className="dot" style={{ background: "#C9C1B8" }} />Not started <b>{students ? Math.round((st.not / students) * 100) : 0}% ({st.not.toLocaleString()})</b></span>
                </div>
              </div>
            </>}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>At Risk Students</h2>{atRisk.length ? <span className="ldc-badge2">{atRisk.length}</span> : null}<a className="ldc-link ldm-pa" href="#perf-progress">View all</a></div>
          {atRisk.length === 0 ? (
            <div className="ldc-feed-ok"><span className="ldc-feed-okico"><CheckCircle2 size={18} strokeWidth={2.2} /></span><b>Everyone on track</b><span>No active student is below the 50% line in this view.</span></div>
          ) : (
            <div className="ldm-vh"><table className="ldm-tbl">
              <thead><tr><th>Student</th><th>Course</th><th>Progress</th><th>Risk</th></tr></thead>
              <tbody>{atRisk.slice(0, 8).map((x, i) => {
                const [cls, lab] = riskOf(x.overall);
                return (
                  <tr key={i}>
                    <td><span className="ldm-who"><Av name={x.name} /><b>{x.name}</b></span></td>
                    <td><small>{x.course}</small></td>
                    <td><span className="ldc-compbar" style={{ width: 56 }}><i className={cls} style={{ width: `${Math.max(3, x.overall)}%` }} /></span><b className="pctv">{pct(x.overall)}</b></td>
                    <td><span className={`ldc-chip ${cls}`}>{lab}</span></td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          )}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Client Performance</h2><a className="ldc-link ldm-pa" href="#courses">View all</a></div>
          {clientsPerf.length === 0 ? <div className="ldc-empty">No clients in this view.</div> : (
            <div className="ldm-vh">{clientsPerf.map((c) => (
              <div className="ldm-cl" key={c.name}>
                <div className="ldm-cl-h"><IconChip icon={Building2} tint="blue" /><b>{c.name}</b>{c.sparks.length > 1 ? <Spark data={c.sparks} tint="ember" /> : null}</div>
                <div className="ldm-cl-g">
                  <span className="ldm-ms"><span>Students</span><b>{c.students.toLocaleString()}</b></span>
                  <span className="ldm-ms"><span>Completion</span><b className={c.avg === null ? "" : band(c.avg)[0]}>{c.avg === null ? "—" : pct(c.avg)}</b></span>
                  <span className="ldm-ms"><span>Avg score</span><b>{c.score === null ? "—" : pct(c.score)}</b></span>
                  <span className="ldm-ms" title="in-delivery batches with attendance marked today"><span>Att. today</span><b>{c.att && c.att.t ? `${c.att.m}/${c.att.t}` : "—"}</b></span>
                  <span className="ldm-ms"><span>At risk</span><b className={c.risk ? "bad" : ""}>{c.risk}</b></span>
                </div>
              </div>
            ))}</div>
          )}
        </div>
      </div>

      {/* ── Course Analytics · Trainer Performance · Recent Activity · Alerts ── */}
      <div className="ldm-bot ldc-sec">
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Course Analytics</h2><span>{focus ? focus.name : "—"}</span></div>
          {!focus ? <div className="ldc-empty">No active course to analyse yet.</div> : <>
            <div className="ldm-strip5">
              <span className="ldm-ms"><span>Students</span><b>{focus.students}</b></span>
              <span className="ldm-ms"><span>Completion</span><b className={band(focus.avg)[0]}>{pct(focus.avg)}</b></span>
              <span className="ldm-ms"><span>Avg score</span><b>{courseScore(focus.id) === null ? "—" : pct(courseScore(focus.id) as number)}</b></span>
              <span className="ldm-ms"><span>Assignments</span><b>{fMean("weDo") === null ? "—" : pct(fMean("weDo") as number)}</b></span>
              <span className="ldm-ms"><span>Attendance</span><b>{attPct === null ? "—" : pct(attPct)}</b></span>
            </div>
            <div className="ldc-feed-h">Weekly attendance</div>
            {attFocus.loading ? <div className="ldc-empty" style={{ padding: "18px 8px" }}>Loading attendance…</div>
              : weeks.length === 0 ? <div className="ldc-empty" style={{ padding: "18px 8px" }}>No attendance records yet.</div>
                : <div className="ldm-wk">{weeks.map((w) => (
                  <span className="c" key={w.label}><span className="v">{w.v}%</span><span className="t"><span className="f" style={{ height: `${Math.max(4, w.v)}%` }} /></span><span className="l">{w.label}</span></span>
                ))}</div>}
          </>}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Trainer Performance</h2><a className="ldc-link ldm-pa" href="#trainers">View all</a></div>
          {roster.loading ? <div className="ldc-empty">Loading trainers…</div>
            : trainerRows.length === 0 ? <div className="ldc-empty">No trainers on course rosters in this view.</div>
              : <>
                <div className="ldm-vh"><table className="ldm-tbl">
                  <thead><tr><th>Trainer</th><th className="r">Students</th><th>Avg score</th><th>Completion</th></tr></thead>
                  <tbody>{trainerRows.slice(0, 6).map((t, i) => (
                    <tr key={i}>
                      <td><span className="ldm-who"><Av name={t.name} /><span><b>{t.name}</b><small>{t.courses} course{t.courses === 1 ? "" : "s"}</small></span></span></td>
                      <td className="r">{t.students}</td>
                      <td><b className={`pctv ${t.score === null ? "" : t.score >= 70 ? "good" : t.score >= 50 ? "warn" : "bad"}`}>{t.score === null ? "—" : pct(t.score)}</b></td>
                      <td><span className="ldc-compbar" style={{ width: 64 }}><i className={t.comp === null ? "neutral" : band(t.comp)[0]} style={{ width: `${Math.max(3, t.comp ?? 0)}%` }} /></span><b className="pctv">{t.comp === null ? "—" : pct(t.comp)}</b></td>
                    </tr>
                  ))}</tbody>
                </table></div>
                {topTrainer ? (
                  <div className="ldm-tp-tags">
                    <span className="ldc-chip good">Top performer · {topTrainer.name}</span>
                    {lowTrainer && lowTrainer !== topTrainer ? <span className="ldc-chip warn">Needs attention · {lowTrainer.name}</span> : null}
                  </div>
                ) : null}
              </>}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Recent Activity</h2></div>
          {feed.length === 0 ? <div className="ldc-empty">Nothing recorded yet — approvals, feedback and student activity land here.</div> : (
            <div className="ldm-act">{feed.map((a, i) => (
              <div className="ldm-act-i" key={i}>
                <span className="dot" style={{ background: TINT[a.tint] }} />
                <div className="ldm-act-b"><small className="tm">{relDate(a.t)}</small><b>{a.main}</b><small>{a.sub}</small></div>
              </div>
            ))}</div>
          )}
        </div>

        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Alerts</h2>{alerts.length ? <span className="ldc-badge2">{alerts.length}</span> : null}</div>
          {alerts.length === 0 ? (
            <div className="ldc-feed-ok"><span className="ldc-feed-okico"><CheckCircle2 size={18} strokeWidth={2.2} /></span><b>All clear</b><span>No pending work in this view right now.</span></div>
          ) : alerts.map(({ n: cnt, cls, icon: AIco, txt, href }, i) => (
            <a className={`ldm-alert ${cls}`} href={href} key={i}><AIco size={14} strokeWidth={2.2} /><span>{txt}</span><b>{cnt.toLocaleString()}</b></a>
          ))}
          <p className="ldc-note">Counts respect the Client / Course filter above.</p>
        </div>
      </div>
    </>
  );
}

/* dashboard header: SaaS-style top bar — title + welcome · search · bell · settings · avatar */
function useSessionUser() {
  const [u, setU] = useState<any>(null);
  useEffect(() => { try { setU(JSON.parse(localStorage.getItem("smartcliff_userData") || "null")); } catch { setU(null); } }, []);
  return u;
}
function DashHead({ scope, sub, filtered, onReset, alerts = 0 }: { scope: string; sub: string; filtered: boolean; onReset: () => void; alerts?: number }) {
  const u = useSessionUser();
  const first = u?.firstName || "Admin";
  const name = `${u?.firstName || "L&D"} ${u?.lastName || "Head"}`.trim();
  const init = ((u?.firstName?.[0] || "L") + (u?.lastName?.[0] || "D")).toUpperCase();
  return (
    <div className="ldm-hdr">
      <div className="ldm-hdr-l">
        <h1>{scope}</h1>
        <p className="ldc-scope">Welcome back, {first} · <span className="ldm-scopesub">{sub}</span></p>
      </div>
      <div className="ldm-hdr-r">
        <div className="ldm-search"><Search size={15} strokeWidth={2} /><input type="text" placeholder="Search courses, students, trainers…" aria-label="Search" /></div>
        {filtered ? <button type="button" className="ldc-ghost" onClick={onReset}>Reset filter</button> : null}
        <a className="ldm-ib" href="#perf-progress" title="Alerts" aria-label="Alerts"><Bell size={17} strokeWidth={2} />{alerts > 0 ? <i className="ldm-ib-dot">{alerts > 9 ? "9+" : alerts}</i> : null}</a>
        <a className="ldm-ib" href="#appr-rules" title="Settings" aria-label="Settings"><Settings size={17} strokeWidth={2} /></a>
        <span className="ldm-avatar" title={name}>{init}</span>
      </div>
    </div>
  );
}

/* lightweight skeleton (replaces the bare "Loading…") */
function DashSkeleton() {
  return (
    <>
      <div className="ldc-stats">{[0, 1, 2, 3].map((i) => <div className="ldc-stat" key={i}><span className="ldc-sk ldc-sk-k" /><span className="ldc-sk ldc-sk-v" /><span className="ldc-sk ldc-sk-s" /></div>)}</div>
      <div className="ldc-main2 ldc-sec"><div className="ldc-panel"><span className="ldc-sk ldc-sk-row" /><span className="ldc-sk ldc-sk-row" /><span className="ldc-sk ldc-sk-row" /></div><div className="ldc-panel"><span className="ldc-sk ldc-sk-row" /><span className="ldc-sk ldc-sk-row" /><span className="ldc-sk ldc-sk-row" /></div></div>
    </>
  );
}

/* ───────── Learning Content (I Do · We Do · You Do) ─────────
   The L&D Head can read the full pedagogy their students get — I Do resources,
   We Do assignments and You Do assessments, plus the questions inside each — for
   whichever course/client is chosen in the top filter, regardless of whether an
   approval gate is switched on. Content + per-question approval state come from
   the same nested payload the student/admin dashboards use. */
type CStage = "I Do" | "We Do" | "You Do";
type CItem = {
  key: string; stage: CStage; kindLabel: string; module: string; topic: string;
  name: string; exId: string; level: string; testType: string; graded: boolean;
  marks: number; duration: number; resourceType: string; questions: any[];
  moduleIndex: number; updated: string;
  // resource-only (I Do files)
  fileType?: string; size?: number; url?: string; visible?: boolean; download?: boolean; pages?: number;
};
const fmtSize = (b: number): string => (b >= 1e6 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1e3 ? `${Math.round(b / 1024)} KB` : b ? `${b} B` : "");
const fmtDate = (iso: string): string => { if (!iso) return ""; const d = new Date(iso); return isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); };
const relDate = (iso: string): string => {
  if (!iso) return ""; const d = new Date(iso); if (isNaN(d.getTime())) return "";
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const dd = Math.floor(h / 24); return dd < 30 ? `${dd}d ago` : fmtDate(iso);
};
const fileTypeLabel = (mime: string, fallback: string): string => {
  const t = String(mime || "").toLowerCase();
  if (t.includes("pdf")) return "PDF";
  if (t.includes("video")) return "Video";
  if (t.includes("image")) return "Image";
  if (t.includes("presentation") || t.includes("powerpoint") || t.includes("ppt")) return "Slides";
  if (t.includes("word") || t.includes("msword") || t.includes("document")) return "Doc";
  if (t.includes("sheet") || t.includes("excel")) return "Sheet";
  if (t.includes("zip") || t.includes("rar")) return "Archive";
  return fallback || "File";
};
const qTitleOf = (q: any): string =>
  q.title || q.mcqQuestionDescription || q.shortAnswer || q.description || q.questionType || "Untitled question";
const qTypeLabel = (t: string): string => {
  const m: Record<string, string> = { programming: "Programming", mcq: "MCQ", multiplechoice: "MCQ", truefalse: "True / False", shortanswer: "Short answer", essay: "Essay", numeric: "Numeric", matching: "Matching", ordering: "Ordering" };
  return m[(t || "").toLowerCase().replace(/[^a-z]/g, "")] || (t ? t[0].toUpperCase() + t.slice(1) : "Question");
};
const apprCls = (s: string): string => (s === "approved" ? "good" : s === "rejected" ? "bad" : s === "pending" ? "warn" : "neutral");
const stageCls = (s: CStage): string => (s === "I Do" ? "ido" : s === "We Do" ? "assign" : "assess");

function collectContent(course: any): CItem[] {
  const out: CItem[] = [];
  (course?.modules || []).forEach((m: any, mi: number) => {
    const module = m.title || m.moduleName || m.name || `Module ${mi + 1}`;
    (m.topics || []).forEach((t: any, ti: number) => {
      const topic = t.title || t.topicName || t.name || `Topic ${ti + 1}`;
      const p = t.pedagogy || {};
      // I Do — resources. Each I_Do type (Video, Document, …) is an object that
      // holds a files[] array (and optionally folders[].files[]); older data may
      // store a plain array instead. Pull every uploaded file out of both shapes.
      const ido = p.I_Do || {};
      Object.keys(ido).forEach((rt) => {
        if (rt === "_id") return;
        const node = ido[rt];
        const files: any[] = [];
        const takeFiles = (n: any) => {
          if (!n) return;
          if (Array.isArray(n)) { n.forEach((x) => { if (x && x.fileName) files.push(x); else takeFiles(x); }); return; }
          if (typeof n === "object") {
            if (Array.isArray(n.files)) n.files.forEach((f: any) => files.push(f));
            if (Array.isArray(n.folders)) n.folders.forEach((fo: any) => takeFiles(fo));
          }
        };
        takeFiles(node);
        files.forEach((f: any, ri: number) => {
          const label = fileTypeLabel(f.fileType, rt);
          out.push({
            key: `${mi}-${ti}-ido-${rt}-${ri}`, stage: "I Do", kindLabel: label, module, topic,
            name: f.fileName || f.title || f.name || rt || "Resource",
            exId: "", level: "", testType: "", graded: false, marks: 0, duration: 0, resourceType: rt, questions: [],
            moduleIndex: mi + 1, updated: f.fileSettings?.lastModified || f.uploadedAt || f.updatedAt || "",
            fileType: label, size: Number(f.size) || 0, url: (f.fileUrl && (f.fileUrl.base || f.fileUrl.url)) || f.fileUrl || f.url || "",
            visible: f.fileSettings?.showToStudents !== false, download: !!f.fileSettings?.allowDownload, pages: Number(f.pages) || 0,
          });
        });
      });
      // We Do (assignments) + You Do (assessments)
      const pushEx = (arr: any[], stage: CStage, kindLabel: string, variant: string) => (arr || []).forEach((e: any, ei: number) => {
        const info = e.exerciseInformation || {};
        out.push({
          key: `${mi}-${ti}-${variant}-${ei}`, stage, kindLabel, module, topic,
          name: info.exerciseName || e.exerciseId || kindLabel,
          exId: info.exerciseId || "", level: info.exerciseLevel || "", testType: info.testType || "",
          graded: !!e.isGraded, marks: Number(info.totalMarks) || 0, duration: Number(info.totalDuration) || 0,
          resourceType: "", questions: Array.isArray(e.questions) ? e.questions : [],
          moduleIndex: mi + 1, updated: e.updatedAt || e.createdAt || "",
        });
      });
      pushEx(p.We_Do?.assignment, "We Do", "Assignment", "wd-assign");
      pushEx(p.We_Do?.practical, "We Do", "Assignment", "wd-prac");
      pushEx(p.You_Do?.assessments, "You Do", "Assessment", "yd-assess");
      pushEx(p.You_Do?.assessment, "You Do", "Assessment", "yd-assess2");
    });
  });
  return out;
}

const apprRollup = (qs: any[]) => {
  const c: Record<string, number> = {};
  qs.forEach((q) => { const s = q?.approval?.status || "none"; c[s] = (c[s] || 0) + 1; });
  return c;
};

/* ───────── Learning Content ─────────
   A course browser rather than a bespoke file tree. Picking a course opens
   whichever screen the current role actually works in — the same split the
   shared courses page makes (see `onStart` in /lms/pages/courses/page.tsx):

     L&D / staff        → the authoring screen, to add resources
     previewing student → the learner view, to review it as delivered

   The switch takes effect the moment the role changes, because the account
   menu dispatches a `storage` event that useIsPreviewingAsStudent listens for. */
function ContentView({ filter }: { filter: ViewFilter }) {
  const router = useRouter();
  const previewingAsStudent = useIsPreviewingAsStudent();
  const { loading, error, data } = useCourseStructures();
  const [q, setQ] = useState("");

  const courses = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data || [])
      .filter((c: any) => inScope(filter, String(c._id || "")))
      .map((c: any) => {
        const batches = Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : [];
        const students = batches.reduce((s: number, b: any) =>
          s + (Array.isArray(b.users)
            ? b.users.filter((u: any) => roleName(u.user?.role).toLowerCase().includes("student") || !roleName(u.user?.role)).length
            : 0), 0);
        return {
          id: String(c._id || ""),
          name: c.courseName || "Untitled",
          code: c.courseCode || "",
          client: c.clientName || "Unassigned",
          level: c.courseLevel || "",
          duration: c.courseDuration || "",
          image: c.courseImage || "",
          category: c.category || c.serviceType || "",
          modules: n(c.moduleCount),
          batches: batches.length,
          students: n(c.participantCount) || students,
        };
      })
      .filter((c: ContentCourse) => !term || `${c.name} ${c.code} ${c.client}`.toLowerCase().includes(term))
      .sort((a: ContentCourse, b: ContentCourse) => a.name.localeCompare(b.name));
  }, [data, filter, q]);

  const narrowed = scopeLabel(filter, courses[0]?.name);
  const open = (id: string) =>
    previewingAsStudent
      ? router.push(`/lms/pages/courses/coursesdetailedview/${id}`)
      : router.push(`/lms/pages/courses/uploadcourseresources?${new URLSearchParams({ courseId: id }).toString()}`);

  return (
    <>
      <Head
        eyebrow="Learning Content"
        title="Learning Content"
        right={<ScopeFilters f={filter} />}
        sub={previewingAsStudent
          ? (narrowed
              ? `Open a course from ${narrowed} to see it exactly as the learner does.`
              : "Open any course to see its content exactly as the learner does.")
          : (narrowed
              ? `Open a course from ${narrowed} to manage its resources. Switch to Student to review it as the learner does.`
              : "Open any course to manage its resources. Switch to Student to review it as the learner does.")}
      />

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search size={14} strokeWidth={2.2} aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search course, code or client…"
            aria-label="Search courses"
            className="w-full rounded-control border border-hairline bg-surface py-1.5 pr-3 pl-8 text-sm text-body outline-none transition-colors duration-fast placeholder:text-faint hover:border-hairline-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
          />
        </div>
        <span className="rounded-chip bg-ink-100 px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-subtle dark:bg-ink-800">
          {courses.length}
        </span>
      </div>

      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && courses.length === 0 && (
        <div className="ldc-empty">
          <b>No courses in this selection</b>
          <span>Change the Client or Course filter above to widen the view.</span>
        </div>
      )}

      {!loading && !error && courses.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto pb-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {courses.map((c: ContentCourse) => (
              <button
                key={c.id}
                type="button"
                onClick={() => open(c.id)}
                className="group flex flex-col overflow-hidden rounded-tile border border-hairline bg-surface text-left shadow-xs outline-none transition-colors duration-fast hover:border-brand-500/40 focus-visible:ring-2 focus-visible:ring-brand-500/40"
              >
                <span className="relative flex h-20 items-center justify-center overflow-hidden bg-ink-100 dark:bg-ink-800">
                  {c.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl font-bold text-faint">{c.name.charAt(0).toUpperCase()}</span>
                  )}
                  {c.level ? (
                    <span className="absolute top-2 left-2 rounded-chip bg-surface/90 px-1.5 py-0.5 text-2xs font-semibold text-body backdrop-blur">
                      {c.level}
                    </span>
                  ) : null}
                </span>

                <span className="flex min-w-0 flex-1 flex-col gap-1 p-3">
                  <b className="truncate text-sm font-semibold text-heading group-hover:text-brand-700 dark:group-hover:text-brand-400">
                    {c.name}
                  </b>
                  <small className="truncate text-2xs text-subtle">
                    {c.client}{c.code ? ` · ${c.code}` : ""}
                  </small>

                  <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-subtle">
                    <span><b className="font-semibold tabular-nums text-body">{c.modules}</b> modules</span>
                    <span><b className="font-semibold tabular-nums text-body">{c.batches}</b> batches</span>
                    <span><b className="font-semibold tabular-nums text-body">{c.students}</b> students</span>
                  </span>

                  <span className="mt-2 inline-flex items-center gap-1 text-2xs font-semibold text-brand-700 dark:text-brand-400">
                    Open as learner
                    <ChevronRight size={12} strokeWidth={2.6} aria-hidden />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

type ContentCourse = {
  id: string; name: string; code: string; client: string; level: string; duration: string;
  image: string; category: string; modules: number; batches: number; students: number;
};

/* ───────── Approval Queue ───────── */
function QueueView() {
  const { loading, error, data } = usePendingApprovals();
  const label = (t?: string) => (t === "You_Do" ? "Assessment" : t === "We_Do" ? "Assignment" : t || "—");
  return (
    <>
      <Head eyebrow="Approvals" title="Approval Queue" sub="Assessments and assignments waiting on you before students can see them." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <DataTable
          /* The heading's sub already reads "…waiting on you before students can
             see them", immediately above. */
          ariaLabel="Approvals"
          data={data}
          columns={[
            {
              key: "item", header: "Item", className: "md:flex-[2.4]", hideLabelOnMobile: true,
              sortValue: (it: any) => it.exerciseName || "",
              cell: (it: any) => (
                <span className="flex items-center gap-1.5 min-w-0">
                  <b className="truncate text-sm font-medium text-heading">{it.exerciseName || "Untitled"}</b>
                  {(it.resubmissionCount || 0) > 0 && (
                    <span
                      title="The trainer addressed earlier feedback and re-requested approval."
                      style={{
                        flexShrink: 0, fontSize: 10, fontWeight: 700, lineHeight: "15px",
                        color: "#6d28d9", background: "rgba(109,40,217,0.10)",
                        border: "1px solid rgba(109,40,217,0.25)", borderRadius: 999, padding: "0 6px",
                      }}
                    >
                      Re-request
                    </span>
                  )}
                </span>
              ),
            },
            {
              key: "type", header: "Type", className: "md:w-32 md:flex-none",
              sortValue: (it: any) => label(it.tabType),
              cell: (it: any) => <StatusChip tone={it.tabType === "You_Do" ? "warning" : "info"}>{label(it.tabType)}</StatusChip>,
            },
            {
              key: "cat", header: "Category", className: "md:flex-[1.2]",
              sortValue: (it: any) => it.subcategory || "",
              cell: (it: any) => <span className="truncate text-sm text-body">{it.subcategory || "—"}</span>,
            },
            {
              key: "step", header: "Step", className: "md:flex-[1.4]",
              sortValue: (it: any) => n(it.currentStep) || 1,
              cell: (it: any) => (
                <span className="truncate text-2xs text-subtle">
                  Step {n(it.currentStep) || 1} of {n(it.totalSteps) || 1}
                  {it.step?.roleName ? ` · ${it.step.roleName}` : ""}
                </span>
              ),
            },
            {
              key: "review", header: "", className: "md:w-24 md:flex-none",
              cell: (it: any) =>
                it.courseId ? (
                  <a
                    className="text-2xs font-semibold"
                    style={{ color: "var(--accent-ink, #b45309)", textDecoration: "none" }}
                    // Same `from=` contract the Approvals queue uses (see
                    // app/lms/pages/approvals/page.tsx:440). The
                    // `/lms/pages/lddashboard` prefix ALSO tells view-resources
                    // to render inside LDLayout instead of the admin shell, so
                    // the L&D console's own rail stays put across the review.
                    // `#appr-queue` re-selects the tab on return.
                    href={`/lms/pages/coursestructure/view-resources?courseId=${it.courseId}&tabType=${it.tabType || "You_Do"}&from=${encodeURIComponent('/lms/pages/lddashboard#appr-queue')}`}
                  >
                    Review →
                  </a>
                ) : null,
            },
          ]}
          getRowKey={(it: any, i) => String(it.exerciseId || it._id || i)}
          searchText={(it: any) => `${it.exerciseName || ""} ${it.subcategory || ""} ${label(it.tabType)}`}
          searchPlaceholder="Search item or category…"
          filters={[{
            key: "type", label: "All types",
            options: [
              { value: "assess", label: "Assessments", match: (it: any) => it.tabType === "You_Do" },
              { value: "assign", label: "Assignments", match: (it: any) => it.tabType === "We_Do" },
            ],
          }]}
          emptyTitle="Nothing waiting on you"
          emptyHint="Items appear when they reach your step in a course’s approval chain."
        />
      )}
    </>
  );
}

/* ───────── Rules & Approvers ───────── */
function RulesView() {
  // Reads only approvalHierarchy.steps, defaultApproverRole and the
  // name / code / client scalars — all of which the ?summary=1 projection
  // keeps, so this view does not pull the 348 KB roster payload.
  const { loading, error, data } = useCourseStructuresSummary();
  const [modalCourse, setModalCourse] = useState<string | null>(null);

  // One flat table — client is a COLUMN, not a group header.
  const rows = useMemo(() => (data || []).map((c) => {
    const steps = (c.approvalHierarchy?.steps || [])
      .slice()
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    const chain = steps.length > 0
      ? `${steps.map((s: any, i: number) => `${i + 1}. ${s.roleName || "?"}`).join(" → ")} → Students`
      : c.defaultApproverRole
        ? `1. ${c.defaultApproverRole} (default) → Students`
        : "No approval chain — set approvers";
    return {
      id: String(c._id),
      client: String(c.clientName || "Unassigned client"),
      course: String(c.courseName || "Untitled"),
      code: String(c.courseCode || "—"),
      chain,
    };
  }), [data]);

  const clients = useMemo(() => Array.from(new Set(rows.map((r) => r.client))).sort((a, b) => a.localeCompare(b)), [rows]);
  const [clientF, setClientF] = useState("all");
  const [courseF, setCourseF] = useState("all");
  const [q, setQ] = useState("");
  // Course options follow the chosen client.
  const courseOpts = useMemo(() => rows
    .filter((r) => clientF === "all" || r.client === clientF)
    .slice()
    .sort((a, b) => a.course.localeCompare(b.course)), [rows, clientF]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) =>
      (clientF === "all" || r.client === clientF) &&
      (courseF === "all" || r.id === courseF) &&
      (!t || `${r.client} ${r.course} ${r.code} ${r.chain}`.toLowerCase().includes(t)));
  }, [rows, clientF, courseF, q]);

  return (
    <>
      <Head eyebrow="Approvals" title="Approval Rules" sub="You decide whether each course needs approval and how deep — Admin sets who approves." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && (
        <>
          <div className="ldr-filters">
            <span className="ldr-searchwrap">
              <Search size={12} />
              <input className="ldr-search" type="search" placeholder="Search client or course…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search approval rules" />
            </span>
            <label className="ldr-flab">Client:
              <select className="ldr-sel" value={clientF} onChange={(e) => { setClientF(e.target.value); setCourseF("all"); }}>
                <option value="all">All clients</option>
                {clients.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="ldr-flab">Course:
              <select className="ldr-sel" value={courseF} onChange={(e) => setCourseF(e.target.value)}>
                <option value="all">All courses</option>
                {courseOpts.map((c) => <option key={c.id} value={c.id}>{c.course}</option>)}
              </select>
            </label>
          </div>
          <RTable
            title="Approval rules"
            unit="courses"
            rows={shown}
            init="client"
            initDir="asc"
            emptyAll={rows.length === 0 ? "No courses yet" : "Nothing matches the selected client, course, or search"}
            cols={[
              { k: "client", h: "Client" },
              { k: "course", h: "Course", render: (r) => <b>{r.course}</b> },
              { k: "code", h: "Code" },
              { k: "chain", h: "Approval chain" },
              { k: "act", h: "", r: true, sv: () => "", render: (r) => <button className="ldc-link" onClick={() => setModalCourse(r.id)}>Set approvers →</button> },
            ]}
          />
        </>
      )}
      <Note>Courses without their own chain use L&amp;D as the default first approver. Whether an assessment needs approval (and how deep — settings only, or settings + questions) is set in its Exercise Settings.</Note>
      <ApprovalHierarchyModal open={!!modalCourse} courseId={modalCourse || ""} onClose={() => setModalCourse(null)} />
    </>
  );
}

/* ───────── Course Insight ───────── */
/* ───────── Clients ─────────
   One row per client, rolled up from its courses' rosters. Selecting a row sets
   the client filter and moves on to that client's courses, which is the journey
   the dashboard's Clients card starts. */
/* ───────── Client drill-down ─────────
   The list shows clients alone; opening one answers "what do we already run
   for them?" — every service offered, its year, and the courses/students
   under each. Services come from the service mappings (joined by each
   course's serviceMappingId, with a client-name fallback); courses that were
   never linked to a mapping still appear, grouped by their service model, so
   nothing the client runs is invisible. */
/* Services OVERLAY — a modal on top of the clients table (the list stays
   put underneath). Shows every service offered to the client one by one —
   model, year, code, and the courses under each — with a model filter. */
/* Course-level participant count — mirrors the aggregation used for the
   dashboard: prefer an explicit participantCount, else scan every batch's
   users and count anyone whose role isn't a trainer/faculty. Hoisted to
   module scope so both the services and the courses sub-modal can share it. */
function studentsOf(c: any): number {
  if (n(c.participantCount)) return n(c.participantCount);
  let s = 0;
  (Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : []).forEach((b: any) => {
    (b.users || []).forEach((u: any) => {
      const rn = roleName(u.user?.role).toLowerCase();
      if (!rn.includes("trainer") && !rn.includes("faculty")) s += 1;
    });
  });
  return s;
}

/* Cross-picker bus — when any FloatingPicker opens, every other one hears
   about it and closes itself. Only one dropdown may be open at a time. */
const pickerBus: EventTarget | null =
  typeof window !== "undefined" ? new EventTarget() : null;
const PICKER_OPEN_EVENT = "sc-picker-open";

/* Compact custom listbox for the modal's filter row + pagination footer. The
   native <select> looks like a browser control from 2004 in modern designs
   (no ability to style the option list, no icons, no focus ring, jarring OS
   popovers). This one keeps the outlined-input floating-label style, adds a
   themed popover, keyboard nav (↑/↓/Enter/Esc), and click-outside close. */
function FloatingPicker({
  label, value, options, onChange, width, minWidth, size = "md", searchable,
}: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  width?: string;
  minWidth?: string;
  size?: "md" | "sm";
  // Show a type-ahead search box at the top of the popover. Auto-enables when
  // the option list is long enough that scanning is painful.
  searchable?: boolean;
}) {
  // Compact 36 px trigger (matches enterprise SaaS density — Linear/Notion/
  // Stripe filter bars). `sm` is a 28 px chip used by the pagination footer.
  const H = size === "sm" ? "h-7" : "h-9";
  const PAD = size === "sm" ? "pl-2.5 pr-6" : "pl-3 pr-7";
  const TXT = size === "sm" ? "text-[11px]" : "text-xs";
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const showSearch = !!searchable || options.length > 10;
  const filteredOptions = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;
  useEffect(() => {
    if (!open) { setQuery(""); return; }
    if (showSearch) requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [open, showSearch]);
  const pickerId = useRef<symbol>(Symbol("picker"));

  // Broadcast when we open so other pickers close themselves.
  useEffect(() => {
    if (!open || !pickerBus) return;
    pickerBus.dispatchEvent(new CustomEvent(PICKER_OPEN_EVENT, { detail: pickerId.current }));
  }, [open]);

  // Listen for opens elsewhere and close if it wasn't us.
  useEffect(() => {
    if (!pickerBus) return;
    const onOther = (e: Event) => {
      if ((e as CustomEvent).detail !== pickerId.current) setOpen(false);
    };
    pickerBus.addEventListener(PICKER_OPEN_EVENT, onOther);
    return () => pickerBus.removeEventListener(PICKER_OPEN_EVENT, onOther);
  }, []);
  // Portalled popover position — computed on open so `overflow-hidden` on the
  // dialog (or any scroll parent) can't clip the listbox.
  const [pop, setPop] = useState<{ top: number; left: number; width: number; placement: "bottom" | "top" } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, options.findIndex((o) => o.value === value));
    setActive(idx);
  }, [open, options, value]);

  useEffect(() => {
    if (!open) { setPop(null); return; }
    const measure = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const POP_MAX_H = 260;    // matches max-h-64 on the list
      const GAP = 6;
      const roomBelow = window.innerHeight - rect.bottom - GAP;
      const roomAbove = rect.top - GAP;
      const placement: "bottom" | "top" = roomBelow >= POP_MAX_H || roomBelow >= roomAbove ? "bottom" : "top";
      const top = placement === "bottom" ? rect.bottom + GAP : Math.max(8, rect.top - GAP);
      setPop({ top, left: rect.left, width: rect.width, placement });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setActive((i) => {
        const next = e.key === "ArrowDown" ? Math.min(i + 1, options.length - 1) : Math.max(i - 1, 0);
        return next;
      });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      const chosen = options[active];
      if (chosen) { onChange(chosen.value); setOpen(false); }
    } else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
  };

  return (
    <div className={`relative shrink-0 ${width || ""} ${minWidth || "min-w-[140px]"}`}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onTriggerKey}
        className={`relative flex ${H} w-full items-center rounded-md border bg-surface ${PAD} text-left transition-colors hover:border-hairline-strong ${open ? "border-brand-500 ring-2 ring-brand-500/15" : "border-hairline"}`}
      >
        {label && size !== "sm" && (
          <span className="pointer-events-none absolute -top-1.5 left-2 bg-surface px-1 text-[10px] font-medium leading-none text-subtle">
            {label}
          </span>
        )}
        <span className={`min-w-0 truncate ${TXT} font-semibold text-heading`}>
          {current?.label || "Select…"}
        </span>
        <ChevronDown size={size === "sm" ? 11 : 12} className={`pointer-events-none absolute top-1/2 ${size === "sm" ? "right-1.5" : "right-2"} -translate-y-1/2 text-subtle transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && pop && typeof document !== "undefined" && createPortal(
        <div
          ref={popRef}
          role="listbox"
          aria-label={label}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: pop.placement === "bottom" ? pop.top : undefined,
            bottom: pop.placement === "top" ? window.innerHeight - pop.top : undefined,
            left: pop.left,
            minWidth: pop.width,
            // Radix Dialog sets `pointer-events: none` on <body> while a modal
            // is open (part of its focus/scroll lock). Because this popover is
            // portalled to document.body — not inside the DialogContent — it
            // inherits the lock and clicks fall through to whatever row sits
            // underneath. Force it back on for the popover itself.
            pointerEvents: "auto",
          }}
          className="pointer-events-auto z-[9999] overflow-hidden rounded-[10px] border border-hairline bg-surface shadow-xl ring-1 ring-black/[0.04]"
        >
          {showSearch && (
            <div className="relative border-b border-hairline p-1.5">
              <Search size={13} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" aria-hidden />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") { e.preventDefault(); setOpen(false); return; }
                  if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, filteredOptions.length - 1)); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return; }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const chosen = filteredOptions[active];
                    if (chosen) { onChange(chosen.value); setOpen(false); }
                  }
                }}
                placeholder={`Search ${(label || "options").toLowerCase()}...`}
                aria-label={`Search ${label || "options"}`}
                className="h-8 w-full rounded-control bg-surface pr-2 pl-8 text-xs text-heading outline-none placeholder:text-faint"
              />
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-subtle">No matches</div>
            ) : filteredOptions.map((o, i) => {
              const selected = o.value === value;
              const isActive = i === active;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onChange(o.value); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "bg-brand-100 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                      : isActive
                        ? "bg-row-hover text-heading"
                        : "text-body hover:bg-row-hover"
                  }`}
                >
                  <span className="min-w-0 truncate">{o.label}</span>
                  {selected && <Check size={13} className="shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

/* Sub-modal opened from a service row — the same shape as the parent modal
   (fixed frame, floating-label filters, auto-fit pagination), but scoped to
   ONE service and listing the courses under it. Sits on top of the services
   dialog; the parent stays open behind the backdrop. */
function ServiceCoursesOverlay({ serviceTitle, clientName, courses, onClose }: {
  serviceTitle: string; clientName: string; courses: any[]; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [batchFilter, setBatchFilter] = useState<string | null>(null);

  const enriched = useMemo(() => courses.map((c) => ({
    id: String(c._id || c.courseCode || c.courseName || Math.random()),
    name: String(c.courseName || "Untitled course"),
    code: String(c.courseCode || ""),
    batches: Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants.length : 0,
    students: studentsOf(c),
  })), [courses]);

  const matches = (text: string) => text.toLowerCase().includes(q.trim().toLowerCase());
  const shown = enriched.filter((c) =>
    (!batchFilter
      || (batchFilter === "with" && c.batches > 0)
      || (batchFilter === "without" && c.batches === 0))
    && (!q.trim() || matches(`${c.name} ${c.code}`)));

  const totalStudents = enriched.reduce((s, c) => s + c.students, 0);
  const totalBatches = enriched.reduce((s, c) => s + c.batches, 0);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [autoFit, setAutoFit] = useState(true);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setPage(1); }, [q, batchFilter, pageSize]);
  useEffect(() => {
    if (!autoFit) return;
    const el = tableWrapRef.current;
    if (!el) return;
    const FALLBACK_ROW_H = 56;
    const recompute = () => {
      const thead = el.querySelector<HTMLElement>("thead");
      const firstRow = el.querySelector<HTMLElement>("tbody tr");
      const theadH = thead ? thead.getBoundingClientRect().height : 40;
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : FALLBACK_ROW_H;
      const budget = Math.max(0, el.clientHeight - theadH - 2);
      const rows = Math.max(1, Math.min(50, Math.floor(budget / Math.max(1, rowH))));
      setPageSize((prev) => (prev === rows ? prev : rows));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    const raf = requestAnimationFrame(recompute);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [autoFit, shown.length]);
  const setPageSizeManual = (v: number) => { setAutoFit(false); setPageSize(v); };

  const totalPages = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const paged = shown.slice(pageStart, pageEnd);
  const rangeFrom = shown.length === 0 ? 0 : pageStart + 1;
  const rangeTo = Math.min(pageEnd, shown.length);
  const isFiltering = !!batchFilter || !!q.trim();
  const clearAll = () => { setBatchFilter(null); setQ(""); };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showCloseButton={false} className="z-popover flex h-[86vh] max-h-[820px] w-[96vw] flex-col gap-0 overflow-hidden rounded-tile border border-hairline-strong bg-surface p-0 sm:w-[1040px] sm:max-w-[1040px]">
        <DialogHeader className="relative flex-shrink-0 border-b border-hairline px-6 py-3 text-left">
          <div className="flex items-center gap-2.5 pr-10">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
              <BookOpen size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-semibold leading-tight tracking-[-0.01em] text-heading">
                Courses offered
                <span className="mx-1.5 text-subtle">·</span>
                <span className="font-medium text-body">{serviceTitle}</span>
              </DialogTitle>
              <DialogDescription className="mt-0.5 truncate text-2xs text-subtle">
                {clientName} · {courses.length} {courses.length === 1 ? "course" : "courses"} · {totalBatches} {totalBatches === 1 ? "batch" : "batches"} · {totalStudents} students
              </DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-1/2 right-4 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col px-6 pt-3 pb-3">
          <div className="mb-3 flex flex-shrink-0 flex-nowrap items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search courses..."
                aria-label="Search courses"
                className="h-9 w-full rounded-md border border-hairline bg-surface pr-8 pl-8 text-xs text-heading outline-none transition-colors placeholder:text-faint hover:border-hairline-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-faint transition-colors hover:bg-row-hover hover:text-body"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <FloatingPicker
              label="Batches"
              minWidth="min-w-[140px]"
              value={batchFilter ?? "all"}
              options={[
                { value: "all", label: "Any" },
                { value: "with", label: "With batches" },
                { value: "without", label: "No batches" },
              ]}
              onChange={(v) => setBatchFilter(v === "all" ? null : v)}
            />
            <button
              type="button"
              onClick={clearAll}
              disabled={!isFiltering}
              className="ml-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-brand-700 transition-colors hover:text-brand-strong disabled:cursor-not-allowed disabled:text-faint disabled:hover:text-faint dark:text-brand-400"
            >
              <RefreshCw size={12} /> Clear filters
            </button>
          </div>

          <div ref={tableWrapRef} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tile border border-hairline bg-surface">
            <div className="min-h-0 flex-1">
              {shown.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-subtle">
                  {enriched.length === 0
                    ? "No courses have been set up under this service yet."
                    : "No courses match the current filters."}
                </p>
              ) : (
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 z-10 bg-surface-sunken/60">
                    <tr className="border-b border-hairline">
                      <th className="px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Course</th>
                      <th className="w-40 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Course code</th>
                      <th className="w-28 px-3 py-1.5 text-right text-2xs font-semibold uppercase tracking-wider text-subtle">Batches</th>
                      <th className="w-28 px-3 py-1.5 text-right text-2xs font-semibold uppercase tracking-wider text-subtle">Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((c) => (
                      <tr key={c.id} className="border-b border-hairline transition-colors last:border-0 hover:bg-row-hover">
                        <td className="px-3 py-2 align-middle">
                          <div className="truncate text-sm font-semibold text-heading">{c.name}</div>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {c.code
                            ? <span className="text-2xs tabular-nums text-subtle">{c.code}</span>
                            : <span className="text-2xs text-faint">—</span>}
                        </td>
                        <td className="px-3 py-2 text-right align-middle text-sm tabular-nums text-body">{c.batches}</td>
                        <td className="px-3 py-2 text-right align-middle text-sm tabular-nums text-body">{c.students}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-sunken/30 px-5 py-3">
          <span className="text-xs tabular-nums text-subtle">
            {shown.length === 0
              ? "No courses to show"
              : <>Showing <b className="font-semibold text-heading">{rangeFrom}</b> to <b className="font-semibold text-heading">{rangeTo}</b> of <b className="font-semibold text-heading">{shown.length}</b> courses</>}
          </span>
          <div className="flex items-center gap-3">
            <FloatingPicker
              size="sm"
              minWidth="min-w-[128px]"
              value={autoFit ? "auto" : String(pageSize)}
              onChange={(v) => { if (v === "auto") { setAutoFit(true); } else { setPageSizeManual(Number(v)); } }}
              options={[
                { value: "auto", label: `Auto (${pageSize})` },
                ...[5, 10, 25, 50].map((n2) => ({ value: String(n2), label: `${n2} per page` })),
              ]}
            />
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).slice(0, 5).map((p) => (
                  <button key={p} type="button" onClick={() => setPage(p)} aria-current={currentPage === p ? "page" : undefined}
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-control px-2 text-xs font-semibold tabular-nums transition-colors ${currentPage === p ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400" : "text-subtle hover:bg-row-hover hover:text-body"}`}>
                    {p}
                  </button>
                ))}
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="Next page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClientServicesOverlay({ name, courses, onClose, onOpenCourses }: {
  name: string; courses: any[]; onClose: () => void; onOpenCourses: () => void;
}) {
  const { loading, data: mappingsRaw } = useServiceMappingList();

  const { services, unmapped, totalStudents } = useMemo(() => {
    const byMappingId = new Map<string, any[]>();
    courses.forEach((c) => {
      // The course-structure model calls this `mappingId` (see
      // server/models/Courses/courseStructureModal.js). `serviceMappingId`
      // is a User field, NOT a Course field — reading it here was always
      // empty, which is why every course fell into the "Not mapped" bucket
      // even though its mapping link was populated.
      const id = String(c.mappingId || c.serviceMappingId || "");
      if (id) byMappingId.set(id, [...(byMappingId.get(id) || []), c]);
    });
    // The link is stored in BOTH directions, and in practice mostly the
    // forward one: course.mappingId points at its mapping. The reverse
    // (mapping.courseId → course) is kept for legacy imports too.
    const courseById = new Map<string, any>(courses.map((c) => [String(c._id), c]));
    const clientMappings = (mappingsRaw || []).filter((m: any) => {
      const cname = m.client && typeof m.client === "object"
        ? String(m.client.clientCompany || m.client.name || m.client.clientName || "")
        : "";
      return byMappingId.has(String(m._id))
        || courseById.has(String(m.courseId || ""))
        || cname.trim().toLowerCase() === name.trim().toLowerCase();
    });
    const claimed = new Set<string>();
    const services = clientMappings.map((m: any) => {
      const svcCourses = [...(byMappingId.get(String(m._id)) || [])];
      const reverse = courseById.get(String(m.courseId || ""));
      if (reverse && !svcCourses.some((c) => String(c._id) === String(reverse._id))) svcCourses.push(reverse);
      svcCourses.forEach((c) => claimed.add(String(c._id)));
      return {
        id: String(m._id),
        title: String(m.service || m.courseName || "Service"),
        code: String(m.serviceCode || m.serviceId || m.code || ""),
        year: String(m.year || ""),
        status: String(m.status || ""),
        models: (Array.isArray(m.serviceModels) ? m.serviceModels : []).map(String),
        courses: svcCourses,
        students: svcCourses.reduce((s, c) => s + studentsOf(c), 0),
      };
    });
    // Courses never linked to a mapping — still shown, grouped by their own
    // model + service pair (course docs carry both serviceModal and
    // serviceType, e.g. "placement training" under "business to institution").
    const rest = courses.filter((c) => !claimed.has(String(c._id)));
    const buckets = new Map<string, { model: string; service: string; courses: any[] }>();
    rest.forEach((c) => {
      const model = String(c.serviceModal || "").trim() || "Other";
      const service = String(c.serviceType || "").trim();
      const key = `${model}::${service}`;
      if (!buckets.has(key)) buckets.set(key, { model, service, courses: [] });
      buckets.get(key)!.courses.push(c);
    });
    const unmapped = Array.from(buckets.values()).map((b) => ({
      ...b, students: b.courses.reduce((s, c) => s + studentsOf(c), 0),
    }));
    return { services, unmapped, totalStudents: courses.reduce((s, c) => s + studentsOf(c), 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappingsRaw, courses, name]);

  const serviceCount = services.length + unmapped.length;

  // Model filter — every model present for this client becomes a clickable
  // chip; the services list narrows to the picked one. Clicking a model badge
  // inside a row applies the same filter.
  const [modelFilter, setModelFilter] = useState<string | null>(null);
  const allModels = useMemo(() => {
    const set = new Set<string>();
    services.forEach((s) => s.models.forEach((m: string) => set.add(m)));
    unmapped.forEach((b) => set.add(b.model));
    return Array.from(set).sort();
  }, [services, unmapped]);
  // Search + year filter (year exists only on mapped services, so a year
  // filter hides the not-mapped rows — they genuinely have no year).
  const [q, setQ] = useState("");
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const allYears = useMemo(
    () => Array.from(new Set(services.map((s) => s.year).filter(Boolean))).sort().reverse(),
    [services],
  );
  // Status filter — "active"/"draft"/"inactive" for mapped services;
  // "unmapped" hides the mapped list and only shows the not-mapped buckets.
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const matches = (text: string) => text.toLowerCase().includes(q.trim().toLowerCase());
  const shownServices = services.filter((s) =>
    (!modelFilter || s.models.includes(modelFilter)) &&
    (!yearFilter || s.year === yearFilter) &&
    (!statusFilter || (statusFilter === "unmapped" ? false : s.status === statusFilter)) &&
    (!q.trim() || matches(`${s.title} ${s.models.join(" ")} ${s.year} ${s.code}`)));
  const shownUnmapped = unmapped.filter((b) =>
    (!modelFilter || b.model === modelFilter) &&
    !yearFilter &&
    (!statusFilter || statusFilter === "unmapped") &&
    (!q.trim() || matches(`${b.model} ${b.service}`)));
  const shownCount = shownServices.length + shownUnmapped.length;
  const isFiltering = !!modelFilter || !!yearFilter || !!statusFilter || !!q.trim();
  const clearAllFilters = () => { setModelFilter(null); setYearFilter(null); setStatusFilter(null); setQ(""); };
  const toggleModel = (m: string) => setModelFilter((prev) => (prev === m ? null : m));

  // Pagination — bottom bar advances pages instead of scrolling the list.
  // `pageSize` is auto-fit: we measure the table wrapper AND a real rendered
  // row via ResizeObserver, then set pageSize to the whole-number of rows that
  // fit under `<thead>`. Falls back to a 68px estimate before the first row
  // paints. "N per page" pins a value and stops auto-fitting.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [autoFit, setAutoFit] = useState(true);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!autoFit) return;
    const el = tableWrapRef.current;
    if (!el) return;
    const FALLBACK_ROW_H = 68;
    const recompute = () => {
      const thead = el.querySelector<HTMLElement>("thead");
      const firstRow = el.querySelector<HTMLElement>("tbody tr:not([data-expanded])");
      const theadH = thead ? thead.getBoundingClientRect().height : 40;
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : FALLBACK_ROW_H;
      const budget = Math.max(0, el.clientHeight - theadH - 2); // -2 for the tile border
      const rows = Math.max(1, Math.min(50, Math.floor(budget / Math.max(1, rowH))));
      setPageSize((prev) => (prev === rows ? prev : rows));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    // Re-run one frame later so we pick up the real row height once the first
    // <tr> has painted (the initial measure runs before the row exists).
    const raf = requestAnimationFrame(recompute);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [autoFit, shownCount]);
  const setPageSizeManual = (n: number) => { setAutoFit(false); setPageSize(n); };
  useEffect(() => { setPage(1); }, [q, modelFilter, yearFilter, statusFilter, pageSize]);
  const totalPages = Math.max(1, Math.ceil(shownCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  // Slice across the combined (services + unmapped) sequence so pagination
  // treats them as one list rather than two independent pages.
  const pagedServices = shownServices.slice(pageStart, Math.min(pageEnd, shownServices.length));
  const unmappedStart = Math.max(0, pageStart - shownServices.length);
  const unmappedEnd = Math.max(0, pageEnd - shownServices.length);
  const pagedUnmapped = shownUnmapped.slice(unmappedStart, unmappedEnd);
  const rangeFrom = shownCount === 0 ? 0 : pageStart + 1;
  const rangeTo = Math.min(pageEnd, shownCount);

  /* Plain text — no chip, no tone. Still clickable to toggle the model
     filter, and gets a subtle underline hover so it doesn't read as dead
     text. When the filter is active, the label goes brand-colored. */
  const modelBadge = (m: string) => (
    <span
      key={m}
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); toggleModel(m); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleModel(m); } }}
      title={modelFilter === m ? "Clear model filter" : `Show only ${m}`}
      className={`cursor-pointer text-sm underline-offset-2 hover:underline ${modelFilter === m ? "font-semibold text-brand-700 dark:text-brand-400" : "text-body"}`}
    >
      {m}
    </span>
  );

  // Row click opens a sub-modal listing THAT service's courses with its own
  // filters + pagination — the old inline dropdown was cramped and couldn't
  // hold a real filter row.
  const [openService, setOpenService] = useState<{ title: string; courses: any[] } | null>(null);

  /* Row-level status meta: coloured dot, primary label, secondary hint. */
  const statusMeta = (status: string, courseCount: number) => {
    const hasCourses = courseCount > 0;
    if (status === "active") return { dot: "bg-emerald-500", label: "Active", hint: hasCourses ? "Fully configured" : "No courses yet", tone: "text-emerald-700 dark:text-emerald-300" };
    if (status === "draft") return { dot: "bg-brand-500", label: "Draft", hint: "Incomplete setup", tone: "text-brand-700 dark:text-brand-400" };
    if (status === "inactive") return { dot: "bg-slate-400", label: "Inactive", hint: hasCourses ? "Paused" : "No courses yet", tone: "text-subtle" };
    // Bucket rows — the service has no mapping document, but courses may
    // still exist under the model/type pair. Distinguish the two cases.
    return {
      dot: "bg-slate-400",
      label: "Not mapped",
      hint: hasCourses
        ? `${courseCount} ${courseCount === 1 ? "course" : "courses"} without a mapping`
        : "No courses mapped",
      tone: "text-subtle",
    };
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Fixed frame: same width/height no matter what the current page holds.
          Pagination handles overflow (auto-fit pageSize keeps rows from ever
          being clipped by the fixed height). */}
      <DialogContent showCloseButton={false} className="z-popover flex h-[86vh] max-h-[820px] w-[96vw] flex-col gap-0 overflow-hidden rounded-tile border border-hairline-strong bg-surface p-0 sm:w-[1120px] sm:max-w-[1120px]">
        <DialogHeader className="relative flex-shrink-0 border-b border-hairline px-6 py-3 text-left">
          <div className="flex items-center gap-3 pr-12">
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-400">
              {(() => {
                const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
                return parts.length === 0 ? "?" : parts.length === 1
                  ? parts[0].slice(0, 2).toUpperCase()
                  : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
              })()}
            </span>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate text-base font-semibold leading-tight tracking-[-0.01em] text-heading">
                Services offered
                <span className="mx-1.5 text-subtle">·</span>
                <span className="font-medium text-body">{name}</span>
              </DialogTitle>
              <DialogDescription className="sr-only">
                {serviceCount} services · {courses.length} courses · {totalStudents} students
              </DialogDescription>
            </div>
            {/* Compact inline counts — label : value, no oversized numerals. */}
            <div className="hidden shrink-0 items-center gap-4 pr-2 text-xs sm:flex">
              <span className="whitespace-nowrap">
                <span className="font-medium uppercase tracking-wide text-subtle">Services offered:</span>
                <span className="ml-1 font-semibold tabular-nums text-heading">{serviceCount}</span>
              </span>
              <span className="whitespace-nowrap">
                <span className="font-medium uppercase tracking-wide text-subtle">Courses offered:</span>
                <span className="ml-1 font-semibold tabular-nums text-heading">{courses.length}</span>
              </span>
              <span className="whitespace-nowrap">
                <span className="font-medium uppercase tracking-wide text-subtle">Students:</span>
                <span className="ml-1 font-semibold tabular-nums text-heading">{totalStudents}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-1/2 right-4 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full bg-red-500 text-white shadow-sm transition-colors hover:bg-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
          >
            <X size={14} strokeWidth={2.5} />
          </button>
        </DialogHeader>

        {/* Content column — fills the fixed frame; the table container inside
            claims the remaining vertical space and `pageSize` is auto-fit to
            match, so rows always fill the box without being clipped. */}
        <div className="flex min-h-0 flex-1 flex-col px-6 pt-3 pb-3">

      {/* Toolbar — search + three floating-label pickers + Clear filters.
          Deliberately NOT wrapped in a card: it should read as one row of
          controls, not a bordered widget inside the modal chrome. */}
      <div className="mb-3 flex flex-shrink-0 flex-nowrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search services..."
            aria-label="Search services"
            className="h-9 w-full rounded-md border border-hairline bg-surface pr-8 pl-8 text-xs text-heading outline-none transition-colors placeholder:text-faint hover:border-hairline-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-faint transition-colors hover:bg-row-hover hover:text-body"
            >
              <X size={13} />
            </button>
          )}
        </div>
        {([
          {
            id: "model",
            label: "Service model",
            value: modelFilter ?? "all",
            onChange: (v: string) => setModelFilter(v === "all" ? null : v),
            options: [{ value: "all", label: "All models" }, ...allModels.map((m) => ({ value: m, label: m }))],
            width: "min-w-[160px]",
          },
          {
            id: "year",
            label: "Offering year",
            value: yearFilter ?? "all",
            onChange: (v: string) => setYearFilter(v === "all" ? null : v),
            options: [{ value: "all", label: "All years" }, ...allYears.map((y) => ({ value: y, label: y }))],
            width: "min-w-[140px]",
          },
          {
            id: "status",
            label: "Status",
            value: statusFilter ?? "all",
            onChange: (v: string) => setStatusFilter(v === "all" ? null : v),
            options: [
              { value: "all", label: "All status" },
              { value: "active", label: "Active" },
              { value: "draft", label: "Draft" },
              { value: "unmapped", label: "Not mapped" },
            ],
            width: "min-w-[130px]",
          },
        ] as const).map((f) => (
          <FloatingPicker
            key={f.id}
            label={f.label}
            value={f.value}
            options={[...f.options]}
            onChange={(v) => f.onChange(v)}
            minWidth={f.width}
          />
        ))}
        <button
          type="button"
          onClick={clearAllFilters}
          disabled={!isFiltering}
          className="ml-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-brand-700 transition-colors hover:text-brand-strong disabled:cursor-not-allowed disabled:text-faint disabled:hover:text-faint dark:text-brand-400"
        >
          <RefreshCw size={12} /> Clear filters
        </button>
      </div>

      <div ref={tableWrapRef} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tile border border-hairline bg-surface">
        <div className="min-h-0 flex-1">
        {loading && services.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-subtle">Loading services…</p>
        ) : serviceCount === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-subtle">No services or courses set up for this client yet.</p>
        ) : shownCount === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-subtle">
            No services match the current filters.{" "}
            <button type="button" className="ldc-link" onClick={clearAllFilters}>Clear all</button>
          </p>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-sunken/60">
              <tr className="border-b border-hairline">
                <th className="w-56 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Service model</th>
                <th className="px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Service</th>
                <th className="w-40 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Service code</th>
                <th className="w-32 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Offering year</th>
                <th className="w-44 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Status</th>
                <th className="w-36 px-3 py-1.5 text-right text-2xs font-semibold uppercase tracking-wider text-subtle">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedServices.map((s) => {
                const desc = String(s.code || "").trim();
                const meta = statusMeta(s.status, s.courses.length);
                const yearMissing = !s.year;
                return (
                  <tr
                    key={s.id}
                    onClick={(e) => {
                      if (!e.currentTarget.contains(e.target as Node)) return;
                      // No courses under this mapping → nothing to show in
                      // the sub-modal; don't open an empty dialog.
                      if (s.courses.length === 0) return;
                      setOpenService({ title: s.title, courses: s.courses });
                    }}
                    className={`border-b border-hairline transition-colors last:border-0 hover:bg-row-hover ${s.courses.length === 0 ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <td className="px-3 py-2 align-middle">
                      {s.models.length ? (
                        <span className="flex flex-wrap gap-1.5">
                          {s.models.map((m: string) => modelBadge(m))}
                        </span>
                      ) : (
                        <span className="text-xs text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="min-w-0 truncate text-sm font-semibold text-heading">{s.title}</div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {desc
                        ? <span className="truncate text-xs tabular-nums text-body">{desc}</span>
                        : <span className="text-xs text-faint">—</span>}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {yearMissing ? (
                        <span className="text-sm font-medium text-brand-700 dark:text-brand-400">Not configured</span>
                      ) : (
                        <span className="text-sm tabular-nums text-body">{s.year}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block size-1.5 shrink-0 rounded-full ${meta.dot}`} />
                        <span className={`truncate text-sm font-semibold ${meta.tone}`}>{meta.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      {s.courses.length === 0 ? (
                        <span className="text-xs text-faint" aria-label="No action available">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400">
                          {s.courses.length === 1 ? "View course" : `View ${s.courses.length} courses`}
                          <ChevronRight size={13} aria-hidden />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {pagedUnmapped.map((b) => {
                const key = `bucket:${b.model}::${b.service}`;
                const meta = statusMeta("", b.courses.length);
                return (
                  <tr
                    key={key}
                    onClick={(e) => {
                      if (!e.currentTarget.contains(e.target as Node)) return;
                      if (b.courses.length === 0) return;
                      setOpenService({ title: b.service || "Unmapped service", courses: b.courses });
                    }}
                    className={`border-b border-hairline transition-colors last:border-0 hover:bg-row-hover ${b.courses.length === 0 ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <td className="px-3 py-2 align-middle">{modelBadge(b.model)}</td>
                    <td className="px-3 py-2 align-middle">
                      <div className="min-w-0 truncate text-sm font-semibold text-heading">
                        {b.service || "Unmapped service"}
                        <span className="ml-1 font-normal text-subtle">(not mapped)</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle text-xs text-faint">—</td>
                    <td className="px-3 py-2 align-middle text-sm text-faint">—</td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block size-1.5 shrink-0 rounded-full ${meta.dot}`} />
                        <span className={`truncate text-sm font-semibold ${meta.tone}`}>{meta.label}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      {b.courses.length === 0 ? (
                        <span className="text-xs text-faint" aria-label="No action available">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400">
                          {b.courses.length === 1 ? "View course" : `View ${b.courses.length} courses`}
                          <ChevronRight size={13} aria-hidden />
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        </div>
      </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-sunken/30 px-5 py-3">
          <span className="text-xs tabular-nums text-subtle">
            {shownCount === 0
              ? "No services to show"
              : <>Showing <b className="font-semibold text-heading">{rangeFrom}</b> to <b className="font-semibold text-heading">{rangeTo}</b> of <b className="font-semibold text-heading">{shownCount}</b> services</>}
          </span>
          <div className="flex items-center gap-3">
            <FloatingPicker
              size="sm"
              minWidth="min-w-[128px]"
              value={autoFit ? "auto" : String(pageSize)}
              onChange={(v) => { if (v === "auto") { setAutoFit(true); } else { setPageSizeManual(Number(v)); } }}
              options={[
                { value: "auto", label: `Auto (${pageSize})` },
                ...[5, 10, 25, 50].map((n) => ({ value: String(n), label: `${n} per page` })),
              ]}
            />
            {/* Pagination controls only appear when there's more than one
                page — everything fits on page 1? Skip the row of buttons. */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).slice(0, 5).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={currentPage === p ? "page" : undefined}
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-control px-2 text-xs font-semibold tabular-nums transition-colors ${
                      currentPage === p
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                        : "text-subtle hover:bg-row-hover hover:text-body"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Next page"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={onOpenCourses}
              className="inline-flex h-8 items-center gap-1.5 rounded-control border border-brand-500/60 px-3 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:text-brand-400 dark:hover:bg-brand-500/15"
            >
              View all {courses.length} {courses.length === 1 ? "course" : "courses"} <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </DialogContent>
      {openService && (
        <ServiceCoursesOverlay
          serviceTitle={openService.title}
          clientName={name}
          courses={openService.courses}
          onClose={() => setOpenService(null)}
        />
      )}
    </Dialog>
  );
}

function ClientsView({ filter }: { filter: ViewFilter }) {
  const { loading, error, data } = useCourseStructures();
  // The client REGISTRY (Client Management) — the list's identity data
  // (contact person, email) lives here, not on course docs.
  const { data: clientDocs } = useClientRegistry();
  // Which client's services overlay is open. Local state, not the shared
  // filter: opening the overlay must not silently narrow every other view.
  const [openClient, setOpenClient] = useState<string | null>(null);

  const rows = useMemo(() => {
    // Services per client, aggregated from the courses in scope.
    const svcByClient = new Map<string, Map<string, number>>();
    (data || []).forEach((c: any) => {
      const id = String(c._id || "");
      // Course-level selection narrows the client list too — a chosen course
      // belongs to exactly one client, and showing the others would contradict
      // the filter bar sitting right above.
      if (filter.course !== "all" && id !== filter.course) return;
      const name = c.clientName || "Unassigned";
      const model = String(c.serviceModal || c.serviceType || "").trim();
      if (!svcByClient.has(name)) svcByClient.set(name, new Map());
      if (model) {
        const m = svcByClient.get(name)!;
        m.set(model, (m.get(model) || 0) + 1);
      }
    });

    const map = new Map<string, ClientRow>();
    // Registry first: company name + primary contact person + email — the
    // basic client identity this list is about.
    (clientDocs || []).forEach((d: any) => {
      const name = String(d.clientCompany || "").trim();
      if (!name) return;
      // Respect an active course narrowing: keep only registry clients whose
      // courses are in scope (or the explicitly selected client).
      if (filter.course !== "all" && !svcByClient.has(name) && name !== filter.client) return;
      const contacts = Array.isArray(d.contactPersons) ? d.contactPersons : [];
      const primary = contacts.find((p: any) => p?.isPrimary) || contacts[0];
      map.set(name, {
        name,
        contact: String(primary?.name || "").trim(),
        email: String(primary?.email || "").trim(),
        services: [],
      });
    });
    // Clients that only exist through courses (legacy/unregistered) still show.
    svcByClient.forEach((_, name) => {
      if (!map.has(name)) map.set(name, { name, contact: "", email: "", services: [] });
    });
    map.forEach((row, name) => {
      const svc = svcByClient.get(name);
      row.services = svc ? Array.from(svc.entries()).sort((a, b) => b[1] - a[1]) : [];
    });

    const all = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    return filter.client === "all" ? all : all.filter((r) => r.name === filter.client);
  }, [data, clientDocs, filter.client, filter.course]);

  const narrowed = scopeLabel(filter);

  // Columns need the setter (the row's "View services" opens the overlay),
  // so they are built here rather than at module scope like the other views'
  // static column sets.
  const listColumns = useMemo(
    () => makeClientColumns((client) => setOpenClient(client)),
    [],
  );

  return (
    <>
      {/* The generic strapline is gone: it restated the <h1> in a sentence and
          cost a line before any data. `sub` now fires only when a filter is
          active, where it is the ONLY thing telling you the list is narrowed. */}
      <Head
        eyebrow="Clients"
        title="Clients"
        sub={narrowed ? `Showing ${narrowed}.` : undefined}
        right={<ScopeFilters f={filter} course={false} />}
      />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <DataTable
          /* Untitled on purpose. "All clients" sat directly under <h1>Clients</h1>
             and spent a whole toolbar row saying the word again. When a client
             filter IS applied the name is real information, so it comes back. */
          title={filter.client === "all" ? undefined : filter.client}
          ariaLabel="Clients"
          data={rows}
          columns={listColumns}
          getRowKey={(r) => r.name}
          searchText={(r) => `${r.name} ${r.contact} ${r.email}`}
          searchPlaceholder="Search client, contact or email…"
          /* Opens the services overlay (services offered, year, courses) —
             the jump to Course Insight lives inside it as "View all courses". */
          onRowClick={(r) => setOpenClient(r.name)}
          emptyTitle="No clients found"
          emptyHint="Clients appear here once a course is created under one."
          pageSize={10}
          fillHeight
          className="min-h-0 flex-1"
        />
      )}
      {openClient && data && (
        <ClientServicesOverlay
          key={openClient}
          name={openClient}
          courses={(data as any[]).filter((c) => (c.clientName || "Unassigned") === openClient)}
          onClose={() => setOpenClient(null)}
          onOpenCourses={() => { filter.onClient(openClient); window.location.hash = "#courses"; }}
        />
      )}
    </>
  );
}

type ClientRow = { name: string; contact: string; email: string; services: [string, number][] };

/* Deterministic tone per service model, matching Course Setup's badge hues. */
const serviceTone = (model: string): StatusTone => {
  const s = model.toLowerCase();
  if (s.includes("placement")) return "brand";
  if (s.includes("skill")) return "info";
  if (s.includes("degree")) return "danger";
  if (s.includes("td") || s.includes("training")) return "success";
  return "neutral";
};

/* Column factory, not a static set: the row's "View services" action opens
   the services overlay, which needs the view's open setter. */
const makeClientColumns = (openServices: (client: string) => void): Column<ClientRow>[] => [
  {
    /* max-w-sm is the whole spacing fix. Every numeric column is md:flex-none,
       so this was the ONLY growable cell in the row and it swallowed all the
       leftover width — on a 1920px screen roughly 800px of dead air opened up
       between a client's name and its own numbers. Capped, the numbers sit
       beside the name and the slack falls harmlessly off the end of the row. */
    key: "name", header: "Client", className: "md:flex-[2.4] md:max-w-sm", hideLabelOnMobile: true,
    /* size-7 monogram (28px) + gap-2.5 (10px) = 38px = pl-9.5, so the header
       sits over the client NAME instead of over the avatars. */
    headerClassName: "pl-9.5",
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="flex items-center gap-2.5">
        <Monogram name={r.name} />
        <b className="block min-w-0 truncate text-sm font-medium text-heading">{r.name}</b>
      </span>
    ),
  },
  {
    key: "contact", header: "Contact", className: "md:flex-1 md:min-w-32",
    sortValue: (r) => r.contact || "￿",
    cell: (r) => r.contact
      ? <span className="block min-w-0 truncate text-sm text-body">{r.contact}</span>
      : <span className="text-2xs text-faint">—</span>,
  },
  {
    key: "email", header: "Email", className: "md:flex-[1.4] md:min-w-40",
    sortValue: (r) => r.email || "￿",
    cell: (r) => r.email ? (
      <a
        href={`mailto:${r.email}`}
        onClick={(e) => e.stopPropagation()}
        className="block min-w-0 truncate text-sm text-body underline-offset-2 hover:text-brand-strong hover:underline"
        title={r.email}
      >
        {r.email}
      </a>
    ) : (
      <span className="text-2xs text-faint">—</span>
    ),
  },
  {
    /* No badge clutter in the list — one action per row; the overlay carries
       the services (with models, year and the model filter). */
    key: "view", header: "", className: "md:w-32 md:flex-none", align: "right",
    cell: (r) => (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); openServices(r.name); }}
        className="ldc-link whitespace-nowrap"
      >
        View services →
      </button>
    ),
  },
];

function CoursesView({ filter }: { filter: ViewFilter }) {
  const { loading, error, data } = useCourseStructures();
  const rows = useMemo(() => (data || [])
    // Scope first: the filter bar's selection is the view's subject, not a
    // suggestion the table may ignore.
    .filter((c: any) => inScope(filter, String(c._id || "")))
    .map((c: any): CourseRow => {
      const batches = Array.isArray(c.batchAndParticipants) ? c.batchAndParticipants : [];
      const isStudent = (u: any) => {
        const rn = roleName(u.user?.role).toLowerCase();
        return rn.includes("student") || rn === "";
      };
      const students = batches.reduce((s: number, b: any) =>
        s + (Array.isArray(b.users) ? b.users.filter(isStudent).length : 0), 0);
      return { id: String(c._id || ""), name: c.courseName || "Untitled", code: c.courseCode || "—", client: c.clientName || "—",
        batches: batches.length, students: n(c.participantCount) || students, modules: n(c.moduleCount),
        // Carried for the Actions menu: the mapping is what Course Structure
        // deep-links on, and hasModuleHours is the Program Calendar's gate.
        mappingId: String(c.mappingId || ""), hasModuleHours: Boolean(c.hasModuleHours),
        batchRows: batches.map((b: any): BatchRow => {
          const us = Array.isArray(b.users) ? b.users : [];
          return {
            name: b.batchName || "Unnamed batch",
            students: us.filter(isStudent).length,
            trainers: us.filter((u: any) => {
              const rn = roleName(u.user?.role).toLowerCase();
              return rn.includes("trainer") || rn.includes("faculty");
            }).length,
            status: b.status || "",
            start: b.batchStartDate ? new Date(b.batchStartDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "",
            end: b.batchEndDate ? new Date(b.batchEndDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "",
          };
        }),
      };
    }), [data, filter]);

  // The filter bar above has already answered "which course". Repeating that
  // answer as a one-row table asks the user to click again for what they just
  // told us, so a chosen course goes straight to the course itself; with no
  // course chosen the list is what they need, and stays.
  const selected = filter.course === "all" ? null : rows.find((r) => r.id === filter.course) || null;
  const narrowed = scopeLabel(filter, rows[0]?.name);

  return (
    <>
      <Head
        eyebrow="Course Insight"
        title={selected ? selected.name : "Courses"}
        sub={selected
          ? `${selected.code} · ${selected.client}`
          : narrowed ? `Showing ${narrowed}.` : "Every course you run, with its client, batches, students and structure."}
        right={<ScopeFilters f={filter} />}
        showBack
      />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (selected
        ? <CourseDetail row={selected} onClear={() => filter.onCourse("all")} />
        : (
          <DataTable
            /* Untitled when unfiltered: "All courses" duplicated the shell filter
             bar's own "All courses" state label a few px above it, under an
             <h1>Courses</h1>. Three sightings of one word. The filter bar keeps
             its copy — it is the only thing reporting filter state. */
          title={filter.client === "all" ? undefined : `${filter.client} · courses`}
          ariaLabel="Courses"
            data={rows}
            columns={courseColumns}
            getRowKey={(r, i) => `${r.id || r.code}-${i}`}
            searchText={(r) => `${r.name} ${r.code} ${r.client}`}
            searchPlaceholder="Search course, code or client…"
            onRowClick={(r) => { if (r.id) filter.onCourse(r.id); }}
            filters={[
              {
                key: "staffing", label: "Any size",
                options: [
                  { value: "empty", label: "No students", match: (r: CourseRow) => r.students === 0 },
                  { value: "small", label: "1–10", match: (r: CourseRow) => r.students > 0 && r.students <= 10 },
                  { value: "large", label: "11+", match: (r: CourseRow) => r.students > 10 },
                ],
              },
            ]}
            emptyTitle="No courses in this selection"
            emptyHint="Change the client or course filter above to widen the view."
            pageSize={10}
            fillHeight
            className="min-h-0 flex-1"
          />
        ))}
    </>
  );
}

/* The selected course, in place of a table that would have held one row.
   Everything here comes off the record already fetched for the list — no
   second request, and nothing shown that the payload doesn't carry. */
function CourseDetail({ row, onClear }: { row: CourseRow; onClear: () => void }) {
  const router = useRouter();
  // Structure, Calendar and Enrollment are hosted inside this console rather
  // than opened as their own pages — leaving the shell stranded the user with
  // no way back, and the whole point of the console is that everything about a
  // course happens in one place.
  const open = (view: LDView) => { window.location.hash = view; };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-chip border border-hairline px-2.5 py-1 text-xs font-medium text-body transition-colors hover:bg-row-hover"
        >
          <ArrowLeft size={13} strokeWidth={2.4} aria-hidden />
          All courses
        </button>
        <span className="text-xs text-subtle">{row.batches} {row.batches === 1 ? "batch" : "batches"}</span>
        <div className="ml-auto">
          <CourseActionsMenu
            status={{ id: row.id, moduleCount: row.modules, participantCount: row.students, hasModuleHours: row.hasModuleHours }}
            items={["view", "structure", "calendar", "enrollment"]}
            label="Manage course"
            // The setup FORM is a stage inside the Course Structure page's own
            // state rather than a route, so this one still leaves the console —
            // it is the only destination that cannot be hosted here.
            onView={() => router.push(row.mappingId
              ? `/lms/pages/coursestructure?openMappingId=${encodeURIComponent(row.mappingId)}`
              : "/lms/pages/coursestructure")}
            onStructure={() => open("course-structure")}
            onCalendar={() => open("course-calendar")}
            onEnrollment={() => open("course-enrollment")}
          />
        </div>
      </div>

      <div className="ldm-kpis mb-4">
        <StatTile tint="ember" icon={BookOpen} label="Modules" value={row.modules} sub={row.modules ? "In the course structure" : "No structure built yet"} />
        <StatTile tint="blue" icon={Users} label="Students" value={row.students} sub={row.students ? "Enrolled across batches" : "Nobody enrolled yet"} />
        <StatTile tint="violet" icon={GraduationCap} label="Batches" value={row.batches} sub={row.batches ? "Running for this course" : "No batches yet"} />
      </div>

      <div className="rounded-tile border border-hairline bg-surface">
        <div className="border-b border-hairline px-4 py-3 text-sm font-semibold text-heading">Batches</div>
        {row.batchRows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-subtle">No batches on this course yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {row.batchRows.map((b, i) => (
              <li key={`${b.name}-${i}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-sm font-medium text-heading">{b.name}</b>
                  <small className="block text-2xs text-subtle">
                    {b.start && b.end ? `${b.start} – ${b.end}` : b.start ? `From ${b.start}` : "No dates set"}
                  </small>
                </span>
                {b.status ? <StatusChip tone={b.status.toLowerCase() === "active" ? "success" : "neutral"}>{b.status}</StatusChip> : null}
                <span className="w-20 text-right text-sm tabular-nums text-body">
                  {b.trainers} <span className="text-2xs text-subtle">{b.trainers === 1 ? "trainer" : "trainers"}</span>
                </span>
                <span className="w-24 text-right text-sm font-semibold tabular-nums text-heading">
                  {b.students} <span className="text-2xs font-normal text-subtle">students</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type BatchRow = { name: string; students: number; trainers: number; status: string; start: string; end: string };
type CourseRow = {
  id: string; name: string; code: string; client: string;
  batches: number; students: number; modules: number;
  mappingId: string; hasModuleHours: boolean; batchRows: BatchRow[];
};

const courseColumns: Column<CourseRow>[] = [
  {
    key: "name", header: "Course", className: "md:flex-[2.4]", hideLabelOnMobile: true,
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="block min-w-0">
        <b className="block truncate text-sm font-medium text-heading">{r.name}</b>
        <small className="block truncate text-2xs text-subtle">{r.code}</small>
      </span>
    ),
  },
  {
    // Capped rather than flexible: client names are short, so a flex column
    // handed it ~460px of dead space. Only the course name absorbs slack.
    key: "client", header: "Client", className: "md:w-52 md:flex-none",
    sortValue: (r) => r.client,
    cell: (r) => <span className="block truncate text-sm text-body">{r.client}</span>,
  },
  {
    key: "batches", header: "Batches", align: "center", className: "md:w-24 md:flex-none",
    sortValue: (r) => r.batches,
    cell: (r) => <span className="text-sm font-semibold tabular-nums text-heading">{r.batches}</span>,
  },
  {
    key: "students", header: "Students", align: "center", className: "md:w-24 md:flex-none",
    sortValue: (r) => r.students,
    cell: (r) => (
      <span className={`text-sm font-semibold tabular-nums ${r.students === 0 ? "text-faint" : "text-heading"}`}>
        {r.students}
      </span>
    ),
  },
  {
    key: "modules", header: "Modules", align: "center", className: "md:w-24 md:flex-none",
    sortValue: (r) => r.modules,
    cell: (r) => <span className="text-sm font-semibold tabular-nums text-heading">{r.modules}</span>,
  },
];

/* ───────── Schedule ───────── */
function ScheduleView() {
  const { loading, error, data } = useProgramCalendars();
  const rows = (data || []).map((c) => ({
    name: c.courseName || c.courseDetails?.courseName || "Untitled", code: c.courseCode || "—",
    start: c.startDate ? new Date(c.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—",
    end: c.endDate ? new Date(c.endDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "computed",
    status: c.status || "—",
  }));
  return (
    <>
      <Head eyebrow="Schedule" title="Training Calendar" sub="Published program calendars and their status across your courses." showBack />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <DataTable
          /* The heading above is "Training Calendar" and its sub already says
             "Published program calendars…". */
          ariaLabel="Program calendars"
          data={rows}
          columns={scheduleColumns}
          getRowKey={(r, i) => `${r.code}-${i}`}
          searchText={(r) => `${r.name} ${r.code} ${r.status}`}
          searchPlaceholder="Search course or code…"
          filters={[{
            key: "status", label: "Any status",
            options: [...new Set(rows.map((r) => r.status))].filter((s) => s && s !== "—").sort()
              .map((s) => ({ value: s, label: s, match: (r: ScheduleRow) => r.status === s })),
          }]}
          emptyTitle="No published calendars yet"
          emptyHint="A calendar appears here once a program schedule is published for a course."
        />
      )}
      <Note>Per-batch week grids and deviations open per course; the end date is computed from pedagogy hours, holidays and deviations.</Note>
    </>
  );
}

/* ───────── Trainers (derived from course rosters) ───────── */
function TrainersView({ filter }: { filter: ViewFilter }) {
  const { loading, error, data } = useCourseStructures();
  const trainers = useMemo(() => {
    const map = new Map<string, { name: string; courses: Set<string>; batches: number }>();
    (data || []).forEach((c: any) => {
      // Only rosters inside the selected client/course contribute, so the list
      // answers "who teaches THIS" rather than "who teaches anything".
      if (!inScope(filter, String(c._id || ""))) return;
      (c.batchAndParticipants || []).forEach((b: any) => {
        (b.users || []).forEach((u: any) => {
          const rn = roleName(u.user?.role).toLowerCase();
          if (rn.includes("trainer") || rn.includes("faculty")) {
            const key = u.user?._id || u.user?.email || `${u.user?.firstName} ${u.user?.lastName}`;
            const label = `${u.user?.firstName || ""} ${u.user?.lastName || ""}`.trim() || u.user?.email || "Trainer";
            if (!map.has(key)) map.set(key, { name: label, courses: new Set(), batches: 0 });
            const t = map.get(key)!; t.courses.add(c.courseName || c.courseCode || "course"); t.batches += 1;
          }
        });
      });
    });
    return Array.from(map.values());
  }, [data, filter]);

  const narrowed = scopeLabel(filter);

  return (
    <>
      <Head
        eyebrow="Trainers"
        title="Trainer Allocation"
        sub={narrowed
          ? `Trainers on ${narrowed}, from course rosters.`
          : "Which trainer is assigned to which courses and batches (from course rosters)."}
        right={<ScopeFilters f={filter} />}
        showBack
      />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <DataTable
          /* Restates the "Trainer Allocation" heading above it. */
          title={filter.client === "all" ? undefined : `${filter.client} · trainers`}
          ariaLabel="Trainers"
          data={trainers}
          columns={trainerColumns}
          getRowKey={(t, i) => `${t.name}-${i}`}
          searchText={(t) => `${t.name} ${Array.from(t.courses).join(" ")}`}
          searchPlaceholder="Search trainer or course…"
          filters={[{
            key: "load", label: "Any load",
            options: [
              { value: "one", label: "1 course", match: (t: TrainerRow) => t.courses.size === 1 },
              { value: "few", label: "2–3 courses", match: (t: TrainerRow) => t.courses.size >= 2 && t.courses.size <= 3 },
              { value: "many", label: "4+ courses", match: (t: TrainerRow) => t.courses.size >= 4 },
            ],
          }]}
          emptyTitle="No trainers in this selection"
          emptyHint="Trainers appear once they are added to a course batch."
          pageSize={10}
          fillHeight
          className="min-h-0 flex-1"
        />
      )}
    </>
  );
}

type ResultRow = { name: string; code: string; total: number; done: number; prog: number; not: number; rate: number };

const resultColumns: Column<ResultRow>[] = [
  {
    key: "name", header: "Course", className: "md:flex-[2]", hideLabelOnMobile: true,
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="block min-w-0">
        <b className="block truncate text-sm font-medium text-heading">{r.name}</b>
        <small className="block truncate text-2xs text-subtle">{r.code}</small>
      </span>
    ),
  },
  {
    key: "total", header: "Students", align: "center", className: "md:w-24 md:flex-none",
    sortValue: (r) => r.total,
    cell: (r) => (
      <span className={`text-sm font-semibold tabular-nums ${r.total === 0 ? "text-faint" : "text-heading"}`}>
        {r.total}
      </span>
    ),
  },
  // Completed / in progress / not started each get their own right-aligned
  // column. Merged into one cell they read as "0 · 0 · 5" — three unlabelled
  // numbers you have to decode — and merging also forced the remaining columns
  // to absorb the slack, leaving the course name ~600px of dead space.
  {
    key: "done", header: "Completed", align: "right", className: "md:w-28 md:flex-none",
    sortValue: (r) => r.done,
    cell: (r) => (
      <span className={`text-sm font-semibold tabular-nums ${r.done === 0 ? "text-faint" : "text-success-700 dark:text-success-500"}`}>
        {r.done}
      </span>
    ),
  },
  {
    key: "prog", header: "In progress", align: "right", className: "md:w-28 md:flex-none",
    sortValue: (r) => r.prog,
    cell: (r) => (
      <span className={`text-sm font-semibold tabular-nums ${r.prog === 0 ? "text-faint" : "text-brand-700 dark:text-brand-400"}`}>
        {r.prog}
      </span>
    ),
  },
  {
    key: "not", header: "Not started", align: "right", className: "md:w-28 md:flex-none",
    sortValue: (r) => r.not,
    cell: (r) => (
      <span className={`text-sm font-semibold tabular-nums ${r.not === 0 ? "text-faint" : "text-body"}`}>
        {r.not}
      </span>
    ),
  },
  {
    // Flexible alongside the course name so the two share the slack. With the
    // meter column fixed, the name column absorbed everything and the gap
    // before "Students" got worse, not better.
    key: "rate", header: "Completion", className: "md:flex-1",
    sortValue: (r) => r.rate,
    cell: (r) => (
      <span className="flex items-center gap-2">
        <StatusMeter
          value={r.total === 0 ? null : r.rate}
          tone={r.rate >= 85 ? "success" : r.rate < 50 ? "danger" : "brand"}
        />
        <b className={`shrink-0 text-sm font-semibold tabular-nums ${r.total === 0 ? "text-faint" : "text-heading"}`}>
          {r.total === 0 ? "—" : `${r.rate}%`}
        </b>
      </span>
    ),
  },
];

type ScheduleRow = { name: string; code: string; start: string; end: string; status: string };

const scheduleColumns: Column<ScheduleRow>[] = [
  {
    key: "name", header: "Course", className: "md:flex-[2.6]", hideLabelOnMobile: true,
    sortValue: (r) => r.name,
    cell: (r) => (
      <span className="block min-w-0">
        <b className="block truncate text-sm font-medium text-heading">{r.name}</b>
        <small className="block truncate text-2xs text-subtle">{r.code}</small>
      </span>
    ),
  },
  {
    key: "start", header: "Starts", className: "md:w-28 md:flex-none",
    sortValue: (r) => r.start,
    cell: (r) => <span className="text-sm tabular-nums text-body">{r.start}</span>,
  },
  {
    key: "end", header: "Ends", className: "md:w-28 md:flex-none",
    sortValue: (r) => r.end,
    cell: (r) => (
      <span className={`text-sm tabular-nums ${r.end === "computed" ? "text-faint italic" : "text-body"}`}>
        {r.end}
      </span>
    ),
  },
  {
    key: "status", header: "Status", className: "md:w-28 md:flex-none",
    sortValue: (r) => r.status,
    cell: (r) => (
      <StatusChip tone={r.status === "published" ? "success" : "neutral"}>{r.status}</StatusChip>
    ),
  },
];

type TrainerRow = { name: string; courses: Set<string>; batches: number };

const trainerColumns: Column<TrainerRow>[] = [
  {
    key: "name", header: "Trainer", className: "md:flex-[1.6]", hideLabelOnMobile: true,
    sortValue: (t) => t.name,
    cell: (t) => (
      <span className="flex items-center gap-2.5">
        <Monogram name={t.name} />
        <b className="truncate text-sm font-medium text-heading">{t.name}</b>
      </span>
    ),
  },
  {
    key: "courses", header: "Courses", align: "center", className: "md:w-24 md:flex-none",
    sortValue: (t) => t.courses.size,
    cell: (t) => <span className="text-sm font-semibold tabular-nums text-heading">{t.courses.size}</span>,
  },
  {
    key: "batches", header: "Batches", align: "center", className: "md:w-24 md:flex-none",
    sortValue: (t) => t.batches,
    cell: (t) => <span className="text-sm font-semibold tabular-nums text-heading">{t.batches}</span>,
  },
  {
    key: "teaches", header: "Teaches", className: "md:flex-[2.4]",
    cell: (t) => {
      const list = Array.from(t.courses);
      return (
        <span className="flex flex-wrap items-center gap-1">
          {list.slice(0, 3).map((c) => (
            <StatusChip key={c} tone="neutral">{c}</StatusChip>
          ))}
          {list.length > 3 && (
            <span className="text-2xs text-subtle" title={list.slice(3).join(", ")}>
              +{list.length - 3} more
            </span>
          )}
        </span>
      );
    },
  },
];

/* ───────── Student Performance ───────── */
function PerformanceView({ filter }: { filter: ViewFilter }) {
  const { loading, error, data } = useStaffAnalytics((j) => {
    const d = j?.data ?? j ?? {}; const courses: any[] = Array.isArray(d.courses) ? d.courses : [];
    const rows: any[] = [];
    courses.forEach((c) => {
      const cn = c.course?.courseName || c.courseName || "Course";
      // The analytics rows are the only place a student is tied to a course, so
      // the id is carried through for scoping — clientName here is often blank.
      const cid = String(c.course?._id || c._id || "");
      (Array.isArray(c.students) ? c.students : []).forEach((s: any) => {
        const st = s.student ?? s;
        const p = s.progress ?? s;
        rows.push({
          name: `${st.firstName || ""} ${st.lastName || ""}`.trim() || st.email || "Student",
          course: cn,
          courseId: cid,
          progress: n(s.progress?.overall ?? s.overall ?? s.progress),
          // Per-stage completion. `null` where the stage has no content at all,
          // so an empty stage renders "N/A" instead of a misleading 0%.
          iDo: stageDone(p, "I_Do"),
          weDo: stageDone(p, "We_Do"),
          youDo: stageDone(p, "You_Do"),
          // Marks-weighted score across We Do / You Do only.
          score: scoreOf(p),
        });
      });
    });
    return rows;
  });
  const grade = (p: number): { tone: StatusTone; label: string } =>
    p >= 85 ? { tone: "success", label: "Excellent" }
      : p >= 60 ? { tone: "success", label: "On track" }
        : p >= 40 ? { tone: "warning", label: "Average" }
          : { tone: "danger", label: "At risk" };

  const columns: Column<StudentPerfRow>[] = [
    {
      key: "name", header: "Student", className: "md:flex-[2]", hideLabelOnMobile: true,
      sortValue: (r) => r.name,
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <Monogram name={r.name} />
          <b className="truncate text-sm font-medium text-heading">{r.name}</b>
        </span>
      ),
    },
    {
      key: "course", header: "Course", className: "md:flex-[2]",
      sortValue: (r) => r.course,
      cell: (r) => <span className="truncate text-sm text-body">{r.course}</span>,
    },
    {
      // The three pedagogy stages share one cell rather than three columns:
      // they are read as a set (where does this learner drop off?), and three
      // separate columns would each collapse to their own line on mobile.
      key: "stages", header: "I Do · We Do · You Do", className: "md:flex-[2.2]",
      sortValue: (r) => r.youDo ?? -1,
      cell: (r) => <StageTriple iDo={r.iDo} weDo={r.weDo} youDo={r.youDo} />,
    },
    {
      key: "score", header: "Score", align: "center", className: "md:w-24 md:flex-none",
      sortValue: (r) => r.score ?? -1,
      cell: (r) => (
        <b className={`text-sm font-semibold tabular-nums ${r.score === null ? "text-faint" : TONE_TEXT[r.score >= 70 ? "success" : r.score >= 50 ? "warning" : "danger"]}`}>
          {r.score === null ? "—" : pct(r.score)}
        </b>
      ),
    },
    {
      key: "progress", header: "Overall", className: "md:flex-[1.3]",
      sortValue: (r) => r.progress,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <StatusMeter value={r.progress} tone={grade(r.progress).tone} />
          <b className="shrink-0 text-sm font-semibold tabular-nums text-heading">{pct(r.progress)}</b>
        </span>
      ),
    },
    {
      key: "status", header: "Status", className: "md:w-24 md:flex-none",
      sortValue: (r) => r.progress,
      cell: (r) => { const g = grade(r.progress); return <StatusChip tone={g.tone}>{g.label}</StatusChip>; },
    },
  ];

  const rows = useMemo(
    () => ((data || []) as StudentPerfRow[]).filter((r) => inScope(filter, r.courseId)),
    [data, filter],
  );
  const narrowed = scopeLabel(filter, rows[0]?.course);

  return (
    <>
      <Head
        eyebrow="Student Performance"
        title="Students"
        sub={narrowed ? `Progress for students on ${narrowed}.` : "Progress for every student across your courses."}
        right={<ScopeFilters f={filter} />}
        showBack
      />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <DataTable
          /* The <h1> directly above already reads "Students". */
          title={filter.client === "all" ? undefined : `${filter.client} · students`}
          ariaLabel="Students"
          data={rows}
          columns={columns}
          getRowKey={(r, i) => `${r.name}-${r.course}-${i}`}
          searchText={(r) => `${r.name} ${r.course}`}
          searchPlaceholder="Search student or course…"
          filters={[{
            key: "band", label: "All statuses",
            options: [
              { value: "risk", label: "At risk", match: (r) => r.progress < 40 },
              { value: "avg", label: "Average", match: (r) => r.progress >= 40 && r.progress < 60 },
              { value: "track", label: "On track", match: (r) => r.progress >= 60 && r.progress < 85 },
              { value: "exc", label: "Excellent", match: (r) => r.progress >= 85 },
            ],
          }]}
          emptyTitle="No students in this selection"
          emptyHint="Students appear here once they are enrolled and have opened a course."
          pageSize={10}
          fillHeight
          className="min-h-0 flex-1"
        />
      )}
    </>
  );
}

/* ───────── Attendance ───────── */
/* ───────── Attendance (Overview · Report · Analytics), scoped to top filter ───────── */
const attBand = (p: number): string => (p >= 75 ? "good" : p >= 50 ? "warn" : "bad");

// Roster + raw records for one course → per-student and class attendance stats.
function useCourseAttendance(courseId: string) {
  const [s, setS] = useState<{ loading: boolean; error: string; courseName: string; clientName: string; students: any[]; records: any[] }>(
    { loading: true, error: "", courseName: "", clientName: "", students: [], records: [] }
  );
  useEffect(() => {
    if (!courseId || courseId === "all") { setS({ loading: false, error: "", courseName: "", clientName: "", students: [], records: [] }); return; }
    let on = true; setS((p) => ({ ...p, loading: true, error: "" }));
    (async () => {
      try {
        const [rc, rec] = await Promise.all([authGet(`/getAll/courses-data/${courseId}`), authGet(`/attendance/get/${courseId}`)]);
        const cd = rc?.data ?? rc ?? {};
        const seen = new Set<string>(); const students: any[] = [];
        (cd.batchAndParticipants || []).forEach((b: any) => (b.users || []).forEach((u: any) => {
          const su = u.user || u; const id = String(su._id || u._id || "");
          if (id && !seen.has(id)) { seen.add(id); students.push({ id, name: `${su.firstName || ""} ${su.lastName || ""}`.trim() || su.email || "Student", email: su.email || "", batch: b.batchName || b.name || "" }); }
        }));
        const records = Array.isArray(rec?.data) ? rec.data : Array.isArray(rec) ? rec : [];
        if (on) setS({ loading: false, error: "", courseName: cd.courseName || "", clientName: cd.clientName || "", students, records });
      } catch (e) { if (on) setS({ loading: false, error: e instanceof Error ? e.message : "Could not load attendance", courseName: "", clientName: "", students: [], records: [] }); }
    })();
    return () => { on = false; };
  }, [courseId]);
  return s;
}

function computeAtt(students: any[], records: any[]) {
  const map = new Map<string, Record<string, string>>(); const dates = new Set<string>();
  records.forEach((r) => { const sid = String(r.studentId || ""); const dk = String(r.date || "").slice(0, 10); if (!sid || !dk) return; dates.add(dk); if (!map.has(sid)) map.set(sid, {}); map.get(sid)![dk] = r.status; });
  const sessions = dates.size;
  const per = students.map((s) => {
    const m = map.get(s.id) || {}; let P = 0, A = 0, H = 0;
    Object.values(m).forEach((v) => { if (v === "P") P++; else if (v === "A") A++; else if (v === "H") H++; });
    const eff = P + H * 0.5; const pct = sessions > 0 ? Math.round((eff / sessions) * 100) : 0;
    return { ...s, P, A, H, marked: P + A + H, pct };
  }).sort((a, b) => a.pct - b.pct);
  const sum = (k: "P" | "A" | "H") => per.reduce((s, x) => s + x[k], 0);
  const P = sum("P"), A = sum("A"), H = sum("H");
  const totalCells = students.length * sessions; const N = Math.max(0, totalCells - (P + A + H));
  const avgPct = per.length ? Math.round(per.reduce((s, x) => s + x.pct, 0) / per.length) : 0;
  const atRisk = per.filter((x) => x.pct < 75).length;
  let best: { dk: string; ratio: number } | null = null;
  dates.forEach((dk) => { let pr = 0; per.forEach((s) => { const v = (map.get(s.id) || {})[dk]; if (v === "P") pr++; else if (v === "H") pr += 0.5; }); const ratio = students.length ? (pr / students.length) * 100 : 0; if (!best || ratio > best.ratio) best = { dk, ratio }; });
  return { sessions, per, P, A, H, N, totalCells, avgPct, atRisk, best: best as { dk: string; ratio: number } | null };
}

// Portfolio attendance-health scan — only shown when NO single course is
// selected. Surfaces courses that need attention (in delivery but attendance
// not yet marked today) first, so the L&D Head can spot a gap and drill in.
function AttPortfolio({ filter }: { filter: { course?: string; courseIds: Set<string> | null; clientOf: (id: string) => string | undefined } }) {
  const today = new Date().toISOString().slice(0, 10);
  const { loading, error, data } = useAttendanceOverview(today, (j) => {
    const d = j?.data ?? j ?? {}; return (Array.isArray(d.courses) ? d.courses : Array.isArray(d) ? d : Array.isArray(j?.data) ? j.data : []) as any[];
  });
  // View → jump to the dedicated Attendance Management route
  // (`/lms/pages/attendancemanagement?courseId=<id>`). That shell owns the
  // Management / Report / Analytics tab strip, the day nav, the download
  // modals — no need to re-mount any of it inside the LD Console anymore.
  const router = useRouter();
  // `from=ldc` tells AttendanceManagementLayout to render inside LDLayout
  // (this console's sidebar) instead of the admin/trainer DashboardLayout.
  const openCourse = (id: string) => router.push(`/lms/pages/attendancemanagement?courseId=${encodeURIComponent(id)}&from=ldc`);
  const { courseIds, clientOf, course: courseF } = filter;
  const inClient = (id: string) => courseIds === null || courseIds.has(id);
  const inCourse = (id: string) => !courseF || courseF === "all" || String(courseF) === id;
  if (loading) return <Loading />;
  if (error) return <ErrBox m={error} />;
  const rows = (data || []).filter((c: any) => inClient(String(c._id)) && inCourse(String(c._id))).map((c: any) => {
    const total = Array.isArray(c.batches) ? c.batches.length : 0;
    const marked = Array.isArray(c.batches) ? c.batches.filter((b: any) => b.markedToday).length : 0;
    const inDelivery = !!c.hasSchedule;
    const rank = !inDelivery || total === 0 ? 3 : marked === 0 ? 0 : marked < total ? 1 : 2; // pending-first
    return { ...c, total, marked, inDelivery, rank };
  }).sort((a: any, b: any) => a.rank - b.rank || (n(b.totalStudents) - n(a.totalStudents)));
  const deliv = rows.filter((r: any) => r.inDelivery && r.total > 0);
  const fully = deliv.filter((r: any) => r.marked === r.total).length;
  const pending = deliv.filter((r: any) => r.marked < r.total).length;
  return (
    <AttPortfolioTable
      rows={rows}
      totals={{ deliv: deliv.length, fully, pending }}
      clientOf={clientOf}
      onOpenCourse={openCourse}
    />
  );
}

/* Portfolio-view attendance table — the same design language as the services
   modal: dot-chip status counts in the header, sticky uppercase thead,
   compact rows with primary/secondary text, coloured dot + label status,
   quiet "Open ›" action cell, plus a toolbar (search + status filter).
   The list can be long (60+ courses), so the tbody scrolls under a sticky
   thead inside the tile — no bulk selection here (portfolio is read-only). */
function AttPortfolioTable({
  rows, totals, clientOf, onOpenCourse,
}: {
  rows: any[];
  totals: { deliv: number; fully: number; pending: number };
  clientOf: (id: string) => string | undefined;
  onOpenCourse: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("all");

  const statusOf = (c: any): "marked" | "partial" | "unmarked" | "unscheduled" => {
    if (!c.inDelivery) return "unscheduled";
    if (!c.total) return "unscheduled";
    if (c.marked === c.total) return "marked";
    if (c.marked > 0) return "partial";
    return "unmarked";
  };
  const STATUS_META: Record<string, { dot: string; label: string; tone: string }> = {
    marked:      { dot: "bg-emerald-500", label: "Marked",         tone: "text-emerald-700 dark:text-emerald-300" },
    partial:     { dot: "bg-amber-500",   label: "Partially marked", tone: "text-amber-700 dark:text-amber-300" },
    unmarked:    { dot: "bg-red-500",     label: "Not marked",     tone: "text-red-700 dark:text-red-300" },
    unscheduled: { dot: "bg-slate-300",   label: "Not scheduled",  tone: "text-subtle" },
  };

  const filtered = rows.filter((c) => {
    if (statusF !== "all" && statusOf(c) !== statusF) return false;
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return (
      String(c.courseName || "").toLowerCase().includes(t)
      || String(c.courseCode || "").toLowerCase().includes(t)
      || String(clientOf(String(c._id)) || c.clientName || "").toLowerCase().includes(t)
    );
  });
  const active = q.trim() !== "" || statusF !== "all";
  const clearAll = () => { setQ(""); setStatusF("all"); };

  // Auto-fit pagination — same pattern as the Services offered modal.
  // Measures the actual painted row height so the last row never clips, and
  // the "Auto (N)" dropdown pins a manual value if the user wants to override.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [autoFit, setAutoFit] = useState(true);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { setPage(1); }, [q, statusF, pageSize]);
  useEffect(() => {
    if (!autoFit) return;
    const el = tableWrapRef.current;
    if (!el) return;
    const FALLBACK_ROW_H = 56;
    const recompute = () => {
      const thead = el.querySelector<HTMLElement>("thead");
      const firstRow = el.querySelector<HTMLElement>("tbody tr");
      const theadH = thead ? thead.getBoundingClientRect().height : 40;
      const rowH = firstRow ? firstRow.getBoundingClientRect().height : FALLBACK_ROW_H;
      const budget = Math.max(0, el.clientHeight - theadH);
      const rows2 = Math.max(1, Math.min(100, Math.round(budget / Math.max(1, rowH))));
      setPageSize((prev) => (prev === rows2 ? prev : rows2));
    };
    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    const raf = requestAnimationFrame(recompute);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [autoFit, filtered.length]);
  const setPageSizeManual = (v: number) => { setAutoFit(false); setPageSize(v); };

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const paged = filtered.slice(pageStart, pageEnd);
  const rangeFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const rangeTo = Math.min(pageEnd, filtered.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Toolbar — wide search on the left, Status pinned to the far right. */}
      <div className="flex flex-nowrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search courses, codes, clients..."
            aria-label="Search courses"
            className="h-9 w-full rounded-md border border-hairline bg-surface pr-8 pl-8 text-xs text-heading outline-none transition-colors placeholder:text-faint hover:border-hairline-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-faint transition-colors hover:bg-row-hover hover:text-body">
              <X size={13} />
            </button>
          )}
        </div>
        {active && (
          <button type="button" onClick={clearAll} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-brand-700 transition-colors hover:text-brand-strong disabled:cursor-not-allowed disabled:text-faint disabled:hover:text-faint dark:text-brand-400">
            <RefreshCw size={12} /> Clear filters
          </button>
        )}
        <FloatingPicker
          label="Status"
          minWidth="min-w-[160px]"
          value={statusF}
          onChange={setStatusF}
          options={[
            { value: "all",         label: "All statuses" },
            { value: "unmarked",    label: "Not marked" },
            { value: "partial",     label: "Partially marked" },
            { value: "marked",      label: "Marked" },
            { value: "unscheduled", label: "Not scheduled" },
          ]}
        />
      </div>

      {/* Table tile */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tile border border-hairline bg-surface">
        {/* Table — auto-fit paginated; scroll only kicks in if the tbody
            can't be trimmed further (very small viewport). */}
        <div ref={tableWrapRef} className="min-h-0 flex-1 overflow-hidden">
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-subtle">No courses in this view — nothing matches the current Client filter.</p>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-subtle">
              No courses match the current filters. <button type="button" onClick={clearAll} className="font-semibold text-brand-700 hover:underline dark:text-brand-400">Clear filters</button>
            </p>
          ) : (
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-surface-sunken/60">
                <tr className="border-b border-hairline">
                  <th className="w-64 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Client</th>
                  <th className="px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Course</th>
                  <th className="w-24 px-3 py-1.5 text-right text-2xs font-semibold uppercase tracking-wider text-subtle">Enrolled</th>
                  <th className="w-32 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Start date</th>
                  <th className="w-32 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">End date</th>
                  <th className="w-28 px-3 py-1.5 text-right text-2xs font-semibold uppercase tracking-wider text-subtle">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((c: any) => {
                  const cid = String(c._id);
                  const startD = c.inDelivery ? (c.trainingStart || "—") : "—";
                  const endD   = c.inDelivery ? (c.trainingEnd   || "—") : "—";
                  return (
                    <tr
                      key={cid}
                      tabIndex={0}
                      role="button"
                      aria-label={`Open attendance report for ${c.courseName || "course"}`}
                      onClick={(e) => { if (!e.currentTarget.contains(e.target as Node)) return; onOpenCourse(cid); }}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenCourse(cid); } }}
                      className="cursor-pointer border-b border-hairline transition-colors last:border-0 hover:bg-row-hover"
                    >
                      <td className="px-3 py-2 align-middle">
                        <span className="truncate text-sm text-body">{clientOf(cid) || c.clientName || <span className="text-xs text-faint">—</span>}</span>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <div className="min-w-0 truncate text-sm font-semibold text-heading">{c.courseName || "Course"}</div>
                        {c.courseCode && <div className="mt-0.5 truncate text-2xs tabular-nums text-subtle">{c.courseCode}</div>}
                      </td>
                      <td className="px-3 py-2 text-right align-middle text-sm tabular-nums text-body">{n(c.totalStudents)}</td>
                      <td className="px-3 py-2 align-middle">
                        <span className={`truncate text-xs tabular-nums ${c.inDelivery ? "text-body" : "text-faint"}`}>{startD}</span>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <span className={`truncate text-xs tabular-nums ${c.inDelivery ? "text-body" : "text-faint"}`}>{endD}</span>
                      </td>
                      <td className="px-3 py-2 text-right align-middle">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400">
                          View
                          <ChevronRight size={13} aria-hidden />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination footer — matches the Services offered modal footer. */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline bg-surface-sunken/30 px-4 py-1.5">
          <span className="text-xs tabular-nums text-subtle">
            {filtered.length === 0
              ? "No courses to show"
              : <>Showing <b className="font-semibold text-heading">{rangeFrom}</b> to <b className="font-semibold text-heading">{rangeTo}</b> of <b className="font-semibold text-heading">{filtered.length}</b> courses</>}
          </span>
          <div className="flex items-center gap-3">
            <FloatingPicker
              size="sm"
              minWidth="min-w-[128px]"
              value={autoFit ? "auto" : String(pageSize)}
              onChange={(v) => { if (v === "auto") { setAutoFit(true); } else { setPageSizeManual(Number(v)); } }}
              options={[
                { value: "auto", label: `Auto (${pageSize})` },
                ...[10, 25, 50, 100].map((n2) => ({ value: String(n2), label: `${n2} per page` })),
              ]}
            />
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} aria-label="Previous page" className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, idx) => idx + 1).slice(0, 5).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    aria-current={currentPage === p ? "page" : undefined}
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-control px-2 text-xs font-semibold tabular-nums transition-colors ${
                      currentPage === p
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                        : "text-subtle hover:bg-row-hover hover:text-body"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} aria-label="Next page" className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-hairline-strong text-subtle transition-colors hover:bg-row-hover disabled:cursor-not-allowed disabled:opacity-40">
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// ── date + status helpers ──
const addDayKey = (dk: string, nd: number): string => {
  const [y, m, d] = dk.split("-").map(Number);
  const t = new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
  t.setUTCDate(t.getUTCDate() + nd);
  return t.toISOString().slice(0, 10);
};
const shortDate = (dk: string): string => {
  const [, m, d] = dk.split("-").map(Number);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][(m || 1) - 1];
  return `${String(d || 1).padStart(2, "0")} ${mon}`;
};
const ST: Record<string, [string, string]> = { P: ["good", "Present"], A: ["bad", "Absent"], H: ["warn", "Half day"], N: ["neutral", "Not marked"] };

type AttState = {
  mode: "single" | "range"; day: string; from: string; to: string;
  statusF: string; batchF: string; q: string;
  setMode: (v: "single" | "range") => void; setDay: (v: string) => void;
  setFrom: (v: string) => void; setTo: (v: string) => void;
  setStatusF: (v: string) => void; setBatchF: (v: string) => void; setQ: (v: string) => void;
};

function AttFilters({ s, batches, showStatus }: { s: AttState; batches: string[]; showStatus: boolean }) {
  const active = s.statusF !== "all" || s.batchF !== "all" || !!s.q;
  return (
    <div className="flex flex-nowrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" aria-hidden />
        <input
          value={s.q}
          onChange={(e) => s.setQ(e.target.value)}
          placeholder="Search student..."
          aria-label="Search student"
          className="h-9 w-full rounded-md border border-hairline bg-surface pr-8 pl-8 text-xs text-heading outline-none transition-colors placeholder:text-faint hover:border-hairline-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
        />
        {s.q && (
          <button
            type="button"
            onClick={() => s.setQ("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-faint transition-colors hover:bg-row-hover hover:text-body"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {showStatus && (
        <FloatingPicker
          label="Status"
          minWidth="min-w-[150px]"
          value={s.statusF}
          onChange={(v) => s.setStatusF(v)}
          options={[
            { value: "all", label: "All statuses" },
            { value: "P", label: "Present" },
            { value: "A", label: "Absent" },
            { value: "H", label: "Half day" },
            { value: "N", label: "Not marked" },
          ]}
        />
      )}
      {batches.length > 1 && (
        <FloatingPicker
          label="Batch"
          minWidth="min-w-[140px]"
          value={s.batchF}
          onChange={(v) => s.setBatchF(v)}
          options={[{ value: "all", label: "All batches" }, ...batches.map((b) => ({ value: b, label: b }))]}
        />
      )}
      {active && (
        <button
          type="button"
          onClick={() => { s.setStatusF("all"); s.setBatchF("all"); s.setQ(""); }}
          className="ml-1 inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-brand-700 transition-colors hover:text-brand-strong dark:text-brand-400"
        >
          <RefreshCw size={12} /> Clear filters
        </button>
      )}
    </div>
  );
}

/* Single-day attendance register — the same design language as the
   "Services offered" modal: sticky uppercase thead, subtle hairlines,
   coloured dot + label for status, muted secondary text, quiet actions
   cell, plus a selection column feeding a bulk-action bar. Read-only:
   the L&D console observes attendance, it doesn't mark it — bulk actions
   here nudge trainers rather than mutate the register. */
const STATUS_DOT: Record<string, string> = {
  P: "bg-emerald-500", A: "bg-red-500", H: "bg-amber-500", N: "bg-slate-300",
};
const STATUS_TONE: Record<string, string> = {
  P: "text-emerald-700 dark:text-emerald-300",
  A: "text-red-700 dark:text-red-300",
  H: "text-amber-700 dark:text-amber-300",
  N: "text-subtle",
};

function AttRegisterSingle({
  students, records, s, match,
}: {
  students: any[];
  records: any[];
  s: AttState;
  match: (r: any) => boolean;
}) {
  const dmap = new Map<string, any>();
  records.forEach((r) => { if (String(r.date || "").slice(0, 10) === s.day) dmap.set(String(r.studentId), r); });
  const withStatus = students.map((st) => {
    const r = dmap.get(st.id);
    return { ...st, status: r?.status || "N", reason: r?.reason || "" };
  });
  const counts = { P: 0, A: 0, H: 0, N: 0 } as Record<string, number>;
  withStatus.forEach((r) => { counts[r.status]++; });
  const rows = withStatus.filter((r) => (s.statusF === "all" || r.status === s.statusF) && match(r));

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Filter changes can hide selected rows — prune the set so bulk-action
  // counts never claim rows that aren't visible.
  const visibleIds = useMemo(() => new Set(rows.map((r) => String(r.id))), [rows]);
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      prev.forEach((id) => { if (visibleIds.has(id)) next.add(id); else changed = true; });
      return changed ? next : prev;
    });
  }, [visibleIds]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(String(r.id)));
  const someSelected = selected.size > 0 && !allSelected;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => String(r.id))));
  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const headerCbRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (headerCbRef.current) headerCbRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const chip = (dot: string, n: number, label: string) => (
    <span className="inline-flex items-center gap-1.5 rounded-chip bg-surface-sunken/70 px-2 py-0.5 text-2xs font-medium text-body">
      <span className={`inline-block size-1.5 rounded-full ${dot}`} />
      <b className="font-semibold tabular-nums text-heading">{n}</b>
      <span className="text-subtle">{label}</span>
    </span>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tile border border-hairline bg-surface">
      {/* Header strip — date + at-a-glance status counts. */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline bg-surface-sunken/40 px-4 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-heading">
            Register · <span className="font-medium text-body">{s.day ? shortDate(s.day) : "—"}</span>
          </div>
          <div className="mt-0.5 truncate text-2xs text-subtle">
            {rows.length === students.length
              ? `${rows.length} ${rows.length === 1 ? "student" : "students"}`
              : `${rows.length} of ${students.length} students`}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {chip("bg-emerald-500", counts.P, "present")}
          {chip("bg-red-500", counts.A, "absent")}
          {chip("bg-amber-500", counts.H, "half-day")}
          {chip("bg-slate-300", counts.N, "not marked")}
        </div>
      </div>

      {/* Bulk-action bar — only visible when the user has selected rows. */}
      {selected.size > 0 && (
        <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-hairline bg-brand-100/60 px-5 py-2 dark:bg-brand-500/10">
          <span className="text-xs font-semibold text-brand-700 dark:text-brand-400">
            {selected.size} selected
          </span>
          <div className="flex items-center gap-1.5">
            <button type="button" className="inline-flex h-7 items-center gap-1 rounded-control border border-hairline-strong bg-surface px-2.5 text-2xs font-semibold text-body transition-colors hover:bg-row-hover">
              Send reminder
            </button>
            <button type="button" className="inline-flex h-7 items-center gap-1 rounded-control border border-hairline-strong bg-surface px-2.5 text-2xs font-semibold text-body transition-colors hover:bg-row-hover">
              Export selected
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="inline-flex h-7 items-center rounded-control px-2 text-2xs font-medium text-subtle transition-colors hover:text-body">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Table — sticky thead, compact rows, coloured dot + label status. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {students.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-subtle">No students on the roster.</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-subtle">No students match these filters on this day.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-surface-sunken/60">
              <tr className="border-b border-hairline">
                <th className="w-10 px-3 py-1.5 text-left">
                  <input
                    ref={headerCbRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label={allSelected ? "Deselect all" : "Select all"}
                    className="size-4 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                  />
                </th>
                <th className="px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Student</th>
                <th className="w-40 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Batch</th>
                <th className="w-40 px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Status</th>
                <th className="px-3 py-1.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle">Reason</th>
                <th className="w-28 px-3 py-1.5 text-right text-2xs font-semibold uppercase tracking-wider text-subtle">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = String(r.id);
                const isSel = selected.has(id);
                return (
                  <tr
                    key={id}
                    className={`border-b border-hairline transition-colors last:border-0 ${isSel ? "bg-brand-100/40 dark:bg-brand-500/10" : "hover:bg-row-hover"}`}
                  >
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleOne(id)}
                        aria-label={`Select ${r.name}`}
                        className="size-4 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="min-w-0 truncate text-sm font-semibold text-heading">{r.name}</div>
                      {r.email && <div className="mt-0.5 truncate text-2xs text-subtle">{r.email}</div>}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {r.batch
                        ? <span className="truncate text-sm text-body">{r.batch}</span>
                        : <span className="text-xs text-faint">—</span>}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block size-1.5 shrink-0 rounded-full ${STATUS_DOT[r.status]}`} />
                        <span className={`truncate text-sm font-semibold ${STATUS_TONE[r.status]}`}>
                          {ST[r.status][1]}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 align-middle">
                      {r.reason
                        ? <span className="truncate text-xs text-body">{r.reason}</span>
                        : <span className="text-xs text-faint">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right align-middle">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 dark:text-brand-400">
                        View trend
                        <ChevronRight size={13} aria-hidden />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Daily register (single day) OR student×date matrix (range).
function AttRegister({ att, s }: { att: { students: any[]; records: any[] }; s: AttState }) {
  const { students, records } = att;
  const match = (r: any) => (s.batchF === "all" || r.batch === s.batchF) && (!s.q || r.name.toLowerCase().includes(s.q.toLowerCase()));

  if (s.mode === "single") {
    return <AttRegisterSingle students={students} records={records} s={s} match={match} />;
  }

  // range matrix
  const cols = Array.from(new Set(records.map((r) => String(r.date || "").slice(0, 10)).filter((dk) => dk && dk >= s.from && dk <= s.to))).sort();
  const map = new Map<string, Record<string, { st: string; reason: string }>>();
  records.forEach((r) => { const dk = String(r.date || "").slice(0, 10); if (!(dk >= s.from && dk <= s.to)) return; const sid = String(r.studentId); if (!map.has(sid)) map.set(sid, {}); map.get(sid)![dk] = { st: r.status, reason: r.reason || "" }; });
  const rows = students.filter(match);
  return (
    <div className="ldc-list ldc-sec ldc-listfill">
      <div className="ldc-list-h"><h2>Register grid · {s.from ? shortDate(s.from) : "—"} → {s.to ? shortDate(s.to) : "—"}</h2><span>{cols.length} day{cols.length === 1 ? "" : "s"} · {rows.length} students</span></div>
      {cols.length === 0 ? <div className="ldc-empty">No sessions in this date range.</div> : (
        <div className="ldc-scroll"><table className="ldc-mx">
          <thead><tr><th className="stick">Student</th>{cols.map((dk) => <th key={dk} className="c">{shortDate(dk)}</th>)}</tr></thead>
          <tbody>{rows.map((st, i) => (
            <tr key={i}><td className="stick"><b>{st.name}</b></td>
              {cols.map((dk) => { const cell = (map.get(st.id) || {})[dk]; const v = cell?.st; const title = v ? `${shortDate(dk)} · ${ST[v][1]}${cell.reason ? ` — ${cell.reason}` : ""}` : `${shortDate(dk)} · Not marked`; return <td key={dk} className="c"><span className={`ldc-mxc ${v ? ST[v][0] : "none"}`} title={title}>{v || "·"}</span></td>; })}
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

function AttSummary({ att, s }: { att: { students: any[]; records: any[] }; s: AttState }) {
  const inRange = (r: any) => { const dk = String(r.date || "").slice(0, 10); return dk >= s.from && dk <= s.to; };
  const c = computeAtt(att.students, att.records.filter(inRange));
  const rows = c.per.filter((r) => (s.batchF === "all" || r.batch === s.batchF) && (!s.q || r.name.toLowerCase().includes(s.q.toLowerCase())));
  // No sessions in range → don't render tiles that would read "0% · everyone at risk".
  if (c.sessions === 0) return <div className="ldc-empty"><b>No sessions in this range</b><span>No attendance was marked between the selected dates — widen the range above.</span></div>;
  return (
    <>
      <div className="ldc-strip">
        <div className="ldc-s"><span className="k">Avg attendance</span><b>{c.avgPct}%</b><i>across {att.students.length} student{att.students.length === 1 ? "" : "s"}</i></div>
        <div className="ldc-s"><span className="k">Students</span><b>{att.students.length}</b><i>{c.sessions} session{c.sessions === 1 ? "" : "s"} in range</i></div>
        <div className="ldc-s"><span className="k">Present marks</span><b>{c.P.toLocaleString()}</b><i>+ {c.H} half-day{c.H === 1 ? "" : "s"}</i></div>
        <div className="ldc-s"><span className="k">Below 75%</span><b className={c.atRisk ? "bad" : ""}>{c.atRisk}</b><i>{c.atRisk ? "attendance at risk" : "all above 75%"}</i></div>
      </div>
      <div className="ldc-list ldc-listfill">
        <div className="ldc-list-h"><h2>Attendance by student</h2><span>{rows.length} · lowest first</span></div>
        {c.sessions === 0 ? <div className="ldc-empty">No attendance marked in this date range.</div> : (
          <div className="ldc-scroll"><table>
            <thead><tr><th>Student</th><th className="r">Present</th><th className="r">Absent</th><th className="r">Half</th><th>Attendance</th></tr></thead>
            <tbody>{rows.map((st, i) => (
              <tr key={i}><td><b>{st.name}</b>{st.batch ? <small>{st.batch}</small> : null}</td>
                <td className="r">{st.P}</td><td className="r">{st.A}</td><td className="r">{st.H}</td>
                <td><span className="ldc-compbar"><i className={attBand(st.pct)} style={{ width: `${Math.max(2, Math.min(100, st.pct))}%` }} /></span> <b className="pctv">{st.pct}%</b></td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="ldc-empty">No students match these filters.</td></tr>}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}

function AttAnalyticsTab({ att, s }: { att: { students: any[]; records: any[] }; s: AttState }) {
  const inRange = (r: any) => { const dk = String(r.date || "").slice(0, 10); return dk >= s.from && dk <= s.to; };
  const c = computeAtt(att.students, att.records.filter(inRange));
  if (c.sessions === 0) return <div className="ldc-empty"><b>No sessions in range</b><span>No attendance was marked between the selected dates.</span></div>;
  const tot = c.totalCells || 1;
  const seg = [
    { label: "Present", c: "var(--good)", n: c.P }, { label: "Half-day", c: "var(--warn)", n: c.H },
    { label: "Absent", c: "var(--bad)", n: c.A }, { label: "Not marked", c: "#C9C1B8", n: c.N },
  ];
  return (
    <>
      <div className="ldc-strip">
        <div className="ldc-s"><span className="k">Avg attendance</span><b>{c.avgPct}%</b><i>{att.students.length} students · {c.sessions} sessions</i></div>
        <div className="ldc-s"><span className="k">Present rate</span><b>{Math.round(((c.P + c.H * 0.5) / tot) * 100)}%</b><i>{c.P + c.H} of {tot} marks</i></div>
        <div className="ldc-s"><span className="k">Sessions held</span><b>{c.sessions}</b><i>{c.totalCells} attendance cells</i></div>
        <div className="ldc-s"><span className="k">Below 75%</span><b className={c.atRisk ? "bad" : ""}>{c.atRisk}</b><i>of {att.students.length} students</i></div>
      </div>
      <div className="ldc-grid2 ldc-gap16 ldc-sec">
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Attendance breakdown</h2><span>{tot} marks</span></div>
          <div className="ldc-stack">{seg.map((b) => b.n > 0 ? <i key={b.label} title={`${b.label} ${b.n}`} style={{ width: `${(b.n / tot) * 100}%`, background: b.c }} /> : null)}</div>
          <div className="ldc-distrows">{seg.map((b) => (
            <div className="ldc-distrow" key={b.label}><span className="dot" style={{ background: b.c }} /><span className="lb">{b.label}</span><span className="ct">{b.n.toLocaleString()}</span><span className="sh">{Math.round((b.n / tot) * 100)}%</span></div>
          ))}</div>
        </div>
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Highlights</h2></div>
          <div className="ldc-distrows">
            <div className="ldc-distrow"><span className="lb">Best-attended day</span><span className="sh" style={{ flexBasis: "auto", color: "var(--ink)", fontWeight: 700 }}>{c.best ? `${shortDate(c.best.dk)} · ${Math.round(c.best.ratio)}%` : "—"}</span></div>
            <div className="ldc-distrow"><span className="lb">Students at risk (&lt;75%)</span><span className="sh" style={{ flexBasis: "auto", color: c.atRisk ? "var(--bad)" : "var(--good-ink)", fontWeight: 700 }}>{c.atRisk}</span></div>
            <div className="ldc-distrow"><span className="lb">Fully present students</span><span className="sh" style={{ flexBasis: "auto", color: "var(--ink)", fontWeight: 700 }}>{c.per.filter((x) => x.pct >= 100).length}</span></div>
          </div>
          <p className="ldc-note">Attendance % = (present + half-day×0.5) ÷ sessions held. “Not marked” = days with no record for that student.</p>
        </div>
      </div>
    </>
  );
}

function AttendanceView({ filter }: { filter: ViewFilter }) {
  // The portfolio table is the whole Attendance page in the LD Console. The
  // outer Client/Course filters narrow its rows; clicking `View` on a row
  // navigates to the standalone Attendance Management route (which owns the
  // Management / Report / Analytics tab strip for that course).
  return (
    <div className="ldc-attfill">
      <Head eyebrow="" title="Attendance" right={<ScopeFilters f={filter} />} />
      <AttPortfolio filter={filter} />
    </div>
  );
}

/* ───────── Reports ───────── */
/* ═══════════════════════════ REPORTS ═══════════════════════════
   Five printable report pages (Reports ▸ … in the rail). Shared rules:
   - One filter row (Client/Course) in the Head's right slot; every number,
     chart, and table below re-derives from the same scoped slice.
   - Charts are plain SVG/CSS on the ldc variables (dark mode automatic) and
     print exactly as rendered; the palette lives in --ch1..--ch5.
   - Print = window.print(); the @media print block at the end of LDC_CSS
     unshells the page (no rail/bell/filters) and unclips every scroller.
   - Every chart's numbers also exist in a table — nothing is color-gated. */

const CH = ["var(--ch1)", "var(--ch2)", "var(--ch3)", "var(--ch4)", "var(--ch5)"];
/* One-hue ramp (brand orange) for ordered bands — darkest = strongest. */
const RAMP = ["#b8441f", "#eb6834", "#f28c52", "#f8c5a8"];

const fmtDay = (v?: string | Date | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
};
/* LOCAL calendar day — toISOString() is the UTC day, which east of UTC reports
   yesterday until mid-morning and made "marked today" lie. */
const localDay = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/* True while the Print pipeline is snapshotting the page — tables render ALL
   filtered rows (not just the visible page) so paper gets the full set. */
const RPrintCtx = createContext(false);

/* Print exactly like the review-submission report does: build a purpose-made
   HTML document and print it from a hidden iframe (popup blockers never fire
   on iframes). The document embeds LDC_CSS with the LIGHT variable set, so
   charts/chips print in full colour regardless of the on-screen theme, and
   interactive chrome (filters, pagination, buttons) is stripped. */
function printReportHtml(title: string, scope: string, inner: string) {
  const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${esc(title)}</title>
<style>
  :root{color-scheme:light;}
  *{box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
  body{font-family:'Poppins','Segoe UI',-apple-system,sans-serif; color:#111827; margin:0; padding:20px 24px; background:#fff;}
  .ldx{--page:#ffffff; --surface:#ffffff; --ink:#111827; --ink2:#374151; --muted:#6B7280; --grid:#EAECF0;
       --border:#E4E7EC; --accent:#F97316; --good:#16a34a; --good-ink:#15803d; --warn:#d97706; --bad:#dc2626;
       --sh:none; --ch1:#eb6834; --ch2:#2a78d6; --ch3:#1baf7a; --ch4:#eda100; --ch5:#4a3aa7;}
  h1{font-size:18px; margin:0 0 2px; letter-spacing:-0.02em;}
  .pmeta{font-size:11px; color:#555; margin:0 0 14px; padding-bottom:8px; border-bottom:1px solid #ddd;}
  ${LDC_CSS}
  .ldr-filters, .ldr-pgn, .ldr-search, .ldc-btn, .ldx-add, .ldr-x, .ldr-toolbar, .ldr-mp-panel{display:none !important;}
  .ldr-doc{border:none; box-shadow:none; padding:0;}
  .ldc-scroll{max-height:none; overflow:visible;}
  .ldc-list, .ldc-panel{break-inside:avoid; box-shadow:none;}
  .ldc-list .ldc-scroll table thead th{position:static;}
  tr{break-inside:avoid;}
  @media print{ body{padding:10px 12px;} }
</style></head>
<body><div class="ldx"><h1>${esc(title)}</h1><div class="pmeta">${esc(scope)} · Generated ${esc(new Date().toLocaleString("en-GB"))}</div>${inner}</div></body></html>`;
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0"; iframe.style.bottom = "0";
  iframe.style.width = "0"; iframe.style.height = "0"; iframe.style.border = "0";
  document.body.appendChild(iframe);
  const cleanup = () => { setTimeout(() => { iframe.remove(); }, 1000); };
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) { iframe.remove(); return; }
  doc.open(); doc.write(html); doc.close();
  const win = iframe.contentWindow;
  if (!win) { iframe.remove(); return; }
  win.onafterprint = cleanup;
  setTimeout(() => {
    try { win.focus(); win.print(); } catch { /* print dialog refused */ }
    setTimeout(cleanup, 30000); // safety net if onafterprint never fires
  }, 200);
}

/* Header + scope pickers + Print. Printing flips RPrintCtx first so every
   table renders its FULL filtered set, then snapshots this shell's content. */
function ReportShell({ title, sub, f, client = true, course = true, actions, children }: {
  title: string; sub: string; f: ViewFilter; client?: boolean; course?: boolean; actions?: ReactNode; children: ReactNode;
}) {
  const [printing, setPrinting] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const courseName = f.courseOpts.find((c) => c.id === f.course)?.name;
  const scope = scopeLabel(f, courseName) || "All clients · all courses";
  const doPrint = () => {
    setPrinting(true);
    // Let React commit the all-rows render before snapshotting.
    setTimeout(() => {
      if (boxRef.current) printReportHtml(title, scope, boxRef.current.innerHTML);
      setPrinting(false);
    }, 150);
  };
  return (
    <>
      <Head
        title={title}
        sub={sub}
        right={
          <>
            <ScopeFilters f={f} client={client} course={course} />
            {actions}
            <button className="ldc-btn go" type="button" onClick={doPrint} title="Print this report">
              <Printer size={13} style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }} />Print
            </button>
          </>
        }
      />
      <RPrintCtx.Provider value={printing}>
        <div ref={boxRef}>{children}</div>
      </RPrintCtx.Provider>
    </>
  );
}

/* Inline stats line — the review-submission report's listing style:
   `Total: 45 | Absent: 3 | …`, labels muted, values bold and tone-colored. */
function RStats({ items }: { items: { k: string; v: ReactNode; tone?: "good" | "warn" | "bad"; hint?: string }[] }) {
  return (
    <div className="ldr-stats">
      {items.map((it, i) => (
        <span key={i} className="ldr-stat" title={it.hint}>
          {i > 0 ? <em className="sep">|</em> : null}
          <span className="lab">{it.k}:</span> <b className={it.tone || ""}>{it.v}</b>
        </span>
      ))}
    </div>
  );
}

/* ── Chart primitives (SVG/CSS, ldr- classes) ─────────────────────────── */

type BarRow = { label: string; sub?: string; value: number; color?: string };
function BarList({ rows, fmt = (v: number) => String(v), color = "var(--ch1)", max: maxIn }: {
  rows: BarRow[]; fmt?: (v: number) => string; color?: string; max?: number;
}) {
  if (!rows.length) return <div className="ldc-empty">Nothing in this scope yet</div>;
  const max = maxIn ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="ldr-bars">
      {rows.map((r, i) => (
        <div key={i} className="ldr-bar" title={`${r.label}${r.sub ? ` (${r.sub})` : ""}: ${fmt(r.value)}`}>
          <span className="ldr-bar-l">{r.label}{r.sub ? <small> · {r.sub}</small> : null}</span>
          <span className="ldr-track"><span className="ldr-fill" style={{ width: `${Math.min(100, (r.value / max) * 100)}%`, background: r.color || color }} /></span>
          <b className="ldr-bar-v">{fmt(r.value)}</b>
        </div>
      ))}
    </div>
  );
}

/* Horizontal stacked bars (e.g. I Do / We Do / You Do hours) — 2px surface
   gaps between segments, legend on top, total direct-labeled. */
function StackList({ rows, keys, colors, fmt }: {
  rows: { label: string; parts: number[] }[]; keys: string[]; colors: string[]; fmt: (v: number) => string;
}) {
  if (!rows.length) return <div className="ldc-empty">Nothing in this scope yet</div>;
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((s, x) => s + x, 0)));
  return (
    <div className="ldr-bars">
      <div className="ldr-legendrow">
        {keys.map((k, i) => <span key={k} className="ldr-leg"><span className="ldr-dot" style={{ background: colors[i] }} />{k}</span>)}
      </div>
      {rows.map((r, i) => {
        const tot = r.parts.reduce((s, x) => s + x, 0);
        return (
          <div key={i} className="ldr-bar">
            <span className="ldr-bar-l">{r.label}</span>
            <span className="ldr-track ldr-stack">
              {r.parts.map((p, j) => p > 0
                ? <span key={j} className="ldr-fill" style={{ width: `${(p / max) * 100}%`, background: colors[j] }} title={`${keys[j]}: ${fmt(p)}`} />
                : null)}
            </span>
            <b className="ldr-bar-v">{fmt(tot)}</b>
          </div>
        );
      })}
    </div>
  );
}

/* Small vertical columns — distributions with few buckets (each column carries
   its value because there is no y-axis). */
function ColChart({ rows, fmt = (v: number) => String(v), color = "var(--ch1)" }: {
  rows: BarRow[]; fmt?: (v: number) => string; color?: string;
}) {
  if (!rows.length) return <div className="ldc-empty">Nothing in this scope yet</div>;
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="ldr-cols">
      {rows.map((r, i) => (
        <div key={i} className="ldr-col" title={`${r.label}: ${fmt(r.value)}`}>
          <b>{fmt(r.value)}</b>
          <span className="ldr-coltrack"><span className="ldr-colfill" style={{ height: `${Math.max(r.value > 0 ? 3 : 0, (r.value / max) * 100)}%`, background: r.color || color }} /></span>
          <span className="ldr-collab">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

/* SVG donut for part-to-whole (≤6 segments), 2px surface gaps, legend with
   values beside it — the legend is the identity channel, color only assists.
   (RDonut: the dashboard already has its own `Donut` with another signature.) */
function RDonut({ segs, center, sub }: { segs: { label: string; value: number; color: string }[]; center: string; sub?: string }) {
  const live = segs.filter((s) => s.value > 0);
  const total = segs.reduce((s, x) => s + x.value, 0);
  const R = 40, C = 2 * Math.PI * R;
  const gap = live.length > 1 ? 2.5 : 0;
  let acc = 0;
  return (
    <div className="ldr-donutwrap">
      <svg viewBox="0 0 100 100" className="ldr-donut" role="img" aria-label={`${center}${sub ? ` ${sub}` : ""}`}>
        <circle cx="50" cy="50" r={R} fill="none" stroke="var(--grid)" strokeWidth="12" />
        <g transform="rotate(-90 50 50)">
          {total > 0 && segs.map((s, i) => {
            if (s.value <= 0) return null;
            const frac = s.value / total;
            const len = Math.max(0.5, frac * C - gap);
            const el = <circle key={i} cx="50" cy="50" r={R} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc * C} />;
            acc += frac;
            return el;
          })}
        </g>
        <text x="50" y={sub ? 48 : 54} textAnchor="middle" className="ldr-donut-n">{center}</text>
        {sub ? <text x="50" y="62" textAnchor="middle" className="ldr-donut-s">{sub}</text> : null}
      </svg>
      <div className="ldr-legend">
        {segs.map((s, i) => (
          <div key={i} className="ldr-leg"><span className="ldr-dot" style={{ background: s.color }} />{s.label}<b>{s.value}</b></div>
        ))}
      </div>
    </div>
  );
}

/* SVG trend line — 2px line, 10% area wash, ringed end-dot with a direct
   label; per-point <title> tooltips; sparse x labels. */
function TrendLine({ points, fmt = (v: number) => `${v}%`, yMax: yMaxIn }: {
  points: { label: string; value: number; detail?: string }[]; fmt?: (v: number) => string; yMax?: number;
}) {
  if (!points.length) return <div className="ldc-empty">Nothing in this scope yet</div>;
  const W = 560, H = 150, PT = 14, PR = 48, PB = 22, PL = 8;
  const yMax = yMaxIn ?? Math.max(1, ...points.map((p) => p.value));
  const iw = W - PL - PR, ih = H - PT - PB;
  const x = (i: number) => PL + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => PT + ih - (Math.min(v, yMax) / yMax) * ih;
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(PT + ih).toFixed(1)} L${x(0).toFixed(1)},${(PT + ih).toFixed(1)} Z`;
  const last = points[points.length - 1];
  const step = Math.max(1, Math.ceil(points.length / 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ldr-trend" role="img" aria-label={`Trend, latest ${fmt(last.value)}`}>
      <line x1={PL} y1={PT + ih} x2={W - PR} y2={PT + ih} className="ldr-axis" />
      <path d={area} fill="var(--ch1)" opacity="0.1" />
      <path d={line} fill="none" stroke="var(--ch1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.value)} r="9" fill="transparent">
          <title>{`${p.label}: ${fmt(p.value)}${p.detail ? ` — ${p.detail}` : ""}`}</title>
        </circle>
      ))}
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="4.5" fill="var(--ch1)" stroke="var(--surface)" strokeWidth="2" />
      <text x={x(points.length - 1) + 7} y={y(last.value) + 4} className="ldr-tl">{fmt(last.value)}</text>
      {points.map((p, i) => (i % step === 0 || i === points.length - 1)
        ? <text key={`x${i}`} x={x(i)} y={H - 6} textAnchor="middle" className="ldr-tx">{p.label}</text>
        : null)}
    </svg>
  );
}

/* ── Sortable report table — the review-submission report's listing pattern:
   a flat labeled filter row (search + native selects) above the card, sticky
   headers, and a pagination footer ("Showing X to Y of Z" · rows per page ·
   windowed page numbers). While printing, ALL filtered rows render. ────── */

type RCol<T> = {
  k: string; h: string; r?: boolean;
  render?: (row: T) => ReactNode;
  sv?: (row: T) => number | string;
};
type RFilterDef<T> = {
  key: string;
  label: string;
  /** First option should be the "all" entry, value "all". */
  options: { value: string; label: string }[];
  match: (row: T, v: string) => boolean;
};

// Windowed page list, e.g. [1, '…', 4, 5, 6, '…', 12] (same as the
// review-submission report).
function buildPageItems(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) items.push("…");
  for (let i = start; i <= end; i++) items.push(i);
  if (end < total - 1) items.push("…");
  items.push(total);
  return items;
}

function RTable<T extends Record<string, any>>({ title, rows, cols, init, initDir = "desc", searchKeys, unit = "rows", filterDefs, emptyAll = "Nothing in this scope", emptyMatch = "Nothing matches this filter" }: {
  title: string; rows: T[]; cols: RCol<T>[]; init?: string; initDir?: "asc" | "desc"; searchKeys?: string[]; unit?: string;
  filterDefs?: RFilterDef<T>[]; emptyAll?: string; emptyMatch?: string;
}) {
  const printing = useContext(RPrintCtx);
  const [sort, setSort] = useState<string>(init ?? "");
  const [dir, setDir] = useState<1 | -1>(initDir === "asc" ? 1 : -1);
  const [q, setQ] = useState("");
  const [fsel, setFsel] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const filtered = useMemo(() => {
    let r = rows;
    (filterDefs || []).forEach((fd) => {
      const v = fsel[fd.key] || "all";
      if (v !== "all") r = r.filter((row) => fd.match(row, v));
    });
    if (q.trim() && searchKeys?.length) {
      const t = q.trim().toLowerCase();
      r = r.filter((row) => searchKeys.some((k) => String(row[k] ?? "").toLowerCase().includes(t)));
    }
    if (sort) {
      const col = cols.find((c) => c.k === sort);
      const sv = col?.sv ?? ((row: any) => row[sort]);
      r = [...r].sort((a, b) => {
        const va = sv(a), vb = sv(b);
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
        return String(va ?? "").localeCompare(String(vb ?? "")) * dir;
      });
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, sort, dir, fsel]);

  // A filter change may strand the user on a page that no longer exists.
  useEffect(() => { setPage(1); }, [q, fsel, perPage]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * perPage;
  const pageRows = printing ? filtered : filtered.slice(startIdx, startIdx + perPage);
  const pageItems = buildPageItems(safePage, totalPages);
  const click = (k: string) => {
    if (sort === k) setDir((d) => (d === 1 ? -1 : 1));
    else { setSort(k); setDir(-1); }
  };
  const hasControls = !!searchKeys?.length || !!filterDefs?.length;
  return (
    <>
      {hasControls ? (
        <div className="ldr-filters">
          {searchKeys?.length ? (
            <span className="ldr-searchwrap">
              <Search size={12} />
              <input className="ldr-search" type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label={`Search ${title}`} />
            </span>
          ) : null}
          {(filterDefs || []).map((fd) => (
            <label key={fd.key} className="ldr-flab">
              {fd.label}:
              <select className="ldr-sel" value={fsel[fd.key] || "all"} onChange={(e) => setFsel((p) => ({ ...p, [fd.key]: e.target.value }))}>
                {fd.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
      ) : null}
      <div className="ldc-list">
        <div className="ldc-list-h">
          <h2>{title}</h2>
          <span>{filtered.length} {unit}</span>
        </div>
        <div className="ldc-scroll">
          <table>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c.k} className={`${c.r ? "r " : ""}ldr-th`} onClick={() => click(c.k)} title="Sort">
                    {c.h}{sort === c.k ? <span className="ldr-arrow">{dir === 1 ? "▲" : "▼"}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={startIdx + i}>
                  {cols.map((c) => (
                    <td key={c.k} className={c.r ? "r" : undefined}>{c.render ? c.render(row) : String(row[c.k] ?? "—")}</td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr><td colSpan={cols.length}><div className="ldc-empty">{rows.length === 0 ? emptyAll : emptyMatch}</div></td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {!printing && filtered.length > 0 ? (
          <div className="ldr-pgn">
            <span className="ldr-pgn-info">
              Showing {startIdx + 1} to {Math.min(startIdx + perPage, filtered.length)} of {filtered.length} {unit}
            </span>
            <span className="ldr-pgn-ctl">
              <label className="ldr-flab">Rows per page:
                <select className="ldr-sel" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                  {[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <span className="ldr-pgn-pages">
                <button type="button" className="ldr-pbtn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage === 1} aria-label="Previous page"><ChevronLeft size={14} /></button>
                {pageItems.map((p, idx) => p === "…"
                  ? <span key={`e${idx}`} className="ldr-pdots">…</span>
                  : <button key={p} type="button" className={`ldr-pbtn num ${p === safePage ? "on" : ""}`} onClick={() => setPage(p)}>{p}</button>)}
                <button type="button" className="ldr-pbtn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} aria-label="Next page"><ChevronRight size={14} /></button>
              </span>
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}

const attTone = (p: number): StatusTone => (p >= 75 ? "success" : p >= 50 ? "warning" : "danger");

/* ═════════ 1 · Performance Report — customizable report builder ═════════
   Built on the SAME per-student rows the Student Progress list shows (solved
   I Do / We Do / You Do per learner). The L&D head narrows the scope (client /
   course / individual students), hits Generate, ticks in the modal what the
   document should contain (summary, pie charts, graphs, tables + which student
   columns), can drop any section from the preview with its ×, and downloads
   the result as Excel or PDF. Print keeps working on the generated preview. */

type PerfDocCfg = { secs: Record<string, boolean>; cols: Record<string, boolean>; status: string };

const PERF_SECTIONS: { key: string; label: string; hint: string }[] = [
  { key: "stats", label: "Summary stats", hint: "Courses, students, averages, at-risk counts" },
  { key: "pie", label: "Performance distribution (pie)", hint: "Students by overall progress band" },
  { key: "split", label: "Status split (pie)", hint: "Completed / in progress / at risk / not started" },
  { key: "funnel", label: "Pedagogy funnel (graph)", hint: "Mean I Do / We Do / You Do completion" },
  { key: "courses", label: "Courses by progress (graph)", hint: "Average progress per course" },
  { key: "courseTable", label: "Course summary table", hint: "Per-course students, progress and status counts" },
  { key: "studentTable", label: "Student table", hint: "One row per student per course — pick columns" },
];

const PERF_STATUS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "done", label: "Completed (≥80%)" },
  { value: "prog", label: "In progress (50–79%)" },
  { value: "risk", label: "At risk (<50%)" },
  { value: "not", label: "Not started" },
];
const perfStatusMatch = (r: any, v: string) =>
  v === "done" ? r.overall >= 80 :
  v === "prog" ? r.overall >= 50 && r.overall < 80 :
  v === "risk" ? r.overall > 0 && r.overall < 50 :
  v === "not" ? r.overall === 0 : true;

const perfDefaultCfg = (): PerfDocCfg => ({
  secs: { stats: true, pie: true, split: false, funnel: true, courses: true, courseTable: true, studentTable: true },
  cols: { course: true, client: true, email: false, overall: true, iDo: true, weDo: true, youDo: true, score: true, last: true },
  status: "all",
});

/* One definition per column, shared by the preview table (`cell`), Excel and
   PDF (`v`); `w` = Excel column width, `pw` = PDF width weight. Keeping them
   in a single list is what stops screen and downloads drifting apart. */
type PerfCol = { key: string; h: string; r?: boolean; w: number; pw: number; cell: (r: any) => ReactNode; v: (r: any) => string | number };
const PERF_SCOLS: PerfCol[] = [
  { key: "name", h: "Student", w: 26, pw: 1.6, cell: (r) => <b>{r.name}</b>, v: (r) => r.name },
  { key: "course", h: "Course", w: 24, pw: 1.4, cell: (r) => r.course, v: (r) => r.course },
  { key: "client", h: "Client", w: 18, pw: 1.0, cell: (r) => r.client, v: (r) => r.client },
  { key: "email", h: "Email", w: 28, pw: 1.5, cell: (r) => r.email || "—", v: (r) => r.email || "" },
  { key: "overall", h: "Overall %", r: true, w: 11, pw: 0.62, cell: (r) => <StatusChip tone={r.overall >= 80 ? "success" : r.overall > 0 && r.overall < 50 ? "danger" : r.overall === 0 ? "neutral" : "brand"}>{pct(r.overall)}</StatusChip>, v: (r) => r.overall },
  { key: "iDo", h: "I Do %", r: true, w: 9, pw: 0.55, cell: (r) => (r.iDo === null ? "N/A" : pct(r.iDo)), v: (r) => (r.iDo === null ? "N/A" : r.iDo) },
  { key: "weDo", h: "We Do %", r: true, w: 10, pw: 0.58, cell: (r) => (r.weDo === null ? "N/A" : pct(r.weDo)), v: (r) => (r.weDo === null ? "N/A" : r.weDo) },
  { key: "youDo", h: "You Do %", r: true, w: 10, pw: 0.6, cell: (r) => (r.youDo === null ? "N/A" : pct(r.youDo)), v: (r) => (r.youDo === null ? "N/A" : r.youDo) },
  { key: "score", h: "Score %", r: true, w: 10, pw: 0.55, cell: (r) => (r.score === null ? "—" : pct(r.score)), v: (r) => (r.score === null ? "—" : r.score) },
  { key: "last", h: "Last active", w: 13, pw: 0.85, cell: (r) => r.last, v: (r) => r.last },
];
const PERF_CCOLS: PerfCol[] = [
  { key: "name", h: "Course", w: 30, pw: 1.9, cell: (r) => <b>{r.name}</b>, v: (r) => r.name },
  { key: "client", h: "Client", w: 20, pw: 1.1, cell: (r) => r.client, v: (r) => r.client },
  { key: "students", h: "Students", r: true, w: 10, pw: 0.6, cell: (r) => r.students, v: (r) => r.students },
  { key: "avg", h: "Avg progress %", r: true, w: 15, pw: 0.85, cell: (r) => pct(r.avg), v: (r) => r.avg },
  { key: "done", h: "Completed", r: true, w: 11, pw: 0.7, cell: (r) => r.done, v: (r) => r.done },
  { key: "prog", h: "In progress", r: true, w: 12, pw: 0.7, cell: (r) => r.prog, v: (r) => r.prog },
  { key: "not", h: "Not started", r: true, w: 12, pw: 0.7, cell: (r) => r.not, v: (r) => r.not },
];

const perfMeanOf = (vals: (number | null)[]) => {
  const xs = vals.filter((v): v is number => v !== null);
  return xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : null;
};

/* Everything the charts/stats need, from whatever student slice is in play —
   the same function feeds the live page, the preview and both downloads. */
function buildPerfModel(studs: any[]) {
  const funnel = [
    { label: "I Do", value: perfMeanOf(studs.map((s) => s.iDo)) ?? 0 },
    { label: "We Do", value: perfMeanOf(studs.map((s) => s.weDo)) ?? 0 },
    { label: "You Do", value: perfMeanOf(studs.map((s) => s.youDo)) ?? 0 },
  ];
  const buckets = [
    { label: "Excellent (≥80%)", value: studs.filter((s) => s.overall >= 80).length, color: RAMP[0] },
    { label: "Good (60–79%)", value: studs.filter((s) => s.overall >= 60 && s.overall < 80).length, color: RAMP[1] },
    { label: "Average (40–59%)", value: studs.filter((s) => s.overall >= 40 && s.overall < 60).length, color: RAMP[2] },
    { label: "Poor (<40%)", value: studs.filter((s) => s.overall < 40).length, color: RAMP[3] },
  ];
  const completed = studs.filter((s) => s.overall >= 80).length;
  const atRisk = studs.filter((s) => s.overall > 0 && s.overall < 50).length;
  const notStarted = studs.filter((s) => s.overall === 0).length;
  const split = [
    { label: "Completed (≥80%)", value: completed, color: "#1baf7a" },
    { label: "In progress (50–79%)", value: studs.filter((s) => s.overall >= 50 && s.overall < 80).length, color: "#2a78d6" },
    { label: "At risk (<50%)", value: atRisk, color: "#dc2626" },
    { label: "Not started", value: notStarted, color: "#98a2b3" },
  ];
  const avg = studs.length ? Math.round(studs.reduce((s, x) => s + x.overall, 0) / studs.length) : 0;
  const avgScore = perfMeanOf(studs.map((s) => s.score));
  return { funnel, buckets, split, stats: { students: studs.length, avg, avgScore, completed, atRisk, notStarted } };
}

/* Server course stats can't be re-derived once a student subset is picked, so
   the course table is rebuilt from the very rows the document contains. */
function aggCourses(studs: any[]) {
  const by = new Map<string, any>();
  studs.forEach((s) => {
    let c = by.get(s.courseId);
    if (!c) { c = { id: s.courseId, name: s.course, client: s.client, students: 0, sum: 0, done: 0, prog: 0, not: 0 }; by.set(s.courseId, c); }
    c.students += 1; c.sum += s.overall;
    if (s.overall >= 80) c.done += 1; else if (s.overall === 0) c.not += 1; else c.prog += 1;
  });
  return [...by.values()].map(({ sum, ...c }) => ({ ...c, avg: c.students ? Math.round(sum / c.students) : 0 }));
}

type PerfDocModel = {
  scope: string; statusLabel: string;
  stats: { courses: number; students: number; avg: number; avgScore: number | null; completed: number; atRisk: number; notStarted: number };
  funnel: { label: string; value: number }[];
  buckets: { label: string; value: number; color: string }[];
  split: { label: string; value: number; color: string }[];
  courses: any[];
  students: any[];
};

/* ── Downloads (exceljs / jspdf loaded on demand — they never join the page
   bundle for heads who only read the report on screen) ───────────────────── */

async function exportPerfExcel(cfg: PerfDocCfg, m: PerfDocModel) {
  const [xl, fsv] = await Promise.all([import("exceljs"), import("file-saver")]);
  const ExcelJS: any = (xl as any).default ?? xl;
  const saveAs: (b: Blob, name: string) => void = (fsv as any).saveAs ?? (fsv as any).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "EduLMS";
  wb.created = new Date();
  const header: any = {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 11 },
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFEB6834" } },
    alignment: { vertical: "middle", horizontal: "left" },
  };
  const bordered: any = {
    font: { size: 11 },
    border: {
      top: { style: "thin", color: { argb: "FFF3F4F6" } },
      bottom: { style: "thin", color: { argb: "FFF3F4F6" } },
      left: { style: "thin", color: { argb: "FFF3F4F6" } },
      right: { style: "thin", color: { argb: "FFF3F4F6" } },
    },
  };
  const s = cfg.secs;
  const block = (ws: any, head: [string, string], rows: [string, string | number][]) => {
    ws.addRow([]);
    const h = ws.addRow(head);
    h.eachCell((c: any) => (c.style = header));
    rows.forEach((r) => { const row = ws.addRow(r); row.eachCell((c: any) => (c.style = bordered)); });
  };
  if (s.stats || s.pie || s.split || s.funnel || s.courses) {
    const ws = wb.addWorksheet("Summary");
    ws.columns = [{ width: 34 }, { width: 32 }];
    ws.addRow(["Performance Report"]).getCell(1).style = { font: { bold: true, size: 13 } };
    ws.addRow(["Scope", m.scope]);
    ws.addRow(["Students included", m.statusLabel]);
    ws.addRow(["Generated", new Date().toLocaleString("en-GB")]);
    if (s.stats) block(ws, ["Metric", "Value"], [
      ["Courses", m.stats.courses],
      ["Students", m.stats.students],
      ["Average progress", `${m.stats.avg}%`],
      ["Average score", m.stats.avgScore === null ? "—" : `${m.stats.avgScore}%`],
      ["Completed (≥80%)", m.stats.completed],
      ["At risk (<50%)", m.stats.atRisk],
      ["Not started", m.stats.notStarted],
    ]);
    if (s.pie) block(ws, ["Progress band", "Students"], m.buckets.map((b) => [b.label, b.value] as [string, number]));
    if (s.split) block(ws, ["Status", "Students"], m.split.map((b) => [b.label, b.value] as [string, number]));
    if (s.funnel) block(ws, ["Stage", "Mean completion"], m.funnel.map((x) => [x.label, `${x.value}%`] as [string, string]));
    if (s.courses) block(ws, ["Course", "Average progress"], m.courses.map((c) => [`${c.name} · ${c.client}`, `${c.avg}%`] as [string, string]));
  }
  const sheetOf = (name: string, defs: PerfCol[], rows: any[]) => {
    const ws = wb.addWorksheet(name);
    ws.columns = defs.map((d) => ({ header: d.h, key: d.key, width: d.w }));
    const hr = ws.getRow(1);
    hr.height = 22;
    hr.eachCell((c: any) => (c.style = header));
    rows.forEach((r) => { const row = ws.addRow(defs.map((d) => d.v(r))); row.eachCell((c: any) => (c.style = bordered)); });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: defs.length } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };
  if (s.courseTable) sheetOf("Courses", PERF_CCOLS, m.courses);
  if (s.studentTable) sheetOf("Students", PERF_SCOLS.filter((c) => c.key === "name" || cfg.cols[c.key]), m.students);
  const buf = await wb.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `performance-report_${localDay()}.xlsx`);
}

async function exportPerfPdf(cfg: PerfDocCfg, m: PerfDocModel) {
  const { default: jsPDF } = await import("jspdf");
  // Landscape once the student table is in — up to 10 columns never fit portrait.
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: cfg.secs.studentTable ? "landscape" : "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 36;
  let y = M;
  const hex = (h: string): [number, number, number] => {
    const v = h.replace("#", "");
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  };
  const ensure = (need: number) => { if (y + need > pageH - M) { doc.addPage(); y = M; } };
  const rule = () => { ensure(8); doc.setDrawColor(229, 231, 235); doc.setLineWidth(0.5); doc.line(M, y, pageW - M, y); y += 12; };
  const h2 = (t: string) => { ensure(24); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(17, 24, 39); doc.text(t, M, y); y += 14; };
  const barRow = (label: string, frac: number, val: string, color: string) => {
    ensure(16);
    const lw = 170, vw = 62, bx = M + lw, bw = pageW - M - vw - bx;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(55, 65, 81);
    doc.text(doc.splitTextToSize(label, lw - 8)[0] ?? "", M, y + 7);
    doc.setFillColor(243, 244, 246);
    doc.roundedRect(bx, y, bw, 9, 3, 3, "F");
    if (frac > 0) {
      const [r, g, b] = hex(color);
      doc.setFillColor(r, g, b);
      doc.roundedRect(bx, y, Math.max(4, Math.min(1, frac) * bw), 9, 3, 3, "F");
    }
    doc.setFont("helvetica", "bold"); doc.setTextColor(17, 24, 39);
    doc.text(val, pageW - M, y + 7, { align: "right" });
    y += 16;
  };
  const table = (defs: PerfCol[], rows: any[]) => {
    const avail = pageW - 2 * M;
    const tot = defs.reduce((acc, d) => acc + d.pw, 0);
    const ws = defs.map((d) => (d.pw / tot) * avail);
    const head = () => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(107, 114, 128);
      let x = M;
      defs.forEach((d, i) => { doc.text(d.h, d.r ? x + ws[i] - 2 : x, y, { align: d.r ? "right" : "left" }); x += ws[i]; });
      y += 4;
      doc.setDrawColor(229, 231, 235); doc.line(M, y, pageW - M, y);
      y += 10;
    };
    ensure(30);
    head();
    rows.forEach((r) => {
      if (y + 13 > pageH - M) { doc.addPage(); y = M; head(); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(31, 41, 55);
      let x = M;
      defs.forEach((d, i) => {
        doc.text(doc.splitTextToSize(String(d.v(r) ?? ""), ws[i] - 6)[0] ?? "", d.r ? x + ws[i] - 2 : x, y, { align: d.r ? "right" : "left" });
        x += ws[i];
      });
      y += 13;
    });
    y += 6;
  };
  const s = cfg.secs;

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(17, 24, 39);
  doc.text("Performance Report", M, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(107, 114, 128);
  doc.text(`${m.scope}   ·   ${m.statusLabel}   ·   Generated ${new Date().toLocaleString("en-GB")}`, M, y); y += 12;
  rule();

  if (s.stats) {
    h2("Summary");
    doc.setFontSize(10);
    ([
      ["Courses", String(m.stats.courses)],
      ["Students", String(m.stats.students)],
      ["Average progress", `${m.stats.avg}%`],
      ["Average score", m.stats.avgScore === null ? "—" : `${m.stats.avgScore}%`],
      ["Completed (≥80%)", String(m.stats.completed)],
      ["At risk (<50%)", String(m.stats.atRisk)],
      ["Not started", String(m.stats.notStarted)],
    ] as [string, string][]).forEach(([k, v]) => {
      ensure(15);
      doc.setFont("helvetica", "normal"); doc.setTextColor(107, 114, 128); doc.text(k, M, y);
      doc.setFont("helvetica", "bold"); doc.setTextColor(17, 24, 39); doc.text(v, M + 170, y);
      y += 14;
    });
    y += 2; rule();
  }
  const pieBlock = (title: string, segs: { label: string; value: number; color: string }[]) => {
    h2(title);
    const total = segs.reduce((acc, b) => acc + b.value, 0) || 1;
    segs.forEach((b) => barRow(b.label, b.value / total, `${b.value} (${Math.round((b.value / total) * 100)}%)`, b.color));
    y += 2; rule();
  };
  if (s.pie) pieBlock("Performance distribution", m.buckets);
  if (s.split) pieBlock("Status split", m.split);
  if (s.funnel) {
    h2("Pedagogy funnel — mean completion");
    m.funnel.forEach((x) => barRow(x.label, x.value / 100, `${x.value}%`, "#eb6834"));
    y += 2; rule();
  }
  if (s.courses) {
    h2("Courses by average progress");
    [...m.courses].sort((a, b) => b.avg - a.avg).slice(0, 15).forEach((c) => barRow(`${c.name} · ${c.client}`, c.avg / 100, `${c.avg}%`, "#2a78d6"));
    y += 2; rule();
  }
  if (s.courseTable) { h2(`Course summary (${m.courses.length})`); table(PERF_CCOLS, m.courses); rule(); }
  if (s.studentTable) { h2(`Students (${m.students.length})`); table(PERF_SCOLS.filter((c) => c.key === "name" || cfg.cols[c.key]), m.students); }

  const pages = (doc as any).internal.pages.length - 1;
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(8); doc.setTextColor(156, 163, 175);
    doc.text(`Page ${p} / ${pages}`, pageW - M, pageH - 16, { align: "right" });
  }
  doc.save(`performance-report_${localDay()}.pdf`);
}

const ICO = { display: "inline", verticalAlign: "-2px", marginRight: 5 } as const;

/* Checkbox multi-select ("Students: 4 of 31") for the report header. */
function MultiPick({ label, options, sel, onChange }: {
  label: string;
  options: { id: string; name: string; sub?: string }[];
  sel: Set<string> | null; // null = everyone
  onChange: (v: Set<string> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const t = q.trim().toLowerCase();
  const shown = t ? options.filter((o) => o.name.toLowerCase().includes(t) || (o.sub || "").toLowerCase().includes(t)) : options;
  const toggle = (id: string) => {
    const next = new Set(sel === null ? options.map((o) => o.id) : sel);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next.size === options.length ? null : next);
  };
  return (
    <div className="ldr-mp" ref={boxRef}>
      <button className={`ldc-btn${sel !== null ? " on" : ""}`} type="button" onClick={() => setOpen((o) => !o)}>
        {label}: {sel === null ? "All" : `${sel.size} of ${options.length}`}
      </button>
      {open ? (
        <div className="ldr-mp-panel">
          <span className="ldr-searchwrap">
            <Search size={12} />
            <input className="ldr-search" type="search" placeholder="Search students…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search students" />
          </span>
          <div className="ldr-mp-list">
            {shown.map((o) => (
              <label key={o.id} className="ldr-ck">
                <input type="checkbox" checked={sel === null || sel.has(o.id)} onChange={() => toggle(o.id)} />
                <span>{o.name}{o.sub ? <small>{o.sub}</small> : null}</span>
              </label>
            ))}
            {shown.length === 0 ? <div className="ldc-empty">No matches</div> : null}
          </div>
          <div className="ldr-mp-actions">
            <button type="button" onClick={() => onChange(null)}>Select all</button>
            <button type="button" onClick={() => onChange(new Set())}>Clear</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* A document section with its screen-only "remove from document" ×. */
function Sec({ k, onRemove, children }: { k: string; onRemove: (k: string) => void; children: ReactNode }) {
  return (
    <div className="ldr-sec">
      <button className="ldr-x" type="button" title="Remove from document" aria-label="Remove section from document" onClick={() => onRemove(k)}><X size={12} /></button>
      {children}
    </div>
  );
}

/* Static table for the generated document — every row, no controls. */
function DocTable({ title, unit, cols, rows }: { title: string; unit: string; cols: PerfCol[]; rows: any[] }) {
  return (
    <div className="ldc-list">
      <div className="ldc-list-h"><h2>{title}</h2><span>{rows.length} {unit}</span></div>
      <div className="ldc-scroll">
        <table>
          <thead><tr>{cols.map((c) => <th key={c.key} className={c.r ? "r" : undefined}>{c.h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c.key} className={c.r ? "r" : undefined}>{c.cell(r)}</td>)}</tr>
            ))}
            {rows.length === 0 ? <tr><td colSpan={cols.length}><div className="ldc-empty">Nothing in this scope</div></td></tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* The Generate modal — dynamic checkboxes for sections/pie charts/graphs and
   for the student-table columns. Lives in a portal (outside .ldx), so it uses
   the design-token classes rather than the ldc-* CSS string. */
function PerfBuilderModal({ open, onOpenChange, cfg, onChange, onGenerate }: {
  open: boolean; onOpenChange: (v: boolean) => void; cfg: PerfDocCfg; onChange: (c: PerfDocCfg) => void; onGenerate: () => void;
}) {
  const sec = (k: string) => onChange({ ...cfg, secs: { ...cfg.secs, [k]: !cfg.secs[k] } });
  const col = (k: string) => onChange({ ...cfg, cols: { ...cfg.cols, [k]: !cfg.cols[k] } });
  const none = !Object.values(cfg.secs).some(Boolean);
  const ck = "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-body hover:bg-ink-50 dark:hover:bg-ink-800/40";
  const h3 = "mb-2 text-2xs font-bold uppercase tracking-wider text-subtle";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-popover w-[94vw] gap-0 overflow-hidden rounded-tile border border-hairline-strong bg-surface p-0 sm:max-w-[660px]">
        <DialogHeader className="border-b border-hairline-strong px-5 py-4 text-left">
          <DialogTitle className="text-[15px] font-semibold text-heading">Customize report</DialogTitle>
          <DialogDescription className="text-xs text-subtle">
            Tick what the generated document should contain. Sections can still be removed from the preview with their ×.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[62vh] overflow-y-auto px-5 py-4">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <h3 className={h3}>Sections, pie charts &amp; graphs</h3>
              {PERF_SECTIONS.map((s) => (
                <label key={s.key} className={ck}>
                  <input type="checkbox" className="mt-0.5 size-3.5 accent-brand-500" checked={!!cfg.secs[s.key]} onChange={() => sec(s.key)} />
                  <span>{s.label}<small className="block text-2xs font-normal text-subtle">{s.hint}</small></span>
                </label>
              ))}
            </div>
            <div>
              <h3 className={h3}>Student table columns</h3>
              <div className={cfg.secs.studentTable ? "" : "pointer-events-none opacity-45"}>
                <p className="mb-1 px-2 text-2xs text-subtle">Student name is always included.</p>
                {PERF_SCOLS.filter((c) => c.key !== "name").map((c) => (
                  <label key={c.key} className={ck}>
                    <input type="checkbox" className="mt-0.5 size-3.5 accent-brand-500" checked={!!cfg.cols[c.key]} onChange={() => col(c.key)} />
                    <span>{c.h}</span>
                  </label>
                ))}
              </div>
              <h3 className={`${h3} mt-4`}>Students included</h3>
              <select
                className="w-full rounded-lg border border-hairline-strong bg-surface px-2.5 py-2 text-xs font-semibold text-body outline-none focus:border-brand-500"
                value={cfg.status}
                onChange={(e) => onChange({ ...cfg, status: e.target.value })}
              >
                {PERF_STATUS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-hairline-strong px-5 py-3">
          <button type="button" className="rounded-lg border border-hairline-strong px-4 py-2 text-xs font-semibold text-body" onClick={() => onOpenChange(false)}>Cancel</button>
          <button type="button" className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50" disabled={none} onClick={onGenerate}>Generate report</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* The generated document: toolbar (Customize / downloads / close) + preview.
   Each section carries its × so the head can prune the document by eye. */
function PerfDocView({ cfg, model, genAt, onRemove, onCustomize, onClose }: {
  cfg: PerfDocCfg; model: PerfDocModel; genAt: string;
  onRemove: (k: string) => void; onCustomize: () => void; onClose: () => void;
}) {
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("");
  const s = cfg.secs;
  const scols = PERF_SCOLS.filter((c) => c.key === "name" || cfg.cols[c.key]);
  const anySec = Object.values(s).some(Boolean);
  const run = async (kind: "xlsx" | "pdf") => {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === "xlsx") await exportPerfExcel(cfg, model);
      else await exportPerfPdf(cfg, model);
    } catch (e) {
      console.error("Report export failed", e);
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <div className="ldr-toolbar">
        <button className="ldc-btn" type="button" onClick={onCustomize}><SlidersHorizontal size={13} style={ICO} />Customize</button>
        <button className="ldc-btn" type="button" disabled={!!busy} onClick={() => run("xlsx")}><FileSpreadsheet size={13} style={ICO} />{busy === "xlsx" ? "Preparing…" : "Download Excel"}</button>
        <button className="ldc-btn" type="button" disabled={!!busy} onClick={() => run("pdf")}><Download size={13} style={ICO} />{busy === "pdf" ? "Preparing…" : "Download PDF"}</button>
        <span className="grow" />
        <button className="ldc-btn" type="button" onClick={onClose}><X size={13} style={ICO} />Close preview</button>
      </div>
      <div className="ldr-doc">
        <div className="ldr-doc-h">
          <h2>Performance Report</h2>
          <p>{model.scope} · {model.statusLabel} · Generated {genAt}</p>
        </div>
        {!anySec ? <div className="ldc-empty">Every section was removed — hit Customize to add them back.</div> : null}
        {s.stats ? (
          <Sec k="stats" onRemove={onRemove}>
            <div className="ldc-panel">
              <div className="ldc-panel-h"><h2>Summary</h2></div>
              <RStats items={[
                { k: "Courses", v: model.stats.courses },
                { k: "Students", v: model.stats.students },
                { k: "Avg progress", v: pct(model.stats.avg), hint: "attempts vs exercises" },
                { k: "Avg score", v: model.stats.avgScore === null ? "—" : pct(model.stats.avgScore), hint: "marks on We Do / You Do work" },
                { k: "Completed", v: model.stats.completed, tone: "good", hint: "≥80% overall" },
                { k: "At risk", v: model.stats.atRisk, tone: model.stats.atRisk > 0 ? "bad" : "good", hint: "started, below 50%" },
                { k: "Not started", v: model.stats.notStarted },
              ]} />
            </div>
          </Sec>
        ) : null}
        {s.pie || s.split ? (
          <div className="ldr-two">
            {s.pie ? (
              <Sec k="pie" onRemove={onRemove}>
                <div className="ldc-panel">
                  <div className="ldc-panel-h"><h2>Performance distribution</h2><span>by overall progress</span></div>
                  <RDonut segs={model.buckets} center={String(model.stats.students)} sub="students" />
                </div>
              </Sec>
            ) : null}
            {s.split ? (
              <Sec k="split" onRemove={onRemove}>
                <div className="ldc-panel">
                  <div className="ldc-panel-h"><h2>Status split</h2><span>completion status</span></div>
                  <RDonut segs={model.split} center={String(model.stats.students)} sub="students" />
                </div>
              </Sec>
            ) : null}
          </div>
        ) : null}
        {s.funnel ? (
          <Sec k="funnel" onRemove={onRemove}>
            <div className="ldc-panel">
              <div className="ldc-panel-h"><h2>Pedagogy funnel</h2><span>mean completion per stage</span></div>
              <BarList rows={model.funnel} fmt={(v) => pct(v)} max={100} />
            </div>
          </Sec>
        ) : null}
        {s.courses ? (
          <Sec k="courses" onRemove={onRemove}>
            <div className="ldc-panel">
              <div className="ldc-panel-h"><h2>Courses by average progress</h2></div>
              <BarList rows={model.courses.slice(0, 12).map((c: any) => ({ label: c.name, sub: c.client, value: c.avg }))} fmt={(v) => pct(v)} max={100} />
            </div>
          </Sec>
        ) : null}
        {s.courseTable ? (
          <Sec k="courseTable" onRemove={onRemove}>
            <DocTable title="Course summary" unit="courses" cols={PERF_CCOLS} rows={model.courses} />
          </Sec>
        ) : null}
        {s.studentTable ? (
          <Sec k="studentTable" onRemove={onRemove}>
            <DocTable title="Students" unit="students" cols={scols} rows={model.students} />
          </Sec>
        ) : null}
        <Note>Overall = attempts vs exercises (batch-scoped). Score = marks earned on We Do / You Do work. N/A = the stage has no content for that learner's batch.</Note>
      </div>
    </>
  );
}

const PERF_SUB = "";

function PerformanceReport({ f }: { f: ViewFilter }) {
  const { loading, error, data } = useStaffAnalytics((j) => j?.data ?? null);
  const [pick, setPick] = useState<Set<string> | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PerfDocCfg>(() => perfDefaultCfg());
  const [docCfg, setDocCfg] = useState<PerfDocCfg | null>(null);
  const [genAt, setGenAt] = useState("");
  // Detailed Report designer (Canva-style modal — activity / sub-category /
  // grade filters + preview + Excel/PDF). Runs alongside the existing
  // Generate flow, opened from a second button in the actions row.
  const [designerOpen, setDesignerOpen] = useState(false);

  // A student picked under one scope means nothing under another.
  useEffect(() => { setPick(null); }, [f.client, f.course]);

  const base = useMemo(() => {
    const courses = (data?.courses ?? []).filter((c: any) => inScope(f, String(c.course?._id ?? "")));
    const courseRows = courses.map((c: any) => {
      const id = String(c.course?._id ?? "");
      return {
        id,
        name: c.course?.courseName || "Untitled",
        client: f.clientOf(id) || "Unassigned",
        students: n(c.stats?.totalStudents),
        avg: n(c.stats?.averageProgress),
        done: n(c.stats?.completedStudents),
        prog: n(c.stats?.inProgressStudents),
        not: n(c.stats?.notStartedStudents),
      };
    });
    const students = courses.flatMap((c: any) => {
      const id = String(c.course?._id ?? "");
      const cname = c.course?.courseName || "Untitled";
      return (c.students ?? []).map((s: any) => {
        const p = s.progress ?? {};
        const name = `${s.student?.firstName || ""} ${s.student?.lastName || ""}`.trim() || s.student?.email || "Student";
        return {
          pid: String(s.student?._id || "") || `${name}·${id}`,
          name,
          email: s.student?.email || "",
          course: cname,
          courseId: id,
          client: f.clientOf(id) || "Unassigned",
          overall: n(p.overall),
          iDo: stageDone(p, "I_Do"),
          weDo: stageDone(p, "We_Do"),
          youDo: stageDone(p, "You_Do"),
          score: scoreOf(p),
          last: s.lastActivity ? fmtDay(s.lastActivity) : "—",
          lastT: s.lastActivity ? (Date.parse(s.lastActivity) || 0) : 0,
          // Raw progress kept for the Detailed Report designer — the sub-cat
          // multipick and grade math walk this object to discover what the
          // course actually allocated.
          progress: p,
        };
      });
    });
    return { courseRows, students };
  }, [data, f]);

  // One entry per person (a learner on 3 courses is still one checkbox).
  const opts = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; sub?: string; n: number }>();
    base.students.forEach((s: any) => {
      const o = seen.get(s.pid);
      if (o) { o.n += 1; o.sub = `${o.n} courses`; }
      else seen.set(s.pid, { id: s.pid, name: s.name, sub: s.email || s.course, n: 1 });
    });
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [base.students]);

  const students = useMemo(
    () => (pick === null ? base.students : base.students.filter((s: any) => pick.has(s.pid))),
    [base, pick],
  );
  const courseRows = useMemo(
    () => (pick === null ? base.courseRows : aggCourses(students)),
    [base, pick, students],
  );
  const m = useMemo(() => buildPerfModel(students), [students]);

  // Document slice — the modal's status filter narrows every doc section.
  const docRows = useMemo(
    () => (!docCfg || docCfg.status === "all" ? students : students.filter((s: any) => perfStatusMatch(s, docCfg.status))),
    [students, docCfg],
  );
  const docCourses = useMemo(
    () => (!docCfg || docCfg.status === "all" ? courseRows : aggCourses(docRows)),
    [courseRows, docRows, docCfg],
  );
  const dm = useMemo(
    () => (docCfg && docCfg.status !== "all" ? buildPerfModel(docRows) : m),
    [docCfg, docRows, m],
  );

  const scope = scopeLabel(f, f.courseOpts.find((c) => c.id === f.course)?.name) || "All clients · all courses";
  const pickNote = pick === null ? "" : `${pick.size} of ${opts.length} students selected`;
  const docModel = useMemo<PerfDocModel | null>(() => {
    if (!docCfg) return null;
    return {
      scope: pickNote ? `${scope} · ${pickNote}` : scope,
      statusLabel: PERF_STATUS.find((o) => o.value === docCfg.status)?.label || "All statuses",
      stats: { ...dm.stats, courses: docCourses.length },
      funnel: dm.funnel,
      buckets: dm.buckets,
      split: dm.split,
      courses: [...docCourses].sort((a: any, b: any) => b.avg - a.avg),
      students: [...docRows].sort((a: any, b: any) => a.name.localeCompare(b.name)),
    };
  }, [docCfg, dm, docCourses, docRows, scope, pickNote]);

  if (loading) return <ReportShell title="Performance Report" sub={PERF_SUB} f={f}><Loading /></ReportShell>;
  if (error) return <ReportShell title="Performance Report" sub={PERF_SUB} f={f}><ErrBox m={error} /></ReportShell>;

  const actions = (
    <>
      <MultiPick label="Students" options={opts} sel={pick} onChange={setPick} />
      <button
        className="ldc-btn green" type="button" title="Open the Report Designer overlay — dynamic filters + downloads"
        onClick={() => setDesignerOpen(true)}
      >
        <SlidersHorizontal size={13} style={ICO} />Detailed report
      </button>
      <button
        className="ldc-btn go" type="button" title="Generate a customized, downloadable report"
        onClick={() => { setDraft(docCfg ?? perfDefaultCfg()); setOpen(true); }}
      >
        <FileText size={13} style={ICO} />Generate
      </button>
    </>
  );

  return (
    <ReportShell title="Performance Report" sub={PERF_SUB} f={f} actions={actions}>
      {docCfg && docModel ? (
        <PerfDocView
          cfg={docCfg}
          model={docModel}
          genAt={genAt}
          onRemove={(k) => setDocCfg({ ...docCfg, secs: { ...docCfg.secs, [k]: false } })}
          onCustomize={() => { setDraft(docCfg); setOpen(true); }}
          onClose={() => setDocCfg(null)}
        />
      ) : (
        <>
          <RStats items={[
            { k: "Courses", v: courseRows.length },
            { k: "Students", v: m.stats.students },
            { k: "Avg progress", v: pct(m.stats.avg), hint: "attempts vs exercises" },
            { k: "Completed", v: m.stats.completed, tone: "good", hint: "≥80% overall" },
            { k: "At risk", v: m.stats.atRisk, tone: m.stats.atRisk > 0 ? "bad" : "good", hint: "started, below 50%" },
            { k: "Not started", v: m.stats.notStarted },
          ]} />
          <div className="ldr-two">
            <div className="ldc-panel">
              <div className="ldc-panel-h"><h2>Pedagogy funnel</h2><span>mean completion per stage</span></div>
              <BarList rows={m.funnel} fmt={(v) => pct(v)} max={100} />
            </div>
            <div className="ldc-panel">
              <div className="ldc-panel-h"><h2>Performance distribution</h2><span>by overall progress</span></div>
              <RDonut segs={m.buckets} center={String(m.stats.students)} sub="students" />
            </div>
          </div>
          <div className="ldc-panel">
            <div className="ldc-panel-h"><h2>Courses by average progress</h2></div>
            <BarList
              rows={[...courseRows].sort((a: any, b: any) => b.avg - a.avg).slice(0, 12).map((c: any) => ({ label: c.name, value: c.avg }))}
              fmt={(v) => pct(v)} max={100}
            />
          </div>
          <RTable
            title="Course summary"
            rows={courseRows}
            init="avg"
            unit="courses"
            cols={[
              { k: "name", h: "Course", render: (r: any) => <b>{r.name}</b> },
              { k: "students", h: "Students", r: true },
              { k: "avg", h: "Avg progress", r: true, render: (r: any) => pct(r.avg) },
              { k: "done", h: "Completed", r: true },
              { k: "prog", h: "In progress", r: true },
              { k: "not", h: "Not started", r: true },
            ]}
          />
          <RTable
            title="Students"
            rows={students}
            init="overall"
            initDir="asc"
            searchKeys={["name", "course", "client", "email"]}
            unit="students"
            filterDefs={[{ key: "status", label: "Status", options: PERF_STATUS, match: perfStatusMatch }]}
            cols={[
              { k: "name", h: "Student", render: (r: any) => <b>{r.name}</b> },
              { k: "overall", h: "Overall", r: true, render: (r: any) => <StatusChip tone={r.overall >= 80 ? "success" : r.overall > 0 && r.overall < 50 ? "danger" : r.overall === 0 ? "neutral" : "brand"}>{pct(r.overall)}</StatusChip> },
              { k: "iDo", h: "I Do", r: true, sv: (r: any) => r.iDo ?? -1, render: (r: any) => (r.iDo === null ? "N/A" : pct(r.iDo)) },
              { k: "weDo", h: "We Do", r: true, sv: (r: any) => r.weDo ?? -1, render: (r: any) => (r.weDo === null ? "N/A" : pct(r.weDo)) },
              { k: "youDo", h: "You Do", r: true, sv: (r: any) => r.youDo ?? -1, render: (r: any) => (r.youDo === null ? "N/A" : pct(r.youDo)) },
              { k: "score", h: "Score", r: true, sv: (r: any) => r.score ?? -1, render: (r: any) => (r.score === null ? "—" : pct(r.score)) },
              { k: "last", h: "Last active", sv: (r: any) => r.lastT },
            ]}
          />
          <Note>Overall = attempts vs exercises (batch-scoped). Score = marks earned on We Do / You Do work. N/A = the stage has no content for that learner's batch. Use <b>Generate</b> to build a customized document from exactly this data and download it as Excel or PDF.</Note>
        </>
      )}
      <PerfBuilderModal
        open={open}
        onOpenChange={setOpen}
        cfg={draft}
        onChange={setDraft}
        onGenerate={() => { setDocCfg(draft); setGenAt(new Date().toLocaleString("en-GB")); setOpen(false); }}
      />
      {/* Detailed Report designer (Canva-style) — sibling to Generate, opens
          from the "Detailed report" action button above. The heavy modal is
          lazy so its exceljs + jspdf bundles stay off the initial page. */}
      {designerOpen ? (
        <PerformanceReportDesignerModal
          open={designerOpen}
          onClose={() => setDesignerOpen(false)}
          baseStudents={students}
          baseCourseRows={courseRows}
          scopeLabel={scope}
          courseId={f.course && f.course !== "all" ? f.course : undefined}
        />
      ) : null}
    </ReportShell>
  );
}

/* ═════════ 2 · Attendance Report ═════════ */
// Roster (students only — trainers excluded) + batch ids + raw marks.
function useAttReport(courseId: string) {
  // `forCourse` marks WHICH course the loaded data belongs to — the consumer
  // treats a mismatch as still-loading, so switching course never flashes the
  // previous course's register (and first paint never shows a zeroed one).
  const [s, setS] = useState<{ loading: boolean; error: string; courseName: string; students: any[]; batches: { id: string; name: string }[]; records: any[]; forCourse: string }>(
    () => ({ loading: !!(courseId && courseId !== "all"), error: "", courseName: "", students: [], batches: [], records: [], forCourse: "" }));
  useEffect(() => {
    if (!courseId || courseId === "all") { setS({ loading: false, error: "", courseName: "", students: [], batches: [], records: [], forCourse: "" }); return; }
    let on = true;
    setS((p) => ({ ...p, loading: true, error: "" }));
    (async () => {
      try {
        const [rc, rec] = await Promise.all([authGet(`/getAll/courses-data/${courseId}`), authGet(`/attendance/get/${courseId}`)]);
        const cd = rc?.data ?? rc ?? {};
        const seen = new Set<string>(); const students: any[] = []; const batches: { id: string; name: string }[] = [];
        (cd.batchAndParticipants || []).forEach((b: any) => {
          batches.push({ id: String(b._id || ""), name: b.batchName || b.name || "Batch" });
          (b.users || []).forEach((u: any) => {
            const su = u.user || u;
            const rn = roleName(su.role).toLowerCase();
            if (rn.includes("trainer") || rn.includes("faculty")) return; // students only — trainers must not deflate percentages
            const id = String(su._id || u._id || "");
            if (id && !seen.has(id)) {
              seen.add(id);
              students.push({ id, name: `${su.firstName || ""} ${su.lastName || ""}`.trim() || su.email || "Student", email: su.email || "", batch: b.batchName || "" });
            }
          });
        });
        const records = Array.isArray(rec?.data) ? rec.data : [];
        if (on) setS({ loading: false, error: "", courseName: cd.courseName || "", students, batches, records, forCourse: courseId });
      } catch (e) {
        if (on) setS({ loading: false, error: e instanceof Error ? e.message : "Could not load attendance", courseName: "", students: [], batches: [], records: [], forCourse: courseId });
      }
    })();
    return () => { on = false; };
  }, [courseId]);
  return s;
}

function AttendanceReport({ f }: { f: ViewFilter }) {
  const today = localDay();
  const overview = useAttendanceOverview(today, (j) => (Array.isArray(j?.data) ? j.data : []));
  const detail = useAttReport(f.course === "all" ? "" : f.course);
  const sub = "Attendance health — marking compliance, trends and defaulters.";

  /* Course selected → deep report for that course. */
  if (f.course !== "all") {
    if (detail.loading || detail.forCourse !== f.course) return <ReportShell title="Attendance Report" sub={sub} f={f}><Loading /></ReportShell>;
    if (detail.error) return <ReportShell title="Attendance Report" sub={sub} f={f}><ErrBox m={detail.error} /></ReportShell>;
    const att = computeAtt(detail.students, detail.records);
    const batchName = new Map(detail.batches.map((b) => [b.id, b.name]));
    // Weekly present-rate among marked cells (P + half-day H over all marks).
    const wk = new Map<string, { p: number; t: number }>();
    detail.records.forEach((r: any) => {
      const d = new Date(String(r.date || ""));
      if (isNaN(d.getTime())) return;
      const k = mondayKey(d);
      const e = wk.get(k) || { p: 0, t: 0 };
      if (r.status === "P") e.p += 1; else if (r.status === "H") e.p += 0.5;
      e.t += 1;
      wk.set(k, e);
    });
    const trend = Array.from(wk.entries()).sort((a, b) => a[0].localeCompare(b[0])).slice(-10)
      .map(([k, e]) => ({ label: wkLabel(k), value: e.t ? Math.round((e.p / e.t) * 100) : 0, detail: `${e.t} marks` }));
    // Per-batch present-rate among that batch's own marks (null batchId = legacy rows).
    const byBatch = new Map<string, { p: number; t: number }>();
    detail.records.forEach((r: any) => {
      const k = String(r.batchId || "");
      const e = byBatch.get(k) || { p: 0, t: 0 };
      if (r.status === "P") e.p += 1; else if (r.status === "H") e.p += 0.5;
      e.t += 1;
      byBatch.set(k, e);
    });
    const batchRows = Array.from(byBatch.entries()).map(([k, e]) => ({
      label: k ? (batchName.get(k) || "Unknown batch") : "Legacy (no batch)",
      value: e.t ? Math.round((e.p / e.t) * 100) : 0,
      sub: `${e.t} marks`,
    })).sort((a, b) => b.value - a.value);
    const defaulters = att.per.filter((x: any) => x.pct < 75).length;
    return (
      <ReportShell title="Attendance Report" sub={sub} f={f}>
        <RStats items={[
          { k: "Sessions held", v: att.sessions, hint: "days with marks" },
          { k: "Students", v: detail.students.length },
          { k: "Class average", v: pct(att.avgPct), tone: att.avgPct >= 75 ? "good" : att.avgPct >= 50 ? "warn" : "bad" },
          { k: "Below 75%", v: defaulters, tone: defaulters > 0 ? "bad" : "good" },
          { k: "Unmarked cells", v: att.N, hint: "student-days without a mark" },
        ]} />
        <div className="ldr-two">
          <div className="ldc-panel">
            <div className="ldc-panel-h"><h2>Weekly attendance</h2><span>present rate of marked days</span></div>
            <TrendLine points={trend} yMax={100} />
          </div>
          <div className="ldc-panel">
            <div className="ldc-panel-h"><h2>Marks breakdown</h2><span>{detail.records.length} marks</span></div>
            <RDonut
              segs={[
                { label: "Present", value: att.P, color: "var(--ch3)" },
                { label: "Half day", value: att.H, color: "var(--ch4)" },
                { label: "Absent", value: att.A, color: "var(--ch1)" },
              ]}
              center={pct(att.avgPct)} sub="class avg"
            />
          </div>
        </div>
        {batchRows.length > 1 ? (
          <div className="ldc-panel">
            <div className="ldc-panel-h"><h2>By batch</h2><span>present rate of each batch's marks</span></div>
            <BarList rows={batchRows} fmt={(v) => pct(v)} max={100} />
          </div>
        ) : null}
        <RTable
          title="Student register"
          rows={att.per}
          init="pct"
          initDir="asc"
          searchKeys={["name", "batch", "email"]}
          unit="students"
          filterDefs={[
            {
              key: "batch", label: "Batch",
              options: [{ value: "all", label: "All batches" }, ...detail.batches.map((b) => ({ value: b.name, label: b.name }))],
              match: (r: any, v) => r.batch === v,
            },
            {
              key: "band", label: "Attendance",
              options: [
                { value: "all", label: "All levels" },
                { value: "low", label: "Below 50%" },
                { value: "mid", label: "50–74%" },
                { value: "high", label: "75% and above" },
              ],
              match: (r: any, v) => (v === "low" ? r.pct < 50 : v === "mid" ? r.pct >= 50 && r.pct < 75 : r.pct >= 75),
            },
          ]}
          cols={[
            { k: "name", h: "Student", render: (r: any) => <b>{r.name}</b> },
            { k: "batch", h: "Batch" },
            { k: "P", h: "Present", r: true },
            { k: "H", h: "Half day", r: true },
            { k: "A", h: "Absent", r: true },
            { k: "marked", h: "Marked", r: true, render: (r: any) => `${r.marked}/${att.sessions}` },
            { k: "pct", h: "Attendance", r: true, render: (r: any) => <StatusChip tone={attTone(r.pct)}>{pct(r.pct)}</StatusChip> },
          ]}
        />
        <Note>% = (present + 0.5 × half-day) over sessions held. Students below 75% sort first — they are the follow-up list.</Note>
      </ReportShell>
    );
  }

  /* No course selected → portfolio compliance for today. */
  if (overview.loading) return <ReportShell title="Attendance Report" sub={sub} f={f}><Loading /></ReportShell>;
  if (overview.error) return <ReportShell title="Attendance Report" sub={sub} f={f}><ErrBox m={overview.error} /></ReportShell>;
  const rows = (overview.data || [])
    // /attendance/overview is not institution-scoped for L&D viewers — keep
    // only courses present in this institution's own course list (clientOf is
    // built from the institution-scoped /courses-structure/getAll).
    .filter((c: any) => f.clientOf(String(c._id)) !== undefined && inScope(f, String(c._id)))
    .map((c: any) => {
      const total = Array.isArray(c.batches) ? c.batches.length : 0;
      const batchMarked = Array.isArray(c.batches) ? c.batches.filter((b: any) => b.markedToday).length : 0;
      // Legacy (batch-less) marks count as "the course was marked" — the
      // server contract — so they must not surface as pending.
      const marked = batchMarked === 0 && c.legacyMarkedToday ? total : batchMarked;
      return {
        id: String(c._id),
        name: c.courseName || "Untitled",
        client: f.clientOf(String(c._id)) || c.clientName || "Unassigned",
        inDelivery: !!c.hasSchedule && total > 0,
        batches: total,
        marked,
        students: n(c.totalStudents),
        window: c.trainingStart ? `${fmtDay(c.trainingStart)} → ${c.trainingEnd ? fmtDay(c.trainingEnd) : "…"}` : "—",
        startT: c.trainingStart ? (Date.parse(c.trainingStart) || 0) : 0,
      };
    });
  const deliv = rows.filter((r: any) => r.inDelivery);
  const fully = deliv.filter((r: any) => r.marked === r.batches).length;
  const none = deliv.filter((r: any) => r.marked === 0).length;
  const partial = deliv.length - fully - none;
  return (
    <ReportShell title="Attendance Report" sub={sub} f={f}>
      <RStats items={[
        { k: "Courses in delivery", v: deliv.length, hint: `of ${rows.length} in scope` },
        { k: "Batches", v: deliv.reduce((s: number, r: any) => s + r.batches, 0) },
        { k: "Students", v: deliv.reduce((s: number, r: any) => s + r.students, 0) },
        { k: "Fully marked today", v: fully, tone: "good" },
        { k: "Pending today", v: deliv.length - fully, tone: deliv.length - fully > 0 ? "bad" : "good" },
      ]} />
      <div className="ldr-two">
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Marking compliance today</h2><span>{today}</span></div>
          <RDonut
            segs={[
              { label: "Fully marked", value: fully, color: "var(--ch3)" },
              { label: "Partially marked", value: partial, color: "var(--ch4)" },
              { label: "Not marked", value: none, color: "var(--ch1)" },
            ]}
            center={String(deliv.length)} sub="in delivery"
          />
        </div>
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Largest cohorts</h2><span>students per course</span></div>
          <BarList rows={[...deliv].sort((a: any, b: any) => b.students - a.students).slice(0, 8).map((r: any) => ({ label: r.name, sub: r.client, value: r.students }))} />
        </div>
      </div>
      <RTable
        title="Courses"
        rows={rows}
        init="marked"
        initDir="asc"
        searchKeys={["name", "client"]}
        unit="courses"
        filterDefs={[{
          key: "marked", label: "Marked today",
          options: [
            { value: "all", label: "All courses" },
            { value: "full", label: "Fully marked" },
            { value: "part", label: "Partially marked" },
            { value: "none", label: "Not marked" },
            { value: "ns", label: "Not scheduled" },
          ],
          match: (r: any, v) =>
            v === "full" ? r.inDelivery && r.marked === r.batches :
            v === "part" ? r.inDelivery && r.marked > 0 && r.marked < r.batches :
            v === "none" ? r.inDelivery && r.marked === 0 :
            !r.inDelivery,
        }]}
        cols={[
          { k: "name", h: "Course", render: (r: any) => <b>{r.name}</b> },
          { k: "client", h: "Client" },
          { k: "students", h: "Students", r: true },
          { k: "batches", h: "Batches", r: true },
          { k: "window", h: "Training window", sv: (r: any) => r.startT },
          { k: "marked", h: "Marked today", r: true, sv: (r: any) => (r.inDelivery ? r.marked / Math.max(1, r.batches) : 2), render: (r: any) => (r.inDelivery ? <StatusChip tone={r.marked === r.batches ? "success" : r.marked === 0 ? "danger" : "warning"}>{r.marked}/{r.batches}</StatusChip> : <StatusChip tone="neutral">not scheduled</StatusChip>) },
        ]}
      />
      <Note>Pick a course in the filter for its full register — trends, batch split and the below-75% follow-up list.</Note>
    </ReportShell>
  );
}

/* ═════════ 3 · Course Delivery Report ═════════ */
function DeliveryReport({ f }: { f: ViewFilter }) {
  const today = localDay();
  const cs = useCourseStructures();
  // Envelope really is { pedagogyViews }, and the endpoint is not institution-
  // scoped — filtered below by matching pv.courses against courses in scope.
  const pv = usePedagogyViews();
  const ov = useAttendanceOverview(today, (j) => (Array.isArray(j?.data) ? j.data : []));
  const sub = "What is being delivered — batches, cohort sizes, planned hours and schedules.";
  if (cs.loading || pv.loading || ov.loading) return <ReportShell title="Course Delivery Report" sub={sub} f={f}><Loading /></ReportShell>;
  if (cs.error) return <ReportShell title="Course Delivery Report" sub={sub} f={f}><ErrBox m={cs.error} /></ReportShell>;

  const hoursOf = new Map<string, { i: number; we: number; you: number }>();
  (pv.data || []).forEach((doc: any) => {
    const cid = String(doc.courses || "");
    if (!cid) return;
    const h = hoursOf.get(cid) || { i: 0, we: 0, you: 0 };
    (doc.pedagogies || []).forEach((p: any) => {
      (p.iDo || []).forEach((x: any) => { h.i += n(x.duration); });
      (p.weDo || []).forEach((x: any) => { h.we += n(x.duration); });
      (p.youDo || []).forEach((x: any) => { h.you += n(x.duration); });
    });
    hoursOf.set(cid, h);
  });
  const ovById = new Map((ov.data || []).map((c: any) => [String(c._id), c]));
  const isTrainer = (u: any) => { const rn = roleName(u?.user?.role).toLowerCase(); return rn.includes("trainer") || rn.includes("faculty"); };

  const rows = (cs.data || []).filter((c: any) => inScope(f, String(c._id))).map((c: any) => {
    const id = String(c._id);
    const seen = new Set<string>(); let students = 0; const trainers = new Set<string>();
    (c.batchAndParticipants || []).forEach((b: any) => (b.users || []).forEach((u: any) => {
      const uid = String(u.user?._id || "");
      if (!uid) return;
      if (isTrainer(u)) { trainers.add(uid); return; }
      if (!seen.has(uid)) { seen.add(uid); students += 1; }
    }));
    const h = hoursOf.get(id) || { i: 0, we: 0, you: 0 };
    const o: any = ovById.get(id);
    return {
      id,
      name: c.courseName || "Untitled",
      client: c.clientName || f.clientOf(id) || "Unassigned",
      model: c.serviceModal || "—",
      batches: (c.batchAndParticipants || []).length,
      students,
      trainers: trainers.size,
      hI: h.i, hWe: h.we, hYou: h.you,
      hours: h.i + h.we + h.you,
      scheduled: !!o?.hasSchedule,
      window: o?.trainingStart ? `${fmtDay(o.trainingStart)} → ${o.trainingEnd ? fmtDay(o.trainingEnd) : "…"}` : "—",
      startT: o?.trainingStart ? (Date.parse(o.trainingStart) || 0) : 0,
    };
  });
  // Secondary sources failing must not print zeros as fact.
  const degraded = [pv.error ? "pedagogy plans (hours)" : "", ov.error ? "schedules (training windows)" : ""].filter(Boolean).join(" and ");
  const batchBars = (cs.data || []).filter((c: any) => inScope(f, String(c._id))).flatMap((c: any) =>
    (c.batchAndParticipants || []).map((b: any) => ({
      label: `${b.batchName || "Batch"}`,
      sub: c.courseName || "",
      value: (b.users || []).filter((u: any) => !isTrainer(u)).length,
    }))
  ).sort((a: any, b: any) => b.value - a.value).slice(0, 10);
  const fmtH = (v: number) => `${Math.round(v * 10) / 10}h`;
  return (
    <ReportShell title="Course Delivery Report" sub={sub} f={f}>
      {degraded ? <Note>Partial data — {degraded} failed to load; the affected figures show 0/— and are not real values.</Note> : null}
      <RStats items={[
        { k: "Courses", v: rows.length },
        { k: "Scheduled", v: rows.filter((r: any) => r.scheduled).length, tone: "good", hint: "have a program calendar" },
        { k: "Batches", v: rows.reduce((s: number, r: any) => s + r.batches, 0) },
        { k: "Students", v: rows.reduce((s: number, r: any) => s + r.students, 0) },
        { k: "Planned hours", v: fmtH(rows.reduce((s: number, r: any) => s + r.hours, 0)), hint: "pedagogy plan total" },
      ]} />
      <div className="ldc-panel">
        <div className="ldc-panel-h"><h2>Planned hours by course</h2><span>I Do / We Do / You Do</span></div>
        <StackList
          rows={[...rows].sort((a: any, b: any) => b.hours - a.hours).filter((r: any) => r.hours > 0).slice(0, 10)
            .map((r: any) => ({ label: r.name, parts: [r.hI, r.hWe, r.hYou] }))}
          keys={["I Do", "We Do", "You Do"]}
          colors={[CH[0], CH[1], CH[2]]}
          fmt={fmtH}
        />
      </div>
      <div className="ldc-panel">
        <div className="ldc-panel-h"><h2>Batch strength</h2><span>largest batches in scope</span></div>
        <BarList rows={batchBars} />
      </div>
      <RTable
        title="Delivery register"
        rows={rows}
        init="students"
        searchKeys={["name", "client", "model"]}
        unit="courses"
        filterDefs={[
          {
            key: "sched", label: "Schedule",
            options: [{ value: "all", label: "All" }, { value: "yes", label: "Scheduled" }, { value: "no", label: "Not set" }],
            match: (r: any, v) => (v === "yes") === !!r.scheduled,
          },
          {
            key: "model", label: "Service model",
            options: [
              { value: "all", label: "All models" },
              ...Array.from(new Set(rows.map((r: any) => r.model).filter((x: string) => x && x !== "—"))).sort().map((x) => ({ value: x as string, label: x as string })),
            ],
            match: (r: any, v) => r.model === v,
          },
        ]}
        cols={[
          { k: "name", h: "Course", render: (r: any) => <b>{r.name}</b> },
          { k: "client", h: "Client" },
          { k: "model", h: "Service model" },
          { k: "batches", h: "Batches", r: true },
          { k: "students", h: "Students", r: true },
          { k: "trainers", h: "Trainers", r: true },
          { k: "hours", h: "Planned hrs", r: true, render: (r: any) => (r.hours > 0 ? fmtH(r.hours) : "—") },
          { k: "window", h: "Training window", sv: (r: any) => r.startT },
          { k: "scheduled", h: "Schedule", r: true, sv: (r: any) => (r.scheduled ? 1 : 0), render: (r: any) => <StatusChip tone={r.scheduled ? "success" : "neutral"}>{r.scheduled ? "Scheduled" : "Not set"}</StatusChip> },
        ]}
      />
      <Note>Hours come from each course's pedagogy plan (sum of activity durations); the training window is computed from the program calendar and holidays.</Note>
    </ReportShell>
  );
}

/* ═════════ 4 · Feedback Report ═════════ */
function FeedbackReport({ f }: { f: ViewFilter }) {
  // The route is a launcher for the per-form report modal — the modal is the
  // whole experience (detailed responses, filters, column pickers, PDF/Excel).
  // Aggregate KPIs/charts/comments were dropped: they duplicated what the
  // modal already covers per-form and forced two mental models on one page.
  const fb = useAllFeedback((j) => (Array.isArray(j?.getAllFeedback) ? j.getAllFeedback : []));
  const cs = useCourseStructures();
  // The raw doc of the form opened in the per-form report modal (null = shut).
  const [openDoc, setOpenDoc] = useState<any | null>(null);
  const sub = "Pick a form to open its full report — responses, ratings, column pickers and PDF / Excel downloads.";
  if (fb.loading || cs.loading) return <ReportShell title="Feedback Report" sub={sub} f={f}><Loading /></ReportShell>;
  if (fb.error) return <ReportShell title="Feedback Report" sub={sub} f={f}><ErrBox m={fb.error} /></ReportShell>;
  // The course list is what scopes foreign institutions out — without it the
  // report can't be trusted, so its failure is a hard stop, not a fallback.
  if (cs.error) return <ReportShell title="Feedback Report" sub={sub} f={f}><ErrBox m={cs.error} /></ReportShell>;

  const courseById = new Map((cs.data || []).map((c: any) => [String(c._id), c]));
  const isStudentU = (u: any) => { const rn = roleName(u?.user?.role).toLowerCase(); return !rn.includes("trainer") && !rn.includes("faculty"); };
  // /getAll/feedback is not institution-scoped server-side — keep only forms
  // whose course exists in THIS institution's own course list.
  const docs = (fb.data || []).filter((d: any) => {
    const cid = String(d.courseId || "");
    return courseById.has(cid) && inScope(f, cid);
  });

  const norm5 = (v: number, maxR: number) => (maxR && maxR !== 5 ? (v / maxR) * 5 : v);
  const forms = docs.map((d: any) => {
    const cid = String(d.courseId || "");
    const course: any = courseById.get(cid);
    const maxR = n(d.ratingScale?.maxRating) || 5;
    const resp = Array.isArray(d.studentResponses) ? d.studentResponses : [];
    const ratings = resp.map((r: any) => (typeof r.overallRating === "number" ? r.overallRating : parseFloat(r.overallRating))).filter((v: number) => !isNaN(v));
    const avg = ratings.length ? ratings.reduce((s: number, v: number) => s + v, 0) / ratings.length : null;
    // Response-rate denominator: the matching batch roster (students only).
    let denom: number | null = null;
    if (course) {
      const batch = (course.batchAndParticipants || []).find((b: any) => String(b._id) === String(d.batchId || "") || (d.batchName && b.batchName === d.batchName));
      if (batch) denom = (batch.users || []).filter(isStudentU).length;
    }
    return {
      id: String(d._id),
      title: d.feedbackTitle || "Feedback",
      courseId: cid,
      course: course?.courseName || "—",
      client: f.clientOf(cid) || course?.clientName || "Unassigned",
      batch: d.batchName || "—",
      trainer: d.trainerName || "Course-level",
      trainerId: String(d.trainerId || ""),
      responses: resp.length,
      denom,
      rate: denom ? Math.round((resp.length / denom) * 100) : null,
      avg: avg === null ? null : Math.round(norm5(avg, maxR) * 10) / 10,
      window: `${fmtDay(d.startDate)} → ${d.endDate ? fmtDay(d.endDate) : "open"}`,
      startT: d.startDate ? (Date.parse(d.startDate) || 0) : 0,
      active: !!d.isActive,
      raw: d,
    };
  });

  return (
    <ReportShell title="Feedback Report" sub={sub} f={f}>
      <RTable
        title="Feedback forms"
        rows={forms}
        init="avg"
        searchKeys={["title", "course", "client", "trainer", "batch"]}
        unit="forms"
        filterDefs={[
          {
            key: "st", label: "Status",
            options: [{ value: "all", label: "All statuses" }, { value: "open", label: "Open" }, { value: "closed", label: "Closed" }],
            match: (r: any, v) => (v === "open") === !!r.active,
          },
          {
            key: "tr", label: "Trainer",
            options: [
              { value: "all", label: "All trainers" },
              ...Array.from(new Set(forms.map((x: any) => x.trainer))).sort().map((t) => ({ value: t as string, label: t as string })),
            ],
            match: (r: any, v) => r.trainer === v,
          },
        ]}
        cols={[
          { k: "title", h: "Form", render: (r: any) => <b>{r.title}</b> },
          { k: "course", h: "Course" },
          { k: "client", h: "Client" },
          { k: "batch", h: "Batch" },
          { k: "trainer", h: "Trainer" },
          { k: "responses", h: "Responses", r: true, render: (r: any) => (r.denom ? `${r.responses}/${r.denom}` : String(r.responses)) },
          { k: "rate", h: "Rate", r: true, sv: (r: any) => r.rate ?? -1, render: (r: any) => (r.rate === null ? "—" : pct(r.rate)) },
          { k: "avg", h: "Avg rating", r: true, sv: (r: any) => r.avg ?? -1, render: (r: any) => (r.avg === null ? "—" : <StatusChip tone={r.avg >= 4 ? "success" : r.avg < 3 ? "danger" : "warning"}>{r.avg}/5</StatusChip>) },
          { k: "window", h: "Window", sv: (r: any) => r.startT },
          {
            // Per-form detailed report: the feedback screen's own export modal
            // (student responses, filters, column pickers, Print/Excel/PDF).
            // The report's Print button snapshots via printReportHtml (LDC_CSS
            // there hides .ldc-btn), so this button doesn't reach paper on
            // that path — the browser's own Ctrl+P would show it, which is
            // fine (no printable use of the L&D console via Ctrl+P today).
            k: "open", h: "", sv: () => 0,
            render: (r: any) => (
              <button className="ldc-btn" type="button" title="Open the detailed report — responses, column pickers, PDF / Excel" onClick={() => setOpenDoc(r.raw)}>
                <Eye size={13} style={ICO} />Open
              </button>
            ),
          },
        ]}
      />
      {/* Portal-rendered; keyed by form so filters/column picks reset per doc. */}
      <FeedbackFormReportModal key={openDoc ? String(openDoc._id) : "shut"} open={!!openDoc} onClose={() => setOpenDoc(null)} feedback={openDoc} />
    </ReportShell>
  );
}

/* ═════════ 5 · Clients & Services Report ═════════ */
function ClientsReport({ f }: { f: ViewFilter }) {
  const cs = useCourseStructures();
  const cl = useClientRegistry();
  const sm = useServiceMappingList();
  const sub = "The commercial picture — services offered, courses delivered and students trained per client.";
  // The course picker is hidden on this page (course={false}) — so the course
  // dimension must be NEUTRALISED, not silently applied: a course picked on
  // another report would otherwise collapse this portfolio view to one course
  // with nothing on screen explaining why.
  const fc: ViewFilter = { ...f, course: "all" };
  if (cs.loading || cl.loading || sm.loading) return <ReportShell title="Clients & Services Report" sub={sub} f={fc} course={false}><Loading /></ReportShell>;
  if (cs.error) return <ReportShell title="Clients & Services Report" sub={sub} f={fc} course={false}><ErrBox m={cs.error} /></ReportShell>;

  const isTrainer = (u: any) => { const rn = roleName(u?.user?.role).toLowerCase(); return rn.includes("trainer") || rn.includes("faculty"); };
  const studentIdsOf = (c: any): Set<string> => {
    const ids = new Set<string>();
    (c.batchAndParticipants || []).forEach((b: any) => (b.users || []).forEach((u: any) => {
      if (isTrainer(u)) return;
      const id = String(u.user?._id || "");
      if (id) ids.add(id);
    }));
    return ids;
  };
  const scoped = (cs.data || []).filter((c: any) => inScope(fc, String(c._id)));
  const courseById = new Map(scoped.map((c: any) => [String(c._id), c]));
  // Course→mapping is stored in BOTH directions and both are patchy: the course
  // field is `mappingId` (empty on legacy records) and every mapping carries
  // `courseId` (the course it auto-created). Use both, then client-name match.
  const byMappingId = new Map<string, any[]>();
  scoped.forEach((c: any) => {
    const id = String(c.mappingId || "");
    if (id) byMappingId.set(id, [...(byMappingId.get(id) || []), c]);
  });
  const claimed = new Set<string>();
  const mapRows = (sm.data || []).map((m: any) => {
    const cname = m.client?.clientCompany || "";
    const bucket = [...(byMappingId.get(String(m._id)) || [])];
    const reverse: any = courseById.get(String(m.courseId || ""));
    if (reverse && !bucket.some((c: any) => String(c._id) === String(reverse._id))) bucket.push(reverse);
    bucket.forEach((c: any) => claimed.add(String(c._id)));
    const students = new Set<string>();
    bucket.forEach((c: any) => studentIdsOf(c).forEach((id) => students.add(id)));
    return {
      id: String(m._id),
      client: cname || bucket[0]?.clientName || "—",
      service: m.service || "—",
      model: Array.isArray(m.serviceModels) && m.serviceModels.length ? m.serviceModels.join(", ") : "—",
      year: m.year || "—",
      courses: bucket.length || (Array.isArray(m.courses) ? m.courses.length : 0),
      students: students.size,
      status: m.status === "active",
      inScope: bucket.length > 0 || (f.client === "all" ? true : cname === f.client),
    };
  }).filter((r: any) => r.inScope);
  // Courses no mapping claims still count — as their own service rows.
  const unmapped = scoped.filter((c: any) => !claimed.has(String(c._id))).map((c: any) => ({
    id: String(c._id),
    client: c.clientName || "Unassigned",
    service: c.serviceType || c.category || "—",
    model: c.serviceModal || "—",
    year: "—",
    courses: 1,
    students: studentIdsOf(c).size,
    status: true,
    unmapped: true,
  }));
  const rows = [...mapRows, ...unmapped];
  const allStudents = new Set<string>();
  scoped.forEach((c: any) => studentIdsOf(c).forEach((id) => allStudents.add(id)));
  const clientNames = new Set(rows.map((r: any) => r.client).filter((x: string) => x && x !== "—"));
  // Charts: courses per client, service-model mix, offerings per year.
  const perClient = new Map<string, number>();
  scoped.forEach((c: any) => {
    const k = c.clientName || "Unassigned";
    perClient.set(k, (perClient.get(k) || 0) + 1);
  });
  const clientBars = Array.from(perClient.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  const modelMix = new Map<string, number>();
  rows.forEach((r: any) => String(r.model).split(",").map((x: string) => x.trim()).filter((x: string) => x && x !== "—")
    .forEach((mdl: string) => modelMix.set(mdl, (modelMix.get(mdl) || 0) + 1)));
  const mixTop = Array.from(modelMix.entries()).sort((a, b) => b[1] - a[1]);
  const mixSegs = mixTop.slice(0, 4).map(([label, value], i) => ({ label, value, color: CH[i] }));
  const mixRest = mixTop.slice(4).reduce((s, [, v]) => s + v, 0);
  if (mixRest > 0) mixSegs.push({ label: "Other", value: mixRest, color: "var(--muted)" });
  const perYear = new Map<string, number>();
  rows.forEach((r: any) => { if (r.year && r.year !== "—") perYear.set(String(r.year), (perYear.get(String(r.year)) || 0) + 1); });
  const yearCols = Array.from(perYear.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));
  const registry = new Map((cl.data || []).map((d: any) => [String(d.clientCompany || "").trim(), d]));
  const degraded = [cl.error ? "the client registry" : "", sm.error ? "service mappings" : ""].filter(Boolean).join(" and ");
  return (
    <ReportShell title="Clients & Services Report" sub={sub} f={fc} course={false}>
      {degraded ? <Note>Partial data — {degraded} failed to load; the affected figures are undercounts, not real values.</Note> : null}
      <RStats items={[
        { k: "Clients", v: clientNames.size },
        { k: "Services", v: rows.length, hint: `${rows.filter((r: any) => r.status).length} active` },
        { k: "Courses", v: scoped.length },
        { k: "Students trained", v: allStudents.size, tone: "good", hint: "distinct learners in scope" },
        { k: "Registered clients", v: registry.size, hint: "in the client registry" },
      ]} />
      <div className="ldr-two">
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Courses per client</h2></div>
          <BarList rows={clientBars} />
        </div>
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Service model mix</h2><span>services by model</span></div>
          <RDonut segs={mixSegs} center={String(rows.length)} sub="services" />
        </div>
      </div>
      {yearCols.length > 1 ? (
        <div className="ldc-panel">
          <div className="ldc-panel-h"><h2>Offerings by year</h2><span>services per offering year</span></div>
          <ColChart rows={yearCols} />
        </div>
      ) : null}
      <RTable
        title="Services delivered"
        rows={rows}
        init="students"
        searchKeys={["client", "service", "model", "year"]}
        unit="services"
        filterDefs={[
          {
            key: "model", label: "Service model",
            options: [{ value: "all", label: "All models" }, ...mixTop.map(([mdl]) => ({ value: mdl, label: mdl }))],
            match: (r: any, v) => String(r.model).split(",").map((x: string) => x.trim()).includes(v),
          },
          {
            key: "year", label: "Offering year",
            options: [{ value: "all", label: "All years" }, ...Array.from(perYear.keys()).sort().map((y) => ({ value: y, label: y }))],
            match: (r: any, v) => String(r.year) === v,
          },
          {
            key: "status", label: "Status",
            options: [{ value: "all", label: "All statuses" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }],
            match: (r: any, v) => (v === "active") === !!r.status,
          },
        ]}
        cols={[
          { k: "client", h: "Client", render: (r: any) => <b>{r.client}</b> },
          { k: "service", h: "Service", render: (r: any) => <>{r.service}{r.unmapped ? <small> · not mapped</small> : null}</> },
          { k: "model", h: "Service model" },
          { k: "year", h: "Offering year", r: true },
          { k: "courses", h: "Courses", r: true },
          { k: "students", h: "Students", r: true },
          { k: "status", h: "Status", r: true, sv: (r: any) => (r.status ? 1 : 0), render: (r: any) => <StatusChip tone={r.status ? "success" : "neutral"}>{r.status ? "Active" : "Inactive"}</StatusChip> },
        ]}
      />
      <Note>"Not mapped" rows are live courses that predate service mapping — they count toward totals by their own service type. Student counts exclude trainers and de-duplicate across batches.</Note>
    </ReportShell>
  );
}

/* ───────── Profile ───────── */
function ProfileView() {
  const [u, setU] = useState<any>(null);
  useEffect(() => {
    try { setU(JSON.parse(localStorage.getItem("smartcliff_userData") || "null")); } catch { setU(null); }
  }, []);
  const perms: any[] = Array.isArray(u?.permissions) ? u.permissions : [];
  return (
    <>
      <Head eyebrow="Account" title="Profile & Access" sub="Your role and the modules this role opens." />
      <div className="ldc-list">
        <div className="ldc-list-h"><h2>Account</h2></div>
        <div style={{ padding: "12px 15px", fontSize: 13 }}>
          <div><b>{`${u?.firstName || "L&D"} ${u?.lastName || "Head"}`}</b></div>
          <div style={{ color: "var(--muted)", fontSize: 12 }}>{u?.email || "l&d@gmail.com"} · role {roleName(u?.role) || "L&D"}</div>
        </div>
      </div>
      <div className="ldc-list">
        <div className="ldc-list-h"><h2>Module access</h2><span>{perms.length}</span></div>
        <div className="ldc-scroll"><table>
          <thead><tr><th>Module</th><th>Key</th><th>State</th></tr></thead>
          <tbody>{perms.map((p, i) => (
            <tr key={i}><td><b>{p.permissionName}</b></td><td><small>{p.permissionKey}</small></td>
              <td><span className={`ldc-chip ${p.isActive ? "good" : "neutral"}`}>{p.isActive ? "Active" : "Off"}</span></td></tr>
          ))}
          {perms.length === 0 && <tr><td colSpan={3} className="ldc-empty">Sign in as the L&D user to see modules.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}

/* ───────── Results & Assessments (Student Performance sub-view) ───────── */
function ResultsView() {
  const { loading, error, data } = useStaffAnalytics((j) => {
    const d = j?.data ?? j ?? {}; const courses: any[] = Array.isArray(d.courses) ? d.courses : [];
    return courses.map((c) => {
      const co = c.course ?? {}; const s = c.stats ?? {};
      const total = n(s.totalStudents ?? co.totalStudents);
      const done = n(s.completedStudents);
      return { name: co.courseName || c.courseName || "Untitled", code: co.courseCode || "—",
        total, done, prog: n(s.inProgressStudents), not: n(s.notStartedStudents),
        rate: total ? Math.round((done / total) * 100) : 0 };
    });
  });
  return (
    <>
      <Head eyebrow="Student Performance" title="Results & Assessments" sub="Completion and pass rates per course, from live progress data." />
      {loading && <Loading />}
      {!loading && error && <ErrBox m={error} />}
      {!loading && !error && data && (
        <DataTable
          title="Results by course"
          data={data as ResultRow[]}
          columns={resultColumns}
          getRowKey={(r, i) => `${r.code}-${i}`}
          searchText={(r) => `${r.name} ${r.code}`}
          searchPlaceholder="Search course or code…"
          filters={[{
            key: "rate", label: "Any completion",
            options: [
              { value: "low", label: "Below 50%", match: (r: ResultRow) => r.total > 0 && r.rate < 50 },
              { value: "mid", label: "50–84%", match: (r: ResultRow) => r.rate >= 50 && r.rate < 85 },
              { value: "high", label: "85%+", match: (r: ResultRow) => r.rate >= 85 },
              { value: "empty", label: "No students", match: (r: ResultRow) => r.total === 0 },
            ],
          }]}
          emptyTitle="No results data yet"
          emptyHint="Completion appears once students begin working through a course."
        />
      )}
      <Note>Per-exercise pass rates against configured pass marks and assessment integrity flags need the results rollup endpoint — completion above is live.</Note>
    </>
  );
}

/* ───────── Hosted course screens ─────────
   Course Structure, Program Calendar and Enrollment rendered inside the console
   rather than as separate pages. Each is the SAME component the standalone
   admin route renders — not a second implementation that can drift — told to
   skip its own chrome and handed the console's selected course. */
type HostedView = "course-structure" | "course-calendar" | "course-enrollment";

const HOSTED_TITLE: Record<HostedView, string> = {
  "course-structure": "Course Structure",
  "course-calendar": "Program Calendar",
  "course-enrollment": "Enrollment",
};

function HostedCourseScreen({ view, courseId, courseName }: { view: HostedView; courseId: string; courseName?: string }) {
  if (!courseId) {
    return (
      <>
        <Head eyebrow="Course Insight" title={HOSTED_TITLE[view]} sub="Pick a course first." showBack />
        <div className="ldc-list"><div className="ldc-empty">
          <b>No course selected</b>
          <span>Choose a course in the filter bar above, or open one from Course Insight, and this screen opens for it.</span>
        </div></div>
      </>
    );
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-4 py-2">
        <a
          href="#courses"
          className="inline-flex items-center gap-1 rounded-chip border border-hairline px-2.5 py-1 text-xs font-medium text-body transition-colors hover:bg-row-hover"
        >
          <ArrowLeft size={13} strokeWidth={2.4} aria-hidden />
          {courseName || "Course"}
        </a>
        <h1 className="text-sm font-semibold text-heading">{HOSTED_TITLE[view]}</h1>
      </div>
      {/* The hosted screens size themselves to the page, so they get their own
          scroll box rather than pushing the console's shell out of the way —
          edge to edge, since they bring their own gutters. */}
      <div className="min-h-0 flex-1 overflow-auto">
        {view === "course-structure" ? <PedagogyManagementContent key={courseId} courseId={courseId} embedded />
          : view === "course-calendar" ? <ProgramCalendarContent key={courseId} courseId={courseId} embedded />
            : <CourseParticipantsContent key={courseId} courseId={courseId} embedded />}
      </div>
    </div>
  );
}

export default function LDConsole() {
  const view = useHashView();
  const [client, setClient] = useState("all");
  const [course, setCourse] = useState("all");
  // Course picker options for the whole console. This reads THREE scalars per
  // course (_id / courseName / clientName), so it rides the shared
  // ['courseStructures','summary'] entry — 43 KB instead of the 348 KB roster
  // payload — which the Approvals page's Chains tab already fills. The views
  // that genuinely need rosters still share their own single full entry.
  const courseListQuery = useQuery(courseStructuresSummaryQuery());
  const courses = useMemo<CourseOpt[]>(
    () =>
      (Array.isArray(courseListQuery.data) ? courseListQuery.data : []).map((c: any) => ({
        id: String(c._id), name: c.courseName || "Untitled", client: c.clientName || "Unassigned",
      })),
    [courseListQuery.data],
  );
  const clients = useMemo(() => Array.from(new Set(courses.map((c) => c.client).filter(Boolean))).sort(), [courses]);
  const courseOpts = useMemo(() => (client === "all" ? courses : courses.filter((c) => c.client === client)), [courses, client]);
  // IDs of the selected client's courses (null = all clients). The dashboard
  // matches analytics rows by ID against this set — see DashboardView.
  const clientCourseIds = useMemo(
    () => (client === "all" ? null : new Set(courses.filter((c) => c.client === client).map((c) => c.id))),
    [courses, client]
  );
  // Authoritative course-id → client name (from getAll). The analytics endpoint
  // often returns an empty clientName, so the dashboard labels courses via this.
  const clientById = useMemo(() => new Map(courses.map((c) => [c.id, c.client])), [courses]);
  const clientOf = useMemo(() => (id: string) => clientById.get(id), [clientById]);
  const filter = {
    client, course, clients, courseOpts,
    onClient: (v: string) => { setClient(v); setCourse("all"); },
    onCourse: (v: string) => setCourse(v),
  };

  // Live sidebar badge — how many items are waiting on this user's role.
  // It used to re-fetch /approvals/pending on EVERY rail-view switch. Now it
  // reads the same shared queue entry QueueView does, whose
  // `refetchOnMount: "always"` re-asks the server whenever a view that shows
  // the queue mounts (and the console remounts on the way back from
  // view-resources, where items are actually acted on). Same freshness where
  // it matters, one request instead of one per hop.
  const apprBadge = usePendingApprovals().data?.length ?? 0;
  // Scoping contract handed to the redesigned dashboard. Memoised because the
  // view derives its whole model from this object — a fresh identity each
  // render would re-run every aggregate on unrelated state changes.
  const dashFilter = useMemo(
    () => ({
      client,
      course,
      courseIds: clientCourseIds,
      clientOf,
      onReset: () => { setClient("all"); setCourse("all"); },
    }),
    [client, course, clientCourseIds, clientOf]
  );

  // One scope object for every list view. Memoised for the same reason as
  // dashFilter: these views derive their rows from it.
  const viewFilter = useMemo<ViewFilter>(
    () => ({
      client, course, clients, courseOpts, courseIds: clientCourseIds, clientOf,
      onClient: (v: string) => { setClient(v); setCourse("all"); },
      onCourse: (v: string) => setCourse(v),
    }),
    [client, course, clients, courseOpts, clientCourseIds, clientOf],
  );

  const body: ReactNode =
    view === "dashboard" ? <LDDashboard filter={dashFilter} filterControls={<ScopeFilters f={filter} reset={false} />} /> :
    view === "appr-queue" ? <QueueView /> :
    view === "appr-rules" ? <RulesView /> :
    view === "clients" ? <ClientsView filter={viewFilter} /> :
    view === "courses" ? <CoursesView filter={viewFilter} /> :
    view === "content" ? <ContentView filter={viewFilter} /> :
    view === "schedule" ? <ScheduleView /> :
    view === "trainers" ? <TrainersView filter={viewFilter} /> :
    view === "attendance" ? <AttendanceView filter={viewFilter} /> :
    view === "perf-progress" ? <PerformanceView filter={viewFilter} /> :
    view === "perf-results" ? <ResultsView /> :
    // Feedback rail item = the finished Feedback Report (same component as
    // Reports ▸ Feedback): client/course scope, filters, ratings, print.
    view === "fb-summary" ? <FeedbackReport f={viewFilter} /> :
    // Legacy #reports bookmarks land on the first report page.
    view === "reports" || view === "rep-performance" ? <PerformanceReport f={viewFilter} /> :
    view === "rep-attendance" ? <AttendanceReport f={viewFilter} /> :
    view === "rep-delivery" ? <DeliveryReport f={viewFilter} /> :
    view === "rep-feedback" ? <FeedbackReport f={viewFilter} /> :
    view === "rep-clients" ? <ClientsReport f={viewFilter} /> :
    view === "course-structure" || view === "course-calendar" || view === "course-enrollment"
      ? <HostedCourseScreen view={view} courseId={course === "all" ? "" : course} courseName={courses.find((c) => c.id === course)?.name} />
      :
    <ProfileView />;
  return (
    <LDLayout active={view} apprBadge={apprBadge}>
      <style>{LDC_CSS}</style>
      {body}
    </LDLayout>
  );
}

const LDC_CSS = `
.ldc-head{margin-bottom:16px; display:flex; align-items:flex-start; column-gap:16px; row-gap:10px; flex-wrap:wrap;}
.ldc-head.nosub{margin-bottom:9px;}
/* flex-basis 0, not auto: with auto, a long sub line sets the block's basis to
   its full single-line width and shoves the right slot onto its own row. With
   basis 0 the left block takes the leftover space instead, so the pickers stay
   up on the title row and the sub wraps underneath the title. min-width keeps
   the title readable before the row is allowed to wrap on narrow screens. */
.ldc-head-l{flex:1 1 0; min-width:min(60%, 320px);}
/* Right slot of a page header — hosts the page-owned scope pickers. The 48px
   right margin keeps clear of the shell's corner-pinned notification bell. */
.ldc-head-r{margin-left:auto; margin-right:48px; padding-top:8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.ldc-eyebrow{font-size:10px; font-weight:700; letter-spacing:.11em; text-transform:uppercase; color:var(--accent-ink);}
.ldc-head h1{margin:4px 0 0; font-size:17px; font-weight:650; letter-spacing:-.02em;}
.ldc-bars{display:grid; gap:1px;}
.ldc-head p{margin:3px 0 0; font-size:13px; color:var(--ink2); max-width:70ch;}
.ldc-strip{display:flex; flex-wrap:wrap; border-bottom:1px solid var(--grid); padding:2px 0 11px; margin-bottom:14px;}
.ldc-s{flex:1 1 130px; padding:2px 16px; border-left:1px solid var(--grid);}
.ldc-s:first-child{border-left:none; padding-left:2px;}
.ldc-s .k{display:block; font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);}
.ldc-s b{display:block; font-size:19px; font-weight:750; letter-spacing:-.02em; margin-top:4px; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-s b.bad{color:var(--bad);}
.ldc-s i{display:block; font-size:10px; color:var(--muted); font-style:normal; margin-top:2px;}
.ldc-list{background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden; box-shadow:var(--sh); margin-bottom:14px;}
.ldc-list-h{display:flex; align-items:center; gap:10px; padding:11px 15px; border-bottom:1px solid var(--grid);}
.ldc-list-h h2{margin:0; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.02em; color:var(--ink2);}
.ldc-list-h span{margin-left:auto; font-size:11px; font-weight:500; color:var(--muted);}
.ldc-group-h{font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.09em; color:var(--muted); margin:0 0 8px 2px;}
.ldc-group-h span{font-weight:500; text-transform:none; letter-spacing:0; margin-left:6px;}
.ldc-scroll{overflow-x:auto; max-height:58vh;}
.ldc-list table{width:100%; border-collapse:collapse; font-size:12.5px;}
.ldc-list th{text-align:left; font-size:9.5px; font-weight:600; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); padding:9px 15px; background:color-mix(in srgb,var(--muted) 6%,var(--surface)); border-bottom:1px solid var(--grid); position:sticky; top:0;}
.ldc-list th.r{text-align:right;}
.ldc-list td{padding:11px 15px; border-bottom:1px solid var(--grid); color:var(--ink2); vertical-align:middle;}
.ldc-list tbody tr:last-child td{border-bottom:none;}
.ldc-list tbody tr:hover td{background:color-mix(in srgb,var(--accent) 4%,transparent);}
.ldc-list td b{color:var(--ink); display:block; font-weight:500;}
.ldc-list td small{color:var(--muted); font-size:10.5px;}
.ldc-list td.r{text-align:right; font-variant-numeric:tabular-nums; color:var(--ink);}
.ldc-bar{display:inline-block; vertical-align:middle; width:80px; height:6px; border-radius:99px; background:color-mix(in srgb,var(--accent) 14%,transparent); margin-right:8px; overflow:hidden;}
.ldc-bar i{display:block; height:100%; border-radius:99px; background:var(--accent);}
.ldc-link{background:none; border:none; cursor:pointer; font:inherit; font-size:12px; font-weight:650; color:var(--accent-ink); text-decoration:none;}
.ldc-link:hover{text-decoration:underline;}
.ldc-chip{display:inline-flex; align-items:center; font-size:10.5px; font-weight:650; border-radius:7px; padding:2px 9px; border:1px solid transparent;}
.ldc-chip.good{color:var(--good-ink); background:color-mix(in srgb,var(--good) 11%,transparent); border-color:color-mix(in srgb,var(--good) 22%,transparent);}
.ldc-chip.warn{color:color-mix(in srgb,var(--warn) 75%,var(--ink)); background:color-mix(in srgb,var(--warn) 14%,transparent); border-color:color-mix(in srgb,var(--warn) 26%,transparent);}
.ldc-chip.bad{color:var(--bad); background:color-mix(in srgb,var(--bad) 11%,transparent); border-color:color-mix(in srgb,var(--bad) 24%,transparent);}
.ldc-chip.neutral{color:var(--ink2); background:color-mix(in srgb,var(--muted) 12%,transparent); border-color:color-mix(in srgb,var(--muted) 22%,transparent);}
.ldc-two{display:grid; grid-template-columns:1fr 1fr; gap:14px;}
@media (max-width:820px){ .ldc-two{grid-template-columns:1fr;} }
.ldc-check{display:flex; align-items:center; gap:10px; font-size:13px;}
.ldc-check small{color:var(--muted);}
.ldc-box{width:18px; height:18px; border-radius:5px; flex:0 0 auto; background:var(--accent); color:#fff; display:grid; place-items:center; font-size:11px; font-weight:800;}
.ldc-box.off{background:none; border:1.5px solid var(--border); color:transparent;}
.ldc-btn{background:var(--surface); border:1px solid var(--border); border-radius:9px; padding:7px 14px; font:inherit; font-size:12px; font-weight:650; color:var(--ink2); cursor:pointer;}
.ldc-btn.go{background:var(--accent); border-color:var(--accent); color:#fff;}
.ldc-btn.green{background:#0E9F6E; border-color:#0E9F6E; color:#fff;}
.ldc-btn.green:hover{background:#0B8760; border-color:#0B8760;}
.ldc-empty{padding:36px 16px; text-align:center; color:var(--muted); font-size:13px;}
.ldc-empty b{display:block; color:var(--ink); font-weight:650; font-size:14px; margin-bottom:3px;}
.ldc-empty span{display:block; font-size:12px;}
.ldc-err{color:var(--bad);}
.ldc-note{font-size:11.5px; color:var(--muted); margin-top:4px;}
.ldc-grid2{display:grid; grid-template-columns:1.6fr 1fr; gap:14px;}
@media (max-width:860px){ .ldc-grid2{grid-template-columns:1fr;} }
.ldc-panel{background:var(--surface); border:1px solid var(--border); border-radius:16px; box-shadow:var(--sh); padding:16px 18px; margin-bottom:14px;}
.ldc-panel-h{display:flex; align-items:baseline; gap:10px; margin-bottom:12px;}
.ldc-panel-h h2{margin:0; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:.02em; color:var(--ink2);}
.ldc-panel-h span{margin-left:auto; font-size:11px; font-weight:500; color:var(--muted);}
.ldc-barrow{display:flex; align-items:center; gap:12px; padding:4px 0; font-size:12px;}
.ldc-barrow .nm{flex:0 0 40%; max-width:40%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--ink); font-weight:550;}
.ldc-barrow .tk{flex:1; height:9px; border-radius:99px; background:color-mix(in srgb,var(--accent) 12%,transparent); overflow:hidden;}
.ldc-barrow .tk i{display:block; height:100%; border-radius:99px; background:var(--accent);}
.ldc-barrow .vl{flex:0 0 auto; font-variant-numeric:tabular-nums; color:var(--ink); font-weight:600; min-width:38px; text-align:right;}
.ldc-donut{display:flex; justify-content:center; padding:6px 0 10px;}
.ldc-donut-n{fill:var(--ink); font-weight:750; font-size:20px; font-family:Poppins,sans-serif;}
.ldc-donut-l{fill:var(--muted); font-size:8.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; font-family:Poppins,sans-serif;}
.ldc-legend{display:flex; gap:14px; flex-wrap:wrap; font-size:11.5px; color:var(--ink2); justify-content:center;}
.ldc-legend .lg{display:inline-flex; align-items:center; gap:6px;}
.ldc-legend .lg b{color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-legend .dot{width:10px; height:10px; border-radius:3px; flex:0 0 auto;}
.ldc-stack{display:flex; height:16px; border-radius:99px; overflow:hidden; gap:2px; margin-bottom:12px; background:color-mix(in srgb,var(--muted) 10%,transparent);}
.ldc-stack i{height:100%;}
.ldc-stack i:first-child{border-radius:99px 0 0 99px;}
.ldc-stack i:last-child{border-radius:0 99px 99px 0;}
.ldc-insights{margin:0; padding:0; list-style:none; display:grid; gap:9px;}
.ldc-insights li{position:relative; padding-left:20px; font-size:13px; color:var(--ink); line-height:1.5;}
.ldc-insights li::before{content:""; position:absolute; left:4px; top:7px; width:7px; height:7px; border-radius:2px; background:var(--accent);}
.ldc-barrow .nm small{color:var(--muted); font-weight:400; font-size:10.5px; margin-left:4px;}
.ldc-cards{display:grid; grid-template-columns:repeat(4,1fr); gap:13px; margin-bottom:14px;}
@media (max-width:900px){ .ldc-cards{grid-template-columns:repeat(2,1fr);} }
.ldc-card{display:flex; align-items:center; gap:13px; padding:15px 16px; border-radius:16px; border:1px solid var(--border); box-shadow:var(--sh);}
.ldc-card .cico{width:44px; height:44px; border-radius:12px; display:grid; place-items:center; flex:0 0 auto;}
.ldc-card .clabel{display:block; font-size:11px; color:var(--ink2); font-weight:500;}
.ldc-card .cval{display:block; font-size:19px; font-weight:700; letter-spacing:-.02em; margin-top:2px; color:var(--ink);}
.ldc-card .csub{display:block; font-size:10px; color:var(--muted); margin-top:2px;}
.ldc-vbars{display:flex; gap:8px; align-items:flex-end; padding:4px 0 2px;}
.ldc-vbar{flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; gap:6px;}
.ldc-vval{font-size:10px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-vtrack{width:70%; max-width:36px; height:130px; background:color-mix(in srgb,var(--accent) 10%,transparent); border-radius:8px; display:flex; align-items:flex-end; overflow:hidden;}
.ldc-vfill{width:100%; background:linear-gradient(180deg,var(--accent),#B94E08); border-radius:8px 8px 0 0;}
.ldc-vlab{font-size:9px; color:var(--muted); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldc-pillrow{display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-top:8px;}
.ldc-pill2{font-size:11px; font-weight:650; border-radius:8px; padding:5px 12px; color:#fff;}

/* ═══ Redesigned dashboard (portfolio-health console) ═══ */
/* NOTE: this block is injected AFTER the shell stylesheet and re-declares
   selectors the shell also owns. A max-width:1200px rule on .ldx-content used
   to live here and silently beat the shell own rule (same specificity, later
   wins) — that is why the console never filled the viewport. Width now belongs
   to the shell alone; do not re-declare .ldx-content here. */
.ldc-gap16{gap:16px;}
.ldc-sec{margin-top:20px;}

/* header / context bar */
.ldc-topbar{display:flex; align-items:flex-start; gap:20px; flex-wrap:wrap; margin-bottom:20px;}
.ldc-topbar-l{min-width:0;}
.ldc-topbar h1{margin:5px 0 0; font-size:21px; font-weight:700; letter-spacing:-.02em; color:var(--ink); line-height:1.15;}
.ldc-scope{margin:5px 0 0; font-size:13px; color:var(--ink2); font-variant-numeric:tabular-nums;}
.ldc-topbar-r{margin-left:auto; display:flex; flex-direction:column; align-items:flex-end; gap:9px; max-width:340px;}
.ldc-method{font-size:11px; color:var(--muted); text-align:right; line-height:1.5;}
.ldc-topbar-actions{display:flex; align-items:center; gap:8px;}
.ldc-ghost{background:none; border:1px solid var(--border); border-radius:9px; padding:7px 13px; font:inherit; font-size:12px; font-weight:600; color:var(--ink2); cursor:pointer;}
.ldc-ghost:hover{border-color:var(--accent); color:var(--accent-ink);}
.ldc-btn{text-decoration:none;}

/* KPI stat cards (icon chip + value + mini viz) */
.ldc-stats{display:grid; grid-template-columns:repeat(4,1fr); gap:14px;}
.ldc-stat{background:var(--surface); border:1px solid var(--border); border-radius:16px; box-shadow:var(--sh); padding:15px 16px 16px; display:flex; flex-direction:column; transition:box-shadow .2s, border-color .2s;}
.ldc-stat:hover{border-color:color-mix(in srgb,var(--accent) 30%,var(--border)); box-shadow:0 2px 6px rgba(23,19,15,.05),0 16px 34px -18px rgba(226,103,15,.28);}
.ldc-stat-top{display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:13px;}
.ldc-ichip{width:38px; height:38px; border-radius:11px; display:inline-flex; align-items:center; justify-content:center; flex:0 0 auto;}
.ldc-spark{display:inline-flex; align-items:flex-end; gap:2px; height:30px; width:88px;}
.ldc-spark i{flex:1; min-height:2px; border-radius:2px 2px 0 0;}
.ldc-delta{display:inline-flex; align-items:center; gap:2px; font-size:11px; font-weight:700; color:var(--good-ink); background:color-mix(in srgb,var(--good) 12%,transparent); border-radius:99px; padding:2px 8px;}
.ldc-stat-v{font-size:23px; font-weight:750; letter-spacing:-.02em; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1;}
.ldc-stat-k{font-size:12px; color:var(--ink2); font-weight:600; margin-top:5px;}
.ldc-statbar{display:block; height:5px; border-radius:99px; background:color-mix(in srgb,var(--muted) 13%,transparent); overflow:hidden; margin-top:11px;}
.ldc-statbar i{display:block; height:100%; border-radius:99px;}
.ldc-stat-s{font-size:10.5px; color:var(--muted); margin-top:8px; font-variant-numeric:tabular-nums;}

/* overview: ring + stage bars + structure | attention feed */
.ldc-main2{display:grid; grid-template-columns:1.55fr 1fr; gap:16px;}
.ldc-prog{display:flex; gap:24px; align-items:center; padding:4px 0 2px;}
.ldc-ringwrap{position:relative; flex:0 0 auto; width:150px; height:150px; display:grid; place-items:center;}
.ldc-ringcap{position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;}
.ldc-ringcap b{font-size:26px; font-weight:750; color:var(--accent-ink); letter-spacing:-.02em; font-variant-numeric:tabular-nums; line-height:1;}
.ldc-ringcap span{font-size:9.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); margin-top:4px;}
.ldc-progbars{flex:1; min-width:0; display:flex; flex-direction:column; gap:13px;}
.ldc-pb-h{display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-bottom:5px;}
.ldc-pb-l b{font-size:12.5px; font-weight:650; color:var(--ink);}
.ldc-pb-l small{font-size:10.5px; color:var(--muted); margin-left:7px;}
.ldc-pb-v{font-size:13px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-pb-tk{display:block; height:9px; border-radius:99px; background:color-mix(in srgb,var(--muted) 12%,transparent); overflow:hidden;}
.ldc-pb-tk i{display:block; height:100%; border-radius:99px; background:var(--accent);}
.ldc-pb-tk i.good{background:var(--good);} .ldc-pb-tk i.warn{background:var(--warn);} .ldc-pb-tk i.bad{background:var(--bad);}
.ldc-na{font-style:normal; font-size:13px; font-weight:600; color:var(--muted);}
.ldc-struct{display:grid; grid-template-columns:repeat(5,1fr); gap:10px; margin-top:16px; padding-top:16px; border-top:1px solid var(--grid);}
.ldc-struct-t{display:flex; flex-direction:column; align-items:flex-start; gap:7px; padding:12px; border-radius:11px; background:color-mix(in srgb,var(--muted) 5%,var(--surface)); border:1px solid var(--grid);}
.ldc-struct-t b{font-size:18px; font-weight:750; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1;}
.ldc-struct-t span{font-size:10.5px; color:var(--muted); font-weight:500;}

/* attention feed */
.ldc-attn{display:flex; flex-direction:column;}
.ldc-badge2{margin-left:auto; font-size:11px; font-weight:700; color:#fff; background:var(--bad); border-radius:99px; padding:1px 9px; line-height:17px;}
.ldc-feed-h{font-size:10px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); margin:16px 0 8px;}
.ldc-feed{display:flex; flex-direction:column; gap:6px;}
.ldc-feed-i{display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:10px; background:color-mix(in srgb,var(--bad) 5%,var(--surface)); border:1px solid color-mix(in srgb,var(--bad) 13%,transparent);}
.ldc-feed-ic{width:27px; height:27px; border-radius:8px; display:grid; place-items:center; flex:0 0 auto; background:color-mix(in srgb,var(--bad) 13%,transparent); color:var(--bad);}
.ldc-feed-b{flex:1; min-width:0;}
.ldc-feed-b b{display:block; font-size:12.5px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldc-feed-b small{display:block; font-size:10.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldc-feed-r{display:flex; align-items:center; gap:7px; flex:0 0 auto;}
.ldc-feed-more{display:inline-block; margin-top:8px; font-size:11.5px; font-weight:650; color:var(--accent-ink); text-decoration:none;}
.ldc-feed-more:hover{text-decoration:underline;}
.ldc-feed-ok{text-align:center; padding:22px 10px; display:flex; flex-direction:column; align-items:center; gap:3px;}
.ldc-feed-okico{width:42px; height:42px; border-radius:13px; display:grid; place-items:center; background:color-mix(in srgb,var(--good) 12%,transparent); color:var(--good); margin-bottom:6px;}
.ldc-feed-ok b{font-size:13.5px; color:var(--ink);}
.ldc-feed-ok span{font-size:11.5px; color:var(--muted); max-width:34ch;}

/* risk distribution rows */
.ldc-distrows{display:flex; flex-direction:column; margin-top:14px;}
.ldc-distrow{display:flex; align-items:center; gap:10px; padding:7px 0; font-size:12.5px; border-bottom:1px solid var(--grid);}
.ldc-distrow:last-child{border-bottom:none;}
.ldc-distrow .dot{width:10px; height:10px; border-radius:3px; flex:0 0 auto;}
.ldc-distrow .lb{flex:1; color:var(--ink); font-weight:600; display:flex; align-items:baseline; gap:7px; min-width:0;}
.ldc-distrow .lb small{color:var(--muted); font-weight:500; font-size:10.5px;}
.ldc-distrow .ct{font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldc-distrow .sh{flex:0 0 42px; text-align:right; color:var(--muted); font-variant-numeric:tabular-nums;}

/* pulse strip (vivid summary) */
.ldc-pulse{display:grid; grid-template-columns:repeat(4,1fr); gap:14px;}
.ldc-pulse-t{border-radius:14px; padding:16px 17px; color:#fff; display:flex; flex-direction:column; box-shadow:0 10px 26px -14px rgba(23,19,15,.5);}
.ldc-pulse-top{display:flex; align-items:center; justify-content:space-between; margin-bottom:9px;}
.ldc-pulse-top svg{opacity:.85;}
.ldc-pulse-top b{font-size:22px; font-weight:750; font-variant-numeric:tabular-nums; line-height:1;}
.ldc-pulse-t span{font-size:12px; font-weight:600; opacity:.96;}
.ldc-pulse-t em{font-style:normal; font-size:10.5px; opacity:.82; margin-top:3px;}

/* triage / table helpers */
.ldc-tag{display:inline-block; font-size:10.5px; font-weight:600; color:var(--ink2); background:color-mix(in srgb,var(--muted) 11%,transparent); border-radius:6px; padding:2px 8px; white-space:nowrap;}
.ldc-list td small.mut{color:var(--muted); font-weight:400;}
.pctv{font-size:11.5px; font-weight:650; color:var(--ink); font-variant-numeric:tabular-nums; vertical-align:middle;}
.ldc-compbar{position:relative; display:inline-block; vertical-align:middle; width:96px; height:7px; border-radius:99px; background:color-mix(in srgb,var(--muted) 13%,transparent); margin-right:8px;}
.ldc-compbar i{display:block; height:100%; border-radius:99px; background:var(--accent);}
.ldc-compbar i.good{background:var(--good);} .ldc-compbar i.warn{background:var(--warn);} .ldc-compbar i.bad{background:var(--bad);} .ldc-compbar i.neutral{background:#C9C1B8;}
.ldc-compbar .tick{position:absolute; top:-2px; bottom:-2px; width:2px; background:var(--ink); opacity:.5; border-radius:2px;}
.ldc-th{background:none; border:none; padding:0; margin:0; font:inherit; cursor:pointer; color:inherit; font-size:9.5px; font-weight:700; letter-spacing:.09em; text-transform:uppercase;}
.ldc-th:hover{color:var(--accent-ink);}
.ldc-tbl td{vertical-align:middle;}
.ldc-mix{display:inline-flex; vertical-align:middle; width:120px; height:8px; border-radius:99px; overflow:hidden; background:color-mix(in srgb,var(--muted) 12%,transparent); gap:1px;}
.ldc-mix i{height:100%;}
.ldc-microf{display:inline-flex; align-items:flex-end; gap:3px; height:22px; vertical-align:middle;}
.ldc-microf i{width:6px; background:var(--accent); opacity:.8; border-radius:2px 2px 0 0;}

/* skeleton */
.ldc-sk{display:block; border-radius:7px; background:linear-gradient(90deg,color-mix(in srgb,var(--muted) 9%,transparent),color-mix(in srgb,var(--muted) 18%,transparent),color-mix(in srgb,var(--muted) 9%,transparent)); background-size:200% 100%; animation:ldcsk 1.2s ease-in-out infinite;}
@keyframes ldcsk{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
.ldc-sk-k{width:55%; height:11px; margin-bottom:12px;}
.ldc-sk-v{width:70%; height:28px; margin-bottom:12px;}
.ldc-sk-s{width:42%; height:10px;}
.ldc-sk-row{width:100%; height:22px; margin:9px 0;}

@media (max-width:960px){ .ldc-stats{grid-template-columns:repeat(2,1fr);} }
@media (max-width:900px){ .ldc-main2{grid-template-columns:1fr;} .ldc-pulse{grid-template-columns:repeat(2,1fr);} }
@media (max-width:640px){ .ldc-struct{grid-template-columns:repeat(2,1fr);} }
@media (max-width:520px){ .ldc-stats,.ldc-pulse{grid-template-columns:1fr;} }

/* ═══ Manager dashboard (mock-parity layout) ═══ */
.ldm-hdr{display:flex; align-items:center; gap:20px; flex-wrap:wrap; margin-bottom:20px;}
.ldm-hdr-l{min-width:0;}
.ldm-hdr-l h1{margin:0; font-size:22px; font-weight:750; letter-spacing:-.02em; color:var(--ink); line-height:1.15;}
.ldm-hdr-l .ldc-scope{margin:5px 0 0; font-size:12.5px; color:var(--ink2);}
.ldm-scopesub{color:var(--muted);}
.ldm-hdr-r{margin-left:auto; display:flex; align-items:center; gap:10px;}
.ldm-search{display:flex; align-items:center; gap:8px; background:color-mix(in srgb,var(--muted) 7%,var(--surface)); border:1px solid var(--border); border-radius:10px; padding:0 12px; height:40px; width:248px; max-width:38vw; transition:border-color .15s, box-shadow .15s;}
.ldm-search:focus-within{border-color:var(--accent); box-shadow:0 0 0 3px var(--wash); background:var(--surface);}
.ldm-search svg{stroke:var(--muted); flex:0 0 auto;}
.ldm-search input{flex:1; min-width:0; border:none; outline:none; background:none; font:inherit; font-size:12.5px; color:var(--ink);}
.ldm-search input::placeholder{color:var(--muted);}
.ldm-ib{position:relative; width:40px; height:40px; border-radius:10px; border:1px solid var(--border); background:var(--surface); display:grid; place-items:center; color:var(--ink2); cursor:pointer; text-decoration:none; transition:border-color .15s, color .15s;}
.ldm-ib:hover{border-color:var(--accent); color:var(--accent-ink);}
.ldm-ib-dot{position:absolute; top:-5px; right:-5px; min-width:17px; height:17px; padding:0 4px; border-radius:99px; background:var(--bad); color:#fff; font-size:9.5px; font-weight:700; font-style:normal; display:grid; place-items:center; border:2px solid var(--surface);}
.ldm-avatar{width:40px; height:40px; border-radius:99px; display:grid; place-items:center; font-size:12px; font-weight:700; color:#fff; background:linear-gradient(150deg,var(--accent),#8A3A06); box-shadow:0 4px 12px -4px rgba(226,103,15,.35); flex:0 0 auto; letter-spacing:.02em;}
.ldm-top{display:grid; grid-template-columns:minmax(0,1fr) 280px; gap:16px; align-items:start;}
.ldm-kpis{display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px;}
.ldm-qa{margin-bottom:0; padding-bottom:8px;}
.ldm-qa-i{display:flex; align-items:center; gap:10px; padding:7px 9px; border-radius:10px; border:1px solid var(--grid); margin-bottom:7px; text-decoration:none; color:var(--ink); font-size:12.5px; font-weight:600; background:color-mix(in srgb,var(--muted) 4%,var(--surface)); transition:border-color .15s;}
.ldm-qa-i:hover{border-color:var(--accent);}
.ldm-qa-i .ldc-ichip{width:30px; height:30px; border-radius:9px;}
.ldm-qa-i .chev{margin-left:auto; color:var(--muted); flex:0 0 auto;}
.ldm-qa-b{font-size:10.5px; font-weight:700; color:#fff; background:var(--bad); border-radius:99px; padding:1px 8px; margin-left:auto;}
.ldm-qa-b~.chev{margin-left:6px;}
.ldm-mid{display:grid; grid-template-columns:1.02fr 1.25fr 1.08fr; gap:16px; align-items:start;}
.ldm-bot{display:grid; grid-template-columns:1.12fr 1.25fr 1fr 1fr; gap:16px; align-items:start;}
.ldm-mid .ldc-panel,.ldm-bot .ldc-panel{margin-bottom:0;}
.ldm-pa{margin-left:auto; font-size:11px;}
.ldc-panel-h .ldc-badge2+.ldm-pa{margin-left:8px;}
.ldm-vh{max-height:330px; overflow-y:auto;}
.ldm-tbl{width:100%; border-collapse:collapse; font-size:12px;}
.ldm-tbl th{text-align:left; font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); padding:5px 8px 7px; border-bottom:1px solid var(--grid); position:sticky; top:0; background:var(--surface);}
.ldm-tbl th.r,.ldm-tbl td.r{text-align:right; font-variant-numeric:tabular-nums;}
.ldm-tbl td{padding:8px; border-bottom:1px solid var(--grid); vertical-align:middle; color:var(--ink2);}
.ldm-tbl tr:last-child td{border-bottom:none;}
.ldm-tbl td small{color:var(--muted); font-size:10.5px;}
.ldm-av{width:28px; height:28px; border-radius:99px; display:inline-grid; place-items:center; font-size:10px; font-weight:700; color:#fff; flex:0 0 auto; letter-spacing:.02em;}
.ldm-who{display:flex; align-items:center; gap:9px; min-width:0;}
.ldm-who b{display:block; font-size:12px; color:var(--ink); font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:130px;}
.ldm-who small{display:block; font-size:10px; color:var(--muted);}
.pctv.good{color:var(--good-ink);} .pctv.warn{color:color-mix(in srgb,var(--warn) 78%,var(--ink));} .pctv.bad{color:var(--bad);}
.ldm-cl{border:1px solid var(--grid); border-radius:12px; padding:12px 13px; margin-bottom:10px; background:color-mix(in srgb,var(--accent) 3%,var(--surface));}
.ldm-cl:last-child{margin-bottom:0;}
.ldm-cl-h{display:flex; align-items:center; gap:9px; margin-bottom:10px;}
.ldm-cl-h .ldc-ichip{width:30px; height:30px; border-radius:9px;}
.ldm-cl-h b{font-size:13px; font-weight:700; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldm-cl-h .ldc-spark{margin-left:auto; height:22px; width:64px; flex:0 0 auto;}
.ldm-cl-g{display:grid; grid-template-columns:repeat(5,1fr); gap:6px;}
.ldm-ms{min-width:0;}
.ldm-ms span{display:block; font-size:8.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.ldm-ms b{display:block; font-size:14px; font-weight:750; color:var(--ink); margin-top:3px; font-variant-numeric:tabular-nums;}
.ldm-ms b.good{color:var(--good-ink);} .ldm-ms b.warn{color:color-mix(in srgb,var(--warn) 78%,var(--ink));} .ldm-ms b.bad{color:var(--bad);}
.ldm-strip5{display:grid; grid-template-columns:repeat(5,1fr); gap:6px; margin-bottom:12px;}
.ldm-strip5 .ldm-ms{border:1px solid var(--grid); border-radius:9px; padding:8px 8px 9px; background:color-mix(in srgb,var(--muted) 4%,var(--surface));}
.ldm-wk{display:flex; gap:8px; align-items:stretch; height:132px; padding-top:4px;}
.ldm-wk .c{flex:1; display:flex; flex-direction:column; align-items:center; gap:5px; min-width:0; justify-content:flex-end;}
.ldm-wk .t{width:68%; max-width:34px; background:color-mix(in srgb,var(--accent) 10%,transparent); border-radius:7px; display:flex; align-items:flex-end; overflow:hidden; flex:1;}
.ldm-wk .f{width:100%; background:linear-gradient(180deg,var(--accent),#B94E08); border-radius:7px 7px 0 0;}
.ldm-wk .v{font-size:9.5px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldm-wk .l{font-size:9px; color:var(--muted); white-space:nowrap; max-width:100%; overflow:hidden; text-overflow:ellipsis;}
.ldm-tp-tags{display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;}
.ldm-act{display:flex; flex-direction:column;}
.ldm-act-i{display:flex; gap:10px; padding:7px 0; border-bottom:1px solid var(--grid);}
.ldm-act-i:last-child{border-bottom:none;}
.ldm-act-i .dot{width:9px; height:9px; border-radius:99px; margin-top:5px; flex:0 0 auto;}
.ldm-act-b{min-width:0; flex:1;}
.ldm-act-b .tm{display:block; font-size:9.5px; color:var(--muted); font-variant-numeric:tabular-nums; margin-bottom:1px;}
.ldm-act-b b{display:block; font-size:12px; font-weight:600; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldm-act-b small{display:block; font-size:10.5px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldm-alert{display:flex; align-items:center; gap:9px; padding:8px 10px; border-radius:10px; border:1px solid; margin-bottom:7px; text-decoration:none; font-size:12px; font-weight:600;}
.ldm-alert svg{flex:0 0 auto;}
.ldm-alert span{flex:1; min-width:0;}
.ldm-alert>b{font-size:10.5px; font-weight:700; color:#fff; border-radius:99px; padding:1px 8px;}
.ldm-alert.bad{color:var(--bad); background:color-mix(in srgb,var(--bad) 6%,transparent); border-color:color-mix(in srgb,var(--bad) 18%,transparent);} .ldm-alert.bad>b{background:var(--bad);}
.ldm-alert.warn{color:color-mix(in srgb,var(--warn) 80%,var(--ink)); background:color-mix(in srgb,var(--warn) 8%,transparent); border-color:color-mix(in srgb,var(--warn) 24%,transparent);} .ldm-alert.warn>b{background:color-mix(in srgb,var(--warn) 85%,var(--ink));}
.ldm-alert.neutral{color:var(--ink2); background:color-mix(in srgb,var(--muted) 7%,transparent); border-color:var(--grid);} .ldm-alert.neutral>b{background:var(--muted);}
.ldm-donutrow{display:flex; align-items:center; gap:18px; margin-top:14px; padding-top:14px; border-top:1px solid var(--grid);}
.ldm-donutrow .ldc-legend{flex-direction:column; align-items:flex-start; gap:8px; justify-content:flex-start;}
@media (max-width:1150px){ .ldm-mid{grid-template-columns:1fr 1fr;} .ldm-bot{grid-template-columns:1fr 1fr;} }
@media (max-width:980px){ .ldm-top{grid-template-columns:1fr;} .ldm-kpis{grid-template-columns:repeat(2,1fr);} }
@media (max-width:700px){ .ldm-mid,.ldm-bot{grid-template-columns:1fr;} }
@media (max-width:460px){ .ldm-kpis{grid-template-columns:1fr;} .ldm-cl-g,.ldm-strip5{grid-template-columns:repeat(3,1fr); row-gap:10px;} }

/* content review (assignments & assessments) */
.ldc-cbar{display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; margin-bottom:14px;}
.ldc-cfield{display:flex; flex-direction:column; gap:5px;}
.ldc-cfield>span{font-size:9px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; color:var(--muted);}
.ldc-cfield select{font:inherit; font-size:12.5px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--border); border-radius:9px; padding:8px 11px; min-width:260px; max-width:440px; cursor:pointer;}
.ldc-cfield select:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--border));}
.ldc-seg{display:inline-flex; background:color-mix(in srgb,var(--muted) 9%,transparent); border-radius:9px; padding:3px; gap:2px;}
.ldc-seg button{border:none; background:none; font:inherit; font-size:12px; font-weight:600; color:var(--ink2); padding:6px 13px; border-radius:7px; cursor:pointer;}
.ldc-seg button.on{background:var(--surface); color:var(--accent-ink); box-shadow:0 1px 3px rgba(23,19,15,.1);}
/* underline text tabs (leaner than the pill segmented control) */
.ldc-tabs{display:inline-flex; gap:22px; border-bottom:1px solid var(--grid);}
.ldc-tabs button{background:none; border:none; margin:0; padding:0 1px 8px; font:inherit; font-size:13px; font-weight:600; color:var(--muted); cursor:pointer; position:relative;}
.ldc-tabs button:hover{color:var(--ink);}
.ldc-tabs button.on{color:var(--accent-ink); font-weight:700;}
.ldc-tabs button.on::after{content:""; position:absolute; left:0; right:0; bottom:-1px; height:2px; background:var(--accent); border-radius:2px 2px 0 0;}
.ldc-chint{font-size:11.5px; color:var(--muted);}
.ldc-chint b{color:var(--ink2); font-weight:650;}
.ldc-csum{display:flex; flex-wrap:wrap; gap:10px; margin-bottom:18px;}
.ldc-cchip{font-size:12px; color:var(--ink2); background:var(--surface); border:1px solid var(--border); border-radius:9px; padding:7px 12px;}
.ldc-cchip b{color:var(--ink); font-weight:750; font-variant-numeric:tabular-nums;}
.ldc-ccourse{margin-bottom:26px;}
.ldc-ccourse-h{display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:0 0 12px; margin-bottom:14px; border-bottom:2px solid var(--grid);}
.ldc-ccourse-t{display:flex; align-items:baseline; gap:9px; min-width:0;}
.ldc-ccourse-t b{font-size:15px; font-weight:700; color:var(--ink); letter-spacing:-.01em;}
.ldc-ccourse-t small{font-size:11.5px; color:var(--muted);}
.ldc-ccourse-meta{margin-left:auto; font-size:11px; font-weight:600; color:var(--ink2); background:color-mix(in srgb,var(--muted) 8%,transparent); border-radius:8px; padding:5px 11px; font-variant-numeric:tabular-nums;}
.ldc-cmod{margin-bottom:22px;}
.ldc-cmod-h{font-size:13px; font-weight:700; color:var(--ink); letter-spacing:-.01em; padding-bottom:8px; border-bottom:2px solid var(--grid); margin-bottom:12px;}
.ldc-ctopic{margin:0 0 14px;}
.ldc-ctopic-h{font-size:10px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); margin:0 0 8px 2px;}
.ldc-ex{background:var(--surface); border:1px solid var(--border); border-radius:12px; box-shadow:var(--sh); margin-bottom:8px; overflow:hidden;}
.ldc-ex.open{border-color:color-mix(in srgb,var(--accent) 35%,var(--border));}
.ldc-ex-h{display:flex; align-items:center; gap:12px; width:100%; text-align:left; background:none; border:none; font:inherit; padding:12px 14px; cursor:pointer;}
.ldc-ex-h:hover{background:color-mix(in srgb,var(--accent) 3%,transparent);}
.ldc-ex-h.static{cursor:default;}
.ldc-ex-h.static:hover{background:none;}
.ldc-ex-kind{flex:0 0 auto; font-size:9.5px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; border-radius:6px; padding:4px 8px; white-space:nowrap;}
.ldc-ex-kind.ido{color:#22688F; background:color-mix(in srgb,#2E90C4 14%,transparent);}
.ldc-ex-kind.assign{color:var(--accent-ink); background:var(--wash);}
.ldc-ex-kind.assess{color:#5B44C7; background:color-mix(in srgb,#7C5CFC 13%,transparent);}
.ldc-ex-main{flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;}
.ldc-ex-main b{font-size:13px; font-weight:650; color:var(--ink); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.ldc-ex-main small{font-size:10.5px; color:var(--muted);}
.ldc-ex-meta{flex:0 0 auto; display:flex; align-items:center; gap:7px;}
.ldc-ex-qn{font-size:11px; font-weight:700; color:var(--ink2); font-variant-numeric:tabular-nums;}
.ldc-ex-cv{width:15px; height:15px; stroke:var(--muted); transition:transform .16s;}
.ldc-ex.open .ldc-ex-cv{transform:rotate(180deg);}
.ldc-ex-body{padding:2px 14px 10px; border-top:1px solid var(--grid);}
.ldc-q{padding:11px 0; border-bottom:1px solid var(--grid);}
.ldc-q:last-child{border-bottom:none;}
.ldc-q-h{display:flex; align-items:center; gap:9px;}
.ldc-q-n{flex:0 0 auto; width:22px; height:22px; border-radius:6px; background:color-mix(in srgb,var(--muted) 12%,transparent); color:var(--ink2); font-size:11px; font-weight:700; display:grid; place-items:center; font-variant-numeric:tabular-nums;}
.ldc-q-type{flex:0 0 auto; font-size:9.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color:var(--accent-ink); background:var(--wash); border-radius:5px; padding:2px 7px;}
.ldc-q-title{flex:1; min-width:0; font-size:12.5px; color:var(--ink); font-weight:500;}
.ldc-q-meta{font-size:10.5px; color:var(--muted); margin:5px 0 0 31px; text-transform:capitalize;}
.ldc-q-opts{list-style:none; margin:7px 0 0 31px; padding:0; display:flex; flex-direction:column; gap:4px;}
.ldc-q-opts li{font-size:12px; color:var(--ink2); padding:4px 10px; border-radius:6px; background:color-mix(in srgb,var(--muted) 6%,transparent);}
.ldc-q-opts li.ok{color:var(--good-ink); background:color-mix(in srgb,var(--good) 10%,transparent); font-weight:600;}

/* attendance: date/range control, filters, register, matrix */
.ldc-seg.sm button{font-size:11px; padding:5px 10px;}
.ldc-attctl{display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-bottom:16px; padding:11px 13px; background:color-mix(in srgb,var(--muted) 4%,var(--surface)); border:1px solid var(--grid); border-radius:11px;}
.ldc-daynav{display:inline-flex; align-items:center; gap:6px;}
.ldc-rlab{font-size:10px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--muted);}
.ldc-navbtn{width:28px; height:28px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--ink2); font-size:15px; line-height:1; cursor:pointer; display:grid; place-items:center;}
.ldc-navbtn:hover{border-color:var(--accent); color:var(--accent-ink);}
.ldc-mini{font:inherit; font-size:12px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--border); border-radius:8px; padding:6px 9px; cursor:pointer;}
.ldc-mini:hover{border-color:color-mix(in srgb,var(--accent) 40%,var(--border));}
.ldc-search{cursor:text; min-width:170px; font-weight:500;}
.ldc-todaybtn{font-weight:650; color:var(--ink2);}
.ldc-filters{display:inline-flex; align-items:center; gap:10px; flex-wrap:wrap; margin-left:auto;}
.ldc-daysum{display:flex; flex-wrap:wrap; gap:6px; margin-bottom:2px;}
.ldc-dchip{font-size:11px; font-weight:650; border-radius:7px; padding:3px 9px; border:1px solid transparent; font-variant-numeric:tabular-nums;}
/* day-summary badges tucked into the list header (no separate row) */
.ldc-list-h{flex-wrap:wrap; row-gap:6px;}
.ldc-list-h .ldc-daysum{margin:0 0 0 auto; gap:6px;}
.ldc-list-h .ldc-dchip{font-size:10.5px; font-weight:650; padding:3px 9px; border-radius:7px;}
.ldc-dchip.good{color:var(--good-ink); background:color-mix(in srgb,var(--good) 11%,transparent); border-color:color-mix(in srgb,var(--good) 22%,transparent);}
.ldc-dchip.bad{color:var(--bad); background:color-mix(in srgb,var(--bad) 10%,transparent); border-color:color-mix(in srgb,var(--bad) 22%,transparent);}
.ldc-dchip.warn{color:color-mix(in srgb,var(--warn) 78%,var(--ink)); background:color-mix(in srgb,var(--warn) 13%,transparent); border-color:color-mix(in srgb,var(--warn) 26%,transparent);}
.ldc-dchip.neutral{color:var(--ink2); background:color-mix(in srgb,var(--muted) 11%,transparent); border-color:var(--grid);}
/* register matrix */
.ldc-mx{border-collapse:separate; border-spacing:0;}
.ldc-mx th.c, .ldc-mx td.c{text-align:center; padding:6px 7px !important; white-space:nowrap;}
.ldc-mx th.stick, .ldc-mx td.stick{position:sticky; left:0; z-index:2; background:var(--surface); box-shadow:1px 0 0 var(--grid);}
.ldc-mx thead th.stick{z-index:3;}
.ldc-mxc{display:inline-grid; place-items:center; width:22px; height:22px; border-radius:6px; font-size:10.5px; font-weight:700; color:var(--ink2); background:color-mix(in srgb,var(--muted) 9%,transparent);}
.ldc-mxc.good{color:#fff; background:var(--good);}
.ldc-mxc.bad{color:#fff; background:var(--bad);}
.ldc-mxc.warn{color:#fff; background:var(--warn);}
.ldc-mxc.none{color:var(--muted); background:color-mix(in srgb,var(--muted) 8%,transparent);}
/* Attendance fills the workspace panel; the list flex-grows so it reaches the
   bottom on every tab (matrix, register, summary) with no page scroll —
   regardless of how much sits above it. 88 = workspace gutter 14+14 + panel
   border 2 + content pad 20+36 + a small buffer; the wider paddings on large
   monitors are matched below. */
.ldc-attfill{height:calc(100vh - 88px); display:flex; flex-direction:column; min-height:0; overflow:hidden;}
@media (min-width:1600px){ .ldc-attfill{height:calc(100vh - 96px);} }
@media (min-width:1920px){ .ldc-attfill{height:calc(100vh - 104px);} }
.ldc-listfill{margin-top:2px;}
.ldc-attfill .ldc-listfill{flex:1 1 auto; min-height:0; display:flex; flex-direction:column; margin-bottom:0;}
.ldc-attfill .ldc-listfill .ldc-list-h{flex:0 0 auto;}
.ldc-attfill .ldc-listfill .ldc-scroll{flex:1 1 auto; min-height:0; max-height:none;}
@media (max-width:900px){ .ldc-attfill{height:auto; overflow:visible;} .ldc-attfill .ldc-listfill .ldc-scroll{flex:none;} }

/* ═════════ Reports (ldr-) ═════════ */
/* Validated categorical palette (adjacent CVD ΔE ≥ 8 on the white surface;
   the two light hues get relief via direct value labels + table twins).
   New custom properties only — nothing here overrides shell rules. */
.ldx{--ch1:#eb6834; --ch2:#2a78d6; --ch3:#1baf7a; --ch4:#eda100; --ch5:#4a3aa7;}
.dark .ldx{--ch1:#d95926; --ch2:#3987e5; --ch3:#199e70; --ch4:#c98500; --ch5:#9085e9;}
/* min(300px,100%): the track minimum must collapse to the container on narrow
   phones (360px viewports) or the grid overflows the panel horizontally. */
.ldr-two{display:grid; grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr)); gap:14px;}
.ldr-two .ldc-panel{margin-bottom:14px;}
/* horizontal bars */
.ldr-bars{display:grid; gap:8px;}
.ldr-bar{display:grid; grid-template-columns:minmax(90px,1.1fr) 2fr 52px; align-items:center; gap:10px;}
.ldr-bar-l{font-size:11.5px; font-weight:500; color:var(--ink2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
.ldr-bar-l small{font-size:10px; color:var(--muted); font-weight:500;}
.ldr-track{display:flex; gap:2px; height:10px; border-radius:5px; background:color-mix(in srgb,var(--muted) 9%,transparent); overflow:hidden;}
.ldr-fill{display:block; height:100%; border-radius:0 4px 4px 0; min-width:2px;}
.ldr-stack .ldr-fill{border-radius:0;}
.ldr-stack .ldr-fill:last-child{border-radius:0 4px 4px 0;}
.ldr-bar-v{font-size:11.5px; font-weight:600; color:var(--ink); text-align:right; font-variant-numeric:tabular-nums;}
.ldr-legendrow{display:flex; flex-wrap:wrap; gap:12px; margin-bottom:2px;}
/* vertical columns */
.ldr-cols{display:flex; align-items:stretch; gap:14px; height:130px; padding-top:4px;}
.ldr-col{flex:1 1 0; display:flex; flex-direction:column; align-items:center; gap:4px; min-width:0;}
.ldr-col b{font-size:11px; font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldr-coltrack{flex:1 1 auto; width:100%; max-width:38px; display:flex; align-items:flex-end; border-radius:5px; background:color-mix(in srgb,var(--muted) 7%,transparent);}
.ldr-colfill{display:block; width:100%; border-radius:4px 4px 0 0;}
.ldr-collab{font-size:10px; color:var(--muted); font-weight:600; white-space:nowrap;}
/* donut */
.ldr-donutwrap{display:flex; align-items:center; gap:18px; flex-wrap:wrap;}
.ldr-donut{width:128px; height:128px; flex:0 0 auto;}
.ldr-donut-n{font-size:15px; font-weight:750; fill:var(--ink);}
.ldr-donut-s{font-size:7.5px; font-weight:600; fill:var(--muted); text-transform:uppercase; letter-spacing:.06em;}
.ldr-legend{display:grid; gap:6px; min-width:0;}
.ldr-leg{display:flex; align-items:center; gap:7px; font-size:11.5px; font-weight:600; color:var(--ink2);}
.ldr-leg b{margin-left:auto; padding-left:14px; font-variant-numeric:tabular-nums; color:var(--ink);}
.ldr-dot{width:9px; height:9px; border-radius:3px; flex:0 0 auto;}
/* trend line */
.ldr-trend{width:100%; height:auto; display:block;}
.ldr-axis{stroke:var(--grid); stroke-width:1;}
.ldr-tl{font-size:11px; font-weight:700; fill:var(--ink);}
.ldr-tx{font-size:9.5px; fill:var(--muted);}
/* table extras */
.ldr-th{cursor:pointer; user-select:none;}
.ldr-th:hover{color:var(--ink);}
.ldr-arrow{margin-left:4px; font-size:8px;}
/* inline stats line (review-submission report style) */
.ldr-stats{display:flex; flex-wrap:wrap; align-items:baseline; gap:4px 0; font-size:12.5px; color:var(--ink2); margin:2px 0 14px;}
.ldr-stat .lab{color:var(--muted);}
.ldr-stat b{font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums;}
.ldr-stat b.good{color:var(--good-ink);}
.ldr-stat b.warn{color:color-mix(in srgb,var(--warn) 80%,var(--ink));}
.ldr-stat b.bad{color:var(--bad);}
.ldr-stat .sep{font-style:normal; color:var(--grid); margin:0 10px;}
/* flat labeled filter row above a table */
.ldr-filters{display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px; margin:0 0 10px;}
.ldr-searchwrap{display:inline-flex; align-items:center; gap:6px; background:var(--surface); border:1px solid var(--border); border-radius:9px; padding:0 4px 0 9px; color:var(--muted);}
.ldr-searchwrap:focus-within{border-color:var(--accent);}
.ldr-search{font:inherit; font-size:12px; color:var(--ink); background:transparent; border:none; padding:6px 6px 6px 0; width:180px; outline:none;}
.ldr-flab{display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; color:var(--muted); white-space:nowrap;}
.ldr-sel{font:inherit; font-size:12px; font-weight:600; color:var(--ink); background:var(--surface); border:1px solid var(--border); border-radius:9px; padding:5px 8px; outline:none; cursor:pointer;}
.ldr-sel:focus{border-color:var(--accent);}
/* pagination footer (review-submission report style) */
.ldr-pgn{display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:8px 14px; padding:10px 15px; border-top:1px solid var(--grid);}
.ldr-pgn-info{font-size:12px; color:var(--muted);}
.ldr-pgn-ctl{display:flex; flex-wrap:wrap; align-items:center; gap:8px 16px;}
.ldr-pgn-pages{display:inline-flex; align-items:center; gap:3px;}
.ldr-pbtn{display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; border:1px solid var(--border); background:var(--surface); color:var(--ink2); font:inherit; font-size:12px; font-weight:650; cursor:pointer;}
.ldr-pbtn.num{border-color:transparent;}
.ldr-pbtn.num.on{background:var(--accent); color:#fff;}
.ldr-pbtn:hover:not(:disabled):not(.on){background:color-mix(in srgb,var(--muted) 9%,transparent);}
.ldr-pbtn:disabled{opacity:.4; cursor:not-allowed;}
.ldr-pdots{width:22px; text-align:center; font-size:12px; color:var(--muted);}
/* comments feed */
.ldr-comments{display:grid; gap:10px;}
.ldr-comment p{margin:0; font-size:12.5px; color:var(--ink); line-height:1.5;}
.ldr-comment small{font-size:10.5px; color:var(--muted);}
.ldr-comment{border-left:2px solid color-mix(in srgb,var(--accent) 45%,transparent); padding-left:10px;}
/* print-only scope line */
.ldc-printmeta{display:none;}

/* ═════════ Report builder (rep-performance) ═════════ */
.ldr-toolbar{display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:0 0 12px;}
.ldr-toolbar .grow{flex:1 1 auto;}
.ldc-btn.on{border-color:var(--accent); color:var(--accent);}
.ldc-btn:disabled{opacity:.55; cursor:not-allowed;}
/* generated document */
.ldr-doc{background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:16px 18px; box-shadow:var(--sh);}
.ldr-doc-h{padding-bottom:10px; border-bottom:1px solid var(--grid); margin-bottom:14px;}
.ldr-doc-h h2{margin:0; font-size:16px; font-weight:600; letter-spacing:-.01em; color:var(--ink);}
.ldr-doc-h p{margin:3px 0 0; font-size:11.5px; color:var(--muted);}
.ldr-sec{position:relative; margin:0 0 14px;}
.ldr-sec .ldc-panel-h{padding-right:30px;}
.ldr-sec .ldc-list-h{padding-right:38px;}
.ldr-x{position:absolute; top:9px; right:9px; z-index:2; display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; padding:0; border-radius:7px; border:1px solid var(--border); background:var(--surface); color:var(--muted); cursor:pointer;}
.ldr-x:hover{color:var(--bad); border-color:color-mix(in srgb,var(--bad) 45%,var(--border));}
/* students multi-pick */
.ldr-mp{position:relative;}
.ldr-mp-panel{position:absolute; right:0; top:calc(100% + 6px); z-index:60; width:270px; max-height:330px; display:flex; flex-direction:column; background:var(--surface); border:1px solid var(--border); border-radius:12px; box-shadow:0 14px 34px rgba(15,23,42,.18); padding:8px;}
.ldr-mp-list{overflow:auto; display:grid; gap:1px; margin-top:6px; min-height:0;}
.ldr-ck{display:flex; align-items:flex-start; gap:8px; font-size:12px; font-weight:600; color:var(--ink2); padding:5px 6px; border-radius:8px; cursor:pointer;}
.ldr-ck:hover{background:color-mix(in srgb,var(--muted) 8%,transparent);}
.ldr-ck input{accent-color:var(--accent); margin-top:1px; width:14px; height:14px; flex:0 0 auto; cursor:pointer;}
.ldr-ck small{display:block; font-size:10px; font-weight:500; color:var(--muted); overflow:hidden; text-overflow:ellipsis;}
.ldr-mp-actions{display:flex; gap:6px; margin-top:6px; padding-top:8px; border-top:1px solid var(--grid);}
.ldr-mp-actions button{font:inherit; font-size:11px; font-weight:650; color:var(--accent); background:none; border:none; cursor:pointer; padding:2px 4px;}

/* ═════════ Print ═════════
   The shell is a 100vh overflow:hidden construction — without these unlocks a
   print is one clipped page. Rail, bell, pickers and buttons disappear; the
   print-meta line states the scope instead. */
@media print{
  /* Print is ALWAYS the light rendering: next-themes keeps .dark on <html>
     during print, and .dark .ldx (0,2,0) beats .ldx (0,1,0) for the palette
     variables — without this re-declaration a dark-mode print puts near-white
     ink on white paper (backgrounds don't print by default). */
  .ldx, .dark .ldx{
    --page:#ffffff; --surface:#ffffff; --ink:#111827; --ink2:#374151; --muted:#6B7280;
    --grid:#EAECF0; --border:#E4E7EC;
    --ch1:#eb6834; --ch2:#2a78d6; --ch3:#1baf7a; --ch4:#eda100; --ch5:#4a3aa7;
  }
  .ldx{display:block !important; height:auto !important; overflow:visible !important; background:#fff !important;}
  .ldx-side, .ldx-bell{display:none !important;}
  .ldc-attfill{height:auto !important; overflow:visible !important;}
  .ldx-main{display:block !important; padding:0 !important; height:auto !important; overflow:visible !important;}
  .ldx-panel{display:block !important; border:none !important; border-radius:0 !important; box-shadow:none !important; height:auto !important; overflow:visible !important;}
  .ldx-content{height:auto !important; max-height:none !important; overflow:visible !important; padding:0 !important;}
  .ldc-head-r{display:none !important;}
  .ldc-printmeta{display:block; font-size:11px; color:#555; margin:-6px 0 14px; padding-bottom:8px; border-bottom:1px solid #ddd;}
  .ldc-scroll{max-height:none !important; overflow:visible !important;}
  .ldc-list, .ldc-panel{break-inside:avoid; box-shadow:none !important;}
  .ldc-list .ldc-scroll table thead th{position:static !important;}
  tr{break-inside:avoid;}
  .ldr-filters, .ldr-pgn, .ldr-searchwrap, .ldr-x, .ldr-toolbar, .ldr-mp-panel{display:none !important;}
  .ldr-doc{border:none !important; box-shadow:none !important; padding:0 !important;}
  .ldr-fill, .ldr-colfill, .ldr-dot, .ldc-chip, .ldc-dchip, .ldc-mxc, .ldr-trend, .ldr-donut{-webkit-print-color-adjust:exact; print-color-adjust:exact;}
}

`;
