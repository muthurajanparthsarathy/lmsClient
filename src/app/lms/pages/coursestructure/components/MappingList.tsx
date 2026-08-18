"use client"

import React, { useEffect, useMemo, useState } from 'react'
import { Search, SlidersHorizontal, List, LayoutGrid, MoreHorizontal, Download, ExternalLink, X, BookOpen, SearchX } from 'lucide-react'
import { toast } from 'sonner'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '../../../shared/ui'
import { HeaderStats } from '../../../shared/ui/HeaderStats'
import TableFooter from '../../../shared/listing/TableFooter'
import {
    useServiceMappingsPage,
    fetchMappingPageExport,
    type MappingPageFilters,
    type ServiceMapping,
} from '@/apiServices/serviceMappingService'
import { MappingTable } from './MappingTable'
import { MappingCardGrid } from './MappingCard'
import { MappingFilterPanel, EMPTY_FILTERS, type MappingFilters } from './MappingFilterPanel'
import { groupCourses } from './mappingTree'
import {
    clientNameOf,
    statusOf,
    STATUS_META,
    formatDate,
    type MappingRowVM,
} from './mappingPresentation'

// Stage 1 of Course Setup: the clients whose services have been mapped. Each row
// is one mapping, and its Manage Course action drills into that mapping's
// hierarchy (courses were chosen in Map Service, so nothing is picked here).
//
// Data-first workspace: slim header + compact stat chips, one toolbar, all
// filters behind an inline panel, and a rich full-height table (or card view)
// as the hero.
//
// ── The list is SERVER-paginated ─────────────────────────────────────────────
// It used to download every mapping in the institution (108,133 bytes for 39,
// and every one of them carrying its full masterData / hierarchy / courses /
// batchConfigs subtrees) and then filter, sort and `slice(25)` the array in the
// browser. The search, the seven filters, the sort and the page now go to Mongo
// — 27KB and a third of the time for a page — and this component owns that
// query rather than being handed a list.
//
// Two things a single page cannot produce come back with it:
//   • `stats` — the four header tiles count the WHOLE book of work
//   • `facets` — the filter dropdowns list every value, not the page's
//   • each row's `setupProgress`, which used to be derived here from the full
//     course-structure list (see getSetupProgress, server-side)
// The equivalence of the server's selection with this page's old predicate is
// asserted over live data by server/scripts/verifyCourseSetupPagination.js.

const STATUS_OPTIONS = [
    { value: 'configured', label: 'Fully configured' },
    { value: 'in-progress', label: 'Partially configured' },
    { value: 'not-started', label: 'Not started' },
    { value: 'no-courses', label: 'No courses' },
]
const DATE_OPTIONS = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
    { value: 'year', label: 'This year' },
]

const goServiceMapping = () => { window.location.href = '/lms/pages/servicemapping' }

// Sort keys as the TABLE names them → as the endpoint names them. Only
// `status` differs, and dangerously so: a mapping's own `status` field is
// active/inactive, while this column means the derived configuration state.
// Sending the table's name would sort by the wrong thing, silently.
const SERVER_SORT_KEY: Record<string, string> = {
    client: 'client',
    model: 'model',
    year: 'year',
    status: 'setupStatus',
    progress: 'progress',
    updated: 'updated',
}

// One row's view-model. `setupProgress` rides on the row from the server; the
// course names are still derived here, from the mapping's own courses, using
// the same `groupCourses` the hierarchy stage uses — so what a row says it
// teaches is exactly what you find after drilling in, including a course that
// appears at several places in the tree (one name, not one entry per
// placement).
const toRowVM = (m: ServiceMapping): MappingRowVM => {
    const { configured = 0, total = 0 } = m.setupProgress || {}
    return {
        courses: Array.from(
            new Set(groupCourses(m).map((g) => g.courseName.trim()).filter(Boolean))
        ),
        mapping: m,
        id: m._id,
        clientName: clientNameOf(m) || 'N/A',
        serviceCode: m.serviceCode || '',
        service: m.service || '',
        models: (m.serviceModels || []).filter(Boolean),
        year: m.year || '',
        status: statusOf(configured, total),
        configured,
        total,
        updatedAt: m.updatedAt || m.createdAt,
        isInactive: m.status === 'inactive',
    }
}

// The Created Date filter's vocabulary, resolved to an epoch cutoff. Lives on
// this side because the wording is the page's; the server only ever sees the
// timestamp.
const dateCutoff = (d: string): number => {
    const day = 86400000
    if (d === '7') return Date.now() - 7 * day
    if (d === '30') return Date.now() - 30 * day
    if (d === '90') return Date.now() - 90 * day
    if (d === 'year') return new Date(new Date().getFullYear(), 0, 1).getTime()
    return 0
}

export default function MappingList({
    onOpen,
}: {
    onOpen: (mapping: ServiceMapping) => void
}) {
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [filters, setFilters] = useState<MappingFilters>(EMPTY_FILTERS)
    const [showFilters, setShowFilters] = useState(false)
    const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [isExporting, setIsExporting] = useState(false)

    // Typing is now a request, so it waits for a pause.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500)
        return () => clearTimeout(timer)
    }, [search])

    // What the server is asked for. The cutoff is resolved HERE rather than per
    // render: as a live `Date.now()` it would differ on every render and churn
    // the query key forever.
    const serverFilters: MappingPageFilters = useMemo(() => {
        const cutoff = dateCutoff(filters.date)
        return {
            search: debouncedSearch.trim() || undefined,
            // Course Setup's own haystack — the only one that searches the
            // course names a mapping teaches.
            searchScope: 'setup',
            client: filters.client || undefined,
            service: filters.service || undefined,
            serviceModel: filters.model || undefined,
            course: filters.course || undefined,
            year: filters.year || undefined,
            // NOT `status`: that is the mapping's active/inactive flag.
            setupStatus: filters.status || undefined,
            createdAfter: cutoff || undefined,
            sortKey: sortKey ? SERVER_SORT_KEY[sortKey] : undefined,
            sortDir: sortKey ? sortDir : undefined,
            // This list reverses its sorted array for descending, so equal
            // values flip too. On Year, where nearly every row ties, that is
            // the difference between the first page and the last.
            sortTies: sortKey ? 'reverse' : undefined,
        }
    }, [debouncedSearch, filters, sortKey, sortDir])

    // Changing a filter goes back to page 1. This adjusts state DURING render
    // rather than in an effect: as an effect it would commit the new filter
    // with the OLD page number first, firing a request for a page nobody asked
    // for and then a second one for page 1. React re-runs this render before
    // committing, so only the page-1 request is ever made.
    const filterSignature = JSON.stringify(serverFilters)
    const [lastFilterSignature, setLastFilterSignature] = useState(filterSignature)
    if (lastFilterSignature !== filterSignature) {
        setLastFilterSignature(filterSignature)
        setCurrentPage(1)
    }

    const { data, isLoading, isFetching } = useServiceMappingsPage(
        serverFilters,
        currentPage,
        pageSize,
        { setup: true }
    )

    const rowVMs: MappingRowVM[] = useMemo(
        () => (data?.data || []).map(toRowVM),
        [data]
    )

    const facets = data?.facets
    const options = useMemo(() => ({
        // Values are lower-cased so the filter compares like with like against
        // the server's anchored, case-insensitive course match.
        courses: (facets?.courses || []).map((s) => ({ value: s.toLowerCase(), label: s })),
        clients: (facets?.clients || []).map(([value, label]) => ({ value, label })),
        services: (facets?.services || []).map((s) => ({ value: s, label: s })),
        models: (facets?.serviceModels || []).map((s) => ({ value: s, label: s })),
        years: (facets?.years || []).map((s) => ({ value: s, label: s })),
    }), [facets])

    const activeFilterCount =
        (filters.client ? 1 : 0) + (filters.service ? 1 : 0) + (filters.model ? 1 : 0) +
        (filters.course ? 1 : 0) +
        (filters.year ? 1 : 0) + (filters.status ? 1 : 0) + (filters.date ? 1 : 0)
    const hasActiveFilters = Boolean(search.trim()) || activeFilterCount > 0

    const clearFilters = () => {
        setSearch(''); setFilters(EMPTY_FILTERS); setCurrentPage(1)
    }

    // Third click clears the sort, returning to the server's order.
    const handleSort = (key: string) => {
        if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return }
        if (sortDir === 'asc') { setSortDir('desc'); return }
        setSortKey(null); setSortDir('asc')
    }

    // The filter/sort/slice memos that stood here are gone: the server does all
    // three now, and `rows` IS the page. Their exact predicate survives in
    // server/scripts/verifyCourseSetupPagination.js, which replays it over the
    // full list and asserts the endpoint selects the same rows.
    const rows = rowVMs
    const totalRows = data?.total ?? 0
    const totalPages = Math.max(1, data?.totalPages ?? 1)
    // A page that no longer exists — the list shrank under a filter that was
    // already applied (a mapping deleted in another tab, say). Corrected during
    // render for the same reason the filter reset is.
    if (data && currentPage > totalPages) setCurrentPage(totalPages)
    const safePage = Math.min(currentPage, totalPages)

    // The four tiles count the WHOLE book of work — every mapping and every
    // course in the institution, not the filtered rows and not this page. They
    // come from the server for exactly that reason.
    const stats = data?.stats
    const mappedCount = stats?.mappings ?? 0
    const totalCourses = stats?.courses ?? 0
    const configuredCount = stats?.configured ?? 0
    const pending = stats?.pending ?? 0

    // Chips for the applied drawer filters (search has its own box).
    const filterChips: { key: string; label: string; onRemove: () => void }[] = [
        ...(filters.client ? [{ key: 'client', label: options.clients.find((o) => o.value === filters.client)?.label || 'Client', onRemove: () => setFilters((f) => ({ ...f, client: '' })) }] : []),
        ...(filters.service ? [{ key: 'service', label: filters.service, onRemove: () => setFilters((f) => ({ ...f, service: '' })) }] : []),
        ...(filters.model ? [{ key: 'model', label: filters.model, onRemove: () => setFilters((f) => ({ ...f, model: '' })) }] : []),
        ...(filters.course ? [{ key: 'course', label: options.courses.find((o) => o.value === filters.course)?.label || filters.course, onRemove: () => setFilters((f) => ({ ...f, course: '' })) }] : []),
        ...(filters.year ? [{ key: 'year', label: filters.year, onRemove: () => setFilters((f) => ({ ...f, year: '' })) }] : []),
        ...(filters.status ? [{ key: 'status', label: STATUS_OPTIONS.find((o) => o.value === filters.status)?.label || filters.status, onRemove: () => setFilters((f) => ({ ...f, status: '' })) }] : []),
        ...(filters.date ? [{ key: 'date', label: DATE_OPTIONS.find((o) => o.value === filters.date)?.label || filters.date, onRemove: () => setFilters((f) => ({ ...f, date: '' })) }] : []),
    ]

    const copyServiceId = (code: string) => {
        try { navigator.clipboard?.writeText(code); toast.success(`Copied ${code}`) } catch { /* clipboard unavailable */ }
    }

    // Export EVERY row the current filters select, not the ones on screen. The
    // rows come back in one `export=1` request carrying the same filters and
    // sort, so the file matches the list the user is looking at. Before
    // pagination this read the in-memory array; left alone it would have
    // quietly exported one page and still called itself the list.
    const exportCsv = async () => {
        if (isExporting) return
        if (!totalRows) { toast.info('Nothing to export'); return }
        setIsExporting(true)
        try {
            const res = await fetchMappingPageExport(serverFilters, { setup: true })
            const exported = (res.data || []).map(toRowVM)
            if (!exported.length) { toast.info('Nothing to export'); return }
            const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
            const header = ['Client', 'Service ID', 'Service', 'Service Models', 'Courses', 'Year', 'Status', 'Configured', 'Total Courses', 'Last Updated']
            const lines = [
                header.join(','),
                ...exported.map((r) => [
                    r.clientName, r.serviceCode, r.service, r.models.join(' | '), r.courses.join(' | '), r.year,
                    STATUS_META[r.status].label, r.configured, r.total, formatDate(r.updatedAt),
                ].map(esc).join(',')),
            ]
            const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `course-setup-${new Date().toISOString().slice(0, 10)}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success(`Exported ${exported.length} row${exported.length > 1 ? 's' : ''}`)
        } catch {
            toast.error('Could not export the list')
        } finally {
            setIsExporting(false)
        }
    }

    const emptyState = hasActiveFilters ? (
        <EmptyState
            icon={SearchX}
            title="No mappings match your filters"
            message="Try widening or clearing them to see more mapped services."
            secondaryAction={
                <button
                    type="button"
                    onClick={clearFilters}
                    className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                >
                    Clear filters
                </button>
            }
        />
    ) : (
        <EmptyState
            icon={BookOpen}
            title="No mapped services yet"
            message="Map a service to a client first — its courses then appear here to set up."
            primaryAction={
                <button
                    type="button"
                    onClick={goServiceMapping}
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-control bg-brand-strong text-white text-sm font-semibold shadow-xs hover:bg-brand-800 transition-colors duration-150"
                >
                    Go to Service Mapping
                </button>
            }
        />
    )

    // Reserve viewport room for the chrome above the table: base header/toolbar/
    // footer, plus the chip row and the inline filter panel when they are open.
    // Base trimmed from 17.5 → 15 after the header lost its subtitle line —
    // reclaims ~2.5rem (about one extra row) while keeping the intentional
    // breathing room below the footer that the user asked to preserve.
    const tableMaxH = `calc(100dvh - ${15 + (filterChips.length > 0 ? 2.5 : 0) + (showFilters ? 14 : 0)}rem)`

    const footer = !isLoading && totalRows > 0 && (
        <TableFooter
            from={totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1}
            to={Math.min(safePage * pageSize, totalRows)}
            total={totalRows}
            pageSize={pageSize}
            onPageSize={(n) => { setPageSize(n); setCurrentPage(1) }}
            currentPage={safePage}
            totalPages={totalPages}
            onPage={setCurrentPage}
        />
    )

    return (
        <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-4">
            {/* ── Slim header + compact stat chips ── */}
            {/* flex-nowrap on md+ so the chip strip stays anchored right;
                left column shrinks (flex-1 min-w-0) so its long subtitle
                wraps within its own column instead of pushing the strip
                down onto a new line. */}
            <div className="flex items-start justify-between gap-4 flex-wrap md:flex-nowrap">
                <div className="min-w-0 flex-1">
                    {/* Heading size matched to Client Management + Service
                        Mapping so the baseline is identical across the LMS. */}
                    <h1 className="text-xl sm:text-2xl font-semibold text-heading tracking-[-0.01em]">Course Setup</h1>
                </div>
                {/* Right-aligned stat strip via shared HeaderStats — same
                    primitive as Client Management + Service Mapping. */}
                <HeaderStats
                    loading={isLoading}
                    items={[
                        { label: 'Mapped', value: mappedCount },
                        { label: 'Courses', value: totalCourses },
                        { label: 'Configured', value: configuredCount },
                        { label: 'Pending', value: pending },
                    ]}
                />
            </div>

            {/* ── One toolbar: search · Filter · view toggle · overflow ── */}
            <div className="mt-4 flex items-center gap-2">
                <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        // No page reset here: the request is keyed off the
                        // DEBOUNCED term, and resetting now would fire a page-1
                        // request for the search the user has already left.
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search client, course, service ID, service or model…"
                        className="w-full h-10 pl-10 pr-9 rounded-control border border-hairline-strong bg-surface text-sm text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                    />
                    {search && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex size-6 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Filter — toggles the inline panel on the same screen */}
                <button
                    type="button"
                    onClick={() => setShowFilters((v) => !v)}
                    aria-expanded={showFilters}
                    className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-control border text-sm font-medium shadow-xs transition-colors duration-150 relative ${activeFilterCount > 0 || showFilters ? 'border-brand text-brand-strong bg-brand-wash' : 'border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading'}`}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span className="hidden sm:inline">Filter</span>
                    {activeFilterCount > 0 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold text-white tabular-nums">
                            {activeFilterCount}
                        </span>
                    )}
                </button>

                {/* View toggle */}
                <div className="hidden sm:flex items-center p-0.5 rounded-control border border-hairline-strong bg-surface h-10">
                    <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        title="Table view"
                        aria-label="Table view"
                        className={`h-8 w-8 rounded-chip flex items-center justify-center transition-colors duration-150 ${viewMode === 'table' ? 'bg-brand-wash text-brand-strong' : 'text-faint hover:text-heading'}`}
                    >
                        <List className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('card')}
                        title="Card view"
                        aria-label="Card view"
                        className={`h-8 w-8 rounded-chip flex items-center justify-center transition-colors duration-150 ${viewMode === 'card' ? 'bg-brand-wash text-brand-strong' : 'text-faint hover:text-heading'}`}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                </div>

                {/* Overflow */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label="More actions"
                            className="inline-flex items-center justify-center h-10 px-2.5 rounded-control border border-hairline-strong bg-surface text-body shadow-xs hover:bg-row-hover hover:text-heading transition-colors duration-150"
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={6} className="w-56">
                        <DropdownMenuItem onClick={exportCsv} disabled={isExporting} className="cursor-pointer">
                            <Download className="h-4 w-4" /> {isExporting ? 'Exporting…' : 'Export list (CSV)'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={goServiceMapping} className="cursor-pointer">
                            <ExternalLink className="h-4 w-4" /> Open Service Mapping
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* ── Inline filter panel — expands on the same screen under the toolbar ── */}
            <MappingFilterPanel
                open={showFilters}
                onClose={() => setShowFilters(false)}
                current={filters}
                clientOptions={options.clients}
                serviceOptions={options.services}
                modelOptions={options.models}
                courseOptions={options.courses}
                yearOptions={options.years}
                statusOptions={STATUS_OPTIONS}
                dateOptions={DATE_OPTIONS}
                onApply={(f) => { setFilters(f); setCurrentPage(1) }}
                onReset={() => { setFilters(EMPTY_FILTERS); setCurrentPage(1) }}
            />

            {/* ── Active filter chips ── */}
            {filterChips.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {filterChips.map((chip) => (
                        <span
                            key={chip.key}
                            className="inline-flex items-center gap-1.5 h-7 pl-2.5 pr-1.5 rounded-full border border-brand-500/30 bg-brand-wash text-xs font-medium text-brand-strong"
                        >
                            {chip.label}
                            <button
                                type="button"
                                aria-label={`Remove ${chip.label} filter`}
                                onClick={chip.onRemove}
                                className="inline-flex size-4 items-center justify-center rounded-full hover:bg-brand-500/20 transition-colors duration-150"
                            >
                                <X size={11} />
                            </button>
                        </span>
                    ))}
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs font-medium text-subtle hover:text-heading transition-colors duration-150 ml-0.5"
                    >
                        Clear all
                    </button>
                </div>
            )}

            {/* ── Content: table (hero) or card view ── */}
            {/* `keepPreviousData` holds the current rows while the next page
                loads, so the table never blanks — but with the filtering now a
                round trip, unchanged rows would otherwise be the only feedback
                that anything is happening. A dim is the whole signal. */}
            {viewMode === 'table' ? (
                <div
                    className={`mt-4 bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden transition-opacity duration-150 ${isFetching && !isLoading ? 'opacity-60' : ''}`}
                >
                    <MappingTable
                        rows={rows}
                        isLoading={isLoading}
                        skeletonRows={pageSize}
                        sortKey={sortKey}
                        sortDir={sortDir}
                        onSort={handleSort}
                        onOpen={onOpen}
                        onCopyServiceId={copyServiceId}
                        onOpenServiceMapping={goServiceMapping}
                        emptyState={emptyState}
                        maxBodyHeight={tableMaxH}
                    />
                    {footer}
                </div>
            ) : (
                <div className={`mt-4 transition-opacity duration-150 ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
                    <MappingCardGrid
                        rows={rows}
                        isLoading={isLoading}
                        skeletonCount={pageSize}
                        onOpen={onOpen}
                        onCopyServiceId={copyServiceId}
                        onOpenServiceMapping={goServiceMapping}
                        emptyState={emptyState}
                    />
                    {!isLoading && totalRows > 0 && (
                        <div className="mt-3 bg-surface rounded-xl border border-hairline shadow-xs overflow-hidden">
                            {footer}
                        </div>
                    )}
                </div>
            )}

        </div>
    )
}
