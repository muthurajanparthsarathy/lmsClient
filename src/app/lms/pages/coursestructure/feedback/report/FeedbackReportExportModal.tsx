"use client";

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackReportExportModal — patterned after liveDashboard's
// ReportExportModal. Opens 90vw × 90vh from the feedback report page. Lets the
// admin pick columns, filter the responses, switch between Summary and
// Detailed modes, preview the result, and export it as Print / Excel / PDF.
//
// Every exporter and the preview pull from the same `filteredResponses`
// pipeline so what the user sees in the preview is exactly what they ship.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Printer,
  X,
  Star,
  Search,
  Filter,
} from "lucide-react";
import { Poppins } from "next/font/google";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Feedback, FeedbackQuestion } from "../types/feedback";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// ─── Helpers ────────────────────────────────────────────────────────────────
const stripHtml = (s: string) => {
  if (!s) return "";
  if (typeof window === "undefined") return s.replace(/<[^>]*>/g, "").trim();
  const tmp = document.createElement("div");
  tmp.innerHTML = s;
  return (tmp.textContent || tmp.innerText || "").trim();
};

const sanitiseFilename = (s: string) =>
  s.replace(/[\/\\:*?"<>|]/g, "").trim().slice(0, 60) || "feedback-report";

const escapeHtml = (v: any) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

// ─── Types ──────────────────────────────────────────────────────────────────
type AnyResponse = {
  _id?: string;
  studentId?: string;
  studentName?: string;
  studentEmail?: string;
  isAnonymous?: boolean;
  submittedAt?: string;
  overallRating?: number;
  overallReason?: string;
  answers?: Array<{
    questionText: string;
    questionType: "rating" | "text";
    answer: any;
    reason?: string;
  }>;
};

type ReportMode = "summary" | "detailed";
type StatusFilter = "all" | "identified" | "anonymous";
type ResultFilter = "all" | "positive" | "negative";
type PageLayoutMode = "one" | "flow" | "custom";

export interface FeedbackReportExportModalProps {
  open: boolean;
  onClose: () => void;
  feedback: Feedback | null;
}

// ─── Per-response summary column registry ───────────────────────────────────
// Static (per-feedback) columns; the question-answer columns are appended
// dynamically based on the questions array.
interface SummaryColumnDef {
  key: string;
  label: string;
  width?: number; // excel width hint
  value: (r: AnyResponse, ctx: BuildCtx) => string | number;
}

interface BuildCtx {
  feedback: Feedback;
  ratingScale: number;
}

const responseRatingAvg = (r: AnyResponse): number => {
  const vals: number[] = [];
  r.answers?.forEach((a) => {
    if (a.questionType === "rating") {
      const v = Number(a.answer);
      if (Number.isFinite(v) && v > 0) vals.push(v);
    }
  });
  if (vals.length) return vals.reduce((s, v) => s + v, 0) / vals.length;
  return Number(r.overallRating) || 0;
};

const STATIC_SUMMARY_COLUMNS: SummaryColumnDef[] = [
  {
    key: "name",
    label: "Student Name",
    width: 24,
    value: (r) => (r.isAnonymous ? "Anonymous" : r.studentName || ""),
  },
  {
    key: "email",
    label: "Email",
    width: 28,
    value: (r) => (r.isAnonymous ? "" : r.studentEmail || ""),
  },
  {
    key: "submitted",
    label: "Submitted",
    width: 18,
    value: (r) => (r.submittedAt ? format(new Date(r.submittedAt), "d MMM yyyy") : ""),
  },
  {
    key: "overallRating",
    label: "Overall Rating",
    width: 14,
    value: (r) => (typeof r.overallRating === "number" && r.overallRating > 0 ? r.overallRating : ""),
  },
  {
    key: "avgRating",
    label: "Average Rating",
    width: 14,
    value: (r) => {
      const avg = responseRatingAvg(r);
      return avg > 0 ? Number(avg.toFixed(2)) : "";
    },
  },
  {
    key: "result",
    label: "Result",
    width: 12,
    value: (r, ctx) => {
      const avg = responseRatingAvg(r);
      if (avg <= 0) return "";
      return avg >= ctx.ratingScale * 0.7 ? "Positive" : "Negative";
    },
  },
  {
    key: "overallReason",
    label: "Overall Comment",
    width: 36,
    value: (r) => stripHtml(r.overallReason || ""),
  },
];

// ─── Question detail column registry (one row per question) ─────────────────
interface DetailColumnDef {
  key: string;
  label: string;
  width?: number;
  value: (q: FeedbackQuestion, idx: number, stats: QuestionStats) => string | number;
}

interface QuestionStats {
  avg: number;
  answered: number;
}

const DETAIL_COLUMNS: DetailColumnDef[] = [
  { key: "qno", label: "#", width: 6, value: (_, i) => i + 1 },
  { key: "question", label: "Question", width: 50, value: (q) => q.questionText },
  { key: "category", label: "Category", width: 18, value: (q) => (q as any).category || "" },
  { key: "type", label: "Type", width: 10, value: (q) => q.questionType },
  { key: "required", label: "Required", width: 10, value: (q) => (q.isRequired ? "Yes" : "No") },
  {
    key: "scale",
    label: "Scale",
    width: 10,
    value: (q) =>
      q.ratingConfig
        ? `${q.ratingConfig.minRating}–${q.ratingConfig.maxRating}`
        : `1–${q.maxLength || ""}`,
  },
  {
    key: "answered",
    label: "Answered",
    width: 12,
    value: (_, __, s) => s.answered,
  },
  {
    key: "avg",
    label: "Avg",
    width: 10,
    value: (q, __, s) =>
      q.questionType === "rating" && s.avg > 0 ? Number(s.avg.toFixed(2)) : "",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export default function FeedbackReportExportModal({
  open,
  onClose,
  feedback,
}: FeedbackReportExportModalProps) {
  // Hooks ALWAYS first (no early-return before them).
  const questions: FeedbackQuestion[] = feedback?.questions || [];
  const responses: AnyResponse[] = (feedback?.studentResponses as any[]) || [];

  // Derive the rating scale from the questions' actual maxRating.
  const ratingScale = useMemo(() => {
    const maxes = questions
      .map((q) => q.ratingConfig?.maxRating)
      .filter((n): n is number => typeof n === "number" && n > 0);
    return maxes.length ? Math.max(...maxes) : 5;
  }, [questions]);

  // All distinct categories present on the form.
  const categories = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      const c = (q as any).category?.trim?.();
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [questions]);

  // Summary columns are the static per-response fields only — Overall Rating
  // is enough for the summary view; individual question answers belong in the
  // detailed report.
  const ALL_SUMMARY_COLUMNS: SummaryColumnDef[] = STATIC_SUMMARY_COLUMNS;

  // ── Selection state ─────────────────────────────────────────────────────
  const [reportMode, setReportMode] = useState<ReportMode>("summary");
  const [selectedSummary, setSelectedSummary] = useState<Set<string>>(
    () => new Set(STATIC_SUMMARY_COLUMNS.map((c) => c.key))
  );
  const [selectedDetail, setSelectedDetail] = useState<Set<string>>(
    () => new Set(DETAIL_COLUMNS.map((c) => c.key))
  );
  const [groupByCategory, setGroupByCategory] = useState(true);
  // Layout of the detailed report body when Category-based is on.
  //   'row'    → existing per-response cards with answers listed vertically.
  //   'column' → wide matrix: one row per student, one column per question,
  //              category header spans its question columns.
  const [detailLayout, setDetailLayout] = useState<"row" | "column">("row");

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFrom, setRatingFrom] = useState("");
  const [ratingTo, setRatingTo] = useState("");
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());

  // Filter sub-modal
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Page layout (Print / PDF only)
  const [pageLayout, setPageLayout] = useState<PageLayoutMode>("flow");
  const [customPerPage, setCustomPerPage] = useState(5);

  // Sync ALL summary key set when questions change so the selection stays valid.
  useEffect(() => {
    setSelectedSummary(new Set(ALL_SUMMARY_COLUMNS.map((c) => c.key)));
  }, [ALL_SUMMARY_COLUMNS.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset pagination on filter / mode change so we don't park on an empty page.
  useEffect(() => {
    setPage(1);
  }, [
    reportMode,
    rowsPerPage,
    statusFilter,
    searchQuery,
    ratingFrom,
    ratingTo,
    resultFilter,
    dateFrom,
    dateTo,
    categoryFilter,
  ]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const positiveThreshold = ratingScale * 0.7;

  // Average rating of a single response (across its rating answers).
  const responseAverage = (r: AnyResponse): number => {
    const vals: number[] = [];
    r.answers?.forEach((a) => {
      if (a.questionType === "rating") {
        const v = Number(a.answer);
        if (Number.isFinite(v) && v > 0) vals.push(v);
      }
    });
    if (!vals.length) return Number(r.overallRating) || 0;
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  // ── Filtered responses pipeline ─────────────────────────────────────────
  const filteredResponses = useMemo(() => {
    let rows = responses;

    if (statusFilter !== "all") {
      rows = rows.filter((r) =>
        statusFilter === "anonymous" ? r.isAnonymous : !r.isAnonymous
      );
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (r) =>
          (r.studentName || "").toLowerCase().includes(q) ||
          (r.studentEmail || "").toLowerCase().includes(q) ||
          (r.answers || []).some((a) =>
            stripHtml(a.answer?.toString() || "").toLowerCase().includes(q)
          )
      );
    }

    const fromNum = ratingFrom.trim() === "" ? null : Number(ratingFrom);
    const toNum = ratingTo.trim() === "" ? null : Number(ratingTo);
    if (Number.isFinite(fromNum) || Number.isFinite(toNum)) {
      rows = rows.filter((r) => {
        const avg = responseAverage(r);
        if (avg <= 0) return false;
        if (Number.isFinite(fromNum) && avg < (fromNum as number)) return false;
        if (Number.isFinite(toNum) && avg > (toNum as number)) return false;
        return true;
      });
    }

    if (resultFilter !== "all") {
      rows = rows.filter((r) => {
        const avg = responseAverage(r);
        if (avg <= 0) return false;
        return resultFilter === "positive" ? avg >= positiveThreshold : avg < positiveThreshold;
      });
    }

    if (dateFrom) {
      const d = new Date(dateFrom).getTime();
      rows = rows.filter((r) => (r.submittedAt ? new Date(r.submittedAt).getTime() >= d : false));
    }
    if (dateTo) {
      // Inclusive: add 1 day so a same-day submission still passes.
      const d = new Date(dateTo).getTime() + 24 * 3600 * 1000 - 1;
      rows = rows.filter((r) => (r.submittedAt ? new Date(r.submittedAt).getTime() <= d : false));
    }

    if (categoryFilter.size > 0) {
      rows = rows.filter((r) =>
        (r.answers || []).some((a) => {
          const q = questions.find((qq) => qq.questionText === a.questionText);
          const cat = (q as any)?.category?.trim?.();
          return cat && categoryFilter.has(cat);
        })
      );
    }

    return rows;
  }, [
    responses,
    statusFilter,
    searchQuery,
    ratingFrom,
    ratingTo,
    resultFilter,
    dateFrom,
    dateTo,
    categoryFilter,
    questions,
    positiveThreshold,
  ]);

  // Per-question stats (over filtered responses).
  const questionStats: QuestionStats[] = useMemo(() => {
    return questions.map((q) => {
      const vals: number[] = [];
      let answered = 0;
      filteredResponses.forEach((r) => {
        const a = r.answers?.find((x) => x.questionText === q.questionText);
        if (!a) return;
        if (q.questionType === "rating") {
          const v = Number(a.answer);
          if (Number.isFinite(v) && v > 0) {
            vals.push(v);
            answered += 1;
          }
        } else {
          if (stripHtml(a.answer?.toString() || "")) answered += 1;
        }
      });
      return {
        avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
        answered,
      };
    });
  }, [filteredResponses, questions]);

  // Pagination math
  const totalPages = Math.max(1, Math.ceil(filteredResponses.length / rowsPerPage));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * rowsPerPage;
  const pageRows = useMemo(
    () => filteredResponses.slice(startIdx, startIdx + rowsPerPage),
    [filteredResponses, startIdx, rowsPerPage]
  );

  // ── Active column lists ────────────────────────────────────────────────
  const activeSummaryCols = useMemo(
    () => ALL_SUMMARY_COLUMNS.filter((c) => selectedSummary.has(c.key)),
    [ALL_SUMMARY_COLUMNS, selectedSummary]
  );
  const activeDetailCols = useMemo(
    () => DETAIL_COLUMNS.filter((c) => selectedDetail.has(c.key)),
    [selectedDetail]
  );

  // Meta strip items
  const metaItems: { label: string; value: string }[] = useMemo(() => {
    const out: { label: string; value: string }[] = [];
    if (feedback?.feedbackTitle) out.push({ label: "Feedback", value: feedback.feedbackTitle });
    if ((feedback as any)?.trainerName)
      out.push({ label: "Trainer", value: (feedback as any).trainerName });
    out.push({ label: "Total Responses", value: String(filteredResponses.length) });
    out.push({ label: "Rating Scale", value: `1–${ratingScale}` });
    out.push({ label: "Generated", value: format(new Date(), "d MMM yyyy, h:mm a") });
    return out;
  }, [feedback, filteredResponses.length, ratingScale]);

  // ── Toggle helpers ─────────────────────────────────────────────────────
  const toggleColumn = (which: "summary" | "detail", key: string) => {
    const setter = which === "summary" ? setSelectedSummary : setSelectedDetail;
    const all = which === "summary" ? ALL_SUMMARY_COLUMNS : DETAIL_COLUMNS;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next.size === 0 ? new Set(all.map((c) => c.key)) : next;
    });
  };

  const toggleCategory = (cat: string) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (statusFilter !== "all") n += 1;
    if (resultFilter !== "all") n += 1;
    if (searchQuery.trim()) n += 1;
    if (ratingFrom.trim() || ratingTo.trim()) n += 1;
    if (dateFrom || dateTo) n += 1;
    if (categoryFilter.size > 0) n += 1;
    return n;
  }, [statusFilter, resultFilter, searchQuery, ratingFrom, ratingTo, dateFrom, dateTo, categoryFilter]);

  const clearAllFilters = () => {
    setStatusFilter("all");
    setResultFilter("all");
    setSearchQuery("");
    setRatingFrom("");
    setRatingTo("");
    setDateFrom("");
    setDateTo("");
    setCategoryFilter(new Set());
  };

  // ─── EXPORTERS ──────────────────────────────────────────────────────────

  // ── Print: hidden iframe + window.print, mirrors liveDashboard pattern ──
  const buildPrintableHtml = (title: string) => {
    const metaHtml =
      metaItems.length === 0
        ? ""
        : `<table class="meta-table"><thead><tr>${metaItems
            .map((m) => `<th>${escapeHtml(m.label)}</th>`)
            .join("")}</tr></thead><tbody><tr>${metaItems
            .map((m) => `<td>${escapeHtml(m.value)}</td>`)
            .join("")}</tr></tbody></table>`;

    const summaryHeader = `<tr>${activeSummaryCols
      .map((c) => `<th>${escapeHtml(c.label)}</th>`)
      .join("")}</tr>`;
    const summaryRowsHtml = filteredResponses
      .map(
        (r) =>
          `<tr>${activeSummaryCols
            .map(
              (c) =>
                `<td>${escapeHtml(c.value(r, { feedback: feedback!, ratingScale }))}</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    let body = "";
    if (reportMode === "summary") {
      body = `
        ${metaHtml}
        <h2>Response Summary</h2>
        <table class="report-table">
          <thead>${summaryHeader}</thead>
          <tbody>${summaryRowsHtml}</tbody>
        </table>
        <h2>Question Statistics</h2>
        <table class="report-table">
          <thead><tr>${activeDetailCols
            .map((c) => `<th>${escapeHtml(c.label)}</th>`)
            .join("")}</tr></thead>
          <tbody>${questions
            .map(
              (q, i) =>
                `<tr>${activeDetailCols
                  .map(
                    (c) =>
                      `<td>${escapeHtml(c.value(q, i, questionStats[i] || { avg: 0, answered: 0 }))}</td>`
                  )
                  .join("")}</tr>`
            )
            .join("")}</tbody>
        </table>`;
    } else if (useColumnMatrix) {
      // ── Detailed · Column matrix ─────────────────────────────────────
      const questionCols = columnLayout.ordered;
      const bandCells = columnLayout.groups
        .map(
          (g) =>
            `<th colspan="${g.questions.length}" class="cat-band">${escapeHtml(
              g.category || "Uncategorized"
            )}</th>`
        )
        .join("");
      const headerCells = questionCols
        .map((q) => `<th>${escapeHtml(q.questionText)}</th>`)
        .join("");
      const rowsHtml = filteredResponses
        .map(
          (r, i) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(r.isAnonymous ? "Anonymous" : r.studentName || "—")}</td>
              ${questionCols
                .map(
                  (q) => `<td>${escapeHtml(answerFor(r, q))}</td>`
                )
                .join("")}
              <td>${
                typeof r.overallRating === "number" && r.overallRating > 0
                  ? `★${r.overallRating} `
                  : ""
              }${escapeHtml(stripHtml(r.overallReason || ""))}</td>
            </tr>`
        )
        .join("");
      body = `
        ${metaHtml}
        <h2>Detailed Report — Column Matrix</h2>
        <table class="report-table matrix">
          <thead>
            <tr>
              <th rowspan="2">#</th>
              <th rowspan="2">Student</th>
              ${bandCells}
              <th rowspan="2">Overall</th>
            </tr>
            <tr>${headerCells}</tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>`;
    } else {
      const perPage =
        pageLayout === "one" ? 1 : pageLayout === "custom" ? Math.max(1, customPerPage) : Infinity;

      body = metaHtml + filteredResponses
        .map((r, i) => {
          const fields = activeSummaryCols
            .map(
              (c) =>
                `<div class="kv"><span class="k">${escapeHtml(c.label)}</span><span class="v">${escapeHtml(
                  c.value(r, { feedback: feedback!, ratingScale })
                )}</span></div>`
            )
            .join("");
          const isLast = i === filteredResponses.length - 1;
          const forceBreak = !isLast && perPage !== Infinity && (i + 1) % perPage === 0;
          const extraStyle = forceBreak ? ' style="page-break-after: always;"' : "";

          // Group answers by category for this response
          const groups = groupAnswersForResponse(r);
          const detail = groups
            .map(
              (g) =>
                `<h4>${escapeHtml(g.category || "Uncategorized")}</h4>
                 <table class="report-table">
                   <thead><tr><th>#</th><th>Question</th><th>Type</th><th>Answer</th><th>Reason</th></tr></thead>
                   <tbody>${g.rows
                     .map(
                       (a, j) =>
                         `<tr><td>${j + 1}</td><td>${escapeHtml(a.questionText)}</td><td>${escapeHtml(
                           a.questionType
                         )}</td><td>${escapeHtml(
                           a.questionType === "rating" ? a.answer : stripHtml(a.answer?.toString() || "")
                         )}</td><td>${escapeHtml(stripHtml(a.reason || ""))}</td></tr>`
                     )
                     .join("")}</tbody>
                 </table>`
            )
            .join("");

          return `
            <section class="student-card"${extraStyle}>
              <h3>Response #${i + 1}</h3>
              <div class="kv-grid">${fields}</div>
              ${detail}
            </section>`;
        })
        .join("");
    }

    return `
<!doctype html><html><head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
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
  .meta-table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 6px 0 14px; }
  .meta-table th, .meta-table td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
  .meta-table th { background: #4f46e5; color: #fff; font-weight: 600; }
  .report-table.matrix { font-size: 10px; }
  .report-table.matrix th.cat-band { background: #4f46e5; color: #fff; font-weight: 700; text-align: center; }
  .report-table.matrix td { max-width: 220px; word-break: break-word; }
  @page { size: A4 landscape; }
  .meta-table td { background: #eef2ff; font-weight: 600; color: #111; }
  .student-card { page-break-inside: avoid; margin: 18px 0 22px; }
  .kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 6px 0 10px; font-size: 11px; }
  .kv { display: flex; gap: 8px; }
  .kv .k { color: #555; min-width: 130px; }
  .kv .v { color: #111; font-weight: 600; }
  @media print { body { padding: 12px; } }
</style></head><body>
<h1>${escapeHtml(feedback?.feedbackTitle || "Feedback Report")}</h1>
<div class="sub">${escapeHtml(title)} · Generated ${new Date().toLocaleString("en-GB")}</div>
${body}
</body></html>`;
  };

  // ── Column-mode helpers ───────────────────────────────────────────────
  // Category-grouped question order used by the "Column" detailed layout:
  // categorized questions first (in category first-appearance order,
  // preserving question order within each), then uncategorized questions.
  // Returned once so preview / Excel / PDF / Print all read the same layout.
  const columnLayout = useMemo(() => {
    const catOrder: string[] = [];
    const seen = new Set<string>();
    questions.forEach((q) => {
      const c = (q as any).category?.trim?.();
      if (c && !seen.has(c)) {
        seen.add(c);
        catOrder.push(c);
      }
    });
    const byCat = new Map<string, FeedbackQuestion[]>();
    catOrder.forEach((c) => byCat.set(c, []));
    const uncategorized: FeedbackQuestion[] = [];
    questions.forEach((q) => {
      const c = (q as any).category?.trim?.();
      if (c) byCat.get(c)!.push(q);
      else uncategorized.push(q);
    });
    let groups: { category: string | null; questions: FeedbackQuestion[] }[] = [];
    catOrder.forEach((c) =>
      groups.push({ category: c, questions: byCat.get(c) || [] })
    );
    if (uncategorized.length)
      groups.push({ category: null, questions: uncategorized });
    // Filters → Categories restricts *which categories' questions* appear in
    // the report (in addition to its response-side filter effect). When
    // nothing is picked ("all"), every group survives.
    if (categoryFilter.size > 0) {
      groups = groups.filter((g) => g.category && categoryFilter.has(g.category));
    }
    const ordered: FeedbackQuestion[] = groups.flatMap((g) => g.questions);
    return { groups, ordered };
  }, [questions, categoryFilter]);

  // For a response, get the raw answer value for a given question. Strings
  // are HTML-stripped; ratings kept as numbers.
  const answerFor = (r: AnyResponse, q: FeedbackQuestion) => {
    const a = r.answers?.find((x) => x.questionText === q.questionText);
    if (!a) return "";
    if (q.questionType === "rating") return Number(a.answer) || "";
    return stripHtml(a.answer?.toString() || "");
  };

  // Effective detailed layout — only meaningful when Detailed + Category-based
  // is on; otherwise Row logic runs.
  const useColumnMatrix =
    reportMode === "detailed" && groupByCategory && detailLayout === "column";

  // Group a single response's answers by question category (preserves order
  // of first appearance per the questions list). Honours the Filters →
  // Categories selection so Row layout shows the same categories as Column
  // layout.
  const groupAnswersForResponse = (r: AnyResponse) => {
    const groups: {
      category: string | null;
      rows: NonNullable<AnyResponse["answers"]>;
    }[] = [];
    const map = new Map<string, number>();
    (r.answers || []).forEach((a) => {
      const q = questions.find((qq) => qq.questionText === a.questionText);
      const cat = (q as any)?.category?.trim?.() || null;
      // When the Categories filter is set, drop answers whose category
      // isn't in the picked set (and drop uncategorized answers too).
      if (categoryFilter.size > 0 && (!cat || !categoryFilter.has(cat))) return;
      const key = cat || "__ungrouped__";
      let idx = map.get(key);
      if (idx === undefined) {
        idx = groups.length;
        map.set(key, idx);
        groups.push({ category: cat, rows: [] });
      }
      groups[idx].rows.push(a);
    });
    return groups;
  };

  const exportPrint = () => {
    if (!feedback) return;
    const html = buildPrintableHtml(
      reportMode === "summary" ? "Summary Report" : "Detailed Report"
    );
    const iframe = document.createElement("iframe");
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
    });
    document.body.appendChild(iframe);
    const cleanup = () => setTimeout(() => iframe.remove(), 1000);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return;
    }
    win.onafterprint = cleanup;
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        console.error("print failed", e);
      }
      setTimeout(cleanup, 30000);
    }, 200);
  };

  // ── PDF: jsPDF + autoTable ──
  const exportPdf = () => {
    if (!feedback) return;
    const orientation =
      useColumnMatrix || activeSummaryCols.length > 6 ? "landscape" : "portrait";
    const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(17, 17, 17);
    doc.text(feedback.feedbackTitle || "Feedback Report", margin, margin + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `${
        reportMode === "summary" ? "Summary Report" : "Detailed Report"
      } · Generated ${new Date().toLocaleString("en-GB")}`,
      margin,
      margin + 26
    );

    let nextY = margin + 40;
    if (metaItems.length > 0) {
      autoTable(doc, {
        startY: nextY,
        margin: { left: margin, right: margin },
        head: [metaItems.map((m) => m.label)],
        body: [metaItems.map((m) => m.value)],
        styles: {
          fontSize: 8.5,
          cellPadding: 5,
          lineColor: [229, 231, 235],
          lineWidth: 0.5,
        },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
        bodyStyles: {
          fillColor: [238, 242, 255],
          fontStyle: "bold",
          textColor: [17, 17, 17],
        },
        theme: "grid",
      });
      nextY = (doc as any).lastAutoTable.finalY + 14;
    }

    if (reportMode === "summary") {
      autoTable(doc, {
        startY: nextY,
        margin: { left: margin, right: margin },
        head: [activeSummaryCols.map((c) => c.label)],
        body: filteredResponses.map((r) =>
          activeSummaryCols.map((c) => String(c.value(r, { feedback, ratingScale }) ?? ""))
        ),
        styles: { fontSize: 9, cellPadding: 6, lineColor: [229, 231, 235], lineWidth: 0.5 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        theme: "grid",
      });

      const after = (doc as any).lastAutoTable.finalY + 18;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(17, 17, 17);
      doc.text("Question Statistics", margin, after);
      autoTable(doc, {
        startY: after + 6,
        margin: { left: margin, right: margin },
        head: [activeDetailCols.map((c) => c.label)],
        body: questions.map((q, i) =>
          activeDetailCols.map((c) =>
            String(c.value(q, i, questionStats[i] || { avg: 0, answered: 0 }) ?? "")
          )
        ),
        styles: { fontSize: 8, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5 },
        headStyles: { fillColor: [238, 242, 255], textColor: [55, 65, 81], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        theme: "grid",
      });
    } else if (useColumnMatrix) {
      // ── Detailed · Column matrix as one wide table ────────────────────
      const questionCols = columnLayout.ordered;
      const headTop = ["#", "Student", ...questionCols.map((q) => q.questionText), "Overall"];
      const body = filteredResponses.map((r, idx) => [
        idx + 1,
        r.isAnonymous ? "Anonymous" : r.studentName || "—",
        ...questionCols.map((q) => String(answerFor(r, q) ?? "")),
        [
          typeof r.overallRating === "number" && r.overallRating > 0
            ? `★${r.overallRating}`
            : "",
          stripHtml(r.overallReason || ""),
        ]
          .filter(Boolean)
          .join(" · "),
      ]);
      autoTable(doc, {
        startY: nextY,
        margin: { left: margin, right: margin },
        head: [headTop],
        body,
        styles: {
          fontSize: 7.5,
          cellPadding: 3,
          lineColor: [229, 231, 235],
          lineWidth: 0.4,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "left",
        },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        theme: "grid",
      });
    } else {
      let cursorY = nextY;
      const ensureSpace = (needed: number) => {
        if (cursorY + needed > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }
      };
      const perPage =
        pageLayout === "one"
          ? 1
          : pageLayout === "custom"
          ? Math.max(1, customPerPage)
          : Infinity;
      let renderedSinceBreak = 0;

      for (let i = 0; i < filteredResponses.length; i++) {
        const r = filteredResponses[i];
        if (renderedSinceBreak >= perPage) {
          doc.addPage();
          cursorY = margin;
          renderedSinceBreak = 0;
        }
        ensureSpace(40);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(17, 17, 17);
        doc.text(
          `Response #${i + 1} — ${r.isAnonymous ? "Anonymous" : r.studentName || ""}`,
          margin,
          cursorY + 12
        );
        cursorY += 20;

        const summaryParts = activeSummaryCols.map(
          (c) => `${c.label}: ${String(c.value(r, { feedback, ratingScale }) ?? "—")}`
        );
        const summaryLine = summaryParts.join("   |   ");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(summaryLine, pageWidth - 2 * margin) as string[];
        ensureSpace(12 * lines.length + 6);
        doc.text(lines, margin, cursorY + 12 - 3);
        cursorY += 12 * lines.length + 8;

        const groups = groupByCategory ? groupAnswersForResponse(r) : [{ category: null, rows: r.answers || [] }];

        groups.forEach((g) => {
          ensureSpace(80);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(79, 70, 229);
          doc.text(g.category || "All Answers", margin, cursorY);
          cursorY += 8;
          autoTable(doc, {
            startY: cursorY + 4,
            margin: { left: margin, right: margin },
            head: [["#", "Question", "Type", "Answer", "Reason"]],
            body: g.rows.map((a, j) => [
              j + 1,
              a.questionText,
              a.questionType,
              a.questionType === "rating" ? String(a.answer) : stripHtml(a.answer?.toString() || ""),
              stripHtml(a.reason || ""),
            ]),
            styles: { fontSize: 8, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5 },
            headStyles: { fillColor: [238, 242, 255], textColor: [55, 65, 81], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            theme: "grid",
          });
          cursorY = (doc as any).lastAutoTable.finalY + 16;
        });

        renderedSinceBreak += 1;
      }
    }

    // Footer page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 16, {
        align: "right",
      });
    }

    doc.save(`${sanitiseFilename(feedback.feedbackTitle)}-${reportMode}.pdf`);
  };

  // ── Excel: exceljs with autoFilter ──
  const exportExcel = async () => {
    if (!feedback) return;
    const wb = new ExcelJS.Workbook();
    wb.creator = "EduLMS";
    wb.created = new Date();

    const PALETTE = {
      indigoFill: "FF4F46E5",
      indigoSoft: "FFEEF2FF",
      lavender: "FFE9E3FB",
      lavender2: "FFC4B5FD",
      questionHdr: "FFEEF7FF",
      altRow: "FFF9FAFB",
      border: "FFE5E7EB",
      grey: "FF6B7280",
      white: "FFFFFFFF",
      black: "FF111111",
    };
    const THIN_BORDER = {
      top: { style: "thin" as const, color: { argb: PALETTE.border } },
      left: { style: "thin" as const, color: { argb: PALETTE.border } },
      right: { style: "thin" as const, color: { argb: PALETTE.border } },
      bottom: { style: "thin" as const, color: { argb: PALETTE.border } },
    };
    const applyFill = (c: ExcelJS.Cell, argb: string) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
    };
    const applyBorder = (c: ExcelJS.Cell) => (c.border = THIN_BORDER);

    const writeMetaHeader = (sheet: ExcelJS.Worksheet) => {
      if (metaItems.length === 0) return;
      const labelRow = sheet.addRow(metaItems.map((m) => m.label));
      labelRow.eachCell((cell, n) => {
        if (n > metaItems.length) return;
        cell.font = { bold: true, color: { argb: PALETTE.white } };
        applyFill(cell, PALETTE.indigoFill);
        applyBorder(cell);
        cell.alignment = { vertical: "middle", horizontal: "left" };
      });
      const valueRow = sheet.addRow(metaItems.map((m) => m.value));
      valueRow.eachCell((cell, n) => {
        if (n > metaItems.length) return;
        cell.font = { bold: true, color: { argb: PALETTE.black } };
        applyFill(cell, PALETTE.indigoSoft);
        applyBorder(cell);
      });
      sheet.addRow([]);
    };

    if (reportMode === "summary") {
      const sheet = wb.addWorksheet("Responses");
      writeMetaHeader(sheet);

      const hdr = sheet.addRow(activeSummaryCols.map((c) => c.label));
      activeSummaryCols.forEach((c, i) => {
        const col = sheet.getColumn(i + 1);
        col.width = Math.max(col.width || 0, c.width ?? 18);
      });
      hdr.height = 22;
      hdr.eachCell((cell, n) => {
        if (n > activeSummaryCols.length) return;
        cell.font = { bold: true, color: { argb: PALETTE.white } };
        applyFill(cell, PALETTE.indigoFill);
        applyBorder(cell);
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      });

      filteredResponses.forEach((r, idx) => {
        const row = sheet.addRow(
          activeSummaryCols.map((c) => c.value(r, { feedback, ratingScale }))
        );
        row.eachCell((cell, n) => {
          if (n > activeSummaryCols.length) return;
          applyBorder(cell);
          if (idx % 2 === 1) applyFill(cell, PALETTE.altRow);
          cell.alignment = { vertical: "top", wrapText: true };
        });
      });

      const lastDataRow = sheet.lastRow?.number ?? hdr.number;
      sheet.autoFilter = {
        from: { row: hdr.number, column: 1 },
        to: { row: lastDataRow, column: activeSummaryCols.length },
      };
      sheet.views = [{ state: "frozen", ySplit: hdr.number }];

      // Question stats sheet
      const qSheet = wb.addWorksheet("Question Stats");
      writeMetaHeader(qSheet);
      const qHdr = qSheet.addRow(activeDetailCols.map((c) => c.label));
      activeDetailCols.forEach((c, i) => {
        const col = qSheet.getColumn(i + 1);
        col.width = Math.max(col.width || 0, c.width ?? 14);
      });
      qHdr.eachCell((cell, n) => {
        if (n > activeDetailCols.length) return;
        cell.font = { bold: true, color: { argb: PALETTE.white } };
        applyFill(cell, PALETTE.indigoFill);
        applyBorder(cell);
      });
      questions.forEach((q, i) => {
        const row = qSheet.addRow(
          activeDetailCols.map((c) =>
            c.value(q, i, questionStats[i] || { avg: 0, answered: 0 })
          )
        );
        row.eachCell((cell, n) => {
          if (n > activeDetailCols.length) return;
          applyBorder(cell);
          if (i % 2 === 1) applyFill(cell, PALETTE.altRow);
        });
      });
      qSheet.autoFilter = {
        from: { row: qHdr.number, column: 1 },
        to: { row: qSheet.lastRow!.number, column: activeDetailCols.length },
      };
      qSheet.views = [{ state: "frozen", ySplit: qHdr.number }];
    } else if (useColumnMatrix) {
      // ── Detailed · Column matrix ─────────────────────────────────────
      // One sheet: category header row (merged spans) · question header
      // row · one data row per student. Excel filter auto-added on the
      // question-header row.
      const sheet = wb.addWorksheet("Response Matrix");
      const staticCols = ["#", "Student Name", "Email"];
      const questionCols = columnLayout.ordered;
      const overallCols = ["Overall Rating", "Overall Reason"];
      const totalCols = staticCols.length + questionCols.length + overallCols.length;
      for (let i = 0; i < totalCols; i++)
        sheet.getColumn(i + 1).width = i < staticCols.length ? 22 : 20;

      writeMetaHeader(sheet);

      // Row 1: Category grouping band.
      const catBand: any[] = ["", "", ""]; // static columns spacer
      columnLayout.groups.forEach((g) => {
        g.questions.forEach((_, qi) => {
          catBand.push(qi === 0 ? g.category || "Uncategorized" : "");
        });
      });
      catBand.push("", "");
      const bandRow = sheet.addRow(catBand);
      bandRow.height = 20;
      let cursor = staticCols.length + 1;
      columnLayout.groups.forEach((g) => {
        if (g.questions.length > 0) {
          sheet.mergeCells(bandRow.number, cursor, bandRow.number, cursor + g.questions.length - 1);
          const cell = bandRow.getCell(cursor);
          cell.font = { bold: true, color: { argb: PALETTE.white }, size: 11 };
          applyFill(cell, PALETTE.indigoFill);
          applyBorder(cell);
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cursor += g.questions.length;
        }
      });
      // Blank cells (static + overall columns) at the ends of the band row.
      [1, 2, 3].forEach((c) => {
        const cell = bandRow.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.indigoSoft } };
      });
      [totalCols - 1, totalCols].forEach((c) => {
        const cell = bandRow.getCell(c);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: PALETTE.indigoSoft } };
      });

      // Row 2: Column headers.
      const header = sheet.addRow([
        ...staticCols,
        ...questionCols.map((q) => q.questionText),
        ...overallCols,
      ]);
      header.height = 22;
      header.eachCell((cell, n) => {
        if (n > totalCols) return;
        cell.font = { bold: true, color: { argb: PALETTE.white } };
        applyFill(cell, PALETTE.indigoFill);
        applyBorder(cell);
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      });

      // Data rows.
      filteredResponses.forEach((r, idx) => {
        const row = [
          idx + 1,
          r.isAnonymous ? "Anonymous" : r.studentName || "",
          r.isAnonymous ? "" : r.studentEmail || "",
          ...questionCols.map((q) => answerFor(r, q)),
          typeof r.overallRating === "number" && r.overallRating > 0
            ? r.overallRating
            : "",
          stripHtml(r.overallReason || ""),
        ];
        const added = sheet.addRow(row);
        added.eachCell((cell, n) => {
          if (n > totalCols) return;
          applyBorder(cell);
          if (idx % 2 === 1) applyFill(cell, PALETTE.altRow);
          cell.alignment = { vertical: "top", wrapText: true };
        });
      });

      // Auto-filter on question-header row so admins can filter on any
      // question column immediately.
      const lastRow = sheet.lastRow?.number ?? header.number;
      sheet.autoFilter = {
        from: { row: header.number, column: 1 },
        to: { row: lastRow, column: totalCols },
      };
      // Freeze both header rows + the # and Student Name columns.
      sheet.views = [{ state: "frozen", xSplit: 3, ySplit: header.number }];
    } else {
      // Detailed: one sheet, per-response block layout.
      const sheet = wb.addWorksheet("Detailed Report");
      const span = Math.max(activeSummaryCols.length, 5);
      for (let i = 0; i < span; i++) sheet.getColumn(i + 1).width = 18;
      writeMetaHeader(sheet);

      const title = sheet.addRow([`Detailed Report — ${feedback.feedbackTitle}`]);
      sheet.mergeCells(title.number, 1, title.number, span);
      const tCell = title.getCell(1);
      tCell.font = { bold: true, size: 14, color: { argb: PALETTE.indigoFill } };
      title.height = 24;
      sheet.addRow([]);

      filteredResponses.forEach((r, i) => {
        const banner = sheet.addRow([
          `Response #${i + 1} — ${r.isAnonymous ? "Anonymous" : r.studentName || ""}`,
        ]);
        sheet.mergeCells(banner.number, 1, banner.number, span);
        const bCell = banner.getCell(1);
        bCell.font = { bold: true, color: { argb: PALETTE.white }, size: 12 };
        applyFill(bCell, PALETTE.lavender2);
        bCell.alignment = { vertical: "middle", horizontal: "left" };
        banner.height = 22;
        sheet.addRow([]);

        const sumHdr = sheet.addRow(activeSummaryCols.map((c) => c.label));
        sumHdr.eachCell((cell, n) => {
          if (n > activeSummaryCols.length) return;
          cell.font = { bold: true, color: { argb: PALETTE.white } };
          applyFill(cell, PALETTE.indigoFill);
          applyBorder(cell);
        });
        const sumRow = sheet.addRow(
          activeSummaryCols.map((c) => c.value(r, { feedback, ratingScale }))
        );
        sumRow.eachCell((cell, n) => {
          if (n > activeSummaryCols.length) return;
          cell.font = { bold: true, color: { argb: PALETTE.black } };
          applyFill(cell, PALETTE.indigoSoft);
          applyBorder(cell);
        });

        const groups = groupByCategory
          ? groupAnswersForResponse(r)
          : [{ category: null, rows: r.answers || [] }];

        groups.forEach((g) => {
          const sectionLbl = sheet.addRow([g.category || "All Answers"]);
          sheet.mergeCells(sectionLbl.number, 1, sectionLbl.number, span);
          const lCell = sectionLbl.getCell(1);
          lCell.font = { bold: true, color: { argb: PALETTE.indigoFill }, size: 11 };
          applyFill(lCell, PALETTE.lavender);
          sectionLbl.height = 20;

          const qHead = sheet.addRow(["#", "Question", "Type", "Answer", "Reason"]);
          qHead.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: PALETTE.black } };
            applyFill(cell, PALETTE.questionHdr);
            applyBorder(cell);
          });
          g.rows.forEach((a, j) => {
            const row = sheet.addRow([
              j + 1,
              a.questionText,
              a.questionType,
              a.questionType === "rating" ? a.answer : stripHtml(a.answer?.toString() || ""),
              stripHtml(a.reason || ""),
            ]);
            row.eachCell((cell, n) => {
              if (n > 5) return;
              applyBorder(cell);
              if (j % 2 === 1) applyFill(cell, PALETTE.altRow);
              cell.alignment = { vertical: "top", wrapText: true };
            });
          });
        });

        sheet.addRow([]);
      });
    }

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `${sanitiseFilename(feedback.feedbackTitle)}-${reportMode}.xlsx`
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  if (!open || !feedback) return null;

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Generate Feedback Report"
      // z above every other portal in the app: LDLayout's NotificationBell
      // popup lives at 100000 (see client/src/app/lms/component/NotificationBell.tsx),
      // and z-[2000] let it punch through this backdrop.
      className={`${poppins.className} fixed inset-0 z-[100010] bg-black/40 flex items-center justify-center`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-xl overflow-hidden flex flex-col"
        style={{ width: "92vw", height: "92vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div>
            <h2 className="text-[15px] font-bold text-gray-900">Generate Feedback Report</h2>
            <p className="text-[11px] text-gray-500">
              Customize, preview, and export feedback responses.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="relative inline-flex items-center gap-1.5 h-8 px-3.5 text-[12px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm ring-2 ring-indigo-200 hover:ring-indigo-300 transition-all"
            >
              <Filter size={13} />
              Filters & Options
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-indigo-700 bg-white rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 flex items-center justify-center rounded-md bg-rose-500 hover:bg-rose-600 text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto p-4">
          {/* Export bar */}
          <div className="border border-gray-200 rounded-lg p-3 bg-white mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[13px] font-semibold text-gray-900">Export</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportPrint}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
              >
                <Printer size={13} /> Print
              </button>
              <button
                type="button"
                onClick={exportExcel}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-white bg-emerald-600 hover:bg-emerald-700"
              >
                <FileText size={13} /> Excel
              </button>
              <button
                type="button"
                onClick={exportPdf}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-white bg-rose-600 hover:bg-rose-700"
              >
                <FileText size={13} /> PDF
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="border border-gray-200 rounded-lg bg-white">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <div className="text-[12.5px] font-semibold text-gray-700">Preview</div>
              <div className="text-[13px] font-bold text-indigo-600">
                {reportMode === "summary" ? "Response Summary" : "Detailed Responses"}
              </div>
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
              <>
                <div className="overflow-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-indigo-50/60 border-b border-gray-200">
                        {activeSummaryCols.map((c) => (
                          <th
                            key={c.key}
                            className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap"
                          >
                            {c.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((r, i) => (
                        <tr key={r._id || i} className="border-b border-gray-50 last:border-b-0">
                          {activeSummaryCols.map((c) => (
                            <td
                              key={c.key}
                              className="px-3 py-2 align-top text-gray-700"
                              title={String(c.value(r, { feedback, ratingScale }))}
                            >
                              <div className="max-w-[260px] truncate">
                                {String(c.value(r, { feedback, ratingScale })) || (
                                  <span className="text-gray-300">—</span>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      ))}
                      {pageRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={Math.max(1, activeSummaryCols.length)}
                            className="px-3 py-8 text-center text-gray-400 text-[12px]"
                          >
                            No responses match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 text-[12px] text-gray-600">
                  <div className="flex items-center gap-2">
                    <span>Rows per page:</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      className="border border-gray-200 rounded px-1.5 py-0.5"
                    >
                      {[10, 25, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                      disabled={safePage === 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span>
                      {safePage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                      disabled={safePage === totalPages}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            ) : useColumnMatrix ? (
              // ── Detailed · Column matrix ──────────────────────────────
              // One row per student, one column per question. Category
              // grouping is expressed by the top header row spanning its
              // question columns.
              <div className="p-3">
                {pageRows.length === 0 ? (
                  <div className="text-center text-[12px] text-gray-400 py-8">
                    No responses match the current filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-md">
                    <table className="w-full text-[11.5px] border-collapse">
                      <thead>
                        <tr className="bg-indigo-50/70 border-b border-gray-200">
                          <th
                            rowSpan={2}
                            className="sticky left-0 z-10 bg-indigo-50/70 px-2 py-1.5 text-left font-semibold text-gray-700 border-r border-gray-200"
                          >
                            #
                          </th>
                          <th
                            rowSpan={2}
                            className="sticky left-8 z-10 bg-indigo-50/70 px-2 py-1.5 text-left font-semibold text-gray-700 border-r border-gray-200"
                          >
                            Student
                          </th>
                          {columnLayout.groups.map((g) => (
                            <th
                              key={(g.category ?? "__ungrouped__") + "-cat"}
                              colSpan={g.questions.length}
                              className="px-2 py-1 text-center font-semibold text-indigo-800 border-r border-gray-200 text-[10px] uppercase tracking-wide"
                            >
                              {g.category || "Uncategorized"}
                            </th>
                          ))}
                          <th
                            rowSpan={2}
                            className="px-2 py-1.5 text-left font-semibold text-gray-700 border-l border-gray-200"
                          >
                            Overall
                          </th>
                        </tr>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {columnLayout.groups.map((g) =>
                            g.questions.map((q, qi) => (
                              <th
                                key={`${g.category ?? "u"}-${qi}`}
                                className="px-2 py-1 text-left font-medium text-gray-600 border-r border-gray-100 min-w-[120px] max-w-[220px] truncate"
                                title={q.questionText}
                              >
                                {q.questionText}
                              </th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((r, i) => {
                          const idxAbs = startIdx + i + 1;
                          return (
                            <tr
                              key={r._id || i}
                              className="border-b border-gray-100 hover:bg-gray-50/40"
                            >
                              <td className="sticky left-0 z-10 bg-white px-2 py-1.5 text-gray-500 border-r border-gray-100">
                                {idxAbs}
                              </td>
                              <td className="sticky left-8 z-10 bg-white px-2 py-1.5 text-gray-800 font-medium border-r border-gray-100 whitespace-nowrap">
                                <div className="truncate max-w-[180px]">
                                  {r.isAnonymous ? "Anonymous" : r.studentName || "—"}
                                </div>
                                {!r.isAnonymous && r.studentEmail && (
                                  <div className="text-[10px] text-gray-400 truncate max-w-[180px]">
                                    {r.studentEmail}
                                  </div>
                                )}
                              </td>
                              {columnLayout.ordered.map((q, qi) => {
                                const val = answerFor(r, q);
                                const isRating = q.questionType === "rating";
                                return (
                                  <td
                                    key={qi}
                                    className={`px-2 py-1.5 border-r border-gray-100 align-top max-w-[220px] ${
                                      isRating ? "text-center" : "text-left"
                                    }`}
                                    title={String(val || "")}
                                  >
                                    <div className="truncate">
                                      {val === "" ? (
                                        <span className="text-gray-300">—</span>
                                      ) : isRating ? (
                                        <span className="font-semibold text-indigo-700">
                                          {val}
                                        </span>
                                      ) : (
                                        String(val)
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="px-2 py-1.5 border-l border-gray-100 text-[11px] text-gray-600 max-w-[240px]">
                                {typeof r.overallRating === "number" &&
                                  r.overallRating > 0 && (
                                    <span className="inline-flex items-center gap-1 mr-1.5">
                                      <Star
                                        size={10}
                                        className="text-amber-500 fill-amber-500"
                                      />
                                      {r.overallRating}
                                    </span>
                                  )}
                                <span className="truncate inline-block max-w-[180px] align-middle">
                                  {stripHtml(r.overallReason || "") || (
                                    <span className="text-gray-300">—</span>
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* Pagination reused */}
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 text-[12px] text-gray-600">
                  <div className="flex items-center gap-2">
                    <span>Per page:</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      className="border border-gray-200 rounded px-1.5 py-0.5"
                    >
                      {[5, 10, 25].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                      disabled={safePage === 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span>
                      {safePage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                      disabled={safePage === totalPages}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Detailed preview — per-response cards on the current page
              <div className="p-3 space-y-3">
                {pageRows.length === 0 ? (
                  <div className="text-center text-[12px] text-gray-400 py-8">
                    No responses match the current filters.
                  </div>
                ) : (
                  pageRows.map((r, i) => {
                    const idxAbs = startIdx + i + 1;
                    const groups = groupByCategory
                      ? groupAnswersForResponse(r)
                      : [{ category: null, rows: r.answers || [] }];
                    return (
                      <div
                        key={r._id || i}
                        className="border border-gray-200 rounded-md p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-[12.5px] font-semibold text-gray-900">
                            #{idxAbs} · {r.isAnonymous ? "Anonymous" : r.studentName || "—"}
                            {!r.isAnonymous && r.studentEmail && (
                              <span className="text-gray-400 font-normal ml-1">
                                · {r.studentEmail}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {r.submittedAt
                              ? format(new Date(r.submittedAt), "d MMM yyyy")
                              : ""}
                            {typeof r.overallRating === "number" && r.overallRating > 0 && (
                              <span className="ml-2 inline-flex items-center gap-1">
                                <Star size={11} className="text-amber-500 fill-amber-500" />
                                {r.overallRating} / {ratingScale}
                              </span>
                            )}
                          </div>
                        </div>
                        {groups.map((g, gi) => (
                          <div key={gi} className={gi > 0 ? "mt-2" : ""}>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-700 mb-1">
                              {g.category || "All Answers"}
                            </div>
                            <table className="w-full text-[12px]">
                              <thead>
                                <tr className="bg-gray-50 text-gray-600">
                                  <th className="text-left px-2 py-1 font-medium">Question</th>
                                  <th className="text-left px-2 py-1 font-medium w-16">Type</th>
                                  <th className="text-left px-2 py-1 font-medium w-40">Answer</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.rows.map((a, j) => (
                                  <tr key={j} className="border-t border-gray-100">
                                    <td className="px-2 py-1 text-gray-700">{a.questionText}</td>
                                    <td className="px-2 py-1 text-gray-500 uppercase text-[10px]">
                                      {a.questionType}
                                    </td>
                                    <td className="px-2 py-1 text-gray-700">
                                      {a.questionType === "rating"
                                        ? String(a.answer)
                                        : stripHtml(a.answer?.toString() || "") ||
                                          <span className="text-gray-300">—</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                        {r.overallReason && stripHtml(r.overallReason) && (
                          <div className="mt-2 text-[12px] text-gray-700 border-l-2 border-indigo-300 pl-2">
                            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 mr-1">
                              Overall
                            </span>
                            {stripHtml(r.overallReason)}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {/* Pagination (detailed) */}
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[12px] text-gray-600">
                  <div className="flex items-center gap-2">
                    <span>Per page:</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => setRowsPerPage(Number(e.target.value))}
                      className="border border-gray-200 rounded px-1.5 py-0.5"
                    >
                      {[5, 10, 25].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                      disabled={safePage === 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span>
                      {safePage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                      disabled={safePage === totalPages}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters sub-modal — opens from the Filter button in the header */}
      {filtersOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
          className="fixed inset-0 z-[2010] bg-black/40 flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFiltersOpen(false);
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl flex flex-col"
            style={{ width: "min(680px, 92vw)", maxHeight: "88vh" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-indigo-600" />
                <h3 className="text-[14px] font-bold text-gray-900">Filters</h3>
                {activeFilterCount > 0 && (
                  <span className="text-[11px] text-gray-500">
                    ({activeFilterCount} active)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Close filters"
                  className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-auto p-4 space-y-3">
              {/* Two-column row: Report Options on the left, Page Layout on
                  the right. Wraps to a single column on narrow viewports. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[12.5px] font-semibold text-gray-900 mb-1.5">
                  Report Options
                </div>
                <label className="flex items-center gap-2 text-[12.5px] text-gray-700 cursor-pointer mb-1">
                  <input
                    type="radio"
                    name="reportMode"
                    value="summary"
                    checked={reportMode === "summary"}
                    onChange={() => setReportMode("summary")}
                    className="accent-indigo-600"
                  />
                  Summary Report
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-gray-700 cursor-pointer mb-1">
                  <input
                    type="radio"
                    name="reportMode"
                    value="detailed"
                    checked={reportMode === "detailed"}
                    onChange={() => setReportMode("detailed")}
                    className="accent-indigo-600"
                  />
                  Detailed Report
                </label>
                {categories.length > 0 && (
                  <label
                    className={`flex items-center gap-2 text-[12px] cursor-pointer mb-1 ml-6 ${
                      reportMode === "detailed" ? "text-gray-700" : "text-gray-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={groupByCategory}
                      onChange={() => setGroupByCategory((v) => !v)}
                      disabled={reportMode !== "detailed"}
                      className="accent-indigo-600"
                    />
                    Category-based <span className="text-gray-400">(group answers)</span>
                  </label>
                )}
                {/* Row / Column layout — only meaningful when detailed +
                    category-based is on. Hidden otherwise to keep the panel
                    quiet. */}
                {categories.length > 0 &&
                  reportMode === "detailed" &&
                  groupByCategory && (
                    <div className="ml-6 mt-1 flex items-center gap-3">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        Layout:
                      </span>
                      <label className="inline-flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="detailLayout"
                          value="row"
                          checked={detailLayout === "row"}
                          onChange={() => setDetailLayout("row")}
                          className="accent-indigo-600"
                        />
                        Row
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-[12px] text-gray-700 cursor-pointer">
                        <input
                          type="radio"
                          name="detailLayout"
                          value="column"
                          checked={detailLayout === "column"}
                          onChange={() => setDetailLayout("column")}
                          className="accent-indigo-600"
                        />
                        Column
                      </label>
                      <span className="text-[10px] text-gray-400">
                        {detailLayout === "row"
                          ? "one card per response"
                          : "one row per student, one column per question"}
                      </span>
                    </div>
                  )}
              </div>

              <div className="md:border-l md:border-gray-100 md:pl-4">
                <label className="block text-[12.5px] font-semibold text-gray-900 mb-1">
                  Page Layout (Print/PDF)
                </label>
                <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer mb-0.5">
                  <input
                    type="radio"
                    name="pageLayout"
                    checked={pageLayout === "flow"}
                    onChange={() => setPageLayout("flow")}
                    className="accent-indigo-600"
                  />
                  Flow as it is
                </label>
                <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer mb-0.5">
                  <input
                    type="radio"
                    name="pageLayout"
                    checked={pageLayout === "one"}
                    onChange={() => setPageLayout("one")}
                    className="accent-indigo-600"
                  />
                  One per page
                </label>
                <label className="flex items-center gap-2 text-[12px] text-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="pageLayout"
                    checked={pageLayout === "custom"}
                    onChange={() => setPageLayout("custom")}
                    className="accent-indigo-600"
                  />
                  Custom:
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={customPerPage}
                    onFocus={() => setPageLayout("custom")}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!Number.isNaN(n)) setCustomPerPage(Math.max(1, Math.min(50, n)));
                    }}
                    disabled={pageLayout !== "custom"}
                    className="w-14 border border-gray-200 rounded-md px-1.5 py-0.5 text-[12px] text-gray-700 bg-white outline-none focus:border-indigo-400 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                  <span className="text-gray-500 text-[11px]">/ page</span>
                </label>
              </div>
              </div>{/* /grid: Report Options + Page Layout */}

              {/* Column picker — only relevant for Summary. Detailed uses
                  its own layout (per-response cards in Row mode, per-question
                  matrix in Column mode), so the picker would be misleading. */}
              {reportMode === "summary" && (
                <div className="border-t border-gray-100 pt-3">
                  <div className="text-[12.5px] font-semibold text-gray-900 mb-1.5">
                    Select Columns to Include
                  </div>
                  <div className="text-[11.5px] font-medium text-gray-600 mb-1.5">
                    Response Columns
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 mb-3 max-h-40 overflow-auto pr-1">
                    {ALL_SUMMARY_COLUMNS.map((c) => {
                      const checked = selectedSummary.has(c.key);
                      return (
                        <label
                          key={c.key}
                          className={`flex items-center gap-2 px-2 py-1 rounded-md border text-[11.5px] cursor-pointer transition-colors ${
                            checked
                              ? "border-indigo-200 bg-indigo-50/60 text-gray-900"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColumn("summary", c.key)}
                            className="accent-indigo-600 flex-shrink-0"
                          />
                          <span className="truncate" title={c.label}>
                            {c.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="text-[11.5px] font-medium text-gray-600 mb-1.5">
                    Question Stats Columns
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {DETAIL_COLUMNS.map((c) => {
                      const checked = selectedDetail.has(c.key);
                      return (
                        <label
                          key={c.key}
                          className={`flex items-center gap-2 px-2 py-1 rounded-md border text-[11.5px] cursor-pointer transition-colors ${
                            checked
                              ? "border-indigo-200 bg-indigo-50/60 text-gray-900"
                              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleColumn("detail", c.key)}
                            className="accent-indigo-600 flex-shrink-0"
                          />
                          <span className="truncate">{c.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3">
                <label className="block text-[12.5px] font-semibold text-gray-900 mb-1">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                  className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400"
                >
                  <option value="all">All Responses</option>
                  <option value="identified">Identified only</option>
                  <option value="anonymous">Anonymous only</option>
                </select>
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-gray-900 mb-1">
                  Result
                </label>
                <select
                  value={resultFilter}
                  onChange={(e) => setResultFilter(e.target.value as ResultFilter)}
                  className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400"
                >
                  <option value="all">All Results</option>
                  <option value="positive">Positive (≥ 70% of scale)</option>
                  <option value="negative">Negative (&lt; 70% of scale)</option>
                </select>
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-gray-900 mb-1">
                  Search
                </label>
                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Name, email or answer…"
                    className="w-full border border-gray-200 rounded-md pl-7 pr-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-gray-900 mb-1">
                  Rating range
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={ratingScale}
                    step={0.1}
                    value={ratingFrom}
                    onChange={(e) => setRatingFrom(e.target.value)}
                    placeholder="From"
                    className="border border-gray-200 rounded-md px-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400 w-full"
                  />
                  <span className="text-[12px] text-gray-400">to</span>
                  <input
                    type="number"
                    min={1}
                    max={ratingScale}
                    step={0.1}
                    value={ratingTo}
                    onChange={(e) => setRatingTo(e.target.value)}
                    placeholder="To"
                    className="border border-gray-200 rounded-md px-2 py-1.5 text-[12.5px] text-gray-700 bg-white outline-none focus:border-indigo-400 w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12.5px] font-semibold text-gray-900 mb-1">
                  Date
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="border border-gray-200 rounded-md px-2 py-1 text-[12px] text-gray-700 bg-white outline-none focus:border-indigo-400 w-full"
                  />
                  <span className="text-[12px] text-gray-400">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="border border-gray-200 rounded-md px-2 py-1 text-[12px] text-gray-700 bg-white outline-none focus:border-indigo-400 w-full"
                  />
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <label className="block text-[12.5px] font-semibold text-gray-900 mb-1">
                    Categories
                  </label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-auto pr-1">
                    {categories.map((c) => {
                      const active = categoryFilter.has(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleCategory(c)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                            active
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 flex-shrink-0">
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="px-4 py-1.5 text-[12px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render via portal so the modal escapes any restrictive overflow parents.
  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}
