"use client";

// ── Generate Report modal ───────────────────────────────────────────────────
//
// Replaces the old Export dropdown on the Live Dashboard toolbar. The trainer:
//   1. filters learners by scale, %-range, status, search
//   2. selects the exact learners to include
//   3. (optionally) turns on Detailed View + picks which questions to include
//   4. previews each learner's per-question breakdown
//   5. exports the resulting dataset to Excel or PDF
//
// Every filter narrows the same list — the counts in the footer summary and
// the rows emitted to Excel/PDF always match what the trainer sees in the
// preview above. Marks, percentage, scale, status all reuse the same helpers
// the dashboard table trusts (`computeStudentMarks`, `deriveTestStatus`,
// `getExerciseGradeBands`, `scaleForPercent`, `computeStudentQuestionRows`)
// so numbers never drift.

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { createPortal } from "react-dom";
import {
  X, Search, ChevronDown, ChevronUp, Check, FileSpreadsheet, FileText,
  FileBarChart2, Download,
} from "lucide-react";

import type { StudentProgress } from "../types/liveDashboard.types";
import { deriveTestStatus } from "../utils/deriveTestStatus";
import {
  getExerciseGradeBands, scaleForPercent, type GradeBand,
} from "../utils/computeStudentMarks";
import {
  computeStudentQuestionRows, listExerciseQuestions,
  type StudentQuestionRow, type ExerciseQuestionMeta,
} from "../utils/reportDetails";

// ── Types ──────────────────────────────────────────────────────────────────
type StudentsMode = "all" | "selected";
type PercentagePreset =
  | "all"
  | "90plus"
  | "80to89"
  | "70to79"
  | "60to69"
  | "below60"
  | "custom";

type TestStatusValue =
  | "all"
  | "not-started"
  | "started"
  | "submitted"
  | "awaiting-approval"
  | "terminated";

const STATUS_LABEL: Record<Exclude<TestStatusValue, "all">, string> = {
  "not-started": "Not Started",
  "started": "Started",
  "submitted": "Completed",
  "awaiting-approval": "Needs Approval",
  "terminated": "Terminated",
};


const PERCENT_LABEL: Record<PercentagePreset, string> = {
  all: "All",
  "90plus": "90% and above",
  "80to89": "80% – 89%",
  "70to79": "70% – 79%",
  "60to69": "60% – 69%",
  "below60": "Below 60%",
  custom: "Custom Range",
};

const initialsOf = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase() || "?";
};

const fmtDateTime = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
};

const fmtDuration = (secs: number | null): string => {
  if (secs == null || !Number.isFinite(secs) || secs <= 0) return "—";
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const rem = secs % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return rem ? `${m}m ${String(rem).padStart(2, "0")}s` : `${m}m`;
};

const safeFileName = (s: string): string =>
  s.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 70) || "assessment-report";

// ── Compact reusable popover dropdown ─────────────────────────────────────
function DropdownShell({
  label, current, open, onToggle, onClose, children,
  width = 180,
}: {
  label: string;
  current: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  /** Fixed CSS width in px. Fields keep this width and don't shrink or
   *  overflow — the flex row wraps instead of overlapping when narrow. */
  width?: number;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div ref={rootRef} className="relative flex-shrink-0" style={{ width }}>
      <button
        type="button"
        onClick={onToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className={`relative flex h-9 w-full items-center gap-2 rounded-md border bg-white px-2.5 text-left transition-colors ${open
          ? "border-orange-500 ring-2 ring-orange-100"
          : "border-gray-200 hover:border-gray-300"
          }`}
      >
        {/* Floating outlined label — sits on the top edge of the field. */}
        <span
          className={`pointer-events-none absolute -top-[7px] left-2 bg-white px-1 text-[10px] font-semibold tracking-wide whitespace-nowrap transition-colors ${open ? "text-orange-600" : "text-gray-500"
            }`}
        >
          {label}
        </span>
        <span className="truncate text-[12.5px] font-medium text-gray-800">{current}</span>
        <ChevronDown
          size={13}
          className={`ml-auto flex-shrink-0 text-gray-500 transition-transform ${open ? "rotate-180 text-orange-500" : ""}`}
        />
      </button>
      {open && (
        <div
          className="absolute left-0 z-40 mt-1 min-w-full overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Component props ────────────────────────────────────────────────────────
export interface ReportGenerateModalProps {
  open: boolean;
  onClose: () => void;
  students: StudentProgress[];
  courseData: any | null;
  courseId: string;
  exerciseId: string;
  assessmentName: string;
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ReportGenerateModal(props: ReportGenerateModalProps) {
  const { open, onClose, students, courseData, courseId, exerciseId, assessmentName } = props;

  // Filter state
  const [studentsMode, setStudentsMode] = useState<StudentsMode>("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [performanceScaleFilter, setPerformanceScaleFilter] = useState<Set<string>>(new Set());
  const [percentageRange, setPercentageRange] = useState<PercentagePreset>("all");
  const [customFrom, setCustomFrom] = useState<string>("0");
  const [customTo, setCustomTo] = useState<string>("100");
  const [customError, setCustomError] = useState<string | null>(null);
  const [testStatusFilter, setTestStatusFilter] = useState<TestStatusValue>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [detailedView, setDetailedView] = useState(false);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<string>>(new Set());

  // Dropdown-open flags
  const [studentsOpen, setStudentsOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [percentOpen, setPercentOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setExportOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [exportOpen]);

  // ── Derived data (exercise, bands, questions) ────────────────────────────
  const bands: GradeBand[] = useMemo(
    () => getExerciseGradeBands(courseData, exerciseId),
    [courseData, exerciseId],
  );
  const exerciseQuestions: ExerciseQuestionMeta[] = useMemo(
    () => listExerciseQuestions(courseData, exerciseId),
    [courseData, exerciseId],
  );

  // Which statuses actually appear in the current roster — surfaces only the
  // options the trainer can realistically filter on (never invents statuses).
  const availableStatuses: Exclude<TestStatusValue, "all">[] = useMemo(() => {
    const set = new Set<Exclude<TestStatusValue, "all">>();
    for (const s of students) {
      const st = deriveTestStatus(s);
      if (st === "disconnected") continue; // no longer emitted
      set.add(st as Exclude<TestStatusValue, "all">);
    }
    // Stable ordering
    const order: Exclude<TestStatusValue, "all">[] = [
      "started", "not-started", "submitted", "awaiting-approval", "terminated",
    ];
    return order.filter(o => set.has(o));
  }, [students]);

  // ── One-shot init when the modal opens: pre-select all students + all
  // questions so the trainer's first click is downloading, not selecting.
  const openedOnceRef = useRef(false);
  useEffect(() => {
    if (!open) { openedOnceRef.current = false; return; }
    if (openedOnceRef.current) return;
    openedOnceRef.current = true;
    setSelectedStudentIds(new Set(students.map(s => s.id)));
    setSelectedQuestionIds(new Set(exerciseQuestions.map(q => q.id)));
    setStudentsMode("all");
    setPerformanceScaleFilter(new Set());
    setPercentageRange("all");
    setCustomFrom("0");
    setCustomTo("100");
    setCustomError(null);
    setTestStatusFilter("all");
    setSearchQuery("");
    setDetailedView(false);
    setExpandedStudentIds(new Set());
  }, [open, students, exerciseQuestions]);

  // Escape + body-scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // ── Percentage matcher ───────────────────────────────────────────────────
  const parseCustomRange = useCallback((): { from: number; to: number } | null => {
    const from = Number(customFrom);
    const to = Number(customTo);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
    const clampedFrom = Math.max(0, Math.min(100, from));
    const clampedTo = Math.max(0, Math.min(100, to));
    if (clampedFrom > clampedTo) return null;
    return { from: clampedFrom, to: clampedTo };
  }, [customFrom, customTo]);

  useEffect(() => {
    if (percentageRange !== "custom") { setCustomError(null); return; }
    const parsed = parseCustomRange();
    if (parsed) setCustomError(null);
    else setCustomError("From must be ≤ To and both must be 0–100.");
  }, [percentageRange, parseCustomRange]);

  const percentageMatches = useCallback((pct: number | null): boolean => {
    if (percentageRange === "all") return true;
    if (pct == null) return false;
    switch (percentageRange) {
      case "90plus": return pct >= 90;
      case "80to89": return pct >= 80 && pct <= 89;
      case "70to79": return pct >= 70 && pct <= 79;
      case "60to69": return pct >= 60 && pct <= 69;
      case "below60": return pct < 60;
      case "custom": {
        const parsed = parseCustomRange();
        if (!parsed) return false;
        return pct >= parsed.from && pct <= parsed.to;
      }
      default: return true;
    }
  }, [percentageRange, parseCustomRange]);

  // ── Compute filter-matched student list (independent of selection) ───────
  //
  // A row that matches the current filters is "eligible". Selection is a
  // separate concept: the trainer may deselect a matching row to keep it out
  // of the export. `Students filter = Selected Students` narrows the visible
  // list to only rows already ticked.
  const enrichedStudents = useMemo(() => {
    return students.map((s) => {
      const scored = s.scoredMarks == null ? null : Math.round(s.scoredMarks * 10) / 10;
      const totalMarks = s.totalMarks ?? 0;
      const percentage = scored != null && totalMarks > 0
        ? Math.round((scored / totalMarks) * 100)
        : null;
      const scaleLabel = percentage != null ? scaleForPercent(percentage, bands) : "";
      const status = deriveTestStatus(s);
      // Assessment-progress numbers — sourced from the same StudentProgress
      // fields the Live Dashboard already trusts (`totalQuestions` +
      // `completed` after computeStudentMarks has enriched the row).
      const totalQuestions = s.totalQuestions ?? 0;
      const attempted = Math.max(0, Math.min(s.completed ?? 0, totalQuestions));
      const completionPercent = totalQuestions > 0
        ? Math.round((attempted / totalQuestions) * 100)
        : null;
      return {
        student: s, scored, totalMarks, percentage, scaleLabel, status,
        totalQuestions, attempted, completionPercent,
      };
    });
  }, [students, bands]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return enrichedStudents.filter(({ student, percentage, scaleLabel, status }) => {
      // Search
      if (q) {
        const name = (student.studentName || "").toLowerCase();
        const email = (student.email || "").toLowerCase();
        const regNo = (student.studentDisplayId || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !regNo.includes(q)) return false;
      }
      // Test status
      if (testStatusFilter !== "all" && status !== testStatusFilter) return false;
      // Performance scale
      if (performanceScaleFilter.size > 0) {
        if (!scaleLabel || !performanceScaleFilter.has(scaleLabel)) return false;
      }
      // Percentage
      if (!percentageMatches(percentage)) return false;
      // Students filter mode
      if (studentsMode === "selected") {
        if (!selectedStudentIds.has(student.id)) return false;
      }
      return true;
    });
  }, [
    enrichedStudents, searchQuery, testStatusFilter, performanceScaleFilter,
    percentageMatches, studentsMode, selectedStudentIds,
  ]);

  // Effective export set = filtered ∩ selected (matches must also be ticked)
  const exportRows = useMemo(() =>
    filteredStudents.filter(r => selectedStudentIds.has(r.student.id)),
    [filteredStudents, selectedStudentIds],
  );

  // Effective question selection for the export. Empty when Detailed View
  // is off (summary-only export skips per-question rows). Otherwise the
  // ticked chip set, intersected with questions still present on the
  // exercise (defensive — if the exercise reshapes mid-open, stale ids drop).
  const exportQuestionIds = useMemo(() => {
    if (!detailedView) return new Set<string>();
    return new Set(
      [...selectedQuestionIds].filter(id => exerciseQuestions.some(q => q.id === id)),
    );
  }, [detailedView, exerciseQuestions, selectedQuestionIds]);

  // Derived: is every question currently ticked? Drives the "Select All
  // Questions" master checkbox's checked state so it stays in sync with
  // manual chip toggles.
  const allQuestionsSelected = exerciseQuestions.length > 0
    && exerciseQuestions.every(q => selectedQuestionIds.has(q.id));
  const someQuestionsSelected = exerciseQuestions.some(q => selectedQuestionIds.has(q.id));

  // ── Handlers ─────────────────────────────────────────────────────────────
  const toggleStudent = useCallback((id: string) => {
    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleQuestion = useCallback((id: string) => {
    setSelectedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAllQuestions = useCallback((next: boolean) => {
    setSelectedQuestionIds(() => {
      if (next) return new Set(exerciseQuestions.map(q => q.id));
      return new Set();
    });
  }, [exerciseQuestions]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setStudentsMode("all");
    setPerformanceScaleFilter(new Set());
    setPercentageRange("all");
    setCustomFrom("0");
    setCustomTo("100");
    setCustomError(null);
    setTestStatusFilter("all");
    setSearchQuery("");
  }, []);

  const selectAllVisible = useCallback((next: boolean) => {
    setSelectedStudentIds(prev => {
      const set = new Set(prev);
      if (next) filteredStudents.forEach(r => set.add(r.student.id));
      else filteredStudents.forEach(r => set.delete(r.student.id));
      return set;
    });
  }, [filteredStudents]);

  // Cache per-student question rows for the expanded panels. Computed lazily
  // (only for expanded students) so opening the modal is cheap for big classes.
  const questionRowsByStudent = useMemo(() => {
    const out = new Map<string, StudentQuestionRow[]>();
    for (const id of expandedStudentIds) {
      if (!students.some(s => s.id === id)) continue;
      out.set(id, computeStudentQuestionRows({ courseData, courseId, exerciseId, studentId: id }));
    }
    return out;
  }, [expandedStudentIds, courseData, courseId, exerciseId, students]);

  // ── Exports ──────────────────────────────────────────────────────────────

  const buildExportPayload = useCallback(() => {
    // For every EXPORTED student compute their question rows. Only include
    // questions the trainer selected (or all when includeAllQuestions).
    const selectedQIds = exportQuestionIds;
    const payload = exportRows.map((row) => {
      const questionRows = detailedView
        ? computeStudentQuestionRows({
            courseData, courseId, exerciseId, studentId: row.student.id,
          }).filter(q => selectedQIds.has(q.questionId))
        : [];
      return { ...row, questions: questionRows };
    });
    return payload;
  }, [exportRows, exportQuestionIds, detailedView, courseData, courseId, exerciseId]);

  // ── Shared metadata header for Excel + PDF ───────────────────────────────
  //
  // Both exports start with the same context block so a downloaded file
  // stands on its own: the reader knows which assessment it belongs to,
  // when it was generated, which filters were applied, and how many
  // learners / questions it covers.
  const buildReportMetadata = useCallback((studentCount: number): { label: string; value: string }[] => {
    const filterParts: string[] = [];
    if (studentsMode === "selected") filterParts.push("Selected Students only");
    if (performanceScaleFilter.size > 0) filterParts.push(`Scale: ${[...performanceScaleFilter].join(", ")}`);
    if (percentageRange !== "all") filterParts.push(`Percentage: ${PERCENT_LABEL[percentageRange]}`);
    if (testStatusFilter !== "all") filterParts.push(`Status: ${STATUS_LABEL[testStatusFilter as Exclude<TestStatusValue, "all">]}`);
    if (searchQuery.trim()) filterParts.push(`Search: "${searchQuery.trim()}"`);

    const rows: { label: string; value: string }[] = [];
    rows.push({ label: "Assessment", value: assessmentName || "—" });
    // Course + learning stage — reuses whatever we can read off the exercise
    // via the shared course-data lookup. Rendered only when actually present.
    const courseName = String((courseData as any)?.courseName || (courseData as any)?.name || "").trim();
    if (courseName) rows.push({ label: "Course", value: courseName });
    rows.push({ label: "Report Generated", value: new Date().toLocaleString("en-GB") });
    rows.push({ label: "Report Type", value: detailedView ? "Detailed (per-question)" : "Summary" });
    rows.push({ label: "Selected Students", value: String(studentCount) });
    if (detailedView) {
      rows.push({ label: "Selected Questions", value: `${exportQuestionIds.size} of ${exerciseQuestions.length}` });
    }
    rows.push({ label: "Applied Filters", value: filterParts.length > 0 ? filterParts.join("  ·  ") : "None" });
    return rows;
  }, [
    assessmentName, courseData, detailedView, exportQuestionIds.size,
    exerciseQuestions.length, studentsMode, performanceScaleFilter,
    percentageRange, testStatusFilter, searchQuery,
  ]);

  const canExport = exportRows.length > 0 && (!detailedView || exportQuestionIds.size > 0);

  const handleExportExcel = useCallback(async () => {
    if (!canExport) return;
    const payload = buildExportPayload();
    const XLSX = await import("xlsx");

    const workbook = XLSX.utils.book_new();

    // ── Summary sheet — metadata header on top, learner table below. ──
    const metadata = buildReportMetadata(payload.length);
    const headerRows: any[][] = [
      ["Assessment Report"],
      ...metadata.map(m => [m.label, m.value]),
      [], // spacer between metadata and the learner table
    ];
    const summaryHeader = [
      "#", "Student Name", "Register Number", "Email",
      "Questions Attempted",
      "Marks Obtained", "Total Marks", "Scale",
    ];
    const summaryBody = payload.map((r, i) => [
      i + 1,
      r.student.studentName || "—",
      r.student.studentDisplayId || "—",
      r.student.email || "—",
      r.totalQuestions > 0 ? `${r.attempted} / ${r.totalQuestions}` : "—",
      r.scored ?? "—",
      r.totalMarks || "—",
      r.scaleLabel || "—",
    ]);
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ...headerRows,
      summaryHeader,
      ...summaryBody,
    ]);
    summarySheet["!cols"] = [
      { wch: 5 }, { wch: 24 }, { wch: 18 }, { wch: 28 },
      { wch: 20 }, { wch: 16 },
      { wch: 14 }, { wch: 16 },
    ];
    // Merge the title + metadata value column across the full sheet width.
    const summaryLastCol = summaryHeader.length - 1;
    summarySheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: summaryLastCol } },
      ...metadata.map((_, idx) => ({
        s: { r: idx + 1, c: 1 }, e: { r: idx + 1, c: summaryLastCol },
      })),
    ];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Learner Summary");

    // ── Detailed sheet — one row per (Student, Question) ──
    if (detailedView && payload.some(p => p.questions.length > 0)) {
      const detailRows: any[] = [];
      for (const r of payload) {
        for (const q of r.questions) {
          detailRows.push({
            "Student Name": r.student.studentName || "—",
            "Register Number": r.student.studentDisplayId || "—",
            "Email": r.student.email || "—",
            "Question #": q.index,
            "Question Title": q.title,
            "Question Type": q.type,
            "Submission Status": q.submissionStatusLabel,
            "Test Cases": q.testCasesLabel,
            "Marks Scored": q.scoredMark == null ? "—" : q.scoredMark,
            "Total Marks": q.totalMark,
            "Percentage": q.percentage == null ? "—" : `${q.percentage}%`,
            "Evaluation Status": q.evaluationLabel,
            "Language": q.language ?? "—",
            "Time Taken": fmtDuration(q.timeTakenSeconds),
            "Submitted At": q.submittedAt ? fmtDateTime(q.submittedAt) : "—",
          });
        }
      }
      if (detailRows.length > 0) {
        const detailHeaderKeys = Object.keys(detailRows[0]);
        const detailAoa: (string | number)[][] = [
          ["Assessment Report — Question Details"],
          ...metadata.map(m => [m.label, m.value]),
          [],
          detailHeaderKeys,
          ...detailRows.map(r => detailHeaderKeys.map(k => (r as any)[k])),
        ];
        const detailSheet = XLSX.utils.aoa_to_sheet(detailAoa);
        detailSheet["!cols"] = [
          { wch: 24 }, { wch: 18 }, { wch: 28 }, { wch: 10 }, { wch: 38 },
          { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 12 },
          { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 22 },
        ];
        const lastCol = Math.max(0, detailHeaderKeys.length - 1);
        detailSheet["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
          ...metadata.map((_, idx) => ({
            s: { r: idx + 1, c: 1 }, e: { r: idx + 1, c: lastCol },
          })),
        ];
        XLSX.utils.book_append_sheet(workbook, detailSheet, "Question Details");
      }
    }

    XLSX.writeFile(workbook, `${safeFileName(assessmentName || "Assessment Report")}.xlsx`);
  }, [canExport, buildExportPayload, buildReportMetadata, detailedView, assessmentName]);

  const handleExportPdf = useCallback(async () => {
    if (!canExport) return;
    const payload = buildExportPayload();
    const { jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = (autoTableModule as any).default || (autoTableModule as any);

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;

    // ── Title block ─────────────────────────────────────────────────────
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text("Assessment Report", margin, margin + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, margin, margin + 11);

    // ── Metadata block — label / value two-column table ─────────────────
    const metadata = buildReportMetadata(payload.length);
    autoTable(doc, {
      startY: margin + 15,
      head: [],
      body: metadata.map(m => [m.label, m.value]),
      styles: { fontSize: 8.5, cellPadding: 2.2, overflow: "linebreak", textColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: "bold", fillColor: [254, 245, 231], textColor: [154, 52, 18] },
        1: { cellWidth: pageWidth - margin * 2 - 42 },
      },
      margin: { left: margin, right: margin },
      theme: "grid",
    });
    const afterMeta = (doc as any).lastAutoTable?.finalY ?? margin + 20;
    const summaryStartY = afterMeta + 6;

    // ── Summary table ───────────────────────────────────────────────────
    autoTable(doc, {
      startY: summaryStartY,
      head: [[
        "#", "Student", "Reg. No.", "Attempted", "Marks", "Scale",
      ]],
      body: payload.map((r, i) => [
        i + 1,
        r.student.studentName || "—",
        r.student.studentDisplayId || "—",
        r.totalQuestions > 0 ? `${r.attempted} / ${r.totalQuestions}` : "—",
        r.scored == null ? "—" : `${r.scored} / ${r.totalMarks}`,
        r.scaleLabel || "—",
      ]),
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: "linebreak" },
      headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      margin: { left: margin, right: margin },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 78 },
        2: { cellWidth: 28 },
        3: { cellWidth: 24, halign: "center" },
        4: { cellWidth: 28, halign: "right" },
        5: { cellWidth: 55 },
      },
    });

    // Per-student question details
    if (detailedView) {
      for (const r of payload) {
        if (r.questions.length === 0) continue;

        doc.addPage();
        let cursorY = margin + 6;

        // Learner header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text(r.student.studentName || "—", margin, cursorY);
        cursorY += 5;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const idLine = [r.student.studentDisplayId, r.student.email]
          .filter(Boolean).join("  ·  ");
        if (idLine) {
          doc.text(idLine, margin, cursorY);
          cursorY += 4;
        }

        // Score line — assessment progress + performance for this learner.
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        const scoreLine = [
          r.totalQuestions > 0
            ? `Attempted ${r.attempted} / ${r.totalQuestions}`
            : "Attempted —",
          r.completionPercent == null ? "Completion —" : `Completion ${r.completionPercent}%`,
          r.scored == null ? "Marks — / —" : `Marks ${r.scored} / ${r.totalMarks}`,
          r.percentage == null ? "Score —" : `Score ${r.percentage}%`,
          r.scaleLabel || "—",
        ].join("  ·  ");
        doc.text(scoreLine, margin, cursorY + 4);
        cursorY += 10;

        // Question detail table
        autoTable(doc, {
          startY: cursorY,
          head: [[
            "#", "Question Title", "Type", "Status", "Marks", "Test Cases",
            "Percentage", "Evaluation",
          ]],
          body: r.questions.map(q => [
            q.index,
            q.title,
            q.type,
            q.submissionStatusLabel,
            q.scoredMark == null ? "—" : `${q.scoredMark} / ${q.totalMark}`,
            q.testCasesLabel,
            q.percentage == null ? "—" : `${q.percentage}%`,
            q.evaluationLabel,
          ]),
          styles: { fontSize: 8, cellPadding: 2.2, overflow: "linebreak" },
          headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [255, 247, 237] },
          margin: { left: margin, right: margin },
          columnStyles: {
            0: { cellWidth: 8 }, 1: { cellWidth: 78 }, 2: { cellWidth: 18 },
            3: { cellWidth: 22 }, 4: { cellWidth: 22 }, 5: { cellWidth: 26 },
            6: { cellWidth: 20 }, 7: { cellWidth: 32 },
          },
          didDrawPage: () => {
            // Nothing extra: page numbers are stamped in one pass at the end.
          },
        });
      }
    }

    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${i} / ${pageCount}`,
        pageWidth - margin,
        pageHeight - 6,
        { align: "right" },
      );
    }

    doc.save(`${safeFileName(assessmentName || "Assessment Report")}.pdf`);
  }, [canExport, buildExportPayload, buildReportMetadata, assessmentName, detailedView]);

  if (!open) return null;

  // ── UI ──
  const selectedCount = exportRows.length;
  const allVisibleTicked = filteredStudents.length > 0
    && filteredStudents.every(r => selectedStudentIds.has(r.student.id));
  const someVisibleTicked = filteredStudents.some(r => selectedStudentIds.has(r.student.id));

  // Compact summary line for the footer
  const summaryPieces: string[] = [];
  summaryPieces.push(`${selectedCount} ${selectedCount === 1 ? "student" : "students"} selected`);
  if (detailedView) {
    summaryPieces.push(`Detailed View`);
    summaryPieces.push(`${exportQuestionIds.size} ${exportQuestionIds.size === 1 ? "question" : "questions"}`);
  } else {
    summaryPieces.push("Summary View");
  }
  if (percentageRange !== "all") summaryPieces.push(PERCENT_LABEL[percentageRange]);
  if (performanceScaleFilter.size > 0) summaryPieces.push([...performanceScaleFilter].join(", "));

  const modal = (
    <div
      className="fixed inset-0 z-[1500] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Generate Report"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        style={{
          width: "95vw",
          maxWidth: 1680,
          // Fixed frame — the modal must not shrink when the student list is
          // short (2 rows shouldn't collapse the whole shell). On tall desktop
          // viewports the shell parks at 82vh; on smaller screens min/max
          // keep it in a readable range. Body area uses flex:1 to absorb any
          // remaining space as neutral white ground.
          height: "82vh",
          minHeight: "min(720px, 90vh)",
          maxHeight: 860,
        }}
      >
        {/* ── Sticky header — compact orange-accented title strip. */}
        <div className="flex-shrink-0 border-b border-gray-100 px-5 py-2.5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-50 text-orange-600 flex-shrink-0">
            <FileBarChart2 size={16} />
          </div>
          <h2 className="text-[16px] font-semibold text-gray-900 leading-tight flex-1 truncate">Generate Report</h2>

          {/* Export — single split button with a PDF / Excel dropdown.
              Sits directly next to the close X and is the only export
              entry-point in the whole modal (footer no longer duplicates it). */}
          <div ref={exportMenuRef} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => canExport && setExportOpen(o => !o)}
              disabled={!canExport}
              aria-haspopup="menu"
              aria-expanded={exportOpen}
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold transition-colors ${canExport
                ? "bg-orange-600 text-white hover:bg-orange-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              title={canExport ? "Export the report" : "Select at least one student"}
            >
              <Download size={13} />
              Export
              <ChevronDown size={13} className={`transition-transform ${exportOpen ? "rotate-180" : ""}`} />
            </button>
            {exportOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-1.5 w-[180px] overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setExportOpen(false); handleExportExcel(); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-[12.5px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
                    <FileSpreadsheet size={14} className="text-emerald-600" />
                  </span>
                  <div>
                    <div>Excel</div>
                    <div className="text-[10.5px] font-normal text-gray-400">.xlsx workbook</div>
                  </div>
                </button>
                <div className="mx-3 border-t border-gray-100" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setExportOpen(false); handleExportPdf(); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-[12.5px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50">
                    <FileText size={14} className="text-rose-600" />
                  </span>
                  <div>
                    <div>PDF</div>
                    <div className="text-[10.5px] font-normal text-gray-400">.pdf report</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 flex-shrink-0"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Filters row ───────────────────────────────────────────────── */}
        {/* Flex-wrap layout with min-widths per field: on any desktop width
            wide enough for one row all six fit inline; on narrower widths the
            trailing fields wrap to the next line rather than overlapping. */}
        <div className="flex-shrink-0 border-b border-gray-100 px-5 pt-4 pb-3">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            {/* Search — first field in the row: a trainer looking for one learner
                types a name before reaching for any dropdown. */}
            <div className="relative flex-1 min-w-[220px] max-w-[280px]">
              <span
                className={`pointer-events-none absolute -top-[7px] left-2 z-10 bg-white px-1 text-[10px] font-semibold tracking-wide whitespace-nowrap transition-colors ${searchQuery ? "text-orange-600" : "text-gray-500"
                  }`}
              >
                Search Student
              </span>
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Name, email or register no."
                className="w-full h-9 pl-7 pr-2.5 rounded-md border border-gray-200 text-[12.5px] text-gray-800 placeholder:text-gray-400 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {/* Students */}
            <DropdownShell
              width={170}
              label="Students"
              current={studentsMode === "all" ? "All Students" : "Selected Students"}
              open={studentsOpen}
              onToggle={() => setStudentsOpen(o => !o)}
              onClose={() => setStudentsOpen(false)}
            >
              {[
                { value: "all" as StudentsMode, label: "All Students" },
                { value: "selected" as StudentsMode, label: "Selected Students" },
              ].map(o => {
                const active = studentsMode === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { setStudentsMode(o.value); setStudentsOpen(false); }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] ${active
                      ? "bg-orange-50 text-orange-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    <span>{o.label}</span>
                    {active && <Check size={13} className="text-orange-600" />}
                  </button>
                );
              })}
            </DropdownShell>

            {/* Scale — multi-select from actual grade bands */}
            <DropdownShell
              width={190}
              label="Scale"
              current={performanceScaleFilter.size === 0
                ? "All Scales"
                : performanceScaleFilter.size === 1
                  ? [...performanceScaleFilter][0]
                  : `${performanceScaleFilter.size} selected`}
              open={scaleOpen}
              onToggle={() => setScaleOpen(o => !o)}
              onClose={() => setScaleOpen(false)}
            >
              <button
                type="button"
                onClick={() => setPerformanceScaleFilter(new Set())}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] ${performanceScaleFilter.size === 0
                  ? "bg-orange-50 text-orange-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
                  }`}
              >
                <span>All Scales</span>
                {performanceScaleFilter.size === 0 && <Check size={13} className="text-orange-600" />}
              </button>
              <div className="mx-2 my-1 border-t border-gray-100" />
              {bands.map(b => {
                const active = performanceScaleFilter.has(b.label);
                return (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => {
                      setPerformanceScaleFilter(prev => {
                        const next = new Set(prev);
                        if (next.has(b.label)) next.delete(b.label); else next.add(b.label);
                        return next;
                      });
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] ${active
                      ? "bg-orange-50 text-orange-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border ${active
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-gray-300 bg-white"
                      }`}>
                      {active && <Check size={10} strokeWidth={3} />}
                    </span>
                    <span className="flex-1">{b.label}</span>
                    <span className="text-[10.5px] text-gray-400">{b.fromPercent}–{b.toPercent}%</span>
                  </button>
                );
              })}
            </DropdownShell>

            {/* Percentage Range */}
            <DropdownShell
              width={190}
              label="Percentage Range"
              current={PERCENT_LABEL[percentageRange]}
              open={percentOpen}
              onToggle={() => setPercentOpen(o => !o)}
              onClose={() => setPercentOpen(false)}
            >
              {(["all", "90plus", "80to89", "70to79", "60to69", "below60", "custom"] as PercentagePreset[]).map(o => {
                const active = percentageRange === o;
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => { setPercentageRange(o); if (o !== "custom") setPercentOpen(false); }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] ${active
                      ? "bg-orange-50 text-orange-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    <span>{PERCENT_LABEL[o]}</span>
                    {active && <Check size={13} className="text-orange-600" />}
                  </button>
                );
              })}
              {percentageRange === "custom" && (
                <div className="border-t border-gray-100 p-3 bg-gray-50/60">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block text-[10px] font-medium tracking-wide text-gray-500 mb-1">From %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="w-full h-8 rounded-md border border-gray-200 px-2 text-[12.5px] outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-medium tracking-wide text-gray-500 mb-1">To %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="w-full h-8 rounded-md border border-gray-200 px-2 text-[12.5px] outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      />
                    </div>
                  </div>
                  {customError && (
                    <div className="mt-2 text-[11px] text-rose-600">{customError}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => setPercentOpen(false)}
                    disabled={!!customError}
                    className={`mt-2 w-full h-8 rounded-md text-[12px] font-semibold transition-colors ${customError
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-orange-600 text-white hover:bg-orange-700"
                      }`}
                  >
                    Apply
                  </button>
                </div>
              )}
            </DropdownShell>

            {/* Test Status */}
            <DropdownShell
              width={170}
              label="Test Status"
              current={testStatusFilter === "all"
                ? "All"
                : STATUS_LABEL[testStatusFilter as Exclude<TestStatusValue, "all">]}
              open={statusOpen}
              onToggle={() => setStatusOpen(o => !o)}
              onClose={() => setStatusOpen(false)}
            >
              {(["all", ...availableStatuses] as TestStatusValue[]).map(o => {
                const active = testStatusFilter === o;
                const label = o === "all" ? "All" : STATUS_LABEL[o as Exclude<TestStatusValue, "all">];
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => { setTestStatusFilter(o); setStatusOpen(false); }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] ${active
                      ? "bg-orange-50 text-orange-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    <span>{label}</span>
                    {active && <Check size={13} className="text-orange-600" />}
                  </button>
                );
              })}
            </DropdownShell>

            {/* Detailed View — compact checkbox pill; own flex item so it
                never overlaps its neighbour. */}
            <label
              className={`flex h-9 flex-shrink-0 items-center gap-2 rounded-md border px-3 cursor-pointer whitespace-nowrap transition-colors ${detailedView
                ? "border-orange-300 bg-orange-50 text-orange-700"
                : "border-gray-200 bg-white text-gray-800 hover:border-gray-300"
                }`}
              title="Include per-question details for each learner in the preview and exports"
            >
              <input
                type="checkbox"
                checked={detailedView}
                onChange={(e) => setDetailedView(e.target.checked)}
                className="h-3.5 w-3.5 accent-orange-600"
              />
              <span className="text-[12.5px] font-medium">Detailed View</span>
            </label>
          </div>

          {/* Select-all + count + clear filters — compact strip. */}
          <div className="mt-2 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allVisibleTicked}
                ref={(el) => {
                  if (el) el.indeterminate = !allVisibleTicked && someVisibleTicked;
                }}
                onChange={(e) => selectAllVisible(e.target.checked)}
                className="h-3.5 w-3.5 accent-orange-600"
              />
              <span className="text-[12px] font-medium text-gray-700">Select All</span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-gray-500">
                <span className="font-semibold text-gray-800">{filteredStudents.length}</span> {filteredStudents.length === 1 ? "student" : "students"} found
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 text-[11.5px] font-medium text-gray-600 hover:bg-gray-50"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* ── Body — single scroll area that owns most of the modal height. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          <div className="border border-gray-200 rounded-md overflow-hidden">
            <table className="w-full text-[12.5px] border-separate border-spacing-0">
              <thead>
                <tr className="bg-gray-50">
                  <th className="w-9 border-b border-gray-200 px-2.5 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={allVisibleTicked}
                      ref={(el) => {
                        if (el) el.indeterminate = !allVisibleTicked && someVisibleTicked;
                      }}
                      onChange={(e) => selectAllVisible(e.target.checked)}
                      className="h-3.5 w-3.5 accent-orange-600"
                    />
                  </th>
                  <th className="w-10 border-b border-gray-200 px-2.5 py-1.5 text-center text-[11px] font-semibold text-gray-500">#</th>
                  <th className="border-b border-gray-200 px-2.5 py-1.5 text-left text-[11px] font-semibold text-gray-500 min-w-[220px]">Student</th>
                  <th className="border-b border-gray-200 px-2.5 py-1.5 text-left text-[11px] font-semibold text-gray-500">Reg. No.</th>
                  <th className="border-b border-gray-200 px-2.5 py-1.5 text-center text-[11px] font-semibold text-gray-500">Attempted</th>
                  <th className="border-b border-gray-200 px-2.5 py-1.5 text-right text-[11px] font-semibold text-gray-500">Marks</th>
                  <th className="border-b border-gray-200 px-2.5 py-1.5 text-left text-[11px] font-semibold text-gray-500">Scale</th>
                  {detailedView && (
                    <th className="w-9 border-b border-gray-200 px-2.5 py-1.5 text-center text-[11px] font-semibold text-gray-500">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={detailedView ? 8 : 7} className="px-3 py-10 text-center text-[13px] text-gray-400">
                      No learners match the current filters.
                    </td>
                  </tr>
                ) : filteredStudents.map((row, i) => {
                  const s = row.student;
                  const ticked = selectedStudentIds.has(s.id);
                  const expanded = expandedStudentIds.has(s.id);
                  const questionRows = questionRowsByStudent.get(s.id);
                  const shownQuestionRows = questionRows
                    ? questionRows.filter(q => !detailedView || exportQuestionIds.has(q.questionId))
                    : [];

                  return (
                    <React.Fragment key={s.id}>
                      <tr className={`h-11 hover:bg-orange-50/30 [&>td]:border-b [&>td]:border-gray-100 ${ticked ? "bg-orange-50/20" : ""}`}>
                        <td className="px-2.5 py-1 text-center">
                          <input
                            type="checkbox"
                            checked={ticked}
                            onChange={() => toggleStudent(s.id)}
                            className="h-3.5 w-3.5 accent-orange-600"
                          />
                        </td>
                        <td className="px-2.5 py-1 text-center text-[11.5px] font-medium text-gray-500 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="px-2.5 py-1">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-[10.5px] font-semibold text-orange-700">
                              {initialsOf(s.studentName)}
                            </div>
                            <div className="min-w-0">
                              <div className="max-w-[260px] truncate text-[12.5px] font-semibold text-gray-900 leading-tight">
                                {s.studentName || "—"}
                              </div>
                              {s.email && (
                                <div className="max-w-[260px] truncate text-[10.5px] text-gray-500 leading-tight">{s.email}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2.5 py-1 text-[12px] text-gray-700 tabular-nums whitespace-nowrap">
                          {s.studentDisplayId
                            ? s.studentDisplayId
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-2.5 py-1 text-center text-[12.5px] font-medium text-gray-800 tabular-nums">
                          {row.totalQuestions > 0
                            ? `${row.attempted} / ${row.totalQuestions}`
                            : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-2.5 py-1 text-right text-[12.5px] font-semibold text-gray-800 tabular-nums">
                          {row.scored == null ? "—" : `${row.scored} / ${row.totalMarks}`}
                        </td>
                        <td className="px-2.5 py-1">
                          {row.scaleLabel ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              {row.scaleLabel}
                            </span>
                          ) : (
                            <span className="text-[12px] text-gray-400">—</span>
                          )}
                        </td>
                        {detailedView && (
                          <td className="px-2.5 py-1 text-center">
                            <button
                              type="button"
                              onClick={() => toggleExpand(s.id)}
                              className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                              style={{ height: 26, width: 26 }}
                              aria-expanded={expanded}
                              aria-label={expanded ? "Collapse question details" : "Expand question details"}
                            >
                              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </td>
                        )}
                      </tr>
                      {detailedView && expanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={8} className="border-b border-gray-100 px-3 py-2">
                            <div className="mb-1.5 flex items-center justify-between">
                              <div className="text-[12px] font-semibold text-gray-800">
                                Question Details — {s.studentName}
                              </div>
                              <div className="text-[11px] text-gray-500">
                                {shownQuestionRows.length} of {questionRows?.length ?? 0} questions
                              </div>
                            </div>
                            {shownQuestionRows.length === 0 ? (
                              <div className="rounded-md border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-[11.5px] text-gray-400">
                                No questions match the current selection for this learner.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
                                <table className="min-w-full text-[11.5px]">
                                  <thead>
                                    <tr className="bg-gray-50 text-[10.5px] uppercase tracking-wider text-gray-500">
                                      <th className="border-b border-gray-200 px-2 py-1 text-center w-8">#</th>
                                      <th className="border-b border-gray-200 px-2 py-1 text-left">Question Title</th>
                                      <th className="border-b border-gray-200 px-2 py-1 text-left">Type</th>
                                      <th className="border-b border-gray-200 px-2 py-1 text-left">Submission</th>
                                      <th className="border-b border-gray-200 px-2 py-1 text-right">Marks</th>
                                      <th className="border-b border-gray-200 px-2 py-1 text-left">Test Cases</th>
                                      <th className="border-b border-gray-200 px-2 py-1 text-right">%</th>
                                      <th className="border-b border-gray-200 px-2 py-1 text-left">Evaluation</th>
                                      <th className="border-b border-gray-200 px-2 py-1 text-right">Time</th>
                                      <th className="border-b border-gray-200 px-2 py-1 text-left">Submitted At</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {shownQuestionRows.map(q => (
                                      <tr key={q.questionId} className="h-9 [&>td]:border-b [&>td]:border-gray-100 last:[&>td]:border-b-0">
                                        <td className="px-2 py-1 text-center text-gray-500 tabular-nums">{q.index}</td>
                                        <td className="px-2 py-1 font-medium text-gray-800">{q.title}</td>
                                        <td className="px-2 py-1 text-gray-600">{q.type}</td>
                                        <td className="px-2 py-1">
                                          <SubmissionBadge status={q.submissionStatus} label={q.submissionStatusLabel} />
                                        </td>
                                        <td className="px-2 py-1 text-right tabular-nums font-medium text-gray-800">
                                          {q.scoredMark == null ? "—" : `${q.scoredMark} / ${q.totalMark}`}
                                        </td>
                                        <td className="px-2 py-1 text-gray-700">{q.testCasesLabel}</td>
                                        <td className="px-2 py-1 text-right tabular-nums font-medium text-gray-800">
                                          {q.percentage == null ? "—" : `${q.percentage}%`}
                                        </td>
                                        <td className="px-2 py-1">
                                          <EvaluationBadge label={q.evaluationLabel} status={q.evaluationStatus} />
                                        </td>
                                        <td className="px-2 py-1 text-right text-gray-600 tabular-nums whitespace-nowrap">
                                          {fmtDuration(q.timeTakenSeconds)}
                                        </td>
                                        <td className="px-2 py-1 text-gray-600 whitespace-nowrap">
                                          {fmtDateTime(q.submittedAt)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Questions to include (Detailed View only) — compact chip picker. */}
          {detailedView && exerciseQuestions.length > 0 && (
            <div className="mt-3 rounded-md border border-gray-200 bg-white px-3 py-2.5">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="text-[12.5px] font-semibold text-gray-800">
                  Questions to Include
                  <span className="ml-2 text-[11px] font-normal text-gray-500">
                    {selectedQuestionIds.size} of {exerciseQuestions.length} selected
                  </span>
                </div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allQuestionsSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allQuestionsSelected && someQuestionsSelected;
                    }}
                    onChange={(e) => toggleAllQuestions(e.target.checked)}
                    className="h-3.5 w-3.5 accent-orange-600"
                  />
                  <span className="text-[11.5px] font-medium text-gray-700">Select All Questions</span>
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {exerciseQuestions.map((q) => {
                  const active = selectedQuestionIds.has(q.id);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => toggleQuestion(q.id)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${active
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                    >
                      <span className={`flex h-3 w-3 items-center justify-center rounded border ${active
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-gray-300 bg-white"
                        }`}>
                        {active && <Check size={9} strokeWidth={3} />}
                      </span>
                      <span className="tabular-nums text-gray-400">{q.index}.</span>
                      <span className="max-w-[200px] truncate">{q.title}</span>
                      <span className="text-[10px] text-gray-400">{q.type}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky footer — just the applied-filters summary. Export moved
            to the header Export split button; close is the header X. */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-5 py-2 flex items-center justify-start">
          <div className="text-[12px] text-gray-500 truncate">
            {summaryPieces.join("  ·  ")}
          </div>
        </div>
      </div>
    </div>
  );

  // Portal — modal stacks above every dashboard control regardless of the
  // toolbar/table z-index tree.
  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}

// ── Small presentational bits ─────────────────────────────────────────────
function SubmissionBadge({ status, label }: { status: string; label: string }) {
  const cls =
    status === "submitted" ? "bg-emerald-50 text-emerald-700"
    : status === "not_submitted" ? "bg-slate-100 text-slate-600"
    : "bg-amber-50 text-amber-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function EvaluationBadge({ status, label }: { status: string; label: string }) {
  const cls =
    status === "auto_evaluated" || status === "auto_evaluated_ai"
      ? "bg-sky-50 text-sky-700"
      : status === "manually_evaluated"
        ? "bg-emerald-50 text-emerald-700"
        : status === "needs_review"
          ? "bg-amber-50 text-amber-700"
          : "bg-slate-100 text-slate-500";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}
