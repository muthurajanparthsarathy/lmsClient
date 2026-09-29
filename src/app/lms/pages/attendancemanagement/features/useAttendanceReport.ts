"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import {
    useCourseStudentsQuery,
    useAttendanceSummaryQuery,
    useAttendanceRecordsForQuery,
} from "@/app/lms/pages/attendancemanagement/queries/attendance";
import type { CourseStructure } from "@/app/lms/pages/coursestructure/coursestructurecomponents/types";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index";
import {
    BANDS,
    MS_PER_DAY,
    bandOf,
    isWeekend,
    parseKey,
    startOfMonth,
    toDayKey,
    todayUtcDate,
    type StatusFilter,
    type Student,
    type StudentFilter,
    type ViewMode,
} from "@/app/lms/pages/attendancemanagement/features/attendanceReportShared";

export function useAttendanceReport() {
    const searchParams = useSearchParams();
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
    // The applied student list narrows the summary studentIds. "all" (or an
    // empty list) falls back to the whole roster, which is what the summary
    // needs to divide record counts by student counts consistently.
    const scopedStudentIds = useMemo(() => {
        if (appliedStudent === "all" || appliedStudent.length === 0) return rosterIds;
        const set = new Set(rosterIds);
        return appliedStudent.filter((id) => set.has(id));
    }, [appliedStudent, rosterIds]);
    const summaryScope = useMemo(
        () => ({ status: appliedStatus, studentIds: scopedStudentIds }),
        [appliedStatus, scopedStudentIds]
    );
    // Gated on the roster: an EMPTY studentIds is no scope at all rather than
    // "match nobody" — the same rule the sibling list endpoint follows — so an
    // ungated request would answer a not-yet-loaded roster with the whole
    // course. There is nothing to total before the roster lands in any case.
    const { data: summary, isLoading: summaryLoading } = useAttendanceSummaryQuery(
        courseId, appliedFrom, appliedTo, summaryScope, scopedStudentIds.length > 0
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

    // Apply student filter first, then compute stats.
    const visibleStudents = useMemo(() => {
        if (appliedStudent === "all" || appliedStudent.length === 0) return students;
        const set = new Set(appliedStudent);
        return students.filter((s) => set.has(s._id));
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

    // Cells for every student the filters keep — the table lists them all.
    const filteredIds = useMemo(() => filteredStudents.map((s) => s._id), [filteredStudents]);
    const { data: records = [] } = useAttendanceRecordsForQuery(
        courseId, appliedFrom, appliedTo, filteredIds
    );

    // studentId → dateKey → status, for the filtered students.
    const grid = useMemo(() => {
        const m = new Map<string, Map<string, "P" | "A" | "H">>();
        for (const r of records) {
            const sid = r.studentId?.toString?.() || (r.studentId as any);
            const dk = toDayKey(new Date(r.date));
            if (!m.has(sid)) m.set(sid, new Map());
            m.get(sid)!.set(dk, r.status);
        }
        return m;
    }, [records]);

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

    return {
        courseId, todayKey,
        pendingMode, setPendingMode, pendingDate, setPendingDate, pendingFrom, setPendingFrom, pendingTo, setPendingTo,
        pendingStudent, setPendingStudent, pendingStatus, setPendingStatus,
        appliedFrom, appliedTo, appliedStudent, appliedStatus,
        viewMode, setViewMode, canExport,
        course, students, studentsLoading, summaryLoading,
        workingDayList, workingDays, rowStats, filteredStudents, totals, bestDay, totalStudents, trend,
        grid,
        applyFilters, resetFilters,
    };
}
