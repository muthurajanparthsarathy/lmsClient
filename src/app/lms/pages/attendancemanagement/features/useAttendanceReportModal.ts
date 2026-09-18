"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useCourseBatchGroupsQuery, useAttendanceRecordsQuery } from "@/app/lms/pages/attendancemanagement/queries/attendance";
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import type { CourseStructure } from "@/app/lms/pages/coursestructure/coursestructurecomponents/types";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index";
import {
    ALL_BATCHES,
    COLUMNS,
    MS_PER_DAY,
    parseKey,
    shortDay,
    toDayKey,
    todayUtc,
    type BatchGroup,
    type ColKey,
    type Student,
    type ViewKey,
} from "@/app/lms/pages/attendancemanagement/features/attendanceReportModalShared";

export function useAttendanceReportModal({
    open, onClose, courseId, initialDayKey,
}: {
    open: boolean;
    onClose: () => void;
    courseId: string;
    initialDayKey?: string;
}) {
    // Page-level attendance access grants export — sub-functions were retired.
    const { can } = usePermissions();
    const canExport =
        can(PERMISSION_IDS.ADMIN_ATTENDANCE) ||
        can(PERMISSION_IDS.STAFF_ATTENDANCE);

    // ── Designer state ────────────────────────────────────────────────────
    const today = toDayKey(todayUtc());
    const defaultTo = initialDayKey || today;
    const defaultFrom = toDayKey(new Date(parseKey(defaultTo).getTime() - 6 * MS_PER_DAY));
    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(defaultTo);
    const [cols, setCols] = useState<Set<ColKey>>(new Set(["enrollment", "present", "absent", "halfday", "attendance"]));
    const [views, setViews] = useState<Set<ViewKey>>(new Set(["table", "pie"]));
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [drawerCollapsed, setDrawerCollapsed] = useState(false);
    // Refs so the PDF exporter can rasterise each rendered chart. Only the
    // views the user actually turned on receive a ref, so the exporter loops
    // over what's on the canvas — nothing more.
    const chartRefs = useRef<Record<ViewKey, HTMLDivElement | null>>({ table: null, pie: null, bar: null, line: null });
    const setChartRef = (k: ViewKey) => (el: HTMLDivElement | null) => { chartRefs.current[k] = el; };
    // "single" → the same date is used as both from and to (one-day report).
    // "range" → user picks start + end independently.
    const [dateMode, setDateMode] = useState<"single" | "range">("range");
    // Batch scope + explicit student picks.
    //   batchSel = ALL_BATCHES  → every enrolled student (still lets the user
    //     narrow with studentSel).
    //   batchSel = <batchId>    → only that batch's roster.
    //   studentSel = null       → "All students" (implicit — includes future
    //     additions to the batch).
    //   studentSel = Set<id>    → only the checked students.
    const [batchSel, setBatchSel] = useState<string>(ALL_BATCHES);
    const [studentSel, setStudentSel] = useState<Set<string> | null>(null);
    const [studentPickerOpen, setStudentPickerOpen] = useState(false);
    const downloadRef = useRef<HTMLDivElement | null>(null);

    // When switching from "range" to "single", collapse both endpoints onto
    // the more recent one so the report doesn't silently jump.
    const setSingleDay = (dk: string) => { setFrom(dk); setTo(dk); };

    // Close download menu on outside click.
    useEffect(() => {
        if (!downloadOpen) return;
        const onDoc = (e: MouseEvent) => {
            if (!downloadRef.current?.contains(e.target as Node)) setDownloadOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [downloadOpen]);

    // Close whole modal on ESC.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // ── Data ──────────────────────────────────────────────────────────────
    // Course list for the picker / header. Reads ONLY _id, courseName and
    // courseCode, so it rides the SUMMARY entry rather than the full
    // ['courseStructures'] payload: 348,390 bytes and 627 ms versus 43,189 bytes
    // and 442 ms for the same 68 courses. Verified by diffing both live responses
    // — the fields summary drops (I_Do/We_Do/You_Do, courseHierarchy,
    // testConfiguration, batchAndParticipants, ...) are none of them read here.
    // `clientData`, referenced by the Excel export, is absent from BOTH payloads,
    // so that cell renders empty exactly as it does today.
    const { data: courses = [] } = useQuery({ ...courseStructuresSummaryQuery(), enabled: !!courseId && open });
    const course = (courses as CourseStructure[]).find((c) => c._id === courseId);

    // Same roster cache entry the Report and Analytics pages read; `select`
    // gives this view its batch-grouped shape without a second fetch.
    const { data: batchGroups = [], isLoading: studentsLoading } =
        useCourseBatchGroupsQuery(courseId, open);

    // Flatten by batch scope + dedupe (a student can appear in >1 batch); the
    // scope collapses to a single roster the rest of the modal reads from.
    const scopedStudents: Student[] = useMemo(() => {
        const src: BatchGroup[] = batchSel === ALL_BATCHES
            ? batchGroups
            : batchGroups.filter((g) => g.id === batchSel);
        const seen = new Set<string>();
        const out: Student[] = [];
        for (const g of src) {
            for (const s of g.students) {
                if (seen.has(s._id)) continue;
                seen.add(s._id);
                out.push(s);
            }
        }
        return out;
    }, [batchGroups, batchSel]);

    // Apply the explicit student picker on top of the batch scope.
    const students: Student[] = useMemo(() => {
        if (!studentSel) return scopedStudents;
        return scopedStudents.filter((s) => studentSel.has(s._id));
    }, [scopedStudents, studentSel]);

    // When the batch changes, the picker's set may reference students who are
    // no longer in scope. Reset to "All" so the count stays truthful.
    useEffect(() => { setStudentSel(null); }, [batchSel]);
    const hasBatches = batchGroups.length > 1 || (batchGroups.length === 1 && batchGroups[0].name.toLowerCase() !== "all students");

    const { data: records = [], isLoading: recordsLoading } =
        useAttendanceRecordsQuery(courseId, from, to, open && !!from && !!to);

    // ── Derivations ───────────────────────────────────────────────────────
    const days = useMemo(() => {
        if (!from || !to) return [] as Date[];
        const start = parseKey(from);
        const end = parseKey(to);
        if (end.getTime() < start.getTime()) return [];
        const out: Date[] = [];
        for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) out.push(new Date(t));
        return out;
    }, [from, to]);

    // Skip weekends when computing "working days" — matches ReportPage rules.
    const workingDays = useMemo(() => days.filter((d) => {
        const dow = d.getUTCDay();
        return dow !== 0 && dow !== 6;
    }), [days]);

    // Per-student rollup — { P, A, H, marks, pct } computed off the same
    // records array so the table, pie, and bar all agree on totals.
    const perStudent = useMemo(() => {
        return students.map((s) => {
            let P = 0, A = 0, H = 0;
            for (const r of records) {
                if (String(r.studentId) !== String(s._id)) continue;
                const dk = String((r as any).date || "").slice(0, 10);
                if (!dk) continue;
                if (dk < from || dk > to) continue;
                if (r.status === "P") P++;
                else if (r.status === "A") A++;
                else if (r.status === "H") H++;
            }
            const wd = workingDays.length;
            const marks = P + A + H;
            const notmarked = Math.max(0, wd - marks);
            const pct = wd > 0 ? ((P + H * 0.5) / wd) * 100 : 0;
            const performance = pct >= 90 ? "Excellent" : pct >= 75 ? "Good" : pct >= 60 ? "Average" : pct > 0 ? "Poor" : "—";
            return { student: s, P, A, H, notmarked, pct, performance };
        });
    }, [students, records, from, to, workingDays.length]);

    const totals = useMemo(() => {
        let P = 0, A = 0, H = 0, N = 0;
        for (const r of perStudent) { P += r.P; A += r.A; H += r.H; N += r.notmarked; }
        return { P, A, H, N };
    }, [perStudent]);

    // Daily trend — average attendance % across all students, per working day.
    const dailyTrend = useMemo(() => {
        return workingDays.map((d) => {
            const dk = toDayKey(d);
            let P = 0, H = 0, marks = 0;
            for (const s of students) {
                const rec = records.find((r) => String(r.studentId) === String(s._id) && String((r as any).date || "").slice(0, 10) === dk);
                if (!rec) continue;
                marks++;
                if (rec.status === "P") P++;
                else if (rec.status === "H") H++;
            }
            const pct = students.length > 0 ? ((P + H * 0.5) / students.length) * 100 : 0;
            return { day: shortDay(d), key: dk, pct: Math.round(pct * 10) / 10, marks };
        });
    }, [workingDays, students, records]);

    // ── Downloads — respect the current column/view selection ─────────────
    const activeCols = COLUMNS.filter((c) => cols.has(c.key));
    const buildTableRows = () => perStudent.map((r, i) => {
        const row: Record<string, string | number> = { "#": i + 1, "Student": `${r.student.firstName} ${r.student.lastName}`.trim() };
        for (const col of activeCols) {
            if (col.key === "enrollment") row[col.label] = r.student.userId || "—";
            else if (col.key === "present") row[col.label] = r.P;
            else if (col.key === "absent") row[col.label] = r.A;
            else if (col.key === "halfday") row[col.label] = r.H;
            else if (col.key === "notmarked") row[col.label] = r.notmarked;
            else if (col.key === "attendance") row[col.label] = `${r.pct.toFixed(1)}%`;
            else if (col.key === "performance") row[col.label] = r.performance;
        }
        return row;
    });

    // Rasterise a rendered chart tile into a PNG data URL. We serialise the
    // recharts <svg>, load it into an <img>, then draw onto a canvas at 2×
    // for crisp print. No extra deps (html2canvas isn't installed).
    const svgToPng = async (container: HTMLElement | null): Promise<{ dataUrl: string; width: number; height: number } | null> => {
        if (!container) return null;
        const svg = container.querySelector("svg");
        if (!svg) return null;
        const box = svg.getBoundingClientRect();
        const clone = svg.cloneNode(true) as SVGSVGElement;
        // Recharts sizes via ResponsiveContainer at runtime, so the cloned
        // SVG needs explicit dimensions or img.decode() falls over.
        clone.setAttribute("width", String(Math.max(1, Math.round(box.width))));
        clone.setAttribute("height", String(Math.max(1, Math.round(box.height))));
        clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        const xml = new XMLSerializer().serializeToString(clone);
        const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        try {
            const img = new Image();
            img.decoding = "async";
            img.src = url;
            await img.decode();
            const scale = 2; // 2× for print sharpness
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(box.width * scale));
            canvas.height = Math.max(1, Math.round(box.height * scale));
            const ctx = canvas.getContext("2d");
            if (!ctx) return null;
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            return { dataUrl: canvas.toDataURL("image/png"), width: box.width, height: box.height };
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    const downloadExcel = async () => {
        const wb = new ExcelJS.Workbook();
        // Sheet 1: roster table (same as before).
        const ws = wb.addWorksheet("Attendance");
        const header = ["#", "Student", ...activeCols.map((c) => c.label)];
        ws.addRow(header);
        ws.getRow(1).font = { bold: true };
        for (const row of buildTableRows()) ws.addRow(header.map((h) => row[h] ?? ""));
        ws.columns.forEach((c) => (c.width = Math.max(12, (c.header as string)?.length || 12)));

        // Extra sheets carrying the numbers behind whichever charts the user
        // has on the canvas — Excel can't easily embed live charts, but the
        // raw data lets them re-plot in Excel with two clicks.
        if (views.has("pie")) {
            const s = wb.addWorksheet("Status share");
            s.addRow(["Status", "Days marked"]);
            s.getRow(1).font = { bold: true };
            s.addRow(["Present",    totals.P]);
            s.addRow(["Absent",     totals.A]);
            s.addRow(["Half-day",   totals.H]);
            s.addRow(["Not marked", totals.N]);
            s.columns.forEach((c) => (c.width = 16));
        }
        if (views.has("bar")) {
            const s = wb.addWorksheet("Per-student %");
            s.addRow(["Student", "Enrollment", "Attendance %"]);
            s.getRow(1).font = { bold: true };
            for (const r of perStudent) {
                s.addRow([`${r.student.firstName} ${r.student.lastName}`.trim(), r.student.userId || "", Math.round(r.pct * 10) / 10]);
            }
            s.columns.forEach((c) => (c.width = 22));
        }
        if (views.has("line")) {
            const s = wb.addWorksheet("Daily trend");
            s.addRow(["Day", "Attendance %", "Marks recorded"]);
            s.getRow(1).font = { bold: true };
            for (const r of dailyTrend) s.addRow([r.key, r.pct, r.marks]);
            s.columns.forEach((c) => (c.width = 16));
        }

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf], { type: "application/octet-stream" }), `attendance-${course?.courseCode || courseId}-${from}-to-${to}.xlsx`);
        setDownloadOpen(false);
    };

    const downloadPdf = async () => {
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 40;

        doc.setFontSize(14);
        doc.text(`Attendance Report — ${course?.courseName || ""} (${course?.courseCode || ""})`, margin, 40);
        doc.setFontSize(10);
        doc.text(`Range: ${from} → ${to}`, margin, 58);

        let cursorY = 74;

        // Table first if the user has it on.
        if (views.has("table")) {
            autoTable(doc, {
                startY: cursorY,
                head: [["#", "Student", ...activeCols.map((c) => c.label)]],
                body: buildTableRows().map((r) => [r["#"], r["Student"], ...activeCols.map((c) => r[c.label] ?? "")]),
                styles: { fontSize: 9, cellPadding: 4 },
                headStyles: { fillColor: [249, 115, 22] },
            });
            cursorY = ((doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? cursorY) + 24;
        }

        // Then any chart the user has on, each on its own page for print quality.
        const chartOrder: { key: ViewKey; title: string }[] = [
            { key: "pie",  title: "Status share" },
            { key: "bar",  title: "Per-student attendance %" },
            { key: "line", title: "Daily attendance trend" },
        ];
        for (const { key, title } of chartOrder) {
            if (!views.has(key)) continue;
            const shot = await svgToPng(chartRefs.current[key]);
            if (!shot) continue;
            doc.addPage();
            doc.setFontSize(12);
            doc.text(title, margin, margin);
            // Fit inside the page while preserving the on-screen aspect ratio.
            const maxW = pageW - margin * 2;
            const maxH = pageH - margin * 2 - 20;
            const ratio = shot.width / shot.height;
            let w = maxW;
            let h = w / ratio;
            if (h > maxH) { h = maxH; w = h * ratio; }
            doc.addImage(shot.dataUrl, "PNG", margin, margin + 12, w, h);
        }

        doc.save(`attendance-${course?.courseCode || courseId}-${from}-to-${to}.pdf`);
        setDownloadOpen(false);
    };

    const toggle = <T,>(set: Set<T>, setSet: (s: Set<T>) => void, key: T) => {
        const next = new Set(set);
        if (next.has(key)) next.delete(key); else next.add(key);
        setSet(next);
    };

    return {
        canExport, today, defaultFrom, defaultTo, from, setFrom, to, setTo, cols, setCols, views, setViews,
        downloadOpen, setDownloadOpen, drawerCollapsed, setDrawerCollapsed, setChartRef, dateMode, setDateMode,
        batchSel, setBatchSel, studentSel, setStudentSel, studentPickerOpen, setStudentPickerOpen, downloadRef,
        setSingleDay, course, batchGroups, studentsLoading, scopedStudents, hasBatches, recordsLoading,
        workingDays, perStudent, totals, dailyTrend, activeCols, downloadExcel, downloadPdf, toggle,
    };
}
