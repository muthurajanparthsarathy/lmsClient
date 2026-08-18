"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Report Export Preview modal.
//
// Opens at 90% × 90% from the Reports view. Lets the user:
//   1. Toggle which columns appear (Student Summary + optional Question-by-
//      Question breakdown when in Detailed Report mode).
//   2. Switch between Summary Report (paginated table) and Detailed Report
//      (one student per card with their per-question breakdown).
//   3. Export the result as Print (browser print dialog), Excel (.xlsx via
//      `exceljs` + `file-saver`), or PDF (browser print → "Save as PDF").
//
// The PDF path piggybacks on `window.print()`. We don't ship a PDF library —
// the browser's print dialog has a built-in "Save as PDF" destination on every
// modern OS, and the print stylesheet we open in a new window is tuned for
// that flow. If you need a true generated PDF (no print dialog) later, drop
// in `jspdf` and replace the body of `exportPdf`.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, FileText, Printer, X } from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { StudentProgress } from "../types/liveDashboard.types";
import { deriveTestStatus } from "./StudentRow";
import {
  getStudentQuestionsBreakdown,
  getExerciseSectionInfo,
  type QuestionBreakdownRow,
  type ExerciseSection,
} from "../utils/computeStudentMarks";

// ─── Column definitions (single source of truth — used by checkboxes,
//     preview headers, the Excel writer, and the print HTML builder). ─────────

interface ColumnDef<T> {
  key: string;
  label: string;
  /** Renderer for the preview UI. */
  render: (row: T) => React.ReactNode;
  /** Plain value for export — Excel cell / print HTML / PDF. */
  value: (row: T) => string | number;
  /** Optional column width hint for Excel (chars). */
  excelWidth?: number;
}

// `StudentRow` with an index supplied by the parent for "S. No." cells.
interface StudentExportRow {
  index: number;
  student: StudentProgress;
}

// Status badge palette reused from ReportRow so the preview matches.
const STATUS_BADGE = {
  "not-started": { label: "Not Started", cls: "bg-gray-100  text-gray-600" },
  "started":     { label: "Started",     cls: "bg-amber-50  text-amber-700" },
  "submitted":   { label: "Submitted",   cls: "bg-green-50  text-green-700" },
} as const;

const QUESTION_STATUS_META = {
  evaluated:    { label: "Evaluated",    cls: "bg-emerald-50 text-emerald-700" },
  submitted:    { label: "Submitted",    cls: "bg-green-50   text-green-700" },
  not_answered: { label: "Not Answered", cls: "bg-rose-50    text-rose-600" },
  pending:      { label: "Pending",      cls: "bg-gray-100   text-gray-500" },
} as const;

const fmtTime = (secs: number): string => {
  if (!Number.isFinite(secs) || secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const fmtDate = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

// Student summary column registry. Order here is the order they appear.
// "S. No." was removed per design feedback — it's a derived row counter
// that adds noise to a table where Student Name + Email already identify
// the row. Removing it here also drops it from the modal column-picker,
// the preview table, the Detailed-mode inline summary strip, the Excel
// export, the PDF export, and the Print HTML — every consumer of
// `SUMMARY_COLUMNS` is automatically updated.
const SUMMARY_COLUMNS: ColumnDef<StudentExportRow>[] = [
  {
    key: "studentName", label: "Student Name", excelWidth: 24,
    render: r => <span className="font-medium text-gray-900">{r.student.studentName}</span>,
    value: r => r.student.studentName,
  },
  {
    key: "email", label: "Email", excelWidth: 28,
    render: r => <span className="text-gray-500">{r.student.email}</span>,
    value: r => r.student.email,
  },
  {
    key: "totalQuestions", label: "Total Questions", excelWidth: 16,
    render: r => <span className="text-gray-700">{r.student.totalQuestions ?? 0}</span>,
    value: r => r.student.totalQuestions ?? 0,
  },
  {
    key: "completed", label: "Completed", excelWidth: 12,
    render: r => <span className="font-semibold text-green-600">{r.student.completed ?? 0}</span>,
    value: r => r.student.completed ?? 0,
  },
  {
    key: "nonCompleted", label: "Non Completed", excelWidth: 14,
    render: r => {
      const total = r.student.totalQuestions ?? 0;
      const done = r.student.completed ?? 0;
      return <span className="font-semibold text-amber-600">{Math.max(0, total - done)}</span>;
    },
    value: r => Math.max(0, (r.student.totalQuestions ?? 0) - (r.student.completed ?? 0)),
  },
  {
    key: "testStatus", label: "Test Status", excelWidth: 14,
    render: r => {
      const meta = STATUS_BADGE[deriveTestStatus(r.student)];
      return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${meta.cls}`}>
          {meta.label}
        </span>
      );
    },
    value: r => STATUS_BADGE[deriveTestStatus(r.student)].label,
  },
  {
    key: "totalMarks", label: "Total Marks", excelWidth: 12,
    render: r => <span className="text-gray-700">{typeof r.student.totalMarks === "number" && r.student.totalMarks > 0 ? r.student.totalMarks : "—"}</span>,
    value: r => (typeof r.student.totalMarks === "number" && r.student.totalMarks > 0 ? r.student.totalMarks : ""),
  },
  {
    // Same rule as ReportRow: show the stored score whenever it exists,
    // independent of the live-session Test Status. A student who answered
    // earlier (auto-graded) and walked away still has real marks to report.
    key: "scoredMarks", label: "Scored Marks", excelWidth: 14,
    render: r => {
      const has = typeof r.student.scoredMarks === "number";
      return has
        ? <span className="font-semibold text-green-600">{r.student.scoredMarks}</span>
        : <span className="text-gray-400">—</span>;
    },
    value: r => {
      const has = typeof r.student.scoredMarks === "number";
      return has ? (r.student.scoredMarks as number) : "";
    },
  },
  {
    // Percentage = scoredMarks / totalMarks * 100, rounded to 1 dp. Shown
    // whenever we have both a positive max and a stored scored value.
    // Color brackets in the preview render: green ≥ 80, amber ≥ 50,
    // rose < 50, gray for "—". The exported `value` is a plain number so
    // Excel/CSV consumers can sort or chart on it.
    key: "percentage", label: "Percentage", excelWidth: 12,
    render: r => {
      const max = typeof r.student.totalMarks === "number" && r.student.totalMarks > 0 ? r.student.totalMarks : 0;
      const got = typeof r.student.scoredMarks === "number" ? r.student.scoredMarks : null;
      const canShow = max > 0 && got !== null;
      if (!canShow) return <span className="text-gray-400">—</span>;
      const pct = (got / max) * 100;
      const cls = pct >= 80 ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-rose-600";
      return <span className={`font-semibold ${cls}`}>{`${Math.round(pct * 10) / 10}%`}</span>;
    },
    value: r => {
      const max = typeof r.student.totalMarks === "number" && r.student.totalMarks > 0 ? r.student.totalMarks : 0;
      const got = typeof r.student.scoredMarks === "number" ? r.student.scoredMarks : null;
      const canShow = max > 0 && got !== null;
      if (!canShow) return "";
      // Round to 1 dp before stringifying so the exported value matches the
      // on-screen value exactly.
      return `${Math.round(((got / max) * 100) * 10) / 10}%`;
    },
  },
  {
    // Performance scale — the configured grade band for this student's
    // percentage (e.g. 50% → "Average"). Precomputed in the marks pipeline so
    // the export matches the on-screen report exactly.
    key: "scale", label: "Scale", excelWidth: 14,
    render: r => r.student.scaleLabel
      ? <span className="font-semibold text-indigo-700">{r.student.scaleLabel}</span>
      : <span className="text-gray-400">—</span>,
    value: r => r.student.scaleLabel || "",
  },
];

// Per-question column registry for the Detailed Report view.
const DETAIL_COLUMNS: ColumnDef<QuestionBreakdownRow>[] = [
  { key: "qno", label: "Q. No.", excelWidth: 8, render: q => <span className="text-gray-500">{q.questionNo}</span>, value: q => q.questionNo },
  { key: "title", label: "Title", excelWidth: 40, render: q => <span className="text-gray-800" title={q.title}>{q.title}</span>, value: q => q.title },
  { key: "type", label: "Type", excelWidth: 12, render: q => <span className="text-gray-600 uppercase tracking-wide text-[11.5px]">{q.type}</span>, value: q => q.type },
  {
    key: "status", label: "Status", excelWidth: 14,
    render: q => {
      const meta = QUESTION_STATUS_META[q.status];
      return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>;
    },
    value: q => QUESTION_STATUS_META[q.status].label,
  },
  { key: "totalMark", label: "Total Mark", excelWidth: 12, render: q => <span className="text-gray-700">{q.totalMark}</span>, value: q => q.totalMark },
  {
    key: "scoredMark", label: "Scored Mark", excelWidth: 12,
    render: q => {
      if (q.status === "pending" || q.status === "not_answered") return <span className="text-gray-400">—</span>;
      const cls = q.scoredMark === q.totalMark
        ? "text-green-600"
        : q.scoredMark === 0 ? "text-rose-600" : "text-amber-600";
      return <span className={`font-semibold ${cls}`}>{q.scoredMark}</span>;
    },
    value: q => (q.status === "pending" || q.status === "not_answered" ? "" : q.scoredMark),
  },
  { key: "submittedAt", label: "Submitted At", excelWidth: 22, render: q => <span className="text-gray-600 whitespace-nowrap">{fmtDate(q.submittedAt)}</span>, value: q => fmtDate(q.submittedAt) },
  { key: "timeTaken", label: "Time Taken", excelWidth: 14, render: q => <span className="text-gray-600 whitespace-nowrap">{fmtTime(q.timeTakenSeconds)}</span>, value: q => fmtTime(q.timeTakenSeconds) },
];

// ─── Modal props ────────────────────────────────────────────────────────────

interface ReportExportModalProps {
  open: boolean;
  onClose: () => void;
  students: StudentProgress[];
  assessmentName: string;
  // The same courses-data payload the parent already has cached. Passing it
  // down avoids a duplicate fetch — exceljs/print all just walk the same data.
  courseData: any | null;
  courseId: string;
  exerciseId: string;
  // ── Context labels for the meta header strip ──
  // Any subset can be empty; the strip skips missing values so the header
  // doesn't show "Module: " with nothing after it.
  courseName?: string;
  moduleName?: string;
  submoduleName?: string;
  topicName?: string;
  subtopicName?: string;
}

type ReportMode = "summary" | "detailed";

// Status filter aligns with the dashboard's own `TestStatus` values (plus an
// "all" pseudo-option). When set, the preview AND every export honour the
// filter — the user gets exactly what they previewed.
type ExportStatusFilter = "all" | "not-started" | "started" | "submitted";
const STATUS_FILTER_OPTIONS: { value: ExportStatusFilter; label: string }[] = [
  { value: "all",         label: "All Statuses"  },
  { value: "not-started", label: "Not Started"   },
  { value: "started",     label: "Started"       },
  { value: "submitted",   label: "Submitted"     },
];

const PAGE_SIZES = [10, 25, 50];

// Default file-name stem for downloaded artefacts. Sanitised so it doesn't
// produce weird Windows file names.
const sanitiseFilename = (s: string) =>
  s.replace(/[\/\\:*?"<>|]/g, "").trim().slice(0, 60) || "report";

export default function ReportExportModal({
  open, onClose, students, assessmentName, courseData, courseId, exerciseId,
  courseName, moduleName, submoduleName, topicName, subtopicName,
}: ReportExportModalProps) {
  // ── Selection state ──
  const [reportMode, setReportMode] = useState<ReportMode>("summary");
  const [selectedSummary, setSelectedSummary] = useState<Set<string>>(
    () => new Set(SUMMARY_COLUMNS.map(c => c.key))
  );
  const [selectedDetail, setSelectedDetail] = useState<Set<string>>(
    () => new Set(DETAIL_COLUMNS.map(c => c.key))
  );
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  // Status filter lives in the Report Options card, below the radios.
  // Applies to BOTH the preview AND the Print/Excel/PDF exporters — so what
  // the user sees is what they ship.
  const [statusFilter, setStatusFilter] = useState<ExportStatusFilter>("all");
  // Three extra filters mirroring the Reports view (search by name/email,
  // scale percentage range, and pass/fail). They feed into the same
  // `filteredRows` pipeline, so every export honours them the same way the
  // status filter does — what's previewed is what's exported.
  const [searchQuery, setSearchQuery] = useState("");
  const [scaleFromPct, setScaleFromPct] = useState("");
  const [scaleToPct, setScaleToPct] = useState("");
  const PASS_THRESHOLD = 50;
  const [passFailFilter, setPassFailFilter] = useState<"all" | "pass" | "fail">("all");

  // ── Section-based grouping ──
  // When the assessment is section-based (Part A / Part B …) the Detailed
  // Report can render each section as its OWN table instead of one flat
  // question-by-question table. The "Section Based" checkbox is only shown
  // when the test is section-based; default ON since that's the expected view
  // for those tests. Section info is resolved from the cached courseData.
  const sectionInfo = useMemo(
    () => getExerciseSectionInfo(courseData, exerciseId),
    [courseData, exerciseId],
  );
  const isSectionBased = sectionInfo.isSectionBased;
  const [groupBySection, setGroupBySection] = useState(true);
  // Effective flag: only meaningful in Detailed mode on a section-based test.
  const sectionMode = reportMode === "detailed" && isSectionBased && groupBySection;

  // Page layout for the Detailed PDF / Print exports:
  //   "one"    → each student on its own page (forced page break per student)
  //   "flow"   → no forced breaks; students flow naturally until they don't fit
  //   "custom" → custom N students per page, taken from `customStudentsPerPage`
  // Excel is unaffected (it uses logical sheets, not paged output) and the
  // modal preview is unaffected (it's a single scrollable area).
  type PageLayoutMode = "one" | "flow" | "custom";
  const [pageLayout, setPageLayout] = useState<PageLayoutMode>("flow");
  const [customStudentsPerPage, setCustomStudentsPerPage] = useState<number>(5);

  // Reset pagination whenever the mode, rows-per-page, or status filter
  // changes so the user doesn't get parked on a page index that no longer
  // exists after the filter shrinks the row set.
  useEffect(() => { setPage(1); }, [reportMode, rowsPerPage, statusFilter, searchQuery, scaleFromPct, scaleToPct, passFailFilter]);

  // Close on Escape (matches the standard modal contract).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // ── Derived lists ──
  const activeSummaryCols = useMemo(
    () => SUMMARY_COLUMNS.filter(c => selectedSummary.has(c.key)),
    [selectedSummary],
  );
  const activeDetailCols = useMemo(
    () => DETAIL_COLUMNS.filter(c => selectedDetail.has(c.key)),
    [selectedDetail],
  );

  // ── Meta header items ──
  // Course / Module / Topic / Test name / Total Marks — shown above the
  // preview as a pipe-separated strip, AND written at the top of every
  // exported file (Excel as a small table, PDF / Print as a sub-line below
  // the title). Items with empty values are filtered out so the strip
  // doesn't render dangling labels for hierarchy levels that don't apply
  // (e.g. an assessment that lives directly on a module has no topic).
  //
  // `totalMarks` for the test is the same value for every student, so we
  // pull it from the first student that has one. Falls back to "—" if no
  // student row has been hydrated with marks yet (rare, but possible if the
  // modal is opened the instant the dashboard mounts).
  const testTotalMarks = useMemo(() => {
    const s = students.find(x => typeof x.totalMarks === "number" && x.totalMarks > 0);
    return s?.totalMarks ?? 0;
  }, [students]);

  const metaItems: { label: string; value: string }[] = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    if (courseName)     items.push({ label: "Course",     value: courseName });
    if (moduleName)     items.push({ label: "Module",     value: moduleName });
    if (submoduleName)  items.push({ label: "Sub-module", value: submoduleName });
    if (topicName)      items.push({ label: "Topic",      value: topicName });
    if (subtopicName)   items.push({ label: "Subtopic",   value: subtopicName });
    if (assessmentName) items.push({ label: "Test",       value: assessmentName });
    items.push({ label: "Total Marks", value: testTotalMarks > 0 ? String(testTotalMarks) : "—" });
    return items;
  }, [courseName, moduleName, submoduleName, topicName, subtopicName, assessmentName, testTotalMarks]);

  // Students wrapped with their index for "S. No." rendering. The index is
  // assigned BEFORE filtering so the serial number reflects the student's
  // position in the original roster (otherwise filtered exports would
  // renumber, which makes them harder to cross-reference with the live
  // dashboard).
  const indexedRows: StudentExportRow[] = useMemo(
    () => students.map((s, i) => ({ index: i, student: s })),
    [students],
  );

  // ── Filtered list. Every downstream consumer (preview pagination, the
  // detailed-mode breakdown computation, AND each exporter) reads from
  // `filteredRows` so the preview and the exports never disagree. ──
  const filteredRows = useMemo(() => {
    let rows = indexedRows;

    if (statusFilter !== "all") {
      rows = rows.filter(r => deriveTestStatus(r.student) === statusFilter);
    }

    // Name / email search — case-insensitive substring on either field.
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(r =>
        (r.student.name || "").toLowerCase().includes(q) ||
        (r.student.email || "").toLowerCase().includes(q)
      );
    }

    // Scale percentage range — both bounds optional. Ungraded rows
    // (no scoredMarks) drop out the moment any bound is set so an
    // unattempted student isn't surfaced as a "scale match".
    const fromNum = scaleFromPct.trim() === "" ? null : Number(scaleFromPct);
    const toNum = scaleToPct.trim() === "" ? null : Number(scaleToPct);
    const fromActive = fromNum != null && Number.isFinite(fromNum);
    const toActive = toNum != null && Number.isFinite(toNum);
    if (fromActive || toActive) {
      rows = rows.filter(r => {
        const s = r.student;
        if (typeof s.scoredMarks !== "number" || !s.totalMarks) return false;
        const pct = (s.scoredMarks / s.totalMarks) * 100;
        if (fromActive && pct < (fromNum as number)) return false;
        if (toActive && pct > (toNum as number)) return false;
        return true;
      });
    }

    // Pass / Fail — 50% threshold. Ungraded students excluded from both.
    if (passFailFilter !== "all") {
      rows = rows.filter(r => {
        const s = r.student;
        if (typeof s.scoredMarks !== "number" || !s.totalMarks) return false;
        const pct = (s.scoredMarks / s.totalMarks) * 100;
        return passFailFilter === "pass" ? pct >= PASS_THRESHOLD : pct < PASS_THRESHOLD;
      });
    }

    return rows;
  }, [indexedRows, statusFilter, searchQuery, scaleFromPct, scaleToPct, passFailFilter]);

  // Pagination math — same shape as the dashboard table.
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageRows = useMemo(
    () => filteredRows.slice(startIdx, startIdx + rowsPerPage),
    [filteredRows, startIdx, rowsPerPage],
  );

  // Per-student breakdown is needed only for Detailed mode, and only for the
  // students visible on the current page. Memoize so re-renders within the
  // same page don't recompute.
  const visibleBreakdowns = useMemo(() => {
    if (reportMode !== "detailed") return new Map<string, QuestionBreakdownRow[]>();
    if (!courseData || !exerciseId) return new Map();
    const out = new Map<string, QuestionBreakdownRow[]>();
    const participants: any[] = (courseData.batchAndParticipants || []).flatMap((b: any) => b?.users || []);
    for (const row of pageRows) {
      const participant = participants.find(p => p?.user?._id === row.student.id || p?._id === row.student.id);
      if (!participant) { out.set(row.student.id, []); continue; }
      const breakdown = getStudentQuestionsBreakdown({
        courseData,
        courseId,
        exerciseId,
        participant,
        studentSubmitted: !!row.student.submitted,
      });
      out.set(row.student.id, breakdown);
    }
    return out;
  }, [reportMode, pageRows, courseData, courseId, exerciseId]);

  // Same breakdowns for ALL students — needed by the exporters (the export
  // writes every row regardless of pagination, but ONLY the ones that pass
  // the status filter). Lazy: only computed when an export action runs, not
  // on every render.
  const buildAllBreakdowns = (): Map<string, QuestionBreakdownRow[]> => {
    const out = new Map<string, QuestionBreakdownRow[]>();
    if (!courseData || !exerciseId) return out;
    const participants: any[] = (courseData.batchAndParticipants || []).flatMap((b: any) => b?.users || []);
    for (const row of filteredRows) {
      const participant = participants.find(p => p?.user?._id === row.student.id || p?._id === row.student.id);
      if (!participant) { out.set(row.student.id, []); continue; }
      out.set(row.student.id, getStudentQuestionsBreakdown({
        courseData,
        courseId,
        exerciseId,
        participant,
        studentSubmitted: !!row.student.submitted,
      }));
    }
    return out;
  };

  // Split a student's flat breakdown into ordered section groups (Part A,
  // Part B …). Sections follow the exercise's declared order; any questions
  // whose section can't be resolved fall into a trailing "Other" bucket so
  // nothing is silently dropped. Empty sections are omitted.
  const groupBreakdownBySection = (
    rows: QuestionBreakdownRow[],
  ): { name: string; rows: QuestionBreakdownRow[] }[] => {
    const order = sectionInfo.sections.map((s: ExerciseSection) => s.name).filter(Boolean);
    const byName = new Map<string, QuestionBreakdownRow[]>();
    for (const r of rows) {
      const nm = r.sectionName || "Other";
      if (!byName.has(nm)) byName.set(nm, []);
      byName.get(nm)!.push(r);
    }
    const out: { name: string; rows: QuestionBreakdownRow[] }[] = [];
    for (const nm of order) {
      if (byName.has(nm)) { out.push({ name: nm, rows: byName.get(nm)! }); byName.delete(nm); }
    }
    for (const [nm, rs] of byName) out.push({ name: nm, rows: rs }); // leftovers (incl. "Other")
    return out;
  };

  // Preview renderer for one question table (shared by the flat and the
  // per-section detailed views so they stay visually identical).
  const renderPreviewDetailTable = (rows: QuestionBreakdownRow[]) => (
    <div className="overflow-auto lmsd-scroll border border-gray-200 rounded-md">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-indigo-50/60 border-b border-gray-200">
            {activeDetailCols.map(c => (
              <th key={c.key} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap border-r last:border-r-0 border-gray-200">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(q => (
            <tr key={q.questionId} className="border-b border-gray-50 last:border-b-0">
              {activeDetailCols.map(c => (
                <td key={c.key} className="px-3 py-2 whitespace-nowrap border-r last:border-r-0 border-gray-100">{c.render(q)}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={Math.max(1, activeDetailCols.length)} className="px-3 py-6 text-center text-gray-400 text-[12px]">
                No questions recorded.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // ── Column toggle handlers ──
  const toggleColumn = (which: "summary" | "detail", key: string) => {
    if (which === "summary") {
      setSelectedSummary(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        // Don't allow an empty column set — fall back to all selected so the
        // preview never goes to zero columns.
        return next.size === 0 ? new Set(SUMMARY_COLUMNS.map(c => c.key)) : next;
      });
    } else {
      setSelectedDetail(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next.size === 0 ? new Set(DETAIL_COLUMNS.map(c => c.key)) : next;
      });
    }
  };

  // ─── EXPORTERS ──────────────────────────────────────────────────────────────

  // ─── Print: render the report into a hidden iframe and call its
  // `contentWindow.print()`. Iframes don't get blocked the way popup
  // windows do (no `window.open`), which fixes the "nothing happens" case
  // the user reported. The iframe is removed after the dialog dismisses.
  // ─────────────────────────────────────────────────────────────────────
  const buildPrintableHtml = (title: string) => {
    const escape = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const allBreakdowns = reportMode === "detailed" ? buildAllBreakdowns() : null;

    const summaryHeader = `<tr>${activeSummaryCols.map(c => `<th>${escape(c.label)}</th>`).join("")}</tr>`;
    // All export paths read from `filteredRows` (post-status-filter) so the
    // file matches the preview.
    const summaryRowsHtml = filteredRows.map(r =>
      `<tr>${activeSummaryCols.map(c => `<td>${escape(c.value(r))}</td>`).join("")}</tr>`
    ).join("");

    // ── Meta header strip (Course / Module / Topic / Test / Total Marks) ──
    // Rendered as a tight two-row table at the top of the print output.
    const metaHtml = metaItems.length === 0 ? "" : `
      <table class="meta-table">
        <thead><tr>${metaItems.map(m => `<th>${escape(m.label)}</th>`).join("")}</tr></thead>
        <tbody><tr>${metaItems.map(m => `<td>${escape(m.value)}</td>`).join("")}</tr></tbody>
      </table>`;

    let body = "";
    if (reportMode === "summary") {
      body = `
        ${metaHtml}
        <h2>Student Summary (Overall)</h2>
        <table class="report-table">
          <thead>${summaryHeader}</thead>
          <tbody>${summaryRowsHtml}</tbody>
        </table>`;
    } else {
      // Page layout policy for Print mirrors the PDF: "one" puts each student
      // on its own page via `page-break-after: always` on every card, and
      // "custom N" puts it on every Nth card. "flow" leaves the cards alone
      // so the browser breaks naturally.
      const studentsPerForcedPagePrint = pageLayout === "one"
        ? 1
        : pageLayout === "custom"
          ? Math.max(1, customStudentsPerPage)
          : Infinity;

      // Prefix the detailed body with the same meta strip the summary mode uses.
      body = metaHtml + filteredRows.map((r, i) => {
        const fields = activeSummaryCols.map(c =>
          `<div class="kv"><span class="k">${escape(c.label)}</span><span class="v">${escape(c.value(r))}</span></div>`
        ).join("");
        // Force a break AFTER this card when it's the Nth in the current
        // run (and it isn't the last card overall — no point breaking after
        // the document ends).
        const isLast = i === filteredRows.length - 1;
        const forceBreak =
          !isLast &&
          studentsPerForcedPagePrint !== Infinity &&
          ((i + 1) % studentsPerForcedPagePrint === 0);
        const extraStyle = forceBreak ? ' style="page-break-after: always;"' : "";
        const breakdown = allBreakdowns!.get(r.student.id) ?? [];
        const detailHeader = `<tr>${activeDetailCols.map(c => `<th>${escape(c.label)}</th>`).join("")}</tr>`;
        // Render one detail table from a set of rows.
        const detailTableHtml = (rows: QuestionBreakdownRow[]) => `
          <table class="report-table">
            <thead>${detailHeader}</thead>
            <tbody>${rows.map(q => `<tr>${activeDetailCols.map(c => `<td>${escape(c.value(q))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${activeDetailCols.length}">No questions recorded.</td></tr>`}</tbody>
          </table>`;
        // Section-based → one labelled table per section; otherwise one flat table.
        const detailHtml = !activeDetailCols.length ? "" : (
          sectionMode
            ? (groupBreakdownBySection(breakdown).map(g => `<h4>${escape(g.name)}</h4>${detailTableHtml(g.rows)}`).join("")
               || `<h4>Question-by-Question Details</h4>${detailTableHtml([])}`)
            : `<h4>Question-by-Question Details</h4>${detailTableHtml(breakdown)}`
        );
        return `
          <section class="student-card"${extraStyle}>
            <h3>Student #${r.index + 1}</h3>
            <div class="kv-grid">${fields}</div>
            ${detailHtml}
          </section>`;
      }).join("");
    }

    return `
<!doctype html><html><head>
<meta charset="utf-8" />
<title>${escape(title)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Poppins, sans-serif; color: #111; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 14px; color: #4f46e5; margin: 20px 0 8px; }
  h3 { font-size: 13px; margin: 24px 0 6px; }
  h4 { font-size: 12px; color: #4f46e5; margin: 14px 0 6px; }
  .sub { font-size: 11px; color: #666; margin-bottom: 16px; }
  .report-table { width: 100%; border-collapse: collapse; font-size: 11px; }
  .report-table th, .report-table td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  .report-table th { background: #f9fafb; font-weight: 600; }
  /* Meta header strip — Course / Module / Topic / Test / Total Marks shown
     as a two-row table at the very top of every printed report. Indigo band
     so it visually anchors the page. */
  .meta-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0 14px; }
  .meta-table th, .meta-table td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  .meta-table th { background: #4f46e5; color: #fff; font-weight: 600; }
  .meta-table td { background: #eef2ff; font-weight: 600; color: #111; }
  .student-card { page-break-inside: avoid; margin: 18px 0 22px; }
  .kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 6px 0 10px; font-size: 11px; }
  .kv { display: flex; gap: 8px; }
  .kv .k { color: #555; min-width: 130px; }
  .kv .v { color: #111; font-weight: 600; }
  @media print { body { padding: 12px; } }
</style></head><body>
<h1>${escape(assessmentName || "Assessment")}</h1>
<div class="sub">${escape(title)} · Generated ${new Date().toLocaleString("en-GB")}</div>
${body}
</body></html>`;
  };

  const exportPrint = () => {
    // Build a hidden iframe, write the printable HTML into it, then call
    // print on the iframe itself. This sidesteps popup blockers (the
    // previous `window.open` approach was getting blocked silently in some
    // setups) and the print dialog opens reliably.
    const title = reportMode === "summary" ? "Summary Report" : "Detailed Report";
    const html = buildPrintableHtml(title);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const cleanup = () => {
      // Defer removal slightly so the print dialog has finished initializing
      // — Safari occasionally cancels printing if the iframe is yanked
      // mid-dialog.
      setTimeout(() => { iframe.remove(); }, 1000);
    };

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { iframe.remove(); alert("Couldn't open print preview."); return; }
    doc.open();
    doc.write(html);
    doc.close();

    // Wait one tick to ensure layout is ready, then print.
    const win = iframe.contentWindow;
    if (!win) { iframe.remove(); return; }
    // `onafterprint` is the cleanest cleanup signal but isn't fired by every
    // browser; the `setTimeout` in `cleanup()` is the safety net.
    win.onafterprint = cleanup;
    setTimeout(() => {
      try { win.focus(); win.print(); }
      catch (e) { console.error("print failed", e); }
      // Belt-and-braces: schedule cleanup in case onafterprint never fires.
      setTimeout(cleanup, 30000);
    }, 200);
  };

  // ─── PDF: generate a real .pdf file with jsPDF + autoTable, then trigger
  // a browser download. No print dialog. No popup blocker concerns.
  // Output styling intentionally mirrors the on-screen preview so the file
  // looks like what the user sees in the modal.
  // ─────────────────────────────────────────────────────────────────────
  const exportPdf = () => {
    const orientation = activeSummaryCols.length > 6 ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 32;

    // ── Title block ──
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(17, 17, 17);
    doc.text(assessmentName || "Assessment", margin, margin + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `${reportMode === "summary" ? "Summary Report" : "Detailed Report"} · Generated ${new Date().toLocaleString("en-GB")}`,
      margin,
      margin + 26,
    );

    // ── Meta header strip (Course / Module / Topic / Test / Total Marks) ──
    // Rendered as a two-row autoTable so it inherits clean borders + colors.
    // The cursor for the next block advances based on this table's finalY.
    let nextY = margin + 40;
    if (metaItems.length > 0) {
      autoTable(doc, {
        startY: nextY,
        margin: { left: margin, right: margin },
        head: [metaItems.map(m => m.label)],
        body: [metaItems.map(m => m.value)],
        styles: { fontSize: 8.5, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
        bodyStyles: { fillColor: [238, 242, 255], fontStyle: "bold", textColor: [17, 17, 17] },
        theme: "grid",
      });
      nextY = (doc as any).lastAutoTable.finalY + 14;
    }

    if (reportMode === "summary") {
      // ── Single summary table ──
      autoTable(doc, {
        startY: nextY,
        margin: { left: margin, right: margin },
        head: [activeSummaryCols.map(c => c.label)],
        body: filteredRows.map(r => activeSummaryCols.map(c => String(c.value(r) ?? ""))),
        styles: { fontSize: 9, cellPadding: 6, lineColor: [229, 231, 235], lineWidth: 0.5 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        theme: "grid",
      });
    } else {
      // ── One section per student ──
      const all = buildAllBreakdowns();
      // Start from `nextY` so the meta strip (drawn above) is honoured.
      let cursorY = nextY;

      const ensureSpace = (needed: number) => {
        if (cursorY + needed > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }
      };

      // ── Page layout policy ──
      // `pageLayout` controls how forced page breaks happen between students.
      // Resolved once per export so the math (custom N) stays consistent
      // even if the user clicks again mid-render (they can't, but it's a
      // clean separation regardless).
      const studentsPerForcedPage = pageLayout === "one"
        ? 1
        : pageLayout === "custom"
          ? Math.max(1, customStudentsPerPage)
          : Infinity; // "flow" → never force

      let renderedSinceBreak = 0;
      for (const r of filteredRows) {
        // Force a page break BEFORE the next student if the policy says so.
        // Skip the very first student — that page is already open.
        if (renderedSinceBreak >= studentsPerForcedPage) {
          doc.addPage();
          cursorY = margin;
          renderedSinceBreak = 0;
        }
        ensureSpace(40);
        // Student heading.
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(17, 17, 17);
        doc.text(`Student #${r.index + 1} — ${r.student.studentName || ""}`, margin, cursorY + 12);
        cursorY += 20;

        // Summary as a single inline text strip — matches the on-screen UI
        // (`Label: Value | Label: Value | …`). The previous 2-column key/
        // value table version produced a tall, narrow block that wasted a lot
        // of page space; this version reads as one wrapping paragraph and
        // gives the question table below more room.
        const summaryParts = activeSummaryCols.map(c => `${c.label}: ${String(c.value(r) ?? "—")}`);
        const summaryLine = summaryParts.join("   |   "); // wider gap around the pipe so it doesn't blur into adjacent text
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        const maxWidth = pageWidth - 2 * margin;
        // `splitTextToSize` returns the lines after wrapping at the page width.
        const lines = doc.splitTextToSize(summaryLine, maxWidth) as string[];
        const lineHeight = 12;
        // Page-break if the wrapped text won't fit on the current page.
        ensureSpace(lineHeight * lines.length + 6);
        // `doc.text` accepts an array → one line per element. The y here is
        // the baseline of the FIRST line; subsequent lines advance by
        // `lineHeight` automatically.
        doc.text(lines, margin, cursorY + lineHeight - 3);
        cursorY += lineHeight * lines.length + 8;

        // Per-question table(s). One labelled table per section when in
        // section mode, otherwise a single flat table.
        if (activeDetailCols.length > 0) {
          const breakdown = all.get(r.student.id) ?? [];

          const drawDetailTable = (label: string, rows: QuestionBreakdownRow[]) => {
            ensureSpace(80);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(79, 70, 229);
            doc.text(label, margin, cursorY);
            cursorY += 8;
            autoTable(doc, {
              startY: cursorY + 4,
              margin: { left: margin, right: margin },
              head: [activeDetailCols.map(c => c.label)],
              body: rows.length > 0
                ? rows.map(q => activeDetailCols.map(c => String(c.value(q) ?? "")))
                : [["No questions recorded for this student.", ...Array(activeDetailCols.length - 1).fill("")]],
              styles: { fontSize: 8, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5 },
              headStyles: { fillColor: [238, 242, 255], textColor: [55, 65, 81], fontStyle: "bold" },
              alternateRowStyles: { fillColor: [249, 250, 251] },
              theme: "grid",
            });
            cursorY = (doc as any).lastAutoTable.finalY + 22;
          };

          if (sectionMode) {
            const groups = groupBreakdownBySection(breakdown);
            if (groups.length === 0) drawDetailTable("Question-by-Question Details", []);
            else groups.forEach(g => drawDetailTable(g.name, g.rows));
          } else {
            drawDetailTable("Question-by-Question Details", breakdown);
          }
        }
        renderedSinceBreak += 1;
      }
    }

    // Page numbers in the footer (every page, after the entire body has
    // been laid out so `getNumberOfPages` is accurate).
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: "right" });
    }

    doc.save(`${sanitiseFilename(assessmentName || "report")}-${reportMode}.pdf`);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Live Dashboard";
    workbook.created = new Date();

    // ── Palette ── one set of ARGB colours reused everywhere so the file
    // reads as visually coordinated, not just "Excel with borders". ARGB
    // is the format exceljs wants (alpha first, then RGB hex).
    const PALETTE = {
      indigoFill:  "FF4F46E5",  // strong indigo — summary header band
      indigoSoft:  "FFEEF2FF",  // light indigo — summary data row tint
      lavender:    "FFE9E3FB",  // section label background
      lavender2:   "FFC4B5FD",  // strong banner for "Student #N"
      questionHdr: "FFEEF7FF",  // question table header band
      altRow:      "FFF9FAFB",  // alternating question row
      border:      "FFE5E7EB",  // thin grey border
      grey:        "FF6B7280",  // muted label text
      white:       "FFFFFFFF",
      black:       "FF111111",
    };
    const THIN_BORDER = {
      top:    { style: "thin" as const, color: { argb: PALETTE.border } },
      left:   { style: "thin" as const, color: { argb: PALETTE.border } },
      right:  { style: "thin" as const, color: { argb: PALETTE.border } },
      bottom: { style: "thin" as const, color: { argb: PALETTE.border } },
    };

    // Helpers to apply common styling without repeating the same object literal.
    const applyFill = (cell: ExcelJS.Cell, argb: string) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    };
    const applyBorder = (cell: ExcelJS.Cell) => { cell.border = THIN_BORDER; };

    // ── Meta-header writer ──
    // Both modes need the same Course / Module / Topic / Test / Total Marks
    // strip at the top. Implemented as a two-row table: one row of labels,
    // one row of values, spanning the same column count as the data table
    // below so columns align visually. Centralised here so a change to the
    // styling (or the field list) only happens in one place.
    const writeMetaHeader = (sheet: ExcelJS.Worksheet, colSpan: number) => {
      if (metaItems.length === 0) return;
      // Label row.
      const labelRow = sheet.addRow(metaItems.map(m => m.label));
      labelRow.eachCell((cell, colNum) => {
        if (colNum > metaItems.length) return;
        cell.font = { bold: true, color: { argb: PALETTE.white } };
        applyFill(cell, PALETTE.indigoFill);
        applyBorder(cell);
        cell.alignment = { vertical: "middle", horizontal: "left" };
      });
      // Value row.
      const valueRow = sheet.addRow(metaItems.map(m => m.value));
      valueRow.eachCell((cell, colNum) => {
        if (colNum > metaItems.length) return;
        cell.font = { bold: true, color: { argb: PALETTE.black } };
        applyFill(cell, PALETTE.indigoSoft);
        applyBorder(cell);
      });
      sheet.addRow([]); // spacer below the meta strip
      void colSpan; // reserved for a future "merge to colSpan" pass
    };

    if (reportMode === "summary") {
      // ─── SUMMARY MODE — single sheet, single filterable table ──────────────
      const sheet = workbook.addWorksheet("Student Summary");
      writeMetaHeader(sheet, activeSummaryCols.length);
      const lbl = sheet.addRow(["Student Summary (Overall)"]);
      sheet.mergeCells(lbl.number, 1, lbl.number, activeSummaryCols.length);
      const lblCell = lbl.getCell(1);
      lblCell.font = { bold: true, color: { argb: PALETTE.indigoFill }, size: 12 };
      applyFill(lblCell, PALETTE.lavender);
      lbl.height = 20;
      sheet.addRow([]);
      const hdr = sheet.addRow(activeSummaryCols.map(c => c.label));
      activeSummaryCols.forEach((c, i) => {
        const col = sheet.getColumn(i + 1);
        col.width = Math.max(col.width || 0, c.excelWidth ?? 16);
      });
      hdr.height = 22;
      activeSummaryCols.forEach((_, i) => {
        const cell = hdr.getCell(i + 1);
        cell.font = { bold: true, color: { argb: PALETTE.white } };
        applyFill(cell, PALETTE.indigoFill);
        applyBorder(cell);
        cell.alignment = { vertical: "middle", horizontal: "left" };
      });
      filteredRows.forEach((r, idx) => {
        const added = sheet.addRow(activeSummaryCols.map(c => c.value(r)));
        added.eachCell((cell, colNum) => {
          if (colNum > activeSummaryCols.length) return;
          applyBorder(cell);
          if (idx % 2 === 1) applyFill(cell, PALETTE.altRow);
        });
      });
      // AutoFilter dropdowns on every summary header + frozen header row.
      const lastSummaryDataRow = sheet.lastRow?.number ?? hdr.number;
      sheet.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: lastSummaryDataRow, column: activeSummaryCols.length } };
      sheet.views = [{ state: "frozen", ySplit: hdr.number }];
    } else {
      // ─── DETAILED MODE — single sheet, per-student block layout ────────────
      // Mirrors the modal preview: for each student we write their detail
      // (summary header + single data row) then the question table(s) stacked
      // directly below — split into Part A / Part B … tables when the test is
      // section-based, otherwise one Question-by-Question table. A single blank
      // row separates students. Everything stays on ONE sheet (no per-section
      // tabs).
      const sheet = workbook.addWorksheet("Detailed Report");
      const all = buildAllBreakdowns();
      const span = Math.max(activeSummaryCols.length, activeDetailCols.length);

      for (let i = 0; i < span; i++) {
        const sum = activeSummaryCols[i]?.excelWidth ?? 0;
        const det = activeDetailCols[i]?.excelWidth ?? 0;
        sheet.getColumn(i + 1).width = Math.max(sum, det, 12);
      }

      writeMetaHeader(sheet, span);

      const title = sheet.addRow([`Detailed Report — ${assessmentName || "Assessment"}`]);
      sheet.mergeCells(title.number, 1, title.number, span);
      const tCell = title.getCell(1);
      tCell.font = { bold: true, size: 14, color: { argb: PALETTE.indigoFill } };
      title.height = 24;

      const sub = sheet.addRow([`Generated ${new Date().toLocaleString("en-GB")}`]);
      sheet.mergeCells(sub.number, 1, sub.number, span);
      sub.getCell(1).font = { italic: true, size: 9, color: { argb: PALETTE.grey } };
      sheet.addRow([]); // spacer

      // Writes one question table (section/label band + column header + rows)
      // for a set of breakdown rows. Shared by the section + non-section paths.
      const writeQuestionTable = (label: string, rows: QuestionBreakdownRow[]) => {
        const sectionLbl = sheet.addRow([label]);
        sheet.mergeCells(sectionLbl.number, 1, sectionLbl.number, span);
        const lCell = sectionLbl.getCell(1);
        lCell.font = { bold: true, color: { argb: PALETTE.indigoFill }, size: 11 };
        applyFill(lCell, PALETTE.lavender);
        sectionLbl.height = 20;

        const qHdr = sheet.addRow(activeDetailCols.map(c => c.label));
        qHdr.eachCell((cell, colNum) => {
          if (colNum > activeDetailCols.length) return;
          cell.font = { bold: true, color: { argb: PALETTE.black } };
          applyFill(cell, PALETTE.questionHdr);
          applyBorder(cell);
          cell.alignment = { vertical: "middle", horizontal: "left" };
        });

        if (rows.length === 0) {
          const empty = sheet.addRow(["No questions recorded for this student."]);
          sheet.mergeCells(empty.number, 1, empty.number, activeDetailCols.length);
          const eCell = empty.getCell(1);
          eCell.font = { italic: true, color: { argb: PALETTE.grey } };
          applyBorder(eCell);
        } else {
          rows.forEach((q, qIdx) => {
            const qRow = sheet.addRow(activeDetailCols.map(c => c.value(q)));
            qRow.eachCell((cell, colNum) => {
              if (colNum > activeDetailCols.length) return;
              applyBorder(cell);
              if (qIdx % 2 === 1) applyFill(cell, PALETTE.altRow);
            });
          });
        }
      };

      for (const r of filteredRows) {
        // ── Student banner ──
        const banner = sheet.addRow([`Student #${r.index + 1} — ${r.student.studentName || ""}`]);
        sheet.mergeCells(banner.number, 1, banner.number, span);
        const bCell = banner.getCell(1);
        bCell.font = { bold: true, color: { argb: PALETTE.white }, size: 12 };
        applyFill(bCell, PALETTE.lavender2);
        bCell.alignment = { vertical: "middle", horizontal: "left" };
        banner.height = 22;

        sheet.addRow([]); // spacer between banner and the student-detail row

        // ── Student detail (summary header + single data row) ──
        const sumHdr = sheet.addRow(activeSummaryCols.map(c => c.label));
        sumHdr.eachCell((cell, colNum) => {
          if (colNum > activeSummaryCols.length) return;
          cell.font = { bold: true, color: { argb: PALETTE.white } };
          applyFill(cell, PALETTE.indigoFill);
          applyBorder(cell);
          cell.alignment = { vertical: "middle", horizontal: "left" };
        });
        const sumRow = sheet.addRow(activeSummaryCols.map(c => c.value(r)));
        sumRow.eachCell((cell, colNum) => {
          if (colNum > activeSummaryCols.length) return;
          cell.font = { bold: true, color: { argb: PALETTE.black } };
          applyFill(cell, PALETTE.indigoSoft);
          applyBorder(cell);
        });

        // ── Question table(s): Part A / Part B … or single Q-by-Q ──
        if (activeDetailCols.length > 0) {
          const breakdown = all.get(r.student.id) ?? [];
          if (sectionMode) {
            const groups = groupBreakdownBySection(breakdown);
            if (groups.length === 0) writeQuestionTable("Question-by-Question Details", []);
            else groups.forEach(g => writeQuestionTable(g.name, g.rows));
          } else {
            writeQuestionTable("Question-by-Question Details", breakdown);
          }
        }

        sheet.addRow([]); // one blank row between students
      }
    }

    const buf = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${sanitiseFilename(assessmentName || "report")}-${reportMode}.xlsx`);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (!open) return null;

  // Rendered via portal so the modal's stacking + sizing aren't affected by
  // any of the dashboard's flex containers.
  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Report Export Preview"
      className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{ width: "90vw", height: "90vh" }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-[15px] font-bold text-gray-900">Report Export Preview</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-md bg-red-500 hover:bg-red-600 text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-auto p-4 lmsd-scroll">
          {/* Top control row: column picker | report options | export buttons */}
          <div className="grid grid-cols-12 gap-3 mb-4">
            {/* Columns — narrowed to col-span-6 (from 7) to make room for the
                widened Report Options card that now houses the status filter
                in addition to the mode radios. 6 + 3 + 3 = 12. */}
            <div className="col-span-12 lg:col-span-6 border border-gray-200 rounded-lg p-3 bg-white">
              <div className="text-[13px] font-semibold text-gray-900 mb-2.5">Select Columns to Include</div>

              {/* Student Summary checkboxes — laid out in a responsive grid
                  (2 / 3 / 4 columns) so labels of different lengths line up
                  in clean rows instead of wrapping unevenly. Each item is a
                  light "chip" with a soft border + hover lift so the cluster
                  reads as one coordinated control, not a loose pile. */}
              <div className="text-[12px] font-semibold text-gray-700 mb-2">Student Summary (Overall)</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
                {SUMMARY_COLUMNS.map(c => {
                  const checked = selectedSummary.has(c.key);
                  return (
                    <label
                      key={c.key}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[12px] cursor-pointer transition-colors ${
                        checked
                          ? "border-blue-200 bg-blue-50/60 text-gray-900"
                          : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColumn("summary", c.key)}
                        className="accent-blue-600 flex-shrink-0"
                      />
                      <span className="truncate">{c.label}</span>
                    </label>
                  );
                })}
              </div>

              {/* Question-by-Question checkboxes — same grid treatment. Only
                  rendered in Detailed mode; Summary mode hides them since
                  they'd be inert there anyway. */}
              {reportMode === "detailed" && (
                <>
                  <div className="text-[12px] font-semibold text-gray-700 mb-2">Question-by-Question Details</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {DETAIL_COLUMNS.map(c => {
                      const checked = selectedDetail.has(c.key);
                      return (
                        <label
                          key={c.key}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-[12px] cursor-pointer transition-colors ${
                            checked
                              ? "border-blue-200 bg-blue-50/60 text-gray-900"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColumn("detail", c.key)}
                            className="accent-blue-600 flex-shrink-0"
                          />
                          <span className="truncate">{c.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Report Options — now also houses the status filter so the
                user can scope what gets previewed AND exported. */}
            <div className="col-span-6 lg:col-span-3 border border-gray-200 rounded-lg p-3 bg-white">
              <div className="text-[13px] font-semibold text-gray-900 mb-2">Report Options</div>
              <label className="flex items-center gap-2 text-[12.5px] text-gray-700 cursor-pointer mb-1.5">
                <input type="radio" name="reportMode" value="detailed" checked={reportMode === "detailed"} onChange={() => setReportMode("detailed")} className="accent-blue-600" />
                Detailed Report
              </label>
              {/* Section-Based grouping — only offered for section-based tests.
                  When checked, the Detailed Report shows each section (Part A /
                  Part B …) as its own table instead of one flat list. Indented
                  so it reads as a modifier of "Detailed Report". */}
              {isSectionBased && (
                <label className={`flex items-center gap-2 text-[12px] cursor-pointer mb-1.5 ml-6 ${reportMode === "detailed" ? "text-gray-700" : "text-gray-400"}`}>
                  <input
                    type="checkbox"
                    checked={groupBySection}
                    onChange={() => setGroupBySection(v => !v)}
                    disabled={reportMode !== "detailed"}
                    className="accent-blue-600"
                  />
                  Section Based <span className="text-gray-400">(Part A / Part B tables)</span>
                </label>
              )}
              <label className="flex items-center gap-2 text-[12.5px] text-gray-700 cursor-pointer mb-3">
                <input type="radio" name="reportMode" value="summary" checked={reportMode === "summary"} onChange={() => setReportMode("summary")} className="accent-blue-600" />
                Summary Report
              </label>
              {/* Status filter — sits below the radios, separated by a thin
                  border so it's visually distinct from the mode selector but
                  still part of the same Options card. Label color matches
                  "Report Options" (gray-900, semibold) so the two headings
                  read as siblings instead of label / sublabel. */}
              <div className="border-t border-gray-100 pt-2">
                <label htmlFor="export-status-filter" className="block text-[13px] font-semibold text-gray-900 mb-1">
                  Filter by status:
                </label>
                <select
                  id="export-status-filter"
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as ExportStatusFilter)}
                  className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400"
                >
                  {STATUS_FILTER_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Search by name / email — mirrors the dashboard's Reports view
                  filter. Applied to preview AND every exporter via
                  `filteredRows`, so the file the user downloads matches what
                  they see in the modal. */}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <label htmlFor="export-search" className="block text-[13px] font-semibold text-gray-900 mb-1">
                  Search:
                </label>
                <input
                  id="export-search"
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Name or email…"
                  className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400"
                />
              </div>

              {/* Scale percentage range — both bounds optional. Either alone
                  means "≥ From" or "≤ To". Empty = filter off. */}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <label className="block text-[13px] font-semibold text-gray-900 mb-1">
                  Scale (%):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    value={scaleFromPct}
                    onChange={e => setScaleFromPct(e.target.value)}
                    placeholder="From"
                    aria-label="Scale from percent"
                    className="border border-gray-200 rounded-md px-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400 w-full"
                  />
                  <span className="text-[12px] text-gray-400">to</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    value={scaleToPct}
                    onChange={e => setScaleToPct(e.target.value)}
                    placeholder="To"
                    aria-label="Scale to percent"
                    className="border border-gray-200 rounded-md px-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400 w-full"
                  />
                </div>
              </div>

              {/* Result — pass / fail at the 50% threshold. Ungraded rows
                  drop out of both subsets, same rule as the dashboard. */}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <label htmlFor="export-passfail-filter" className="block text-[13px] font-semibold text-gray-900 mb-1">
                  Result:
                </label>
                <select
                  id="export-passfail-filter"
                  value={passFailFilter}
                  onChange={e => setPassFailFilter(e.target.value as "all" | "pass" | "fail")}
                  className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400"
                >
                  <option value="all">All Results</option>
                  <option value="pass">Pass (≥ {PASS_THRESHOLD}%)</option>
                  <option value="fail">Fail (&lt; {PASS_THRESHOLD}%)</option>
                </select>
              </div>

              {/* Page Layout — controls how Print / PDF detailed exports
                  arrange students across pages. Excel and the in-modal
                  preview ignore this (Excel has no pages; the preview is a
                  single scrollable card). */}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <div className="text-[13px] font-semibold text-gray-900 mb-1.5">Page Layout:</div>
                <label className="flex items-center gap-2 text-[12.5px] text-gray-700 cursor-pointer mb-1">
                  <input
                    type="radio"
                    name="pageLayout"
                    value="one"
                    checked={pageLayout === "one"}
                    onChange={() => setPageLayout("one")}
                    className="accent-blue-600"
                  />
                  Per page per student
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-gray-700 cursor-pointer mb-1">
                  <input
                    type="radio"
                    name="pageLayout"
                    value="flow"
                    checked={pageLayout === "flow"}
                    onChange={() => setPageLayout("flow")}
                    className="accent-blue-600"
                  />
                  Flow as it is
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="pageLayout"
                    value="custom"
                    checked={pageLayout === "custom"}
                    onChange={() => setPageLayout("custom")}
                    className="accent-blue-600"
                  />
                  Custom:
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={customStudentsPerPage}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n)) setCustomStudentsPerPage(Math.max(1, Math.min(50, n)));
                    }}
                    // Focusing or editing the number implies the user wants
                    // the custom mode — flip the radio so they don't have to
                    // click it separately.
                    onFocus={() => setPageLayout("custom")}
                    disabled={pageLayout !== "custom"}
                    className="w-14 border border-gray-200 rounded-md px-1.5 py-0.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  <span className="text-gray-500 text-[11.5px]">per page</span>
                </label>
              </div>
            </div>

            {/* Export Options (top — duplicated in footer per the screenshots) */}
            <div className="col-span-6 lg:col-span-3 border border-gray-200 rounded-lg p-3 bg-white">
              <div className="text-[13px] font-semibold text-gray-900 mb-2">Export Options</div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportPrint} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">
                  <Printer size={14} /> Print
                </button>
                <button type="button" onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-white bg-blue-600 hover:bg-blue-700">
                  <FileText size={14} /> Excel
                </button>
                <button type="button" onClick={exportPdf} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-white bg-rose-600 hover:bg-rose-700">
                  <FileText size={14} /> PDF
                </button>
              </div>
            </div>
          </div>

          {/* ── Preview ── */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <div className="text-[12.5px] font-semibold text-gray-700">Preview</div>
              <div className="text-[13px] font-bold text-indigo-600">Student Summary (Overall)</div>
              {/* Meta context strip — pipe-separated `Label: Value` chunks,
                  one big line. Wraps gracefully on narrow screens. Each chunk
                  shows the label in muted gray and the value in dark gray
                  so the eye picks the values out at a glance. */}
              {metaItems.length > 0 && (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-gray-700">
                  {metaItems.map((m, i) => (
                    <React.Fragment key={m.label}>
                      <span>
                        <span className="text-gray-500">{m.label}:</span>{" "}
                        <span className="font-semibold text-gray-900">{m.value}</span>
                      </span>
                      {i < metaItems.length - 1 && <span className="text-gray-300">|</span>}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {reportMode === "summary" ? (
              <div className="overflow-auto lmsd-scroll">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-indigo-50/60 border-b border-gray-200">
                      {activeSummaryCols.map(c => (
                        <th key={c.key} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(r => (
                      <tr key={r.student.id} className="border-b border-gray-50 hover:bg-gray-50">
                        {activeSummaryCols.map(c => (
                          <td key={c.key} className="px-3 py-2.5 whitespace-nowrap">
                            {c.render(r)}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {pageRows.length === 0 && (
                      <tr>
                        <td colSpan={Math.max(1, activeSummaryCols.length)} className="px-3 py-8 text-center text-gray-400 text-[12.5px]">
                          {statusFilter === "all" ? "No students to display." : "No students match this status filter."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              // Detailed mode — one card per student visible on the page.
              <div className="p-4 space-y-6">
                {pageRows.length === 0 && (
                  <div className="text-center text-gray-400 text-[12.5px] py-8">{statusFilter === "all" ? "No students to display." : "No students match this status filter."}</div>
                )}
                {pageRows.map(r => {
                  const breakdown = visibleBreakdowns.get(r.student.id) ?? [];
                  // Per-student summary is rendered as a simple text strip in
                  // the UI now (the previous single-row table is preserved in
                  // the Excel exporter — that's where the structured layout
                  // lives). Format: `Label: value | Label: value | …`, wraps
                  // on narrow screens. The pipe dividers are subtle gray so
                  // the values stand out.
                  return (
                    <div key={r.student.id} className="space-y-3 border border-gray-200 rounded-lg overflow-hidden">
                      {/* Per-student heading band so adjacent students don't
                          visually run together. */}
                      <div className="bg-indigo-600/5 border-b border-indigo-100 px-3 py-2 text-[12.5px] font-semibold text-indigo-700">
                        Student #{r.index + 1} — <span className="text-gray-800">{r.student.studentName || "—"}</span>
                      </div>

                      {/* Student Summary as a single inline text line with | dividers. */}
                      <div className="px-3 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-gray-700">
                        {activeSummaryCols.map((c, i) => (
                          <React.Fragment key={c.key}>
                            <span>
                              <span className="text-gray-500">{c.label}:</span>{" "}
                              <span className="font-semibold text-gray-900">{c.render(r)}</span>
                            </span>
                            {i < activeSummaryCols.length - 1 && (
                              <span className="text-gray-300">|</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>

                      {activeDetailCols.length > 0 && (
                        <div className="px-3 pb-3">
                          {sectionMode ? (
                            // One table per section (Part A / Part B …).
                            groupBreakdownBySection(breakdown).length === 0 ? (
                              <>
                                <div className="text-[12.5px] font-bold text-indigo-600 my-2">Question-by-Question Details</div>
                                {renderPreviewDetailTable([])}
                              </>
                            ) : (
                              groupBreakdownBySection(breakdown).map(g => (
                                <div key={g.name} className="mb-3 last:mb-0">
                                  <div className="text-[12.5px] font-bold text-indigo-600 my-2">{g.name}</div>
                                  {renderPreviewDetailTable(g.rows)}
                                </div>
                              ))
                            )
                          ) : (
                            <>
                              <div className="text-[12.5px] font-bold text-indigo-600 my-2">Question-by-Question Details</div>
                              {renderPreviewDetailTable(breakdown)}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-4 text-[12.5px] text-gray-500">
            <div className="flex items-center gap-1.5">
              <span>Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={e => setRowsPerPage(Number(e.target.value))}
                className="border border-gray-200 rounded-md px-2 py-1 text-[12.5px] outline-none focus:border-indigo-400"
              >
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <span>
              {filteredRows.length === 0
                ? statusFilter === "all" ? "No students" : "No students match this filter"
                : `Showing ${startIdx + 1} to ${Math.min(startIdx + rowsPerPage, filteredRows.length)} of ${filteredRows.length} ${statusFilter === "all" ? "students" : "matched"}`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Pagination */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                aria-label="Previous page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2.5 py-1 rounded-md bg-indigo-600 text-white text-[12.5px] font-semibold">{safePage}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
                aria-label="Next page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            {/* (Print / Excel / PDF buttons used to be duplicated here next
                to pagination — removed in favour of the single Export
                Options block at the top of the modal, which is the canonical
                place users find them.) */}
          </div>
        </div>
      </div>
    </div>
  );

  // SSR safety — `document` is only available client-side. The Live Dashboard
  // page is `"use client"` so this branch always runs in the browser, but the
  // guard keeps build-time pre-rendering happy.
  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}
