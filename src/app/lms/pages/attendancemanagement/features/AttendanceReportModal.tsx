"use client";

/**
 * Canva-style Detailed Attendance Report modal.
 *
 * Left drawer = designer surface (date range, columns, view types). Right
 * canvas = live-updating preview built from those choices. Top-right =
 * download menu (Excel / PDF) that exports whatever is currently visible on
 * the canvas — nothing more, nothing less. The old AttendanceReportPage
 * stays untouched: this modal replaces the "everything at once" report with
 * a build-what-you-want tool.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    BarChart3,
    Calendar as CalendarIcon,
    ChevronDown,
    ChevronsLeft,
    ChevronsRight,
    Download,
    FileSpreadsheet,
    FileText,
    Loader2,
    PieChart as PieIcon,
    Settings2,
    Table as TableIcon,
    TrendingUp,
    X,
} from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend as RLegend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as RTooltip,
    XAxis,
    YAxis,
} from "recharts";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useCourseBatchGroupsQuery, useAttendanceRecordsQuery } from "@/app/lms/pages/attendancemanagement/queries/attendance";
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import type { CourseStructure } from "@/app/lms/pages/coursestructure/coursestructurecomponents/types";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index";

// ─── Date helpers (mirrors ReportPage; local to modal so no cross-import) ───
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const toDayKey = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};
const parseKey = (k: string) => {
    const [y, m, d] = k.split("-").map(Number);
    return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};
const todayUtc = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const shortDay = (d: Date) => {
    const day = d.getUTCDate();
    const mon = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    return `${String(day).padStart(2, "0")} ${mon}`;
};

type Student = {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    userId: string;
};

type BatchGroup = {
    id: string;   // batch identity (or "__course__" when the course has no real batches)
    name: string; // display label ("Batch I", …) or "All students" for the synthetic bucket
    students: Student[];
};

const ALL_BATCHES = "__all__";

// Which columns the canvas table can show. The user picks any subset — the
// download exports exactly those columns.
type ColKey =
    | "enrollment"
    | "present"
    | "absent"
    | "halfday"
    | "notmarked"
    | "attendance"
    | "performance";

const COLUMNS: { key: ColKey; label: string; hint: string }[] = [
    { key: "enrollment",  label: "Roll No.", hint: "Student's roll / employee number" },
    { key: "present",     label: "Present",        hint: "Days marked P" },
    { key: "absent",      label: "Absent", hint: "Days marked A" },
    { key: "halfday",     label: "Half-day",       hint: "Days marked H" },
    { key: "notmarked",   label: "Not marked",     hint: "Working days without a mark" },
    { key: "attendance",  label: "Attendance %",   hint: "(P + H×0.5) ÷ working days" },
    { key: "performance", label: "Performance",    hint: "Excellent / Good / Average / Poor" },
];

// Which visual representations to draw on the canvas. Multi-select — pick
// as many as fits the story.
type ViewKey = "table" | "pie" | "bar" | "line";

const VIEWS: { key: ViewKey; label: string; icon: React.FC<{ className?: string }> }[] = [
    { key: "table", label: "Roster table",   icon: TableIcon },
    { key: "pie",   label: "Status share",   icon: PieIcon },
    { key: "bar",   label: "Per-student %",  icon: BarChart3 },
    { key: "line",  label: "Daily trend",    icon: TrendingUp },
];

// Shared chart palette — reads from Tailwind token colours so both themes work.
const STATUS_COLOR: Record<"P" | "A" | "H" | "N", string> = {
    P: "#10B981",
    A: "#EF4444",
    H: "#F59E0B",
    N: "#94A3B8",
};

export default function AttendanceReportModal({
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

    const loading = studentsLoading || recordsLoading;
    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/55 backdrop-blur-[2px] p-3 sm:p-5"
            role="dialog"
            aria-modal="true"
            aria-label="Detailed attendance report"
            onClick={onClose}
        >
            <div
                className="relative flex h-[94vh] w-[97vw] max-w-[1440px] overflow-hidden rounded-tile border border-hairline bg-surface shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ─── LEFT DRAWER (Canva-style designer) ────────────────── */}
                <aside className={`flex shrink-0 flex-col border-r border-hairline bg-surface-sunken/40 transition-[width] duration-150 ${drawerCollapsed ? "w-[52px]" : "w-[320px]"}`}>
                    <header className={`flex flex-shrink-0 items-center gap-2 border-b border-hairline py-3 ${drawerCollapsed ? "justify-center px-2" : "px-4"}`}>
                        {!drawerCollapsed && (
                            <>
                                <Settings2 className="h-4 w-4 text-brand-strong shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm font-semibold text-heading">Report designer</h2>
                                    <p className="mt-0.5 truncate text-[10px] text-subtle">Pick what to show — preview updates as you edit.</p>
                                </div>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => setDrawerCollapsed((v) => !v)}
                            aria-label={drawerCollapsed ? "Expand designer" : "Collapse designer"}
                            title={drawerCollapsed ? "Expand designer" : "Collapse designer"}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                        >
                            {drawerCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
                        </button>
                    </header>

                    {drawerCollapsed ? (
                        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center gap-1 py-3">
                            {VIEWS.map((v) => {
                                const on = views.has(v.key);
                                const Icon = v.icon;
                                return (
                                    <button
                                        key={v.key}
                                        type="button"
                                        onClick={() => toggle(views, setViews, v.key)}
                                        title={v.label}
                                        aria-label={v.label}
                                        aria-pressed={on}
                                        className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                                            on
                                                ? "border-brand-500 bg-brand-100/40 text-brand-strong dark:bg-brand-500/15"
                                                : "border-transparent text-subtle hover:bg-row-hover hover:text-body"
                                        }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </button>
                                );
                            })}
                            <div className="my-1 h-px w-6 bg-hairline" aria-hidden />
                            <button
                                type="button"
                                onClick={() => setDrawerCollapsed(false)}
                                title="Open date range / column pickers"
                                aria-label="Open date range / column pickers"
                                className="flex h-9 w-9 items-center justify-center rounded-md text-subtle hover:bg-row-hover hover:text-body transition-colors"
                            >
                                <CalendarIcon className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setDrawerCollapsed(false)}
                                title="Open table column picker"
                                aria-label="Open table column picker"
                                className="flex h-9 w-9 items-center justify-center rounded-md text-subtle hover:bg-row-hover hover:text-body transition-colors"
                            >
                                <TableIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-5">
                        {/* Date range */}
                        <section>
                            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Date range</h3>
                            {/* Single vs Range picker — radio pair. Keeps the
                                URL / query the same shape (from + to) so the
                                download and preview logic doesn't branch. */}
                            <div className="mb-2 flex items-center gap-3" role="radiogroup" aria-label="Date mode">
                                <label className="inline-flex cursor-pointer items-center gap-1.5">
                                    <input
                                        type="radio"
                                        name="date-mode"
                                        value="single"
                                        checked={dateMode === "single"}
                                        onChange={() => { setDateMode("single"); setSingleDay(to || today); }}
                                        className="size-3.5 cursor-pointer text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                    />
                                    <span className="text-[11px] font-medium text-body">Single</span>
                                </label>
                                <label className="inline-flex cursor-pointer items-center gap-1.5">
                                    <input
                                        type="radio"
                                        name="date-mode"
                                        value="range"
                                        checked={dateMode === "range"}
                                        onChange={() => {
                                            setDateMode("range");
                                            // On switch back, seed a sensible range ending on the current single day.
                                            if (from === to) {
                                                const end = to || today;
                                                const start = toDayKey(new Date(parseKey(end).getTime() - 6 * MS_PER_DAY));
                                                setFrom(start);
                                            }
                                        }}
                                        className="size-3.5 cursor-pointer text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                    />
                                    <span className="text-[11px] font-medium text-body">Range</span>
                                </label>
                            </div>
                            {dateMode === "single" ? (
                                <label className="flex flex-col gap-1">
                                    <span className="text-[10px] font-medium text-subtle">Date</span>
                                    <div className="relative">
                                        <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
                                        <input
                                            type="date"
                                            value={to}
                                            max={today}
                                            onChange={(e) => setSingleDay(e.target.value)}
                                            className="h-8 w-full rounded-md border border-hairline bg-surface pl-6 pr-1.5 text-[11px] text-body outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                        />
                                    </div>
                                </label>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex flex-col gap-1">
                                        <span className="text-[10px] font-medium text-subtle">Start date</span>
                                        <div className="relative">
                                            <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
                                            <input
                                                type="date"
                                                value={from}
                                                max={to || today}
                                                onChange={(e) => setFrom(e.target.value)}
                                                className="h-8 w-full rounded-md border border-hairline bg-surface pl-6 pr-1.5 text-[11px] text-body outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                            />
                                        </div>
                                    </label>
                                    <label className="flex flex-col gap-1">
                                        <span className="text-[10px] font-medium text-subtle">End date</span>
                                        <div className="relative">
                                            <CalendarIcon className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-faint" />
                                            <input
                                                type="date"
                                                value={to}
                                                min={from}
                                                max={today}
                                                onChange={(e) => setTo(e.target.value)}
                                                className="h-8 w-full rounded-md border border-hairline bg-surface pl-6 pr-1.5 text-[11px] text-body outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                            />
                                        </div>
                                    </label>
                                </div>
                            )}
                            {dateMode === "range" && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {[
                                    { label: "7d", days: 7 },
                                    { label: "14d", days: 14 },
                                    { label: "30d", days: 30 },
                                ].map((p) => (
                                    <button
                                        key={p.label}
                                        type="button"
                                        onClick={() => {
                                            const end = today;
                                            const start = toDayKey(new Date(parseKey(end).getTime() - (p.days - 1) * MS_PER_DAY));
                                            setFrom(start); setTo(end);
                                        }}
                                        className="rounded-chip border border-hairline bg-surface px-2 py-0.5 text-[10px] font-medium text-subtle hover:bg-row-hover hover:text-body transition-colors"
                                    >
                                        Last {p.label}
                                    </button>
                                ))}
                            </div>
                            )}
                        </section>

                        {/* Batch — hidden when the course has no real batch
                            split (i.e., the whole roster is one bucket). */}
                        {hasBatches && (
                            <section>
                                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Batch</h3>
                                <div className="relative">
                                    <select
                                        value={batchSel}
                                        onChange={(e) => setBatchSel(e.target.value)}
                                        className="h-8 w-full appearance-none rounded-md border border-hairline bg-surface pl-2.5 pr-7 text-[11px] font-medium text-heading outline-none cursor-pointer focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15"
                                        aria-label="Batch"
                                    >
                                        <option value={ALL_BATCHES}>All batches</option>
                                        {batchGroups.map((g) => (
                                            <option key={g.id} value={g.id}>{g.name} ({g.students.length})</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-subtle" />
                                </div>
                            </section>
                        )}

                        {/* Students — filter within the batch scope. Default is
                            "All students" (implicit); tick specific rows to
                            narrow. Header shows the current selection count. */}
                        <section>
                            <div className="mb-1.5 flex items-center justify-between">
                                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-subtle">Students</h3>
                                <span className="text-[10px] tabular-nums text-subtle">
                                    {studentSel === null
                                        ? `All (${scopedStudents.length})`
                                        : `${studentSel.size} of ${scopedStudents.length}`}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStudentPickerOpen((v) => !v)}
                                className="flex h-8 w-full items-center justify-between rounded-md border border-hairline bg-surface px-2.5 text-[11px] font-medium text-heading hover:border-hairline-strong transition-colors"
                            >
                                <span className="truncate">
                                    {studentSel === null
                                        ? "All students"
                                        : studentSel.size === 0
                                            ? "No students selected"
                                            : studentSel.size === 1
                                                ? scopedStudents.find((s) => studentSel.has(s._id))?.firstName
                                                    ? `${scopedStudents.find((s) => studentSel.has(s._id))!.firstName} ${scopedStudents.find((s) => studentSel.has(s._id))!.lastName}`.trim()
                                                    : "1 student"
                                                : `${studentSel.size} students`}
                                </span>
                                <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${studentPickerOpen ? "rotate-180" : ""}`} />
                            </button>
                            {studentPickerOpen && (
                                <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-hairline bg-surface p-1.5">
                                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-row-hover">
                                        <input
                                            type="checkbox"
                                            checked={studentSel === null}
                                            onChange={(e) => setStudentSel(e.target.checked ? null : new Set())}
                                            className="size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                        />
                                        <span className="text-[11px] font-semibold text-heading">All students</span>
                                    </label>
                                    <div className="my-1 h-px bg-hairline" />
                                    {scopedStudents.length === 0 ? (
                                        <p className="px-2 py-2 text-[10px] text-subtle">No students in this batch.</p>
                                    ) : scopedStudents.map((s) => {
                                        const on = studentSel === null ? true : studentSel.has(s._id);
                                        return (
                                            <label key={s._id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-row-hover">
                                                <input
                                                    type="checkbox"
                                                    checked={on}
                                                    onChange={() => {
                                                        setStudentSel((prev) => {
                                                            // Materialise the implicit "all" set when the user starts
                                                            // ticking off individuals — that's what the checkbox is
                                                            // actually mutating.
                                                            const base = prev ?? new Set(scopedStudents.map((x) => x._id));
                                                            const next = new Set(base);
                                                            if (next.has(s._id)) next.delete(s._id); else next.add(s._id);
                                                            // If everyone is back in, collapse to null (implicit all).
                                                            if (next.size === scopedStudents.length) return null;
                                                            return next;
                                                        });
                                                    }}
                                                    className="size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-[11px] font-medium text-body">
                                                        {`${s.firstName} ${s.lastName}`.trim() || "—"}
                                                    </span>
                                                    {s.userId && (
                                                        <span className="block truncate text-[10px] tabular-nums text-faint">{s.userId}</span>
                                                    )}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Views (visual representations) */}
                        <section>
                            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Views</h3>
                            <div className="grid grid-cols-2 gap-1.5">
                                {VIEWS.map((v) => {
                                    const on = views.has(v.key);
                                    const Icon = v.icon;
                                    return (
                                        <button
                                            key={v.key}
                                            type="button"
                                            onClick={() => toggle(views, setViews, v.key)}
                                            className={`flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors ${
                                                on
                                                    ? "border-brand-500 bg-brand-100/40 text-brand-strong dark:bg-brand-500/15"
                                                    : "border-hairline bg-surface text-subtle hover:border-hairline-strong hover:text-body"
                                            }`}
                                        >
                                            <Icon className="h-3.5 w-3.5" /> {v.label}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="mt-1.5 text-[10px] text-faint">Pick one or several — the canvas stacks them top-down.</p>
                        </section>

                        {/* Table columns (only relevant if Table view is on) */}
                        <section aria-disabled={!views.has("table")} className={views.has("table") ? "" : "opacity-50 pointer-events-none"}>
                            <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle">Table columns</h3>
                            <div className="space-y-1">
                                {COLUMNS.map((c) => {
                                    const on = cols.has(c.key);
                                    return (
                                        <label key={c.key} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1 hover:bg-row-hover" title={c.hint}>
                                            <input
                                                type="checkbox"
                                                checked={on}
                                                onChange={() => toggle(cols, setCols, c.key)}
                                                className="mt-0.5 size-3.5 cursor-pointer rounded border-hairline-strong text-brand-500 focus:ring-2 focus:ring-brand-500/30"
                                            />
                                            <span className="flex-1 min-w-0">
                                                <span className="block text-[11px] font-medium text-body">{c.label}</span>
                                                <span className="block truncate text-[10px] text-faint">{c.hint}</span>
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </section>
                    </div>
                    )}

                    {/* Reset — clear back to defaults (expanded only). */}
                    {!drawerCollapsed && (
                        <footer className="flex-shrink-0 border-t border-hairline px-4 py-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setDateMode("range");
                                    setFrom(defaultFrom); setTo(defaultTo);
                                    setBatchSel(ALL_BATCHES);
                                    setStudentSel(null);
                                    setCols(new Set(["enrollment", "present", "absent", "halfday", "attendance"]));
                                    setViews(new Set(["table", "pie"]));
                                }}
                                className="w-full rounded-md border border-hairline bg-surface px-2 py-1.5 text-[11px] font-medium text-body hover:bg-row-hover transition-colors"
                            >
                                Reset to defaults
                            </button>
                        </footer>
                    )}
                </aside>

                {/* ─── RIGHT CANVAS (rendered report) ────────────────────── */}
                <div className="flex flex-1 min-w-0 flex-col">
                    <header className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface px-5 py-2.5">
                        <div className="min-w-0">
                            <h2 className="truncate text-sm font-semibold text-heading">
                                {course?.courseName || "Detailed report"}
                            </h2>
                            <p className="mt-0.5 truncate text-[10px] text-subtle tabular-nums">
                                {course?.courseCode ? `${course.courseCode} · ` : ""}{from} → {to} · {workingDays.length} working day{workingDays.length === 1 ? "" : "s"}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Download dropdown — top-right, per the spec.
                                Export is admin-only, so hide the whole control
                                when the user lacks export_data. */}
                            {canExport && (
                            <div ref={downloadRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setDownloadOpen((v) => !v)}
                                    disabled={loading || perStudent.length === 0}
                                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-brand-500 bg-brand-500 text-white text-xs font-semibold hover:bg-brand-strong disabled:opacity-50 transition-colors"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    Download report
                                    <ChevronDown className={`h-3 w-3 transition-transform ${downloadOpen ? "rotate-180" : ""}`} />
                                </button>
                                {downloadOpen && (
                                    <div className="absolute right-0 top-full mt-1 w-44 overflow-hidden rounded-md border border-hairline bg-surface shadow-lg z-10">
                                        <button
                                            type="button"
                                            onClick={downloadExcel}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-body hover:bg-row-hover transition-colors"
                                        >
                                            <FileSpreadsheet className="h-3.5 w-3.5 text-success-500" /> Excel (.xlsx)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={downloadPdf}
                                            className="flex w-full items-center gap-2 border-t border-hairline px-3 py-2 text-left text-xs font-medium text-body hover:bg-row-hover transition-colors"
                                        >
                                            <FileText className="h-3.5 w-3.5 text-danger-500" /> PDF (.pdf)
                                        </button>
                                    </div>
                                )}
                            </div>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="flex h-8 w-8 items-center justify-center rounded-control text-subtle hover:bg-row-hover hover:text-heading transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 min-h-0 overflow-y-auto bg-surface-sunken/20 px-5 py-4 space-y-4">
                        {loading ? (
                            <div className="flex h-full items-center justify-center text-xs text-subtle">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading report…
                            </div>
                        ) : views.size === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                                <Settings2 className="h-8 w-8 text-faint" />
                                <p className="text-sm font-medium text-body">Nothing on the canvas yet</p>
                                <p className="text-xs text-subtle">Pick at least one view from the left panel.</p>
                            </div>
                        ) : perStudent.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-xs text-subtle">
                                No students enrolled in this course.
                            </div>
                        ) : (
                            <>
                                {/* Roster table */}
                                {views.has("table") && (
                                    <section className="rounded-tile border border-hairline bg-surface">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
                                            <h3 className="text-xs font-semibold text-heading">Roster</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">{perStudent.length} students · {activeCols.length} columns</span>
                                        </header>
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse text-xs">
                                                <thead className="bg-surface-sunken/50">
                                                    <tr>
                                                        <th className="w-10 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">#</th>
                                                        <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">Student</th>
                                                        {activeCols.map((c) => (
                                                            <th key={c.key} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-subtle border-b border-hairline">{c.label}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {perStudent.map((r, i) => (
                                                        <tr key={r.student._id} className="border-b border-hairline last:border-0 hover:bg-row-hover transition-colors">
                                                            <td className="px-3 py-2 text-[10px] tabular-nums text-faint">{String(i + 1).padStart(2, "0")}</td>
                                                            <td className="px-3 py-2">
                                                                <div className="truncate text-xs font-semibold text-heading">{`${r.student.firstName} ${r.student.lastName}`.trim() || "—"}</div>
                                                                {r.student.email && <div className="truncate text-[10px] text-subtle">{r.student.email}</div>}
                                                            </td>
                                                            {activeCols.map((c) => (
                                                                <td key={c.key} className="px-3 py-2 text-xs tabular-nums text-body">
                                                                    {c.key === "enrollment" && (r.student.userId || <span className="text-faint">—</span>)}
                                                                    {c.key === "present" && r.P}
                                                                    {c.key === "absent" && r.A}
                                                                    {c.key === "halfday" && r.H}
                                                                    {c.key === "notmarked" && r.notmarked}
                                                                    {c.key === "attendance" && (
                                                                        <span className={`font-semibold ${r.pct >= 75 ? "text-success-500" : r.pct >= 60 ? "text-warn-500" : "text-danger-500"}`}>{r.pct.toFixed(1)}%</span>
                                                                    )}
                                                                    {c.key === "performance" && r.performance}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </section>
                                )}

                                {/* Status share pie */}
                                {views.has("pie") && (
                                    <section className="rounded-tile border border-hairline bg-surface">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
                                            <h3 className="text-xs font-semibold text-heading">Status share</h3>
                                            <span className="text-[10px] text-subtle tabular-nums">Overall across the range</span>
                                        </header>
                                        <div ref={setChartRef("pie")} className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        dataKey="value"
                                                        nameKey="name"
                                                        data={[
                                                            { name: "Present",   value: totals.P, color: STATUS_COLOR.P },
                                                            { name: "Absent",    value: totals.A, color: STATUS_COLOR.A },
                                                            { name: "Half-day",  value: totals.H, color: STATUS_COLOR.H },
                                                            { name: "Not marked", value: totals.N, color: STATUS_COLOR.N },
                                                        ]}
                                                        innerRadius={55}
                                                        outerRadius={90}
                                                        paddingAngle={2}
                                                    >
                                                        {[STATUS_COLOR.P, STATUS_COLOR.A, STATUS_COLOR.H, STATUS_COLOR.N].map((c, i) => (
                                                            <Cell key={i} fill={c} />
                                                        ))}
                                                    </Pie>
                                                    <RTooltip />
                                                    <RLegend verticalAlign="bottom" height={30} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </section>
                                )}

                                {/* Per-student attendance % bar */}
                                {views.has("bar") && (
                                    <section className="rounded-tile border border-hairline bg-surface">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
                                            <h3 className="text-xs font-semibold text-heading">Per-student attendance %</h3>
                                        </header>
                                        <div ref={setChartRef("bar")} className="h-72">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={perStudent.map((r) => ({
                                                    name: `${r.student.firstName} ${r.student.lastName}`.trim() || r.student.userId || "—",
                                                    pct: Math.round(r.pct * 10) / 10,
                                                }))} margin={{ top: 8, right: 16, left: 0, bottom: 32 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" interval={0} />
                                                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                                    <RTooltip formatter={((v: number) => `${v}%`) as any} />
                                                    <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                                                        {perStudent.map((r, i) => (
                                                            <Cell key={i} fill={r.pct >= 75 ? STATUS_COLOR.P : r.pct >= 60 ? STATUS_COLOR.H : STATUS_COLOR.A} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </section>
                                )}

                                {/* Daily trend line */}
                                {views.has("line") && (
                                    <section className="rounded-tile border border-hairline bg-surface">
                                        <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
                                            <h3 className="text-xs font-semibold text-heading">Daily attendance trend</h3>
                                            <span className="text-[10px] text-subtle">Avg % across students, per working day</span>
                                        </header>
                                        <div ref={setChartRef("line")} className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={dailyTrend} margin={{ top: 8, right: 16, left: 0, bottom: 12 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                                                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                                    <RTooltip formatter={((v: number) => `${v}%`) as any} />
                                                    <Line type="monotone" dataKey="pct" stroke="#F97316" strokeWidth={2} dot={{ r: 3, fill: "#F97316" }} activeDot={{ r: 5 }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </section>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
