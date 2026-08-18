"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Attendance Management — the course list as a WORK QUEUE, not a catalog.
//
// One overview request replaces the old per-row course fetches. Each row
// identifies the class the way the person marking thinks of it — client +
// where it runs (the stored coursePath) — because course NAMES repeat across
// and even within clients, and a flat name list is how attendance lands on
// the wrong roster. The Status column keeps to schedule state (Started /
// Not started / Ended) — marking progress lives in the header chip —
// and rows outside their schedule window say so instead of pretending to be
// markable — ended courses stay clickable to review history, not-yet-started
// rows are inert, and courses with no Program Calendar at all are excluded
// from the page entirely (nothing to attend, nothing to list).
// The server scopes the list by role: admins get every course,
// everyone else only courses (and batches) they are enrolled in as staff.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { Poppins } from "next/font/google";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
    BookOpen,
    Search,
    X,
    ClipboardCheck,
    ChevronRight,
    Users,
    Building2,
    CheckCircle2,
} from "lucide-react";
import { EmptyState, Skeleton, StatusPill } from "@/app/lms/shared/ui";
import TableFooter from "@/app/lms/shared/listing/TableFooter";
import AttendanceTab from "@/app/lms/pages/coursestructure/programcalendar/AttendanceTab";
import { attendanceApi, type OverviewCourse } from "@/apiServices/attendanceApi";
import { queryKeys } from "@/lib/queryKeys";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/components/permissions";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

const todayYmd = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`;
};

const fmtDay = (iso: string): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        ...(sameYear ? {} : { year: "2-digit" }),
    });
};

// "BE ▸ Civil ▸ a ▸ 1" → "BE · Civil · Sec a · Sem 1". The last one/two parts
// of a placement path are section and semester; labelling them saves the
// reader from guessing what a bare "a · 1" means.
const pathLabel = (path: string): string => {
    const parts = path.split("▸").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 4) return `${parts[0]} · ${parts[1]} · Sec ${parts[2]} · Sem ${parts[3]}`;
    if (parts.length === 3) return `${parts[0]} · ${parts[1]} · Sem ${parts[2]}`;
    return parts.join(" · ");
};

type ScheduleState = "active" | "upcoming" | "ended" | "none";

// The state that decides whether attendance can happen TODAY, keyed on the
// TRAINING window (Program Calendar start → latest batch end) — the same
// window the marking screen locks on and the server enforces. No calendar
// means nothing to attend: its own state, not a fake "active".
const scheduleStateOf = (c: OverviewCourse, today: string): ScheduleState => {
    if (!c.hasSchedule) return "none";
    if (c.trainingStart && today < c.trainingStart) return "upcoming";
    if (c.trainingEnd && today > c.trainingEnd) return "ended";
    return "active";
};

// The batches that matter for the marking state (header chip, action
// label, sort order) — a lone "Default" batch is
// the fallback container of a batchless course, reported as the course
// itself rather than as a batch named Default.
const realBatchesOf = (c: OverviewCourse) => {
    if (
        c.batches.length === 1 &&
        (c.batches[0].batchName || "").trim().toLowerCase() === "default"
    )
        return [];
    return c.batches;
};

export default function AttendanceManagementPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const courseId = searchParams.get("courseId");
    const [searchTerm, setSearchTerm] = useState("");
    const [clientFilter, setClientFilter] = useState("");
    const [scheduleFilter, setScheduleFilter] = useState<"active" | "all">("active");
    // Client-side pagination over the already-loaded overview: the endpoint
    // returns every course in one call (also used to derive the header chips'
    // totals), so slicing the sorted result is enough — no server round trip
    // per page. Filter changes reset to page 1 via the effect below.
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);

    // Attendance Management is a page-level permission — anyone who has the
    // page can mark. Fine-grained sub-functions were retired from the tree, so
    // we check page presence (admin OR staff scope) rather than a specific fn.
    const { can } = usePermissions();
    const canMark =
        can(PERMISSION_IDS.ADMIN_ATTENDANCE) ||
        can(PERMISSION_IDS.STAFF_ATTENDANCE);

    const today = todayYmd();
    const { data: overview, isLoading } = useQuery({
        // Keyed under the shared "attendance" root so a reset (which clears a
        // day's records and therefore the marked-today flags below) reaches it
        // through the same prefix invalidation as the records themselves.
        // staleTime/enabled are unchanged.
        queryKey: queryKeys.attendance.overview(today),
        queryFn: () => attendanceApi.overview(today),
        staleTime: 30_000,
        enabled: !courseId,
    });
    // Courses without a Program Calendar have nothing to attend — they don't
    // belong on this page at all. Dropped at the source so the list, the
    // client dropdown and the summary chips all agree.
    const courses = useMemo(
        () => (overview?.data ?? []).filter((c) => c.hasSchedule),
        [overview]
    );

    const clientOptions = useMemo(
        () =>
            Array.from(new Set(courses.map((c) => c.clientName).filter(Boolean))).sort((a, b) =>
                a.localeCompare(b)
            ),
        [courses]
    );

    // Marking state of a course today: which of its batches carry at least one
    // mark. Legacy day-marks without a batch count as the course being marked.
    const markStateOf = (c: OverviewCourse) => {
        const real = realBatchesOf(c);
        if (real.length === 0) {
            const marked = c.batches.some((b) => b.markedToday) || c.legacyMarkedToday;
            return { done: marked ? 1 : 0, total: 1, batches: [] as { name: string; marked: boolean }[] };
        }
        const batches = real.map((b) => ({ name: b.batchName, marked: b.markedToday }));
        const done = batches.filter((b) => b.marked).length + 0;
        return { done: c.legacyMarkedToday && done === 0 ? 1 : done, total: batches.length, batches };
    };

    const rows = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return courses
            .map((c) => ({
                course: c,
                state: scheduleStateOf(c, today),
                mark: markStateOf(c),
            }))
            .filter(({ course, state }) => {
                if (clientFilter && course.clientName !== clientFilter) return false;
                if (scheduleFilter === "active" && state !== "active") return false;
                if (q) {
                    const hay = [
                        course.courseName,
                        course.courseCode,
                        course.clientName,
                        course.category,
                        course.serviceModal,
                        course.coursePath,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();
                    if (!hay.includes(q)) return false;
                }
                return true;
            })
            // Pending work first: active-unmarked, active-partial, active-done,
            // then not-started, then ended. Within a band, client then name.
            .sort((a, b) => {
                const band = (r: typeof a) =>
                    r.state === "active"
                        ? r.mark.done === 0
                            ? 0
                            : r.mark.done < r.mark.total
                                ? 1
                                : 2
                        : r.state === "upcoming"
                            ? 3
                            : r.state === "ended"
                                ? 4
                                : 5;
                const d = band(a) - band(b);
                if (d) return d;
                return (
                    a.course.clientName.localeCompare(b.course.clientName) ||
                    a.course.courseName.localeCompare(b.course.courseName)
                );
            });
    }, [courses, searchTerm, clientFilter, scheduleFilter, today]);

    // Active courses drive the summary chip. With no active course at all
    // there is no work today — the chip must say so neutrally rather than
    // claim green "All marked" success over an empty set.
    const { activeCount, pendingCount } = useMemo(() => {
        const act = courses.filter((c) => scheduleStateOf(c, today) === "active");
        return {
            activeCount: act.length,
            pendingCount: act.filter((c) => {
                const m = markStateOf(c);
                return m.done < m.total;
            }).length,
        };
    }, [courses, today]);
    const totalStudents = useMemo(
        () => courses.reduce((n, c) => n + c.totalStudents, 0),
        [courses]
    );

    // Reset to page 1 whenever the row set shrinks or the filters change —
    // otherwise clearing rows to a shorter list would leave the pager parked
    // on an empty page.
    const totalRows = rows.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, clientFilter, scheduleFilter, pageSize]);
    const safePage = Math.min(currentPage, totalPages);
    const rangeStart = totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const rangeEnd = Math.min(safePage * pageSize, totalRows);
    const pagedRows = useMemo(
        () => rows.slice(rangeStart === 0 ? 0 : rangeStart - 1, rangeEnd),
        [rows, rangeStart, rangeEnd]
    );

    const openCourse = (id: string) => {
        router.push(`/lms/pages/attendancemanagement?courseId=${id}`);
    };

    // Attendance grid view — layout provides the shell, we just render body.
    if (courseId) {
        return (
            <div className={`${poppins.className} h-full flex flex-col bg-surface px-3 pt-1.5 pb-1`}>
                <AttendanceTab courseId={courseId} />
            </div>
        );
    }

    const hasActiveFilters = Boolean(searchTerm.trim()) || Boolean(clientFilter) || scheduleFilter !== "active";

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`${poppins.className} h-full flex flex-col bg-surface`}
        >
            {/* Header — matches the User Management pattern: same title size,
                no divider line below, no icon tile. */}
            <div className="bg-surface px-6 pt-5 pb-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                        <h1 className="text-xl sm:text-2xl font-semibold text-heading tracking-[-0.01em]">
                            Attendance Management
                        </h1>
                    </div>

                    {/* Compact summary chips — pending first, it's the work.
                        mr-8 reserves clearance for the shell's corner-pinned
                        NotificationBell so the last chip never slides under
                        it (same allowance the shared HeaderStats primitive
                        uses on every other listing page). */}
                    <div className="mr-8 flex items-center gap-2">
                        {!isLoading && (
                            <span
                                className={`inline-flex items-center gap-1.5 h-7 rounded-chip border px-2.5 text-xs font-medium tabular-nums ${
                                    pendingCount > 0
                                        ? "border-danger-500/30 bg-danger-50 text-danger-700"
                                        : activeCount > 0
                                            ? "border-success-500/30 bg-success-50 text-success-700"
                                            : "border-hairline bg-surface text-subtle"
                                }`}
                            >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {pendingCount > 0
                                    ? `${pendingCount} to mark today`
                                    : activeCount > 0
                                        ? "All marked today"
                                        : "Nothing to mark today"}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 h-7 rounded-chip border border-hairline bg-surface px-2.5 text-xs font-medium text-body tabular-nums">
                            <BookOpen className="h-3.5 w-3.5 text-faint" />
                            {rows.length} course{rows.length !== 1 ? "s" : ""}
                        </span>
                        {!isLoading && (
                            <span className="inline-flex items-center gap-1.5 h-7 rounded-chip border border-hairline bg-surface px-2.5 text-xs font-medium text-body tabular-nums">
                                <Users className="h-3.5 w-3.5 text-faint" />
                                {totalStudents} enrolled
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 flex flex-col overflow-hidden px-6 py-4 min-h-0">
                {/* Toolbar: search + client + schedule filters */}
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
                        <input
                            type="text"
                            placeholder="Search courses, code, client…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-9 pl-9 pr-8 rounded-control border border-hairline-strong bg-surface text-sm text-body placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand-500 transition-shadow"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                aria-label="Clear search"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-faint hover:text-body transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <select
                        value={clientFilter}
                        onChange={(e) => setClientFilter(e.target.value)}
                        aria-label="Filter by client"
                        className="h-9 px-2.5 rounded-control border border-hairline-strong bg-surface text-sm text-body focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand-500"
                    >
                        <option value="">All clients</option>
                        {clientOptions.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <select
                        value={scheduleFilter}
                        onChange={(e) => setScheduleFilter(e.target.value as "active" | "all")}
                        aria-label="Filter by schedule"
                        className="h-9 px-2.5 rounded-control border border-hairline-strong bg-surface text-sm text-body focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand-500"
                    >
                        <option value="active">Active today</option>
                        <option value="all">All schedules</option>
                    </select>
                </div>

                {/* Courses table + pager. flex-col so the table body claims
                    the remaining height (flex-1 min-h-0) and the TableFooter
                    stays pinned below the scrolling rows. */}
                <div className="flex-1 min-h-0 rounded-tile border border-hairline bg-surface shadow-xs overflow-hidden flex flex-col">
                    <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                        <table className="w-full text-sm">
                            {/* Header row: gray canvas background + hairline
                                divider on each cell — matches User Management
                                (see UsersTable.tsx). Applied per-th because a
                                sticky <tr>'s own border scrolls away in
                                Chrome and leaves the header floating. */}
                            <thead className="sticky top-0 z-sticky">
                                <tr>
                                    <th className="w-12 h-11 px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">#</th>
                                    <th className="h-11 px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Course</th>
                                    <th className="h-11 px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Code</th>
                                    <th className="h-11 px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Enrolled</th>
                                    <th className="h-11 px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Schedule</th>
                                    <th className="h-11 px-3 py-2.5 text-left text-2xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Status</th>
                                    <th className="h-11 px-3 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-subtle align-middle bg-canvas border-b border-hairline whitespace-nowrap">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    [...Array(8)].map((_, i) => (
                                        <tr key={i} className="border-b border-hairline last:border-0">
                                            <td className="px-3 py-3"><Skeleton className="h-3 w-5" /></td>
                                            <td className="px-3 py-3">
                                                <Skeleton className="h-3.5 w-44" />
                                                <Skeleton className="mt-1.5 h-2.5 w-56" />
                                            </td>
                                            <td className="px-3 py-3"><Skeleton className="h-3 w-24" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-5 w-12 rounded-full" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-3 w-24" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-5 w-24 rounded-full" /></td>
                                            <td className="px-3 py-3"><Skeleton className="h-3 w-14 ml-auto" /></td>
                                        </tr>
                                    ))
                                ) : rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={7}>
                                            <div className="py-14">
                                                <EmptyState
                                                    icon={BookOpen}
                                                    title="No courses found"
                                                    message={
                                                        hasActiveFilters
                                                            ? "Try widening the filters — courses outside their schedule window are hidden by default."
                                                            : overview?.role === "staff"
                                                                ? "You are not enrolled in any batch yet — ask an administrator to add you."
                                                                : "No courses are available yet."
                                                    }
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    pagedRows.map(({ course, state, mark }, i) => {
                                        // Row number continues across pages —
                                        // page 2 starts at 26, not 1.
                                        const rowNumber = rangeStart === 0 ? i + 1 : rangeStart + i;
                                        const active = state === "active";
                                        // A row is only clickable when something is behind
                                        // the click: marking while active, history once
                                        // ended. Before training starts (or with no
                                        // schedule) no attendance exists, so the row is inert.
                                        const clickable = active || state === "ended";
                                        const startLabel = fmtDay(course.trainingStart);
                                        const endLabel = fmtDay(course.trainingEnd);
                                        // The list itself says whether marking is
                                        // possible — nobody should have to click
                                        // through to discover a locked screen.
                                        const blockReason = state === "upcoming"
                                            ? `Can't mark — training starts ${startLabel}`
                                            : state === "ended"
                                                ? `Marking closed — training ended ${endLabel}`
                                                : "";
                                        const identity = [
                                            course.clientName,
                                            course.coursePath
                                                ? pathLabel(course.coursePath)
                                                : [course.serviceModal, course.category].filter(Boolean).join(" · "),
                                        ]
                                            .filter(Boolean)
                                            .join(" · ");
                                        return (
                                            <tr
                                                key={course._id}
                                                onClick={clickable ? () => openCourse(course._id) : undefined}
                                                title={blockReason || undefined}
                                                className={`border-b border-hairline last:border-0 transition-colors ${
                                                    clickable ? "group hover:bg-row-hover cursor-pointer" : "cursor-default"
                                                } ${active ? "" : "opacity-55"}`}
                                            >
                                                <td className="px-3 py-3 text-2xs tabular-nums text-faint">
                                                    {String(rowNumber).padStart(2, "0")}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <div className="min-w-0">
                                                        <div className="font-medium text-heading truncate group-hover:text-brand-strong transition-colors">
                                                            {course.courseName || "—"}
                                                        </div>
                                                        {/* The identity line — what tells three same-named
                                                            courses apart without reading codes. */}
                                                        {identity && (
                                                            <div className="text-2xs text-subtle truncate flex items-center gap-1 mt-0.5">
                                                                <Building2 className="h-3 w-3 text-faint flex-shrink-0" />
                                                                {identity}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 text-body font-medium whitespace-nowrap text-xs">
                                                    {course.courseCode || "—"}
                                                </td>
                                                <td className="px-3 py-3">
                                                    <StatusPill tone="success">
                                                        <Users className="h-3 w-3" />
                                                        {course.totalStudents}
                                                    </StatusPill>
                                                </td>
                                                <td className="px-3 py-3 text-xs text-body whitespace-nowrap">
                                                    {startLabel || endLabel
                                                        ? `${startLabel || "…"} – ${endLabel || "…"}`
                                                        : "—"}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {/* Schedule state only — Started / Not started / Ended.
                                                        Marking progress lives in the header chip ("N to mark
                                                        today") and inside the course grid; repeating it per
                                                        row made the column noisy. */}
                                                    {state === "upcoming" ? (
                                                        <StatusPill tone="neutral">Not started</StatusPill>
                                                    ) : state === "ended" ? (
                                                        <StatusPill tone="neutral">Ended</StatusPill>
                                                    ) : (
                                                        <StatusPill tone="success">Started</StatusPill>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right" title={blockReason || undefined}>
                                                    {clickable ? (
                                                        <span className={`inline-flex items-center gap-1 text-xs font-semibold transition-opacity ${
                                                            active
                                                                ? "text-brand-strong opacity-60 group-hover:opacity-100"
                                                                : "text-faint opacity-70 group-hover:opacity-100"
                                                        }`}>
                                                            <ClipboardCheck className="h-3.5 w-3.5" />
                                                            {/* Viewers never mark — their action is always Review.
                                                                Users without mark_attendance also fall back to
                                                                Review (the row still opens the read-only view). */}
                                                            {active && overview?.role !== "viewer" && canMark
                                                                ? (mark.done >= mark.total ? "Review" : "Mark")
                                                                : "Review"}
                                                            <ChevronRight className="h-3.5 w-3.5" />
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-faint">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && totalRows > 0 && (
                        <TableFooter
                            from={rangeStart}
                            to={rangeEnd}
                            total={totalRows}
                            pageSize={pageSize}
                            onPageSize={(n) => { setPageSize(n); setCurrentPage(1); }}
                            currentPage={safePage}
                            totalPages={totalPages}
                            onPage={setCurrentPage}
                        />
                    )}
                </div>
            </div>
        </motion.div>
    );
}
