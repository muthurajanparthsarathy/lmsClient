// Shared types for the Report Export modal and everything split out of it.
//
// Split out of ReportExportModal.tsx, which had grown past 1,500 lines. The
// types live here rather than in the modal so the exporters, the column
// registry and the two UI panels can all import them without importing the
// modal itself (which would be a cycle).

import type React from "react";
import type { StudentProgress } from "../types/reports.types";
import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";

// ─── Column definitions (single source of truth — used by checkboxes,
//     preview headers, the Excel writer, and the print HTML builder). ─────────

export interface ColumnDef<T> {
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
export interface StudentExportRow {
  index: number;
  student: StudentProgress;
}

export type ReportMode = "summary" | "detailed";

// Status filter aligns with the dashboard's own `TestStatus` values (plus an
// "all" pseudo-option). When set, the preview AND every export honour the
// filter — the user gets exactly what they previewed.
export type ExportStatusFilter = "all" | "not-started" | "started" | "submitted";

export type PassFailFilter = "all" | "pass" | "fail";

// Page layout for the Detailed PDF / Print exports:
//   "one"    → each student on its own page (forced page break per student)
//   "flow"   → no forced breaks; students flow naturally until they don't fit
//   "custom" → custom N students per page, taken from `customStudentsPerPage`
// Excel is unaffected (it uses logical sheets, not paged output) and the
// modal preview is unaffected (it's a single scrollable area).
export type PageLayoutMode = "one" | "flow" | "custom";

/** One `Label: Value` chunk of the meta header strip. */
export interface MetaItem {
  label: string;
  value: string;
}

/** A named group of question rows — one section (Part A / Part B / …). */
export interface SectionGroup {
  name: string;
  rows: QuestionBreakdownRow[];
}

// ─── Modal props ────────────────────────────────────────────────────────────

export interface ReportExportModalProps {
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

/**
 * Everything the three exporters need, in one object.
 *
 * Print / PDF / Excel each used to close over a dozen values from the
 * component body. Passing that same set explicitly is what let them move into
 * their own files — and it makes the contract visible: an exporter reads this
 * and nothing else, so it can never quietly diverge from the preview.
 */
export interface ExportContext {
  reportMode: ReportMode;
  assessmentName: string;
  metaItems: MetaItem[];
  /** Post-filter rows. Every exporter writes these, so file === preview. */
  filteredRows: StudentExportRow[];
  activeSummaryCols: ColumnDef<StudentExportRow>[];
  activeDetailCols: ColumnDef<QuestionBreakdownRow>[];
  sectionMode: boolean;
  pageLayout: PageLayoutMode;
  customStudentsPerPage: number;
  buildAllBreakdowns: () => Map<string, QuestionBreakdownRow[]>;
  groupBreakdownBySection: (rows: QuestionBreakdownRow[]) => SectionGroup[];
}
