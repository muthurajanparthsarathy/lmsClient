"use client";
import { getToken } from "@/lib/session";

import React, { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, MonitorPlay, Send,
  GraduationCap, Layers, BookOpen, ClipboardList, Tag, Filter, FileText,
  Download, Search,
} from "lucide-react";
import { getSocket } from "@/apiServices/socketClient";
import { useQuery } from "@tanstack/react-query";
import { courseDataApi } from "@/apiServices/coursesData";
import { useLiveDashboard } from "./hooks/useLiveDashboard";
import StudentRow, { deriveTestStatus } from "./components/StudentRow";
import ReportRow from "./components/ReportRow";
import StudentDetailsPage from "./components/StudentDetailsPage";
import MessageStudentModal from "./components/MessageStudentModal";
import BroadcastMessageModal from "./components/BroadcastMessageModal";
import ReportExportModal from "./components/ReportExportModal";
import type { StudentProgress, TestStatus } from "./types/liveDashboard.types";
import { computeStudentMarks, getStudentQuestionsBreakdown, getExerciseGradeBands, scaleForPercent, type QuestionBreakdownRow } from "./utils/computeStudentMarks";

// ── Top-level view: list (default), or report (the Caller Report table).
//    The per-student details view is keyed by `selectedStudentId` and overlays
//    either view.
type DashboardView = "list" | "report";

// Action column was removed (the only menu item it housed — "View Detailed
// Report" — is now reached via the inline expand chevron when the "Detailed
// Report" toggle is on). When the toggle is on we prepend a chevron column
// at the start; when off there's no expand affordance at all.
// "Percentage" sits right after "Scored Marks" — Reports view only. The
// list view doesn't show it because the list is the live-monitoring board
// and percentage is a post-hoc analysis number.
// "S. No." was removed from both views per design feedback — the row counter
// added visual noise without much value (student name + email already
// identify the row). The cell renderers in StudentRow / ReportRow have been
// updated to drop their leading index <td> to keep the column count in sync.
// Consolidated to 6 columns (per design feedback): Student = name + email
// stacked; Questions = "X / Y" + "N Remaining"; Marks = "X / Y". The kebab
// (Send Message / Check Answer / View Detailed Report) is a fixed trailing
// column so the row layout is always identical.
// "#" is a row-index column at the front, matching the We-Do exercise list
// where every row carries its ordinal.
const REPORT_HEADERS_BASE = [
  "#", "Student", "Questions", "Test Status", "Marks", "Percentage", "Scale",
];
const REPORT_LEFT_ALIGN = new Set(["Student"]);
const NARROW_COLS = new Set(["#"]);
// Sentinel used in the headers array for the trailing kebab column. Empty
// string is safe because no real header label is "".
const CHEVRON_COL = "";

const HEADERS = [
  "Student ID", "Student Name", "Email", "Test Status", "Time Duration", "Action",
];
const LEFT_ALIGN = new Set(["Student ID", "Student Name", "Email"]);

// Filter options surfaced in the Test Status dropdown.
type StatusFilter = "all" | TestStatus;
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",          label: "All Statuses"  },
  { value: "not-started",  label: "Not Started"   },
  { value: "started",      label: "Started"       },
  { value: "submitted",    label: "Submitted"     },
];

// Emit a proctor message over the shared socket and resolve with the server ack.
function emitWithAck(event: string, payload: Record<string, any>) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) => {
    let settled = false;
    const done = (r: { ok: boolean; error?: string }) => { if (!settled) { settled = true; resolve(r); } };
    try {
      getSocket().emit(event, payload, (resp: any) =>
        done(resp?.ok ? { ok: true } : { ok: false, error: resp?.error || "Failed to send" }));
    } catch {
      done({ ok: false, error: "Connection error" });
    }
    setTimeout(() => done({ ok: false, error: "Timed out — check your connection." }), 10000);
  });
}

// Windowed page list, e.g. [1, '…', 4, 5, 6, '…', 12].
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

function LiveDashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const assessmentId = params.get("assessmentId") || params.get("exerciseId") || "";
  const courseId = params.get("courseId") || "";
  const nodeId = params.get("nodeId") || "";
  const nodeType = params.get("nodeType") || "";
  const moduleName = params.get("moduleName") || "";
  const submoduleName = params.get("submoduleName") || "";
  const topicName = params.get("topicName") || "";
  const subtopicName = params.get("subtopicName") || "";
  const tabType = params.get("tabType") || "";
  const subcategory = params.get("subcategory") || "";

  // Open the Live Screen Monitoring page, forwarding the same context params.
  const openLiveScreens = () => {
    const qs = new URLSearchParams();
    if (assessmentId) { qs.set("assessmentId", assessmentId); qs.set("exerciseId", assessmentId); }
    if (courseId) qs.set("courseId", courseId);
    if (nodeId) qs.set("nodeId", nodeId);
    if (nodeType) qs.set("nodeType", nodeType);
    router.push(`/lms/pages/courses/liveScreens?${qs.toString()}`);
  };

  // (`goBackToCourses` moved further down — it has to be declared after the
  // `view` useState because it reads + writes that state. JavaScript
  // temporal-dead-zone rules don't allow a `useCallback` whose dependency
  // array references `view` before the binding is initialized.)

  const { students, totalStudents, assessmentName, courseName, isLoading, error } = useLiveDashboard({
    assessmentId, courseId, nodeId, nodeType,
  });

  // ── Marks side-channel ───────────────────────────────────────────────────
  // The `/api/assessment/live-dashboard` endpoint that powers the row list
  // doesn't return per-question scoring data — it's a summary stream. To
  // populate the Report view's Total Marks / Scored Marks columns, we
  // separately read the same `/getAll/courses-data/{courseId}` payload the
  // reviewSubmission page already uses. We deliberately reuse `courseDataApi.getById`
  // here so the query key (`["course", courseId]`) is shared with the courses
  // page — most users arrive at the dashboard FROM the courses page, so this
  // is a cache hit and adds zero network overhead.
  //
  // Computation runs frontend-side (`computeStudentMarks`) and mirrors
  // reviewSubmission's scoring rules 1:1, so the dashboard total matches what
  // a grader would see when opening that student's submission.
  const { data: courseDataResponse } = useQuery({
    ...courseDataApi.getById(courseId || ""),
    enabled: !!courseId && !!assessmentId,
    // Same cache settings used by the courses page so the query is shared,
    // not duplicated under different keys.
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Recompute marks whenever the course payload or the live student list
  // changes. The student list itself can grow via socket joins; merging here
  // (instead of inside `useLiveDashboard`) keeps the marks logic out of the
  // socket plumbing.
  const studentsWithMarks: StudentProgress[] = useMemo(() => {
    const courseData = (courseDataResponse as any)?.data;
    if (!courseData || !assessmentId) return students;
    const participants = (courseData.batchAndParticipants || []).flatMap((b: any) => b?.users || []);
    // Build a Set of user IDs whose role resolves to "student". The
    // live-dashboard backend returns ALL enrolled participants — staff,
    // coordinators, observers — but the Reports / list views are about
    // student performance, so non-student rows are filtered out here. We
    // mirror the backend's role check (see staffStudentAnalytics) which
    // looks at roleValue || renameRole, case-insensitive. If role data isn't
    // populated for a participant, we keep them rather than hide silently —
    // erring toward "show too many" instead of "hide a real student".
    const studentIds = new Set<string>();
    for (const p of participants) {
      const u = p?.user;
      if (!u?._id) continue;
      const r = u.role || {};
      const roleValue = (r.roleValue || r.renameRole || "").toString().toLowerCase();
      // No role info → keep, so we never accidentally drop a real student
      // because the populate didn't carry the role through.
      if (!roleValue || roleValue === "student") studentIds.add(u._id.toString());
    }
    // Performance-scale bands for THIS assessment (from Grade Settings),
    // resolved once so each student's percentage can be mapped to a label
    // (e.g. 50% → "Average") without re-walking the course tree per row.
    const gradeBands = getExerciseGradeBands(courseData, assessmentId);
    return students
      // Drop non-student rows (staff, coordinators, etc.) before enriching.
      // Rows whose ID we couldn't even find in `participants` are kept too —
      // same "don't hide silently" stance as above.
      .filter((s) => {
        const matchingParticipant = participants.find((p: any) => p?.user?._id === s.id || p?._id === s.id);
        if (!matchingParticipant) return true;
        const uid = matchingParticipant?.user?._id?.toString();
        return !uid || studentIds.has(uid);
      })
      .map((s) => {
      // Backend's live-dashboard rows key off the user's `_id`. Match by both
      // user._id and the participant document _id as a safety net for any
      // alternate caller that passes the participant id instead.
      const participant = participants.find((p: any) => p?.user?._id === s.id || p?._id === s.id);
      if (!participant) return s;
      const { totalMarks, scoredMarks, hasSubmitted, parentSubmitted, totalQuestions, completedQuestions } = computeStudentMarks({
        courseData,
        courseId: courseId || "",
        exerciseId: assessmentId,
        participant,
      });
      // Scale label — only when we have both a positive max and a stored score,
      // matching the Percentage column's gate so the two columns always agree.
      const canScale = hasSubmitted && totalMarks > 0 && typeof scoredMarks === "number";
      const scaleLabel = canScale
        ? scaleForPercent((scoredMarks / totalMarks) * 100, gradeBands) || undefined
        : undefined;
      return {
        ...s,
        totalMarks,
        // Override backend's totalQuestions/completed with courseData-derived
        // counts — the backend may under-count for Combined/Section-based
        // exercises (e.g. only counting MCQ or only Programming).
        totalQuestions,
        completed: completedQuestions,
        scoredMarks: hasSubmitted ? scoredMarks : undefined,
        scaleLabel,
        submitted: s.submitted || parentSubmitted,
      };
    });
  }, [students, courseDataResponse, assessmentId, courseId]);

  // `selectedStudentId` + StudentDetailsPage route stay intact — they are not
  // currently triggered from the row menu (the View Details entry was removed),
  // but the page still renders the details view if any other flow sets this.
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [messageStudentId, setMessageStudentId] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  // Drives the Report Export Preview modal — opened from the "Export" button
  // that lives just to the left of the Detailed Report toggle in the Reports
  // view's filter row.
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  // Reports-view-only filters. These don't apply in the live list view because
  // marks/scale aren't surfaced there — only the test lifecycle status is.
  const [searchQuery, setSearchQuery] = useState("");
  // Scale filter is a user-entered percentage range (from–to). Strings rather
  // than numbers so partially-typed values ("", "7") don't get coerced to 0
  // and instantly hide every row mid-typing.
  const [scaleFromPct, setScaleFromPct] = useState<string>("");
  const [scaleToPct, setScaleToPct] = useState<string>("");
  // Pass threshold is the conventional 50% — kept as a constant rather than a
  // user-tunable field so the filter stays a one-click action ("show fails").
  const PASS_THRESHOLD = 50;
  const [passFailFilter, setPassFailFilter] = useState<"all" | "pass" | "fail">("all");

  // ── Top-level view switch (list ↔ report). When the user opens the per-
  //    student details view from the report, we remember the originating view
  //    so the breadcrumb / back button returns to the correct table.
  //
  // Default view is REPORT — the consolidated per-student result table.
  // The old "list" view (Student ID / Time Duration / ad-hoc action buttons)
  // was replaced by the report view's kebab column, so nothing needs it as
  // the landing view any more. `?view=list` still works for edge cases
  // (deep links, back-navigation from a page that expects it).
  const [view, setView] = useState<DashboardView>(
    (params.get("view") || "").toLowerCase() === "list" ? "list" : "report",
  );

  // Where to return to on Back. `returnTo=manageUsers` means the user
  // arrived here from the Manage Users page's Reports button, and Back
  // should send them straight back there instead of to the Courses page.
  const returnTo = params.get("returnTo") || "";

  // Page-level Back action — context-aware. Declared HERE (and not near the
  // top of the function) because it reads `view` in its dependency array,
  // and JS's temporal dead zone would throw if the `useCallback` registered
  // before the `useState` above ran.
  //
  //   - If the user is in the Report view AND arrived from Manage Users
  //     → go directly back to Manage Users. Toggling to the list view first
  //       would be surprising (they never asked to see the live list).
  //   - Otherwise, if in the Report view (and NOT from Manage Users)
  //     → switch to the List view in-place.
  //   - Otherwise (in the List view)
  //     → if from Manage Users, return there;
  //       else return to the Courses page with `?fromAnalytics=true` so it
  //       re-hydrates the saved tab/subcategory/selected-node from localStorage.
  //
  // If we don't know the courseId we can't navigate explicitly, so fall
  // back to plain history back.
  const goBackToCourses = useCallback(() => {
    const backToManageUsers = () => {
      const qs = new URLSearchParams();
      if (assessmentId) { qs.set("exerciseId", assessmentId); qs.set("assessmentId", assessmentId); }
      if (courseId) qs.set("courseId", courseId);
      if (nodeId) qs.set("nodeId", nodeId);
      if (nodeType) qs.set("nodeType", nodeType);
      if (moduleName) qs.set("moduleName", moduleName);
      if (submoduleName) qs.set("submoduleName", submoduleName);
      if (topicName) qs.set("topicName", topicName);
      if (subtopicName) qs.set("subtopicName", subtopicName);
      if (tabType) qs.set("tabType", tabType);
      if (subcategory) qs.set("subcategory", subcategory);
      if (assessmentName) qs.set("assessmentName", assessmentName);
      router.push(`/lms/pages/courses/manageUsers?${qs.toString()}`);
    };

    if (returnTo === "manageUsers") {
      backToManageUsers();
      return;
    }
    if (view === "report") {
      // Switch back to the list view in-place. Expanded inline rows aren't
      // cleared here — `handleSwitchView` (called for other entry points)
      // does that, but preserving the expansion across a quick toggle is a
      // small UX courtesy if the user clicks back, peeks, and re-enters.
      setView("list");
      return;
    }
    if (!courseId) { router.back(); return; }
    const qs = new URLSearchParams();
    qs.set("courseId", courseId);
    qs.set("fromAnalytics", "true");
    router.push(`/lms/pages/courses/uploadcourseresources?${qs.toString()}`);
  }, [
    view, courseId, router, returnTo, assessmentId, nodeId, nodeType,
    moduleName, submoduleName, topicName, subtopicName, tabType, subcategory,
    assessmentName,
  ]);

  // Per-row expand accordion — the report row's kebab has a "View detailed
  // report" item that flips this. Accordion: only one row open at a time.
  // The old header-level `isDetailedReport` toggle is gone.
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const handleToggleExpandRow = useCallback((studentId: string) => {
    setExpandedRowId((prev) => (prev === studentId ? null : studentId));
  }, []);

  // Reset pagination when switching views so the report view starts at page 1.
  // Also collapse any expanded detail row when leaving the report view — the
  // chevron disappears with the view, so leaving a row "open" would be invisible
  // state that confuses returning to Reports later.
  const handleSwitchView = useCallback((v: DashboardView) => {
    setView(v);
    setPage(1);
    if (v !== "report") {
      setExpandedRowId(null);
      // Clear Reports-only filters when leaving the view so re-entry starts
      // clean — these inputs aren't rendered in the list view, so leaving
      // state behind would silently affect the next Reports session. Search
      // is intentionally NOT cleared because it now applies to both views
      // (visible + active in the list view too).
      setScaleFromPct("");
      setScaleToPct("");
      setPassFailFilter("all");
    }
  }, []);

  // Lazy per-student breakdown: only compute for the currently expanded row.
  // The detail data is identical to what the StudentDetailsPage overlay shows,
  // but derived from the already-fetched `courseDataResponse` (no extra
  // network round-trip).
  // Lazy fetch of the same `/api/assessment/student-details` payload the
  // existing "View Detailed Report" overlay uses — but ONLY for the currently
  // expanded student, so collapsed rows don't trigger any network traffic.
  // We use this endpoint solely as the source for per-question `timeTakenSeconds`
  // because the courses-data payload that powers marks doesn't reliably carry
  // that field; everything else (scored marks, status) still comes from the
  // courses-data computation, which is what makes the row total match the
  // column total.
  const { data: expandedStudentDetails } = useQuery<{
    questions?: Array<{ id: string; timeTakenSeconds?: number }>;
  } | null>({
    queryKey: ["studentDetails", assessmentId, expandedRowId],
    queryFn: async () => {
      if (!assessmentId || !expandedRowId) return null;
      const token =
        (typeof window !== "undefined" &&
          (getToken() || localStorage.getItem("token"))) || "";
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com";
      const qs = new URLSearchParams({ assessmentId, studentId: expandedRowId });
      const res = await fetch(`${apiBase}/api/assessment/student-details?${qs.toString()}`, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) throw new Error(`student-details ${res.status}`);
      return res.json();
    },
    enabled: !!assessmentId && !!expandedRowId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const expandedBreakdown: QuestionBreakdownRow[] | null = useMemo(() => {
    if (!expandedRowId || !assessmentId) return null;
    const courseData = (courseDataResponse as any)?.data;
    if (!courseData) return null;
    const participants = (courseData.batchAndParticipants || []).flatMap((b: any) => b?.users || []);
    const participant = participants.find(
      (p: any) => p?.user?._id === expandedRowId || p?._id === expandedRowId,
    );
    if (!participant) return null;

    // Build the per-question time-taken override map from the student-details
    // fetch. `null` (not loaded yet) → no override → helper falls back to
    // courses-data values (likely "—"). Once details land, this Map populates
    // and the column re-renders with accurate seconds.
    const timeTakenByQuestionId: Map<string, number> | null =
      expandedStudentDetails?.questions
        ? new Map(
            expandedStudentDetails.questions
              .filter((q) => q && q.id && typeof q.timeTakenSeconds === "number")
              .map((q) => [String(q.id), q.timeTakenSeconds as number]),
          )
        : null;

    // Forward the test-level submission state so the helper can label
    // unanswered questions correctly: "not_answered" if the student has
    // already submitted the whole test, "pending" if the test is still live.
    const expandedStudent = students.find((st) => st.id === expandedRowId);
    return getStudentQuestionsBreakdown({
      courseData,
      courseId: courseId || "",
      exerciseId: assessmentId,
      participant,
      studentSubmitted: !!expandedStudent?.submitted,
      timeTakenByQuestionId,
    });
  }, [expandedRowId, courseDataResponse, assessmentId, courseId, students, expandedStudentDetails]);

  // (`handleViewDetailedReport` was removed along with the Report view's
  // Actions column — per-question details are now reached via the inline
  // "Detailed Report" toggle + expand chevron. The `selectedStudentId` /
  // StudentDetailsPage overlay code path stays in place for any future
  // caller that still wants the fullscreen variant.)

  // Stable callbacks → StudentRow memoization stays intact.
  const handleSendMessage = useCallback((id: string) => setMessageStudentId(id), []);
  // Check Answers — opens the reviewSubmission page in single-student grading
  // mode. We pass `studentId` (the new param) so the review page skips its
  // participants-list view entirely and lands directly on the per-question
  // grading UI for THIS student. The other params (courseId, nodeId, etc.)
  // give the page enough context to render its breadcrumb / Back button.
  const handleCheckAnswers = useCallback((studentId: string) => {
    if (!assessmentId || !studentId) return;
    const qs = new URLSearchParams();
    qs.set("exerciseId", assessmentId);
    qs.set("studentId", studentId);
    if (courseId) qs.set("courseId", courseId);
    if (nodeId) qs.set("nodeId", nodeId);
    if (nodeType) qs.set("nodeType", nodeType);
    if (moduleName) qs.set("moduleName", moduleName);
    if (submoduleName) qs.set("submoduleName", submoduleName);
    if (topicName) qs.set("topicName", topicName);
    if (subtopicName) qs.set("subtopicName", subtopicName);
    if (tabType) qs.set("tabType", tabType);
    if (subcategory) qs.set("subcategory", subcategory);
    // Hint so the review page's Back button can return to this dashboard
    // instead of `router.back()` (which can be unreliable across tabs).
    qs.set("returnTo", "liveDashboard");
    router.push(`/lms/pages/courses/reviewSubmission?${qs.toString()}`);
  }, [
    assessmentId, courseId, nodeId, nodeType, moduleName, submoduleName,
    topicName, subtopicName, tabType, subcategory, router,
  ]);

  // ── Resume permission gate — Approve / Reject actions ────────────────────
  // Trainer clicks Approve or Reject on a row whose student has requested
  // permission to resume after an interruption. Both endpoints are idempotent
  // on the server (attemptController.js). We rely on the socket broadcast to
  // repaint the row — no optimistic update needed, since the sweep + row
  // update event lands immediately after the DB write.
  const postResumeAction = useCallback(async (
    kind: "approve-resume" | "reject-resume",
    studentId: string,
  ) => {
    if (!assessmentId || !studentId) return;
    try {
      const token =
        (typeof window !== "undefined" &&
          (getToken() || localStorage.getItem("token"))) || "";
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com";
      const res = await fetch(`${apiBase}/courses/attempt/${kind}`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ exerciseId: assessmentId, studentId }),
      });
      if (!res.ok) {
        console.error(`[liveDashboard] ${kind} failed:`, res.status);
      }
    } catch (err) {
      console.error(`[liveDashboard] ${kind} error:`, err);
    }
  }, [assessmentId]);

  const handleApproveResume = useCallback(
    (studentId: string) => { void postResumeAction("approve-resume", studentId); },
    [postResumeAction],
  );
  const handleRejectResume = useCallback(
    (studentId: string) => { void postResumeAction("reject-resume", studentId); },
    [postResumeAction],
  );

  const messageStudent = useMemo(
    () => students.find(s => s.id === messageStudentId) || null,
    [students, messageStudentId],
  );

  const sendIndividual = useCallback(
    (text: string) =>
      emitWithAck("proctor:send_message", { assessmentId, studentId: messageStudentId, message: text }),
    [assessmentId, messageStudentId],
  );
  const sendBroadcast = useCallback(
    (text: string) => emitWithAck("proctor:broadcast_message", { assessmentId, message: text }),
    [assessmentId],
  );

  // ── Inline stats (overall totals — NOT affected by the status filter) ──────
  // Use the post-role-filter list so the "Total Students" pill matches the
  // table. Falls back to backend's totalStudents only when courseData hasn't
  // loaded yet (and therefore role filtering hasn't been applied).
  const total = studentsWithMarks.length || totalStudents || students.length;
  const stats = useMemo(() => {
    // Tallies for the inline stats strip. Names match the new TestStatus
    // values: `started` (currently attending live) and `submitted` (final
    // submission), with `notStarted` covering everyone else.
    let notStarted = 0;
    let started = 0;
    let submitted = 0;
    // Read from `studentsWithMarks` so the courseData-derived `submitted`
    // promotion (parent answer-doc `status: "completed"`) is reflected here
    // too — otherwise the strip would still say "Submitted: 0" for a class
    // where every student already finished but no one is in session.
    for (const s of studentsWithMarks) {
      const st = deriveTestStatus(s);
      if (st === "not-started") notStarted++;
      else if (st === "started") started++;
      else submitted++; // "submitted"
    }
    return { notStarted, started, submitted };
  }, [studentsWithMarks]);

  // ── Apply filters in order: status → search → scale → pass/fail ──────────
  // Reads from `studentsWithMarks` (not the raw `students`) so the Report
  // view's marks columns reflect what reviewSubmission would show. Search,
  // scale and pass/fail are Reports-view-only — gated by `view === "report"`
  // so the list view keeps its current single-filter behaviour.
  const filteredStudents = useMemo(() => {
    let rows = studentsWithMarks;

    if (statusFilter !== "all") {
      rows = rows.filter(s => deriveTestStatus(s) === statusFilter);
    }

    // Search applies in BOTH views (the live list also benefits from
    // quick-find when the class is large). Scale + Pass/Fail stay
    // Reports-only because the list view doesn't surface marks.
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(s =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q)
      );
    }

    if (view === "report") {
      // Scale range — only active when at least one bound is a valid number.
      // Empty inputs mean "no lower / no upper bound", so a user can type just
      // a From (e.g. 70 to "show 70%+") without specifying a To, and vice versa.
      // Ungraded rows are excluded once the range is active, matching the
      // pass/fail rule — a not-yet-attempted student isn't a "scale match".
      const fromNum = scaleFromPct.trim() === "" ? null : Number(scaleFromPct);
      const toNum = scaleToPct.trim() === "" ? null : Number(scaleToPct);
      const fromActive = fromNum != null && Number.isFinite(fromNum);
      const toActive = toNum != null && Number.isFinite(toNum);
      if (fromActive || toActive) {
        rows = rows.filter(s => {
          if (typeof s.scoredMarks !== "number" || !s.totalMarks) return false;
          const pct = (s.scoredMarks / s.totalMarks) * 100;
          if (fromActive && pct < (fromNum as number)) return false;
          if (toActive && pct > (toNum as number)) return false;
          return true;
        });
      }
      if (passFailFilter !== "all") {
        rows = rows.filter(s => {
          // A row can be evaluated for pass/fail only when it has been graded.
          // Treat ungraded rows (no scoredMarks, no submission) as neither —
          // they drop out of both the Pass and Fail subsets to avoid a
          // misleading "fail" badge against a student who simply hasn't taken
          // the test yet.
          if (typeof s.scoredMarks !== "number" || !s.totalMarks) return false;
          const pct = (s.scoredMarks / s.totalMarks) * 100;
          return passFailFilter === "pass" ? pct >= PASS_THRESHOLD : pct < PASS_THRESHOLD;
        });
      }
    }

    return rows;
  }, [studentsWithMarks, statusFilter, view, searchQuery, scaleFromPct, scaleToPct, passFailFilter]);

  // Both list and Report tables share the same status-filter result.
  const displayStudents = filteredStudents;

  const totalPages = Math.max(1, Math.ceil(displayStudents.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageStudents = useMemo(
    () => displayStudents.slice(startIdx, startIdx + rowsPerPage),
    [displayStudents, startIdx, rowsPerPage],
  );
  const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

  // Reset to page 1 whenever the filter changes (don't reset on every render).
  const handleStatusChange = useCallback((v: StatusFilter) => {
    setStatusFilter(v);
    setPage(1);
  }, []);
  const handleSearchChange = useCallback((v: string) => {
    setSearchQuery(v);
    setPage(1);
  }, []);
  const handleScaleFromChange = useCallback((v: string) => {
    setScaleFromPct(v);
    setPage(1);
  }, []);
  const handleScaleToChange = useCallback((v: string) => {
    setScaleToPct(v);
    setPage(1);
  }, []);
  const handlePassFailChange = useCallback((v: "all" | "pass" | "fail") => {
    setPassFailFilter(v);
    setPage(1);
  }, []);

  // ── Breadcrumb trail ──
  const tabLabel = tabType.replace(/_/g, " ").trim(); // "You_Do" → "You Do"
  const baseCrumbs: { label: string; Icon?: any; onClick?: () => void }[] = [
    ...(courseName ? [{ label: courseName, Icon: GraduationCap, onClick: goBackToCourses }] : []),
    ...(moduleName ? [{ label: moduleName, Icon: Layers }] : []),
    ...(submoduleName ? [{ label: submoduleName, Icon: Layers }] : []),
    ...(topicName ? [{ label: topicName, Icon: BookOpen }] : []),
    ...(subtopicName ? [{ label: subtopicName, Icon: BookOpen }] : []),
    ...(tabLabel ? [{ label: tabLabel, Icon: ClipboardList }] : []),
    ...(subcategory ? [{ label: subcategory, Icon: Tag }] : []),
  ];

  // Shared breadcrumb bar — identical markup for the dashboard and the student-details view.
  const renderBreadcrumbBar = (
    crumbs: { label: string; Icon?: any; onClick?: () => void }[],
    onBack: () => void,
  ) => (
    <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 flex-shrink-0">
      {/* Page-level Back button — red, matches the in-Report-view "Back"
          toggle. Context-aware: clicking it from the Report view drops to
          the List view; from the List view (or student-details overlay) it
          navigates to the Courses page. */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
      >
        <ArrowLeft size={15} /> Back
      </button>
      <nav className="flex items-center min-w-0 overflow-hidden text-[12.5px]">
        {crumbs.map((c, i) => {
          const isLast = i === crumbs.length - 1;
          const clickable = !isLast && !!c.onClick;
          return (
            <React.Fragment key={`${c.label}-${i}`}>
              {i > 0 && <ChevronRight size={13} strokeWidth={2} className="text-gray-300 flex-shrink-0 mx-0.5" />}
              <button
                type="button"
                onClick={clickable ? c.onClick : undefined}
                disabled={!clickable}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-colors ${
                  isLast
                    ? "text-slate-600 font-semibold cursor-default"
                    : "text-blue-600 hover:text-blue-700 hover:underline"
                }`}
              >
                {c.Icon && <c.Icon size={13} strokeWidth={2} className="flex-shrink-0" />}
                <span className={!isLast ? "truncate max-w-[200px]" : "whitespace-nowrap"}>{c.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );

  // ── Student details view — kept intact, now actually triggered from the
  //    Report view's "View Detailed Report" menu item. ─────────────────────
  if (selectedStudentId) {
    // Preserve which view the user came from in the trail so the breadcrumb
    // reads naturally: ... > Dashboard > [Report >] Student Details.
    const trail: { label: string; onClick?: () => void }[] = [
      { label: "Dashboard", onClick: () => { setSelectedStudentId(null); setView("list"); } },
    ];
    if (view === "report") {
      trail.push({ label: "Report", onClick: () => setSelectedStudentId(null) });
    }
    trail.push({ label: "Student Details" });
    const studentCrumbs = [...baseCrumbs, ...trail];
    return (
      <div className="h-screen flex flex-col bg-white">
        {renderBreadcrumbBar(studentCrumbs, () => setSelectedStudentId(null))}
        <div className="flex-1 min-h-0 flex flex-col p-5">
          <StudentDetailsPage
            assessmentId={assessmentId}
            studentId={selectedStudentId}
            onBack={() => setSelectedStudentId(null)}
          />
        </div>
      </div>
    );
  }

  const breadcrumbs = [
    ...baseCrumbs,
    { label: "Dashboard", onClick: view === "report" ? () => setView("list") : undefined },
    ...(view === "report" ? [{ label: "Report" }] : []),
  ];

  // ── All-students dashboard ──────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Custom scrollbar — the default WebKit scrollbar on this page rendered
          as a thin near-black bar on the table area; users reported it was hard
          to spot AND too narrow to grab. This block widens it to ~10px, gives
          it a soft slate thumb on a slate-100 track, and adds the matching
          Firefox properties. Applied via the `lmsd-scroll` className so it
          stays scoped to elements we opt in. */}
      <style jsx global>{`
        .lmsd-scroll::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        .lmsd-scroll::-webkit-scrollbar-track {
          background: #f1f5f9; /* slate-100 */
          border-radius: 8px;
        }
        .lmsd-scroll::-webkit-scrollbar-thumb {
          background: #cbd5e1; /* slate-300 — clearly visible but not heavy */
          border-radius: 8px;
          /* The 2px transparent border preserves the track gutter on either
             side of the thumb, so the thumb visually "floats" instead of
             touching the edges of the column. */
          border: 2px solid #f1f5f9;
        }
        .lmsd-scroll::-webkit-scrollbar-thumb:hover {
          background: #94a3b8; /* slate-400 on hover for affordance */
        }
        .lmsd-scroll::-webkit-scrollbar-corner {
          background: #f1f5f9;
        }
        /* Firefox uses a different property set. */
        .lmsd-scroll {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
      `}</style>
      {renderBreadcrumbBar(breadcrumbs, goBackToCourses)}

      {/* Content area — header + inline stats stay fixed; only the table scrolls */}
      <div className="flex-1 min-h-0 flex flex-col p-4 gap-2">
        {/* ── Single header row: identity + status + stats + actions ─────
            Compacted per feedback — the whole dashboard chrome is now ONE
            line: the assessment name IS the title (with a LIVE / REPORTS
            pill next to it so the trainer immediately knows both what
            they are looking at and its current mode), the four counts sit
            inline as compact stat pills, and the action buttons stay
            right-aligned. Below, the search + filter get a thin second
            row. Everything else — big page title, subtitle, dedicated
            stats strip — was removed so the table gets maximum room. */}
        <div className="flex flex-nowrap items-center gap-3 flex-shrink-0 min-w-0">
          {/* Identity block: labelled assessment name. Mode pill dropped —
              report is the only view now, so the badge added no info. */}
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[12px] font-medium text-gray-500 whitespace-nowrap">
              Assessment Name:
            </span>
            <h1 className="text-[14px] font-semibold text-gray-900 leading-tight truncate" title={assessmentName || "Assessment"}>
              {assessmentName || "Assessment"}
            </h1>
          </div>

          {/* Stats — inline, compact. Muted label · bold value. Middle of
              the row grows/shrinks; the horizontal `overflow-x-auto`
              guard means very narrow viewports scroll instead of wrap. */}
          <div className="flex flex-nowrap items-center gap-4 overflow-x-auto text-[12px] text-gray-600 min-w-0 pl-3 border-l border-gray-200">
            <span className="whitespace-nowrap"><span className="text-gray-500">Total Students</span> <span className="font-semibold text-gray-900 ml-1">{total}</span></span>
            <span className="whitespace-nowrap"><span className="text-gray-500">Not Started</span> <span className="font-semibold text-gray-700 ml-1">{stats.notStarted}</span></span>
            <span className="whitespace-nowrap"><span className="text-gray-500">In Progress</span> <span className="font-semibold text-amber-600 ml-1">{stats.started}</span></span>
            <span className="whitespace-nowrap"><span className="text-gray-500">Completed</span> <span className="font-semibold text-green-600 ml-1">{stats.submitted}</span></span>
          </div>

          {/* Actions — right-aligned. Message All + Live Screens are the
              live-monitoring actions and stay on the header. Export is
              specific to the report view. The old "Reports" switcher +
              "Detailed" toggle are gone: report IS the default view now,
              and "View detailed report" lives inside each row's kebab. */}
          <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setBroadcastOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
              title="Send a message to all students in live session"
            >
              <Send size={12} />
              Message All
            </button>
            {/* Live Screens button hidden per feedback — the underlying
                feature stays wired (openLiveScreens still exists) so it can
                be reached from other entry points; only this header pill
                is removed. */}
            {view === "report" && (
              <button
                type="button"
                onClick={() => setExportModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
                title="Open the Report Export Preview"
              >
                <Download size={12} />
                Export
              </button>
            )}
          </div>
        </div>

        {/* ── Row B: Compact search + filter strip ─────────────────────
                    Slimmed to match the tighter header row above. */}
        <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search name or email…"
              className="border border-gray-200 rounded-md pl-7 pr-2 py-1 text-[12px] text-gray-700 outline-none focus:border-indigo-400 w-[220px]"
            />
          </div>

          {/* Scale range — user-entered "from %" to "to %". Either bound is
              optional, so the user can type just a From ("70" → 70% and up)
              or just a To ("40" → up to 40%). Leaving both empty disables
              the filter entirely. */}
          {view === "report" && (
            <div className="flex items-center gap-2">
              <label className="text-[12.5px] font-medium text-gray-500 whitespace-nowrap">
                Scale:
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={scaleFromPct}
                onChange={e => handleScaleFromChange(e.target.value)}
                placeholder="From"
                aria-label="Scale from percent"
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] text-gray-700 outline-none focus:border-indigo-400 w-[70px]"
              />
              <span className="text-[12.5px] text-gray-400">to</span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={scaleToPct}
                onChange={e => handleScaleToChange(e.target.value)}
                placeholder="To"
                aria-label="Scale to percent"
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] text-gray-700 outline-none focus:border-indigo-400 w-[70px]"
              />
              <span className="text-[12.5px] text-gray-400">%</span>
            </div>
          )}

          {view === "report" && (
            <div className="flex items-center gap-2">
              <label htmlFor="passfail-filter" className="text-[12.5px] font-medium text-gray-500 whitespace-nowrap">
                Result:
              </label>
              <select
                id="passfail-filter"
                value={passFailFilter}
                onChange={e => handlePassFailChange(e.target.value as "all" | "pass" | "fail")}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-700 outline-none focus:border-indigo-400"
              >
                <option value="all">All Results</option>
                <option value="pass">Pass (≥ {PASS_THRESHOLD}%)</option>
                <option value="fail">Fail (&lt; {PASS_THRESHOLD}%)</option>
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Filter size={12} className="text-gray-400" />
            <label htmlFor="status-filter" className="text-[11px] font-medium text-gray-500 whitespace-nowrap">
              Status:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={e => handleStatusChange(e.target.value as StatusFilter)}
              className="border border-gray-200 rounded-md px-2 py-1 text-[12px] text-gray-700 outline-none focus:border-indigo-400"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table — borderless container matching the Client Management
            listing style: no outer border, no shadow, just a soft rounded
            surface. Row borders are removed too (see StudentRow); rows
            separate through spacing + hover instead of hairlines. */}
        <div className="bg-white rounded-md flex-1 min-h-0 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-[13px] text-gray-400">Loading dashboard…</div>
          ) : error ? (
            <div className="p-10 text-center text-[13px] text-red-500">{error}</div>
          ) : (
            <>
              {/* Compute the active header list once per render. In the
                  Report view the chevron column is prepended ONLY when the
                  Detailed Report toggle is on; the Action column is gone in
                  both states. */}
              {(() => {
                // The kebab column always sits at the END of the report row —
                // the header toggle is gone, so per-row action + "View
                // detailed report" both live inside the kebab menu now.
                const reportHeaders = [...REPORT_HEADERS_BASE, CHEVRON_COL];
                const activeHeaders = view === "report" ? reportHeaders : HEADERS;
                const activeLeftAlign = view === "report" ? REPORT_LEFT_ALIGN : LEFT_ALIGN;
                return (
                  <div className="overflow-auto flex-1 min-h-0 lmsd-scroll">
                    <table className="w-full">
                      <thead>
                        {/* Header row uses a light gray wash so it reads as
                            a distinct band from the borderless white rows —
                            matches the We-Do assignments list header. */}
                        <tr className="bg-gray-50">
                          {activeHeaders.map((h, idx) => (
                            <th
                              key={h || `col-${idx}`}
                              className={`sticky top-0 z-10 bg-gray-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 whitespace-nowrap ${activeLeftAlign.has(h) ? "text-left" : "text-center"} ${h === CHEVRON_COL ? "w-10" : ""} ${NARROW_COLS.has(h) ? "w-12" : ""}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageStudents.map((s, i) =>
                          view === "report" ? (
                            <ReportRow
                              key={s.id}
                              student={s}
                              index={startIdx + i}
                              isExpanded={expandedRowId === s.id}
                              onToggleExpand={handleToggleExpandRow}
                              onSendMessage={handleSendMessage}
                              onCheckAnswers={handleCheckAnswers}
                              onApproveResume={handleApproveResume}
                              onRejectResume={handleRejectResume}
                              // Only pass the breakdown for THE expanded row.
                              breakdown={expandedRowId === s.id ? expandedBreakdown : null}
                              columnCount={activeHeaders.length}
                            />
                          ) : (
                            <StudentRow
                              key={s.id}
                              student={s}
                              index={startIdx + i}
                              onSendMessage={handleSendMessage}
                              onCheckAnswers={handleCheckAnswers}
                            />
                          )
                        )}
                        {displayStudents.length === 0 && (
                          <tr>
                            <td colSpan={activeHeaders.length}
                              className="px-4 py-10 text-center text-[13px] text-gray-400">
                              {students.length === 0
                                ? "No students have joined yet."
                                : "No students match this filter."}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* Footer / pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 flex-shrink-0">
                <span className="text-[13px] text-gray-500">
                  {displayStudents.length === 0
                    ? "No students"
                    : `Showing ${startIdx + 1} to ${Math.min(startIdx + rowsPerPage, displayStudents.length)} of ${displayStudents.length} ${statusFilter === "all" ? "students" : "matched"}`}
                </span>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-[13px] text-gray-500">
                    <span>Rows per page:</span>
                    <select
                      value={rowsPerPage}
                      onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(1); }}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-[13px] text-gray-700 outline-none focus:border-indigo-400"
                    >
                      {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={safePage === 1}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {pageItems.map((p, idx) =>
                      p === "…" ? (
                        <span key={`e${idx}`} className="w-8 h-8 flex items-center justify-center text-[13px] text-gray-400">…</span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 rounded-lg text-[13px] font-semibold transition-colors ${
                            p === safePage
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {p}
                        </button>
                      ),
                    )}

                    <button
                      type="button"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={safePage === totalPages}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Messaging popups */}
      <MessageStudentModal
        student={messageStudent}
        onClose={() => setMessageStudentId(null)}
        onSend={sendIndividual}
      />
      <BroadcastMessageModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        onSend={sendBroadcast}
      />

      {/* Report Export Preview — 90% × 90% modal. Reads the same student
          rows the table renders (`studentsWithMarks`, includes the
          computed marks columns) and the cached `courseDataResponse` so
          the Detailed mode can walk the per-question breakdown without
          any extra network calls. */}
      <ReportExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        students={studentsWithMarks}
        assessmentName={assessmentName || "Assessment"}
        courseData={(courseDataResponse as any)?.data ?? null}
        courseId={courseId || ""}
        exerciseId={assessmentId || ""}
        // Context labels for the meta header — the dashboard already pulls
        // these from URL search params at the top of LiveDashboardInner.
        courseName={courseName}
        moduleName={moduleName}
        submoduleName={submoduleName}
        topicName={topicName}
        subtopicName={subtopicName}
      />
    </div>
  );
}

export default function LiveDashboardPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[13px] text-gray-400">Loading…</div>}>
      <LiveDashboardInner />
    </Suspense>
  );
}
