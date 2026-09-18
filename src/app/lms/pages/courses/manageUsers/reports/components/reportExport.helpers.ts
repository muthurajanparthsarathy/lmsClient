// Formatters, badge palettes and small constants for the Report Export modal.
//
// Split out of ReportExportModal.tsx. Deliberately free of JSX so the
// exporters (print / PDF / Excel) can import the same formatters the preview
// uses without pulling React rendering in — a value in the .xlsx and the value
// on screen come out of one function, so they cannot disagree.

import type { ExportStatusFilter } from "./reportExport.types";

// Status badge palette reused from ReportRow so the preview matches.
export const STATUS_BADGE = {
  "not-started": { label: "Not Started", cls: "bg-gray-100  text-gray-600" },
  "started":     { label: "Started",     cls: "bg-amber-50  text-amber-700" },
  "submitted":   { label: "Submitted",   cls: "bg-green-50  text-green-700" },
} as const;

export const QUESTION_STATUS_META = {
  evaluated:    { label: "Evaluated",    cls: "bg-emerald-50 text-emerald-700" },
  submitted:    { label: "Submitted",    cls: "bg-green-50   text-green-700" },
  not_answered: { label: "Not Answered", cls: "bg-rose-50    text-rose-600" },
  pending:      { label: "Pending",      cls: "bg-gray-100   text-gray-500" },
} as const;

export const fmtTime = (secs: number): string => {
  if (!Number.isFinite(secs) || secs <= 0) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

export const fmtDate = (iso: string | null): string => {
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

export const STATUS_FILTER_OPTIONS: { value: ExportStatusFilter; label: string }[] = [
  { value: "all",         label: "All Statuses"  },
  { value: "not-started", label: "Not Started"   },
  { value: "started",     label: "Started"       },
  { value: "submitted",   label: "Submitted"     },
];

export const PAGE_SIZES = [10, 25, 50];

/** Pass mark for the Result filter, in percent. */
export const PASS_THRESHOLD = 50;

// Default file-name stem for downloaded artefacts. Sanitised so it doesn't
// produce weird Windows file names.
export const sanitiseFilename = (s: string) =>
  s.replace(/[\/\\:*?"<>|]/g, "").trim().slice(0, 60) || "report";
