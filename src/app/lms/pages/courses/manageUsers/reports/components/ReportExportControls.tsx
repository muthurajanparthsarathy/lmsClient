// The top control row of the Report Export modal: column picker, report
// options (mode / section / filters / page layout) and the export buttons.
//
// Split out of ReportExportModal.tsx. Purely presentational — every value and
// setter comes from `useReportExportState`, so this file holds markup and
// nothing else.

import React from "react";
import { FileText, Printer } from "lucide-react";
import { SUMMARY_COLUMNS, DETAIL_COLUMNS } from "./reportExport.columns";
import { PASS_THRESHOLD, STATUS_FILTER_OPTIONS } from "./reportExport.helpers";
import type { ExportStatusFilter, PassFailFilter } from "./reportExport.types";
import type { ReportExportState } from "./useReportExportState";

interface Props {
  state: ReportExportState;
  onPrint: () => void;
  onExcel: () => void;
  onPdf: () => void;
}

export default function ReportExportControls({ state, onPrint, onExcel, onPdf }: Props) {
  const {
    reportMode, setReportMode,
    selectedSummary, selectedDetail, toggleColumn,
    statusFilter, setStatusFilter,
    searchQuery, setSearchQuery,
    scaleFromPct, setScaleFromPct,
    scaleToPct, setScaleToPct,
    passFailFilter, setPassFailFilter,
    isSectionBased, groupBySection, setGroupBySection,
    pageLayout, setPageLayout,
    customStudentsPerPage, setCustomStudentsPerPage,
  } = state;

  return (
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
            onChange={e => setPassFailFilter(e.target.value as PassFailFilter)}
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
          <button type="button" onClick={onPrint} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50">
            <Printer size={14} /> Print
          </button>
          <button type="button" onClick={onExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-white bg-blue-600 hover:bg-blue-700">
            <FileText size={14} /> Excel
          </button>
          <button type="button" onClick={onPdf} className="flex items-center gap-1.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-white bg-rose-600 hover:bg-rose-700">
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>
    </div>
  );
}
