"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import { useCourseStudentsQuery, useAttendanceSummaryQuery } from "@/app/lms/pages/attendancemanagement/queries/attendance";
import type { CourseStructure } from "@/app/lms/pages/coursestructure/coursestructurecomponents/types";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index";
import {
    MS_PER_DAY,
    addDays,
    fmt,
    fmtWeekday,
    parseKey,
    startOfWeekMon,
    toDayKey,
    type DayMode,
    type StudentFilter,
    type TrendMode,
} from "@/app/lms/pages/attendancemanagement/features/attendanceAnalyticsShared";

export function useAttendanceAnalytics() {
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

    return {
        courseId,
        pendingFrom, setPendingFrom, pendingTo, setPendingTo, pendingStudent, setPendingStudent,
        trendMode, setTrendMode, dayMode, setDayMode,
        downloadOpen, setDownloadOpen,
        students, studentsLoading, summaryLoading,
        totals, highLow, topPerformers, trend, byDay,
        applyFilters, resetFilters, goToReport, handleExcel, handlePdf,
    };
}
