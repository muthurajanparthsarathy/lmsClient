"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ApprovalHierarchyModal from "./ApprovalHierarchyModal";
import ApprovalFlowCell from "./ApprovalFlowCell";
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
import { MoreVertical, Pencil, Plus, RotateCcw, Search, X } from "lucide-react";
import { useClients, type Client } from "@/app/lms/pages/clientmanagement/api/clientManagementService";
import { courseStructuresSummaryQuery } from "@/app/lms/pages/coursestructure/api/createCourseStucture";
import { saveApprovalHierarchy } from "@/app/lms/pages/usermanagement/api/userService";
import { getToken } from "@/lib/session";
import { getApprovalStatus, type CourseRow } from "./approvalShared";

// ─── Chains tab — one flat table of every client's course ─────────────────────
export default function ChainsPanel() {
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
