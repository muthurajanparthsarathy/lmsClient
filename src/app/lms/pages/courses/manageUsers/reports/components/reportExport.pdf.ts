// PDF exporter for the Report Export modal.
//
// Split out of ReportExportModal.tsx. Reads only its `ExportContext`, so the
// file it writes is exactly the filtered row set the preview shows.

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";
import type { ExportContext } from "./reportExport.types";
import { sanitiseFilename } from "./reportExport.helpers";

// ─── PDF: generate a real .pdf file with jsPDF + autoTable, then trigger
// a browser download. No print dialog. No popup blocker concerns.
// Output styling intentionally mirrors the on-screen preview so the file
// looks like what the user sees in the modal.
// ─────────────────────────────────────────────────────────────────────
export const runPdfExport = (ctx: ExportContext) => {
  const {
    reportMode, assessmentName, metaItems, filteredRows,
    activeSummaryCols, activeDetailCols, sectionMode,
    pageLayout, customStudentsPerPage,
    buildAllBreakdowns, groupBreakdownBySection,
  } = ctx;

  const orientation = activeSummaryCols.length > 6 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 32;

  // ── Title block ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(17, 17, 17);
  doc.text(assessmentName || "Assessment", margin, margin + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(
    `${reportMode === "summary" ? "Summary Report" : "Detailed Report"} · Generated ${new Date().toLocaleString("en-GB")}`,
    margin,
    margin + 26,
  );

  // ── Meta header strip (Course / Module / Topic / Test / Total Marks) ──
  // Rendered as a two-row autoTable so it inherits clean borders + colors.
  // The cursor for the next block advances based on this table's finalY.
  let nextY = margin + 40;
  if (metaItems.length > 0) {
    autoTable(doc, {
      startY: nextY,
      margin: { left: margin, right: margin },
      head: [metaItems.map(m => m.label)],
      body: [metaItems.map(m => m.value)],
      styles: { fontSize: 8.5, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
      bodyStyles: { fillColor: [238, 242, 255], fontStyle: "bold", textColor: [17, 17, 17] },
      theme: "grid",
    });
    nextY = (doc as any).lastAutoTable.finalY + 14;
  }

  if (reportMode === "summary") {
    // ── Single summary table ──
    autoTable(doc, {
      startY: nextY,
      margin: { left: margin, right: margin },
      head: [activeSummaryCols.map(c => c.label)],
      body: filteredRows.map(r => activeSummaryCols.map(c => String(c.value(r) ?? ""))),
      styles: { fontSize: 9, cellPadding: 6, lineColor: [229, 231, 235], lineWidth: 0.5 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      theme: "grid",
    });
  } else {
    // ── One section per student ──
    const all = buildAllBreakdowns();
    // Start from `nextY` so the meta strip (drawn above) is honoured.
    let cursorY = nextY;

    const ensureSpace = (needed: number) => {
      if (cursorY + needed > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
    };

    // ── Page layout policy ──
    // `pageLayout` controls how forced page breaks happen between students.
    // Resolved once per export so the math (custom N) stays consistent
    // even if the user clicks again mid-render (they can't, but it's a
    // clean separation regardless).
    const studentsPerForcedPage = pageLayout === "one"
      ? 1
      : pageLayout === "custom"
        ? Math.max(1, customStudentsPerPage)
        : Infinity; // "flow" → never force

    let renderedSinceBreak = 0;
    for (const r of filteredRows) {
      // Force a page break BEFORE the next student if the policy says so.
      // Skip the very first student — that page is already open.
      if (renderedSinceBreak >= studentsPerForcedPage) {
        doc.addPage();
        cursorY = margin;
        renderedSinceBreak = 0;
      }
      ensureSpace(40);
      // Student heading.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(17, 17, 17);
      doc.text(`Student #${r.index + 1} — ${r.student.studentName || ""}`, margin, cursorY + 12);
      cursorY += 20;

      // Summary as a single inline text strip — matches the on-screen UI
      // (`Label: Value | Label: Value | …`). The previous 2-column key/
      // value table version produced a tall, narrow block that wasted a lot
      // of page space; this version reads as one wrapping paragraph and
      // gives the question table below more room.
      const summaryParts = activeSummaryCols.map(c => `${c.label}: ${String(c.value(r) ?? "—")}`);
      const summaryLine = summaryParts.join("   |   "); // wider gap around the pipe so it doesn't blur into adjacent text
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      const maxWidth = pageWidth - 2 * margin;
      // `splitTextToSize` returns the lines after wrapping at the page width.
      const lines = doc.splitTextToSize(summaryLine, maxWidth) as string[];
      const lineHeight = 12;
      // Page-break if the wrapped text won't fit on the current page.
      ensureSpace(lineHeight * lines.length + 6);
      // `doc.text` accepts an array → one line per element. The y here is
      // the baseline of the FIRST line; subsequent lines advance by
      // `lineHeight` automatically.
      doc.text(lines, margin, cursorY + lineHeight - 3);
      cursorY += lineHeight * lines.length + 8;

      // Per-question table(s). One labelled table per section when in
      // section mode, otherwise a single flat table.
      if (activeDetailCols.length > 0) {
        const breakdown = all.get(r.student.id) ?? [];

        const drawDetailTable = (label: string, rows: QuestionBreakdownRow[]) => {
          ensureSpace(80);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(79, 70, 229);
          doc.text(label, margin, cursorY);
          cursorY += 8;
          autoTable(doc, {
            startY: cursorY + 4,
            margin: { left: margin, right: margin },
            head: [activeDetailCols.map(c => c.label)],
            body: rows.length > 0
              ? rows.map(q => activeDetailCols.map(c => String(c.value(q) ?? "")))
              : [["No questions recorded for this student.", ...Array(activeDetailCols.length - 1).fill("")]],
            styles: { fontSize: 8, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5 },
            headStyles: { fillColor: [238, 242, 255], textColor: [55, 65, 81], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            theme: "grid",
          });
          cursorY = (doc as any).lastAutoTable.finalY + 22;
        };

        if (sectionMode) {
          const groups = groupBreakdownBySection(breakdown);
          if (groups.length === 0) drawDetailTable("Question-by-Question Details", []);
          else groups.forEach(g => drawDetailTable(g.name, g.rows));
        } else {
          drawDetailTable("Question-by-Question Details", breakdown);
        }
      }
      renderedSinceBreak += 1;
    }
  }

  // Page numbers in the footer (every page, after the entire body has
  // been laid out so `getNumberOfPages` is accurate).
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 16, { align: "right" });
  }

  doc.save(`${sanitiseFilename(assessmentName || "report")}-${reportMode}.pdf`);
};
