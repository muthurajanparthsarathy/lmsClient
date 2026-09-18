// Print exporter for the Report Export modal.
//
// Split out of ReportExportModal.tsx. Reads only its `ExportContext`, so what
// it prints is exactly the filtered row set the preview shows.

import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";
import type { ExportContext } from "./reportExport.types";

export const buildPrintableHtml = (ctx: ExportContext, title: string) => {
  const {
    reportMode, assessmentName, metaItems, filteredRows,
    activeSummaryCols, activeDetailCols, sectionMode,
    pageLayout, customStudentsPerPage,
    buildAllBreakdowns, groupBreakdownBySection,
  } = ctx;

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

// ─── Print: render the report into a hidden iframe and call its
// `contentWindow.print()`. Iframes don't get blocked the way popup
// windows do (no `window.open`), which fixes the "nothing happens" case
// the user reported. The iframe is removed after the dialog dismisses.
// ─────────────────────────────────────────────────────────────────────
export const runPrintExport = (ctx: ExportContext) => {
  // Build a hidden iframe, write the printable HTML into it, then call
  // print on the iframe itself. This sidesteps popup blockers (the
  // previous `window.open` approach was getting blocked silently in some
  // setups) and the print dialog opens reliably.
  const title = ctx.reportMode === "summary" ? "Summary Report" : "Detailed Report";
  const html = buildPrintableHtml(ctx, title);

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
