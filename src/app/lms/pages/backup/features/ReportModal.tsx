"use client";

// Backup history report — pick the columns, then pick the format.
//
// Two steps in one dialog rather than two dialogs: the format is a decision
// about the SAME selection, and stacking a second modal over the first hides
// the columns you are exporting at the moment you confirm.
//
// The rows exported are the ones the report fetches for itself, NOT the page
// the table happens to be showing. "Report" that silently means "page 3 of the
// table" is the kind of thing nobody notices until the numbers are wrong.

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  Table2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/app/lms/shared/ui";
import { showErrorToast, showSuccessToast } from "@/components/ui/toastUtils";
import { cn } from "@/lib/utils";
import type { BackupRecord } from "@/app/lms/pages/backup/api/backup";
import { fetchBackupList } from "@/app/lms/pages/backup/api/backup";
import { formatBytes, formatCount, formatDateTime, scopeLabel } from "./ui";

/** Every column the history table can report on. `key` is stable; `label` is UI. */
interface ReportColumn {
  key: string;
  label: string;
  value: (record: BackupRecord) => string;
  /** Right-aligned in the exports; numbers read wrong when left-aligned. */
  numeric?: boolean;
}

const COLUMNS: ReportColumn[] = [
  { key: "createdAt", label: "Created", value: (r) => formatDateTime(r.createdAt) },
  { key: "scope", label: "Scope", value: (r) => scopeLabel(r.scope) },
  { key: "targetName", label: "Target", value: (r) => r.targetName || "—" },
  {
    key: "destination",
    label: "Destination",
    value: (r) => (r.destination === "local" ? "Local file" : "Backup database"),
  },
  {
    key: "targetDatabase",
    label: "Backup database",
    value: (r) => r.targetDatabase || "—",
  },
  {
    key: "totalDocuments",
    label: "Documents",
    value: (r) => formatCount(r.totalDocuments),
    numeric: true,
  },
  {
    key: "sizeBytes",
    label: "Size",
    value: (r) => (r.destination === "local" ? formatBytes(r.sizeBytes) : "—"),
    numeric: true,
  },
  {
    key: "collections",
    label: "Collections",
    value: (r) => formatCount(r.collections?.length ?? 0),
    numeric: true,
  },
  { key: "status", label: "Status", value: (r) => r.status },
  {
    key: "createdByName",
    label: "Created by",
    value: (r) => r.createdByName || r.createdByEmail || "—",
  },
  { key: "note", label: "Note", value: (r) => r.note || "—" },
  { key: "error", label: "Error", value: (r) => r.error || "—" },
];

const DEFAULT_KEYS = [
  "createdAt",
  "scope",
  "targetName",
  "destination",
  "totalDocuments",
  "sizeBytes",
  "status",
  "createdByName",
];

/** One page big enough to cover any realistic history without paging. */
const REPORT_LIMIT = 500;

const stamp = () => new Date().toISOString().slice(0, 10);

const errorText = (error: unknown, fallback: string): string => {
  const message = (error as Error | null)?.message;
  return message && message.trim() ? message : fallback;
};

type Format = "pdf" | "excel" | "print";

export interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown in the header so the export is clearly the whole history. */
  totalKnown?: number;
}

export default function ReportModal({ open, onClose, totalKnown }: ReportModalProps) {
  const [step, setStep] = React.useState<"columns" | "format">("columns");
  const [selected, setSelected] = React.useState<string[]>(DEFAULT_KEYS);
  const [rows, setRows] = React.useState<BackupRecord[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<Format | null>(null);

  // Fetch the FULL history when the dialog opens — see the file header.
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStep("columns");
    setRows(null);
    setLoadError(null);
    setLoading(true);
    fetchBackupList(1, REPORT_LIMIT)
      .then((page) => {
        if (!cancelled) setRows(page.items);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(errorText(error, "Could not load backup history"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const columns = React.useMemo(
    // Ordered by COLUMNS, not by click order, so the export always reads the
    // same way as the table regardless of the order boxes were ticked.
    () => COLUMNS.filter((column) => selected.includes(column.key)),
    [selected]
  );

  const toggle = (key: string) =>
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );

  const allSelected = selected.length === COLUMNS.length;
  const canContinue = selected.length > 0 && !!rows && rows.length > 0;

  const matrix = React.useMemo(() => {
    if (!rows) return [];
    return rows.map((record) => columns.map((column) => column.value(record)));
  }, [rows, columns]);

  /* ── Exports ───────────────────────────────────────────────────────────── */

  const exportPdf = async () => {
    setBusy("pdf");
    try {
      const { default: JsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      // Landscape: the history is wide, and a portrait page squeezes eight
      // columns into unreadable slivers.
      const doc = new JsPDF({ orientation: "landscape" });
      doc.setFontSize(14);
      doc.text("Backup history", 14, 15);
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text(
        `${formatCount(rows?.length ?? 0)} backup${
          rows?.length === 1 ? "" : "s"
        } · generated ${formatDateTime(new Date().toISOString())}`,
        14,
        21
      );

      autoTable(doc, {
        head: [columns.map((column) => column.label)],
        body: matrix,
        startY: 26,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 246, 250] },
        columnStyles: Object.fromEntries(
          columns.map((column, index) => [
            index,
            { halign: column.numeric ? "right" : "left" },
          ])
        ),
      });

      doc.save(`backup-history-${stamp()}.pdf`);
      showSuccessToast("PDF downloaded");
      onClose();
    } catch (error) {
      showErrorToast(errorText(error, "Could not generate the PDF"));
    } finally {
      setBusy(null);
    }
  };

  const exportExcel = async () => {
    setBusy("excel");
    try {
      const ExcelJS = (await import("exceljs")).default;
      // file-saver's export shape differs between CJS/ESM interop here —
      // destructuring `{ saveAs }` alone yields undefined and every export
      // throws "saveAs is not a function". Same shim LogsPage uses.
      const fileSaverMod: {
        saveAs?: (blob: Blob, name: string) => void;
        default?: { saveAs?: (blob: Blob, name: string) => void } | ((blob: Blob, name: string) => void);
      } = await import("file-saver");
      const saveAs =
        fileSaverMod.saveAs ||
        (typeof fileSaverMod.default === "function"
          ? fileSaverMod.default
          : fileSaverMod.default?.saveAs);
      if (!saveAs) throw new Error("Could not load the file saver");

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Backup history");

      sheet.columns = columns.map((column) => ({
        header: column.label,
        key: column.key,
        width: Math.max(14, Math.min(42, column.label.length + 10)),
      }));
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F46E5" },
      };
      sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

      matrix.forEach((row) => sheet.addRow(row));
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `backup-history-${stamp()}.xlsx`);
      showSuccessToast("Excel file downloaded");
      onClose();
    } catch (error) {
      showErrorToast(errorText(error, "Could not generate the Excel file"));
    } finally {
      setBusy(null);
    }
  };

  const printReport = () => {
    setBusy("print");
    try {
      // A hidden same-origin iframe rather than window.open: popup blockers
      // silently swallow the new window, and the user is left thinking Print
      // is broken.
      const frame = document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      document.body.appendChild(frame);

      const escapeHtml = (value: string) =>
        value.replace(/[&<>"']/g, (character) =>
          character === "&"
            ? "&amp;"
            : character === "<"
              ? "&lt;"
              : character === ">"
                ? "&gt;"
                : character === '"'
                  ? "&quot;"
                  : "&#39;"
        );

      const head = columns.map((c) => `<th>${escapeHtml(c.label)}</th>`).join("");
      const body = matrix
        .map(
          (row) =>
            `<tr>${row
              .map(
                (cell, index) =>
                  `<td class="${columns[index].numeric ? "num" : ""}">${escapeHtml(
                    cell
                  )}</td>`
              )
              .join("")}</tr>`
        )
        .join("");

      const html = `<!doctype html><html><head><title>Backup history</title>
<style>
  *{box-sizing:border-box}
  body{font:12px -apple-system,Segoe UI,Roboto,sans-serif;color:#111827;margin:24px}
  h1{font-size:18px;margin:0 0 4px}
  p.meta{margin:0 0 16px;color:#6b7280;font-size:11px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left;font-size:11px}
  th{background:#4f46e5;color:#fff}
  tr:nth-child(even) td{background:#f9fafb}
  td.num{text-align:right;font-variant-numeric:tabular-nums}
  @page{size:landscape;margin:12mm}
</style></head><body>
<h1>Backup history</h1>
<p class="meta">${formatCount(rows?.length ?? 0)} backup${
        rows?.length === 1 ? "" : "s"
      } &middot; generated ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
</body></html>`;

      const doc = frame.contentWindow?.document;
      if (!doc) throw new Error("Could not open the print view");
      doc.open();
      doc.write(html);
      doc.close();

      const cleanup = () => {
        // Removed on a timer, not immediately: pulling the iframe out of the
        // DOM synchronously cancels the print dialog in Chrome.
        setTimeout(() => frame.remove(), 1000);
      };
      frame.contentWindow?.addEventListener("afterprint", cleanup);
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(cleanup, 60_000);
      onClose();
    } catch (error) {
      showErrorToast(errorText(error, "Could not open the print view"));
    } finally {
      setBusy(null);
    }
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  const rowCount = rows?.length ?? 0;
  const truncated = rowCount >= REPORT_LIMIT;

  const columnsStep = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-subtle">
          {loading
            ? "Loading backup history…"
            : `${formatCount(rowCount)} backup${rowCount === 1 ? "" : "s"} will be included.`}
        </p>
        <button
          type="button"
          onClick={() => setSelected(allSelected ? [] : COLUMNS.map((c) => c.key))}
          className="text-xs font-medium text-accent-600 hover:underline"
        >
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>

      {loadError ? (
        <p className="flex items-center gap-1.5 rounded-tile border border-danger-500/25 bg-danger-50 px-3 py-2.5 text-xs text-danger-700">
          <AlertTriangle className="size-3.5 shrink-0" />
          {loadError}
        </p>
      ) : null}

      {truncated ? (
        <p className="rounded-tile border border-warn-500/25 bg-warn-50 px-3 py-2 text-[11px] text-warn-700">
          Showing the most recent {REPORT_LIMIT} backups — older rows are not in
          this report.
        </p>
      ) : null}

      <div className="grid gap-1.5 sm:grid-cols-2">
        {COLUMNS.map((column) => {
          const isOn = selected.includes(column.key);
          return (
            <button
              key={column.key}
              type="button"
              role="checkbox"
              aria-checked={isOn}
              onClick={() => toggle(column.key)}
              className={cn(
                "flex items-center gap-2.5 rounded-tile border px-3 py-2 text-left transition-colors",
                isOn
                  ? "border-accent-500 bg-accent-50"
                  : "border-hairline-strong bg-surface hover:border-line-hover"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                  isOn ? "border-accent-600 bg-accent-600 text-white" : "border-line-muted"
                )}
              >
                {isOn ? <Check className="size-3" /> : null}
              </span>
              <span className="text-sm text-heading">{column.label}</span>
            </button>
          );
        })}
      </div>

      {selected.length === 0 ? (
        <p className="text-[11px] text-danger-700">Select at least one column.</p>
      ) : null}
    </div>
  );

  const FORMATS: {
    value: Format;
    label: string;
    detail: string;
    icon: typeof FileText;
    run: () => void;
  }[] = [
    {
      value: "pdf",
      label: "PDF",
      detail: "Landscape document, ready to share",
      icon: FileText,
      run: exportPdf,
    },
    {
      value: "excel",
      label: "Excel",
      detail: "Filterable .xlsx spreadsheet",
      icon: FileSpreadsheet,
      run: exportExcel,
    },
    {
      value: "print",
      label: "Print",
      detail: "Opens your printer dialog",
      icon: Printer,
      run: printReport,
    },
  ];

  const formatStep = (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-subtle">
        {formatCount(rowCount)} backup{rowCount === 1 ? "" : "s"} ·{" "}
        {selected.length} column{selected.length === 1 ? "" : "s"}
      </p>

      <div className="grid gap-2 sm:grid-cols-3">
        {FORMATS.map((item) => (
          <button
            key={item.value}
            type="button"
            disabled={busy !== null}
            onClick={item.run}
            className={cn(
              "flex flex-col items-center gap-2 rounded-tile border border-hairline-strong bg-surface px-3 py-4 text-center transition-colors",
              "hover:border-accent-500 hover:bg-accent-50",
              busy !== null && "cursor-not-allowed opacity-60"
            )}
          >
            <span
              aria-hidden
              className="flex size-10 items-center justify-center rounded-tile bg-accent-50 text-accent-600"
            >
              {busy === item.value ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <item.icon className="size-5" />
              )}
            </span>
            <span>
              <span className="block text-sm font-medium text-heading">
                {item.label}
              </span>
              <span className="block text-[11px] leading-snug text-subtle">
                {item.detail}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* A small preview so the chosen columns are visible at the moment the
          format is picked. */}
      <div className="overflow-hidden rounded-tile border border-hairline">
        <div className="max-h-40 overflow-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="whitespace-nowrap border-b border-hairline bg-canvas px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-subtle"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.slice(0, 5).map((row, index) => (
                <tr key={index} className="border-b border-hairline last:border-b-0">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "max-w-40 truncate px-2 py-1.5 text-body",
                        columns[cellIndex].numeric && "text-right tabular-nums"
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rowCount > 5 ? (
          <p className="border-t border-hairline px-2 py-1.5 text-[11px] text-subtle">
            Preview of the first 5 rows — the export contains all{" "}
            {formatCount(rowCount)}.
          </p>
        ) : null}
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      hideClose={busy !== null}
      size="lg"
      title={step === "columns" ? "Backup history report" : "Choose a format"}
      description={
        step === "columns"
          ? `Choose the columns to include${
              totalKnown ? ` · ${formatCount(totalKnown)} backups on record` : ""
            }.`
          : undefined
      }
      footer={
        step === "columns" ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep("format")}
              disabled={!canContinue || loading}
              className="bg-accent-600 text-white hover:bg-accent-700"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <Table2 className="size-4" />
                  Report
                </>
              )}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            onClick={() => setStep("columns")}
            disabled={busy !== null}
          >
            <ArrowLeft className="size-4" />
            Back to columns
          </Button>
        )
      }
    >
      {step === "columns" ? columnsStep : formatStep}
    </Modal>
  );
}
