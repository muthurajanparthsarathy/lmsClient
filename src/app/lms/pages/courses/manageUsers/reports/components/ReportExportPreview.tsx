// The preview panel of the Report Export modal — the meta strip plus either
// the flat summary table or one card per student in Detailed mode.
//
// Split out of ReportExportModal.tsx. Renders the CURRENT PAGE only
// (`pageRows`); the exporters write `filteredRows` in full.

import React from "react";
import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";
import type { ReportExportState } from "./useReportExportState";

export default function ReportExportPreview({ state }: { state: ReportExportState }) {
  const {
    reportMode, statusFilter, metaItems,
    activeSummaryCols, activeDetailCols,
    pageRows, visibleBreakdowns,
    sectionMode, groupBreakdownBySection,
  } = state;

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

  const emptyText = statusFilter === "all" ? "No students to display." : "No students match this status filter.";

  return (
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
                    {emptyText}
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
            <div className="text-center text-gray-400 text-[12.5px] py-8">{emptyText}</div>
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
  );
}
