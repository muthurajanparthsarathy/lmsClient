"use client";
// Report Export modal — shell only.
//
// This file was ~1,580 lines. It is now the frame: header, body composition,
// footer/pagination, portal. Everything else lives beside it in this folder:
//
//   reportExport.types.ts        shared types + the ExportContext contract
//   reportExport.helpers.ts      formatters, badge palettes, small constants
//   reportExport.columns.tsx     SUMMARY_COLUMNS / DETAIL_COLUMNS registries
//   useReportExportState.ts      all state + derived rows (one `filteredRows`)
//   reportExport.print.ts        Print exporter (hidden-iframe printing)
//   reportExport.pdf.ts          PDF exporter (jsPDF + autoTable)
//   reportExport.excel.ts        Excel exporter (exceljs)
//   ReportExportControls.tsx     column picker / report options / export buttons
//   ReportExportPreview.tsx      the preview panel
//
// The split is by seam, not by line count: the three exporters read a single
// `ExportContext` and nothing else, which is what guarantees a downloaded file
// matches the preview — they cannot read a differently-filtered row set.

import React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { PAGE_SIZES } from "./reportExport.helpers";
import type { ExportContext, ReportExportModalProps } from "./reportExport.types";
import { useReportExportState } from "./useReportExportState";
import ReportExportControls from "./ReportExportControls";
import ReportExportPreview from "./ReportExportPreview";
import { runPrintExport } from "./reportExport.print";
import { runPdfExport } from "./reportExport.pdf";
import { runExcelExport } from "./reportExport.excel";

export default function ReportExportModal(props: ReportExportModalProps) {
  const { open, onClose, assessmentName } = props;
  const state = useReportExportState(props);

  const {
    reportMode, statusFilter, metaItems, filteredRows,
    activeSummaryCols, activeDetailCols, sectionMode,
    pageLayout, customStudentsPerPage,
    buildAllBreakdowns, groupBreakdownBySection,
    setPage, rowsPerPage, setRowsPerPage,
    totalPages, safePage, startIdx,
  } = state;

  // The exporters' entire world. Built fresh on each render so a click always
  // exports the CURRENT selection — and assembled once here so Print, PDF and
  // Excel are guaranteed to be looking at the same thing.
  const exportCtx: ExportContext = {
    reportMode, assessmentName, metaItems, filteredRows,
    activeSummaryCols, activeDetailCols, sectionMode,
    pageLayout, customStudentsPerPage,
    buildAllBreakdowns, groupBreakdownBySection,
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
          <ReportExportControls
            state={state}
            onPrint={() => runPrintExport(exportCtx)}
            onExcel={() => { void runExcelExport(exportCtx); }}
            onPdf={() => runPdfExport(exportCtx)}
          />

          {/* ── Preview ── */}
          <ReportExportPreview state={state} />
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
