"use client";

/**
 * Admin-side Approvals — two tabs:
 *
 *   • Queue           — approvals waiting on the signed-in user (unchanged).
 *   • Approval Chains — one flat table of every client's course, with filters
 *                       and per-row actions to open the Set-Approval modal.
 *
 * Chains redesign (2026-09-04):
 *   The old design was a three-step drill-down (Clients → Courses → Modal).
 *   With ~50-200 courses across a handful of clients the two clicks to reach
 *   the useful screen felt like busywork, so the tab is now a single
 *   Client Management-style table. All the state — search text, client
 *   filter, course filter, status filter, page — lives on the flat table.
 *
 * Data sources — the same ones the old design used:
 *   • useClients()                        — institution's clients (for the
 *                                            Client filter and the row avatar/
 *                                            name/logo lookup)
 *   • courseStructuresSummaryQuery()      — every course, with the
 *                                            approvalHierarchy and
 *                                            defaultApproverRole scalars
 *                                            already on the summary projection
 *   • GET /approvals/pending              — the queue
 *   • PUT /courses/:id/approval-hierarchy — save (or clear, on empty steps)
 *
 * Layout: the shared "non-scrolling shell + inner scrollable table body +
 * sticky pager footer" recipe (as used by Client Management / Service
 * Mapping). Auto-fit page size measures the card + footer at runtime so
 * the visible row count matches the viewport height and rows never spill
 * behind an internal scrollbar.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "../../component/layout";
import ApprovalHierarchyModal from "./components/ApprovalHierarchyModal";
import TableFooter from "@/app/lms/shared/listing/TableFooter";
import DataTable, { type Column } from "@/app/lms/shared/listing/DataTable";
import { ClientAvatar } from "@/app/lms/pages/servicemapping/components/workspaceShared";
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Info, MoreVertical, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { api } from "@/app/lms/pages/clientmanagement/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import { useClients, type Client } from "@/app/lms/pages/clientmanagement/api/clientManagementService";
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import { saveApprovalHierarchy } from "@/app/lms/pages/usermanagement/api/userService";
import { readStoredUserData } from "../../shared/ui/navItems";
import { getToken } from "@/lib/session";

interface PendingApproval {
    exerciseId: string;
    exerciseName?: string;
    // The exercise's own type tag (e.g. "mcq", "programming") — used only
    // to break a tie in the Type column: we prefer the tabType-derived
    // Assessment/Assignment label below and fall back to this string for
    // exotic exercise types.
    exerciseType?: string;
    courseId?: string;
    // Enriched by the server (2026-09-04) so the Pending Approvals table can
    // render Client + Course + Submitter without a per-row lookup.
    courseName?: string;
    clientId?: string;
    clientName?: string;
    clientLogo?: string;
    submittedBy?: { userId?: string | null; name?: string; email?: string };
    tabType?: string;
    subcategory?: string;
    step?: { order?: number; roleName?: string; userId?: string | null; userName?: string };
    currentStep?: number;
    totalSteps?: number;
    initiatedAt?: string;
    // > 0 means the trainer re-requested approval after a reject.
    resubmissionCount?: number;
    approvalScope?: string;
}

interface CourseRow {
    _id: string;
    courseName?: string;
    courseCode?: string;
    clientId?: string;
    clientName?: string;
    // Both timestamps ride the summary projection. The sort uses the
    // later of the two — so a brand-new course AND a course whose
    // approval hierarchy was just saved both float to the top. The
    // server bumps `course.updatedAt` on every hierarchy PUT.
    createdAt?: string;
    updatedAt?: string;
    approvalHierarchy?: {
        steps?: { order?: number; roleId?: string; roleName?: string; userId?: string | null; userName?: string }[];
    };
    // Name of the institution's L&D default approver role, or null when the
    // institution has none (then there is NO fallback chain to display).
    defaultApproverRole?: string | null;
}

// Approval Flow status codes. The same three the Status column pills render
// and the Status filter dropdown selects between.
//   default    — no custom hierarchy on the course; falls back to the
//                institution's L&D approver role (must exist).
//   custom     — course-specific hierarchy with every step assigned to a
//                real person.
//   incomplete — either a course-specific hierarchy with one or more steps
//                missing a person, OR no custom hierarchy AND no L&D
//                default configured on the institution (nothing to fall
//                back on, so an approval request has nowhere to go).
type ApprovalStatus = "default" | "custom" | "incomplete";

const fmtDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const tabLabel = (t?: string): string =>
    t === "You_Do" ? "Assessment" : t === "We_Do" ? "Assignment" : t || "—";

// Derive the status pill from the course's saved hierarchy. Kept as a
// standalone function (not a hook) so it can be called both inside the
// filter predicate and inside every column render without React-rules
// contortions.
const getApprovalStatus = (c: CourseRow): ApprovalStatus => {
    const steps = c.approvalHierarchy?.steps ?? [];
    if (steps.length === 0) return c.defaultApproverRole ? "default" : "incomplete";
    const allSet = steps.every((s) => Boolean(s.userId));
    return allSet ? "custom" : "incomplete";
};

type Tab = "queue" | "chains";

export default function ApprovalsPage() {
    const [tab, setTab] = useState<Tab>("queue");

    const tabBtn = (id: Tab, label: string, hint?: string) => (
        <button
            type="button"
            onClick={() => setTab(id)}
            // Native `title` on the whole tab so a hover anywhere on the
            // label — not just the info icon beside it — surfaces the
            // meaning as a tooltip. Screen readers announce the same string
            // through `aria-label` on the icon.
            title={hint}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-t-md border-b-2 -mb-px transition-colors ${
                tab === id
                    ? "border-orange-500 text-orange-700 font-bold"
                    : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
        >
            {label}
            {hint && (
                <span
                    role="img"
                    aria-label={hint}
                    title={hint}
                    className="inline-flex items-center text-gray-400 hover:text-gray-600 cursor-help"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Info size={13} />
                </span>
            )}
        </button>
    );

    return (
        <DashboardLayout>
            {/* Root flex column — consumes <main>'s bounded height so children
                can share it. h-full/min-h-0/flex-col are all load-bearing. */}
            <div className="flex flex-col h-full min-h-0 min-w-0 p-6 max-w-6xl">
                {/* Title header — single heading, Client Management size. */}
                <div className="shrink-0 mb-4">
                    <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">
                        Approvals
                    </h1>
                </div>

                {/* Tab strip — natural height. Labels renamed 2026-09-04
                    from "Queue" / "Approval chains" so each tab's purpose
                    reads off the label alone; the info icon (and the tab's
                    own hover tooltip) still surface the fuller meaning for
                    anyone who wants it. */}
                <div className="shrink-0 flex gap-1 border-b border-gray-200 mb-4">
                    {tabBtn(
                        "queue",
                        "Pending Approvals",
                        "Review requests waiting for approval.",
                    )}
                    {tabBtn(
                        "chains",
                        "Approval Setup",
                        "Configure approvers and approval levels for each course.",
                    )}
                </div>

                {/* ── Pending Approvals: flat table (redesigned 2026-09-04) ── */}
                {tab === "queue" && <PendingPanel />}

                {/* ── Chains: flat table (redesigned 2026-09-04) ── */}
                {tab === "chains" && <ChainsPanel />}
            </div>
        </DashboardLayout>
    );
}

// ─── Chains tab — one flat table of every client's course ─────────────────────
function ChainsPanel() {
    // Data — same two queries the old drill-down used. Both are lazy: React
    // Query only fires them once this panel mounts.
    const clientsQuery = useClients();
    const clients: Client[] = (clientsQuery.data as Client[] | undefined) ?? [];
    const clientsLoading = clientsQuery.isPending;

    const coursesQuery = useQuery(courseStructuresSummaryQuery());
    const coursesRaw: CourseRow[] = (coursesQuery.data as CourseRow[] | undefined) ?? [];
    const coursesLoading = coursesQuery.isPending;
    const isLoading = clientsLoading || coursesLoading;
    const loadError =
        (clientsQuery.isError && ((clientsQuery.error as Error)?.message || "Could not load clients")) ||
        (coursesQuery.isError && ((coursesQuery.error as Error)?.message || "Could not load courses")) ||
        "";

    // Client lookup — used to attach logo + name to a course row even when
    // the course's own `clientName` scalar is stale (a rename on the client
    // wouldn't propagate to the embedded copy until the course was next
    // saved). The Map keeps the O(1) lookup inside the row render.
    const clientById = useMemo(() => {
        const m = new Map<string, Client>();
        clients.forEach((c) => m.set(String(c._id), c));
        return m;
    }, [clients]);

    // ── Filter state ──────────────────────────────────────────────────────
    // 'all' is the default for every dropdown; empty search is the default
    // search state. Client change resets Course to 'all' via the effect
    // below, so the Course dropdown never carries a stale id that isn't in
    // the newly-filtered options list.
    const [search, setSearch] = useState("");
    const [clientFilter, setClientFilter] = useState<string>("all");
    const [courseFilter, setCourseFilter] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    // Client options — every institution's client that owns at least one
    // course. A client with zero courses would show a filter value that
    // never matches, so those are dropped.
    const clientOptions = useMemo(() => {
        const withCourses = new Set<string>();
        coursesRaw.forEach((c) => { if (c.clientId) withCourses.add(String(c.clientId)); });
        return clients
            .filter((c) => withCourses.has(String(c._id)))
            .map((c) => ({ id: String(c._id), name: c.clientCompany || "Unnamed client" }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [clients, coursesRaw]);

    // Course options — narrowed to the selected client when one is chosen,
    // so the Course dropdown always shows only what the user could actually
    // pick. Deduplicated by course id.
    const courseOptions = useMemo(() => {
        const source = clientFilter === "all"
            ? coursesRaw
            : coursesRaw.filter((c) => String(c.clientId || "") === clientFilter);
        return source
            .map((c) => ({ id: String(c._id), name: c.courseName || "Untitled course" }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [coursesRaw, clientFilter]);

    // If the Course dropdown value falls outside the narrowed options list
    // (e.g. the user picked a course, then switched to a different client),
    // snap it back to 'all' so filter state stays coherent.
    useEffect(() => {
        if (courseFilter === "all") return;
        const stillValid = courseOptions.some((o) => o.id === courseFilter);
        if (!stillValid) setCourseFilter("all");
    }, [courseOptions, courseFilter]);

    // Filtered course rows — client + course + status + free-text search
    // combined. Search matches client name (from the up-to-date client
    // record), course name, and course code — all fields visible in the
    // row, per the task's "no hidden field matches" rule.
    const filteredCourses = useMemo(() => {
        let list = coursesRaw;
        if (clientFilter !== "all") {
            list = list.filter((c) => String(c.clientId || "") === clientFilter);
        }
        if (courseFilter !== "all") {
            list = list.filter((c) => String(c._id) === courseFilter);
        }
        if (statusFilter !== "all") {
            list = list.filter((c) => getApprovalStatus(c) === statusFilter);
        }
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((c) => {
                const clientName = clientById.get(String(c.clientId || ""))?.clientCompany || c.clientName || "";
                return (
                    (c.courseName || "").toLowerCase().includes(q) ||
                    (c.courseCode || "").toLowerCase().includes(q) ||
                    clientName.toLowerCase().includes(q)
                );
            });
        }
        return list.slice().sort((a, b) => {
            // Newest activity first. "Latest" here means "most recently
            // touched", not just "most recently created" — a course that
            // was just given an approval hierarchy is exactly the row the
            // admin will most likely revisit next, and the server bumps
            // `course.updatedAt` on every hierarchy PUT, so this pulls
            // that row to page 1 for them. Falls back to createdAt when
            // updatedAt is missing (older records), and finally to _id
            // descending — Mongo ObjectIds encode creation time, so the
            // higher id is newer, which keeps two rows saved in the same
            // second in a stable order across renders.
            const ts = (r: CourseRow) => {
                const u = r.updatedAt ? Date.parse(r.updatedAt) : 0;
                const c = r.createdAt ? Date.parse(r.createdAt) : 0;
                return Math.max(u, c);
            };
            const at = ts(a);
            const bt = ts(b);
            if (bt !== at) return bt - at;
            return String(b._id).localeCompare(String(a._id));
        });
    }, [coursesRaw, clientById, clientFilter, courseFilter, statusFilter, search]);

    // ── Pagination + auto-fit page size ───────────────────────────────────
    // Same pattern as Client Management: measure the table area, back out
    // the header (h-10 = 40) and body row (h-12 = 48) heights and the
    // footer's actual clientHeight, and pick the row count that fills the
    // remaining budget without spilling into an internal scrollbar. A user
    // pick on the pager pins the size so it isn't overridden on resize.
    const [pageSize, setPageSize] = useState<number>(5);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [autoFitPageSize, setAutoFitPageSize] = useState<boolean>(true);
    const tableCardRef = useRef<HTMLDivElement | null>(null);
    const tableFooterRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!autoFitPageSize) return;
        const cardEl = tableCardRef.current;
        if (!cardEl) return;
        const HEADER_H = 40;
        const ROW_H = 48;
        const SAFETY = Math.round(ROW_H / 2);
        const compute = () => {
            if (cardEl.clientHeight <= 0) return;
            const footerH = tableFooterRef.current?.clientHeight ?? 44;
            const budget = Math.max(0, cardEl.clientHeight - HEADER_H - footerH - SAFETY);
            const fits = Math.max(3, Math.min(50, Math.floor(budget / ROW_H)));
            setPageSize((prev) => (prev === fits ? prev : fits));
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(cardEl);
        if (tableFooterRef.current) ro.observe(tableFooterRef.current);
        return () => ro.disconnect();
    }, [autoFitPageSize]);

    // Filter changes go back to page 1 so the list doesn't sit on a page
    // that no longer exists after the total shrank.
    useEffect(() => {
        setCurrentPage(1);
    }, [search, clientFilter, courseFilter, statusFilter]);

    const totalRows = filteredCourses.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pageRows = useMemo(
        () => filteredCourses.slice((safePage - 1) * pageSize, safePage * pageSize),
        [filteredCourses, safePage, pageSize],
    );

    const hasActiveFilters =
        Boolean(search.trim()) ||
        clientFilter !== "all" ||
        courseFilter !== "all" ||
        statusFilter !== "all";
    const clearFilters = () => {
        setSearch("");
        setClientFilter("all");
        setCourseFilter("all");
        setStatusFilter("all");
    };

    // ── Modal + mutation ──────────────────────────────────────────────────
    const [modalCourse, setModalCourse] = useState<CourseRow | null>(null);
    const queryClient = useQueryClient();
    const resetMutation = useMutation({
        mutationFn: async (courseId: string) => {
            const token = getToken();
            const institutionId = typeof window !== "undefined"
                ? localStorage.getItem("smartcliff_institution")
                : null;
            if (!token || !institutionId) {
                throw new Error("Session expired — sign in again");
            }
            // Empty steps clears the custom hierarchy; the server then falls
            // back to the institution's L&D default (or reports "no chain"
            // if none is configured). Matches the modal's own save path,
            // which just PUTs a shorter list.
            return saveApprovalHierarchy(courseId, [], institutionId, token);
        },
        onSuccess: () => {
            // The 'courseStructures' root prefix is what the summary query
            // caches under, so this refreshes the row we just changed.
            queryClient.invalidateQueries({ queryKey: ["courseStructures"] });
            toast.success("Reverted to the default approval hierarchy");
        },
        onError: (e: Error) => toast.error(e.message || "Failed to reset the hierarchy"),
    });

    // ── Column defs ───────────────────────────────────────────────────────
    // Percentage widths sum to 100% so DataTable's fixedLayout keeps rows
    // clipped to the container width. `#` gets a narrow 4%, Actions gets
    // room for the kebab, the rest carry text.
    const columns: Column<CourseRow>[] = [
        {
            key: "num",
            label: "#",
            className: "w-[4%] pl-5 text-left text-xs text-faint tabular-nums align-middle",
            skeletonWidth: "20px",
            render: (_r, i) => (safePage - 1) * pageSize + i + 1,
        },
        {
            key: "client",
            label: "Client",
            // Widths rebalanced 2026-09-04 after the Status column was
            // removed — its 8% got split between Course (+2) and Approval
            // Flow (+6, the widest content type). Still sums to 100% under
            // fixedLayout so nothing overflows.
            className: "w-[22%] px-3 text-left align-middle",
            skeletonWidth: "80%",
            render: (row) => {
                const client = clientById.get(String(row.clientId || ""));
                const name = client?.clientCompany || row.clientName || "—";
                return (
                    <div className="flex items-center gap-2 min-w-0">
                        <ClientAvatar name={name} size="sm" logoUrl={client?.clientLogo || undefined} />
                        <span className="block truncate" title={name}>
                            {name}
                        </span>
                    </div>
                );
            },
        },
        {
            key: "course",
            label: "Course",
            className: "w-[26%] px-3 text-left align-middle",
            skeletonWidth: "70%",
            render: (row) => {
                const name = row.courseName || "Untitled course";
                return (
                    <span className="block truncate" title={name}>{name}</span>
                );
            },
        },
        {
            key: "courseCode",
            label: "Course Code",
            className: "w-[12%] px-3 text-left align-middle",
            skeletonWidth: "60%",
            render: (row) => (
                row.courseCode
                    ? <span className="tabular-nums text-body">{row.courseCode}</span>
                    : <span className="text-line-muted">—</span>
            ),
        },
        {
            key: "flow",
            label: "Approval Flow",
            className: "w-[28%] px-3 text-left align-middle",
            skeletonWidth: "80%",
            render: (row) => <ApprovalFlowCell course={row} />,
        },
        {
            key: "actions",
            label: "Actions",
            className: "w-[8%] no-print pl-2 pr-4 sm:pr-5 text-right whitespace-nowrap align-middle",
            skeletonWidth: "20px",
            render: (row) => {
                const status = getApprovalStatus(row);
                const hasCustom = (row.approvalHierarchy?.steps?.length ?? 0) > 0;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Row actions"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 data-[state=open]:bg-ink-100 data-[state=open]:text-heading"
                            >
                                <MoreVertical size={15} />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={4} className="w-44">
                            {hasCustom ? (
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); setModalCourse(row); }}
                                    className="text-xs cursor-pointer"
                                >
                                    <Pencil className="h-3.5 w-3.5" /> Edit approval
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onClick={(e) => { e.stopPropagation(); setModalCourse(row); }}
                                    className="text-xs cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" /> Set approval
                                </DropdownMenuItem>
                            )}
                            {hasCustom && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            resetMutation.mutate(row._id);
                                        }}
                                        className="text-xs cursor-pointer"
                                        // The variant="destructive" flag isn't wired
                                        // here — the reset is safe (falls back to the
                                        // institution default, doesn't delete any
                                        // data) so it doesn't warrant destructive
                                        // colouring. Same reasoning status=`default`
                                        // uses to hide it entirely: nothing to reset.
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" /> Reset to default
                                    </DropdownMenuItem>
                                </>
                            )}
                            {/* Status-only hint on a menu with nothing to Reset. */}
                            {status === "incomplete" && !hasCustom && (
                                <>
                                    <DropdownMenuSeparator />
                                    <div className="px-2.5 py-1.5 text-2xs text-warn-700">
                                        No L&amp;D default configured — set an approval to unblock this course.
                                    </div>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    return (
        <>
            {/* ── Toolbar: search + three dropdowns + Clear ── */}
            <div className="shrink-0 mb-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search client, course, or course code..."
                        aria-label="Search"
                        className="w-full h-9 pl-8 pr-8 rounded-md border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                    />
                    {search && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger aria-label="Filter by client" className="h-9 min-w-[180px] rounded-md border-hairline">
                        <SelectValue placeholder="All clients" />
                    </SelectTrigger>
                    <SelectContent
                        sideOffset={4}
                        style={{ width: "var(--radix-select-trigger-width)" }}
                        className="max-h-[280px]"
                    >
                        <SelectItem value="all">All clients</SelectItem>
                        {clientOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={courseFilter} onValueChange={setCourseFilter}>
                    <SelectTrigger aria-label="Filter by course" className="h-9 min-w-[180px] rounded-md border-hairline">
                        <SelectValue placeholder="All courses" />
                    </SelectTrigger>
                    <SelectContent
                        sideOffset={4}
                        style={{ width: "var(--radix-select-trigger-width)" }}
                        className="max-h-[280px]"
                    >
                        <SelectItem value="all">All courses</SelectItem>
                        {courseOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger aria-label="Filter by approval status" className="h-9 min-w-[160px] rounded-md border-hairline">
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent
                        sideOffset={4}
                        style={{ width: "var(--radix-select-trigger-width)" }}
                        className="max-h-[280px]"
                    >
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                        <SelectItem value="incomplete">Incomplete</SelectItem>
                    </SelectContent>
                </Select>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md text-xs font-semibold text-brand-strong hover:text-brand-800 transition-colors"
                    >
                        <X size={12} /> Clear filters
                    </button>
                )}
            </div>

            {/* ── Table area (scroll-free, auto-fit) + pager footer ── */}
            <div ref={tableCardRef} className="flex flex-1 min-h-0 flex-col">
                {loadError ? (
                    <div className="flex-1 min-h-[200px] flex items-center justify-center px-4 py-8 text-sm text-red-600">
                        {loadError}
                    </div>
                ) : (
                    <DataTable<CourseRow>
                        rows={pageRows}
                        columns={columns}
                        rowKey={(row) => row._id}
                        sortKey={null}
                        sortDir="asc"
                        onSort={() => {}}
                        isLoading={isLoading}
                        isFiltered={hasActiveFilters}
                        fillHeight
                        fixedLayout
                        emptyTitle={hasActiveFilters ? "No courses match these filters" : "No courses yet"}
                        emptyHint={
                            hasActiveFilters
                                ? "Try widening or clearing them to see more."
                                : "Once courses are created they appear here so you can configure their approval chains."
                        }
                        emptyAction={hasActiveFilters ? "Clear filters" : undefined}
                        onEmptyAction={hasActiveFilters ? clearFilters : undefined}
                    />
                )}

                <div ref={tableFooterRef}>
                    <TableFooter
                        from={totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1}
                        to={Math.min(safePage * pageSize, totalRows)}
                        total={totalRows}
                        pageSize={pageSize}
                        onPageSize={(n) => { setAutoFitPageSize(false); setPageSize(n); setCurrentPage(1); }}
                        currentPage={safePage}
                        totalPages={totalPages}
                        onPage={setCurrentPage}
                    />
                </div>
            </div>

            {/* Person-specific hierarchy editor. Passes the resolved (up-to-
                date) client name from the client record when we have it, so
                the modal header doesn't show a stale copy from the embedded
                course scalar. Saves invalidate the 'courseStructures' root,
                so a successful save refreshes the row automatically — no
                manual state fix needed here. */}
            <ApprovalHierarchyModal
                open={!!modalCourse}
                courseId={modalCourse?._id || ""}
                courseName={modalCourse?.courseName}
                clientName={
                    modalCourse
                        ? clientById.get(String(modalCourse.clientId || ""))?.clientCompany
                            || modalCourse.clientName
                        : undefined
                }
                onClose={() => setModalCourse(null)}
            />
        </>
    );
}

// ─── Row helpers ──────────────────────────────────────────────────────────────

// Compact approval-chain readout for a course row. Renders the step chain
// (role names, or role · person when both are set) → "Students", with an
// N-level count chip beside it. Falls back to the L&D default when no
// custom hierarchy is set, and to a red "no chain" note when neither is
// present.
function ApprovalFlowCell({ course }: { course: CourseRow }) {
    const steps = (course.approvalHierarchy?.steps || [])
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (steps.length > 0) {
        const chain = steps
            .map((s) => s.roleName || "?")
            .concat(["Students"])
            .join(" → ");
        return (
            <div className="flex items-center gap-2 min-w-0">
                <span className="block truncate text-body" title={chain}>{chain}</span>
                <span className="inline-flex items-center h-[20px] px-1.5 rounded-chip bg-ink-100 text-ink-700 text-[10px] font-semibold tabular-nums flex-shrink-0">
                    {steps.length} level{steps.length === 1 ? "" : "s"}
                </span>
            </div>
        );
    }
    if (course.defaultApproverRole) {
        const chain = `${course.defaultApproverRole} → Students`;
        return (
            <div className="flex items-center gap-2 min-w-0">
                <span className="block truncate text-body" title={chain}>{chain}</span>
                <span className="inline-flex items-center h-[20px] px-1.5 rounded-chip bg-brand-wash text-brand-strong text-[10px] font-semibold tabular-nums flex-shrink-0">
                    1 level
                </span>
            </div>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 text-xs text-danger-700">
            <AlertTriangle size={12} /> No approval chain
        </span>
    );
}

// (StatusPill removed 2026-09-04 alongside the Status column in Approval
// Setup. The `getApprovalStatus` helper survives — the status filter
// dropdown still needs it, and the Actions menu still reads it to render
// the "no L&D default" hint on incomplete rows.)

// ─── Pending Approvals tab — flat DataTable listing (2026-09-04) ──────────────
// Replaces the older "Waiting on you" card. Reuses the same primitives the
// Approval Setup tab uses so both tabs feel like one system: shared
// DataTable, ClientAvatar in the Client column, auto-fit page size,
// TableFooter for the pager. Data comes straight from the (server-enriched)
// /approvals/pending endpoint — every row is an actual pending exercise
// assigned to the logged-in user's current approval level, so there is no
// static/placeholder content.
function PendingPanel() {
    // Per-user query key: a shared browser must never paint another
    // account's queue from cache.
    const [userId] = useState<string | null>(() => readStoredUserData()?._id ?? null);
    const queueQuery = useQuery<{ success?: boolean; data?: PendingApproval[] }>({
        queryKey: queryKeys.approvals.pending(userId),
        queryFn: () => api.get("/approvals/pending"),
        enabled: !!userId,
        staleTime: 30_000,
        // Approvals are also acted on from OTHER pages (view-resources)
        // that don't invalidate this key — match the old fetch-per-mount
        // freshness rather than showing a stale row after an approve there.
        refetchOnMount: "always",
    });
    const items: PendingApproval[] = useMemo(
        () => (Array.isArray(queueQuery.data?.data) ? queueQuery.data.data : []),
        [queueQuery.data],
    );
    const isLoading = queueQuery.isPending;
    const loadError = queueQuery.isError
        ? (queueQuery.error as Error)?.message || "Could not load pending approvals"
        : "";

    // ── Filter state ──────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [clientFilter, setClientFilter] = useState<string>("all");
    const [courseFilter, setCourseFilter] = useState<string>("all");
    const [typeFilter, setTypeFilter] = useState<string>("all");

    // Filter options — built from the actual pending rows so no filter
    // value is ever a dead end (a client with no pending items doesn't
    // appear in the Client dropdown, and picking a client re-narrows the
    // Course dropdown to that client's pending items).
    const clientOptions = useMemo(() => {
        const seen = new Map<string, string>();
        items.forEach((it) => {
            const id = it.clientId || "";
            if (!id) return;
            if (!seen.has(id)) seen.set(id, it.clientName || "Unnamed client");
        });
        return Array.from(seen.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [items]);

    const courseOptions = useMemo(() => {
        const seen = new Map<string, string>();
        items
            .filter((it) => clientFilter === "all" || String(it.clientId || "") === clientFilter)
            .forEach((it) => {
                const id = it.courseId || "";
                if (!id) return;
                if (!seen.has(id)) seen.set(id, it.courseName || "Untitled course");
            });
        return Array.from(seen.entries())
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [items, clientFilter]);

    // Snap course filter back to "all" when the current selection isn't in
    // the narrowed list any more (e.g. after switching to a different
    // client).
    useEffect(() => {
        if (courseFilter === "all") return;
        const stillValid = courseOptions.some((o) => o.id === courseFilter);
        if (!stillValid) setCourseFilter("all");
    }, [courseOptions, courseFilter]);

    // Filtered + sorted rows. Newest first — an approval that just landed
    // is exactly what the reviewer is here to see.
    const filtered = useMemo(() => {
        let list = items;
        if (clientFilter !== "all") list = list.filter((it) => String(it.clientId || "") === clientFilter);
        if (courseFilter !== "all") list = list.filter((it) => String(it.courseId || "") === courseFilter);
        if (typeFilter !== "all") list = list.filter((it) => tabLabel(it.tabType).toLowerCase() === typeFilter);
        const q = search.trim().toLowerCase();
        if (q) {
            list = list.filter((it) => (
                (it.clientName || "").toLowerCase().includes(q) ||
                (it.courseName || "").toLowerCase().includes(q) ||
                (it.exerciseName || "").toLowerCase().includes(q)
            ));
        }
        return list.slice().sort((a, b) => {
            const at = a.initiatedAt ? Date.parse(a.initiatedAt) : 0;
            const bt = b.initiatedAt ? Date.parse(b.initiatedAt) : 0;
            return bt - at;
        });
    }, [items, clientFilter, courseFilter, typeFilter, search]);

    // ── Pagination + auto-fit (same recipe as Approval Setup) ─────────────
    const [pageSize, setPageSize] = useState<number>(5);
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [autoFitPageSize, setAutoFitPageSize] = useState<boolean>(true);
    const tableCardRef = useRef<HTMLDivElement | null>(null);
    const tableFooterRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!autoFitPageSize) return;
        const cardEl = tableCardRef.current;
        if (!cardEl) return;
        const HEADER_H = 40;
        const ROW_H = 48;
        const SAFETY = Math.round(ROW_H / 2);
        const compute = () => {
            if (cardEl.clientHeight <= 0) return;
            const footerH = tableFooterRef.current?.clientHeight ?? 44;
            const budget = Math.max(0, cardEl.clientHeight - HEADER_H - footerH - SAFETY);
            const fits = Math.max(3, Math.min(50, Math.floor(budget / ROW_H)));
            setPageSize((prev) => (prev === fits ? prev : fits));
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(cardEl);
        if (tableFooterRef.current) ro.observe(tableFooterRef.current);
        return () => ro.disconnect();
    }, [autoFitPageSize]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, clientFilter, courseFilter, typeFilter]);

    const totalRows = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const pageRows = useMemo(
        () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
        [filtered, safePage, pageSize],
    );

    const hasActiveFilters =
        Boolean(search.trim()) ||
        clientFilter !== "all" ||
        courseFilter !== "all" ||
        typeFilter !== "all";
    const clearFilters = () => {
        setSearch("");
        setClientFilter("all");
        setCourseFilter("all");
        setTypeFilter("all");
    };

    // Review link — same URL shape the old queue used (view-resources
    // page reads ?from=… to render a Back button that returns here).
    const buildReviewHref = (it: PendingApproval) =>
        `/lms/pages/coursestructure/view-resources?courseId=${encodeURIComponent(it.courseId || "")}&tabType=${encodeURIComponent(it.tabType || "You_Do")}&from=${encodeURIComponent("/lms/pages/approvals")}`;

    // Column widths — reflowed 2026-09-04 so the Actions column and its
    // Review button are never clipped.
    //
    // Widths are percentages of the container under DataTable's fixedLayout
    // (columns sum to 100% and each cell truncates its own text on overflow
    // — no horizontal scrollbar). Actions gets a comfortable 10% + pl-4
    // gutter so the Review button stays fully inside the cell at every
    // supported viewport width (the workspace is capped at max-w-6xl ≈
    // 1104px inner, so 10% ≈ 110px — enough for the Review button ~65px
    // and 20px right padding, with 25px to spare). The four text-heavy
    // columns (Client, Course, Approval Item, Submitted By) truncate on
    // overflow and reveal the full value in a title tooltip on hover,
    // per the layout brief.
    const columns: Column<PendingApproval>[] = [
        {
            key: "num",
            label: "#",
            className: "w-[4%] pl-5 pr-2 text-left text-xs text-faint tabular-nums align-middle",
            skeletonWidth: "20px",
            render: (_r, i) => (safePage - 1) * pageSize + i + 1,
        },
        {
            key: "client",
            label: "Client",
            className: "w-[14%] px-3 text-left align-middle",
            skeletonWidth: "80%",
            render: (row) => {
                const name = row.clientName || "—";
                return (
                    <div className="flex items-center gap-2 min-w-0">
                        <ClientAvatar name={name} size="sm" logoUrl={row.clientLogo || undefined} />
                        <span className="block truncate" title={name}>{name}</span>
                    </div>
                );
            },
        },
        {
            key: "course",
            label: "Course",
            className: "w-[14%] px-3 text-left align-middle",
            skeletonWidth: "70%",
            render: (row) => {
                const name = row.courseName || "—";
                return <span className="block truncate" title={name}>{name}</span>;
            },
        },
        {
            key: "item",
            label: "Approval Item",
            className: "w-[14%] px-3 text-left align-middle",
            skeletonWidth: "80%",
            render: (row) => {
                const name = row.exerciseName || "Untitled";
                const reRequest = (row.resubmissionCount || 0) > 0;
                return (
                    <div className="flex items-center gap-1.5 min-w-0" title={name}>
                        <span className="block truncate min-w-0">{name}</span>
                        {reRequest && (
                            <span
                                title="The trainer addressed earlier feedback and re-requested approval."
                                className="inline-flex items-center h-[18px] px-1.5 rounded-chip bg-violet-50 text-violet-700 border border-violet-200 text-[10px] font-semibold flex-shrink-0"
                            >
                                Re-request
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            key: "type",
            label: "Type",
            className: "w-[8%] px-3 text-left align-middle",
            skeletonWidth: "60px",
            render: (row) => {
                const t = tabLabel(row.tabType);
                if (t === "—") return <span className="text-line-muted">—</span>;
                return (
                    <span className="inline-flex items-center h-[20px] px-2 rounded-chip bg-info-50 text-info-700 border border-info-500/25 text-2xs font-semibold whitespace-nowrap">
                        {t}
                    </span>
                );
            },
        },
        {
            key: "submittedBy",
            label: "Submitted By",
            className: "w-[12%] px-3 text-left align-middle",
            skeletonWidth: "80%",
            render: (row) => {
                const name = row.submittedBy?.name || row.submittedBy?.email || "—";
                return <span className="block truncate" title={name}>{name}</span>;
            },
        },
        {
            key: "submittedOn",
            label: "Submitted On",
            className: "w-[10%] px-3 text-left align-middle whitespace-nowrap",
            skeletonWidth: "60px",
            render: (row) => (
                <span className="tabular-nums text-body">{fmtDate(row.initiatedAt)}</span>
            ),
        },
        {
            key: "level",
            label: "Approval Level",
            className: "w-[14%] px-3 text-left align-middle",
            skeletonWidth: "80%",
            render: (row) => {
                const cur = row.currentStep || 1;
                const total = row.totalSteps || 1;
                const role = row.step?.roleName || "";
                const label = role
                    ? `Level ${cur} of ${total} · ${role}`
                    : `Level ${cur} of ${total}`;
                return (
                    <span className="block truncate text-body" title={label}>
                        Level {cur} of {total}
                        {role ? <span className="text-subtle"> · {role}</span> : null}
                    </span>
                );
            },
        },
        {
            key: "actions",
            // pl-4 (not pl-2) gives visible breathing room between Approval
            // Level and the Review button. pr-4/sm:pr-5 keeps the button
            // from hugging the right edge of the container. text-right +
            // whitespace-nowrap so the button hugs the right side of the
            // cell and never wraps.
            label: "Actions",
            className: "w-[10%] no-print pl-4 pr-4 sm:pr-5 text-right whitespace-nowrap align-middle",
            skeletonWidth: "72px",
            render: (row) => (
                <a
                    href={buildReviewHref(row)}
                    className="inline-flex items-center gap-1 h-7 px-2.5 rounded-chip border border-brand-500/30 bg-brand-wash text-brand-strong text-2xs font-semibold hover:bg-brand-100 transition-colors duration-150 whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                >
                    Review
                </a>
            ),
        },
    ];

    return (
        <>
            {/* ── Toolbar: search + three dropdowns + Clear ── */}
            <div className="shrink-0 mb-3 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[240px] max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search client, course, or item..."
                        aria-label="Search"
                        className="w-full h-9 pl-8 pr-8 rounded-md border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                    />
                    {search && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setSearch("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                <Select value={clientFilter} onValueChange={setClientFilter}>
                    <SelectTrigger aria-label="Filter by client" className="h-9 min-w-[180px] rounded-md border-hairline">
                        <SelectValue placeholder="All clients" />
                    </SelectTrigger>
                    <SelectContent
                        sideOffset={4}
                        style={{ width: "var(--radix-select-trigger-width)" }}
                        className="max-h-[280px]"
                    >
                        <SelectItem value="all">All clients</SelectItem>
                        {clientOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={courseFilter} onValueChange={setCourseFilter}>
                    <SelectTrigger aria-label="Filter by course" className="h-9 min-w-[180px] rounded-md border-hairline">
                        <SelectValue placeholder="All courses" />
                    </SelectTrigger>
                    <SelectContent
                        sideOffset={4}
                        style={{ width: "var(--radix-select-trigger-width)" }}
                        className="max-h-[280px]"
                    >
                        <SelectItem value="all">All courses</SelectItem>
                        {courseOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger aria-label="Filter by item type" className="h-9 min-w-[140px] rounded-md border-hairline">
                        <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent
                        sideOffset={4}
                        style={{ width: "var(--radix-select-trigger-width)" }}
                        className="max-h-[280px]"
                    >
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="assessment">Assessment</SelectItem>
                        <SelectItem value="assignment">Assignment</SelectItem>
                    </SelectContent>
                </Select>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md text-xs font-semibold text-brand-strong hover:text-brand-800 transition-colors"
                    >
                        <X size={12} /> Clear filters
                    </button>
                )}
            </div>

            <div ref={tableCardRef} className="flex flex-1 min-h-0 flex-col">
                {loadError ? (
                    <div className="flex-1 min-h-[200px] flex items-center justify-center px-4 py-8 text-sm text-red-600">
                        {loadError}
                    </div>
                ) : (
                    <DataTable<PendingApproval>
                        rows={pageRows}
                        columns={columns}
                        rowKey={(row) => row.exerciseId}
                        sortKey={null}
                        sortDir="asc"
                        onSort={() => {}}
                        isLoading={isLoading}
                        isFiltered={hasActiveFilters}
                        fillHeight
                        fixedLayout
                        emptyTitle={hasActiveFilters ? "No pending approvals match these filters" : "No pending approvals"}
                        emptyHint={
                            hasActiveFilters
                                ? "Try widening or clearing them to see more."
                                : "Exercises and assessments assigned to you for approval will appear here."
                        }
                        emptyAction={hasActiveFilters ? "Clear filters" : undefined}
                        onEmptyAction={hasActiveFilters ? clearFilters : undefined}
                    />
                )}

                <div ref={tableFooterRef}>
                    <TableFooter
                        from={totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1}
                        to={Math.min(safePage * pageSize, totalRows)}
                        total={totalRows}
                        pageSize={pageSize}
                        onPageSize={(n) => { setAutoFitPageSize(false); setPageSize(n); setCurrentPage(1); }}
                        currentPage={safePage}
                        totalPages={totalPages}
                        onPage={setCurrentPage}
                    />
                </div>
            </div>
        </>
    );
}
