"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import TableFooter from "@/app/lms/shared/listing/TableFooter";
import DataTable, { type Column } from "@/app/lms/shared/listing/DataTable";
import { ClientAvatar } from "@/app/lms/pages/servicemapping/components/workspaceShared";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { api } from "@/app/lms/pages/clientmanagement/lib/apiClient";
import { queryKeys } from "@/lib/queryKeys";
import { readStoredUserData } from "@/app/lms/shared/ui/navItems";
import { fmtDate, tabLabel, type PendingApproval } from "./approvalShared";

// ─── Pending Approvals tab — flat DataTable listing (2026-09-04) ──────────────
// Replaces the older "Waiting on you" card. Reuses the same primitives the
// Approval Setup tab uses so both tabs feel like one system: shared
// DataTable, ClientAvatar in the Client column, auto-fit page size,
// TableFooter for the pager. Data comes straight from the (server-enriched)
// /approvals/pending endpoint — every row is an actual pending exercise
// assigned to the logged-in user's current approval level, so there is no
// static/placeholder content.
export default function PendingPanel() {
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
