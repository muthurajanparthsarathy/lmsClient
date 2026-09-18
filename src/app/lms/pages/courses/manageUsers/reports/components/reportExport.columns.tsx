
import React from "react";
import { deriveTestStatus } from "../utils/helpers";
import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";
import type { ColumnDef, StudentExportRow } from "./reportExport.types";
import {
  STATUS_BADGE,
  QUESTION_STATUS_META,
  fmtDate,
  fmtTime,
} from "./reportExport.helpers";

// Student summary column registry. Order here is the order they appear.
// "S. No." was removed per design feedback — it's a derived row counter
// that adds noise to a table where Student Name + Email already identify
// the row. Removing it here also drops it from the modal column-picker,
// the preview table, the Detailed-mode inline summary strip, the Excel
// export, the PDF export, and the Print HTML — every consumer of
// `SUMMARY_COLUMNS` is automatically updated.
export const SUMMARY_COLUMNS: ColumnDef<StudentExportRow>[] = [
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
export const DETAIL_COLUMNS: ColumnDef<QuestionBreakdownRow>[] = [
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
