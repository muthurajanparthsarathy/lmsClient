// All state and derived data for the Report Export modal.
//
// Split out of ReportExportModal.tsx. Everything the modal computes lives
// here; the modal, its two panels and the three exporters are pure consumers
// of what this returns. That is what keeps the preview and the exported files
// in agreement — there is exactly one `filteredRows`, and every consumer reads
// it rather than re-deriving its own.

import { useEffect, useMemo, useState } from "react";
import { deriveTestStatus } from "../utils/helpers";
import {
  getStudentQuestionsBreakdown,
  getExerciseSectionInfo,
  type QuestionBreakdownRow,
  type ExerciseSection,
} from "../utils/computeStudentMarks";
import { SUMMARY_COLUMNS, DETAIL_COLUMNS } from "./reportExport.columns";
import { PASS_THRESHOLD } from "./reportExport.helpers";
import type {
  ExportStatusFilter,
  MetaItem,
  PageLayoutMode,
  PassFailFilter,
  ReportExportModalProps,
  ReportMode,
  SectionGroup,
  StudentExportRow,
} from "./reportExport.types";

export function useReportExportState({
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
  const [passFailFilter, setPassFailFilter] = useState<PassFailFilter>("all");

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

  const metaItems: MetaItem[] = useMemo(() => {
    const items: MetaItem[] = [];
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
    //
    // This read `r.student.name` until the file was split. `StudentProgress`
    // has no `name` — the field is `studentName` — so the name half of this
    // filter was always comparing against `undefined` and only the email half
    // ever matched, despite the box being labelled "Name or email…". The
    // mistake survived because `next.config.js` sets `ignoreBuildErrors`, so
    // the type error never failed a build.
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(r =>
        (r.student.studentName || "").toLowerCase().includes(q) ||
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
    if (!courseData || !exerciseId) return new Map<string, QuestionBreakdownRow[]>();
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
  const groupBreakdownBySection = (rows: QuestionBreakdownRow[]): SectionGroup[] => {
    const order = sectionInfo.sections.map((s: ExerciseSection) => s.name).filter(Boolean);
    const byName = new Map<string, QuestionBreakdownRow[]>();
    for (const r of rows) {
      const nm = r.sectionName || "Other";
      if (!byName.has(nm)) byName.set(nm, []);
      byName.get(nm)!.push(r);
    }
    const out: SectionGroup[] = [];
    for (const nm of order) {
      if (byName.has(nm)) { out.push({ name: nm, rows: byName.get(nm)! }); byName.delete(nm); }
    }
    for (const [nm, rs] of byName) out.push({ name: nm, rows: rs }); // leftovers (incl. "Other")
    return out;
  };

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

  return {
    // mode + column selection
    reportMode, setReportMode,
    selectedSummary, selectedDetail, toggleColumn,
    activeSummaryCols, activeDetailCols,
    // filters
    statusFilter, setStatusFilter,
    searchQuery, setSearchQuery,
    scaleFromPct, setScaleFromPct,
    scaleToPct, setScaleToPct,
    passFailFilter, setPassFailFilter,
    // sections
    isSectionBased, groupBySection, setGroupBySection, sectionMode,
    groupBreakdownBySection,
    // page layout (Print / PDF only)
    pageLayout, setPageLayout,
    customStudentsPerPage, setCustomStudentsPerPage,
    // rows + pagination
    metaItems, filteredRows, pageRows, visibleBreakdowns,
    page, setPage, rowsPerPage, setRowsPerPage,
    totalPages, safePage, startIdx,
    // exporters' data source
    buildAllBreakdowns,
  };
}

export type ReportExportState = ReturnType<typeof useReportExportState>;
