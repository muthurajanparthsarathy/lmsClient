"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, ChevronRight, ChevronDown, AlertTriangle, Share2, MoreVertical,
  Search, Check, Printer, Download,
} from "lucide-react";

import { useSectionHref } from "@/lib/sectionRoute";
import { courseDataApi } from "@/app/lms/pages/courses/api/coursesData";

import AssessmentReportHeader from "./AssessmentReportHeader";
import StudentsResultTable from "./StudentsResultTable";
import { useLiveDashboard } from "../hooks/useLiveDashboard";
import { deriveTestStatus } from "../utils/deriveTestStatus";
import {
  findExercise, deriveAssessmentMeta,
} from "../utils/assessmentHeader";
import { computeStudentMarks } from "../utils/computeStudentMarks";
import type { StudentProgress } from "../types/liveDashboard.types";
import { aggregateExercise } from "../utils/questionAggregate";

// ── Session detail — the Live Dashboard's report page ───────────────────────
//
//   [top nav]  Back  Programming > <name>              Share  ⋮
//   [header]   title + chips + counts            Started · thumb
//   [toolbar]  search · Test Status filter           (no tabs — Overview only)
//   [table]    dense learner list (Student · Test Status · Marks · % · Scale)
//              + pagination

type UiStatus = "all" | "not-started" | "started" | "submitted";

const STATUS_OPTIONS: { value: UiStatus; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "not-started", label: "Not Started" },
  { value: "started", label: "In Progress" },
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-10 min-w-[192px] items-center gap-2 rounded-lg border bg-white px-3 text-left transition-colors ${
          open
            ? "border-indigo-500 ring-2 ring-indigo-100"
            : "border-gray-200 hover:border-gray-300"
        }`}
      >
        <div className="flex flex-col leading-tight min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {label}
          </span>
          <span className="text-[13px] font-medium text-gray-800 truncate">
            {current?.label ?? "—"}
          </span>
        </div>
        <ChevronDown
          size={14}
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
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12.5px] transition-colors ${
                    active
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<UiStatus>("all");

  const [shareCopied, setShareCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const {
    students, assessmentName, startDate,
    isLoading: liveLoading, error: liveError,
  } = useLiveDashboard({ assessmentId, courseId, nodeId, nodeType });

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
        completed: marks.completedQuestions,
        scoredMarks: marks.hasSubmitted ? marks.scoredMarks : undefined,
        submitted: s.submitted || marks.parentSubmitted,
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
  const meta = useMemo(() => deriveAssessmentMeta(exercise, subcategory), [exercise, subcategory]);
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
    const qs = new URLSearchParams();
    if (returnTab) qs.set("tab", returnTab);
    router.push(`${sectionHref("uploadcourseresources")}${qs.toString() ? `?${qs.toString()}` : ""}`);
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
    const path = `${sectionHref("reviewSubmission")}?${qs.toString()}`;
    // Open in a new tab so the dashboard stays where it is — the trainer
    // often flips between several learners' submissions and losing the
    // filtered dashboard on every jump was slowing them down. `noopener` +
    // `noreferrer` cuts the new tab's `window.opener` reference off, so the
    // reviewSubmission page can't script this window.
    if (typeof window !== "undefined") {
      const url = new URL(path, window.location.origin).toString();
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, [
    sectionHref, assessmentId, courseId, nodeId, nodeType, subcategory,
    moduleName, submoduleName, topicName, subtopicName, tabType,
  ]);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  }, []);

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
    <div className="h-full flex flex-col bg-white">
      <div className="flex items-center gap-2.5 px-6 py-2.5 border-b border-gray-100 flex-shrink-0">
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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[12px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            title="Copy a link to this report"
          >
            {shareCopied ? <Check size={12} className="text-emerald-600" /> : <Share2 size={12} />}
            {shareCopied ? "Copied" : "Share"}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="More actions"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); window.print(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-gray-700 hover:bg-gray-50"
                >
                  <Printer size={13} className="text-gray-400" /> Print report
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); handleShare(); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-gray-700 hover:bg-gray-50"
                >
                  <Download size={13} className="text-gray-400" /> Copy report link
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <div className="px-6 py-3 flex flex-col gap-2.5">
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
          />

          {/* Compact toolbar — search + Test Status only, left-aligned. Tabs
              are gone: the page shows the learner list directly since
              Overview was the only view left. */}
          <div className="flex items-center justify-start gap-3 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student by name, email or register number…"
                className="w-[340px] max-w-full h-10 pl-8 pr-3 rounded-lg border border-gray-200 text-[13px] text-gray-800 placeholder:text-gray-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <StatusSelect
              label="Test Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />
          </div>

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
              search={search}
              statusFilter={statusFilter}
            />
          )}
        </div>
      </div>
    </div>
  );
}
