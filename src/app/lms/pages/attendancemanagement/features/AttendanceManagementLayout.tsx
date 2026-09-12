"use client";

// Persistent shell for the Attendance Management area — the header, course
// title, and tabs stay mounted across sub-routes so only the body swaps on
// tab clicks.

import React, { useEffect, useState } from "react";
import { Poppins } from "next/font/google";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
    ArrowLeft,
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Download as DownloadIcon,
    Loader2,
    MessageSquareWarning,
    RotateCcw,
} from "lucide-react";
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import { attendanceApi } from "@/app/lms/pages/attendancemanagement/api/attendanceApi";
import { useInvalidateAttendance } from "@/app/lms/pages/attendancemanagement/queries/attendance";
import DashboardLayout from "@/app/lms/component/layout";
import LDLayout from "@/app/lms/component/ldshell/LDLayout";
import type { CourseStructure } from "@/app/lms/pages/coursestructure/coursestructurecomponents/types";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index";

// Anyone whose signed-in role is L&D (Head / Subhead) keeps the L&D Console
// shell here — bookmark, direct URL, or `?from=ldc` all land on the same
// sidebar. Without the role check an L&D user arriving without `from=ldc`
// (e.g. a bookmark) fell through to the admin DashboardLayout and saw the
// wrong sidebar (L&D Dashboard / Notification / Business Management / …).
function isLdRole(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const raw = localStorage.getItem("smartcliff_userData");
        const u = raw ? JSON.parse(raw) : null;
        const role = u?.role;
        const roleStr = String(
            (typeof role === "object" ? role?.roleValue || role?.originalRole || role?.renameRole : role) ||
                localStorage.getItem("smartcliff_originalRole") ||
                "",
        )
            .toLowerCase()
            .replace(/[^a-z]/g, "");
        return roleStr.includes("ldhead") || roleStr.includes("subhead");
    } catch {
        return false;
    }
}

function AttmShell({ fromLdc, children }: { fromLdc: boolean; children: React.ReactNode }) {
    // Read the stored user in an effect so the first paint isn't gated on
    // localStorage (SSR safe). Default guess: fromLdc still forces LD; role
    // check kicks in on the client so direct-URL / bookmark hits also land
    // on the L&D sidebar.
    const [ldRole, setLdRole] = useState(false);
    useEffect(() => { setLdRole(isLdRole()); }, []);
    const useLd = fromLdc || ldRole;
    if (useLd) return <LDLayout active="attendance">{children}</LDLayout>;
    return <DashboardLayout>{children}</DashboardLayout>;
}

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

// ── Date helpers (kept in-file so the Management tab can drive day nav) ──
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
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * MS_PER_DAY);
// Midnight UTC of "today" — the latest markable day.
const todayUtc = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
const fmt = (d: Date) => {
    const day = d.getUTCDate();
    const mon = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
    const yr = d.getUTCFullYear();
    return `${String(day).padStart(2, "0")}-${mon}-${yr}`;
};

export default function AttendanceManagementLayout({ children }: { children: React.ReactNode }) {
    const searchParams = useSearchParams();
    const pathname = usePathname() || "";
    const router = useRouter();
    const courseId = searchParams.get("courseId");
    const fromLdc = searchParams.get("from") === "ldc";

    // Attendance is page-level only in the tree — page presence grants every
    // in-page action (reports, edit, download). Admin OR staff scope counts.
    const { can } = usePermissions();
    const hasAttendance =
        can(PERMISSION_IDS.ADMIN_ATTENDANCE) ||
        can(PERMISSION_IDS.STAFF_ATTENDANCE);
    const canReports = hasAttendance;
    const canEdit = hasAttendance;

    const invalidateAttendance = useInvalidateAttendance();
    const { data: courses = [] } = useQuery({
        // Course list for the picker / header. Reads ONLY _id, courseName and
        // courseCode, so it rides the SUMMARY entry rather than the full
        // ['courseStructures'] payload: 348,390 bytes and 627 ms versus 43,189 bytes
        // and 442 ms for the same 68 courses. Verified by diffing both live responses
        // — the fields summary drops (I_Do/We_Do/You_Do, courseHierarchy,
        // testConfiguration, batchAndParticipants, ...) are none of them read here.
        // `clientData`, referenced by the Excel export, is absent from BOTH payloads,
        // so that cell renders empty exactly as it does today.
        ...courseStructuresSummaryQuery(),
        enabled: !!courseId,
    });
    const course = (courses as CourseStructure[]).find((c) => c._id === courseId);

    // Reset-day state (kept above any early return to satisfy Rules of Hooks).
    // The Detailed report modal was retired here — Download / Remarks now cover
    // the reporting surface, and their handlers live inside AttendanceTab.
    // A CustomEvent bridges the layout button click to the tab's `reportPicker`
    // state so the button can sit visually in the shell header without lifting
    // the exporters out of the tab.
    const [resetOpen, setResetOpen] = useState(false);
    const [resetting, setResetting] = useState(false);
    const openReport = (mode: "attendance" | "remarks") => {
        if (typeof window === "undefined") return;
        window.dispatchEvent(new CustomEvent("attm:openReport", { detail: mode }));
    };

    // No course selected → picker view (base page renders its own header).
    if (!courseId) {
        return <AttmShell fromLdc={fromLdc}>{children}</AttmShell>;
    }

    // Back-arrow context depends on how the user got here — LDC users go back
    // to their console; admin/trainer users go back to the course picker.
    const backToPicker = () => router.push(fromLdc ? `/lms/pages/lddashboard#attendance` : `/lms/pages/attendancemanagement`);

    // Day nav (only shown when Management tab is active) — one date at a time.
    const dateParam = searchParams.get("date");
    const selectedDay = dateParam ? parseKey(dateParam) : todayUtc();
    const dayKey = toDayKey(selectedDay);
    const isToday = dayKey === toDayKey(todayUtc());
    const setDate = (d: Date) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("date", toDayKey(d));
        router.push(`${pathname}?${params.toString()}`);
    };

    const doReset = async () => {
        if (!courseId) return;
        setResetting(true);
        try {
            const res = await attendanceApi.reset(courseId, dayKey, dayKey);
            toast.success(`Reset — ${res.deleted} record(s) removed for this day`);
            // Drop every cached attendance entry: the day's records, the
            // overview's marked-today flags, and any date range the Report or
            // Analytics views already loaded — all of them just went stale.
            // Without this they kept serving pre-reset data, because the ?rev=
            // bump below is only wired to AttendanceTab's own effect.
            invalidateAttendance();
            // Bump ?rev= to force AttendanceTab to re-fetch (it still marks the
            // day with a raw effect rather than a query — see queries/attendance.ts).
            const params = new URLSearchParams(searchParams.toString());
            params.set("rev", String(Date.now()));
            router.push(`${pathname}?${params.toString()}`);
            setResetOpen(false);
        } catch (err) {
            console.error(err);
            toast.error("Failed to reset attendance");
        } finally {
            setResetting(false);
        }
    };

    const iconBtn =
        "h-7 w-7 rounded-control border border-hairline-strong bg-surface text-subtle hover:bg-row-hover hover:text-heading flex items-center justify-center transition-colors disabled:opacity-40 disabled:pointer-events-none";

    return (
        <AttmShell fromLdc={fromLdc}>
            <div className={`${poppins.className} h-full flex flex-col bg-surface`}>
                <div className="w-full flex-1 flex flex-col overflow-hidden">
                    {/* Header (persistent) — single row: back + tabs on the
                        left, day-nav / download controls flush on the right. */}
                    <div className="bg-surface border-b border-hairline w-full px-6 flex-shrink-0">
                        <div className="flex items-center justify-between gap-4 h-12">
                            <div className="flex items-center gap-4 h-full min-w-0">
                                <button
                                    onClick={backToPicker}
                                    className="h-7 w-7 rounded-control text-subtle hover:bg-row-hover hover:text-heading flex items-center justify-center transition-colors shrink-0"
                                    title="Back"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                                {/* Course context chip — inline so the user always
                                    knows which course they're viewing / marking. */}
                                <div className="flex items-center gap-1.5 min-w-0 max-w-[22rem] pr-1 mr-1 border-r border-hairline">
                                    <span className="truncate text-xs font-semibold text-heading">
                                        {course?.courseName || "Course"}
                                    </span>
                                    {course?.courseCode && (
                                        <span className="shrink-0 rounded-chip bg-surface-sunken/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-subtle">
                                            {course.courseCode}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Right cluster — day nav on the left, then Today
                                / Reset day / Download / Remarks flush right.
                                Analytics tab is intentionally gone from the UI
                                (the route still exists for deep links). */}
                            <div className="flex items-center gap-1.5">
                                    <label
                                        className="flex items-center gap-1.5 rounded-control border border-hairline-strong bg-surface px-2 h-7 text-xs text-body cursor-pointer hover:bg-row-hover transition-colors [&_input::-webkit-calendar-picker-indicator]:opacity-0 [&_input::-webkit-calendar-picker-indicator]:absolute [&_input::-webkit-calendar-picker-indicator]:inset-0 [&_input::-webkit-calendar-picker-indicator]:w-full [&_input::-webkit-calendar-picker-indicator]:h-full [&_input::-webkit-calendar-picker-indicator]:cursor-pointer"
                                        title="Pick a date to mark attendance for"
                                    >
                                        <CalendarIcon className="h-3.5 w-3.5 text-subtle shrink-0" />
                                        <input
                                            type="date"
                                            value={dayKey}
                                            max={toDayKey(todayUtc())}
                                            onChange={(e) => {
                                                if (e.target.value) setDate(parseKey(e.target.value));
                                            }}
                                            className="relative bg-transparent text-xs text-body outline-none cursor-pointer w-[7.5rem]"
                                        />
                                    </label>
                                    <div className="inline-flex items-center rounded-control border border-hairline-strong bg-surface overflow-hidden">
                                        <button
                                            onClick={() => setDate(addDays(selectedDay, -1))}
                                            className="h-7 w-7 flex items-center justify-center text-subtle hover:bg-row-hover hover:text-heading disabled:opacity-40 disabled:pointer-events-none transition-colors border-r border-hairline-strong"
                                            title="Previous day"
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" />
                                        </button>
                                        {/* L&D Head is review-only: the mid-cell
                                            "Today" jumper and the Reset day
                                            button are hidden for that flow. */}
                                        {!fromLdc && (
                                            <button
                                                onClick={() => setDate(todayUtc())}
                                                disabled={isToday}
                                                className="h-7 px-2.5 text-xs font-medium text-body hover:bg-row-hover disabled:opacity-50 disabled:pointer-events-none transition-colors border-r border-hairline-strong"
                                                title="Jump to today"
                                            >
                                                Today
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setDate(addDays(selectedDay, 1))}
                                            disabled={isToday}
                                            className="h-7 w-7 flex items-center justify-center text-subtle hover:bg-row-hover hover:text-heading disabled:opacity-40 disabled:pointer-events-none transition-colors"
                                            title={isToday ? "Future dates can't be marked" : "Next day"}
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    {!fromLdc && canEdit && (
                                        <button
                                            onClick={() => setResetOpen(true)}
                                            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control border border-danger-500/30 bg-danger-50 hover:bg-danger-100 text-danger-700 text-xs font-semibold transition-colors"
                                            title="Reset attendance for this day"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" /> Reset day
                                        </button>
                                    )}
                                    {canReports && (
                                        <>
                                            <button
                                                onClick={() => openReport("attendance")}
                                                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control border border-brand-200 bg-surface hover:bg-brand-wash text-brand-strong text-xs font-semibold transition-colors"
                                                title="Download the attendance report"
                                            >
                                                <DownloadIcon className="h-3.5 w-3.5" /> Download
                                            </button>
                                            <button
                                                onClick={() => openReport("remarks")}
                                                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control border border-warn-500/30 bg-surface hover:bg-warn-50 text-warn-700 text-xs font-semibold transition-colors"
                                                title="Download the remarks report"
                                            >
                                                <MessageSquareWarning className="h-3.5 w-3.5" /> Remarks
                                            </button>
                                        </>
                                    )}
                            </div>
                        </div>
                    </div>

                    {/* Body — no outer scroll; each page manages its own scrolling. */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                        {children}
                    </div>
                </div>
            </div>

            {/* Reset confirm modal (Management tab) */}
            {resetOpen && (
                <div
                    className="fixed inset-0 z-modal flex items-center justify-center bg-ink-900/40 backdrop-blur-[1px] p-4"
                    onClick={() => !resetting && setResetOpen(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-tile border border-hairline bg-surface p-5 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-tile bg-danger-50 flex items-center justify-center flex-shrink-0">
                                <RotateCcw className="h-[18px] w-[18px] text-danger-700" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-semibold text-heading">
                                    Reset attendance for this day?
                                </h3>
                                <p className="mt-1 text-xs text-subtle">
                                    This clears every mark on {fmt(selectedDay)}. It can&apos;t be undone.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <button
                                onClick={() => setResetOpen(false)}
                                disabled={resetting}
                                className="h-8 px-3 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover disabled:opacity-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={doReset}
                                disabled={resetting}
                                className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-danger-500 hover:bg-danger-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                            >
                                {resetting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Reset
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AttmShell>
    );
}

