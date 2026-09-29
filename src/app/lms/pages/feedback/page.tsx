// app/lms/pages/feedback/page.tsx
//
// Student feedback list — the "Feedback" sidebar item on the student shell.
// Lists every active + published feedback form on the courses the student
// is enrolled in. The action opens the existing student attend route
//   /lms/pages/courses/feedback?courseId=<id>
// in a NEW TAB (matches how the course-list Feedback button already works)
// so the list stays open behind the form. Once the student has already
// submitted a response for a form, the action flips to a green "Done" chip.
//
// The LISTING is a mirror of User Management (/lms/pages/usermanagement):
// same slim heading, same compact search + Filter toolbar, same inline filter
// panel and removable chips, the same table metrics (see FeedbackTable) and
// the same shared TableFooter pager at a fixed page size of 10. The old
// bespoke look here — its own Poppins import, hardcoded gray/orange hexes, a
// full-height scrolling table with no pagination at all — is gone; this page
// now reads as the same list component on another route.
//
// One difference is intrinsic: User Management pages on the SERVER (the
// directory is 100k rows). A student's open feedback forms are a handful of
// records that already arrive in one response, so paging here is client-side
// over the filtered list. Everything the user touches behaves identically.

"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
    CheckCircle2, ExternalLink, Filter, MessageCircle, RotateCcw, Search, SearchX, X,
} from "lucide-react";
import { StudentLayout } from "../../component/student/student-layout";
import { useGetAllFeedback } from "../coursestructure/feedback/hooks/useFeedback";
import { readStoredUserData } from "../../shared/ui/navItems";
import { EmptyState, pageEnter } from "../../shared/ui";
import TableFooter from "../../shared/listing/TableFooter";
import { FeedbackTable } from "./components/FeedbackTable";
import type { FeedbackRow, SortDir, SortKey } from "./components/types";

// Fixed page size, matching User Management's.
const PAGE_SIZE = 10;

type StatusFilter = "all" | "pending" | "done";

// ─── Helpers ────────────────────────────────────────────────────────────
// Look at the student's `courses` array on the stored user doc and return
// a Map<courseId, courseName> so the list can label each feedback with the
// course the student knows it by. Courses on user docs are shaped
// { courseId, courseName?, name?, title? } across the codebase — we accept
// any of the labels and fall back to the raw id when none is set.
const buildEnrolledCourseMap = (userCourses: any[]): Map<string, string> => {
    const map = new Map<string, string>();
    for (const c of Array.isArray(userCourses) ? userCourses : []) {
        const id = String(c?.courseId || c?._id || c?.id || "");
        if (!id) continue;
        const name = c?.courseName || c?.name || c?.title || "";
        if (!map.has(id)) map.set(id, name || "");
    }
    return map;
};

// A feedback is "for this student" when its courseId matches one of the
// student's enrolled courses, and the form is both published and active.
const filterForStudent = (
    feedbacks: any[] | undefined,
    enrolled: Map<string, string>,
): any[] => {
    if (!Array.isArray(feedbacks)) return [];
    const hasEnrollments = enrolled.size > 0;
    return feedbacks.filter((fb) => {
        if (!fb) return false;
        if (!fb.isPublished || !fb.isActive) return false;
        if (!hasEnrollments) return true; // fall through if the user doc has no courses cached
        const cid = String(fb.courseId || "");
        return enrolled.has(cid);
    });
};

// True when the student has a response document on this feedback form.
const isSubmittedByStudent = (fb: any, studentId: string): boolean => {
    if (!studentId) return false;
    const rs = Array.isArray(fb?.studentResponses) ? fb.studentResponses : [];
    return rs.some((r: any) => String(r?.studentId || "") === studentId);
};

// ─── Route entry ─────────────────────────────────────────────────────────
export default function StudentFeedbackListPage() {
    return (
        <StudentLayout>
            <Suspense fallback={<div className="flex h-full min-h-[320px] flex-col" />}>
                <StudentFeedbackList />
            </Suspense>
        </StudentLayout>
    );
}

function StudentFeedbackList() {
    const user = readStoredUserData() as any;
    const studentId = String(user?._id || "");
    const enrolled = useMemo(() => buildEnrolledCourseMap(user?.courses || []), [user]);

    // Fetch every feedback the endpoint returns for this user (no courseId
    // arg → server returns the caller-scoped list). Filtering happens
    // client-side against the enrolled course set.
    const { data, isLoading, isError } = useGetAllFeedback();
    const rows: FeedbackRow[] = useMemo(() => {
        const filtered = filterForStudent(data as any, enrolled);
        return filtered.map((fb: any) => ({
            id: String(fb._id || ""),
            title: String(fb.feedbackTitle || "Feedback"),
            course: enrolled.get(String(fb.courseId || "")) || fb.courseName || "—",
            courseId: String(fb.courseId || ""),
            trainer: String(fb.trainerName || "Course-level"),
            batch: String(fb.batchName || "—"),
            startISO: String(fb.startDate || ""),
            endISO: String(fb.endDate || ""),
            active: !!fb.isActive,
            submitted: isSubmittedByStudent(fb, studentId),
        }));
    }, [data, enrolled, studentId]);

    const [searchTerm, setSearchTerm] = useState("");
    const [showFilters, setShowFilters] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
    const [sortKey, setSortKey] = useState<SortKey>("start");
    const [sortDir, setSortDir] = useState<SortDir>("desc");
    const [currentPage, setCurrentPage] = useState(1);

    const filtered = useMemo(() => {
        const needle = searchTerm.trim().toLowerCase();
        let out = rows;
        if (needle) {
            out = out.filter(
                (r) =>
                    r.title.toLowerCase().includes(needle) ||
                    r.course.toLowerCase().includes(needle) ||
                    r.trainer.toLowerCase().includes(needle) ||
                    r.batch.toLowerCase().includes(needle),
            );
        }
        if (selectedStatus === "pending") out = out.filter((r) => !r.submitted);
        else if (selectedStatus === "done") out = out.filter((r) => r.submitted);
        return out;
    }, [rows, searchTerm, selectedStatus]);

    const sorted = useMemo(() => {
        const list = [...filtered];
        const dir = sortDir === "asc" ? 1 : -1;
        const get = (r: FeedbackRow): string | number => {
            switch (sortKey) {
                case "title": return r.title.toLowerCase();
                case "course": return r.course.toLowerCase();
                case "trainer": return r.trainer.toLowerCase();
                case "start": return Date.parse(r.startISO) || 0;
                case "end": return Date.parse(r.endISO) || 0;
                // The Status COLUMN shows Open / Closed, so its sort orders on
                // the same value. (It used to sort on `submitted`, which is
                // what the Action column shows — the arrow pointed at one
                // column and reordered by another.)
                case "status": return r.active ? 1 : 0;
                default: return 0;
            }
        };
        list.sort((a, b) => {
            const av = get(a);
            const bv = get(b);
            // Ties fall back to the id so paging is stable: without it, two
            // rows with the same date can swap places between renders and
            // appear on two different pages.
            if (av === bv) return a.id.localeCompare(b.id);
            return av > bv ? dir : -dir;
        });
        return list;
    }, [filtered, sortKey, sortDir]);

    // ── Pagination (client-side; see the note at the top of the file) ──
    const totalFiltered = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));
    const safePage = Math.min(currentPage, totalPages);
    const rangeStart = totalFiltered === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
    const rangeEnd = Math.min(safePage * PAGE_SIZE, totalFiltered);
    const pageRows = useMemo(
        () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
        [sorted, safePage],
    );

    // Narrowing the list can leave the pager past the last page.
    useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedStatus, sortKey, sortDir]);
    useEffect(() => { setCurrentPage((p) => Math.min(p, totalPages)); }, [totalPages]);

    const total = rows.length;
    const pending = rows.filter((r) => !r.submitted).length;
    const done = rows.filter((r) => r.submitted).length;

    const toggleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortKey(key);
            setSortDir(key === "start" || key === "end" ? "desc" : "asc");
        }
    };

    const statusLabel = selectedStatus === "pending" ? "Pending" : "Done";
    const activeFilterCount = selectedStatus === "all" ? 0 : 1;
    const hasActiveFilters = activeFilterCount > 0 || !!searchTerm.trim();
    const clearAllFilters = () => { setSelectedStatus("all"); setSearchTerm(""); };

    const openInNewTab = (courseId: string) => {
        if (!courseId) return;
        const url = `/lms/pages/courses/feedback?courseId=${encodeURIComponent(courseId)}`;
        // window.open with _blank matches the course-list Feedback button so
        // the student always keeps the list behind the form (never navigates
        // away from the list they were browsing).
        window.open(url, "_blank", "noopener,noreferrer");
    };

    // Row action — the Done chip and the Give feedback button, both opening
    // the same route (the form shows the student's own answers once they have
    // submitted, so "Done" stays useful as a review link).
    const renderActions = (r: FeedbackRow) =>
        r.submitted ? (
            <button
                type="button"
                onClick={() => openInNewTab(r.courseId)}
                title="You've already submitted this feedback — click to review"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control border border-success-500/20 bg-success-50 text-xs font-semibold text-success-700 hover:bg-success-50/70 transition-colors duration-150"
            >
                <CheckCircle2 size={13} strokeWidth={2.2} />
                Done
            </button>
        ) : (
            <button
                type="button"
                onClick={() => openInNewTab(r.courseId)}
                title="Open the feedback form in a new tab"
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control bg-brand-strong text-xs font-semibold text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            >
                Give feedback
                <ExternalLink size={13} strokeWidth={2.2} />
            </button>
        );

    const feedbackEmptyState = isError ? (
        <EmptyState
            icon={SearchX}
            title="Couldn't load your feedback"
            message="Something went wrong fetching your feedback forms. Refresh the page to try again."
        />
    ) : hasActiveFilters ? (
        <EmptyState
            icon={SearchX}
            title="No feedback matches your filters"
            message="Try a different search, or clear the filters to see every form."
            secondaryAction={
                <button
                    type="button"
                    onClick={clearAllFilters}
                    className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                >
                    Clear filters
                </button>
            }
        />
    ) : (
        <EmptyState
            icon={MessageCircle}
            title="No feedback forms open"
            message="Feedback forms your trainers publish on your courses will appear here."
        />
    );

    return (
        <motion.div
            variants={pageEnter}
            initial="hidden"
            animate="visible"
            className="flex h-full min-h-full flex-col"
        >
            {/* Slim heading — same weight and scale as User Management's, with
                the counts kept on the right because "how many are still
                pending" is the question this page exists to answer. */}
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">
                    Feedback
                </h1>
                <div className="hidden sm:flex items-center gap-2 text-xs text-subtle tabular-nums">
                    <span>Total <b className="font-semibold text-heading">{total}</b></span>
                    <span className="h-3 w-px bg-hairline-strong" aria-hidden />
                    <span>Pending <b className="font-semibold text-warn-700">{pending}</b></span>
                    <span className="h-3 w-px bg-hairline-strong" aria-hidden />
                    <span>Done <b className="font-semibold text-success-700">{done}</b></span>
                </div>
            </div>

            {/* One toolbar: search left · Filter right. Mirrors User
                Management so the two lists read the same. */}
            <div className="mt-3 flex items-center gap-2 flex-wrap min-w-0">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search feedback…"
                        className="w-full h-9 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-sm text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
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

                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setShowFilters((v) => !v)}
                        aria-expanded={showFilters}
                        className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-control border text-sm font-medium transition-colors duration-150 relative ${
                            activeFilterCount > 0 || showFilters
                                ? "border-brand text-brand-strong bg-brand-wash"
                                : "border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading"
                        }`}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Filter</span>
                        {activeFilterCount > 0 && (
                            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold text-white tabular-nums">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ── Inline filter panel — expands on the same screen under the
                toolbar, exactly like User Management's. ── */}
            <AnimatePresence initial={false}>
                {showFilters && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="mt-3 rounded-xl border border-hairline bg-surface shadow-xs p-4 sm:p-5">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <h3 className="text-sm font-semibold text-heading">Filters</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedStatus("all")}
                                        disabled={activeFilterCount === 0}
                                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control text-xs font-medium text-subtle hover:text-heading hover:bg-row-hover disabled:opacity-40 disabled:hover:bg-transparent transition-colors duration-150"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Reset
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowFilters(false)}
                                        aria-label="Close filters"
                                        className="inline-flex size-8 items-center justify-center rounded-control text-faint hover:bg-row-hover hover:text-heading transition-colors duration-150"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            </div>
                            <div className="max-w-xs">
                                <span className="block text-2xs font-semibold uppercase tracking-wider text-subtle mb-1.5">
                                    Submission
                                </span>
                                <select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value as StatusFilter)}
                                    className="w-full h-9 px-3 rounded-control border border-hairline-strong bg-surface text-sm text-body focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                                >
                                    <option value="all">All feedback</option>
                                    <option value="pending">Pending — not submitted yet</option>
                                    <option value="done">Done — already submitted</option>
                                </select>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Active-filter chips (appear only when filters are applied) ── */}
            {activeFilterCount > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong">
                        {statusLabel}
                        <button
                            type="button"
                            aria-label={`Remove ${statusLabel} filter`}
                            onClick={() => setSelectedStatus("all")}
                            className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"
                        >
                            <X size={11} />
                        </button>
                    </span>
                    <button
                        type="button"
                        onClick={clearAllFilters}
                        className="text-xs font-medium text-subtle hover:text-heading transition-colors duration-150 ml-0.5"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* Flat listing — flex-1 min-h-0 lets the wrapper absorb the
                vertical space between the toolbar and the pagination footer. */}
            <div className="mt-2 flex flex-1 min-h-0 flex-col">
                <FeedbackTable
                    rows={pageRows}
                    isLoading={isLoading}
                    skeletonRows={PAGE_SIZE}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    renderActions={renderActions}
                    emptyState={feedbackEmptyState}
                />

                {/* Footer / pagination */}
                {!isLoading && totalFiltered > 0 && (
                    <TableFooter
                        from={rangeStart}
                        to={rangeEnd}
                        total={totalFiltered}
                        pageSize={PAGE_SIZE}
                        onPageSize={() => { /* fixed page size, same as User Management */ }}
                        currentPage={safePage}
                        totalPages={totalPages}
                        onPage={setCurrentPage}
                    />
                )}
            </div>
        </motion.div>
    );
}
