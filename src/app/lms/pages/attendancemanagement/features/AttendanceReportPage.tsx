"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Report — course-scoped read-only report with filters, stats,
// summary table (Daily/Summary view), and 3 chart cards. Includes a
// Download Report modal (Excel/PDF).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from "react";
import { Poppins } from "next/font/google";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertTriangle,
    Award,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Clock,
    Download,
    FileSpreadsheet,
    FileText,
    Filter,
    LayoutGrid,
    LayoutList,
    RotateCcw,
    TrendingUp,
    Users,
    UserX,
    UserCheck,
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
} from "recharts";
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import {
    useCourseStudentsQuery,
    useAttendanceSummaryQuery,
    useAttendanceRecordsForQuery,
} from "@/app/lms/pages/attendancemanagement/queries/attendance";
import { attendanceApi } from "@/app/lms/pages/attendancemanagement/api/attendanceApi";
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

const isWeekend = (d: Date) => {
    const w = d.getUTCDay();
    return w === 0 || w === 6;
};

const startOfMonth = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
};

const todayUtcDate = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

// Show 13.5 as "13.5" but 13.0 as "13" in the present/working fractions.
const fmtNum = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

// ── Performance scale — attendance % → qualitative band ────────────────────
// Attendance % = (Days Present + ½ × Half-days) ÷ Total Working Days × 100.
type Band = {
    key: string;
    label: string;
    min: number;
    range: string;
    text: string;   // text colour
    chip: string;   // badge bg + border
    dot: string;    // legend dot
    bar: string;    // distribution bar fill
    hex: string;    // for PDF export
};
const BANDS: Band[] = [
    { key: "excellent", label: "Excellent", min: 90, range: "90–100%", text: "text-emerald-700", chip: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", bar: "bg-emerald-500", hex: "#10b981" },
    { key: "good",      label: "Good",      min: 75, range: "75–89%",  text: "text-sky-700",     chip: "bg-sky-50 border-sky-200",         dot: "bg-sky-500",     bar: "bg-sky-500",     hex: "#0ea5e9" },
    { key: "average",   label: "Average",   min: 60, range: "60–74%",  text: "text-amber-700",   chip: "bg-amber-50 border-amber-200",     dot: "bg-amber-500",   bar: "bg-amber-500",   hex: "#f59e0b" },
    { key: "poor",      label: "Poor",      min: 40, range: "40–59%",  text: "text-orange-700",  chip: "bg-orange-50 border-orange-200",   dot: "bg-orange-500",  bar: "bg-orange-500",  hex: "#f97316" },
    { key: "critical",  label: "Critical",  min: 0,  range: "Below 40%", text: "text-red-700",   chip: "bg-red-50 border-red-200",         dot: "bg-red-500",     bar: "bg-red-500",     hex: "#ef4444" },
];
const bandOf = (pct: number): Band =>
    BANDS.find((b) => pct >= b.min) ?? BANDS[BANDS.length - 1];

// ── Types ──────────────────────────────────────────────────────────────────
type Student = {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    userId?: string;
};

type StatusFilter = "all" | "P" | "A" | "H" | "N"; // N = Not Marked
type ViewMode = "daily" | "summary";
type StudentFilter = "all" | string;

// ── Component ──────────────────────────────────────────────────────────────
export default function AttendanceReportPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const courseId = searchParams.get("courseId") || "";

    // Page-level attendance access grants export — sub-functions were retired.
    const { can } = usePermissions();
    const canExport =
        can(PERMISSION_IDS.ADMIN_ATTENDANCE) ||
        can(PERMISSION_IDS.STAFF_ATTENDANCE);

    // Date filter — defaults to a single date (today); a "Date Range" radio
    // switches to a custom start → end range (prefilled month-to-date).
    const todayKey = useMemo(() => toDayKey(todayUtcDate()), []);
    const [pendingMode, setPendingMode] = useState<"single" | "range">("single");
    const [pendingDate, setPendingDate] = useState<string>(todayKey);
    const [pendingFrom, setPendingFrom] = useState<string>(toDayKey(startOfMonth()));
    const [pendingTo, setPendingTo] = useState<string>(todayKey);
    const [pendingStudent, setPendingStudent] = useState<StudentFilter>("all");
    const [pendingStatus, setPendingStatus] = useState<StatusFilter>("all");

    const [appliedFrom, setAppliedFrom] = useState<string>(todayKey);
    const [appliedTo, setAppliedTo] = useState<string>(todayKey);
    const [appliedStudent, setAppliedStudent] = useState<StudentFilter>("all");
    const [appliedStatus, setAppliedStatus] = useState<StatusFilter>("all");

    const [viewMode, setViewMode] = useState<ViewMode>("daily");
    const [page, setPage] = useState(1);
    const pageSize = 5;

    // Download signal from the layout:
    //   ?download=1        → main attendance report download modal
    //   ?download=remarks  → remarks-only report modal
    const downloadParam = searchParams.get("download") || "";
    const downloadOpen = downloadParam === "1" && canExport;
    const remarksDownloadOpen = downloadParam === "remarks" && canExport;
    const setDownloadOpen = (open: boolean) => {
        const params = new URLSearchParams(searchParams.toString());
        if (open) params.set("download", "1");
        else params.delete("download");
        const qs = params.toString();
        // Preserve the fragment — this component now also mounts inside the
        // hash-routed L&D console at #attendance, and dropping the hash would
        // silently kick the user back to the default section on reload/share.
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        router.replace(`${pathname}${qs ? `?${qs}` : ""}${hash}`);
    };
    const setRemarksDownloadOpen = (open: boolean) => {
        const params = new URLSearchParams(searchParams.toString());
        if (open) params.set("download", "remarks");
        else params.delete("download");
        const qs = params.toString();
        const hash = typeof window !== "undefined" ? window.location.hash : "";
        router.replace(`${pathname}${qs ? `?${qs}` : ""}${hash}`);
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

    // Shared with the Analytics page and the Report modal — one roster fetch
    // and one records fetch per course/range across all three views.
    const { data: students = [], isLoading: studentsLoading } = useCourseStudentsQuery(courseId);

    // ── The aggregates, computed in Mongo ────────────────────────────────
    // This page used to fetch EVERY attendance record in the range and build a
    // student x day grid in the browser purely to total it. Records grow as
    // students x marked days — 150 rows for the busiest course today, but a
    // 100-student cohort over 200 working days is 20,000 — so the sums come
    // back already computed and the browser keeps one small tally per student.
    //
    // The filters are part of the query identity because the SERVER scopes the
    // per-day series by them now.
    //
    // Scoped to the ROSTER as well, because the page divides one population by
    // the other: `trend` and `bestDay` read `summary.perDay`, which counts
    // RECORDS, and bestDay then divides by `filteredStudents.length`, which
    // counts table rows. A course can hold records for people who are in none
    // of its batches — SUN-BTB-SK-001 carries 150 records for 10 students
    // against a 5-student roster, the other 5 having been removed after they
    // were marked — so an unscoped perDay reported ~10 marks a day over a
    // 5-row denominator and the Best Day card read 180% present. Sending the
    // roster puts both sides of that division on the same people.
    // Verified by server/scripts/verifyAttendanceReport.js --break=scoped_off.
    const rosterIds = useMemo(
        () => Array.from(new Set(students.map((s) => s._id))),
        [students]
    );
    const summaryScope = useMemo(
        () => ({ student: appliedStudent, status: appliedStatus, studentIds: rosterIds }),
        [appliedStudent, appliedStatus, rosterIds]
    );
    // Gated on the roster: an EMPTY studentIds is no scope at all rather than
    // "match nobody" — the same rule the sibling list endpoint follows — so an
    // ungated request would answer a not-yet-loaded roster with the whole
    // course. There is nothing to total before the roster lands in any case.
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

    // Dates that actually carry at least one mark — lets a Saturday class
    // count as a working day when attendance was taken on it. Counted in Mongo
    // now; the rule below is unchanged.
    const markedDayKeys = useMemo(
        () => new Set(summary?.markedDays ?? []),
        [summary]
    );

    // Working days = weekdays in the range + any weekend day with marks.
    const workingDayList = useMemo(
        () => days.filter((d) => !isWeekend(d) || markedDayKeys.has(toDayKey(d))),
        [days, markedDayKeys]
    );
    const workingDays = workingDayList.length;

    // studentId → P/A/H tally. A student the summary never mentions holds no
    // records at all, which is not the same as one the filter removed — so the
    // tallies arrive unfiltered and the status rule below is applied here, in
    // the one place it is written.
    const tallyById = useMemo(() => {
        const m = new Map<string, { p: number; a: number; h: number }>();
        for (const t of summary?.students ?? []) m.set(t.studentId, { p: t.p, a: t.a, h: t.h });
        return m;
    }, [summary]);

    // Per-student stats over the working days:
    //   Attendance % = (Days Present + half x Half-days) / Working Days x 100
    //   e.g. 13 present of 25 working days → 13 / 25 x 100 = 52%.
    // A day carrying any mark is always a working day, so a student's marks in
    // range ARE their marks on working days, and the unmarked count is simply
    // the remainder — no cell-by-cell walk is needed to find it.
    const rowStats = (sid: string) => {
        const t = tallyById.get(sid) || { p: 0, a: 0, h: 0 };
        const p = t.p, a = t.a, h = t.h;
        const n = Math.max(0, workingDays - (p + a + h));
        const effPresent = p + h * 0.5; // half-day counts as half a present day
        const attPct = workingDays > 0 ? (effPresent / workingDays) * 100 : 0;
        return { p, a, h, n, effPresent, attPct, band: bandOf(attPct) };
    };

    // Apply student filter first, then compute stats
    const visibleStudents = useMemo(() => {
        if (appliedStudent === "all") return students;
        return students.filter((s) => s._id === appliedStudent);
    }, [students, appliedStudent]);

    // Apply status filter — hides rows where student has no cell matching the status
    // "Keep a student with at least one matching cell" — the same rule, read
    // off the tallies. "N" means at least one working day with no mark, which
    // is exactly a non-zero unmarked remainder; that is also what admits a
    // roster student holding no records at all.
    const filteredStudents = useMemo(() => {
        if (appliedStatus === "all") return visibleStudents;
        return visibleStudents.filter((s) => {
            const t = tallyById.get(s._id) || { p: 0, a: 0, h: 0 };
            if (appliedStatus === "P") return t.p > 0;
            if (appliedStatus === "A") return t.a > 0;
            if (appliedStatus === "H") return t.h > 0;
            if (appliedStatus === "N") return workingDays - (t.p + t.a + t.h) > 0;
            return true;
        });
    }, [visibleStudents, appliedStatus, tallyById, workingDays]);

    // Totals + class-level insights across the visible students
    const totals = useMemo(() => {
        let P = 0, A = 0, H = 0, N = 0;
        const perStudent: { s: Student; attPct: number; effPresent: number }[] = [];
        for (const s of filteredStudents) {
            const rs = rowStats(s._id);
            P += rs.p; A += rs.a; H += rs.h; N += rs.n;
            perStudent.push({ s, attPct: rs.attPct, effPresent: rs.effPresent });
        }
        const totalCells = P + A + H + N; // = workingDays × students
        const totalMarked = P + A + H;
        const avgAttendance = totalCells > 0 ? ((P + H * 0.5) / totalCells) * 100 : 0;

        // Performance-scale distribution + top/bottom performers.
        const bandCounts = BANDS.map((band) => ({
            band,
            count: perStudent.filter((x) => bandOf(x.attPct).key === band.key).length,
        }));
        const sorted = [...perStudent].sort((x, y) => y.attPct - x.attPct);
        const top = sorted[0];
        const low = sorted.length > 0 ? sorted[sorted.length - 1] : undefined;
        const atRisk = perStudent.filter((x) => x.attPct < 75).length;

        return {
            P, A, H, N,
            totalCells,
            totalMarked,
            pPct: totalMarked > 0 ? (P / totalMarked) * 100 : 0,
            aPct: totalMarked > 0 ? (A / totalMarked) * 100 : 0,
            hPct: totalMarked > 0 ? (H / totalMarked) * 100 : 0,
            nPct: totalCells > 0 ? (N / totalCells) * 100 : 0,
            avgAttendance,
            bandCounts,
            top,
            low,
            atRisk,
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredStudents, tallyById, workingDays]);

    // Per-day counts over the students that passed the filters, summed in
    // Mongo. Zero-filled here because the page reads a value for every working
    // day, including ones nobody was marked on.
    const perDayMap = useMemo(() => {
        const m = new Map<string, { P: number; A: number; H: number }>();
        for (const d of summary?.perDay ?? []) m.set(d.key, { P: d.P, A: d.A, H: d.H });
        return m;
    }, [summary]);

    // Day with the highest present ratio — a small "best day" insight.
    const bestDay = useMemo(() => {
        let best: { d: Date; pct: number } | null = null;
        for (const d of workingDayList) {
            const c = perDayMap.get(toDayKey(d));
            const present = (c?.P || 0) + (c?.H || 0) * 0.5;
            const pct = filteredStudents.length > 0 ? (present / filteredStudents.length) * 100 : 0;
            if (present > 0 && (!best || pct > best.pct)) best = { d, pct };
        }
        return best;
    }, [workingDayList, filteredStudents.length, perDayMap]);

    const totalStudents = students.length;

    // Attendance trend per working day (for line chart)
    const trend = useMemo(() => {
        return workingDayList.map((d) => {
            const c = perDayMap.get(toDayKey(d));
            return {
                label: d.toLocaleString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }),
                Present: c?.P || 0,
                Absent: c?.A || 0,
                "Half-day": c?.H || 0,
            };
        });
    }, [workingDayList, perDayMap]);

    // ── Pagination ───────────────────────────────────────────────────────
    // Page 1 on any filter change — adjusted DURING render against a
    // signature. In an effect this would first fire a request for the old page.
    const pageSig = JSON.stringify([appliedFrom, appliedTo, appliedStudent, appliedStatus, viewMode]);
    const [lastPageSig, setLastPageSig] = useState(pageSig);
    if (lastPageSig !== pageSig) { setLastPageSig(pageSig); setPage(1); }

    const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
    // The roster is class-sized and already loaded, so the page of students is
    // taken from it; what is NOT taken from memory is their attendance.
    const pagedStudents = filteredStudents.slice((page - 1) * pageSize, page * pageSize);

    // Cells for the students on screen — five students' rows, not the course's.
    const pagedIds = useMemo(() => pagedStudents.map((s) => s._id), [pagedStudents]);
    const { data: pageRecords = [] } = useAttendanceRecordsForQuery(
        courseId, appliedFrom, appliedTo, pagedIds
    );

    // studentId → dateKey → status, for the visible rows only.
    const grid = useMemo(() => {
        const m = new Map<string, Map<string, "P" | "A" | "H">>();
        for (const r of pageRecords) {
            const sid = r.studentId?.toString?.() || (r.studentId as any);
            const dk = toDayKey(new Date(r.date));
            if (!m.has(sid)) m.set(sid, new Map());
            m.get(sid)!.set(dk, r.status);
        }
        return m;
    }, [pageRecords]);

    // ── Actions ──────────────────────────────────────────────────────────
    const applyFilters = () => {
        if (pendingMode === "single") {
            setAppliedFrom(pendingDate);
            setAppliedTo(pendingDate);
        } else {
            // Guard a reversed range — swap instead of returning nothing.
            const [from, to] =
                pendingFrom <= pendingTo ? [pendingFrom, pendingTo] : [pendingTo, pendingFrom];
            setAppliedFrom(from);
            setAppliedTo(to);
        }
        setAppliedStudent(pendingStudent);
        setAppliedStatus(pendingStatus);
    };
    const resetFilters = () => {
        setPendingMode("single");
        setPendingDate(todayKey);
        setPendingFrom(toDayKey(startOfMonth())); setPendingTo(todayKey);
        setPendingStudent("all"); setPendingStatus("all");
        setAppliedFrom(todayKey); setAppliedTo(todayKey);
        setAppliedStudent("all"); setAppliedStatus("all");
    };

    // ── Export handlers ──────────────────────────────────────────────────
    const handleExcel = async () => {
        // The spreadsheet carries a cell per (filtered student x working day),
        // and the grid above only holds the page on screen — so the export
        // fetches the rows for every student it is about to write. Without
        // this it would silently emit "-" for everyone off the current page.
        const exportIds = filteredStudents.map((s) => s._id);
        let exportGrid = grid;
        if (exportIds.length) {
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

        const header = [
            "#",
            "Student Name",
            "Roll No.",
            "Email",
            ...workingDayList.map((d) => `${fmt(d)} (${fmtWeekday(d)})`),
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
            const dayCells = workingDayList.map((d) => exportGrid.get(s._id)?.get(toDayKey(d)) || "-");
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
            else if (idx >= 4 && idx < 4 + workingDayList.length) col.width = 18;
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
        meta.addRow([
            "Student Filter",
            appliedStudent === "all"
                ? "All Students"
                : students.find((s) => s._id === appliedStudent)?.firstName + " " +
                  (students.find((s) => s._id === appliedStudent)?.lastName || ""),
        ]);
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
        const fname = `attendance_report_${course?.courseCode || courseId}_${appliedFrom}_${appliedTo}.xlsx`;
        saveAs(new Blob([buf], { type: "application/octet-stream" }), fname);
        setDownloadOpen(false);
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

        const fname = `attendance_report_${course?.courseCode || courseId}_${appliedFrom}_${appliedTo}.pdf`;
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
                            {/* col spans sum to 12: Date=3, Student=3, Status=2, Buttons=4.
                                Buttons column carries two side-by-side buttons — at col-span-3
                                and a narrow embedding pane (e.g. inside the L&D dashboard's
                                Attendance tab), Reset overflowed. col-span-4 fits both here
                                and on the standalone /attendancemanagement/report page. */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
                                <div className="lg:col-span-3">
                                    <div className="flex items-center gap-3 mb-1">
                                        <span className="text-[11px] font-medium text-gray-600">Date</span>
                                        <label className="inline-flex items-center gap-1 text-[11px] text-gray-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="report-date-mode"
                                                checked={pendingMode === "single"}
                                                onChange={() => setPendingMode("single")}
                                                className="h-3 w-3 accent-indigo-600 cursor-pointer"
                                            />
                                            Single Date
                                        </label>
                                        <label className="inline-flex items-center gap-1 text-[11px] text-gray-700 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="report-date-mode"
                                                checked={pendingMode === "range"}
                                                onChange={() => setPendingMode("range")}
                                                className="h-3 w-3 accent-indigo-600 cursor-pointer"
                                            />
                                            Date Range
                                        </label>
                                    </div>
                                    {pendingMode === "single" ? (
                                        <input
                                            type="date"
                                            value={pendingDate}
                                            max={todayKey}
                                            onChange={(e) => e.target.value && setPendingDate(e.target.value)}
                                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                        />
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="date"
                                                value={pendingFrom}
                                                max={todayKey}
                                                onChange={(e) => e.target.value && setPendingFrom(e.target.value)}
                                                className="h-9 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                                title="Start date"
                                            />
                                            <span className="text-gray-400 shrink-0">–</span>
                                            <input
                                                type="date"
                                                value={pendingTo}
                                                max={todayKey}
                                                onChange={(e) => e.target.value && setPendingTo(e.target.value)}
                                                className="h-9 flex-1 min-w-0 rounded-md border border-gray-300 bg-white px-2 text-[12px]"
                                                title="End date"
                                            />
                                        </div>
                                    )}
                                </div>
                                <div className="lg:col-span-3">
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
                                <div className="lg:col-span-2">
                                    <FilterField label="Status">
                                        <select
                                            value={pendingStatus}
                                            onChange={(e) => setPendingStatus(e.target.value as StatusFilter)}
                                            className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-[12.5px]"
                                        >
                                            <option value="all">All</option>
                                            <option value="P">Present</option>
                                            <option value="A">Absent</option>
                                            <option value="H">Half-day</option>
                                            <option value="N">Not Marked</option>
                                        </select>
                                    </FilterField>
                                </div>
                                <div className="lg:col-span-4 flex items-center gap-2 min-w-0">
                                    <Button
                                        onClick={applyFilters}
                                        className="h-9 flex-1 min-w-0 bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-semibold whitespace-nowrap"
                                    >
                                        <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" /> Apply Filters
                                    </Button>
                                    <Button
                                        onClick={resetFilters}
                                        variant="outline"
                                        className="h-9 shrink-0 border-gray-300 text-gray-700 text-[12.5px] font-semibold whitespace-nowrap"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5 shrink-0" /> Reset
                                    </Button>
                                </div>
                            </div>
                        </div>


                        {/* Stat cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <StatCard
                                iconBg="bg-indigo-50 text-indigo-600"
                                icon={<Users className="h-5 w-5" />}
                                label="Total Students"
                                value={String(totalStudents)}
                            />
                            <StatCard
                                iconBg="bg-violet-50 text-violet-600"
                                icon={<CalendarDays className="h-5 w-5" />}
                                label="Total Working Days"
                                value={String(workingDays)}
                                sub="(excl. weekends)"
                            />
                            <StatCard
                                iconBg="bg-emerald-50 text-emerald-600"
                                icon={<TrendingUp className="h-5 w-5" />}
                                label="Class Average"
                                value={`${totals.avgAttendance.toFixed(2)}%`}
                                sub={bandOf(totals.avgAttendance).label}
                            />
                            <StatCard
                                iconBg="bg-rose-50 text-rose-600"
                                icon={<AlertTriangle className="h-5 w-5" />}
                                label="At Risk (< 75%)"
                                value={String(totals.atRisk)}
                                sub={totals.atRisk === 1 ? "student" : "students"}
                            />
                            <StatCard
                                iconBg="bg-emerald-50 text-emerald-600"
                                icon={<UserCheck className="h-5 w-5" />}
                                label="Present"
                                value={String(totals.P)}
                                sub={`(${totals.pPct.toFixed(2)}%)`}
                            />
                            <StatCard
                                iconBg="bg-red-50 text-red-600"
                                icon={<UserX className="h-5 w-5" />}
                                label="Absent"
                                value={String(totals.A)}
                                sub={`(${totals.aPct.toFixed(2)}%)`}
                            />
                            <StatCard
                                iconBg="bg-amber-50 text-amber-600"
                                icon={<Clock className="h-5 w-5" />}
                                label="Half-day"
                                value={String(totals.H)}
                                sub={`(${totals.hPct.toFixed(2)}%)`}
                            />
                            <StatCard
                                iconBg="bg-gray-100 text-gray-500"
                                icon={<Circle className="h-5 w-5" />}
                                label="Not Marked"
                                value={String(totals.N)}
                                sub={`(${totals.nPct.toFixed(2)}%)`}
                            />
                        </div>

                        {/* Attendance Summary */}
                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                                <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-900">
                                    <Users className="h-4 w-4 text-orange-600" />
                                    Attendance Summary
                                </div>
                                <div className="flex items-center bg-gray-100 rounded-md p-0.5 text-[11.5px] font-medium">
                                    <button
                                        onClick={() => setViewMode("daily")}
                                        className={`px-3 py-1 rounded flex items-center gap-1.5 transition ${viewMode === "daily" ? "bg-white shadow text-indigo-700" : "text-gray-600"}`}
                                    >
                                        <LayoutGrid className="h-3.5 w-3.5" /> Daily View
                                    </button>
                                    <button
                                        onClick={() => setViewMode("summary")}
                                        className={`px-3 py-1 rounded flex items-center gap-1.5 transition ${viewMode === "summary" ? "bg-white shadow text-indigo-700" : "text-gray-600"}`}
                                    >
                                        <LayoutList className="h-3.5 w-3.5" /> Summary View
                                    </button>
                                </div>
                            </div>

                            {loading ? (
                                <div className="py-12 flex items-center justify-center">
                                    <Loading size="size-8" />
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="py-12 text-center text-[13px] text-gray-500">
                                    No students match the current filters.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-[12.5px]">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="w-10 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">#</th>
                                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Student Name</th>
                                                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">Roll No.</th>
                                                {viewMode === "daily" &&
                                                    workingDayList.map((d) => {
                                                        const weekend = isWeekend(d);
                                                        return (
                                                            <th
                                                                key={toDayKey(d)}
                                                                className={`px-2 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider ${weekend ? "text-red-500" : "text-gray-500"}`}
                                                            >
                                                                <div>{fmt(d)}</div>
                                                                <div className="mt-0.5">{fmtWeekday(d)}</div>
                                                            </th>
                                                        );
                                                    })}
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Working Days</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Days Present</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Absent</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Half-day</th>
                                                <th className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-gray-500">Attendance %</th>
                                                <th className="px-3 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">Performance</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pagedStudents.map((s, i) => {
                                                const rs = rowStats(s._id);
                                                return (
                                                    <tr key={s._id} className="border-b border-gray-100 hover:bg-gray-50/60">
                                                        <td className="px-3 py-2.5 text-[11px] text-gray-400 font-mono">
                                                            {String((page - 1) * pageSize + i + 1).padStart(2, "0")}
                                                        </td>
                                                        <td className="px-3 py-2.5">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-semibold">
                                                                    {(s.firstName?.[0] || "?").toUpperCase()}
                                                                    {(s.lastName?.[0] || "").toUpperCase()}
                                                                </div>
                                                                <div className="font-medium text-gray-900">
                                                                    {`${s.firstName} ${s.lastName}`.trim() || "—"}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-gray-700">{s.userId || "—"}</td>
                                                        {viewMode === "daily" &&
                                                            workingDayList.map((d) => {
                                                                const dk = toDayKey(d);
                                                                const st = grid.get(s._id)?.get(dk);
                                                                return (
                                                                    <td key={dk} className="px-2 py-2 text-center">
                                                                        <StatusPill status={st} />
                                                                    </td>
                                                                );
                                                            })}
                                                        <td className="px-3 py-2.5 text-center text-gray-800 font-semibold">{workingDays}</td>
                                                        <td className="px-3 py-2.5 text-center text-emerald-700 font-semibold">{rs.p}</td>
                                                        <td className="px-3 py-2.5 text-center text-red-600 font-semibold">{rs.a}</td>
                                                        <td className="px-3 py-2.5 text-center text-amber-600 font-semibold">{rs.h}</td>
                                                        <td className="px-3 py-2.5 text-right">
                                                            <div className={`font-semibold ${rs.band.text}`}>
                                                                {rs.attPct.toFixed(2)}%
                                                            </div>
                                                            <div
                                                                className="text-[10px] text-gray-400"
                                                                title={`(${fmtNum(rs.effPresent)} ÷ ${workingDays}) × 100 — half-day counts as ½`}
                                                            >
                                                                {fmtNum(rs.effPresent)}/{workingDays} days
                                                            </div>
                                                            <div className="mt-1 h-1 w-20 ml-auto rounded-full bg-gray-100 overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full ${rs.band.bar}`}
                                                                    style={{ width: `${Math.min(100, Math.max(0, rs.attPct))}%` }}
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2.5 text-center">
                                                            <span
                                                                className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${rs.band.chip} ${rs.band.text}`}
                                                                title={`${rs.band.label}: ${rs.band.range} attendance`}
                                                            >
                                                                {rs.band.label}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Pagination */}
                            {filteredStudents.length > pageSize && (
                                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 text-[11.5px] text-gray-600">
                                    <span>
                                        Showing {(page - 1) * pageSize + 1} to{" "}
                                        {Math.min(page * pageSize, filteredStudents.length)} of{" "}
                                        {filteredStudents.length} students
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </PageBtn>
                                        {Array.from({ length: totalPages }).slice(0, 5).map((_, i) => (
                                            <PageBtn
                                                key={i}
                                                onClick={() => setPage(i + 1)}
                                                active={page === i + 1}
                                            >
                                                {i + 1}
                                            </PageBtn>
                                        ))}
                                        <PageBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </PageBtn>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                            <ChartCard title="Attendance Percentage">
                                <div className="flex items-center gap-4">
                                    <div className="relative w-[160px] h-[160px]">
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
                                                    innerRadius={50}
                                                    outerRadius={72}
                                                    stroke="none"
                                                >
                                                    {[
                                                        "#10b981", "#ef4444", "#f59e0b", "#d1d5db",
                                                    ].map((c, i) => (
                                                        <Cell key={i} fill={c} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <div className="text-[18px] font-bold text-gray-900">
                                                {totals.avgAttendance.toFixed(2)}%
                                            </div>
                                            <div className="text-[10.5px] text-gray-500">Average</div>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-1.5 text-[11.5px]">
                                        <LegendRow color="bg-emerald-500" label="Present" value={`${totals.pPct.toFixed(2)}% (${totals.P})`} />
                                        <LegendRow color="bg-red-500" label="Absent" value={`${totals.aPct.toFixed(2)}% (${totals.A})`} />
                                        <LegendRow color="bg-amber-500" label="Half-day" value={`${totals.hPct.toFixed(2)}% (${totals.H})`} />
                                        <LegendRow color="bg-gray-300" label="Not Marked" value={`${totals.nPct.toFixed(2)}% (${totals.N})`} />
                                    </div>
                                </div>
                            </ChartCard>

                            <ChartCard title="Attendance Trend">
                                <div className="h-[180px]">
                                    <ResponsiveContainer>
                                        <LineChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
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

                            <ChartCard title="Performance Scale">
                                <div className="space-y-2.5">
                                    {totals.bandCounts.map(({ band, count }) => {
                                        const share =
                                            filteredStudents.length > 0
                                                ? (count / filteredStudents.length) * 100
                                                : 0;
                                        return (
                                            <div key={band.key}>
                                                <div className="flex items-center justify-between text-[11.5px]">
                                                    <span className="inline-flex items-center gap-1.5 text-gray-700">
                                                        <span className={`h-2 w-2 rounded-full ${band.dot}`} />
                                                        <span className="font-semibold">{band.label}</span>
                                                        <span className="text-gray-400">{band.range}</span>
                                                    </span>
                                                    <span className="font-medium text-gray-700">
                                                        {count} student{count === 1 ? "" : "s"}
                                                    </span>
                                                </div>
                                                <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${band.bar}`}
                                                        style={{ width: `${share}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <p className="pt-1 text-[10.5px] text-gray-400 border-t border-gray-100">
                                        Attendance % = (Days Present + ½ × Half-days) ÷ {workingDays} Working Days × 100
                                    </p>
                                </div>
                            </ChartCard>
                        </div>

                        {/* Key insights */}
                        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                            <div className="text-[13px] font-semibold text-gray-900 mb-3">Key Insights</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                <InsightTile
                                    icon={<Award className="h-4 w-4" />}
                                    iconBg="bg-emerald-50 text-emerald-600"
                                    label="Top Performer"
                                    value={
                                        totals.top
                                            ? `${totals.top.s.firstName} ${totals.top.s.lastName}`.trim() || "—"
                                            : "—"
                                    }
                                    sub={
                                        totals.top
                                            ? `${totals.top.attPct.toFixed(1)}% · ${fmtNum(totals.top.effPresent)}/${workingDays} days`
                                            : "No data in range"
                                    }
                                />
                                <InsightTile
                                    icon={<AlertTriangle className="h-4 w-4" />}
                                    iconBg="bg-red-50 text-red-600"
                                    label="Needs Attention"
                                    value={
                                        totals.low
                                            ? `${totals.low.s.firstName} ${totals.low.s.lastName}`.trim() || "—"
                                            : "—"
                                    }
                                    sub={
                                        totals.low
                                            ? `${totals.low.attPct.toFixed(1)}% · ${fmtNum(totals.low.effPresent)}/${workingDays} days`
                                            : "No data in range"
                                    }
                                />
                                <InsightTile
                                    icon={<CalendarDays className="h-4 w-4" />}
                                    iconBg="bg-sky-50 text-sky-600"
                                    label="Best Day"
                                    value={bestDay ? `${fmt(bestDay.d)} (${fmtWeekday(bestDay.d)})` : "—"}
                                    sub={
                                        bestDay
                                            ? `${bestDay.pct.toFixed(1)}% of the class present`
                                            : "No marks in range"
                                    }
                                />
                                <InsightTile
                                    icon={<TrendingUp className="h-4 w-4" />}
                                    iconBg="bg-indigo-50 text-indigo-600"
                                    label="Class Standing"
                                    value={`${totals.avgAttendance.toFixed(1)}% · ${bandOf(totals.avgAttendance).label}`}
                                    sub={`${totals.atRisk} of ${filteredStudents.length} student${filteredStudents.length === 1 ? "" : "s"} below 75%`}
                                />
                            </div>
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
                                        <h3 className="text-[14px] font-semibold text-gray-900">Download Report</h3>
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
                                        Choose an export format. Excel includes the filter dropdowns pre-applied to each column so you can filter in-place when the file opens.
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
                                            <div className="text-[11px] text-gray-500">Column filters + a Summary &amp; Insights sheet (working days, %, performance scale)</div>
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
                                            <div className="text-[11px] text-gray-500">Landscape, with key insights block and performance scale</div>
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
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>{icon}</div>
        <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-wider text-gray-500 font-medium">{label}</div>
            <div className="text-[15px] font-semibold text-gray-900 mt-0.5">
                {value}{" "}
                {sub && <span className="text-[11px] text-gray-500 font-medium">{sub}</span>}
            </div>
        </div>
    </div>
);

const InsightTile: React.FC<{
    icon: React.ReactNode;
    iconBg: string;
    label: string;
    value: string;
    sub?: string;
}> = ({ icon, iconBg, label, value, sub }) => (
    <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 flex items-start gap-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
        </div>
        <div className="min-w-0">
            <div className="text-[10.5px] uppercase tracking-wider text-gray-500 font-medium">{label}</div>
            <div className="text-[13px] font-semibold text-gray-900 truncate mt-0.5">{value}</div>
            {sub && <div className="text-[11px] text-gray-500 mt-0.5">{sub}</div>}
        </div>
    </div>
);

const StatusPill: React.FC<{ status?: "P" | "A" | "H" }> = ({ status }) => {
    if (!status) {
        return (
            <span className="inline-block w-8 h-6 rounded-md bg-gray-50 border border-gray-200 text-gray-400 text-[11px] leading-6">
                –
            </span>
        );
    }
    const map: Record<string, string> = {
        P: "bg-emerald-50 border-emerald-200 text-emerald-700",
        A: "bg-red-50 border-red-200 text-red-700",
        H: "bg-amber-50 border-amber-200 text-amber-700",
    };
    return (
        <span className={`inline-block w-8 h-6 rounded-md border text-[11px] font-semibold leading-6 ${map[status]}`}>
            {status}
        </span>
    );
};

const PageBtn: React.FC<{
    onClick?: () => void;
    disabled?: boolean;
    active?: boolean;
    children: React.ReactNode;
}> = ({ onClick, disabled, active, children }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`h-6 min-w-6 px-2 rounded-md text-[11px] font-medium flex items-center justify-center transition ${
            active
                ? "bg-indigo-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
        {children}
    </button>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="text-[13px] font-semibold text-gray-900 mb-3">{title}</div>
        {children}
    </div>
);

const LegendRow: React.FC<{ color: string; label: string; value: string }> = ({ color, label, value }) => (
    <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-gray-700">
            <span className={`h-2 w-2 rounded-full ${color}`} /> {label}
        </span>
        <span className="text-gray-600 font-medium">{value}</span>
    </div>
);

const labelForStatus = (s: StatusFilter) => {
    if (s === "P") return "Present";
    if (s === "A") return "Absent";
    if (s === "H") return "Half-day";
    if (s === "N") return "Not Marked";
    return "All";
};
