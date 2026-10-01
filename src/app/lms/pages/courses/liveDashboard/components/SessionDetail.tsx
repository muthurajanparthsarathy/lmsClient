"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  Search,
  Check,
  FileBarChart2,
  Zap,
} from "lucide-react";
import { useSectionHref } from "@/lib/sectionRoute";
import { courseDataApi } from "@/app/lms/pages/courses/api/coursesData";

import AssessmentReportHeader from "./AssessmentReportHeader";
import StudentsResultTable from "./StudentsResultTable";
import MessageStudentModal from "./MessageStudentModal";
import LearnerDetailModal from "./LearnerDetailModal";
import ReportGenerateModal from "./ReportGenerateModal";
import { useLiveDashboard } from "../hooks/useLiveDashboard";
import {
  findExercise, deriveAssessmentMeta, deriveAssessmentDetails,
} from "../utils/assessmentHeader";
import { computeStudentMarks } from "../utils/computeStudentMarks";
import type { StudentProgress } from "../types/liveDashboard.types";
import { aggregateExercise } from "../utils/questionAggregate";
import { deriveTestStatus } from "../utils/deriveTestStatus";
import { findExerciseLocation } from "../utils/exerciseLocation";
import { RerunDialog } from "@/app/lms/pages/courses/reviewSubmission/components/rerun/RerunDialog";
import { RerunConfirmDialog } from "@/app/lms/pages/courses/reviewSubmission/components/rerun/RerunConfirmDialog";

// ── Session detail — the Live Dashboard's report page ───────────────────────
//
//   [top nav]  Back  Programming > <name>              Share  ⋮
//   [header]   title + chips + counts            Started · thumb
//   [toolbar]  search · Test Status filter           (no tabs — Overview only)
//   [table]    dense learner list (Student · Test Status · Marks · % · Scale)
//              + pagination

type UiStatus = "all" | "not-started" | "started" | "submitted";

const STATUS_OPTIONS: { value: UiStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  // Order mirrors the metric strip above: Started → Not Started → Completed
  // so the trainer's eye doesn't have to re-map between the counts and the
  // filter. "Started" (was "In Progress") also matches the row pill label.
  { value: "started", label: "Started" },
  { value: "not-started", label: "Not Started" },
  { value: "submitted", label: "Completed" },
];

// Modern compact dropdown — a real popover, not a native `<select>`, so the
// option list carries the same rounded-card / hover-tint / active-check the
// rest of the redesign uses. Keyboard-navigable (Esc closes, click-outside
// closes) and it announces the active option to screen readers via aria.
function StatusSelect<T extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Notched-outline floating label. The label sits on the top edge of the
  // button's border with a small white slab behind it so the border reads as
  // "notched" around the text (same pattern as Material 3 outlined selects).
  // Focus/open state carries the indigo tint over to both border and label so
  // the two components stay visually linked.
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`relative flex h-8 min-w-[132px] items-center gap-2 rounded-md border bg-white px-2.5 text-left transition-colors ${open
          ? "border-violet-500 ring-2 ring-violet-100"
          : "border-indigo-100 hover:border-indigo-200"
          }`}
      >
        <span className="text-[12px] font-medium text-gray-800 truncate">
          {current?.label ?? "—"}
        </span>
        <ChevronDown
          size={13}
          aria-hidden="true"
          className={`ml-auto flex-shrink-0 text-gray-500 transition-transform ${open ? "rotate-180 text-indigo-500" : ""}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] transition-colors ${active
                    ? "bg-indigo-50 text-indigo-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  <span>{o.label}</span>
                  {active && <Check size={13} className="text-indigo-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


export default function SessionDetail() {
  const router = useRouter();
  const sectionHref = useSectionHref();
  const params = useSearchParams();
  const queryClient = useQueryClient();

  const assessmentId = params.get("assessmentId") || params.get("exerciseId") || "";
  const courseId = params.get("courseId") || "";
  const nodeId = params.get("nodeId") || "";
  const nodeType = params.get("nodeType") || "";
  const subcategory = params.get("subcategory") || "";
  const moduleName = params.get("moduleName") || "";
  const submoduleName = params.get("submoduleName") || "";
  const topicName = params.get("topicName") || "";
  const subtopicName = params.get("subtopicName") || "";
  const tabType = params.get("tabType") || "";
  const returnTo = params.get("returnTo") || "";
  const returnTab = params.get("tab") || "";
  // The launcher (Assessment.tsx / ProblemSolving.tsx Review button) pushes
  // the exact name it displayed on the row into the URL as `assessmentName`.
  // We prefer that value over the API's derived name because the server
  // falls back to the literal string "Assessment" when it can't locate the
  // exercise doc (for example a We_Do assignment where the resolver misses)
  // — which is what caused an assignment titled "Assignment Ex1" to render
  // as "Assessment" up in the header.
  const assessmentNameParam = params.get("assessmentName") || "";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UiStatus>("all");
  // Currently-open "Send Message" modal — `null` when closed, a
  // StudentProgress when the kebab item was clicked. Owned here (not in the
  // table) so the modal renders once and is unaffected by row re-renders
  // during the live-dashboard poll.
  const [messageStudent, setMessageStudent] = useState<StudentProgress | null>(null);
  // Currently-open learner detail overlay — a full programming report for
  // one learner. Same ownership rule as the message modal above.
  const [detailStudent, setDetailStudent] = useState<StudentProgress | null>(null);

  // Report modal — replaces the old Export dropdown. Owned at page level
  // so opening it doesn't disturb the underlying dashboard state and the
  // trainer can close it back to the exact same filters/pagination.
  const [reportOpen, setReportOpen] = useState(false);

  // ── Rerun ────────────────────────────────────────────────────────────────
  // Rerun moved here from the (now removed) Repository Review page. Two entry
  // points, one pipeline:
  //   • toolbar "Rerun"      → target = null   → every student
  //   • row ⋮ ▸ "Rerun"      → target = that learner (Completed rows only)
  //
  // Both go through a Yes/No confirm FIRST (`rerunAsk`) and only then open the
  // real rerun panel (`rerunRun`), because a rerun overwrites stored scores.
  // `undefined` = closed, `null` = all students, a StudentProgress = one.
  type RerunTarget = StudentProgress | null;
  const [rerunAsk, setRerunAsk] = useState<RerunTarget | undefined>(undefined);
  const [rerunRun, setRerunRun] = useState<RerunTarget | undefined>(undefined);

  const {
    students, assessmentName: apiAssessmentName, startDate,
    isLoading: liveLoading, error: liveError,
  } = useLiveDashboard({ assessmentId, courseId, nodeId, nodeType, tabType });

  // URL param wins over the API's derived name. Falls back to the API name
  // only when the launcher didn't pass one — that still preserves the old
  // behaviour on hand-typed deep links. The literal "Assessment" the server
  // returns as a last-resort default is treated as "no name" so it never
  // takes precedence over a real name from either source.
  const assessmentName = assessmentNameParam
    || (apiAssessmentName && apiAssessmentName !== 'Assessment' ? apiAssessmentName : '')
    || apiAssessmentName;

  const { data: courseDataResponse, isLoading: courseLoading } = useQuery({
    ...courseDataApi.getById(courseId || ""),
    enabled: !!courseId && !!assessmentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const courseData = (courseDataResponse as any)?.data ?? null;

  const studentsWithMarks: StudentProgress[] = useMemo(() => {
    if (!courseData || !assessmentId) return students;
    const participants = (courseData.batchAndParticipants || []).flatMap((b: any) => b?.users || []);
    return students.map((s) => {
      const participant = participants.find((p: any) => p?.user?._id === s.id || p?._id === s.id);
      if (!participant) return s;
      const marks = computeStudentMarks({ courseData, courseId, exerciseId: assessmentId, participant });
      return {
        ...s,
        totalMarks: marks.totalMarks,
        totalQuestions: marks.totalQuestions,
        // The course payload is read once (5 min stale time); the server's
        // count keeps arriving over the socket — e.g. when a learner leaves
        // the assignment editor. Whichever has seen more answers is current.
        completed: Math.max(marks.completedQuestions, s.completed || 0),
        scoredMarks: marks.hasSubmitted ? marks.scoredMarks : undefined,
        submitted: s.submitted || marks.parentSubmitted,
        parentSubmitted: marks.parentSubmitted,
      };
    });
  }, [students, courseData, courseId, assessmentId]);


  const total = studentsWithMarks.length;
  // Learner-status counts — single pass so the strip + banners + filter
  // headline all agree.
  const learnerStats = useMemo(() => {
    let notStarted = 0;
    let inProgress = 0;
    let completed = 0;
    for (const s of studentsWithMarks) {
      const st = deriveTestStatus(s);
      if (st === "submitted") completed++;
      else if (st === "not-started") notStarted++;
      else inProgress++;
    }
    return { notStarted, inProgress, completed };
  }, [studentsWithMarks]);

  const exercise = useMemo(() => findExercise(courseData, assessmentId), [courseData, assessmentId]);

  // Rerun needs the pedagogy CATEGORY + the subcategory MAP KEY, not the
  // human label the URL carries (`subcategory` here is "Assesment", the map
  // key is "assesment"). Reading it off the course-data payload is what the
  // reviewSubmission list used to do via `_category` / `_subcategory`, so the
  // two callers send the server identical parameters.
  const rerunLocation = useMemo(
    () => findExerciseLocation(courseData, assessmentId),
    [courseData, assessmentId],
  );
  const canRerun = !!(rerunLocation && courseId && assessmentId && nodeId);
  const meta = useMemo(() => deriveAssessmentMeta(exercise, subcategory), [exercise, subcategory]);
  // Rich details behind the (i) icon. Same input source as `meta` above, but
  // returns the full configuration shape the two-column popover needs
  // (structure / grading / difficulty / programming / MCQ / security).
  const assessmentDetails = useMemo(
    () => deriveAssessmentDetails(exercise, subcategory),
    [exercise, subcategory],
  );
  const headerStartDate = startDate || meta.startDate;

  const aggregate = useMemo(
    () => aggregateExercise({ courseData, courseId, exerciseId: assessmentId }),
    [courseData, courseId, assessmentId],
  );

  const reviewNeeded = useMemo(() => {
    if (!aggregate) return 0;
    return aggregate.questions.reduce((n, q) => n + q.reviewCount, 0);
  }, [aggregate]);

  const goBack = useCallback(() => {
    if (returnTo === "manageUsers") {
      const qs = new URLSearchParams();
      if (assessmentId) { qs.set("assessmentId", assessmentId); qs.set("exerciseId", assessmentId); }
      if (courseId) qs.set("courseId", courseId);
      if (nodeId) qs.set("nodeId", nodeId);
      if (nodeType) qs.set("nodeType", nodeType);
      if (subcategory) qs.set("subcategory", subcategory);
      if (moduleName) qs.set("moduleName", moduleName);
      if (submoduleName) qs.set("submoduleName", submoduleName);
      if (topicName) qs.set("topicName", topicName);
      if (subtopicName) qs.set("subtopicName", subtopicName);
      if (tabType) qs.set("tabType", tabType);
      router.push(`${sectionHref("manageUsers")}?${qs.toString()}`);
      return;
    }
    // Back to the course-structure page, landing on the exact tab /
    // subcategory / node the trainer opened Review from.
    //
    // These params are not decoration. The upload page's auto-select effect
    // skips itself ONLY when `fromAnalytics` or `nodeId` is in the URL —
    // otherwise it fires first and slams the tab to I Do, which is what a
    // trainer coming back from a We Do assignment would have hit. It used to
    // be reviewSubmission's Back handler that set these; Review no longer
    // goes through that page, so the dashboard has to.
    //
    // `courseId` first and always: the upload page reads the course from the
    // URL alone, and without it renders "No course ID provided" instead of
    // the course the trainer came from.
    const qs = new URLSearchParams();
    if (courseId) qs.set("courseId", courseId);
    if (returnTab) qs.set("tab", returnTab);
    qs.set("fromAnalytics", "true");
    if (nodeId) qs.set("nodeId", nodeId);
    if (tabType) qs.set("activeTab", tabType);
    // The page matches on the pedagogy MAP KEY; the URL carries the human
    // label ("Assesment"). Same normalisation the keys themselves use.
    if (subcategory) {
      qs.set("activeSubcategory", subcategory.trim().toLowerCase().replace(/\s+/g, "_"));
    }
    router.push(`${sectionHref("uploadcourseresources")}?${qs.toString()}`);
  }, [
    router, sectionHref, returnTo, returnTab, assessmentId, courseId, nodeId,
    nodeType, subcategory, moduleName, submoduleName, topicName, subtopicName, tabType,
  ]);

  const openReviewSubmission = useCallback((studentId: string) => {
    if (!studentId || !assessmentId) return;
    const qs = new URLSearchParams();
    qs.set("assessmentId", assessmentId);
    qs.set("exerciseId", assessmentId);
    if (courseId) qs.set("courseId", courseId);
    if (nodeId) qs.set("nodeId", nodeId);
    if (nodeType) qs.set("nodeType", nodeType);
    if (subcategory) qs.set("subcategory", subcategory);
    if (moduleName) qs.set("moduleName", moduleName);
    if (submoduleName) qs.set("submoduleName", submoduleName);
    if (topicName) qs.set("topicName", topicName);
    if (subtopicName) qs.set("subtopicName", subtopicName);
    if (tabType) qs.set("tabType", tabType);
    qs.set("studentId", studentId);
    qs.set("returnTo", "liveDashboard");

    // Open the grading console in a NEW TAB and leave this dashboard standing.
    //
    // A live dashboard is a monitoring surface — trainers keep it open while an
    // assessment runs — and grading a submission is a side errand off it, often
    // repeated for several learners. Navigating away tore down the dashboard
    // (and its polling) every time, then rebuilt it from `returnTo` + the
    // context params on the way back. Those params are still set: the console's
    // Back still routes here, which is what a trainer who lands there from
    // somewhere else expects.
    const url = `${sectionHref("reviewSubmission")}?${qs.toString()}`;
    // `noopener` also drops window.opener, so the console cannot reach back
    // into this tab.
    window.open(url, "_blank", "noopener,noreferrer");
  }, [
    sectionHref, assessmentId, courseId, nodeId, nodeType, subcategory,
    moduleName, submoduleName, topicName, subtopicName, tabType,
  ]);

  // ── Kebab actions ──────────────────────────────────────────────────────
  // Detailed View — opens the LearnerDetailModal for this student. This is
  // the compact one-learner programming report; Review Submission (the
  // primary Action button in the same row) is still the deeper IDE-grade
  // flow that opens in a new tab.
  const openDetailedView = useCallback((studentId: string) => {
    const s = studentsWithMarks.find((row) => row.id === studentId);
    if (s) setDetailStudent(s);
  }, [studentsWithMarks]);

  // Request retest — writes a short "trainer requested a retest" note so
  // the student receives it as a notification. Uses the same messages
  // endpoint as the send-message flow below; the leading tag lets the
  // notification renderer style it differently if it wants.
  const requestRetest = useCallback(async (studentId: string) => {
    if (typeof window === "undefined") return;
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com").replace(/\/$/, "");
      const token = window.localStorage.getItem("token") || "";
      const res = await fetch(`${base}/api/assessment/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          assessmentId, studentId,
          text: "Your trainer has requested a retest for this assessment.",
          kind: "retest-request",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("[liveDashboard] retest request failed:", err);
    }
  }, [assessmentId]);

  // Video assessment — opens the stored recording in a new tab. The
  // presence of `videoRecordingUrl` on the row is what makes the menu
  // item visible in the first place, so we can trust it here.
  const openVideoAssessment = useCallback((student: StudentProgress) => {
    if (!student.videoRecordingUrl || typeof window === "undefined") return;
    window.open(student.videoRecordingUrl, "_blank", "noopener,noreferrer");
  }, []);

  // Send message — the actual POST happens from the modal's onSend prop,
  // handled below; the kebab item only opens the modal.
  const openSendMessage = useCallback((student: StudentProgress) => {
    setMessageStudent(student);
  }, []);

  // Modal's onSend contract: return { ok, error? }. The modal handles its
  // own UI state (spinner, error text, close-on-success).
  const sendMessage = useCallback(async (text: string) => {
    if (!messageStudent) return { ok: false, error: "No recipient selected." };
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "https://lmsserver-yeve.onrender.com").replace(/\/$/, "");
      const token = typeof window !== "undefined" ? (window.localStorage.getItem("token") || "") : "";
      const res = await fetch(`${base}/api/assessment/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          assessmentId,
          studentId: messageStudent.id,
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, error: body || `Server error ${res.status}` };
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Network error." };
    }
  }, [assessmentId, messageStudent]);

  const isLoading = liveLoading || courseLoading;
  const anyError = liveError || null;

  if (!assessmentId) {
    return (
      <div className="p-10 text-center text-[13px] text-gray-400">
        Missing assessment reference.
      </div>
    );
  }

  const breadcrumbLabel = meta.typeLabel || (subcategory ? subcategory.replace(/_/g, " ") : "Assessment");

  return (
    // Whole-page scroll: no `h-full` cage, no inner overflow container. The
    // LMS shell's <main> is the scroll ancestor, so sticky offsets below use
    // top: 0 of that <main>. The Back/breadcrumb bar scrolls away with the
    // assessment summary; the search+filter row and the table header are the
    // two sticky layers.
    <div className="min-h-full bg-[#f6f8ff]">
      <div className="flex items-center gap-2.5 px-6 py-2.5">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft size={12} /> Back
        </button>
        <nav aria-label="Breadcrumb" className="flex items-center text-[12px] text-gray-500 min-w-0 flex-1">
          <span className="text-gray-500 whitespace-nowrap">{breadcrumbLabel}</span>
          <ChevronRight size={11} className="mx-1 text-gray-300 flex-shrink-0" />
          <span className="text-gray-800 font-medium truncate">
            {assessmentName || "Session"}
          </span>
        </nav>
        {/* Share + kebab removed — trainer feedback: the header should not
            carry extra actions; the assessment header + report modal cover
            everything they need. */}
      </div>

      <div className="px-5 pt-2 pb-6 flex flex-col gap-3">
        {reviewNeeded > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-[12.5px]">
            <AlertTriangle size={14} className="flex-shrink-0" />
            <span>
              <span className="font-semibold">{reviewNeeded}</span>{" "}
              {reviewNeeded === 1 ? "response needs" : "responses need"} manual review for scoring. Open a learner's submission to grade it.
            </span>
          </div>
        )}

        <AssessmentReportHeader
          title={assessmentName || "Session"}
          chips={meta.chips}
          startDate={headerStartDate}
          imageUrl={courseData?.courseImage || undefined}
          counts={{
            total,
            notStarted: learnerStats.notStarted,
            inProgress: learnerStats.inProgress,
            completed: learnerStats.completed,
          }}
          // Popover behind the (i) icon next to the title — the full two
          // -column "Assessment Details" panel (General / Structure /
          // Difficulty / Grading / Programming / MCQ / Security). Every
          // field comes from the exercise document; the popover hides any
          // section whose data is missing so a bare-bones exercise still
          // renders a compact panel.
          details={assessmentDetails}
        />

        {anyError ? (
          <div className="p-8 text-center text-[13px] text-red-500">{anyError}</div>
        ) : (
          <StudentsResultTable
            students={studentsWithMarks}
            assessmentId={assessmentId}
            assessmentName={assessmentName || "Session"}
            courseData={courseData}
            courseId={courseId}
            isLoading={isLoading && studentsWithMarks.length === 0}
            onOpenReview={openReviewSubmission}
            onOpenDetailedView={openDetailedView}
            onRequestRetest={requestRetest}
            onOpenVideo={openVideoAssessment}
            onSendMessage={openSendMessage}
            onRerunStudent={canRerun ? ((student) => setRerunAsk(student)) : undefined}
            search={search}
            statusFilter={statusFilter}
            toolbar={(
              <div className="sticky top-0 z-30 flex min-h-[52px] flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-white px-3 py-2">
                <div className="flex shrink-0 items-center gap-2.5">
                  <h2 className="text-[15px] font-bold text-slate-950">Students</h2>
                  <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700">
                    {total} learners
                  </span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                  <div className="relative min-w-0">
                    <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, email, or register no."
                      className="h-8 w-[min(250px,24vw)] min-w-[160px] rounded-md border border-indigo-100 bg-white pl-8 pr-2.5 text-[11px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    />
                  </div>
                  <StatusSelect
                    label="Filter by status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={STATUS_OPTIONS}
                  />
                  <button
                    type="button"
                    onClick={() => setRerunAsk(null)}
                    disabled={!canRerun}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-indigo-100 bg-white text-indigo-600 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={canRerun ? "Rerun scoring for all students" : "Loading exercise details"}
                    aria-label="Rerun scoring for all students"
                  >
                    <Zap size={14} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-violet-600 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-violet-700"
                    title="Generate and export a learner report"
                  >
                    <FileBarChart2 size={13} strokeWidth={2} />
                    Export report
                  </button>
                </div>
              </div>
            )}
          />
        )}
      </div>

      {/* Send-Message modal — mounted once at the page level so the row's
          re-renders during the live-dashboard poll never remount it and
          drop the trainer's in-flight text. */}
      <MessageStudentModal
        student={messageStudent}
        onClose={() => setMessageStudent(null)}
        onSend={sendMessage}
      />

      {/* Learner detail overlay — the programming-assessment quick report
          triggered by ⋮ → Detailed View. Reads from the same course-data
          payload the report already fetched, so no extra network round-trip
          is needed to open it. */}
      <LearnerDetailModal
        open={!!detailStudent}
        student={detailStudent}
        courseData={courseData}
        courseId={courseId}
        exerciseId={assessmentId}
        assessmentName={assessmentName || "Session"}
        chips={meta.chips}
        startDate={headerStartDate}
        onClose={() => setDetailStudent(null)}
        onOpenReview={(studentId) => openReviewSubmission(studentId)}
      />

      {/* Rerun — Yes/No gate first, then the real panel. Both are mounted
          once here (not per row) so a row re-render during the live poll
          can't tear down a rerun that is mid-flight. `rerunAsk === null`
          means "all students"; a StudentProgress means just that learner. */}
      <RerunConfirmDialog
        open={rerunAsk !== undefined}
        studentName={rerunAsk?.studentName}
        onNo={() => setRerunAsk(undefined)}
        onYes={() => { setRerunRun(rerunAsk ?? null); setRerunAsk(undefined); }}
      />
      {rerunRun !== undefined && rerunLocation && (
        <RerunDialog
          open
          onClose={() => setRerunRun(undefined)}
          courseId={courseId}
          exerciseId={assessmentId}
          category={rerunLocation.category}
          subcategory={rerunLocation.subcategory}
          nodeId={nodeId}
          nodeType={nodeType || "topic"}
          singleUserId={rerunRun?.id}
          singleUserName={rerunRun?.studentName}
          onCompleted={() => {
            // New scores live in the courses-data payload the marks pipeline
            // reads, so refetch it — otherwise the table keeps showing the
            // pre-rerun marks until the trainer reloads the page.
            queryClient.invalidateQueries({ queryKey: ["course", courseId] });
          }}
        />
      )}

      {/* Generate Report — replaces the old Export dropdown. Reuses the
          same students-with-marks list the underlying table renders so the
          modal's filters and exports agree with the on-screen data. */}
      <ReportGenerateModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        students={studentsWithMarks}
        courseData={courseData}
        courseId={courseId}
        exerciseId={assessmentId}
        assessmentName={assessmentName || "Session"}
      />
    </div>
  );
}
