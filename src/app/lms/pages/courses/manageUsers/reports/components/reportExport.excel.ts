// Excel exporter for the Report Export modal.
//
// Split out of ReportExportModal.tsx. Reads only its `ExportContext`, so the
// workbook it writes is exactly the filtered row set the preview shows.

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import type { QuestionBreakdownRow } from "../utils/computeStudentMarks";
import type { ExportContext } from "./reportExport.types";
import { sanitiseFilename } from "./reportExport.helpers";

export const runExcelExport = async (ctx: ExportContext) => {
  const {
    reportMode, assessmentName, metaItems, filteredRows,
    activeSummaryCols, activeDetailCols, sectionMode,
    buildAllBreakdowns, groupBreakdownBySection,
  } = ctx;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Live Dashboard";
  workbook.created = new Date();

  // ── Palette ── one set of ARGB colours reused everywhere so the file
  // reads as visually coordinated, not just "Excel with borders". ARGB
  // is the format exceljs wants (alpha first, then RGB hex).
  const PALETTE = {
    indigoFill:  "FF4F46E5",  // strong indigo — summary header band
    indigoSoft:  "FFEEF2FF",  // light indigo — summary data row tint
    lavender:    "FFE9E3FB",  // section label background
    lavender2:   "FFC4B5FD",  // strong banner for "Student #N"
    questionHdr: "FFEEF7FF",  // question table header band
    altRow:      "FFF9FAFB",  // alternating question row
    border:      "FFE5E7EB",  // thin grey border
    grey:        "FF6B7280",  // muted label text
    white:       "FFFFFFFF",
    black:       "FF111111",
  };
  const THIN_BORDER = {
    top:    { style: "thin" as const, color: { argb: PALETTE.border } },
    left:   { style: "thin" as const, color: { argb: PALETTE.border } },
    right:  { style: "thin" as const, color: { argb: PALETTE.border } },
    bottom: { style: "thin" as const, color: { argb: PALETTE.border } },
  };

  // Helpers to apply common styling without repeating the same object literal.
  const applyFill = (cell: ExcelJS.Cell, argb: string) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  };
  const applyBorder = (cell: ExcelJS.Cell) => { cell.border = THIN_BORDER; };

  // ── Meta-header writer ──
  // Both modes need the same Course / Module / Topic / Test / Total Marks
  // strip at the top. Implemented as a two-row table: one row of labels,
  // one row of values, spanning the same column count as the data table
  // below so columns align visually. Centralised here so a change to the
  // styling (or the field list) only happens in one place.
  const writeMetaHeader = (sheet: ExcelJS.Worksheet, colSpan: number) => {
    if (metaItems.length === 0) return;
    // Label row.
    const labelRow = sheet.addRow(metaItems.map(m => m.label));
    labelRow.eachCell((cell, colNum) => {
      if (colNum > metaItems.length) return;
      cell.font = { bold: true, color: { argb: PALETTE.white } };
      applyFill(cell, PALETTE.indigoFill);
      applyBorder(cell);
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
    // Value row.
    const valueRow = sheet.addRow(metaItems.map(m => m.value));
    valueRow.eachCell((cell, colNum) => {
      if (colNum > metaItems.length) return;
      cell.font = { bold: true, color: { argb: PALETTE.black } };
      applyFill(cell, PALETTE.indigoSoft);
      applyBorder(cell);
    });
    sheet.addRow([]); // spacer below the meta strip
    void colSpan; // reserved for a future "merge to colSpan" pass
  };

  if (reportMode === "summary") {
    // ─── SUMMARY MODE — single sheet, single filterable table ──────────────
    const sheet = workbook.addWorksheet("Student Summary");
    writeMetaHeader(sheet, activeSummaryCols.length);
    const lbl = sheet.addRow(["Student Summary (Overall)"]);
    sheet.mergeCells(lbl.number, 1, lbl.number, activeSummaryCols.length);
    const lblCell = lbl.getCell(1);
    lblCell.font = { bold: true, color: { argb: PALETTE.indigoFill }, size: 12 };
    applyFill(lblCell, PALETTE.lavender);
    lbl.height = 20;
    sheet.addRow([]);
    const hdr = sheet.addRow(activeSummaryCols.map(c => c.label));
    activeSummaryCols.forEach((c, i) => {
      const col = sheet.getColumn(i + 1);
      col.width = Math.max(col.width || 0, c.excelWidth ?? 16);
    });
    hdr.height = 22;
    activeSummaryCols.forEach((_, i) => {
      const cell = hdr.getCell(i + 1);
      cell.font = { bold: true, color: { argb: PALETTE.white } };
      applyFill(cell, PALETTE.indigoFill);
      applyBorder(cell);
      cell.alignment = { vertical: "middle", horizontal: "left" };
    });
    filteredRows.forEach((r, idx) => {
      const added = sheet.addRow(activeSummaryCols.map(c => c.value(r)));
      added.eachCell((cell, colNum) => {
        if (colNum > activeSummaryCols.length) return;
        applyBorder(cell);
        if (idx % 2 === 1) applyFill(cell, PALETTE.altRow);
      });
    });
    // AutoFilter dropdowns on every summary header + frozen header row.
    const lastSummaryDataRow = sheet.lastRow?.number ?? hdr.number;
    sheet.autoFilter = { from: { row: hdr.number, column: 1 }, to: { row: lastSummaryDataRow, column: activeSummaryCols.length } };
    sheet.views = [{ state: "frozen", ySplit: hdr.number }];
  } else {
    // ─── DETAILED MODE — single sheet, per-student block layout ────────────
    // Mirrors the modal preview: for each student we write their detail
    // (summary header + single data row) then the question table(s) stacked
    // directly below — split into Part A / Part B … tables when the test is
    // section-based, otherwise one Question-by-Question table. A single blank
    // row separates students. Everything stays on ONE sheet (no per-section
    // tabs).
    const sheet = workbook.addWorksheet("Detailed Report");
    const all = buildAllBreakdowns();
    const span = Math.max(activeSummaryCols.length, activeDetailCols.length);

    for (let i = 0; i < span; i++) {
      const sum = activeSummaryCols[i]?.excelWidth ?? 0;
      const det = activeDetailCols[i]?.excelWidth ?? 0;
      sheet.getColumn(i + 1).width = Math.max(sum, det, 12);
    }

    writeMetaHeader(sheet, span);

    const title = sheet.addRow([`Detailed Report — ${assessmentName || "Assessment"}`]);
    sheet.mergeCells(title.number, 1, title.number, span);
    const tCell = title.getCell(1);
    tCell.font = { bold: true, size: 14, color: { argb: PALETTE.indigoFill } };
    title.height = 24;

    const sub = sheet.addRow([`Generated ${new Date().toLocaleString("en-GB")}`]);
    sheet.mergeCells(sub.number, 1, sub.number, span);
    sub.getCell(1).font = { italic: true, size: 9, color: { argb: PALETTE.grey } };
    sheet.addRow([]); // spacer

    // Writes one question table (section/label band + column header + rows)
    // for a set of breakdown rows. Shared by the section + non-section paths.
    const writeQuestionTable = (label: string, rows: QuestionBreakdownRow[]) => {
      const sectionLbl = sheet.addRow([label]);
      sheet.mergeCells(sectionLbl.number, 1, sectionLbl.number, span);
      const lCell = sectionLbl.getCell(1);
      lCell.font = { bold: true, color: { argb: PALETTE.indigoFill }, size: 11 };
      applyFill(lCell, PALETTE.lavender);
      sectionLbl.height = 20;

      const qHdr = sheet.addRow(activeDetailCols.map(c => c.label));
      qHdr.eachCell((cell, colNum) => {
        if (colNum > activeDetailCols.length) return;
        cell.font = { bold: true, color: { argb: PALETTE.black } };
        applyFill(cell, PALETTE.questionHdr);
        applyBorder(cell);
        cell.alignment = { vertical: "middle", horizontal: "left" };
      });

      if (rows.length === 0) {
        const empty = sheet.addRow(["No questions recorded for this student."]);
        sheet.mergeCells(empty.number, 1, empty.number, activeDetailCols.length);
        const eCell = empty.getCell(1);
        eCell.font = { italic: true, color: { argb: PALETTE.grey } };
        applyBorder(eCell);
      } else {
        rows.forEach((q, qIdx) => {
          const qRow = sheet.addRow(activeDetailCols.map(c => c.value(q)));
          qRow.eachCell((cell, colNum) => {
            if (colNum > activeDetailCols.length) return;
            applyBorder(cell);
            if (qIdx % 2 === 1) applyFill(cell, PALETTE.altRow);
          });
        });
      }
    };

    for (const r of filteredRows) {
      // ── Student banner ──
      const banner = sheet.addRow([`Student #${r.index + 1} — ${r.student.studentName || ""}`]);
      sheet.mergeCells(banner.number, 1, banner.number, span);
      const bCell = banner.getCell(1);
      bCell.font = { bold: true, color: { argb: PALETTE.white }, size: 12 };
      applyFill(bCell, PALETTE.lavender2);
      bCell.alignment = { vertical: "middle", horizontal: "left" };
      banner.height = 22;

      sheet.addRow([]); // spacer between banner and the student-detail row

      // ── Student detail (summary header + single data row) ──
      const sumHdr = sheet.addRow(activeSummaryCols.map(c => c.label));
      sumHdr.eachCell((cell, colNum) => {
        if (colNum > activeSummaryCols.length) return;
        cell.font = { bold: true, color: { argb: PALETTE.white } };
        applyFill(cell, PALETTE.indigoFill);
        applyBorder(cell);
        cell.alignment = { vertical: "middle", horizontal: "left" };
      });
      const sumRow = sheet.addRow(activeSummaryCols.map(c => c.value(r)));
      sumRow.eachCell((cell, colNum) => {
        if (colNum > activeSummaryCols.length) return;
        cell.font = { bold: true, color: { argb: PALETTE.black } };
        applyFill(cell, PALETTE.indigoSoft);
        applyBorder(cell);
      });

      // ── Question table(s): Part A / Part B … or single Q-by-Q ──
      if (activeDetailCols.length > 0) {
        const breakdown = all.get(r.student.id) ?? [];
        if (sectionMode) {
          const groups = groupBreakdownBySection(breakdown);
          if (groups.length === 0) writeQuestionTable("Question-by-Question Details", []);
          else groups.forEach(g => writeQuestionTable(g.name, g.rows));
        } else {
          writeQuestionTable("Question-by-Question Details", breakdown);
        }
      }

      sheet.addRow([]); // one blank row between students
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `${sanitiseFilename(assessmentName || "report")}-${reportMode}.xlsx`);
};
