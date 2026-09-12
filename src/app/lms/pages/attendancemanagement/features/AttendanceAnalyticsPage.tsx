"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Analytics — course-scoped analytical view with filters, stat
// cards, three charts (trend, distribution, by-day), and a Top Performers
// table. Includes a Download Analytics button (Excel / PDF).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { Poppins } from "next/font/google";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
    Clock,
    Download,
    FileSpreadsheet,
    FileText,
    Filter,
    RotateCcw,
    Trophy,
    UserCheck,
    UserX,
    TrendingDown,
    Circle,
    X,
} from "lucide-react";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RTooltip,
    Legend as RLegend,
    BarChart,
    Bar,
} from "recharts";
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import { useCourseStudentsQuery, useAttendanceSummaryQuery } from "@/app/lms/pages/attendancemanagement/queries/attendance";
import { Loading } from "@/components/loading-ui/loading";
import { Button } from "@/components/ui/button";
import type { CourseStructure } from "@/app/lms/pages/coursestructure/coursestructurecomponents/types";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

// ── Helpers ────────────────────────────────────────────────────────────────
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

const fmt = (d: Date) => {
    const day = d.getUTCDate();
    const mon = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    const yr = d.getUTCFullYear();
    return `${String(day).padStart(2, "0")}-${mon}-${yr}`;
};

const fmtWeekday = (d: Date) =>
    d.toLocaleString("en-GB", { weekday: "short", timeZone: "UTC" });

const dayUtc = (v: Date | string) => {
    const d = typeof v === "string" ? new Date(v) : v;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);

const startOfWeekMon = (input?: Date) => {
    const d = input ? new Date(input) : new Date();
    const utc = dayUtc(d);
    const dow = utc.getUTCDay();
    const shift = dow === 0 ? -6 : 1 - dow;
    return new Date(utc.getTime() + shift * MS_PER_DAY);
};

// ── Types ──────────────────────────────────────────────────────────────────
type Student = {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    userId?: string;
};

type StudentFilter = "all" | string;
type TrendMode = "daily" | "cumulative";
type DayMode = "percent" | "count";

// ── Component ──────────────────────────────────────────────────────────────
export default function AttendanceAnalyticsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const courseId = searchParams.get("courseId") || "";

    const initialWeek = useMemo(() => startOfWeekMon(), []);
    const [pendingFrom, setPendingFrom] = useState<string>(toDayKey(initialWeek));
    const [pendingTo, setPendingTo] = useState<string>(toDayKey(addDays(initialWeek, 4)));
    const [pendingStudent, setPendingStudent] = useState<StudentFilter>("all");

    const [appliedFrom, setAppliedFrom] = useState<string>(toDayKey(initialWeek));
    const [appliedTo, setAppliedTo] = useState<string>(toDayKey(addDays(initialWeek, 4)));
    const [appliedStudent, setAppliedStudent] = useState<StudentFilter>("all");

    const [trendMode, setTrendMode] = useState<TrendMode>("daily");
    const [dayMode, setDayMode] = useState<DayMode>("percent");

    // Page-level attendance access grants export — sub-functions were retired.
    const { can } = usePermissions();
    const canExport =
        can(PERMISSION_IDS.ADMIN_ATTENDANCE) ||
        can(PERMISSION_IDS.STAFF_ATTENDANCE);

    // Download modal is triggered from the layout via ?download=1 URL param —
    // gate it so a shared link can't bypass the permission check.
    const downloadOpen = searchParams.get("download") === "1" && canExport;
    const setDownloadOpen = (open: boolean) => {
        const params = new URLSearchParams(searchParams.toString());
        if (open) params.set("download", "1");
        else params.delete("download");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
    };

    // ── Data fetches ─────────────────────────────────────────────────────
    // Course list for the picker / header. Reads ONLY _id, courseName and
    // courseCode, so it rides the SUMMARY entry rather than the full
    // ['courseStructures'] payload: 348,390 bytes and 627 ms versus 43,189 bytes
    // and 442 ms for the same 68 courses. Verified by diffing both live responses
    // — the fields summary drops (I_Do/We_Do/You_Do, courseHierarchy,
    // testConfiguration, batchAndParticipants, ...) are none of them read here.
    // `clientData`, referenced by the Excel export, is absent from BOTH payloads,
    // so that cell renders empty exactly as it does today.
    const { data: courses = [] } = useQuery(courseStructuresSummaryQuery());
    const course = (courses as CourseStructure[]).find((c) => c._id === courseId);

    // Same two cache entries the Report page and Report modal read — switching
    // between the views no longer refetches either.
    const { data: students = [], isLoading: studentsLoading } = useCourseStudentsQuery(courseId);

    // ── The aggregates, computed in Mongo ────────────────────────────────
    // This page used to fetch EVERY attendance record in the range and build a
    // studentId → dayKey → status grid in the browser purely to total it.
    // Records grow as students x marked days — 150 rows for the busiest course
    // today, but a 100-student cohort over 200 marked days is 20,000 — so the
    // sums come back already computed and the browser keeps one small tally
    // per student.
    //
    // Scoped to the ROSTER rather than the course, because the charts count
    // STUDENTS, not records: each day's "Not Marked" bar is (visible students)
    // minus (students marked that day). A course can carry records for people
    // who are in none of its batches — SUN-BTB-SK-001 has five such holders
    // against a five-student roster, 75 of its 150 records — and this page has
    // always ignored them, walking the roster and looking each student up in
    // the grid. A course-wide day count against a roster-sized denominator
    // drives that subtraction negative (5 − 10 stacked below the axis), so the
    // roster goes with the request and both sides describe one population.
    // Verified by scripts/verifyAttendanceAnalytics.js --break=scoped_off.
    const rosterIds = useMemo(
        () => Array.from(new Set(students.map((s) => s._id))),
        [students]
    );
    const summaryScope = useMemo(
        () => ({ student: appliedStudent, studentIds: rosterIds }),
        [appliedStudent, rosterIds]
    );
    // Gated on the roster: an EMPTY studentIds is no scope at all rather than
    // "match nobody" — the same rule the sibling list endpoint follows — so an
    // ungated request would answer a zero-student roster with the whole course.
    // There is nothing to count before the roster lands in any case.
    const { data: summary, isLoading: summaryLoading } = useAttendanceSummaryQuery(
        courseId, appliedFrom, appliedTo, summaryScope, rosterIds.length > 0
    );

    // ── Derived data ─────────────────────────────────────────────────────
    const days = useMemo(() => {
        const start = parseKey(appliedFrom);
        const end = parseKey(appliedTo);
        const out: Date[] = [];
        for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
            out.push(new Date(t));
        }
        return out;
    }, [appliedFrom, appliedTo]);

    // studentId → P/A/H tally. A roster student the summary never mentions
    // holds no records at all — the tallies carry no status filter of their
    // own, so that absence is unambiguous.
    const tallyById = useMemo(() => {
        const m = new Map<string, { p: number; a: number; h: number }>();
        for (const t of summary?.students ?? []) m.set(t.studentId, { p: t.p, a: t.a, h: t.h });
        return m;
    }, [summary]);

    // Per-day P/A/H over the roster, summed in Mongo. Zero-filled where read:
    // both charts want a value for every day in the range, including the days
    // nobody was marked on.
    const perDayMap = useMemo(() => {
        const m = new Map<string, { P: number; A: number; H: number }>();
        for (const d of summary?.perDay ?? []) m.set(d.key, { P: d.P, A: d.A, H: d.H });
        return m;
    }, [summary]);

    const visibleStudents = useMemo(() => {
        if (appliedStudent === "all") return students;
        return students.filter((s) => s._id === appliedStudent);
    }, [students, appliedStudent]);

    // Per-student summary. The denominator here is every CALENDAR day in the
    // range — not the Report page's working days — and a day carrying a mark
    // is always inside the range, so a student's marks in range ARE their
    // marks over those days and the unmarked count is simply the remainder.
    // No cell-by-cell walk is needed to find it.
    //
    // Clamped at zero because a student sitting in two batches of one course
    // can hold two marks for a single day: the unique index is per batch.
    const perStudent = useMemo(() => {
        return visibleStudents.map((s) => {
            const t = tallyById.get(s._id) || { p: 0, a: 0, h: 0 };
            const { p, a, h } = t;
            const n = Math.max(0, days.length - (p + a + h));
            const attPct = days.length > 0 ? ((p + h * 0.5) / days.length) * 100 : 0;
            return { student: s, p, a, h, n, attPct };
        });
    }, [visibleStudents, tallyById, days]);

    // Aggregates
    const totals = useMemo(() => {
        let P = 0, A = 0, H = 0, N = 0;
        for (const rs of perStudent) {
            P += rs.p; A += rs.a; H += rs.h; N += rs.n;
        }
        const totalCells = P + A + H + N;
        const avgAttendance = totalCells > 0 ? ((P + H * 0.5) / totalCells) * 100 : 0;
        return { P, A, H, N, totalCells, avgAttendance };
    }, [perStudent]);

    // Highest / lowest attendance students
    const highLow = useMemo(() => {
        if (perStudent.length === 0) return { hi: null as any, lo: null as any };
        const sorted = [...perStudent].sort((a, b) => b.attPct - a.attPct);
        return { hi: sorted[0], lo: sorted[sorted.length - 1] };
    }, [perStudent]);

    // Top 5 performers
    const topPerformers = useMemo(() => {
        return [...perStudent]
            .sort((a, b) => b.attPct - a.attPct || b.p - a.p)
            .slice(0, 5);
    }, [perStudent]);

    // Trend per-day
    const trend = useMemo(() => {
        let cumP = 0, cumA = 0, cumH = 0;
        return days.map((d) => {
            const c = perDayMap.get(toDayKey(d));
            const P = c?.P || 0, A = c?.A || 0, H = c?.H || 0;
            cumP += P; cumA += A; cumH += H;
            return {
                label: d.toLocaleString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
                weekday: fmtWeekday(d),
                Present: trendMode === "daily" ? P : cumP,
                Absent: trendMode === "daily" ? A : cumA,
                "Half-day": trendMode === "daily" ? H : cumH,
            };
        });
    }, [days, perDayMap, trendMode]);

    // By-day stacked bar
    const byDay = useMemo(() => {
        return days.map((d) => {
            const c = perDayMap.get(toDayKey(d));
            const P = c?.P || 0, A = c?.A || 0, H = c?.H || 0;
            // Every visible student carrying no mark that day. Clamped for the
            // same two-batches-one-day reason as the per-student remainder.
            const N = Math.max(0, visibleStudents.length - (P + A + H));
            const tot = P + A + H + N || 1;
            if (dayMode === "percent") {
                return {
                    label: d.toLocaleString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
                    weekday: fmtWeekday(d),
                    Present: +((P / tot) * 100).toFixed(1),
                    Absent: +((A / tot) * 100).toFixed(1),
                    "Half-day": +((H / tot) * 100).toFixed(1),
                    "Not Marked": +((N / tot) * 100).toFixed(1),
                };
            }
            return {
                label: d.toLocaleString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
                weekday: fmtWeekday(d),
                Present: P,
                Absent: A,
                "Half-day": H,
                "Not Marked": N,
            };
        });
    }, [days, visibleStudents.length, perDayMap, dayMode]);

    // ── Actions ──────────────────────────────────────────────────────────
    const applyFilters = () => {
        setAppliedFrom(pendingFrom);
        setAppliedTo(pendingTo);
        setAppliedStudent(pendingStudent);
    };
    const resetFilters = () => {
        const wk = startOfWeekMon();
        const from = toDayKey(wk);
        const to = toDayKey(addDays(wk, 4));
        setPendingFrom(from); setPendingTo(to); setPendingStudent("all");
        setAppliedFrom(from); setAppliedTo(to); setAppliedStudent("all");
    };

    const goToReport = () => {
        router.push(`/lms/pages/attendancemanagement/report?courseId=${courseId}`);
    };

    // ── Export handlers ──────────────────────────────────────────────────
    const handleExcel = async () => {
        const ExcelJS = (await import("exceljs")).default;
        const fs: any = await import("file-saver");
        const saveAs: (data: Blob, filename?: string) => void =
            fs.saveAs || fs.default?.saveAs || fs.default;

        const wb = new ExcelJS.Workbook();
        wb.creator = "SmartCliff LMS";
        wb.created = new Date();

        // Sheet 1: Summary
        const summary = wb.addWorksheet("Analytics Summary");
        summary.addRow(["Course", course?.courseName || ""]);
        summary.addRow(["Course Code", course?.courseCode || ""]);
        summary.addRow(["Client", course?.clientData?.clientCompany || ""]);
        summary.addRow(["Date Range", `${fmt(parseKey(appliedFrom))} → ${fmt(parseKey(appliedTo))}`]);
        summary.addRow([]);
        summary.addRow(["Metric", "Value"]);
        summary.addRow(["Average Attendance", `${totals.avgAttendance.toFixed(2)}%`]);
        summary.addRow(["Highest Attendance",
            highLow.hi ? `${highLow.hi.attPct.toFixed(2)}% — ${highLow.hi.student.firstName} ${highLow.hi.student.lastName}`.trim() : "—"]);
        summary.addRow(["Lowest Attendance",
            highLow.lo ? `${highLow.lo.attPct.toFixed(2)}% — ${highLow.lo.student.firstName} ${highLow.lo.student.lastName}`.trim() : "—"]);
        summary.addRow(["Total Present", totals.P]);
        summary.addRow(["Total Absent", totals.A]);
        summary.addRow(["Total Half-day", totals.H]);
        summary.addRow(["Not Marked", totals.N]);
        summary.getColumn(1).width = 24;
        summary.getColumn(2).width = 48;

        // Sheet 2: Top performers with autoFilter
        const perf = wb.addWorksheet("Top Performers", { views: [{ state: "frozen", ySplit: 1 }] });
        perf.addRow(["#", "Student Name", "Roll No.", "Attendance %", "Present", "Absent", "Half-day"]);
        const ph = perf.getRow(1);
        ph.font = { bold: true, color: { argb: "FFFFFFFF" } };
        ph.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
        ph.alignment = { vertical: "middle", horizontal: "center" };
        ph.height = 22;
        topPerformers.forEach((rs, i) =>
            perf.addRow([
                i + 1,
                `${rs.student.firstName} ${rs.student.lastName}`.trim() || "—",
                rs.student.userId || "",
                `${rs.attPct.toFixed(2)}%`,
                rs.p,
                rs.a,
                rs.h,
            ])
        );
        perf.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 7 } };
        perf.columns.forEach((c, i) => (c.width = i === 1 ? 26 : 16));

        // Sheet 3: By-day (autoFilter as well)
        const byDaySheet = wb.addWorksheet("By Day", { views: [{ state: "frozen", ySplit: 1 }] });
        byDaySheet.addRow(["Date", "Weekday", "Present", "Absent", "Half-day", "Not Marked"]);
        const bdh = byDaySheet.getRow(1);
        bdh.font = { bold: true, color: { argb: "FFFFFFFF" } };
        bdh.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
        bdh.alignment = { vertical: "middle", horizontal: "center" };
        bdh.height = 22;
        byDay.forEach((r) =>
            byDaySheet.addRow([r.label, r.weekday, r.Present, r.Absent, r["Half-day"], r["Not Marked"]])
        );
        byDaySheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };
        byDaySheet.columns.forEach((c) => (c.width = 16));

        const buf = await wb.xlsx.writeBuffer();
        const fname = `attendance_analytics_${course?.courseCode || courseId}_${appliedFrom}_${appliedTo}.xlsx`;
        saveAs(new Blob([buf], { type: "application/octet-stream" }), fname);
        setDownloadOpen(false);
    };

    const handlePdf = async () => {
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

        doc.setFontSize(16); doc.text("Attendance Analytics", 40, 48);
        doc.setFontSize(10);
        doc.text(`Course: ${course?.courseName || ""} (${course?.courseCode || ""})`, 40, 66);
        doc.text(`Date Range: ${fmt(parseKey(appliedFrom))} → ${fmt(parseKey(appliedTo))}`, 40, 80);

        let y = 108;
        doc.setFontSize(12); doc.text("Overview", 40, y); y += 10;
        doc.setDrawColor(230); doc.line(40, y, 555, y); y += 14;
        doc.setFontSize(10);
        const rows: [string, string][] = [
            ["Average Attendance", `${totals.avgAttendance.toFixed(2)}%`],
            ["Highest Attendance",
                highLow.hi ? `${highLow.hi.attPct.toFixed(2)}% — ${highLow.hi.student.firstName} ${highLow.hi.student.lastName}`.trim() : "—"],
            ["Lowest Attendance",
                highLow.lo ? `${highLow.lo.attPct.toFixed(2)}% — ${highLow.lo.student.firstName} ${highLow.lo.student.lastName}`.trim() : "—"],
            ["Total Present", String(totals.P)],
            ["Total Absent", String(totals.A)],
            ["Total Half-day", String(totals.H)],
            ["Not Marked", String(totals.N)],
        ];
        rows.forEach(([k, v]) => {
            doc.text(k, 40, y); doc.text(v, 300, y); y += 16;
        });

        y += 10;
        doc.setFontSize(12); doc.text("Top Performers", 40, y); y += 10;
        doc.line(40, y, 555, y); y += 14;
        doc.setFontSize(10);
        doc.text("#", 40, y); doc.text("Student", 60, y); doc.text("Enroll.", 240, y);
        doc.text("Att %", 340, y); doc.text("P", 400, y); doc.text("A", 430, y); doc.text("H", 460, y);
        y += 14;
        topPerformers.forEach((rs, i) => {
            doc.text(String(i + 1), 40, y);
            doc.text(`${rs.student.firstName} ${rs.student.lastName}`.trim().slice(0, 28), 60, y);
            doc.text(rs.student.userId || "-", 240, y);
            doc.text(`${rs.attPct.toFixed(2)}%`, 340, y);
            doc.text(String(rs.p), 400, y);
            doc.text(String(rs.a), 430, y);
            doc.text(String(rs.h), 460, y);
            y += 14;
        });

        const fname = `attendance_analytics_${course?.courseCode || courseId}_${appliedFrom}_${appliedTo}.pdf`;
        doc.save(fname);
        setDownloadOpen(false);
    };

    // ── Render ───────────────────────────────────────────────────────────
    if (!courseId) {
        return (
            <div className="p-8 text-center text-sm text-gray-600">
                No course selected.{" "}
                <a href="/lms/pages/attendancemanagement" className="text-indigo-600 hover:underline">
                    Go back
                </a>.
            </div>
        );
    }

    const loading = studentsLoading || summaryLoading;

    return (
        <div className={`${poppins.className} h-full overflow-y-auto px-6 py-4 space-y-4`}>
            <div className="space-y-4">
                        {/* Filters */}
                        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                                <div className="lg:col-span-4">
                                    <FilterField label="Date Range">
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="date"
                                                value={pendingFrom}
                                                onChange={(e) => setPendingFrom(e.target.value)}
                                                className="h-9 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                            />
                                            <span className="text-gray-400 shrink-0">–</span>
                                            <input
                                                type="date"
                                                value={pendingTo}
                                                onChange={(e) => setPendingTo(e.target.value)}
                                                className="h-9 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                            />
                                        </div>
                                    </FilterField>
                                </div>
                                <div className="lg:col-span-5">
                                    <FilterField label="Student">
                                        <select
                                            value={pendingStudent}
                                            onChange={(e) => setPendingStudent(e.target.value)}
                                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12.5px]"
                                        >
                                            <option value="all">All Students</option>
                                            {students.map((s) => (
                                                <option key={s._id} value={s._id}>
                                                    {`${s.firstName} ${s.lastName}`.trim() || s.email}
                                                </option>
                                            ))}
                                        </select>
                                    </FilterField>
                                </div>
                                <div className="lg:col-span-3 flex items-center gap-2">
                                    <Button
                                        onClick={applyFilters}
                                        className="h-9 flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold"
                                    >
                                        <Filter className="h-3.5 w-3.5 mr-1.5" /> Apply Filters
                                    </Button>
                                    <Button
                                        onClick={resetFilters}
                                        variant="outline"
                                        className="h-9 border-gray-300 text-gray-700 text-[12.5px] font-semibold"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Stat cards */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                            <StatCard
                                iconBg="bg-emerald-50 text-emerald-600"
                                icon={<UserCheck className="h-5 w-5" />}
                                label="Average Attendance"
                                value={`${totals.avgAttendance.toFixed(2)}%`}
                            />
                            <StatCard
                                iconBg="bg-indigo-50 text-indigo-600"
                                icon={<Trophy className="h-5 w-5" />}
                                label="Highest Attendance"
                                value={highLow.hi ? `${highLow.hi.attPct.toFixed(2)}%` : "—"}
                                sub={highLow.hi ? `${highLow.hi.student.firstName} ${highLow.hi.student.lastName}`.trim() : ""}
                            />
                            <StatCard
                                iconBg="bg-red-50 text-red-600"
                                icon={<TrendingDown className="h-5 w-5" />}
                                label="Lowest Attendance"
                                value={highLow.lo ? `${highLow.lo.attPct.toFixed(2)}%` : "—"}
                                sub={highLow.lo ? `${highLow.lo.student.firstName} ${highLow.lo.student.lastName}`.trim() : ""}
                            />
                            <StatCard
                                iconBg="bg-emerald-50 text-emerald-600"
                                icon={<UserCheck className="h-5 w-5" />}
                                label="Total Present"
                                value={String(totals.P)}
                            />
                            <StatCard
                                iconBg="bg-red-50 text-red-600"
                                icon={<UserX className="h-5 w-5" />}
                                label="Total Absent"
                                value={String(totals.A)}
                            />
                            <StatCard
                                iconBg="bg-amber-50 text-amber-600"
                                icon={<Clock className="h-5 w-5" />}
                                label="Total Half-day"
                                value={String(totals.H)}
                            />
                            <StatCard
                                iconBg="bg-gray-100 text-gray-500"
                                icon={<Circle className="h-5 w-5" />}
                                label="Not Marked"
                                value={String(totals.N)}
                            />
                        </div>

                        {/* Charts row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <ChartCard
                                title="Attendance Trend"
                                headerRight={
                                    <ToggleGroup
                                        options={[
                                            { value: "daily", label: "Daily View" },
                                            { value: "cumulative", label: "Cumulative" },
                                        ]}
                                        value={trendMode}
                                        onChange={(v) => setTrendMode(v as TrendMode)}
                                    />
                                }
                            >
                                <div className="h-[220px]">
                                    <ResponsiveContainer>
                                        <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                                            <CartesianGrid stroke="#f3f4f6" vertical={false} />
                                            <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                                            <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                                            <RTooltip contentStyle={{ fontSize: 11 }} />
                                            <RLegend wrapperStyle={{ fontSize: 11 }} />
                                            <Line type="monotone" dataKey="Present" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                                            <Line type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                                            <Line type="monotone" dataKey="Half-day" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>

                            <ChartCard title="Attendance Distribution">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-[190px] h-[190px]">
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: "Present", value: totals.P, color: "#10b981" },
                                                        { name: "Absent", value: totals.A, color: "#ef4444" },
                                                        { name: "Half-day", value: totals.H, color: "#f59e0b" },
                                                        { name: "Not Marked", value: totals.N, color: "#d1d5db" },
                                                    ]}
                                                    dataKey="value"
                                                    innerRadius={58}
                                                    outerRadius={84}
                                                    stroke="none"
                                                >
                                                    {["#10b981", "#ef4444", "#f59e0b", "#d1d5db"].map((c, i) => (
                                                        <Cell key={i} fill={c} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <div className="text-[20px] font-bold text-gray-900">
                                                {totals.avgAttendance.toFixed(2)}%
                                            </div>
                                            <div className="text-[10.5px] text-gray-500">Average</div>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-2 text-[11.5px]">
                                        <DistRow color="bg-emerald-500" label="Present" count={totals.P} total={totals.totalCells} />
                                        <DistRow color="bg-red-500" label="Absent" count={totals.A} total={totals.totalCells} />
                                        <DistRow color="bg-amber-500" label="Half-day" count={totals.H} total={totals.totalCells} />
                                        <DistRow color="bg-gray-300" label="Not Marked" count={totals.N} total={totals.totalCells} />
                                    </div>
                                </div>
                            </ChartCard>

                            <ChartCard
                                title="Attendance by Day"
                                headerRight={
                                    <ToggleGroup
                                        options={[
                                            { value: "percent", label: "By Percentage" },
                                            { value: "count", label: "By Count" },
                                        ]}
                                        value={dayMode}
                                        onChange={(v) => setDayMode(v as DayMode)}
                                    />
                                }
                            >
                                <div className="h-[220px]">
                                    <ResponsiveContainer>
                                        <BarChart data={byDay} margin={{ top: 8, right: 12, bottom: 0, left: -10 }}>
                                            <CartesianGrid stroke="#f3f4f6" vertical={false} />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 10 }}
                                                stroke="#9ca3af"
                                            />
                                            <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                                            <RTooltip contentStyle={{ fontSize: 11 }} />
                                            <RLegend wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="Present" stackId="s" fill="#10b981" />
                                            <Bar dataKey="Absent" stackId="s" fill="#ef4444" />
                                            <Bar dataKey="Half-day" stackId="s" fill="#f59e0b" />
                                            <Bar dataKey="Not Marked" stackId="s" fill="#d1d5db" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        </div>

                        {/* Top performers table */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                                <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                                    <Trophy className="h-4 w-4 text-amber-500" />
                                    Top Performers
                                </div>
                                <button
                                    onClick={goToReport}
                                    className="text-[11.5px] font-semibold text-indigo-600 hover:text-indigo-700"
                                >
                                    View All Students →
                                </button>
                            </div>

                            {loading ? (
                                <div className="py-12 flex items-center justify-center">
                                    <Loading size="size-8" />
                                </div>
                            ) : topPerformers.length === 0 ? (
                                <div className="py-12 text-center text-[13px] text-gray-500">
                                    No data for the current filters.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[12.5px]">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="w-10 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">#</th>
                                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Student Name</th>
                                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Roll No.</th>
                                                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Attendance %</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Present</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Absent</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Half-day</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {topPerformers.map((rs, i) => (
                                                <tr key={rs.student._id} className="border-b border-gray-100 hover:bg-gray-50/60">
                                                    <td className="px-3 py-2.5 text-[11px] text-gray-400 font-mono">
                                                        {String(i + 1).padStart(2, "0")}
                                                    </td>
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-semibold">
                                                                {(rs.student.firstName?.[0] || "?").toUpperCase()}
                                                                {(rs.student.lastName?.[0] || "").toUpperCase()}
                                                            </div>
                                                            <div className="font-medium text-gray-900">
                                                                {`${rs.student.firstName} ${rs.student.lastName}`.trim() || "—"}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2.5 text-gray-700">{rs.student.userId || "—"}</td>
                                                    <td className={`px-3 py-2.5 text-right font-semibold ${
                                                        rs.attPct >= 75 ? "text-emerald-600" : rs.attPct >= 50 ? "text-amber-600" : "text-red-600"
                                                    }`}>
                                                        {rs.attPct.toFixed(2)}%
                                                    </td>
                                                    <td className="px-3 py-2.5 text-center text-gray-800 font-semibold">{rs.p}</td>
                                                    <td className="px-3 py-2.5 text-center text-gray-800 font-semibold">{rs.a}</td>
                                                    <td className="px-3 py-2.5 text-center text-gray-800 font-semibold">{rs.h}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
            </div>

            {/* Download modal */}
            <AnimatePresence>
                    {downloadOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                            onClick={() => setDownloadOpen(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, y: 12 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.95, y: 12 }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl"
                            >
                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200">
                                    <div className="flex items-center gap-2">
                                        <Download className="h-4 w-4 text-indigo-600" />
                                        <h3 className="text-[14px] font-semibold text-gray-900">Download Analytics</h3>
                                    </div>
                                    <button
                                        onClick={() => setDownloadOpen(false)}
                                        className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="px-5 py-4 space-y-3">
                                    <p className="text-[12.5px] text-gray-600">
                                        Choose an export format. Excel includes filter dropdowns pre-applied and a summary sheet.
                                    </p>
                                    <button
                                        onClick={handleExcel}
                                        className="w-full flex items-center gap-3 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40 px-4 py-3 text-left transition"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                            <FileSpreadsheet className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[13px] font-semibold text-gray-900">Excel (.xlsx)</div>
                                            <div className="text-[11px] text-gray-500">Summary + Top Performers + By Day sheets, filterable</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={handlePdf}
                                        className="w-full flex items-center gap-3 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50/40 px-4 py-3 text-left transition"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-[13px] font-semibold text-gray-900">PDF (.pdf)</div>
                                            <div className="text-[11px] text-gray-500">Portrait, printable overview + top performers</div>
                                        </div>
                                    </button>
                                </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── UI helpers ─────────────────────────────────────────────────────────────
const FilterField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
        {children}
    </div>
);

const StatCard: React.FC<{
    iconBg: string;
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
}> = ({ iconBg, icon, label, value, sub }) => (
    <div className="bg-white rounded-xl border border-gray-200 px-3 py-3 flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            {icon}
        </div>
        <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium truncate">{label}</div>
            <div className="text-[15px] font-semibold text-gray-900 mt-0.5 truncate">{value}</div>
            {sub && <div className="text-[10.5px] text-gray-500 truncate">{sub}</div>}
        </div>
    </div>
);

const ChartCard: React.FC<{
    title: string;
    headerRight?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, headerRight, children }) => (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] font-semibold text-gray-900">{title}</div>
            {headerRight}
        </div>
        {children}
    </div>
);

const ToggleGroup: React.FC<{
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
}> = ({ options, value, onChange }) => (
    <div className="flex items-center bg-gray-100 rounded-md p-0.5 text-[11px] font-medium">
        {options.map((o) => (
            <button
                key={o.value}
                onClick={() => onChange(o.value)}
                className={`px-2.5 py-1 rounded transition ${
                    value === o.value ? "bg-white shadow text-indigo-700" : "text-gray-600"
                }`}
            >
                {o.label}
            </button>
        ))}
    </div>
);

const DistRow: React.FC<{
    color: string;
    label: string;
    count: number;
    total: number;
}> = ({ color, label, count, total }) => {
    const pct = total > 0 ? (count / total) * 100 : 0;
    return (
        <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-gray-700 font-medium">
                <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
            </span>
            <span className="text-gray-800 font-semibold">
                {count} <span className="text-[10.5px] text-gray-500 font-normal">({pct.toFixed(2)}%)</span>
            </span>
        </div>
    );
};
