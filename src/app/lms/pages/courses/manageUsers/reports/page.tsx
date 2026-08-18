"use client";
import { getToken } from "@/lib/session";

import React, { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSectionHref } from "@/lib/sectionRoute";
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  GraduationCap, Layers, BookOpen, ClipboardList, Tag, Filter,
  Download, Search,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { courseDataApi } from "@/apiServices/coursesData";
import { useLiveDashboard } from "./hooks/useLiveDashboard";
import { deriveTestStatus } from "./utils/helpers";
import ReportRow from "./components/ReportRow";
import ReportExportModal from "./components/ReportExportModal";
import type { StudentProgress, TestStatus } from "./types/reports.types";
import {
  computeStudentMarks, getStudentQuestionsBreakdown, getExerciseGradeBands,
  scaleForPercent, type QuestionBreakdownRow,
} from "./utils/computeStudentMarks";

// Reports-only page. This is the same table the old
// `liveDashboard?view=report` route rendered — copied into the manageUsers
// folder so all live-monitoring surfaces live under one parent.
// The List view / Live Screens header / Broadcast modal from the old
// dashboard are intentionally absent here; those responsibilities moved to
// the Manage Users page itself.

const REPORT_HEADERS_BASE = [
  "Student Name", "Email", "Total Questions",
  "Completed", "Non Completed", "Test Status",
  "Total Marks", "Scored Marks", "Percentage", "Scale",
];
const REPORT_LEFT_ALIGN = new Set(["Student Name", "Email"]);
// Sentinel used in the headers array when the chevron column is shown.
const CHEVRON_COL = "";

type StatusFilter = "all" | TestStatus;
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all",          label: "All Statuses"  },
  { value: "not-started",  label: "Not Started"   },
  { value: "started",      label: "Started"       },
  { value: "submitted",    label: "Submitted"     },
];

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

function ManageUsersReportsInner() {
  const router = useRouter();
  // Back returns to Manage Users in the section this page was opened from.
  const sectionHref = useSectionHref();
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
  const assessmentNameParam = params.get("assessmentName") || "";

  // Back → return to the Manage Users page with the same context params.
  const goBackToManageUsers = useCallback(() => {
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
    if (assessmentNameParam) qs.set("assessmentName", assessmentNameParam);
    router.push(`${sectionHref("manageUsers")}?${qs.toString()}`);
  }, [
    router, sectionHref, assessmentId, courseId, nodeId, nodeType, moduleName,
    submoduleName, topicName, subtopicName, tabType, subcategory,
    assessmentNameParam,
  ]);

  const { students, totalStudents, assessmentName, courseName, isLoading, error } = useLiveDashboard({
    assessmentId, courseId, nodeId, nodeType,
  });

  // Marks side-channel — reads the same courses-data payload as the review
  // page so Total/Scored Marks match what a grader would see.
  const { data: courseDataResponse } = useQuery({
    ...courseDataApi.getById(courseId || ""),
    enabled: !!courseId && !!assessmentId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const studentsWithMarks: StudentProgress[] = useMemo(() => {
    const courseData = (courseDataResponse as any)?.data;
    if (!courseData || !assessmentId) return students;
    const participants = (courseData.batchAndParticipants || []).flatMap((b: any) => b?.users || []);
    // Only students — drop staff/coordinators/observers if role info is present.
    const studentIds = new Set<string>();
    for (const p of participants) {
      const u = p?.user;
      if (!u?._id) continue;
      const r = u.role || {};
      const roleValue = (r.roleValue || r.renameRole || "").toString().toLowerCase();
      if (!roleValue || roleValue === "student") studentIds.add(u._id.toString());
    }
    const gradeBands = getExerciseGradeBands(courseData, assessmentId);
    return students
      .filter((s) => {
        const matchingParticipant = participants.find((p: any) => p?.user?._id === s.id || p?._id === s.id);
        if (!matchingParticipant) return true;
        const uid = matchingParticipant?.user?._id?.toString();
        return !uid || studentIds.has(uid);
      })
      .map((s) => {
        const participant = participants.find((p: any) => p?.user?._id === s.id || p?._id === s.id);
        if (!participant) return s;
        const { totalMarks, scoredMarks, hasSubmitted, parentSubmitted, totalQuestions, completedQuestions } =
          computeStudentMarks({ courseData, courseId: courseId || "", exerciseId: assessmentId, participant });
        const canScale = hasSubmitted && totalMarks > 0 && typeof scoredMarks === "number";
        const scaleLabel = canScale
          ? scaleForPercent((scoredMarks / totalMarks) * 100, gradeBands) || undefined
          : undefined;
        return {
          ...s,
          totalMarks,
          totalQuestions,
          completed: completedQuestions,
          scoredMarks: hasSubmitted ? scoredMarks : undefined,
          scaleLabel,
          submitted: s.submitted || parentSubmitted,
        };
      });
  }, [students, courseDataResponse, assessmentId, courseId]);

  // Filters
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [scaleFromPct, setScaleFromPct] = useState<string>("");
  const [scaleToPct, setScaleToPct] = useState<string>("");
  const PASS_THRESHOLD = 50;
  const [passFailFilter, setPassFailFilter] = useState<"all" | "pass" | "fail">("all");

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [isDetailedReport, setIsDetailedReport] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const handleToggleDetailedReport = useCallback(() => {
    setIsDetailedReport((prev) => {
      const next = !prev;
      if (!next) setExpandedRowId(null);
      return next;
    });
  }, []);
  const handleToggleExpandRow = useCallback((studentId: string) => {
    setExpandedRowId((prev) => (prev === studentId ? null : studentId));
  }, []);

  // Per-question detail fetch — ONLY for the currently expanded student.
  const { data: expandedStudentDetails } = useQuery<{
    questions?: Array<{ id: string; timeTakenSeconds?: number }>;
  } | null>({
    queryKey: ["studentDetails", assessmentId, expandedRowId],
    queryFn: async () => {
      if (!assessmentId || !expandedRowId) return null;
      const token =
        (typeof window !== "undefined" &&
          (getToken() || localStorage.getItem("token"))) || "";
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5533";
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
    const timeTakenByQuestionId: Map<string, number> | null =
      expandedStudentDetails?.questions
        ? new Map(
            expandedStudentDetails.questions
              .filter((q) => q && q.id && typeof q.timeTakenSeconds === "number")
              .map((q) => [String(q.id), q.timeTakenSeconds as number]),
          )
        : null;
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

  // Stats strip
  const total = studentsWithMarks.length || totalStudents || students.length;
  const stats = useMemo(() => {
    let notStarted = 0, started = 0, submitted = 0;
    for (const s of studentsWithMarks) {
      const st = deriveTestStatus(s);
      if (st === "not-started") notStarted++;
      else if (st === "started") started++;
      else submitted++;
    }
    return { notStarted, started, submitted };
  }, [studentsWithMarks]);

  // Filter chain
  const filteredStudents = useMemo(() => {
    let rows = studentsWithMarks;
    if (statusFilter !== "all") rows = rows.filter(s => deriveTestStatus(s) === statusFilter);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(s =>
        (s.studentName || "").toLowerCase().includes(q) ||
        (s.email || "").toLowerCase().includes(q)
      );
    }
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
        if (typeof s.scoredMarks !== "number" || !s.totalMarks) return false;
        const pct = (s.scoredMarks / s.totalMarks) * 100;
        return passFailFilter === "pass" ? pct >= PASS_THRESHOLD : pct < PASS_THRESHOLD;
      });
    }
    return rows;
  }, [studentsWithMarks, statusFilter, searchQuery, scaleFromPct, scaleToPct, passFailFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageStudents = useMemo(
    () => filteredStudents.slice(startIdx, startIdx + rowsPerPage),
    [filteredStudents, startIdx, rowsPerPage],
  );
  const pageItems = useMemo(() => buildPageItems(safePage, totalPages), [safePage, totalPages]);

  const handleStatusChange = useCallback((v: StatusFilter) => { setStatusFilter(v); setPage(1); }, []);
  const handleSearchChange = useCallback((v: string) => { setSearchQuery(v); setPage(1); }, []);
  const handleScaleFromChange = useCallback((v: string) => { setScaleFromPct(v); setPage(1); }, []);
  const handleScaleToChange = useCallback((v: string) => { setScaleToPct(v); setPage(1); }, []);
  const handlePassFailChange = useCallback((v: "all" | "pass" | "fail") => { setPassFailFilter(v); setPage(1); }, []);

  // Breadcrumb trail
  const tabLabel = tabType.replace(/_/g, " ").trim();
  const baseCrumbs: { label: string; Icon?: any; onClick?: () => void }[] = [
    ...(courseName ? [{ label: courseName, Icon: GraduationCap }] : []),
    ...(moduleName ? [{ label: moduleName, Icon: Layers }] : []),
    ...(submoduleName ? [{ label: submoduleName, Icon: Layers }] : []),
    ...(topicName ? [{ label: topicName, Icon: BookOpen }] : []),
    ...(subtopicName ? [{ label: subtopicName, Icon: BookOpen }] : []),
    ...(tabLabel ? [{ label: tabLabel, Icon: ClipboardList }] : []),
    ...(subcategory ? [{ label: subcategory, Icon: Tag }] : []),
    { label: "Manage Users", onClick: goBackToManageUsers },
    { label: "Reports" },
  ];

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Custom scrollbar (matches old dashboard) */}
      <style jsx global>{`
        .lmsd-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
        .lmsd-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 8px; }
        .lmsd-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; border: 2px solid #f1f5f9; }
        .lmsd-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        .lmsd-scroll::-webkit-scrollbar-corner { background: #f1f5f9; }
        .lmsd-scroll { scrollbar-width: thin; scrollbar-color: #cbd5e1 #f1f5f9; }
      `}</style>

      {/* Breadcrumb bar */}
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 flex-shrink-0">
        <button
          type="button"
          onClick={goBackToManageUsers}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <nav className="flex items-center min-w-0 overflow-hidden text-[12.5px]">
          {baseCrumbs.map((c, i) => {
            const isLast = i === baseCrumbs.length - 1;
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
                      : c.onClick ? "text-blue-600 hover:text-blue-700 hover:underline"
                      : "text-slate-600 cursor-default"
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

      {/* Content */}
      <div className="flex-1 min-h-0 flex flex-col p-5 gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 flex-shrink-0">
          <div className="min-w-0">
            <h1 className="text-[16px] font-semibold text-gray-900 leading-tight">Reports</h1>
            <p className="text-[11.5px] text-gray-500 mt-0.5">
              {assessmentName || assessmentNameParam || "Assessment"} · Live Session
            </p>
          </div>
        </div>

        {/* Stats + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center flex-wrap gap-x-1 gap-y-1 text-[13px] text-gray-700">
            <span><span className="text-gray-500">Total Students:</span> <span className="font-semibold text-gray-900">{total}</span></span>
            <span className="text-gray-300 mx-2">|</span>
            <span><span className="text-gray-500">Not Started:</span> <span className="font-semibold text-gray-700">{stats.notStarted}</span></span>
            <span className="text-gray-300 mx-2">|</span>
            <span><span className="text-gray-500">Started:</span> <span className="font-semibold text-amber-600">{stats.started}</span></span>
            <span className="text-gray-300 mx-2">|</span>
            <span><span className="text-gray-500">Submitted:</span> <span className="font-semibold text-green-600">{stats.submitted}</span></span>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setExportModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors"
              title="Open the Report Export Preview"
            >
              <Download size={13} />
              Export
            </button>
            <div className="flex items-center gap-2">
              <label className="text-[12.5px] font-medium text-gray-500 whitespace-nowrap">
                Detailed Report:
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={isDetailedReport}
                onClick={handleToggleDetailedReport}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  isDetailedReport ? "bg-indigo-600" : "bg-gray-200"
                }`}
                title={
                  isDetailedReport
                    ? "Hide per-question detail expanders"
                    : "Show per-question detail expanders on each row"
                }
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    isDetailedReport ? "translate-x-[18px]" : "translate-x-[2px]"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder="Search name or email…"
              className="border border-gray-200 rounded-lg pl-7 pr-2.5 py-1.5 text-[13px] text-gray-700 outline-none focus:border-indigo-400 w-[220px]"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[12.5px] font-medium text-gray-500 whitespace-nowrap">Scale:</label>
            <input
              type="number" min={0} max={100} step={1} inputMode="numeric"
              value={scaleFromPct}
              onChange={e => handleScaleFromChange(e.target.value)}
              placeholder="From"
              aria-label="Scale from percent"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] text-gray-700 outline-none focus:border-indigo-400 w-[70px]"
            />
            <span className="text-[12.5px] text-gray-400">to</span>
            <input
              type="number" min={0} max={100} step={1} inputMode="numeric"
              value={scaleToPct}
              onChange={e => handleScaleToChange(e.target.value)}
              placeholder="To"
              aria-label="Scale to percent"
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-[13px] text-gray-700 outline-none focus:border-indigo-400 w-[70px]"
            />
            <span className="text-[12.5px] text-gray-400">%</span>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="passfail-filter" className="text-[12.5px] font-medium text-gray-500 whitespace-nowrap">Result:</label>
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

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <label htmlFor="status-filter" className="text-[12.5px] font-medium text-gray-500 whitespace-nowrap">Status:</label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={e => handleStatusChange(e.target.value as StatusFilter)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-700 outline-none focus:border-indigo-400"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 min-h-0 flex flex-col overflow-hidden">
          {isLoading ? (
            <div className="p-10 text-center text-[13px] text-gray-400">Loading reports…</div>
          ) : error ? (
            <div className="p-10 text-center text-[13px] text-red-500">{error}</div>
          ) : (
            <>
              {(() => {
                const reportHeaders = isDetailedReport
                  ? [...REPORT_HEADERS_BASE, CHEVRON_COL]
                  : REPORT_HEADERS_BASE;
                return (
                  <div className="overflow-auto flex-1 min-h-0 lmsd-scroll">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          {reportHeaders.map((h, idx) => (
                            <th
                              key={h || `col-${idx}`}
                              className={`sticky top-0 z-10 bg-gray-50 px-4 py-3 text-[12px] font-semibold text-gray-600 whitespace-nowrap ${REPORT_LEFT_ALIGN.has(h) ? "text-left" : "text-center"} ${h === CHEVRON_COL ? "w-10" : ""}`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pageStudents.map((s, i) => (
                          <ReportRow
                            key={s.id}
                            student={s}
                            index={startIdx + i}
                            isDetailedReport={isDetailedReport}
                            isExpanded={expandedRowId === s.id}
                            onToggleExpand={handleToggleExpandRow}
                            breakdown={expandedRowId === s.id ? expandedBreakdown : null}
                            columnCount={reportHeaders.length}
                          />
                        ))}
                        {filteredStudents.length === 0 && (
                          <tr>
                            <td colSpan={reportHeaders.length}
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

              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-gray-100 flex-shrink-0">
                <span className="text-[13px] text-gray-500">
                  {filteredStudents.length === 0
                    ? "No students"
                    : `Showing ${startIdx + 1} to ${Math.min(startIdx + rowsPerPage, filteredStudents.length)} of ${filteredStudents.length} ${statusFilter === "all" ? "students" : "matched"}`}
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

      <ReportExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        students={studentsWithMarks}
        assessmentName={assessmentName || assessmentNameParam || "Assessment"}
        courseData={(courseDataResponse as any)?.data ?? null}
        courseId={courseId || ""}
        exerciseId={assessmentId || ""}
        courseName={courseName}
        moduleName={moduleName}
        submoduleName={submoduleName}
        topicName={topicName}
        subtopicName={subtopicName}
      />
    </div>
  );
}

export default function ManageUsersReportsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-[13px] text-gray-400">Loading…</div>}>
      <ManageUsersReportsInner />
    </Suspense>
  );
}
