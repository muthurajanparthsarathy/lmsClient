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
    Users,
    Building2,
    CheckCircle2,
} from "lucide-react";
import { EmptyState, Skeleton, StatusPill } from "@/app/lms/shared/ui";
import TableFooter from "@/app/lms/shared/listing/TableFooter";
import { TABLE_HEAD_CELL } from "@/app/lms/shared/listing/DataTable";
import AttendanceTab from "@/app/lms/pages/attendancemanagement/features/AttendanceTab";
import { attendanceApi, type OverviewCourse } from "@/app/lms/pages/attendancemanagement/api/attendanceApi";
import { queryKeys } from "@/lib/queryKeys";
import { usePermissions } from "@/hooks/usePermissions";
import { PERMISSION_IDS } from "@/app/lms/pages/usermanagement/components/permissions/index";
import SearchableSelect from "@/app/lms/pages/attendancemanagement/features/AttendanceManagementSearchableSelect";
import {
    fmtDay,
    pathLabel,
    realBatchesOf,
    scheduleStateOf,
    todayYmd,
} from "@/app/lms/pages/attendancemanagement/features/attendanceManagementHelpers";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

export default function AttendanceManagementPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const courseId = searchParams.get("courseId");
    const [searchTerm, setSearchTerm] = useState("");
    const [clientFilter, setClientFilter] = useState("");
    // Course filter — narrows the list to one specific course when a program
    // has many. Keyed on _id so same-named courses across clients stay distinct.
    const [courseFilter, setCourseFilter] = useState("");
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

    // Course options — narrowed by the active client filter so the picker
    // never lists courses that would empty the table under the current scope.
    // Same-named courses across two clients stay distinct because the option's
    // value is the course _id, not the name.
    const courseOptions = useMemo(() => {
        const scoped = clientFilter
            ? courses.filter((c) => c.clientName === clientFilter)
            : courses;
        return scoped
            .map((c) => ({ value: c._id, label: c.courseName || c.courseCode || "Untitled" }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [courses, clientFilter]);

    // If the selected course leaves the scoped list (e.g. the user just
    // switched clients), drop the filter so the table doesn't stay empty.
    useEffect(() => {
        if (courseFilter && !courseOptions.some((o) => o.value === courseFilter)) {
            setCourseFilter("");
        }
    }, [courseFilter, courseOptions]);

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
                if (courseFilter && course._id !== courseFilter) return false;
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
    }, [courses, searchTerm, clientFilter, courseFilter, scheduleFilter, today]);

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
    }, [searchTerm, clientFilter, courseFilter, scheduleFilter, pageSize]);
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

    const hasActiveFilters =
        Boolean(searchTerm.trim()) ||
        Boolean(clientFilter) ||
        Boolean(courseFilter) ||
        scheduleFilter !== "active";

    // Match Course Setup's shared token metrics: h-10 header (12px), h-12 body
    // cell at 13px, both hooked into the same TABLE_HEAD_CELL constant so any
    // theme change flows through.
    const HEAD_CELL = `${TABLE_HEAD_CELL} px-3`;
    const BODY_CELL = "h-12 px-3 align-middle text-[13px] text-body";

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`${poppins.className} flex flex-1 min-h-0 flex-col px-4 sm:px-6 lg:px-8 pt-3 pb-3`}
        >
            {/* Slim heading + summary chips on the right — matches Course
                Setup's h1 metrics (text-base / lg font-semibold) so the two
                pages read as one shell. mr-8 keeps the last chip clear of the
                shell's corner-pinned NotificationBell. */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">
                    Attendance Management
                </h1>
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

            {/* One toolbar — Search · Client · Course · Status, all in a
                single row at h-8. Native <select>s were traded for the
                SearchableSelect above so a long client or course list is
                filterable inline. flex-nowrap keeps the four controls on one
                line on desktop; they still wrap on very narrow shells because
                of the min-w-0 on the search field. */}
            <div className="mt-3 flex items-center gap-2 flex-wrap min-w-0">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search courses, code, client…"
                        className="w-full h-8 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setSearchTerm("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
                <SearchableSelect
                    ariaLabel="Client"
                    value={clientFilter}
                    onChange={setClientFilter}
                    options={[
                        { value: "", label: "All clients" },
                        ...clientOptions.map((c) => ({ value: c, label: c })),
                    ]}
                    minWidth={170}
                />
                <SearchableSelect
                    ariaLabel="Course"
                    value={courseFilter}
                    onChange={setCourseFilter}
                    options={[
                        { value: "", label: "All courses" },
                        ...courseOptions,
                    ]}
                    minWidth={200}
                />
                <SearchableSelect
                    ariaLabel="Schedule"
                    value={scheduleFilter}
                    onChange={(v) => setScheduleFilter(v as "active" | "all")}
                    options={[
                        { value: "active", label: "Active today" },
                        { value: "all", label: "All schedules" },
                    ]}
                    minWidth={150}
                />
            </div>

            {/* Content — borderless table on the page ground, matching
                Course Setup's MappingTable. No outer card wrapper, no shadow,
                no rounded box: just a scroll region with per-row hairlines. */}
            <div className="mt-2 flex flex-1 min-h-0 flex-col">
                <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-sticky">
                            <tr>
                                <th className={`${HEAD_CELL} w-12 pl-4 sm:pl-5 text-left`}>#</th>
                                <th className={`${HEAD_CELL} text-left`}>Course</th>
                                <th className={`${HEAD_CELL} text-left`}>Code</th>
                                <th className={`${HEAD_CELL} text-left`}>Enrolled</th>
                                <th className={`${HEAD_CELL} text-left`}>Schedule</th>
                                <th className={`${HEAD_CELL} text-left`}>Status</th>
                                <th className={`${HEAD_CELL} w-[120px] pl-2 pr-4 sm:pr-5`}>
                                    <span className="flex justify-end pr-1">Action</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                [...Array(8)].map((_, i) => (
                                    <tr key={i} className="border-b border-hairline last:border-0">
                                        <td className={`${BODY_CELL} pl-4 sm:pl-5`}><Skeleton className="h-3 w-5" /></td>
                                        <td className={BODY_CELL}>
                                            <Skeleton className="h-3.5 w-44" />
                                            <Skeleton className="mt-1.5 h-2.5 w-56" />
                                        </td>
                                        <td className={BODY_CELL}><Skeleton className="h-3 w-24" /></td>
                                        <td className={BODY_CELL}><Skeleton className="h-5 w-12 rounded-full" /></td>
                                        <td className={BODY_CELL}><Skeleton className="h-3 w-24" /></td>
                                        <td className={BODY_CELL}><Skeleton className="h-5 w-24 rounded-full" /></td>
                                        <td className={`${BODY_CELL} w-[120px] pl-2 pr-4 sm:pr-5`}>
                                            <div className="flex justify-end">
                                                <div className="h-7 w-20 rounded-chip bg-ink-100 animate-pulse" />
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12">
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
                                    </td>
                                </tr>
                            ) : (
                                pagedRows.map(({ course, state, mark }, i) => {
                                    // Row number continues across pages — page 2
                                    // starts at 26, not 1.
                                    const rowNumber = rangeStart === 0 ? i + 1 : rangeStart + i;
                                    const active = state === "active";
                                    // A row is only clickable when something is behind
                                    // the click: marking while active, history once
                                    // ended. Before training starts (or with no
                                    // schedule) no attendance exists, so the row is inert.
                                    const clickable = active || state === "ended";
                                    const startLabel = fmtDay(course.trainingStart);
                                    const endLabel = fmtDay(course.trainingEnd);
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
                                    // Viewers never mark — their action is always Review.
                                    // Users without mark_attendance also fall back to
                                    // Review (the row still opens the read-only view).
                                    const actionLabel = active && overview?.role !== "viewer" && canMark
                                        ? (mark.done >= mark.total ? "Review" : "Mark")
                                        : "Review";
                                    return (
                                        <tr
                                            key={course._id}
                                            onClick={clickable ? () => openCourse(course._id) : undefined}
                                            title={blockReason || undefined}
                                            className={`group border-b border-hairline last:border-0 transition-colors duration-150 ${
                                                clickable ? "cursor-pointer hover:bg-row-hover" : "cursor-default"
                                            } ${active ? "" : "opacity-55"}`}
                                        >
                                            <td className={`${BODY_CELL} pl-4 sm:pl-5 text-xs text-faint tabular-nums`}>
                                                {String(rowNumber).padStart(2, "0")}
                                            </td>
                                            <td className={BODY_CELL}>
                                                <div className="min-w-0">
                                                    <div className="font-medium text-heading truncate">
                                                        {course.courseName || "—"}
                                                    </div>
                                                    {identity && (
                                                        <div className="text-2xs text-subtle truncate flex items-center gap-1 mt-0.5">
                                                            <Building2 className="h-3 w-3 text-faint flex-shrink-0" />
                                                            {identity}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={`${BODY_CELL} whitespace-nowrap`}>
                                                <span className="tabular-nums">{course.courseCode || "—"}</span>
                                            </td>
                                            <td className={BODY_CELL}>
                                                <span className="inline-flex items-center h-6 px-2 rounded-chip bg-info-50 text-info-700 text-2xs font-semibold tabular-nums whitespace-nowrap">
                                                    <Users className="h-3 w-3 mr-1" />
                                                    {course.totalStudents}
                                                </span>
                                            </td>
                                            <td className={`${BODY_CELL} whitespace-nowrap`}>
                                                {startLabel || endLabel
                                                    ? `${startLabel || "…"} – ${endLabel || "…"}`
                                                    : "—"}
                                            </td>
                                            <td className={BODY_CELL}>
                                                {state === "upcoming" ? (
                                                    <StatusPill tone="neutral">Not started</StatusPill>
                                                ) : state === "ended" ? (
                                                    <StatusPill tone="neutral">Ended</StatusPill>
                                                ) : (
                                                    <StatusPill tone="success">Started</StatusPill>
                                                )}
                                            </td>
                                            <td className={`${BODY_CELL} w-[120px] pl-2 pr-4 sm:pr-5`} title={blockReason || undefined}>
                                                <div className="flex justify-end">
                                                    {clickable ? (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openCourse(course._id);
                                                            }}
                                                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip border border-brand-500/30 bg-brand-wash text-brand-strong text-2xs font-semibold hover:bg-brand-100 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 whitespace-nowrap"
                                                        >
                                                            <ClipboardCheck size={12} /> {actionLabel}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-faint">—</span>
                                                    )}
                                                </div>
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
        </motion.div>
    );
}
