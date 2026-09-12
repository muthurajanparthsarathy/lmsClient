"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Download, Info, Loader2, Printer, RotateCcw } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { motion } from 'framer-motion'
import ClientManagementWorkspace from '@/features/businessmanagement/ClientManagementWorkspace'
import { Button } from '@/components/ui/button'
import { pageEnter } from '@/app/lms/shared/ui'
import {
    useClientGroupsPage,
    type MappingPageFilters,
    type ServiceMapping,
} from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import {
    MappingMultiFilter,
    MappingYearRange,
    displayLabel,
} from '@/app/lms/pages/servicemapping/components/MappingReportFilters'
import { collapseAll, scopeByClients, pruneToScope } from '@/app/lms/pages/servicemapping/components/filterScope'
import {
    exportServiceReport,
    loadServiceReport,
    reportTotals,
    type ReportTable,
} from '@/app/lms/pages/servicemapping/components/serviceReport'
import { businessModelDisplayName } from '@/app/lms/pages/clientmanagement/features/lib'
import {
    activeFormat, fetchReportSettings,
    type ReportSettings,
} from '@/app/lms/pages/reportsettings/api/reportSettingsService'
import { exportDesignedPdf, printDesignedReport } from './designedExport'
import { BRAND_FALLBACK } from '@/app/lms/pages/reportsettings/api/brand'
import { fetchInstitutionById } from '@/app/lms/pages/instutionmanagement/api/institutionService'

/* Client Management ▸ Reports.
 *
 * The third tab of the workspace. Client Management and Service Mapping used
 * to carry their own Print/Export controls, which meant two half-reports
 * driven by whatever filters happened to be set on a list. Reporting is its
 * own task — you choose a scope deliberately, then generate — so it gets its
 * own tab and those buttons are gone from the lists.
 *
 * NOTHING loads until Generate report is pressed. The dropdowns are a draft;
 * the report below is a snapshot of the draft as it was at generate time, so
 * fiddling with a filter afterwards cannot silently disagree with the table
 * you are reading.
 *
 * An empty dropdown means "everything" — leaving all four alone and pressing
 * Generate reports on every client, which is the common case and should not
 * require ticking every box.
 */

/** The year control has two modes; the switch beside it swaps them.
 *  'years' — tick individual years (2024, 2026) — is the default, because
 *  picking one or two named years is the common case and a range picker makes
 *  that a two-step job. 'range' is for a span (2024–2026). */
type PeriodMode = 'years' | 'range'

type Draft = {
    clients: string[]
    businessModels: string[]
    serviceModels: string[]
    /** Individually ticked years. Used in 'years' mode. */
    years: string[]
    /** Span bounds. Used in 'range' mode. */
    yearFrom: string
    yearTo: string
    period: PeriodMode
}

const EMPTY: Draft = {
    clients: [], businessModels: [], serviceModels: [],
    years: [], yearFrom: '', yearTo: '', period: 'years',
}

/** Facets are institution-wide, so the query that fetches them asks for the
 *  smallest possible page — it is the `facets` envelope we are after, not rows. */
const NO_FILTERS: MappingPageFilters = {}

/** What the innermost table can show, and how each cell is read off a mapping.
 *  The Columns button ticks these; the order here is the order they appear. */
const COLUMNS = [
    // Client and Business model describe the CLIENT, so on screen they are the
    // two heading levels rather than columns. In an export they can be columns
    // — ticking Client alone gives a plain client list — so they live here too
    // and the builder decides which role each plays.
    { key: 'client', label: 'Client', get: () => '' },
    { key: 'business', label: 'Business model', get: () => '' },
    { key: 'model', label: 'Service model', get: (row: ServiceMapping) => (row.serviceModels || []).map(displayLabel).join(', ') },
    { key: 'year', label: 'Providing year', get: (row: ServiceMapping) => row.year || '' },
    { key: 'code', label: 'Service ID', get: (row: ServiceMapping) => row.serviceCode || '' },
] as const

type ColumnKey = (typeof COLUMNS)[number]['key']

/** The client-level fields, which head the on-screen blocks. */
const HEADING_KEYS: ColumnKey[] = ['client', 'business']
/** Everything that varies per service — what the on-screen table shows. */
const SERVICE_COLUMNS = COLUMNS.filter((column) => !HEADING_KEYS.includes(column.key))

/** Service model and year by default — "service model with year" is the thing
 *  the report is about; the rest are opt-in through the Columns button. */
const DEFAULT_COLUMNS: ColumnKey[] = ['model', 'year']

export default function BusinessReportsPage() {
    const [draft, setDraft] = useState<Draft>({ ...EMPTY })
    /* Which columns the on-screen table carries. Fixed, not state: the export
     * dialog's first step is where columns are chosen now, so a second picker
     * beside Generate asked the same question twice and the two could disagree
     * about what the report contained. */
    const columns = DEFAULT_COLUMNS
    const [snapshot, setSnapshot] = useState<{ draft: Draft; rows: ServiceMapping[]; generated: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState<null | 'csv' | 'pdf' | 'print'>(null)
    /** Export / Print asks two questions before it runs: which clients, then
     *  which columns. Null while the dialog is closed. */
    const [exportFlow, setExportFlow] = useState<null | {
        format: 'csv' | 'pdf' | 'print'
        step: 1 | 2
        columns: ColumnKey[]
        clients: string[]
    }>(null)
    const [error, setError] = useState('')
    const request = useRef<AbortController | null>(null)
    useEffect(() => () => request.current?.abort(), [])

    const facetsQuery = useClientGroupsPage(NO_FILTERS, 1, 1)
    const facets = facetsQuery.data?.facets

    /* The page designs from System Settings ▸ Report Settings. Fetched once and
     * kept: an export has to know which letterhead a client gets, and asking at
     * click time would make the button wait on a request. A failure here is not
     * an error — no settings simply means the plain built-in layout. */
    const [reportSettings, setReportSettings] = useState<ReportSettings | undefined>()

    /* The letterhead's WORDING, as opposed to its layout. The design stores
     * {org} / {address} / {contact} as tokens, so the institution's own record
     * is what a report actually prints — correct an address in Institution
     * Management and every report picks it up with no design to reopen.
     *
     * Fetched next to the design because they are needed at the same moment and
     * both are cheap; a failure is not an error, the tokens just fall back. */
    const [letterhead, setLetterhead] = useState<{ org: string; address: string; contact: string }>(BRAND_FALLBACK)

    useEffect(() => {
        const institutionId = typeof window === 'undefined' ? null : localStorage.getItem('smartcliff_institution')
        if (!institutionId) return
        let cancelled = false
        fetchReportSettings(institutionId)
            .then((settings) => { if (!cancelled) setReportSettings(settings) })
            .catch(() => { /* plain layout */ })
        fetchInstitutionById(institutionId)
            .then((institution) => {
                if (cancelled) return
                setLetterhead({
                    org: institution?.inst_name?.trim() || BRAND_FALLBACK.org,
                    // An institution with no address on file prints a blank
                    // line rather than the placeholder — a wrong address on a
                    // letterhead is worse than none.
                    address: institution?.address?.trim() || '',
                    contact: institution?.phone?.trim() || '',
                })
            })
            .catch(() => { /* the fallback wording */ })
        return () => { cancelled = true }
    }, [])

    // Picking clients narrows the other three to what those clients actually
    // have, so the dropdowns stop offering combinations that return nothing.
    const clientScope = useMemo(() => scopeByClients(facets, draft.clients), [facets, draft.clients])

    /* Service models are free text, so the same model exists in the data under
     * several casings — "Skilling" and "skilling" both appear. Listed raw that
     * is two identical-looking rows, and ticking one silently misses the other
     * client's mappings. So options are keyed by their DISPLAY label, and the
     * raw values behind each label travel together: one row, one tick, every
     * spelling matched. */
    const serviceModelGroups = useMemo(() => {
        const scoped = pruneToScope(facets?.serviceModels ?? [], clientScope?.serviceModels)
        const byLabel = new Map<string, string[]>()
        for (const raw of scoped) {
            const label = displayLabel(raw)
            byLabel.set(label, [...(byLabel.get(label) || []), raw])
        }
        return byLabel
    }, [facets, clientScope])

    const options = useMemo(() => ({
        clients: (facets?.clients ?? []).map(([id, name]) => ({ value: id, label: name })),
        businessModels: pruneToScope(facets?.businessModels ?? [], clientScope?.businessModels)
            .map((value) => ({ value, label: businessModelDisplayName(value) || value })),
        serviceModels: [...serviceModelGroups.keys()].sort().map((label) => ({ value: label, label })),
        years: clientScope ? clientScope.years : (facets?.years ?? []),
    }), [facets, clientScope, serviceModelGroups])

    /* Everything ticked on arrival, so the page opens on the whole picture and
     * Generate answers "show me all of it" without any setup. Narrowing is then
     * a matter of UN-ticking, which is the quicker direction when the common
     * case is "everything".
     *
     * Seeded ONCE, the first time facets arrive. Re-seeding on every facet
     * change would fight the user: clearing a dropdown would silently refill
     * on the next background refetch. */
    const seeded = useRef(false)
    useEffect(() => {
        if (seeded.current || !facets) return
        seeded.current = true
        setDraft((d) => ({
            ...d,
            clients: (facets.clients ?? []).map(([id]) => id),
            businessModels: facets.businessModels ?? [],
            serviceModels: [...new Set((facets.serviceModels ?? []).map(displayLabel))].sort(),
            years: [...(facets.years ?? [])].sort(),
        }))
    }, [facets])

    const hasDraft = Boolean(
        draft.clients.length || draft.businessModels.length || draft.serviceModels.length
        || draft.years.length || draft.yearFrom || draft.yearTo
    )

    const generate = useCallback(async () => {
        request.current?.abort()
        const controller = new AbortController()
        request.current = controller
        setLoading(true)
        setError('')
        const asked: Draft = { ...draft }
        const sortedYears = [...asked.years].sort()
        try {
            // The server filters on the offering YEAR; it has no notion of a
            // calendar window. In date mode the year bounds are widened to the
            // years the window touches so the fetch stays narrow, and the rows
            // are trimmed to the exact window below.
            // "All of them" and "no filter" select the same rows, but the
            // first spells every id into the query string — hundreds of them on
            // a large institution, past the server's id guard. collapseAll
            // drops the list when it covers every option; the dropdown still
            // shows them all ticked.
            const allClients = collapseAll(asked.clients, options.clients.length)
            const allBusiness = collapseAll(asked.businessModels, options.businessModels.length)
            const allServiceModels = collapseAll(asked.serviceModels, options.serviceModels.length)

            const filters: MappingPageFilters = {
                clients: allClients.length ? allClients : undefined,
                businessModels: allBusiness.length ? allBusiness : undefined,
                // Expand each chosen label back to every raw spelling it covers.
                serviceModels: allServiceModels.length
                    ? allServiceModels.flatMap((label) => serviceModelGroups.get(label) || [label])
                    : undefined,
                // The API takes a span, not a set. Ticked years therefore
                // travel as their own min–max so the fetch stays narrow, and
                // the gaps are trimmed below: 2024 + 2026 without 2025 is not
                // something a from–to can express.
                yearFrom: asked.period === 'range'
                    ? (asked.yearFrom || undefined)
                    : (sortedYears[0] || undefined),
                yearTo: asked.period === 'range'
                    ? (asked.yearTo || undefined)
                    : (sortedYears[sortedYears.length - 1] || undefined),
            }
            let rows = await loadServiceReport(filters, controller.signal)

            if (asked.period === 'years' && asked.years.length && asked.years.length < options.years.length) {
                const wanted = new Set(asked.years)
                rows = rows.filter((row) => wanted.has(String(row.year || '')))
            }

            if (!controller.signal.aborted) {
                setSnapshot({
                    draft: asked,
                    rows,
                    generated: new Date().toLocaleString(),
                })
            }
        } catch (err) {
            if (!controller.signal.aborted) {
                setError(err instanceof Error && err.message ? err.message : 'Could not build the report. Please try again.')
            }
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }, [draft, serviceModelGroups, options.clients.length, options.businessModels.length, options.serviceModels.length, options.years.length])

    /* The report shows what was ASKED FOR — nothing more.
     *
     * Pick only Client and you get `S. No. | Client`: a numbered list of
     * clients, one row each. Add Business model and a Business model column
     * appears, and so on for Service model and the period. A fixed
     * client-then-services layout answered a question nobody had asked and
     * buried the two columns that were wanted under four that were not.
     *
     * Rows are the distinct combinations of the chosen columns, so the grain
     * follows the columns: clients alone collapse to one row per client, while
     * adding Service model splits a client into a row per model. */
    /* The report shows what was ASKED FOR, in the shape that reads best.
     *
     * Pick only Client and you get a plain numbered list — `S. No. | Client`.
     * Ask for anything more and it becomes one SUB-TABLE PER CLIENT: the
     * client heads its own block with its business model, and its services sit
     * inside with their year. A client is one heading, not a name repeated
     * down a column, and its services are a small table you can read on their
     * own.
     *
     * Business model lives on the CLIENT, not the mapping — one per client —
     * so it belongs in the block heading rather than in a column that would
     * repeat the same value on every service row.
     *
     * The shape is `ReportTable.sections`, which Excel, PDF and Print already
     * render as heading + subtitle + table, so the file matches the screen. */
    /* Client ▸ business model ▸ its services.
     *
     * Three levels, because that is how the thing is actually shaped: a client
     * is engaged under a business model, and each engagement runs services.
     * Flattening it put the client's name on every service row and the
     * business model on every row under it — the same two values repeated
     * until the detail was hard to find.
     *
     * The YEAR is always available as a column whether or not a year filter
     * was set: "no year chosen" means every year, not no years.
     *
     * `sections` is derived alongside the tree — one per (client, business
     * model) — because Excel, PDF and Print render sections as heading +
     * subtitle + table, so the file mirrors the screen. */
    const clientNames = useMemo(
        () => new Map((facets?.clients ?? []).map(([id, name]) => [String(id), name])),
        [facets],
    )

    const report = useMemo(() => {
        if (!snapshot) return null
        const d = snapshot.draft
        const detailed = d.businessModels.length > 0 || d.serviceModels.length > 0
            || d.years.length > 0 || Boolean(d.yearFrom || d.yearTo)

        const picked = SERVICE_COLUMNS.filter((column) => columns.includes(column.key))
        const headers = ['S. No.', ...picked.map((column) => column.label)]

        type Group = { business: string; services: ServiceMapping[] }
        // clientId travels with the node so an export can look up that client's
        // saved page design; the name alone would not match one.
        type Node = { client: string; clientId: string; groups: Map<string, Group> }
        const byClient = new Map<string, Node>()

        for (const row of snapshot.rows) {
            const clientObj = typeof row.client === 'object' && row.client ? row.client : null
            // `client` is usually populated, but some mappings carry only the
            // id. Keying on the label in that case merged every such mapping
            // into ONE "Unnamed client" block — 22 clients rendered as 19.
            // Key on the id whatever shape it arrives in, and resolve the name
            // from the facets, which list [id, name] for every client.
            const clientKey = String(clientObj?._id || row.client || 'unknown')
            const name = clientObj?.clientCompany || clientNames.get(clientKey) || 'Unnamed client'
            const node = byClient.get(clientKey) || { client: name, clientId: clientKey, groups: new Map<string, Group>() }
            const rawBusiness = clientObj?.businessModel || ''
            const business = rawBusiness ? businessModelDisplayName(rawBusiness) || rawBusiness : 'No business model'
            const group = node.groups.get(business) || { business, services: [] }
            group.services.push(row)
            node.groups.set(business, group)
            byClient.set(clientKey, node)
        }

        const tree = [...byClient.values()]
            .sort((a, b) => a.client.localeCompare(b.client))
            .map((node) => ({
                client: node.client,
                clientId: node.clientId,
                groups: [...node.groups.values()]
                    .sort((a, b) => a.business.localeCompare(b.business))
                    .map((group) => ({
                        business: group.business,
                        // The raw mappings travel with the group: the export
                        // dialog can tick a column that is not on screen, and
                        // it needs the record to read it off.
                        services: group.services,
                        rows: [...group.services]
                            .sort((a, b) => (a.year || '').localeCompare(b.year || '', undefined, { numeric: true })
                                || (a.serviceCode || '').localeCompare(b.serviceCode || ''))
                            .map((row, index) => [String(index + 1), ...picked.map((column) => column.get(row) || '—')]),
                    })),
            }))

        const flat: ReportTable = detailed
            ? {
                headers,
                rows: tree.flatMap((node) => node.groups.flatMap((group) => group.rows)),
                sections: tree.flatMap((node) => node.groups.map((group) => {
                    const count = group.rows.length
                    return {
                        title: node.client,
                        subtitle: `${group.business}  ·  ${count} ${count === 1 ? 'service' : 'services'}`,
                        headers,
                        rows: group.rows,
                    }
                })),
            }
            : {
                headers: ['S. No.', 'Client'],
                rows: tree.map((node, index) => [String(index + 1), node.client]),
            }

        return { detailed, tree, table: flat }
    }, [snapshot, columns, clientNames])

    const table = report?.table ?? null
    const totals = useMemo(() => (snapshot ? reportTotals(snapshot.rows) : null), [snapshot])


    /* The exported table, built from the DIALOG's picks rather than from what
     * happens to be on screen.
     *
     * Tick only Client and the file is a numbered client list — no sections, no
     * service rows. Tick anything service-level and it becomes the same
     * client ▸ business-model sections the screen shows, carrying exactly the
     * ticked columns. */
    const buildExportTable = useCallback((picks: ColumnKey[], clientsWanted: string[]): ReportTable | null => {
        if (!report) return null
        const wanted = new Set(clientsWanted)
        const nodes = report.tree.filter((node) => wanted.has(node.client))
        const serviceCols = SERVICE_COLUMNS.filter((column) => picks.includes(column.key))
        const wantsClient = picks.includes('client')
        const wantsBusiness = picks.includes('business')

        if (!serviceCols.length) {
            const headers = ['S. No.']
            if (wantsClient) headers.push('Client')
            if (wantsBusiness) headers.push('Business model')
            return {
                headers,
                rows: nodes.map((node, index) => {
                    const cells = [String(index + 1)]
                    if (wantsClient) cells.push(node.client)
                    if (wantsBusiness) cells.push(node.groups.map((group) => group.business).join(', '))
                    return cells
                }),
            }
        }

        const headers = ['S. No.', ...serviceCols.map((column) => column.label)]
        const sections = nodes.flatMap((node) => node.groups.map((group) => ({
            title: wantsClient ? node.client : '',
            subtitle: [wantsBusiness ? group.business : '', `${group.services.length} ${group.services.length === 1 ? 'service' : 'services'}`].filter(Boolean).join('  ·  '),
            headers,
            rows: group.services.map((service, index) => [
                String(index + 1),
                ...serviceCols.map((column) => column.get(service) || '—'),
            ]),
        })))
        return { headers, rows: sections.flatMap((section) => section.rows), sections }
    }, [report])

    const exportPreview = useMemo(
        () => (exportFlow ? buildExportTable(exportFlow.columns, exportFlow.clients) : null),
        [exportFlow, buildExportTable],
    )

    const runExport = async () => {
        if (!exportFlow || !snapshot || exporting) return
        const built = buildExportTable(exportFlow.columns, exportFlow.clients)
        if (!built || !built.rows.length) return
        const format = exportFlow.format
        setExporting(format)
        try {
            const scope = `${exportFlow.clients.length} client${exportFlow.clients.length === 1 ? '' : 's'}  ·  ${built.rows.length} row${built.rows.length === 1 ? '' : 's'}`

            // One design, applied to every report page — the active setting
            // from System Settings ▸ Report Settings. A report routinely spans
            // several clients, so a per-client letterhead has no answer for the
            // common case.
            const design = activeFormat(reportSettings)

            if (design && format !== 'csv') {
                // {title} is the REPORT's name, not the design's. The design is called
                // things like "Default setting"; printing that as the heading of a
                // services report would be meaningless. This matches the title the
                // plain (no-design) export writes, so the two paths agree.
                const meta = { scope, generated: snapshot.generated, title: 'Services report', ...letterhead }
                if (format === 'pdf') {
                    await exportDesignedPdf(design, built, meta, `report-${new Date().toISOString().slice(0, 10)}`)
                } else {
                    printDesignedReport(design, built, meta)
                }
            } else {
                // No design saved, or a spreadsheet — the plain layout, which
                // is what this page did before Report Settings existed.
                await exportServiceReport(format, built, scope, snapshot.generated)
            }
            setExportFlow(null)
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Export failed. Please try again.')
        } finally {
            setExporting(null)
        }
    }

    /** Opens the two-step dialog with everything pre-ticked, so the quick path
     *  is Next → Export rather than a form to fill in. */
    const openExport = (format: 'csv' | 'pdf' | 'print') => {
        if (!report) return
        setExportFlow({
            format,
            step: 1,
            columns: [...HEADING_KEYS, ...columns],
            clients: report.tree.map((node) => node.client),
        })
    }

    /** Back to the state the page opened in — everything ticked — not to an
     *  empty form. Reset means "start over", and starting over here is the
     *  whole picture. */
    const reset = () => {
        request.current?.abort()
        setDraft({
            ...EMPTY,
            clients: (facets?.clients ?? []).map(([id]) => id),
            businessModels: facets?.businessModels ?? [],
            serviceModels: [...new Set((facets?.serviceModels ?? []).map(displayLabel))].sort(),
            years: [...(facets?.years ?? [])].sort(),
        })
        setSnapshot(null)
        setError('')
        setLoading(false)
    }

    return (
        <ClientManagementWorkspace>
            <motion.div variants={pageEnter} initial="hidden" animate="visible" className="flex h-full min-h-0 min-w-0 flex-col">
                <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-6 md:px-8 pt-3 pb-3">

                    <div className="no-print flex shrink-0 flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                            <h1 className="text-sm font-semibold tracking-[-0.01em] text-heading sm:text-base">Reports</h1>
                            <p className="mt-0.5 text-xs text-subtle">
                                Choose a scope, then generate. Leave a dropdown untouched to include everything in it.
                            </p>
                        </div>

                        {/* Export and Print live at the top, weighted like the
                            primary actions they are. Both open the same
                            two-step dialog — which clients, then which columns —
                            because the file is rarely the whole screen. */}
                        <div role="group" aria-label="Export report" className="flex shrink-0 items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-brand-500/40 text-xs font-bold text-brand-strong hover:bg-brand-wash"
                                disabled={!report || !table?.rows.length || Boolean(exporting)}
                                onClick={() => openExport('csv')}
                            >
                                <Download className="size-4" />Export
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                className="text-xs font-bold"
                                disabled={!report || !table?.rows.length || Boolean(exporting)}
                                onClick={() => openExport('print')}
                            >
                                <Printer className="size-4" />Print
                            </Button>
                        </div>
                    </div>

                    {/* ── The scope form ─────────────────────────────────── */}
                    <div className="no-print mt-3 shrink-0 rounded-xl border border-hairline bg-canvas/40 p-3">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Client</p>
                                <MappingMultiFilter
                                    label="Clients"
                                    options={options.clients}
                                    value={draft.clients}
                                    onChange={(clients) => setDraft((d) => ({ ...d, clients }))}
                                    placeholder="Select client"
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Business model</p>
                                <MappingMultiFilter
                                    label="Business models"
                                    options={options.businessModels}
                                    value={draft.businessModels}
                                    onChange={(businessModels) => setDraft((d) => ({ ...d, businessModels }))}
                                    placeholder="Select business model"
                                    emptyLabel={clientScope ? 'No business models for the selected clients' : undefined}
                                />
                            </div>
                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Service model</p>
                                <MappingMultiFilter
                                    label="Service models"
                                    options={options.serviceModels}
                                    value={draft.serviceModels}
                                    onChange={(serviceModels) => setDraft((d) => ({ ...d, serviceModels }))}
                                    placeholder="Select service model"
                                    emptyLabel={clientScope ? 'No service models for the selected clients' : undefined}
                                />
                            </div>

                            {/* The period control, in whichever of its two modes
                                is active. The button swaps them and clears the
                                other mode's values, so a generated report can
                                never carry a stale bound from the mode you are
                                not looking at. */}
                            <div className="min-w-0 [&>div>button]:w-full">
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                    <p className="truncate text-xs font-medium text-subtle">Offering year</p>
                                    {/* Switching modes clears the other one's
                                        values, so a generated report can never
                                        carry a bound from the mode you are not
                                        looking at. */}
                                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5" title="Report on a span of years instead of individual ones">
                                        <span className={`text-[11px] font-medium ${draft.period === 'range' ? 'text-brand-strong' : 'text-subtle'}`}>Range</span>
                                        <Switch
                                            checked={draft.period === 'range'}
                                            onCheckedChange={(on) => setDraft((d) => (on
                                                ? { ...d, period: 'range', years: [] }
                                                : { ...d, period: 'years', yearFrom: '', yearTo: '' }))}
                                            aria-label="Use a year range"
                                            className="scale-75"
                                        />
                                    </label>
                                </div>

                                {draft.period === 'years' ? (
                                    <MappingMultiFilter
                                        label="Years"
                                        options={options.years.map((year) => ({ value: year, label: year }))}
                                        value={draft.years}
                                        onChange={(years) => setDraft((d) => ({ ...d, years }))}
                                        placeholder="Select year"
                                        emptyLabel={clientScope ? 'No years for the selected clients' : undefined}
                                    />
                                ) : (
                                    <MappingYearRange
                                        from={draft.yearFrom}
                                        to={draft.yearTo}
                                        years={options.years}
                                        onChange={(yearFrom, yearTo) => setDraft((d) => ({ ...d, yearFrom, yearTo }))}
                                        placeholder="Select year range"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" className="text-xs" disabled={loading || facetsQuery.isLoading} onClick={() => void generate()}>
                                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <BarChart3 className="size-3.5" />}
                                {loading ? 'Generating…' : 'Generate report'}
                            </Button>

                            {(hasDraft || snapshot) && (
                                <Button type="button" variant="outline" size="sm" className="text-xs" disabled={loading} onClick={reset}>
                                    <RotateCcw className="size-3.5" />Reset
                                </Button>
                            )}

                            {/* Tell the reader what to do rather than leaving
                                four identical "Select …" boxes and no hint
                                about where to start. */}
                            {!draft.clients.length && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-strong">
                                    <Info className="size-3.5 shrink-0" />
                                    No client selected — pick at least one, or generate to include every client.
                                </span>
                            )}
                        </div>
                    </div>

                    {/* ── The report ─────────────────────────────────────── */}
                    <div className="mt-3 min-h-0 flex-1 overflow-y-auto">
                        {error && (
                            <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">
                                {error}
                                <Button variant="outline" size="sm" className="text-xs" onClick={() => void generate()}>Retry</Button>
                            </div>
                        )}

                        {!snapshot && !loading && !error && (
                            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-hairline p-6 text-center">
                                <BarChart3 className="mb-2 size-8 text-brand-strong" />
                                <h2 className="text-sm font-semibold text-heading">Ready when you are</h2>
                                <p className="mt-1.5 max-w-md text-xs leading-5 text-subtle">
                                    Everything is selected, so <span className="font-semibold text-heading">Generate report</span> gives
                                    you the whole picture — every client, grouped by business model. Un-tick a dropdown
                                    first to narrow it down.
                                </p>
                            </div>
                        )}

                        {loading && !snapshot && (
                            <div role="status" aria-label="Generating report" className="space-y-3">
                                {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-100" />)}
                            </div>
                        )}

                        {snapshot && table && totals && (
                            <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`}>
                                <div className="no-print mb-3 flex flex-wrap items-center gap-2">
                                    <div className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-canvas/40 px-2.5">
                                        <span className="text-xs text-subtle">Clients</span>
                                        <span className="text-sm font-semibold tabular-nums text-heading">{totals.clients.toLocaleString()}</span>
                                    </div>
                                    <div className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-canvas/40 px-2.5">
                                        <span className="text-xs text-subtle">Services</span>
                                        <span className="text-sm font-semibold tabular-nums text-heading">{totals.services.toLocaleString()}</span>
                                    </div>
                                    <div className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-canvas/40 px-2.5">
                                        <span className="text-xs text-subtle">Active</span>
                                        <span className="text-sm font-semibold tabular-nums text-heading">{totals.active.toLocaleString()}</span>
                                    </div>
                                </div>

                                {!table.rows.length ? (
                                    <p className="rounded-xl border border-dashed border-hairline py-12 text-center text-sm text-subtle">
                                        Nothing matches this combination. Try a wider scope.
                                    </p>
                                ) : report?.detailed ? (
                                    <div className="space-y-3">
                                        {report.tree.map((node, nodeIndex) => (
                                            <section key={`${node.client}-${nodeIndex}`} className="overflow-hidden rounded-xl border border-hairline bg-white">
                                                {/* Level 1 — the client */}
                                                <header className="flex items-baseline gap-2 border-b border-hairline bg-canvas/60 px-3 py-2">
                                                    <span className="shrink-0 text-sm font-semibold tabular-nums text-subtle">{nodeIndex + 1}.</span>
                                                    <h3 className="min-w-0 truncate text-sm font-semibold text-heading" title={node.client}>{node.client}</h3>
                                                </header>

                                                {node.groups.map((group, groupIndex) => (
                                                    <div key={`${group.business}-${groupIndex}`} className={groupIndex ? 'border-t border-hairline' : ''}>
                                                        {/* Level 2 — the business model this client is engaged under */}
                                                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 bg-brand-wash/40 px-3 py-1.5 pl-6">
                                                            <span className="min-w-0 truncate text-xs font-semibold text-brand-strong">{group.business}</span>
                                                            <span className="shrink-0 text-[11px] text-subtle">
                                                                {group.rows.length} {group.rows.length === 1 ? 'service' : 'services'}
                                                            </span>
                                                        </div>
                                                        {/* Level 3 — its services */}
                                                        <div className="max-w-full overflow-x-auto pl-6">
                                                            <table className="w-full border-collapse text-xs">
                                                                <thead>
                                                                    <tr>
                                                                        {table.headers.map((header, index) => (
                                                                            <th
                                                                                key={header}
                                                                                className="border-b border-hairline px-2.5 py-1.5 text-left font-semibold text-subtle"
                                                                                style={index === 0 ? { width: 56 } : undefined}
                                                                            >
                                                                                {header}
                                                                            </th>
                                                                        ))}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {group.rows.map((row, index) => (
                                                                        <tr key={index} className="border-b border-hairline/50 last:border-0">
                                                                            {row.map((cell, column) => (
                                                                                <td
                                                                                    key={column}
                                                                                    className={`px-2.5 py-1.5 align-top ${column === 0 ? 'tabular-nums text-subtle' : 'text-body'}`}
                                                                                >
                                                                                    {cell}
                                                                                </td>
                                                                            ))}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                ))}
                                            </section>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="max-w-full overflow-x-auto rounded-lg border border-hairline bg-white">
                                        <table className="w-full border-collapse text-xs">
                                            <thead>
                                                <tr>
                                                    {table.headers.map((header, index) => (
                                                        <th
                                                            key={header}
                                                            className="border border-hairline bg-[#344b63] px-2.5 py-2 text-left font-semibold text-white"
                                                            style={index === 0 ? { width: 72 } : undefined}
                                                        >
                                                            {header}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {table.rows.map((row, index) => (
                                                    <tr key={index} className="even:bg-canvas/40">
                                                        {row.map((cell, column) => (
                                                            <td
                                                                key={column}
                                                                className={`border border-hairline px-2.5 py-2 align-top ${column === 0 ? 'tabular-nums text-subtle' : 'text-body'}`}
                                                            >
                                                                {cell}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            {/* ── Export / Print, in two questions ─────────────────────────
                1. which clients  2. which columns. Both pre-ticked, so the
                quick path is Next → Export. */}
            {exportFlow && report && (
                <Dialog open onOpenChange={(open) => { if (!open && !exporting) setExportFlow(null) }}>
                    <DialogContent showCloseButton={!exporting} className="flex max-h-[88dvh] w-[92vw] max-w-lg flex-col gap-0 overflow-hidden p-0">
                        <DialogHeader className="shrink-0 border-b border-hairline px-5 py-3.5 text-left">
                            <DialogTitle className="flex items-center gap-2 text-base">
                                {exportFlow.format === 'print'
                                    ? <><Printer className="size-4 shrink-0 text-brand-strong" />Print report</>
                                    : <><Download className="size-4 shrink-0 text-brand-strong" />Export report</>}
                            </DialogTitle>
                            <DialogDescription className="mt-1 text-xs">
                                Step {exportFlow.step} of 2 — {exportFlow.step === 1 ? 'choose the clients' : 'choose the columns'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                            {exportFlow.step === 1 ? (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2 pb-1">
                                        <span className="text-[11px] font-medium text-subtle">
                                            {exportFlow.clients.length} of {report.tree.length} selected
                                        </span>
                                        <button
                                            type="button"
                                            className="text-[11px] font-semibold text-brand-strong hover:underline"
                                            onClick={() => setExportFlow((flow) => (flow ? {
                                                ...flow,
                                                clients: flow.clients.length === report.tree.length ? [] : report.tree.map((node) => node.client),
                                            } : flow))}
                                        >
                                            {exportFlow.clients.length === report.tree.length ? 'Clear all' : 'Select all'}
                                        </button>
                                    </div>
                                    {report.tree.map((node, index) => {
                                        const checked = exportFlow.clients.includes(node.client)
                                        return (
                                            <label key={`${node.client}-${index}`} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 hover:bg-row-hover">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => setExportFlow((flow) => (flow ? {
                                                        ...flow,
                                                        clients: event.target.checked
                                                            ? [...flow.clients, node.client]
                                                            : flow.clients.filter((name) => name !== node.client),
                                                    } : flow))}
                                                    className="size-4 accent-[var(--color-brand-strong,#c2410c)]"
                                                />
                                                <span className="min-w-0 truncate text-xs font-medium text-heading">{node.client}</span>
                                                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-subtle">
                                                    {node.groups.reduce((n, group) => n + group.services.length, 0)}
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {COLUMNS.map((column) => {
                                        const checked = exportFlow.columns.includes(column.key)
                                        return (
                                            <label key={column.key} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 hover:bg-row-hover">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => setExportFlow((flow) => (flow ? {
                                                        ...flow,
                                                        columns: event.target.checked
                                                            ? COLUMNS.filter((c) => c.key === column.key || flow.columns.includes(c.key)).map((c) => c.key)
                                                            : flow.columns.filter((key) => key !== column.key),
                                                    } : flow))}
                                                    className="size-4 accent-[var(--color-brand-strong,#c2410c)]"
                                                />
                                                <span className="text-xs font-medium text-heading">{column.label}</span>
                                                {HEADING_KEYS.includes(column.key) && (
                                                    <span className="ml-auto text-[10px] text-subtle">groups the rows</span>
                                                )}
                                            </label>
                                        )
                                    })}
                                    <p className="pt-1 text-[11px] leading-relaxed text-subtle">
                                        Tick only <span className="font-semibold text-heading">Client</span> for a plain
                                        client list. Any service column turns it into per-client blocks.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-hairline px-5 py-3">
                            <span className="text-[11px] text-subtle">
                                {exportPreview ? `${exportPreview.rows.length} row${exportPreview.rows.length === 1 ? '' : 's'}` : ''}
                            </span>
                            <div className="flex items-center gap-2">
                                {exportFlow.step === 2 && (
                                    <Button type="button" variant="outline" size="sm" className="text-xs" disabled={Boolean(exporting)} onClick={() => setExportFlow((flow) => (flow ? { ...flow, step: 1 } : flow))}>
                                        Back
                                    </Button>
                                )}
                                {exportFlow.step === 1 ? (
                                    <Button type="button" size="sm" className="text-xs" disabled={!exportFlow.clients.length} onClick={() => setExportFlow((flow) => (flow ? { ...flow, step: 2 } : flow))}>
                                        Next
                                    </Button>
                                ) : (
                                    <Button type="button" size="sm" className="text-xs" disabled={!exportFlow.columns.length || Boolean(exporting)} onClick={() => void runExport()}>
                                        {exporting
                                            ? <><Loader2 className="size-3.5 animate-spin" />Working…</>
                                            : exportFlow.format === 'print'
                                                ? <><Printer className="size-3.5" />Print</>
                                                : <><Download className="size-3.5" />Export</>}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </ClientManagementWorkspace>
    )
}
