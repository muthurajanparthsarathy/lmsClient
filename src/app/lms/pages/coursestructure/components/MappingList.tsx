"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    Search, SlidersHorizontal, Download, ExternalLink, X, BookOpen, SearchX,
    Printer, FileSpreadsheet, FileText, ChevronDown, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '../../../shared/ui'
import TableFooter from '../../../shared/listing/TableFooter'
import {
    useServiceMappingsPage,
    fetchMappingPageExport,
    type MappingPageFilters,
    type ServiceMapping,
} from '@/apiServices/serviceMappingService'
import { MappingTable } from './MappingTable'
import { MappingCardGrid } from './MappingCard'
import CourseSearchResults, { buildClientCourseMatches } from './CourseSearchResults'
import { MappingFilterPanel, EMPTY_FILTERS, type MappingFilters } from './MappingFilterPanel'
import { groupCourses } from './mappingTree'
import {
    clientNameOf,
    statusOf,
    STATUS_META,
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
    // Business model comes off the populated client. The list endpoint
    // aggregates it via $lookup — falls back to '' when the field is empty.
    const businessModel = typeof m.client === 'string'
        ? ''
        : ((m.client as { businessModel?: string } | undefined)?.businessModel || '')
    return {
        courses: Array.from(
            new Set(groupCourses(m).map((g) => g.courseName.trim()).filter(Boolean))
        ),
        mapping: m,
        id: m._id,
        clientName: clientNameOf(m) || 'N/A',
        businessModel,
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

// Module-scope memory of the last pageSize this list rendered at. The list
// unmounts on stage change (AnimatePresence in the parent) and the auto-fit
// value nearly always matches the viewport, so persisting it across mounts
// makes the FIRST render use the same query key the previous visit ended on
// — instant React Query cache hit, no loader flash on Back-to-list.
let lastMappingListPageSize = 25

export default function MappingList({
    onOpen,
    initialPage = 1,
    onPageChange,
}: {
    onOpen: (mapping: ServiceMapping) => void
    /**
     * Where to resume, and how to report moves — the page is REMEMBERED BY THE
     * PARENT.
     *
     * Opening a mapping swaps the parent's stage, which unmounts this list, so
     * a plain useState(1) reset on every "Manage → Back to clients" round trip
     * however deep the user had drilled. The parent stays mounted for as long
     * as the user is on Course Setup, so it can hand the page back.
     *
     * Read once, on mount: the page stays LOCAL state here because two places
     * below update it during render (the filter reset and the out-of-range
     * clamp), which is legal for a component's own state and not for a
     * parent's. An effect mirrors it upward after commit instead.
     *
     * Deliberately not the URL and not module scope: both survive a reload,
     * and a reload is expected to start over at page 1.
     */
    initialPage?: number
    onPageChange?: (page: number) => void
}) {
    const [search, setSearch] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [filters, setFilters] = useState<MappingFilters>(EMPTY_FILTERS)
    const [showFilters, setShowFilters] = useState(false)
    const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const [currentPage, setCurrentPage] = useState(initialPage)
    // Seed pageSize from the last mount's value (module-scope). Without
    // this, every remount started at 25 → queryKey changed on the very
    // next tick when auto-fit computed the real viewport pageSize → the
    // first request was a cache miss and the skeleton flashed for one
    // round-trip before the second request hit the cache. Persisting the
    // last computed value means the first request uses the same key the
    // previous visit ended on — instant cache hit, no loader.
    const [pageSize, setPageSize] = useState(() => lastMappingListPageSize)
    // Auto-fit page size — matches Client Management + User Management. The
    // wrapper's height / row height picks pageSize, so rows always fill the
    // gap between the toolbar and the pagination footer. Flips off the moment
    // the user picks a size manually.
    const [autoFitPageSize, setAutoFitPageSize] = useState(true)
    const tableCardRef = useRef<HTMLDivElement | null>(null)

    // Mirror every pageSize change into the module-scope memory so the next
    // mount starts with the same value — makes revisits instant cache hits.
    useEffect(() => { lastMappingListPageSize = pageSize }, [pageSize])

    // And the page up to the parent, so it can hand it back when this list
    // remounts after a mapping is closed. In an effect, not inline with the
    // setters: updating a parent during this component's render is exactly the
    // thing React warns about.
    useEffect(() => { onPageChange?.(currentPage) }, [currentPage, onPageChange])

    // Typing is now a request, so it waits for a pause.
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500)
        return () => clearTimeout(timer)
    }, [search])

    // Auto-fit page size to the table wrapper. Same math as Client Management:
    // header 32 + row 44 + footer 44, minus half a row of safety so the last
    // visible row never lands under the overflow-hidden edge and rolls to
    // page 2 silently.
    useEffect(() => {
        if (!autoFitPageSize) return
        if (viewMode !== 'table') return
        const el = tableCardRef.current
        if (!el) return
        const HEADER_H = 32
        const FOOTER_H = 44
        const ROW_H = 44
        const SAFETY = Math.round(ROW_H / 2)
        const compute = () => {
            const budget = Math.max(0, el.clientHeight - HEADER_H - FOOTER_H - SAFETY)
            const fits = Math.max(3, Math.min(50, Math.floor(budget / ROW_H)))
            setPageSize((prev) => (prev === fits ? prev : fits))
        }
        compute()
        const ro = new ResizeObserver(compute)
        ro.observe(el)
        return () => ro.disconnect()
    }, [autoFitPageSize, viewMode])

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
        { setup: true },
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

    // ── Course-search accordion state ────────────────────────────────────────
    // While the search box holds a term AND that term matches course names on
    // the page's rows, the table is swapped for per-client accordion sections
    // (CourseSearchResults) showing only the matching clients with their
    // matching courses, auto-expanded. Everything else about the list — the
    // toolbar, the filters, pagination, the query itself — is untouched, and a
    // term that matches rows by client/service name only (no course hit) keeps
    // the normal table, so searching for a client works exactly as before.
    const searchTerm = debouncedSearch.trim()
    const courseMatchGroups = useMemo(
        () => buildClientCourseMatches(rowVMs, searchTerm),
        [rowVMs, searchTerm]
    )
    const courseSearchActive = searchTerm.length > 0 && courseMatchGroups.length > 0

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

    // ── Export / Print with per-client selection ──────────────────────────────
    // Mirrors the ServiceMapping page: click Export CSV/PDF or Print → popup
    // with a multi-select client list → per-client-per-page output. Each page
    // shows Client Name | Service, Service Model | Year, and the courses under
    // that mapping listed with their configuration status. Nothing hardcoded
    // — data is pulled via fetchMappingPageExport so the file matches the
    // current filters exactly.
    const [pickerMode, setPickerMode] = useState<null | 'csv' | 'pdf' | 'print'>(null)
    const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())
    const [pickerSearch, setPickerSearch] = useState('')
    const [pickerBusy, setPickerBusy] = useState(false)

    const openPicker = (mode: 'csv' | 'pdf' | 'print') => {
        setPickerSelected(new Set())
        setPickerSearch('')
        setPickerMode(mode)
    }
    const closePicker = () => { if (!pickerBusy) setPickerMode(null) }

    // Client options for the picker — the whole institution's clients (from
    // facets), filtered by the popup's own search box.
    const pickerOptions = useMemo(() => {
        const q = pickerSearch.trim().toLowerCase()
        const source: [string, string][] = (facets?.clients ?? []) as [string, string][]
        return q ? source.filter(([, name]) => name.toLowerCase().includes(q)) : source
    }, [facets, pickerSearch])

    type ClientBundle = { id: string; name: string; rows: MappingRowVM[] }
    const fetchClientBundles = async (): Promise<ClientBundle[] | null> => {
        try {
            const res = await fetchMappingPageExport(serverFilters, { setup: true })
            const all = (res.data || []).map(toRowVM)
            if (!all.length) { toast.info('Nothing to export'); return null }
            const byClient = new Map<string, ClientBundle>()
            all.forEach((r) => {
                const m = r.mapping
                const cRef: any = m.client
                const id = cRef && typeof cRef === 'object' ? String(cRef._id) : String(cRef || '')
                if (!id || !pickerSelected.has(id)) return
                const bundle = byClient.get(id) ?? { id, name: r.clientName || '—', rows: [] }
                bundle.rows.push(r)
                byClient.set(id, bundle)
            })
            const bundles = Array.from(byClient.values())
                .sort((a, b) => a.name.localeCompare(b.name))
            if (!bundles.length) { toast.info('Nothing to export for the selected clients'); return null }
            return bundles
        } catch {
            toast.error('Failed to fetch data for export')
            return null
        }
    }

    // Group a client's mappings by service name so the same service never
    // repeats within a client's section. Each service group keeps its own
    // list of MAPPINGS — a mapping is what teaches a set of courses under a
    // (model, year) pair, so the courses stay tied to the model+year they
    // were actually mapped under (not merged across the whole service).
    type ServiceGroup = {
        service: string
        mappings: {
            modelYears: { model: string; year: string }[]
            courses: string[]
            status: MappingRowVM['status']
        }[]
    }
    const groupByService = (b: ClientBundle): ServiceGroup[] => {
        const out = new Map<string, ServiceGroup>()
        b.rows.forEach((r) => {
            const service = r.service || '—'
            const g = out.get(service) ?? { service, mappings: [] }
            const models = r.models.length ? r.models : ['—']
            g.mappings.push({
                modelYears: models.map((sm) => ({ model: sm, year: r.year || '—' })),
                courses: [...r.courses],
                status: r.status,
            })
            out.set(service, g)
        })
        // Sort mappings within each service group by earliest year for a
        // predictable reading order (oldest first).
        out.forEach((g) => {
            g.mappings.sort((x, y) => {
                const yx = x.modelYears[0]?.year || ''
                const yy = y.modelYears[0]?.year || ''
                return String(yx).localeCompare(String(yy))
            })
        })
        return Array.from(out.values())
    }

    // CSV — one "Client Name" row per client (not per service), then a stack
    // of service blocks under it. Each service block is:
    //   Service                (label)
    //   <name>                 (value)
    //   Service Model | Year   (labels)
    //   <model>       | <year> (rows)
    //   S.No | Course Name | Status
    //   1    | ...
    // Never repeat the client name inside a client's own section.
    const runCsv = async (bundles: ClientBundle[]) => {
        const esc = (v: unknown) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
        const lines: string[] = []
        bundles.forEach((b, bi) => {
            lines.push(['Client Name'].map(esc).join(','))
            lines.push([b.name].map(esc).join(','))
            lines.push('')
            const services = groupByService(b)
            services.forEach((g, gi) => {
                lines.push(['Service'].map(esc).join(','))
                lines.push([g.service].map(esc).join(','))
                lines.push('')
                g.mappings.forEach((mp, mi) => {
                    lines.push(['Service Model', 'Year'].map(esc).join(','))
                    if (mp.modelYears.length === 0) {
                        lines.push(['—', '—'].map(esc).join(','))
                    } else {
                        mp.modelYears.forEach((my) => {
                            lines.push([my.model, my.year].map(esc).join(','))
                        })
                    }
                    lines.push('')
                    lines.push(['S.No', 'Course Name', 'Status'].map(esc).join(','))
                    if (mp.courses.length === 0) {
                        lines.push([1, '(no courses mapped)', STATUS_META[mp.status].label].map(esc).join(','))
                    } else {
                        mp.courses.forEach((cn, i) => {
                            lines.push([i + 1, cn, STATUS_META[mp.status].label].map(esc).join(','))
                        })
                    }
                    if (mi < g.mappings.length - 1) lines.push('')
                })
                if (gi < services.length - 1) { lines.push(''); lines.push('') }
            })
            if (bi < bundles.length - 1) { lines.push(''); lines.push(''); lines.push('') }
        })
        const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `course-setup-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${bundles.length} client${bundles.length > 1 ? 's' : ''}`)
    }

    // Rendered HTML shared by PDF (via a print window that saves as PDF) and
    // Print. Each client is one <section> with page-break-inside: avoid, so a
    // client stays together but multiple short clients can share a page.
    //
    // Client Name appears ONCE at the top of the section — even when the same
    // client has multiple services, the name never repeats. Each service is
    // its own sub-block below the client heading.
    const buildPerClientHtml = (bundles: ClientBundle[], printedAt: string): string => {
        const esc = (v: unknown) => String(v ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        const clientPages = bundles.map((b, idx) => {
            const services = groupByService(b)
            const rowBlocks = services.map((g) => {
                // "Service" heading — printed ONCE per service.
                const svcHeader = `
                    <table class="svc-block">
                        <tbody>
                            <tr class="label-row"><td>Service</td></tr>
                            <tr class="value-row"><td class="v-service">${esc(g.service)}</td></tr>
                        </tbody>
                    </table>`
                // For each mapping under this service, a (Model, Year) block
                // followed by its own courses table — so courses stay tied to
                // the model/year they were actually mapped under.
                const mappingBlocks = g.mappings.map((mp) => {
                    const modelYearRows = mp.modelYears.length
                        ? mp.modelYears.map((my) => `
                            <tr class="data-row"><td>${esc(my.model)}</td><td class="num">${esc(my.year)}</td></tr>
                        `).join('')
                        : `<tr class="data-row"><td>—</td><td class="num">—</td></tr>`
                    const courseRows = mp.courses.length
                        ? mp.courses.map((cn, i) => `
                            <tr class="crs-row">
                                <td class="num">${i + 1}</td>
                                <td>${esc(cn)}</td>
                                <td>${esc(STATUS_META[mp.status].label)}</td>
                            </tr>`).join('')
                        : `<tr class="crs-row"><td class="num">—</td><td>(no courses mapped)</td><td>${esc(STATUS_META[mp.status].label)}</td></tr>`
                    return `
                        <div class="model-block">
                            <table class="svc-block">
                                <colgroup><col style="width:50%"/><col style="width:50%"/></colgroup>
                                <tbody>
                                    <tr class="label-row"><td>Service Model</td><td>Year</td></tr>
                                    ${modelYearRows}
                                </tbody>
                            </table>
                            <table class="crs-table">
                                <colgroup><col style="width:60px"/><col/><col style="width:180px"/></colgroup>
                                <thead>
                                    <tr><th>S.No</th><th>Course Name</th><th>Status</th></tr>
                                </thead>
                                <tbody>${courseRows}</tbody>
                            </table>
                        </div>`
                }).join('')
                return `
                    <div class="svc-section">
                        ${svcHeader}
                        ${mappingBlocks}
                    </div>`
            }).join('')
            return `
                <section class="client-page">
                    <h2 class="client-heading">
                        <span class="client-heading-label">Client Name</span>
                        <span class="client-heading-name">${esc(b.name)}</span>
                    </h2>
                    ${rowBlocks}
                    <footer class="client-foot">Client ${idx + 1} of ${bundles.length} · Printed on ${printedAt}</footer>
                </section>`
        }).join('')
        return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <title>Course setup — ${printedAt}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0; padding: 24px 32px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #1f2937; font-size: 12.5px; line-height: 1.5;
        }
        .client-page {
            page-break-inside: avoid; break-inside: avoid;
            /* Top and bottom breathing room so each client reads as its own
               section — clearer separation on-screen and in print. */
            margin-top: 32px;
            margin-bottom: 32px;
        }
        .client-page:first-child { margin-top: 0; }
        .client-page:last-child { margin-bottom: 0; }
        .client-heading {
            margin: 0 0 16px; padding-bottom: 10px;
            border-bottom: 2px solid #111827;
        }
        .client-heading-label {
            display: block; margin-bottom: 3px;
            font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
            text-transform: uppercase; color: #6b7280;
        }
        .client-heading-name {
            font-size: 20px; font-weight: 700; color: #111827;
            letter-spacing: -0.01em;
        }
        .svc-section {
            margin-bottom: 18px;
        }
        .svc-section:last-child { margin-bottom: 0; }
        .model-block {
            /* Big breathing room between one (Service Model → Courses) unit
               and the next, so the reader can tell "these courses belong to
               THAT model" without squinting. First block sits close to the
               Service header. */
            margin-top: 26px;
            padding-left: 12px;
            border-left: 3px solid #e5e7eb;
            page-break-inside: avoid; break-inside: avoid;
        }
        .model-block:first-of-type { margin-top: 8px; }
        .svc-block {
            width: 100%; border-collapse: collapse;
            margin-bottom: 8px;
            border: 1px solid #111827;
        }
        /* Model/Year table INSIDE a .model-block sits flush against its own
           courses table below — no gap between them, so a reader immediately
           sees "this model → these courses". The visible break comes from
           .model-block margin-top on the NEXT unit. */
        .model-block .svc-block { margin-bottom: 0; }
        .model-block .crs-table { margin-top: -1px; /* collapse the double border */ }
        .svc-block td {
            padding: 9px 14px;
            border: 1px solid #d1d5db;
            text-align: left; vertical-align: middle;
        }
        .label-row td {
            background: #111827; color: #fff;
            font-size: 10.5px; font-weight: 700;
            letter-spacing: 0.08em; text-transform: uppercase;
        }
        .value-row .v-client { background: #f3f4f6; font-size: 15px; font-weight: 700; color: #111827; }
        .value-row .v-service { background: #f3f4f6; font-size: 13.5px; font-weight: 600; color: #111827; }
        .spacer-row td {
            background: #fff; height: 12px; padding: 0;
            border-left: 1px solid #111827; border-right: 1px solid #111827;
            border-top: 0; border-bottom: 0;
        }
        .data-row td { background: #ffffff; font-size: 12.5px; }
        .crs-table {
            width: 100%; border-collapse: collapse; margin-bottom: 22px;
            border: 1px solid #d1d5db;
        }
        .crs-table th {
            padding: 8px 14px;
            background: #f9fafb; color: #374151;
            font-size: 10px; font-weight: 700; letter-spacing: 0.06em;
            text-transform: uppercase;
            border: 1px solid #d1d5db;
            text-align: left;
        }
        .crs-table td {
            padding: 7px 14px; border: 1px solid #e5e7eb;
            background: #ffffff; font-size: 12px; vertical-align: top;
        }
        .num { font-variant-numeric: tabular-nums; }
        .client-foot {
            margin-top: 6px; padding-top: 4px;
            font-size: 10px; color: #9ca3af; font-style: italic; text-align: right;
        }
        @page { size: A4; margin: 15mm; }
        @media print { body { padding: 0; } }
    </style>
</head>
<body>${clientPages}</body>
</html>`
    }

    const openPrintWindow = (html: string) => {
        const win = window.open('', '_blank', 'width=1024,height=768')
        if (!win) { toast.error('Please allow pop-ups to print'); return }
        win.document.open(); win.document.write(html); win.document.close()
        const doPrint = () => { try { win.focus(); win.print() } catch { /* pop-up closed */ } }
        if (win.document.readyState === 'complete') setTimeout(doPrint, 100)
        else win.onload = () => setTimeout(doPrint, 100)
    }

    // Direct PDF download — no "Save as PDF" print dialog. jsPDF + autoTable
    // are dynamic-imported (~180 KB) so nothing lands in the initial bundle.
    // Each client is its own set of tables with pageBreak: 'avoid' — the
    // client's block stays together; short clients share a page.
    const exportPdfDirect = async (bundles: ClientBundle[], printedAt: string) => {
        const [{ default: JsPDF }, autoTableMod] = await Promise.all([
            import('jspdf'),
            import('jspdf-autotable'),
        ])
        const autoTable = (autoTableMod as any).default ?? autoTableMod
        const doc = new JsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
        const pageWidth = doc.internal.pageSize.getWidth()
        const MARGIN = 40
        const halfCol = (pageWidth - MARGIN * 2) / 2

        doc.setFontSize(16); doc.setTextColor(17, 24, 39)
        doc.text('Course Setup', MARGIN, MARGIN + 4)
        doc.setFontSize(9); doc.setTextColor(107, 114, 128)
        doc.text(`Printed on ${printedAt} · ${bundles.length} client${bundles.length > 1 ? 's' : ''}`, MARGIN, MARGIN + 20)
        doc.setTextColor(31, 41, 55)

        const labelCell = (t: string) => ({ content: t, styles: { fillColor: [17, 24, 39], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 } as any })
        const clientVal = (t: string) => ({ content: t, styles: { fillColor: [243, 244, 246], fontStyle: 'bold', fontSize: 12 } as any })
        const serviceVal = (t: string) => ({ content: t, styles: { fillColor: [243, 244, 246], fontStyle: 'bold', fontSize: 11 } as any })
        const dataCell = (t: string) => ({ content: t, styles: { fillColor: [255, 255, 255], fontSize: 10 } as any })
        const emptyRow = () => [
            { content: '', styles: { fillColor: [255, 255, 255], minCellHeight: 12 } as any },
            { content: '', styles: { fillColor: [255, 255, 255], minCellHeight: 12 } as any },
        ]

        bundles.forEach((b, ci) => {
            // Client heading — drawn ONCE per client, then all services below
            // reuse the same client (no repeated client name).
            const pageWidthPt = doc.internal.pageSize.getWidth()
            const pageHeightPt = doc.internal.pageSize.getHeight()
            const currentBottom = (doc as any).lastAutoTable?.finalY ?? (MARGIN + 34)
            const headingTop = ci === 0
                ? MARGIN + 34
                : currentBottom + 34
            // If the heading + at least one small block wouldn't fit, jump to a
            // fresh page so a client always starts with its heading visible.
            const needed = 60
            let hy = headingTop
            if (ci > 0 && hy + needed > pageHeightPt - MARGIN) {
                doc.addPage()
                hy = MARGIN
            }
            doc.setDrawColor(17, 24, 39); doc.setLineWidth(1.2)
            doc.line(MARGIN, hy + 30, pageWidthPt - MARGIN, hy + 30)
            doc.setFontSize(8); doc.setTextColor(107, 114, 128)
            doc.text('CLIENT NAME', MARGIN, hy + 8)
            doc.setFontSize(15); doc.setTextColor(17, 24, 39)
            doc.text(b.name, MARGIN, hy + 24)
            // Reset for the subsequent tables.
            doc.setTextColor(31, 41, 55)
            // Manually advance the "finalY" reference so the first block's
            // startY calc below places itself after the heading.
            ;(doc as any).lastAutoTable = { finalY: hy + 38 }

            groupByService(b).forEach((g) => {
                // "Service" header — drawn ONCE per service, spanning both cols.
                const svcHeaderRows: any[] = []
                svcHeaderRows.push([{ ...labelCell('Service'), colSpan: 2 }])
                svcHeaderRows.push([{ ...serviceVal(g.service), colSpan: 2 }])
                autoTable(doc, {
                    startY: ((doc as any).lastAutoTable?.finalY ?? MARGIN) + 14,
                    body: svcHeaderRows,
                    theme: 'grid',
                    margin: { left: MARGIN, right: MARGIN },
                    columnStyles: { 0: { cellWidth: halfCol }, 1: { cellWidth: halfCol } },
                    styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, lineWidth: 0.5, lineColor: [209, 213, 219], overflow: 'linebreak' },
                    pageBreak: 'avoid',
                    rowPageBreak: 'avoid',
                })
                // Each mapping under this service: its own Model/Year block
                // followed by its own courses table — courses stay tied to
                // the model+year they were mapped under.
                //
                // Spacing: 8pt between the Model/Year block and its OWN
                // courses table (kept close so they read as one unit), but
                // 24pt between one mapping's courses table and the NEXT
                // mapping's Model/Year — a bigger gap so the reader can see
                // "this is the previous service model's courses, this is the
                // next service model's" at a glance.
                g.mappings.forEach((mp, mi) => {
                    const bodyRows: any[] = []
                    bodyRows.push([labelCell('Service Model'), labelCell('Year')])
                    if (mp.modelYears.length === 0) {
                        bodyRows.push([dataCell('—'), dataCell('—')])
                    } else {
                        mp.modelYears.forEach((my) => {
                            bodyRows.push([dataCell(my.model), dataCell(my.year)])
                        })
                    }
                    const gapBeforeModel = mi === 0 ? 10 : 24
                    autoTable(doc, {
                        startY: ((doc as any).lastAutoTable?.finalY ?? MARGIN) + gapBeforeModel,
                        body: bodyRows,
                        theme: 'grid',
                        margin: { left: MARGIN, right: MARGIN },
                        columnStyles: { 0: { cellWidth: halfCol }, 1: { cellWidth: halfCol } },
                        styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, lineWidth: 0.5, lineColor: [209, 213, 219], overflow: 'linebreak' },
                        pageBreak: 'avoid',
                        rowPageBreak: 'avoid',
                    })
                    const courseRows: any[] = mp.courses.length
                        ? mp.courses.map((cn, i) => [
                            { content: String(i + 1), styles: { fontSize: 10 } as any },
                            { content: cn, styles: { fontSize: 10 } as any },
                            { content: STATUS_META[mp.status].label, styles: { fontSize: 10 } as any },
                        ])
                        : [[{ content: '—' }, { content: '(no courses mapped)' }, { content: STATUS_META[mp.status].label }]]
                    // Flush against the Model/Year table (no gap) so the two
                    // read as one attached unit: "this model → these courses".
                    // The big gap the reader sees comes from gapBeforeModel on
                    // the NEXT mapping in the loop.
                    autoTable(doc, {
                        startY: (doc as any).lastAutoTable?.finalY ?? MARGIN,
                        head: [['S.No', 'Course Name', 'Status']],
                        body: courseRows,
                        theme: 'grid',
                        margin: { left: MARGIN, right: MARGIN },
                        columnStyles: { 0: { cellWidth: 60 }, 2: { cellWidth: 160 } },
                        headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold', fontSize: 9 },
                        styles: { font: 'helvetica', fontSize: 10, cellPadding: 6, lineWidth: 0.5, lineColor: [209, 213, 219], overflow: 'linebreak' },
                        pageBreak: 'avoid',
                        rowPageBreak: 'avoid',
                    })
                })
            })
        })
        doc.save(`course-setup-${new Date().toISOString().slice(0, 10)}.pdf`)
    }

    const confirmPicker = async () => {
        if (!pickerMode) return
        if (pickerSelected.size === 0) { toast.error('Select at least one client'); return }
        setPickerBusy(true)
        const bundles = await fetchClientBundles()
        if (!bundles) { setPickerBusy(false); return }
        const printedAt = new Date().toLocaleString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        })
        try {
            if (pickerMode === 'csv') {
                await runCsv(bundles)
            } else if (pickerMode === 'pdf') {
                await exportPdfDirect(bundles, printedAt)
                toast.success(`Downloaded PDF — ${bundles.length} client${bundles.length > 1 ? 's' : ''}`)
            } else {
                openPrintWindow(buildPerClientHtml(bundles, printedAt))
            }
            setPickerMode(null)
        } catch {
            toast.error('Export failed')
        } finally {
            setPickerBusy(false)
        }
    }

    // While a search term is active, a zero-row page reads as "No courses
    // found" — the search-first wording the course lookup flow expects. The
    // filter/first-run empty states below are unchanged and still cover every
    // non-search case.
    const emptyState = searchTerm ? (
        <EmptyState
            icon={SearchX}
            title="No courses found"
            message={`Nothing matches "${searchTerm}". Try a different course name or keyword.`}
            secondaryAction={
                <button
                    type="button"
                    onClick={clearFilters}
                    className="h-9 px-3.5 rounded-control border border-hairline-strong bg-surface text-sm font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                >
                    Clear search
                </button>
            }
        />
    ) : hasActiveFilters ? (
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

    const footer = !isLoading && totalRows > 0 && (
        <TableFooter
            from={totalRows === 0 ? 0 : (safePage - 1) * pageSize + 1}
            to={Math.min(safePage * pageSize, totalRows)}
            total={totalRows}
            pageSize={pageSize}
            onPageSize={(n) => { setAutoFitPageSize(false); setPageSize(n); setCurrentPage(1) }}
            currentPage={safePage}
            totalPages={totalPages}
            onPage={setCurrentPage}
        />
    )

    return (
        <div className="flex flex-1 min-h-0 flex-col px-4 sm:px-6 lg:px-8 pt-3 pb-3">
            {/* Slim heading — chip strip dropped to match Client Management. */}
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-base sm:text-lg font-semibold text-heading tracking-[-0.01em]">Course Setup</h1>
            </div>

            {/* One toolbar: search left · Filter · Export · Print grouped
                right · vertical divider · Service Mapping (primary). Same
                layout the other admin lists now use. */}
            <div className="no-print mt-3 flex items-center gap-2 flex-wrap min-w-0">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search client, course, service…"
                        className="w-full h-8 pl-8 pr-8 rounded-control border border-hairline-strong bg-surface text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors duration-150"
                    />
                    {search && (
                        <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex size-5 items-center justify-center rounded-chip text-faint hover:bg-ink-100 hover:text-heading transition-colors duration-150"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                {/* Secondary-action cluster pushed right */}
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setShowFilters((v) => !v)}
                        aria-expanded={showFilters}
                        className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border text-xs font-medium transition-colors duration-150 relative ${activeFilterCount > 0 || showFilters ? 'border-brand text-brand-strong bg-brand-wash' : 'border-hairline-strong bg-surface text-body hover:bg-row-hover hover:text-heading'}`}
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Filter</span>
                        {activeFilterCount > 0 && (
                            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-strong px-1 text-2xs font-bold text-white tabular-nums">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                aria-label="Export list"
                                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Export</span>
                                <ChevronDown className="w-3 h-3" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={6} className="w-40">
                            <DropdownMenuItem onClick={() => openPicker('csv')} className="cursor-pointer">
                                <FileSpreadsheet className="h-4 w-4 text-success-700" /> CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPicker('pdf')} className="cursor-pointer">
                                <FileText className="h-4 w-4 text-danger-500" /> PDF
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                        type="button"
                        onClick={() => openPicker('print')}
                        title="Print — pick which clients to include"
                        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors duration-150"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Print</span>
                    </button>
                </div>

                {/* Primary — Service Mapping shortcut. Divider matches the
                    Add-button treatment on the other pages. */}
                <span className="hidden sm:inline-block h-5 w-px bg-hairline-strong mx-0.5" aria-hidden />
                <button
                    type="button"
                    onClick={goServiceMapping}
                    title="Open Service Mapping"
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-control bg-brand-strong text-white shadow-sm hover:bg-brand-800 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 flex-shrink-0"
                >
                    <ExternalLink size={14} strokeWidth={2.4} />
                    <span className="text-xs font-semibold hidden sm:inline">Service Mapping</span>
                </button>
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
                    ref={tableCardRef}
                    // No opacity dim on background refetches — the earlier
                    // `${isFetching && !isLoading ? 'opacity-60' : ''}` made
                    // the table look "still loading" on every revisit, even
                    // though the cached rows were fully visible. Client
                    // Management renders its cached rows crisp during a
                    // silent refresh; matching that behaviour here.
                    className="mt-2 flex flex-1 min-h-0 flex-col"
                >
                    {courseSearchActive ? (
                        // Search-result state: matching clients as accordion
                        // sections, auto-expanded, matching courses beneath.
                        // The footer stays — the results are still the same
                        // server-paginated rows the table would show.
                        <CourseSearchResults
                            groups={courseMatchGroups}
                            term={searchTerm}
                            onOpen={onOpen}
                        />
                    ) : (
                        <MappingTable
                            rows={rows}
                            // Only show the skeleton when there is NO data on
                            // screen. React Query's `placeholderData:
                            // keepPreviousData` keeps the previous rows during
                            // any background refetch, so `isLoading` alone
                            // used to fire a full skeleton every time the
                            // queryKey rotated even though rows were visible.
                            isLoading={isLoading && rows.length === 0}
                            skeletonRows={pageSize}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={handleSort}
                            onOpen={onOpen}
                            emptyState={emptyState}
                        />
                    )}
                    {footer}
                </div>
            ) : (
                <div className="mt-4">
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


            {/* Client-picker modal used by Export CSV / Export PDF / Print.
                All three share one popup so the user always answers "which
                clients?" the same way. */}
            <AnimatePresence>
                {pickerMode && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.14 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-[2px] p-4"
                        onClick={(e) => { if (e.target === e.currentTarget) closePicker() }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.97, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.97, y: 12 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="flex w-full max-w-lg flex-col rounded-xl border border-hairline bg-surface shadow-2xl"
                        >
                            <header className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-3.5">
                                <div>
                                    <h2 className="text-sm font-semibold text-heading tracking-[-0.01em]">
                                        {pickerMode === 'csv' ? 'Export CSV' : pickerMode === 'pdf' ? 'Export PDF' : 'Print'} — select clients
                                    </h2>
                                    <p className="mt-0.5 text-xs text-subtle">
                                        Each selected client renders on its own page (client name · service · service model · year · courses).
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closePicker}
                                    disabled={pickerBusy}
                                    className="inline-flex size-7 items-center justify-center rounded-chip text-subtle hover:bg-ink-100 hover:text-heading transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/25 disabled:opacity-50"
                                    aria-label="Close"
                                >
                                    <X size={14} />
                                </button>
                            </header>

                            <div className="flex flex-shrink-0 items-center gap-3 border-b border-hairline px-5 py-3">
                                <div className="relative flex-1">
                                    <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                                    <input
                                        type="text"
                                        value={pickerSearch}
                                        onChange={(e) => setPickerSearch(e.target.value)}
                                        placeholder="Search clients…"
                                        className="h-9 w-full rounded-control border border-hairline-strong bg-surface pl-8 pr-3 text-xs text-body placeholder:text-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 transition-colors"
                                    />
                                </div>
                                <span className="text-2xs font-medium tabular-nums text-subtle whitespace-nowrap">
                                    {pickerSelected.size} of {pickerOptions.length} selected
                                </span>
                            </div>

                            <div className="flex items-center gap-3 border-b border-hairline px-5 py-2 text-2xs">
                                <button
                                    type="button"
                                    onClick={() => setPickerSelected(new Set(pickerOptions.map(([id]) => id)))}
                                    disabled={pickerOptions.length === 0 || pickerBusy}
                                    className="font-semibold text-brand-strong hover:text-brand-800 disabled:opacity-40"
                                >
                                    Select all shown
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPickerSelected(new Set())}
                                    disabled={pickerSelected.size === 0 || pickerBusy}
                                    className="font-semibold text-subtle hover:text-heading disabled:opacity-40"
                                >
                                    Clear
                                </button>
                            </div>

                            <ul className="max-h-[45vh] overflow-y-auto px-2 py-2">
                                {pickerOptions.length === 0 ? (
                                    <li className="px-3 py-6 text-center text-xs text-subtle">
                                        No clients match &quot;{pickerSearch}&quot;.
                                    </li>
                                ) : (
                                    pickerOptions.map(([id, name]) => {
                                        const checked = pickerSelected.has(id)
                                        return (
                                            <li key={id}>
                                                <label className="flex cursor-pointer items-center gap-2.5 rounded-control px-3 py-2 text-xs text-body hover:bg-row-hover">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => setPickerSelected((prev) => {
                                                            const next = new Set(prev)
                                                            if (e.target.checked) next.add(id); else next.delete(id)
                                                            return next
                                                        })}
                                                        className="h-4 w-4 cursor-pointer accent-brand-500"
                                                    />
                                                    <span className="truncate font-medium text-heading">{name}</span>
                                                </label>
                                            </li>
                                        )
                                    })
                                )}
                            </ul>

                            <footer className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3">
                                <button
                                    type="button"
                                    onClick={closePicker}
                                    disabled={pickerBusy}
                                    className="inline-flex h-9 items-center px-3.5 rounded-control border border-hairline-strong bg-surface text-xs font-medium text-body hover:bg-row-hover hover:text-heading transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmPicker}
                                    disabled={pickerBusy || pickerSelected.size === 0}
                                    className="inline-flex h-9 items-center gap-1.5 px-4 rounded-control bg-brand-strong text-xs font-semibold text-white shadow-xs hover:bg-brand-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {pickerBusy ? (<><Loader2 size={12} className="animate-spin" /> Preparing…</>) : 'Done'}
                                </button>
                            </footer>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
