// app/lms/pages/feedback/page.tsx
//
// Student feedback list — the "Feedback" sidebar item on the student shell.
// Lists every active + published feedback form on the courses the student
// is enrolled in, with a search box and a per-row action column. The action
// opens the existing student attend route
//   /lms/pages/courses/feedback?courseId=<id>
// in a NEW TAB (matches how the course-list Feedback button already works)
// so the list stays open behind the form. Once the student has already
// submitted a response for a form, the action flips to a green "Done" chip.

"use client";

import React, { Suspense, useMemo, useState } from "react";
import { Poppins } from "next/font/google";
import { CheckCircle2, ExternalLink, MessageCircle, Search, Star, X } from "lucide-react";
import { StudentLayout } from "../../component/student/student-layout";
import { useGetAllFeedback } from "../coursestructure/feedback/hooks/useFeedback";
import { readStoredUserData } from "../../shared/ui/navItems";
import { Loading } from "@/components/loading-ui/loading";

const poppins = Poppins({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    display: "swap",
});

// ─── Helpers ────────────────────────────────────────────────────────────
const fmtDate = (iso: string | undefined | null): string => {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return String(iso);
    }
};

type SortKey = "title" | "course" | "trainer" | "start" | "end" | "status";

type Row = {
    id: string;
    title: string;
    course: string;
    courseId: string;
    trainer: string;
    batch: string;
    startISO: string;
    endISO: string;
    active: boolean;
    submitted: boolean;
};

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
            <Suspense
                fallback={
                    <div className="flex h-full items-center justify-center p-6">
                        <Loading size="size-8" />
                    </div>
                }
            >
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
    const rows: Row[] = useMemo(() => {
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

    const [q, setQ] = useState("");
    const [status, setStatus] = useState<"all" | "pending" | "done">("all");
    const [sortKey, setSortKey] = useState<SortKey>("start");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
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
        if (status === "pending") out = out.filter((r) => !r.submitted);
        else if (status === "done") out = out.filter((r) => r.submitted);
        return out;
    }, [rows, q, status]);

    const sorted = useMemo(() => {
        const list = [...filtered];
        const dir = sortDir === "asc" ? 1 : -1;
        const get = (r: Row): string | number => {
            switch (sortKey) {
                case "title": return r.title.toLowerCase();
                case "course": return r.course.toLowerCase();
                case "trainer": return r.trainer.toLowerCase();
                case "start": return Date.parse(r.startISO) || 0;
                case "end": return Date.parse(r.endISO) || 0;
                case "status": return r.submitted ? 1 : 0;
                default: return 0;
            }
        };
        list.sort((a, b) => {
            const av = get(a);
            const bv = get(b);
            if (av === bv) return 0;
            return av > bv ? dir : -dir;
        });
        return list;
    }, [filtered, sortKey, sortDir]);

    const total = rows.length;
    const pending = rows.filter((r) => !r.submitted).length;
    const done = rows.filter((r) => r.submitted).length;

    const onSort = (key: SortKey) => {
        if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortKey(key);
            setSortDir(key === "start" || key === "end" ? "desc" : "asc");
        }
    };

    const openInNewTab = (courseId: string) => {
        if (!courseId) return;
        const url = `/lms/pages/courses/feedback?courseId=${encodeURIComponent(courseId)}`;
        // window.open with _blank matches the course-list Feedback button so
        // the student always keeps the list behind the form (never navigates
        // away from the list they were browsing).
        window.open(url, "_blank", "noopener,noreferrer");
    };

    return (
        <div className={`${poppins.className} flex h-full flex-col bg-gray-50 dark:bg-gray-950`}>
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-orange-600" />
                            <h1 className="text-[18px] font-semibold text-gray-900 dark:text-white">
                                Feedback
                            </h1>
                        </div>
                        <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">
                            Every active feedback form on the courses you're enrolled in.
                            Give feedback opens the form in a new tab.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-gray-700 dark:text-gray-300">
                        <span>
                            Total:{" "}
                            <b className="font-semibold text-gray-900 dark:text-white">{total}</b>
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>
                            Pending:{" "}
                            <b className="font-semibold text-amber-600">{pending}</b>
                        </span>
                        <span className="text-gray-300">|</span>
                        <span>
                            Done: <b className="font-semibold text-emerald-600">{done}</b>
                        </span>
                    </div>
                </div>

                {/* Toolbar: search + status filter */}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="search"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Search title / course / trainer / batch…"
                            className="h-8 w-[280px] rounded-md border border-gray-200 bg-white pl-7 pr-8 text-[12.5px] text-gray-800 outline-none focus:border-orange-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        />
                        {q ? (
                            <button
                                type="button"
                                onClick={() => setQ("")}
                                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-700"
                                aria-label="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : null}
                    </div>
                    <label className="flex items-center gap-1.5 text-[12.5px] text-gray-500">
                        Status
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value as "all" | "pending" | "done")}
                            className="h-8 rounded-md border border-gray-200 bg-white px-2 text-[12.5px] text-gray-700 outline-none focus:border-orange-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                        >
                            <option value="all">All</option>
                            <option value="pending">Pending</option>
                            <option value="done">Done</option>
                        </select>
                    </label>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-hidden p-6">
                <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                    {isLoading ? (
                        <div className="flex flex-1 items-center justify-center">
                            <Loading size="size-8" />
                        </div>
                    ) : isError ? (
                        <div className="flex flex-1 items-center justify-center text-[13px] text-rose-500">
                            Failed to load feedback. Please retry.
                        </div>
                    ) : (
                        <div className="flex-1 overflow-auto">
                            <table className="w-full border-collapse text-[13px]">
                                <thead className="bg-gray-50 dark:bg-gray-800/60">
                                    <tr>
                                        <ThSort label="Feedback form" k="title" active={sortKey} dir={sortDir} onClick={onSort} />
                                        <ThSort label="Course" k="course" active={sortKey} dir={sortDir} onClick={onSort} />
                                        <ThSort label="Trainer" k="trainer" active={sortKey} dir={sortDir} onClick={onSort} />
                                        <ThSort label="Batch" k="title" active={sortKey} dir={sortDir} onClick={() => { /* batch reuses title dir for now */ }} sortable={false} />
                                        <ThSort label="Start" k="start" active={sortKey} dir={sortDir} onClick={onSort} />
                                        <ThSort label="End" k="end" active={sortKey} dir={sortDir} onClick={onSort} />
                                        <ThSort label="Status" k="status" active={sortKey} dir={sortDir} onClick={onSort} align="center" />
                                        <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-right text-[11.5px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-800/60">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sorted.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-16 text-center text-[13px] text-gray-400">
                                                {rows.length === 0
                                                    ? "No feedback forms are open on your courses right now."
                                                    : "No feedback matches this filter."}
                                            </td>
                                        </tr>
                                    ) : sorted.map((r) => (
                                        <tr
                                            key={r.id}
                                            className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800/70 dark:hover:bg-gray-800/40"
                                        >
                                            <td className="px-4 py-3">
                                                <div className="flex items-start gap-2">
                                                    <Star className="mt-0.5 h-3.5 w-3.5 text-orange-500" />
                                                    <div className="min-w-0">
                                                        <div className="truncate font-medium text-gray-900 dark:text-white">
                                                            {r.title}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.course}</td>
                                            <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.trainer}</td>
                                            <td className="px-4 py-3 text-gray-500">{r.batch}</td>
                                            <td className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-400">{fmtDate(r.startISO)}</td>
                                            <td className="px-4 py-3 tabular-nums text-gray-600 dark:text-gray-400">{r.endISO ? fmtDate(r.endISO) : "open"}</td>
                                            <td className="px-4 py-3 text-center">
                                                {r.active ? (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                                        Open
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                                                        Closed
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {r.submitted ? (
                                                    // Done chip — green, non-interactive. The student may still
                                                    // want to review what they submitted, so we open the same
                                                    // route in a new tab (the modal shows their response when
                                                    // they've already answered).
                                                    <button
                                                        type="button"
                                                        onClick={() => openInNewTab(r.courseId)}
                                                        className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors dark:bg-emerald-500/15 dark:text-emerald-400"
                                                        title="You've already submitted this feedback — click to review"
                                                    >
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Done
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => openInNewTab(r.courseId)}
                                                        className="inline-flex items-center gap-1.5 rounded-md bg-orange-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-orange-700 transition-colors"
                                                        title="Open the feedback form in a new tab"
                                                    >
                                                        Give feedback
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Sortable header cell — small helper so the header row stays tidy.
function ThSort({
    label,
    k,
    active,
    dir,
    onClick,
    align = "left",
    sortable = true,
}: {
    label: string;
    k: SortKey;
    active: SortKey;
    dir: "asc" | "desc";
    onClick: (k: SortKey) => void;
    align?: "left" | "center" | "right";
    sortable?: boolean;
}) {
    const isActive = sortable && active === k;
    const arrow = isActive ? (dir === "asc" ? "▲" : "▼") : "";
    const alignCls = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
    return (
        <th
            className={`sticky top-0 z-10 bg-gray-50 px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 ${alignCls} ${sortable ? "cursor-pointer select-none hover:text-gray-800" : ""}`}
            onClick={sortable ? () => onClick(k) : undefined}
            role={sortable ? "button" : undefined}
            aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : undefined}
        >
            {label}
            {arrow ? <span className="ml-1 text-[9px] tabular-nums text-orange-500">{arrow}</span> : null}
        </th>
    );
}
