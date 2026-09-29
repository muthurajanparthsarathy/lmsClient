import { attendanceApi } from "@/app/lms/pages/attendancemanagement/api/attendanceApi";
import type { PrintSetting } from "@/app/lms/pages/dynamicfieldsettings/api/printSetting";
import { escapeHtml, printWithLayout } from "@/app/lms/shared/print/printLayout";
import {
    BANDS,
    bandOf,
    fmt,
    fmtNum,
    fmtWeekday,
    labelForStatus,
    parseKey,
    toDayKey,
} from "@/app/lms/pages/attendancemanagement/features/attendanceReportShared";
import type { useAttendanceReport } from "@/app/lms/pages/attendancemanagement/features/useAttendanceReport";

type ReportState = ReturnType<typeof useAttendanceReport>;

/* Print/PDF are text-only: the whole-report Print goes through the shared
   print-layout HTML (rebuilt from data, no page snapshot), and the whole-report
   PDF is jsPDF + autoTable — no html2canvas, no oklch/oklab colour conversion,
   no live-DOM capture. Keeps output crisp and avoids the Tailwind-v4 colour
   parsing errors html2canvas 1.4.1 throws on modern colour functions. */

export function createReportExports({
    courseId,
    course,
    students,
    appliedFrom,
    appliedTo,
    appliedStudent,
    appliedStatus,
    viewMode,
    filteredStudents,
    grid,
    workingDayList,
    workingDays,
    rowStats,
    totals,
    totalStudents,
    bestDay,
    trend,
}: ReportState) {
    const studentLabel = (): string => {
        if (appliedStudent === "all" || appliedStudent.length === 0 || appliedStudent.length === students.length) {
            return "All Students";
        }
        if (appliedStudent.length === 1) {
            const s = students.find((x) => x._id === appliedStudent[0]);
            return s ? `${s.firstName} ${s.lastName}`.trim() || s.email : "1 student";
        }
        if (appliedStudent.length <= 3) {
            return appliedStudent
                .map((id) => {
                    const s = students.find((x) => x._id === id);
                    return s ? `${s.firstName} ${s.lastName}`.trim() : "";
                })
                .filter(Boolean)
                .join(", ");
        }
        return `${appliedStudent.length} students`;
    };
    const scopeLine = () => [
        course ? `${course.courseName || ""}${course.courseCode ? ` (${course.courseCode})` : ""}` : "",
        `${fmt(parseKey(appliedFrom))} → ${fmt(parseKey(appliedTo))}`,
        `Student: ${studentLabel()}`,
        `Status: ${labelForStatus(appliedStatus)}`,
    ].filter(Boolean).join("  ·  ");
    const fileStem = `attendance_report_${course?.courseCode || courseId}_${appliedFrom}_${appliedTo}`;
    // ── Excel — the Attendance Summary itself. Daily View includes one
    // column per working day; Summary View omits them, matching what the
    // reader was looking at when they clicked Export.
    const handleExcel = async () => {
        const includeDaily = viewMode === "daily";
        // The spreadsheet carries a cell per (filtered student x working day).
        // It fetches those rows itself rather than trusting the on-screen grid,
        // which can still hold the previous filter's cells while it reloads.
        const exportIds = filteredStudents.map((s) => s._id);
        let exportGrid = grid;
        if (includeDaily && exportIds.length) {
            try {
                const recs = await attendanceApi.list(
                    courseId, appliedFrom, appliedTo, undefined, undefined, exportIds, true
                );
                const m = new Map<string, Map<string, "P" | "A" | "H">>();
                for (const r of recs) {
                    const sid = (r.studentId as any)?.toString?.() || (r.studentId as any);
                    const dk = toDayKey(new Date(r.date));
                    if (!m.has(sid)) m.set(sid, new Map());
                    m.get(sid)!.set(dk, r.status);
                }
                exportGrid = m;
            } catch {
                return; // leave the file unwritten rather than write a wrong one
            }
        }
        const ExcelJS = (await import("exceljs")).default;
        const fs: any = await import("file-saver");
        const saveAs: (data: Blob, filename?: string) => void =
            fs.saveAs || fs.default?.saveAs || fs.default;
        const wb = new ExcelJS.Workbook();
        wb.creator = "SmartCliff LMS";
        wb.created = new Date();

        const ws = wb.addWorksheet("Attendance Report", {
            views: [{ state: "frozen", ySplit: 1 }],
        });

        const dayHeaders = includeDaily
            ? workingDayList.map((d) => `${fmt(d)} (${fmtWeekday(d)})`)
            : [];
        const header = [
            "#",
            "Student Name",
            "Roll No.",
            "Email",
            ...dayHeaders,
            "Working Days",
            "Days Present",
            "Absent",
            "Half-day",
            "Not Marked",
            "Attendance %",
            "Performance",
        ];
        ws.addRow(header);
        const headerRow = ws.getRow(1);
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF4F46E5" },
        };
        headerRow.alignment = { vertical: "middle", horizontal: "center" };
        headerRow.height = 22;

        filteredStudents.forEach((s, i) => {
            const rs = rowStats(s._id);
            const dayCells = includeDaily
                ? workingDayList.map((d) => exportGrid.get(s._id)?.get(toDayKey(d)) || "-")
                : [];
            ws.addRow([
                i + 1,
                `${s.firstName} ${s.lastName}`.trim() || "—",
                s.userId || "",
                s.email || "",
                ...dayCells,
                workingDays,
                rs.p,
                rs.a,
                rs.h,
                rs.n,
                `${rs.attPct.toFixed(2)}% (${fmtNum(rs.effPresent)}/${workingDays})`,
                rs.band.label,
            ]);
        });

        // AutoFilter — this is what gives Excel the little dropdown arrows on
        // each column header ("default filter" per the request).
        ws.autoFilter = {
            from: { row: 1, column: 1 },
            to: { row: 1, column: header.length },
        };

        // Column widths
        ws.columns.forEach((col, idx) => {
            if (idx === 1) col.width = 26;
            else if (idx === 3) col.width = 28;
            else if (includeDaily && idx >= 4 && idx < 4 + workingDayList.length) col.width = 18;
            else if (idx === header.length - 2) col.width = 20; // Attendance %
            else col.width = 14;
        });

        // Summary & Insights sheet — the same insights shown on the page.
        const meta = wb.addWorksheet("Summary & Insights");
        const sectionRow = (title: string) => {
            const r = meta.addRow([title]);
            r.font = { bold: true, color: { argb: "FF4F46E5" } };
            return r;
        };
        sectionRow("REPORT");
        meta.addRow(["Course", course?.courseName || ""]);
        meta.addRow(["Course Code", course?.courseCode || ""]);
        meta.addRow(["Client", course?.clientData?.clientCompany || ""]);
        meta.addRow(["Date Range", `${fmt(parseKey(appliedFrom))} → ${fmt(parseKey(appliedTo))}`]);
        meta.addRow(["Student Filter", studentLabel()]);
        meta.addRow(["Status Filter", labelForStatus(appliedStatus)]);
        meta.addRow([]);
        sectionRow("KEY INSIGHTS");
        meta.addRow(["Total Working Days", workingDays]);
        meta.addRow(["Total Students", filteredStudents.length]);
        meta.addRow(["Class Average Attendance", `${totals.avgAttendance.toFixed(2)}% (${bandOf(totals.avgAttendance).label})`]);
        meta.addRow(["Total Present Marks", totals.P]);
        meta.addRow(["Total Absent Marks", totals.A]);
        meta.addRow(["Total Half-day Marks", totals.H]);
        meta.addRow(["Not Marked Cells", totals.N]);
        meta.addRow(["Students At Risk (< 75%)", totals.atRisk]);
        meta.addRow([
            "Top Performer",
            totals.top
                ? `${totals.top.s.firstName} ${totals.top.s.lastName}`.trim() +
                  ` — ${totals.top.attPct.toFixed(1)}% (${fmtNum(totals.top.effPresent)}/${workingDays} days)`
                : "—",
        ]);
        meta.addRow([
            "Needs Attention",
            totals.low
                ? `${totals.low.s.firstName} ${totals.low.s.lastName}`.trim() +
                  ` — ${totals.low.attPct.toFixed(1)}% (${fmtNum(totals.low.effPresent)}/${workingDays} days)`
                : "—",
        ]);
        meta.addRow([
            "Best Day",
            bestDay
                ? `${fmt(bestDay.d)} (${fmtWeekday(bestDay.d)}) — ${bestDay.pct.toFixed(1)}% present`
                : "—",
        ]);
        meta.addRow([]);
        sectionRow("PERFORMANCE SCALE");
        meta.addRow(["Formula", "Attendance % = (Days Present + ½ × Half-days) ÷ Working Days × 100"]);
        totals.bandCounts.forEach(({ band, count }) => {
            meta.addRow([`${band.label} (${band.range})`, `${count} student${count === 1 ? "" : "s"}`]);
        });
        meta.getColumn(1).width = 28;
        meta.getColumn(2).width = 60;

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf], { type: "application/octet-stream" }), `${fileStem}.xlsx`);
    };

    const handlePdf = async () => {
        const { jsPDF } = await import("jspdf");
        const autoTable = (await import("jspdf-autotable")).default;
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 40;

        // Title + meta
        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(17, 17, 17);
        doc.text("Attendance Report", margin, 42);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(110, 110, 110);
        doc.text(
            `Course: ${course?.courseName || ""} (${course?.courseCode || ""})   ·   ${fmt(parseKey(appliedFrom))} → ${fmt(parseKey(appliedTo))}   ·   Generated ${new Date().toLocaleString("en-GB")}`,
            margin,
            58
        );

        // Key insights block
        autoTable(doc, {
            startY: 72,
            margin: { left: margin, right: margin },
            head: [["Working Days", "Students", "Class Average", "At Risk (< 75%)", "Top Performer", "Needs Attention", "Best Day"]],
            body: [[
                String(workingDays),
                String(filteredStudents.length),
                `${totals.avgAttendance.toFixed(2)}% (${bandOf(totals.avgAttendance).label})`,
                String(totals.atRisk),
                totals.top
                    ? `${totals.top.s.firstName} ${totals.top.s.lastName}`.trim() + ` — ${totals.top.attPct.toFixed(1)}%`
                    : "—",
                totals.low
                    ? `${totals.low.s.firstName} ${totals.low.s.lastName}`.trim() + ` — ${totals.low.attPct.toFixed(1)}%`
                    : "—",
                bestDay ? `${fmt(bestDay.d)} — ${bestDay.pct.toFixed(1)}%` : "—",
            ]],
            styles: { fontSize: 8.5, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5 },
            headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
            theme: "grid",
        });

        // Per-student summary — Attendance % = (Present + ½ Half) ÷ Working Days × 100
        const afterInsights = (doc as any).lastAutoTable?.finalY ?? 120;
        autoTable(doc, {
            startY: afterInsights + 16,
            margin: { left: margin, right: margin },
            head: [[
                "#",
                "Enroll. No.",
                "Student",
                "Working Days",
                "Days Present",
                "Absent",
                "Half-day",
                "Not Marked",
                "Attendance %",
                "Performance",
            ]],
            body: filteredStudents.map((s, i) => {
                const rs = rowStats(s._id);
                return [
                    i + 1,
                    s.userId || "",
                    `${s.firstName} ${s.lastName}`.trim() || "—",
                    workingDays,
                    rs.p,
                    rs.a,
                    rs.h,
                    rs.n,
                    `${rs.attPct.toFixed(2)}%  (${fmtNum(rs.effPresent)}/${workingDays})`,
                    rs.band.label,
                ];
            }),
            styles: { fontSize: 8.5, cellPadding: 4, lineColor: [229, 231, 235], lineWidth: 0.5 },
            headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            theme: "grid",
            didParseCell: (data: any) => {
                // Tint the Performance column with its band colour.
                if (data.section === "body" && data.column.index === 9) {
                    const band = BANDS.find((b) => b.label === data.cell.raw);
                    if (band) {
                        data.cell.styles.textColor = band.hex;
                        data.cell.styles.fontStyle = "bold";
                    }
                }
            },
        });

        // Performance scale legend + footer
        const afterTable = (doc as any).lastAutoTable?.finalY ?? 400;
        doc.setFontSize(8.5);
        doc.setTextColor(110, 110, 110);
        doc.text(
            `Performance scale: ${BANDS.map((b) => `${b.label} ${b.range}`).join("  ·  ")}`,
            margin,
            Math.min(afterTable + 18, doc.internal.pageSize.getHeight() - 30)
        );
        doc.text(
            "Attendance % = (Days Present + ½ × Half-days) ÷ Total Working Days × 100",
            margin,
            Math.min(afterTable + 30, doc.internal.pageSize.getHeight() - 18)
        );
        const pages = doc.getNumberOfPages();
        for (let p = 1; p <= pages; p++) {
            doc.setPage(p);
            doc.setFontSize(8);
            doc.setTextColor(140, 140, 140);
            doc.text(`Page ${p} of ${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 16, { align: "right" });
        }

        doc.save(`${fileStem}.pdf`);
    };

    // The report body as HTML, wrapped by the chosen print layout. Includes
    // every section the on-screen report shows: scope strip, stat cards row,
    // attendance summary table, attendance % breakdown, day-by-day trend,
    // performance scale distribution, and key insights. Recharts SVGs are
    // rebuilt as tables so they carry to paper (and to Save-as-PDF) without
    // depending on the browser's canvas.
    const buildReportBodyHtml = (): string => {
        const cells = (tag: "th" | "td", values: (string | number)[]) =>
            values.map((v) => `<${tag}>${escapeHtml(String(v))}</${tag}>`).join("");

        const scopeStrip = `<p style="margin:0 0 8px;font-size:11px;color:#6B7280">${escapeHtml(scopeLine())}</p>`;

        const statCards = `
<h3 style="margin:12px 0 4px;font-size:12px;color:#111827">Overview</h3>
<table>
  <thead><tr>${cells("th", ["Total Students", "Working Days", "Class Average", "At Risk (< 75%)", "Present", "Absent", "Half-day", "Not Marked"])}</tr></thead>
  <tbody><tr>${cells("td", [
      totalStudents,
      workingDays,
      `${totals.avgAttendance.toFixed(2)}% (${bandOf(totals.avgAttendance).label})`,
      totals.atRisk,
      `${totals.P} (${totals.pPct.toFixed(2)}%)`,
      `${totals.A} (${totals.aPct.toFixed(2)}%)`,
      `${totals.H} (${totals.hPct.toFixed(2)}%)`,
      `${totals.N} (${totals.nPct.toFixed(2)}%)`,
  ])}</tr></tbody>
</table>`;

        const summaryTable = `
<h3 style="margin:14px 0 4px;font-size:12px;color:#111827">Attendance Summary</h3>
<table>
  <thead><tr>${cells("th", ["#", "Roll No.", "Student", "Working Days", "Present", "Absent", "Half-day", "Not Marked", "Attendance %", "Performance"])}</tr></thead>
  <tbody>${filteredStudents
      .map((s, i) => {
          const rs = rowStats(s._id);
          return `<tr>${cells("td", [
              i + 1,
              s.userId || "",
              `${s.firstName} ${s.lastName}`.trim() || "—",
              workingDays,
              rs.p,
              rs.a,
              rs.h,
              rs.n,
              `${rs.attPct.toFixed(2)}% (${fmtNum(rs.effPresent)}/${workingDays})`,
              rs.band.label,
          ])}</tr>`;
      })
      .join("")}</tbody>
</table>
<p style="margin-top:6px;font-size:10px;color:#6B7280">Attendance % = (Days Present + ½ × Half-days) ÷ Working Days × 100</p>`;

        const percentageBlock = `
<h3 style="margin:14px 0 4px;font-size:12px;color:#111827">Attendance Percentage</h3>
<table>
  <thead><tr>${cells("th", ["Status", "Count", "Share"])}</tr></thead>
  <tbody>
    <tr>${cells("td", ["Present", totals.P, `${totals.pPct.toFixed(2)}%`])}</tr>
    <tr>${cells("td", ["Absent", totals.A, `${totals.aPct.toFixed(2)}%`])}</tr>
    <tr>${cells("td", ["Half-day", totals.H, `${totals.hPct.toFixed(2)}%`])}</tr>
    <tr>${cells("td", ["Not Marked", totals.N, `${totals.nPct.toFixed(2)}%`])}</tr>
  </tbody>
</table>`;

        const trendBlock = trend.length
            ? `
<h3 style="margin:14px 0 4px;font-size:12px;color:#111827">Attendance Trend</h3>
<table>
  <thead><tr>${cells("th", ["Day", "Present", "Absent", "Half-day"])}</tr></thead>
  <tbody>${trend
      .map((t) => `<tr>${cells("td", [t.label, t.Present, t.Absent, t["Half-day"]])}</tr>`)
      .join("")}</tbody>
</table>`
            : "";

        const scaleBlock = `
<h3 style="margin:14px 0 4px;font-size:12px;color:#111827">Performance Scale</h3>
<table>
  <thead><tr>${cells("th", ["Band", "Range", "Students"])}</tr></thead>
  <tbody>${totals.bandCounts
      .map(({ band, count }) => `<tr>${cells("td", [band.label, band.range, count])}</tr>`)
      .join("")}</tbody>
</table>`;

        const insightsBlock = `
<h3 style="margin:14px 0 4px;font-size:12px;color:#111827">Key Insights</h3>
<table>
  <thead><tr>${cells("th", ["Insight", "Value"])}</tr></thead>
  <tbody>
    <tr>${cells("td", [
        "Top Performer",
        totals.top
            ? `${totals.top.s.firstName} ${totals.top.s.lastName}`.trim() +
              ` — ${totals.top.attPct.toFixed(1)}% (${fmtNum(totals.top.effPresent)}/${workingDays} days)`
            : "—",
    ])}</tr>
    <tr>${cells("td", [
        "Needs Attention",
        totals.low
            ? `${totals.low.s.firstName} ${totals.low.s.lastName}`.trim() +
              ` — ${totals.low.attPct.toFixed(1)}% (${fmtNum(totals.low.effPresent)}/${workingDays} days)`
            : "—",
    ])}</tr>
    <tr>${cells("td", [
        "Best Day",
        bestDay ? `${fmt(bestDay.d)} (${fmtWeekday(bestDay.d)}) — ${bestDay.pct.toFixed(1)}% present` : "—",
    ])}</tr>
    <tr>${cells("td", [
        "Class Standing",
        `${totals.avgAttendance.toFixed(1)}% · ${bandOf(totals.avgAttendance).label} — ${totals.atRisk} of ${filteredStudents.length} student${filteredStudents.length === 1 ? "" : "s"} below 75%`,
    ])}</tr>
  </tbody>
</table>`;

        return `${scopeStrip}${statCards}${summaryTable}${percentageBlock}${trendBlock}${scaleBlock}${insightsBlock}`;
    };

    const printJobTitle = () => `Attendance report ${course?.courseCode || courseId} ${appliedFrom} to ${appliedTo}`;

    /** Print the attendance report wrapped in an explicit print setting. The
     *  Print modal calls this after the reader picks & tweaks a saved layout;
     *  the edits are session-only, never written back to the settings doc.
     *  `bodyHtml` is captured up-front so the print job carries the same
     *  page-UI snapshot the modal was previewing. */
    const printWithSetting = (setting: Partial<PrintSetting> | null, bodyHtml: string) => {
        printWithLayout(setting, {
            title: printJobTitle(),
            heading: "Attendance Report",
            bodyHtml,
        });
    };

    // Body for the Attendance Summary's own Print — the scope strip, the
    // overview row, and the per-student summary table. Text-only HTML that
    // slots into a print-setting layout the same way the overall report does.
    const buildSummaryBodyHtml = (): string => {
        const cells = (tag: "th" | "td", values: (string | number)[]) =>
            values.map((v) => `<${tag}>${escapeHtml(String(v))}</${tag}>`).join("");
        const studentRows = filteredStudents
            .map((s, i) => {
                const rs = rowStats(s._id);
                return `<tr>${cells("td", [
                    i + 1,
                    s.userId || "",
                    `${s.firstName} ${s.lastName}`.trim() || "—",
                    workingDays,
                    rs.p,
                    rs.a,
                    rs.h,
                    rs.n,
                    `${rs.attPct.toFixed(2)}% (${fmtNum(rs.effPresent)}/${workingDays})`,
                    rs.band.label,
                ])}</tr>`;
            })
            .join("");

        return `
<p style="margin:0 0 6px;font-size:11px;color:#6B7280">${escapeHtml(scopeLine())}</p>
<table>
  <thead><tr>${cells("th", ["Working Days", "Students", "Class Average", "At Risk (< 75%)", "Present", "Absent", "Half-day", "Not Marked"])}</tr></thead>
  <tbody><tr>${cells("td", [
      workingDays,
      filteredStudents.length,
      `${totals.avgAttendance.toFixed(2)}% (${bandOf(totals.avgAttendance).label})`,
      totals.atRisk,
      totals.P,
      totals.A,
      totals.H,
      totals.N,
  ])}</tr></tbody>
</table>
<table>
  <thead><tr>${cells("th", ["#", "Roll No.", "Student", "Working Days", "Present", "Absent", "Half-day", "Not Marked", "Attendance %", "Performance"])}</tr></thead>
  <tbody>${studentRows}</tbody>
</table>
<p style="margin-top:8px;font-size:10px;color:#6B7280">Attendance % = (Days Present + ½ × Half-days) ÷ Working Days × 100</p>`;
    };

    // ── Whole-page PDF — text-only via jsPDF + autoTable. Same sections the
    // Print body renders: scope strip, insights row, per-student summary,
    // status-share breakdown, day-by-day trend, performance scale, key
    // insights. No page snapshot, no colour parsing — just typed text and
    // tables.
    const handleOverallPdf = async () => {
        const { jsPDF } = await import("jspdf");
        const autoTable = (await import("jspdf-autotable")).default;
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 40;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(15);
        doc.setTextColor(17, 17, 17);
        doc.text("Attendance Report", margin, 42);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(110, 110, 110);
        doc.text(scopeLine(), margin, 58);

        const nextY = () => ((doc as any).lastAutoTable?.finalY ?? 72) + 16;
        const tableStyles: any = { fontSize: 8.5, cellPadding: 5, lineColor: [229, 231, 235], lineWidth: 0.5 };
        const headStyles: any = { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold" };

        // Overview / key numbers
        autoTable(doc, {
            startY: 72,
            margin: { left: margin, right: margin },
            head: [["Working Days", "Students", "Class Average", "At Risk (< 75%)", "Present", "Absent", "Half-day", "Not Marked"]],
            body: [[
                String(workingDays),
                String(filteredStudents.length),
                `${totals.avgAttendance.toFixed(2)}% (${bandOf(totals.avgAttendance).label})`,
                String(totals.atRisk),
                `${totals.P} (${totals.pPct.toFixed(2)}%)`,
                `${totals.A} (${totals.aPct.toFixed(2)}%)`,
                `${totals.H} (${totals.hPct.toFixed(2)}%)`,
                `${totals.N} (${totals.nPct.toFixed(2)}%)`,
            ]],
            styles: tableStyles,
            headStyles,
            theme: "grid",
        });

        // Per-student summary
        autoTable(doc, {
            startY: nextY(),
            margin: { left: margin, right: margin },
            head: [["#", "Roll No.", "Student", "Working Days", "Days Present", "Absent", "Half-day", "Not Marked", "Attendance %", "Performance"]],
            body: filteredStudents.map((s, i) => {
                const rs = rowStats(s._id);
                return [
                    i + 1,
                    s.userId || "",
                    `${s.firstName} ${s.lastName}`.trim() || "—",
                    workingDays,
                    rs.p,
                    rs.a,
                    rs.h,
                    rs.n,
                    `${rs.attPct.toFixed(2)}%  (${fmtNum(rs.effPresent)}/${workingDays})`,
                    rs.band.label,
                ];
            }),
            styles: tableStyles,
            headStyles,
            alternateRowStyles: { fillColor: [249, 250, 251] },
            theme: "grid",
            didParseCell: (data: any) => {
                if (data.section === "body" && data.column.index === 9) {
                    const band = BANDS.find((b) => b.label === data.cell.raw);
                    if (band) {
                        data.cell.styles.textColor = band.hex;
                        data.cell.styles.fontStyle = "bold";
                    }
                }
            },
        });

        // Status share
        autoTable(doc, {
            startY: nextY(),
            margin: { left: margin, right: margin },
            head: [["Status", "Count", "Share"]],
            body: [
                ["Present", String(totals.P), `${totals.pPct.toFixed(2)}%`],
                ["Absent", String(totals.A), `${totals.aPct.toFixed(2)}%`],
                ["Half-day", String(totals.H), `${totals.hPct.toFixed(2)}%`],
                ["Not Marked", String(totals.N), `${totals.nPct.toFixed(2)}%`],
            ],
            styles: tableStyles,
            headStyles,
            theme: "grid",
        });

        // Trend (only when there is data)
        if (trend.length) {
            autoTable(doc, {
                startY: nextY(),
                margin: { left: margin, right: margin },
                head: [["Day", "Present", "Absent", "Half-day"]],
                body: trend.map((t) => [t.label, String(t.Present), String(t.Absent), String(t["Half-day"])]),
                styles: tableStyles,
                headStyles,
                theme: "grid",
            });
        }

        // Performance scale
        autoTable(doc, {
            startY: nextY(),
            margin: { left: margin, right: margin },
            head: [["Band", "Range", "Students"]],
            body: totals.bandCounts.map(({ band, count }) => [band.label, band.range, String(count)]),
            styles: tableStyles,
            headStyles,
            theme: "grid",
        });

        // Key insights
        autoTable(doc, {
            startY: nextY(),
            margin: { left: margin, right: margin },
            head: [["Insight", "Value"]],
            body: [
                [
                    "Top Performer",
                    totals.top
                        ? `${totals.top.s.firstName} ${totals.top.s.lastName}`.trim() +
                          ` — ${totals.top.attPct.toFixed(1)}% (${fmtNum(totals.top.effPresent)}/${workingDays} days)`
                        : "—",
                ],
                [
                    "Needs Attention",
                    totals.low
                        ? `${totals.low.s.firstName} ${totals.low.s.lastName}`.trim() +
                          ` — ${totals.low.attPct.toFixed(1)}% (${fmtNum(totals.low.effPresent)}/${workingDays} days)`
                        : "—",
                ],
                [
                    "Best Day",
                    bestDay
                        ? `${fmt(bestDay.d)} (${fmtWeekday(bestDay.d)}) — ${bestDay.pct.toFixed(1)}% present`
                        : "—",
                ],
                [
                    "Class Standing",
                    `${totals.avgAttendance.toFixed(1)}% · ${bandOf(totals.avgAttendance).label} — ${totals.atRisk} of ${filteredStudents.length} student${filteredStudents.length === 1 ? "" : "s"} below 75%`,
                ],
            ],
            styles: tableStyles,
            headStyles,
            theme: "grid",
        });

        // Footer legend + page numbers
        const afterTable = (doc as any).lastAutoTable?.finalY ?? 400;
        doc.setFontSize(8.5);
        doc.setTextColor(110, 110, 110);
        doc.text(
            `Performance scale: ${BANDS.map((b) => `${b.label} ${b.range}`).join("  ·  ")}`,
            margin,
            Math.min(afterTable + 18, doc.internal.pageSize.getHeight() - 30)
        );
        doc.text(
            "Attendance % = (Days Present + ½ × Half-days) ÷ Total Working Days × 100",
            margin,
            Math.min(afterTable + 30, doc.internal.pageSize.getHeight() - 18)
        );
        const pages = doc.getNumberOfPages();
        for (let p = 1; p <= pages; p++) {
            doc.setPage(p);
            doc.setFontSize(8);
            doc.setTextColor(140, 140, 140);
            doc.text(`Page ${p} of ${pages}`, pageW - margin, doc.internal.pageSize.getHeight() - 16, { align: "right" });
        }

        doc.save(`${fileStem}_full.pdf`);
    };

    return {
        handleExcel,
        handlePdf,
        handleOverallPdf,
        // Exposed for the Print picker modal so it can preview and print the
        // real attendance data (not the print-setting page's sample rows).
        buildReportBodyHtml,
        buildSummaryBodyHtml,
        printJobTitle,
        printWithSetting,
    };
}
