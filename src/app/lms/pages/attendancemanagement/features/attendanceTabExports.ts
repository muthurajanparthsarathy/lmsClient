import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "react-hot-toast";
import type { AttendanceStatus, HalfPeriod } from "@/app/lms/pages/attendancemanagement/api/attendanceApi";
import { fmt, fmtWeekday, type Student } from "@/app/lms/pages/attendancemanagement/features/attendanceTabShared";
import type { useAttendanceTab } from "@/app/lms/pages/attendancemanagement/features/useAttendanceTab";

type AttendanceTabState = ReturnType<typeof useAttendanceTab>;

export function createAttendanceTabExports({
  dayKey,
  selectedDay,
  students,
  cellOf,
  reportPicker,
  setReportPicker,
}: AttendanceTabState) {
  // ── Exporters ──────────────────────────────────────────────────────────
  // Both reports scope to the currently selected day — same data the admin
  // sees on screen. Widening to a custom range is a follow-up.

  const dateLabel = dayKey;

  const statusLabel = (s: AttendanceStatus | "") =>
    s === "P" ? "Present" : s === "A" ? "Absent" : s === "H" ? "Half-day" : "Not marked";

  const halfLabel = (h: HalfPeriod) =>
    h === "first" ? "1st half" : h === "second" ? "2nd half" : "";

  // Palette shared by both Excel exports so the file reads as coordinated.
  const XLS_PALETTE = {
    indigoFill: "FF4F46E5",
    indigoSoft: "FFEEF2FF",
    altRow: "FFF9FAFB",
    border: "FFE5E7EB",
    white: "FFFFFFFF",
  };
  const XLS_THIN = {
    top: { style: "thin" as const, color: { argb: XLS_PALETTE.border } },
    left: { style: "thin" as const, color: { argb: XLS_PALETTE.border } },
    right: { style: "thin" as const, color: { argb: XLS_PALETTE.border } },
    bottom: { style: "thin" as const, color: { argb: XLS_PALETTE.border } },
  };
  const applyBorder = (c: ExcelJS.Cell) => (c.border = XLS_THIN);
  const applyFill = (c: ExcelJS.Cell, argb: string) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
  };

  // ── 1. Download Report — the selected day's attendance sheet ───────────
  const exportAttendanceExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "EduLMS";
    wb.created = new Date();
    const sheet = wb.addWorksheet("Attendance");

    const header = [
      "#",
      "Roll No.",
      "Student Name",
      "Email",
      `Status (${fmt(selectedDay)})`,
      "Half Period",
      "Reason",
    ];
    const widths = [6, 18, 24, 26, 18, 12, 50];
    const hdr = sheet.addRow(header);
    hdr.height = 22;
    header.forEach((_, i) => (sheet.getColumn(i + 1).width = widths[i]));
    hdr.eachCell((cell, n) => {
      if (n > header.length) return;
      cell.font = { bold: true, color: { argb: XLS_PALETTE.white } };
      applyFill(cell, XLS_PALETTE.indigoFill);
      applyBorder(cell);
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });

    students.forEach((s, i) => {
      const cell = cellOf(s._id);
      const st = cell?.status ?? "";
      const row = sheet.addRow([
        i + 1,
        s.userId || "",
        `${s.firstName} ${s.lastName}`.trim() || "—",
        s.email || "",
        statusLabel(st),
        st === "H" ? halfLabel((cell?.halfPeriod as HalfPeriod) || "") : "",
        st === "A" || st === "H" ? cell?.reason || "" : "",
      ]);
      row.eachCell((c, n) => {
        if (n > header.length) return;
        applyBorder(c);
        if (i % 2 === 1) applyFill(c, XLS_PALETTE.altRow);
      });
    });

    // AutoFilter on the entire header row + freeze it.
    const lastRow = sheet.lastRow?.number ?? 1;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastRow, column: header.length },
    };
    sheet.views = [{ state: "frozen", ySplit: 1, xSplit: 3 }];

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `attendance_${dateLabel}.xlsx`
    );
  };

  const exportAttendancePdf = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 17, 17);
    doc.text(`Attendance — ${fmt(selectedDay)} (${fmtWeekday(selectedDay)})`, margin, margin + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, margin, margin + 20);

    const head = [["#", "Enroll. No.", "Student", "Status", "Half Period", "Reason"]];
    const body = students.map((s, i) => {
      const cell = cellOf(s._id);
      const st = cell?.status ?? "";
      return [
        i + 1,
        s.userId || "",
        `${s.firstName} ${s.lastName}`.trim() || "—",
        statusLabel(st),
        st === "H" ? halfLabel((cell?.halfPeriod as HalfPeriod) || "") : "",
        st === "A" || st === "H" ? cell?.reason || "" : "",
      ];
    });
    autoTable(doc, {
      startY: margin + 34,
      margin: { left: margin, right: margin },
      head,
      body,
      styles: { fontSize: 8.5, cellPadding: 4, lineColor: [229, 231, 235], lineWidth: 0.5, overflow: "linebreak" },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 5: { cellWidth: 220 } },
      theme: "grid",
    });
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Page ${p} of ${pages}`,
        pageW - margin,
        doc.internal.pageSize.getHeight() - 16,
        { align: "right" }
      );
    }
    doc.save(`attendance_${dateLabel}.pdf`);
  };

  // ── 2. Remarks Report — only A / H rows with a reason ─────────────────
  // Flatten grid to one entry per student marked A or H on the selected day.
  type RemarkRow = {
    student: Student;
    status: "A" | "H";
    halfPeriod: HalfPeriod;
    reason: string;
  };
  const buildRemarkRows = (): RemarkRow[] => {
    const out: RemarkRow[] = [];
    for (const s of students) {
      const cell = cellOf(s._id);
      const st = cell?.status;
      if (st === "A" || st === "H") {
        out.push({
          student: s,
          status: st,
          halfPeriod: (cell?.halfPeriod as HalfPeriod) || "",
          reason: cell?.reason || "",
        });
      }
    }
    // Sort by student name.
    out.sort((a, b) =>
      `${a.student.firstName} ${a.student.lastName}`.localeCompare(
        `${b.student.firstName} ${b.student.lastName}`
      )
    );
    return out;
  };

  const exportRemarksExcel = async () => {
    const rows = buildRemarkRows();
    const wb = new ExcelJS.Workbook();
    wb.creator = "EduLMS";
    wb.created = new Date();
    const sheet = wb.addWorksheet("Remarks");

    const header = [
      "#",
      "Date",
      "Weekday",
      "Roll No.",
      "Student Name",
      "Email",
      "Attendance",
      "Half Period",
      "Reason",
    ];
    const widths = [5, 14, 10, 18, 24, 26, 12, 12, 60];
    const hdr = sheet.addRow(header);
    hdr.height = 22;
    header.forEach((_, i) => (sheet.getColumn(i + 1).width = widths[i]));
    hdr.eachCell((cell, n) => {
      if (n > header.length) return;
      cell.font = { bold: true, color: { argb: XLS_PALETTE.white } };
      applyFill(cell, XLS_PALETTE.indigoFill);
      applyBorder(cell);
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });

    if (rows.length === 0) {
      const empty = sheet.addRow(["No remarks for this day"]);
      sheet.mergeCells(empty.number, 1, empty.number, header.length);
      const cell = empty.getCell(1);
      cell.font = { italic: true, color: { argb: "FF6B7280" } };
      applyBorder(cell);
    } else {
      rows.forEach((r, i) => {
        const name = `${r.student.firstName} ${r.student.lastName}`.trim() || "—";
        const row = sheet.addRow([
          i + 1,
          fmt(selectedDay),
          fmtWeekday(selectedDay),
          r.student.userId || "",
          name,
          r.student.email || "",
          r.status === "A" ? "Absent" : "Half-day",
          r.status === "H" ? halfLabel(r.halfPeriod) : "",
          r.reason,
        ]);
        row.eachCell((cell, n) => {
          if (n > header.length) return;
          applyBorder(cell);
          if (i % 2 === 1) applyFill(cell, XLS_PALETTE.altRow);
          cell.alignment = { vertical: "top", wrapText: true };
        });
      });
    }

    // AutoFilter + frozen header for quick filtering by student / date / etc.
    const lastRow = sheet.lastRow?.number ?? 1;
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: lastRow, column: header.length },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      `remarks_${dateLabel}.xlsx`
    );
  };

  const exportRemarksPdf = () => {
    const rows = buildRemarkRows();
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(17, 17, 17);
    doc.text(`Remarks Report — ${fmt(selectedDay)} (${fmtWeekday(selectedDay)})`, margin, margin + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${rows.length} remark${rows.length !== 1 ? "s" : ""} · Generated ${new Date().toLocaleString(
        "en-GB"
      )}`,
      margin,
      margin + 20
    );

    const head = [
      ["#", "Date", "Day", "Enroll. No.", "Student", "Attendance", "Half Period", "Reason"],
    ];
    const body = rows.map((r, i) => [
      i + 1,
      fmt(selectedDay),
      fmtWeekday(selectedDay),
      r.student.userId || "",
      `${r.student.firstName} ${r.student.lastName}`.trim() || "—",
      r.status === "A" ? "Absent" : "Half-day",
      r.status === "H" ? halfLabel(r.halfPeriod) : "",
      r.reason,
    ]);
    autoTable(doc, {
      startY: margin + 34,
      margin: { left: margin, right: margin },
      head,
      body: body.length ? body : [["", "", "", "", "No remarks for this day", "", "", ""]],
      styles: { fontSize: 8.5, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5, overflow: "linebreak" },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: { 7: { cellWidth: 220 } },
      theme: "grid",
    });
    const pages = doc.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Page ${p} of ${pages}`,
        pageW - margin,
        doc.internal.pageSize.getHeight() - 16,
        { align: "right" }
      );
    }
    doc.save(`remarks_${dateLabel}.pdf`);
  };

  const handlePickFormat = async (fmtSel: "excel" | "pdf") => {
    try {
      if (reportPicker === "attendance") {
        if (fmtSel === "excel") await exportAttendanceExcel();
        else exportAttendancePdf();
      } else if (reportPicker === "remarks") {
        if (fmtSel === "excel") await exportRemarksExcel();
        else exportRemarksPdf();
      }
      setReportPicker(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate report");
    }
  };

  return { handlePickFormat };
}
