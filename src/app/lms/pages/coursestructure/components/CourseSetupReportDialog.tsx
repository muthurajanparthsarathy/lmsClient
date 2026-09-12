"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Building2, Download, FileText, Loader2, Printer, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
    fetchMappingPageExport,
    type MappingFacets,
    type MappingPageFilters,
} from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import { scopeByClients } from '@/app/lms/pages/servicemapping/components/filterScope'
import {
    displayLabel,
    MappingMultiFilter,
    MappingYearRange,
    serviceLabel,
} from '@/app/lms/pages/servicemapping/components/MappingReportFilters'
import { Switch } from '@/components/ui/switch'
import { businessModelDisplayName } from '@/app/lms/pages/clientmanagement/features/lib'
import { STATUS_META, statusOf, toRowVM } from './mappingPresentation'
import { exportServiceReport, type ReportTable } from '@/app/lms/pages/servicemapping/components/serviceReport'
import {
    activeFormat, fetchReportSettings, type ReportSettings,
} from '@/app/lms/pages/reportsettings/api/reportSettingsService'
import { BRAND_FALLBACK } from '@/app/lms/pages/reportsettings/api/brand'
import { exportDesignedPdf, printDesignedReport } from '@/app/lms/pages/businessreports/designedExport'
import { fetchInstitutionById } from '@/app/lms/pages/instutionmanagement/api/institutionService'

/* The Course Setup report, which works the way Business Reports does.

   Every dropdown opens with EVERYTHING ticked, and nothing is fetched until
   Generate is pressed. Those two go together: a form that starts full would
   otherwise fetch the institution's entire mapping list the moment the dialog
   appeared, and again after every un-tick on the way to what was actually
   wanted. Starting full and narrowing by un-ticking is the quicker direction
   when the common case is "all of it".

   Taking the report works the way Business Reports does too, because it is the
   same job: Export / PDF / Print off the header, each opening a two-step
   dialog — which clients, then which columns — and the PDF and Print come out
   through the saved Report Setting, so both reports carry one letterhead.

   The shape is one block per CLIENT: the client's name and business model,
   then a line per mapping giving service, service model and year, then that
   mapping's courses listed underneath. Reading it answers "what is this client
   getting, and which courses does it cover" without scanning a flat grid for
   repeated client names. */

type Option = { value: string; label: string }
type Options = { clients: Option[]; services: Option[]; models: Option[]; courses: Option[]; years: Option[] }

/** The year control has two modes; the switch beside it swaps them.
 *  'years' — tick individual years (2024, 2026) — is the default, because
 *  picking one or two named years is the common case and a range picker makes
 *  that a two-step job. 'range' is for a span (2024–2026). */
type PeriodMode = 'years' | 'range'

type Draft = {
    clients: string[]
    services: string[]
    models: string[]
    courses: string[]
    /** Individually ticked years. Used in 'years' mode. */
    years: string[]
    /** Span bounds. Used in 'range' mode. */
    yearFrom: string
    yearTo: string
    period: PeriodMode
}

const EMPTY: Draft = {
    clients: [], services: [], models: [], courses: [],
    years: [], yearFrom: '', yearTo: '', period: 'years',
}

type ModelNode = { model: string; year: string; status: string; courses: string[]; configured: number; total: number }
type ServiceNode = { service: string; models: ModelNode[]; courseCount: number }
type ClientBlock = { client: string; businessModel: string; services: ServiceNode[]; courseCount: number }

const DASH = '—'
const text = (value: unknown) => { const s = String(value ?? '').trim(); return s || DASH }

/** Nest the export payload three deep: client, then each service it buys, then
 *  each service model + year under that service, with the courses listed
 *  inside. Rows are read through toRowVM — the same derivation the list uses,
 *  where courses come from the mapping's own course array rather than a field
 *  guessed at off the wire.
 *
 *  A mapping can carry several service models; its courses belong to the
 *  mapping, so they are listed under each of them. Two mappings sharing a
 *  service, model and year merge into one node with their courses deduped. */
function toClientBlocks(raw: { data?: unknown[] }): ClientBlock[] {
    const byClient = new Map<string, ClientBlock>()

    for (const mapping of (raw.data || []) as Parameters<typeof toRowVM>[0][]) {
        const row = toRowVM(mapping)
        const clientRef = (row.mapping as { client?: unknown })?.client
        const clientObject = clientRef && typeof clientRef === 'object' ? clientRef as Record<string, unknown> : null
        const clientKey = String(clientObject?._id ?? row.clientName)

        const block = byClient.get(clientKey) ?? {
            client: row.clientName || DASH,
            businessModel: businessModelDisplayName(row.businessModel),
            services: [] as ServiceNode[],
            courseCount: 0,
        }

        const serviceName = serviceLabel(text(row.service))
        let service = block.services.find((node) => node.service === serviceName)
        if (!service) { service = { service: serviceName, models: [], courseCount: 0 }; block.services.push(service) }

        const year = text(row.year)
        const models = row.models.length ? row.models.map(displayLabel) : [DASH]
        for (const modelName of models) {
            let node = service.models.find((item) => item.model === modelName && item.year === year)
            if (!node) { node = { model: modelName, year, status: '', courses: [], configured: 0, total: 0 }; service.models.push(node) }
            for (const raw of row.courses) {
                const course = displayLabel(raw)
                if (!node.courses.includes(course)) node.courses.push(course)
            }
            node.configured += row.configured
            node.total += row.total
        }
        byClient.set(clientKey, block)
    }

    // Totals and status last, once every mapping has folded in.
    const blocks = [...byClient.values()]
    for (const block of blocks) {
        block.courseCount = 0
        block.services.sort((a, b) => a.service.localeCompare(b.service))
        for (const service of block.services) {
            service.models.sort((a, b) => a.model.localeCompare(b.model) || a.year.localeCompare(b.year))
            service.courseCount = 0
            for (const node of service.models) {
                node.courses.sort((a, b) => a.localeCompare(b))
                node.status = STATUS_META[statusOf(node.configured, node.total)].label
                service.courseCount += node.courses.length
            }
            block.courseCount += service.courseCount
        }
    }
    return blocks.sort((a, b) => a.client.localeCompare(b.client))
}

/** One line per course, which is the grain this report is actually about:
 *  a client buys a service, under a service model, in a year, covering courses.
 *  A model with nothing mapped still produces a line, so "no courses" is
 *  visible in the file rather than being an absent row nobody notices. */
type CourseLine = { service: string; model: string; year: string; course: string; status: string }

function courseLines(block: ClientBlock): CourseLine[] {
    const lines: CourseLine[] = []
    for (const service of block.services) {
        for (const node of service.models) {
            const base = { service: service.service, model: node.model, year: node.year, status: node.status }
            if (!node.courses.length) lines.push({ ...base, course: DASH })
            else for (const course of node.courses) lines.push({ ...base, course })
        }
    }
    return lines
}

/** What the export can carry, and how each cell is read off a course line.
 *  The order here is the order the columns appear. */
const COLUMNS = [
    // Client and Business model describe the CLIENT, so in a grouped report they
    // are the two heading levels rather than columns. Ticking Client alone gives
    // a plain client list, so they live here too and the builder decides which
    // role each plays.
    { key: 'client', label: 'Client', get: () => '' },
    { key: 'business', label: 'Business model', get: () => '' },
    { key: 'service', label: 'Service', get: (line: CourseLine) => line.service },
    { key: 'model', label: 'Service model', get: (line: CourseLine) => line.model },
    { key: 'year', label: 'Providing year', get: (line: CourseLine) => line.year },
    { key: 'course', label: 'Course', get: (line: CourseLine) => line.course },
    { key: 'status', label: 'Setup status', get: (line: CourseLine) => line.status },
] as const

type ColumnKey = (typeof COLUMNS)[number]['key']

/** The client-level fields, which head the blocks. */
const HEADING_KEYS: ColumnKey[] = ['client', 'business']
/** Everything that varies per course — what the table rows carry. */
const ROW_COLUMNS = COLUMNS.filter((column) => !HEADING_KEYS.includes(column.key))

/** Names the report, heads the printed page and names the file. */
const REPORT_TITLE = 'Course setup report'

export default function CourseSetupReportDialog({ filters, options, facets, onClose }: {
    filters: MappingPageFilters
    options: Options
    facets?: MappingFacets
    onClose: () => void
}) {
    const [draft, setDraft] = useState<Draft>({ ...EMPTY })
    const [blocks, setBlocks] = useState<ClientBlock[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [exporting, setExporting] = useState<null | 'csv' | 'pdf' | 'print'>(null)

    /* The page design reports print on - System Settings > Report Settings.
     * Fetched once and kept: an export has to know the letterhead, and asking
     * at click time would make the button wait on a request. A failure here is
     * not an error - no settings simply means the plain built-in layout.
     *
     * The institution's own name and address ride alongside it, for a design
     * whose text uses the {org} / {address} / {contact} tokens. The stock
     * letterhead spells SmartCliff out instead, so these are only read by a
     * design somebody has edited. */
    const [reportSettings, setReportSettings] = useState<ReportSettings | undefined>()
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
                    address: institution?.address?.trim() || '',
                    contact: institution?.phone?.trim() || '',
                })
            })
            .catch(() => { /* the fallback wording */ })
        return () => { cancelled = true }
    }, [])

    /** Export / PDF / Print each ask two questions before they run: which
     *  clients, then which columns. Null while the dialog is closed. */
    const [exportFlow, setExportFlow] = useState<null | {
        format: 'csv' | 'pdf' | 'print'
        step: 1 | 2
        columns: ColumnKey[]
        clients: string[]
    }>(null)
    const request = useRef<AbortController | null>(null)
    useEffect(() => () => request.current?.abort(), [])

    /* Picking clients here narrows this dialog's own dropdowns, the same way it
       does on the list behind it: the server's byClient facet says what each
       client actually has, so two clients leave only the services those two
       run. Null means "do not narrow" — no client picked, or an older backend. */
    const clientScope = useMemo(() => scopeByClients(facets, draft.clients), [facets, draft.clients])
    const scoped = useMemo(() => {
        const keep = (list: Option[], allowed: string[] | undefined, byLabel = false) =>
            allowed ? list.filter((option) => allowed.includes(byLabel ? option.label : option.value)) : list
        return {
            clients: options.clients,
            services: keep(options.services, clientScope?.services),
            models: keep(options.models, clientScope?.serviceModels),
            // Course values are lower-cased for the server's match; the scope
            // lists the original spellings, so compare on the label.
            courses: keep(options.courses, clientScope?.courses, true),
            years: keep(options.years, clientScope?.years),
        }
    }, [options, clientScope])

    /* Everything ticked on arrival, so the dialog opens on the whole picture and
     * Generate answers "show me all of it" without any setup. Narrowing is then
     * a matter of UN-ticking, which is the quicker direction when the common
     * case is "everything".
     *
     * Seeded ONCE, the first time the options arrive. Re-seeding on every change
     * would fight the reader: clearing a dropdown would silently refill on the
     * next background refetch. */
    const seeded = useRef(false)
    useEffect(() => {
        if (seeded.current || !options.clients.length) return
        seeded.current = true
        setDraft((current) => ({
            ...current,
            clients: options.clients.map((option) => option.value),
            services: options.services.map((option) => option.value),
            models: options.models.map((option) => option.value),
            courses: options.courses.map((option) => option.value),
            years: options.years.map((option) => option.value),
        }))
    }, [options])

    /* Drop a selection the new scope no longer offers, or it stays active while
       vanishing from its dropdown — an invisible predicate with nothing on
       screen to un-tick. */
    useEffect(() => {
        if (!clientScope) return
        setDraft((current) => {
            const services = current.services.filter((value) => clientScope.services.includes(value))
            const models = current.models.filter((value) => clientScope.serviceModels.includes(value))
            const courses = current.courses.filter((value) => clientScope.courses.some((name) => name.toLowerCase() === value))
            const years = current.years.filter((value) => clientScope.years.includes(value))
            const yearFrom = current.yearFrom && !clientScope.years.includes(current.yearFrom) ? '' : current.yearFrom
            const yearTo = current.yearTo && !clientScope.years.includes(current.yearTo) ? '' : current.yearTo
            return services.length === current.services.length && models.length === current.models.length
                && courses.length === current.courses.length && years.length === current.years.length
                && yearFrom === current.yearFrom && yearTo === current.yearTo
                ? current
                : { ...current, services, models, courses, years, yearFrom, yearTo }
        })
    }, [clientScope])

    /* The server takes ONE service and ONE course, and a year SPAN — so a
     * multi-selection of any of those cannot be pushed down the wire. It is
     * applied here instead, over the rows that came back.
     *
     * Only when the selection is a strict subset, which matters: with everything
     * ticked (the default) this is a no-op and the blocks are returned untouched,
     * so the common case pays nothing. It also keeps "no courses mapped" nodes
     * visible, which a blanket prune would silently delete. */
    const pruneBlocks = useCallback((blocks: ClientBlock[], asked: Draft): ClientBlock[] => {
        const subset = (chosen: string[], all: Option[]) => chosen.length && chosen.length < all.length
        // Selections are option VALUES; the blocks carry DISPLAY labels, so each
        // set is put through the same transform toClientBlocks used.
        const serviceSet = subset(asked.services, options.services)
            ? new Set(asked.services.map((value) => serviceLabel(text(value)))) : null
        const modelSet = subset(asked.models, options.models)
            ? new Set(asked.models.map(displayLabel)) : null
        const courseSet = subset(asked.courses, options.courses)
            ? new Set(options.courses.filter((o) => asked.courses.includes(o.value)).map((o) => displayLabel(o.label))) : null
        const yearSet = asked.period === 'years' && subset(asked.years, options.years)
            ? new Set(asked.years) : null
        if (!serviceSet && !modelSet && !courseSet && !yearSet) return blocks

        const kept: ClientBlock[] = []
        for (const block of blocks) {
            const services: ServiceNode[] = []
            for (const service of block.services) {
                if (serviceSet && !serviceSet.has(service.service)) continue
                const models: ModelNode[] = []
                for (const node of service.models) {
                    if (modelSet && !modelSet.has(node.model)) continue
                    if (yearSet && !yearSet.has(node.year)) continue
                    if (!courseSet) { models.push(node); continue }
                    const courses = node.courses.filter((course) => courseSet.has(course))
                    // A model whose every course was filtered out is no longer
                    // part of what was asked for, so it goes with them.
                    if (!courses.length) continue
                    models.push({ ...node, courses })
                }
                if (!models.length) continue
                services.push({ ...service, models, courseCount: models.reduce((n, node) => n + node.courses.length, 0) })
            }
            if (!services.length) continue
            kept.push({ ...block, services, courseCount: services.reduce((n, service) => n + service.courseCount, 0) })
        }
        return kept
    }, [options])

    /* Runs on the button, not on every keystroke. The dialog opens with
     * everything ticked, so an auto-run would fetch the institution's whole
     * mapping list the moment it appeared — and again after each un-tick on the
     * way to what was actually wanted. */
    const generate = useCallback(async () => {
        request.current?.abort()
        const controller = new AbortController()
        request.current = controller
        setLoading(true)
        setError('')
        const asked: Draft = { ...draft }
        try {
            const query: MappingPageFilters = {
                ...filters,
                clients: asked.clients.length ? asked.clients : undefined,
                // Sent only when it is the single value the server can take;
                // anything wider is applied by pruneBlocks below.
                service: asked.services.length === 1 ? asked.services[0] : undefined,
                serviceModels: asked.models.length ? asked.models : undefined,
                course: asked.courses.length === 1 ? asked.courses[0] : undefined,
                yearFrom: asked.period === 'range' ? asked.yearFrom || undefined : undefined,
                yearTo: asked.period === 'range' ? asked.yearTo || undefined : undefined,
            }
            const result = await fetchMappingPageExport(query, { setup: true })
            if (!controller.signal.aborted) setBlocks(pruneBlocks(toClientBlocks(result as { data?: unknown[] }), asked))
        } catch (err) {
            if (!controller.signal.aborted) setError(err instanceof Error && err.message ? err.message : 'Could not build the report. Please retry.')
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }, [draft, filters, pruneBlocks])

    /** Back to the state the dialog opened in — everything ticked — not to an
     *  empty form. Reset means "start over", and starting over here is the whole
     *  picture. The generated report is cleared with it, so what is on screen
     *  never disagrees with the form above it. */
    const reset = () => {
        setDraft({
            ...EMPTY,
            clients: options.clients.map((option) => option.value),
            services: options.services.map((option) => option.value),
            models: options.models.map((option) => option.value),
            courses: options.courses.map((option) => option.value),
            years: options.years.map((option) => option.value),
        })
        request.current?.abort()
        setBlocks(null)
        setError('')
        setLoading(false)
    }

    /** "All X" rather than a list of every value: with everything ticked the
     *  full list would be a paragraph of noise on the printed page. */
    const criteria = useMemo(() => {
        const all = (chosen: string[], list: Option[], label: string, render: (value: string) => string) =>
            !chosen.length || chosen.length === list.length
                ? `All ${label}`
                : `${label[0].toUpperCase()}${label.slice(1)}: ${chosen.map(render).join(', ')}`
        const years = draft.period === 'range'
            ? (draft.yearFrom || draft.yearTo ? `Years: ${draft.yearFrom || 'any'} to ${draft.yearTo || 'any'}` : 'All years')
            : all(draft.years, options.years, 'years', (value) => value)
        return [
            all(draft.clients, options.clients, 'clients', (id) => options.clients.find((o) => o.value === id)?.label || id),
            all(draft.services, options.services, 'services', serviceLabel),
            all(draft.models, options.models, 'service models', displayLabel),
            all(draft.courses, options.courses, 'courses', (value) => displayLabel(options.courses.find((o) => o.value === value)?.label || value)),
            years,
        ].join('  |  ')
    }, [draft, options])

    const totals = useMemo(() => ({
        clients: blocks?.length ?? 0,
        mappings: blocks?.reduce((sum, b) => sum + b.services.length, 0) ?? 0,
        courses: blocks?.reduce((sum, b) => sum + b.courseCount, 0) ?? 0,
    }), [blocks])

    const canExport = Boolean(blocks && blocks.length && !loading && !exporting)

    /* The exported table, built from the DIALOG's picks rather than from what
     * happens to be on screen.
     *
     * Tick only Client and the file is a numbered client list - no sections, no
     * course rows. Tick anything course-level and it becomes the same per-client
     * blocks the screen shows, carrying exactly the ticked columns. */
    const buildExportTable = useCallback((picks: ColumnKey[], clientsWanted: string[]): ReportTable | null => {
        if (!blocks) return null
        const wanted = new Set(clientsWanted)
        const picked = blocks.filter((block) => wanted.has(block.client))
        const rowCols = ROW_COLUMNS.filter((column) => picks.includes(column.key))
        const wantsClient = picks.includes('client')
        const wantsBusiness = picks.includes('business')

        if (!rowCols.length) {
            const headers = ['S. No.']
            if (wantsClient) headers.push('Client')
            if (wantsBusiness) headers.push('Business model')
            return {
                headers,
                rows: picked.map((block, index) => {
                    const cells = [String(index + 1)]
                    if (wantsClient) cells.push(block.client)
                    if (wantsBusiness) cells.push(block.businessModel)
                    return cells
                }),
            }
        }

        const headers = ['S. No.', ...rowCols.map((column) => column.label)]
        const sections = picked.map((block) => ({
            title: wantsClient ? block.client : '',
            subtitle: [
                wantsBusiness ? block.businessModel : '',
                `${block.courseCount} ${block.courseCount === 1 ? 'course' : 'courses'}`,
            ].filter(Boolean).join('  \u00b7  '),
            headers,
            rows: courseLines(block).map((line, index) => [
                String(index + 1),
                ...rowCols.map((column) => column.get(line) || DASH),
            ]),
        }))
        return { headers, rows: sections.flatMap((section) => section.rows), sections }
    }, [blocks])

    const exportPreview = useMemo(
        () => (exportFlow ? buildExportTable(exportFlow.columns, exportFlow.clients) : null),
        [exportFlow, buildExportTable],
    )

    const runExport = async () => {
        if (!exportFlow || !blocks || exporting) return
        const built = buildExportTable(exportFlow.columns, exportFlow.clients)
        if (!built || !built.rows.length) return
        const format = exportFlow.format
        setExporting(format)
        setError('')
        try {
            const generated = new Date().toLocaleString()
            const scope = `${exportFlow.clients.length} client${exportFlow.clients.length === 1 ? '' : 's'}  \u00b7  ${built.rows.length} row${built.rows.length === 1 ? '' : 's'}`

            // One design, applied to every page - the active setting from System
            // Settings > Report Settings. It is the same one Business Reports
            // prints on, which is the point: two reports out of the same LMS
            // should not arrive on two different letterheads.
            const design = activeFormat(reportSettings)

            if (design && format !== 'csv') {
                const meta = { scope, generated, title: REPORT_TITLE, ...letterhead }
                if (format === 'pdf') {
                    await exportDesignedPdf(design, built, meta, `course-setup-report-${new Date().toISOString().slice(0, 10)}`)
                } else {
                    printDesignedReport(design, built, meta)
                }
            } else {
                // No design saved, or a spreadsheet - the plain layout.
                await exportServiceReport(format, built, scope, generated, REPORT_TITLE)
            }
            setExportFlow(null)
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Export failed. Please try again.')
        } finally {
            setExporting(null)
        }
    }

    /** Opens the two-step dialog with everything pre-ticked, so the quick path
     *  is Next -> Export rather than a form to fill in. */
    const openExport = (format: 'csv' | 'pdf' | 'print') => {
        if (!blocks?.length) return
        setExportFlow({
            format,
            step: 1,
            columns: COLUMNS.map((column) => column.key),
            clients: blocks.map((block) => block.client),
        })
    }

    // `!exportFlow` as well as `!exporting`: the export dialog below is a
    // nested Dialog, and dismissing it must not take this one down with it.
    return <>
        <Dialog open onOpenChange={(open) => { if (!open && !exporting && !exportFlow) onClose() }}>
            <DialogContent showCloseButton={!exporting} className="flex h-[94dvh] max-h-[94dvh] w-[98vw] max-w-[1600px] flex-col gap-0 overflow-hidden p-0">
                <DialogHeader className="shrink-0 gap-3 border-b border-hairline py-3 pl-4 pr-12 text-left sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <DialogTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 shrink-0 text-brand-strong" />Course setup report</DialogTitle>
                        <DialogDescription className="mt-1 text-xs">One block per client — its services, models and years, with the courses under each.</DialogDescription>
                    </div>
                    {/* Weighted like the primary actions they are, and all three
                        open the same two-step dialog - which clients, then which columns -
                        because the file is rarely the whole report. */}
                    <div role="group" aria-label="Export report" className="flex shrink-0 items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="border-brand-500/40 text-xs font-bold text-brand-strong hover:bg-brand-wash" disabled={!canExport} onClick={() => openExport('csv')}>
                            {exporting === 'csv' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}Export
                        </Button>
                        <Button type="button" variant="outline" size="sm" className="border-brand-500/40 text-xs font-bold text-brand-strong hover:bg-brand-wash" disabled={!canExport} onClick={() => openExport('pdf')}>
                            {exporting === 'pdf' ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}PDF
                        </Button>
                        <Button type="button" size="sm" className="text-xs font-bold" disabled={!canExport} onClick={() => openExport('print')}>
                            {exporting === 'print' ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}Print
                        </Button>
                    </div>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <fieldset disabled={Boolean(exporting)} className="min-w-0 border-b border-hairline bg-canvas/40 px-4 py-3">
                        <legend className="sr-only">Report filters</legend>
                        <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                            <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Client</p><MappingMultiFilter label="Clients" options={options.clients} value={draft.clients} onChange={(clients) => setDraft({ ...draft, clients })} placeholder="Select client" /></div>
                            <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Service</p><MappingMultiFilter label="Services" options={scoped.services} value={draft.services} onChange={(services) => setDraft({ ...draft, services })} placeholder="Select service" emptyLabel={clientScope ? 'No services for the selected clients' : undefined} /></div>
                            <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Service model</p><MappingMultiFilter label="Service models" options={scoped.models} value={draft.models} onChange={(models) => setDraft({ ...draft, models })} placeholder="Select service model" emptyLabel={clientScope ? 'No service models for the selected clients' : undefined} /></div>
                            <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Course</p><MappingMultiFilter label="Courses" options={scoped.courses} value={draft.courses} onChange={(courses) => setDraft({ ...draft, courses })} placeholder="Select course" emptyLabel={clientScope ? 'No courses for the selected clients' : undefined} /></div>

                            {/* The period control, in whichever of its two modes
                                is active. The switch swaps them and clears the
                                other mode's values, so a generated report can
                                never carry a stale bound from the mode you are
                                not looking at. */}
                            <div className="min-w-0 [&>div>button]:w-full">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                    <p className="truncate text-xs font-medium text-subtle">Providing year</p>
                                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5" title="Report on a span of years instead of individual ones">
                                        <span className={`text-[11px] font-medium ${draft.period === 'range' ? 'text-brand-strong' : 'text-subtle'}`}>Range</span>
                                        <Switch
                                            checked={draft.period === 'range'}
                                            onCheckedChange={(on) => setDraft((current) => (on
                                                ? { ...current, period: 'range', years: [] }
                                                // Back to individual years re-ticks them all rather than
                                                // landing on an empty box. Empty already MEANS "every year"
                                                // here, so leaving it blank would show "Select year" while
                                                // the criteria line beside it read "All years".
                                                : { ...current, period: 'years', yearFrom: '', yearTo: '', years: scoped.years.map((option) => option.value) }))}
                                            aria-label="Use a year range"
                                            className="scale-75"
                                        />
                                    </label>
                                </div>

                                {draft.period === 'years' ? (
                                    <MappingMultiFilter
                                        label="Years"
                                        options={scoped.years}
                                        value={draft.years}
                                        onChange={(years) => setDraft({ ...draft, years })}
                                        placeholder="Select year"
                                        emptyLabel={clientScope ? 'No years for the selected clients' : undefined}
                                    />
                                ) : (
                                    <MappingYearRange
                                        from={draft.yearFrom}
                                        to={draft.yearTo}
                                        years={scoped.years.map((option) => option.value)}
                                        onChange={(yearFrom, yearTo) => setDraft({ ...draft, yearFrom, yearTo })}
                                        placeholder="Select year range"
                                    />
                                )}
                            </div>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                            <Button type="button" size="sm" className="text-xs" disabled={loading || Boolean(exporting)} onClick={() => void generate()}>
                                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <BarChart3 className="size-3.5" />}
                                {loading ? 'Generating…' : 'Generate report'}
                            </Button>
                            <Button variant="outline" size="sm" className="text-xs" disabled={Boolean(exporting)} onClick={reset}>
                                <RotateCcw className="size-3.5" />Reset
                            </Button>
                            <p className="min-w-0 flex-1 truncate text-[11px] text-subtle" title={criteria}>{criteria}</p>
                        </div>
                    </fieldset>

                    <div className="p-4">
                        {error && <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">{error}<Button variant="outline" size="sm" className="text-xs" onClick={() => void generate()}>Retry</Button></div>}

                        {!blocks && !loading && !error && <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-hairline p-5 text-center">
                            <Building2 className="mb-2 size-7 text-brand-strong" />
                            <h2 className="text-sm font-semibold text-heading">Generate the report</h2>
                            <p className="mt-1.5 max-w-md text-xs leading-5 text-subtle">Everything is selected, so <span className="font-semibold text-heading">Generate report</span> gives you the whole picture. Un-tick a client, service, model, course or year first to narrow it.</p>
                        </div>}

                        {loading && !blocks && <div role="status" aria-label="Building report" className="space-y-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-ink-100" />)}</div>}

                        {blocks && <>
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                <dl className="flex shrink-0 flex-wrap items-center gap-2">
                                    {([['Clients', totals.clients], ['Services', totals.mappings], ['Courses', totals.courses]] as const).map(([label, count]) => (
                                        <div key={label} className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-canvas/40 px-2.5">
                                            <dt className="text-xs text-subtle">{label}</dt>
                                            <dd className="text-sm font-semibold tabular-nums text-heading">{count.toLocaleString()}</dd>
                                        </div>
                                    ))}
                                </dl>
                                </div>

                            {!blocks.length
                                ? <p className="rounded-xl border border-dashed border-hairline py-12 text-center text-sm text-subtle">Nothing matches this combination. Try fewer filters.</p>
                                : <div className={`space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
                                    {blocks.map((block, index) => <section key={index} className="overflow-hidden rounded-xl border border-hairline-strong">
                                        {/* Client → its services → each service's models → the courses. */}
                                        <header className="flex flex-wrap items-baseline justify-between gap-2 bg-[#344b63] px-3 py-2 text-white">
                                            <h3 className="min-w-0 truncate text-sm font-semibold" title={block.client}>{block.client}</h3>
                                            <span className="shrink-0 text-xs opacity-90">{block.businessModel}</span>
                                        </header>
                                        {block.services.map((service, serviceIndex) => <div key={serviceIndex} className="border-t border-hairline-strong">
                                            <div className="flex flex-wrap items-baseline justify-between gap-2 bg-[#e8eef5] px-3 py-1.5">
                                                <h4 className="min-w-0 truncate text-xs font-semibold text-heading" title={service.service}>{service.service}</h4>
                                                <span className="shrink-0 text-[11px] tabular-nums text-subtle">{service.courseCount} {service.courseCount === 1 ? 'course' : 'courses'}</span>
                                            </div>
                                            {service.models.map((node, modelIndex) => <div key={modelIndex} className="border-t border-hairline pl-3">
                                                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 pr-3">
                                                    <span className="text-xs font-medium text-heading">{node.model}</span>
                                                    <span className="text-[11px] text-subtle">{node.year}</span>
                                                    <span className="text-[11px] text-subtle">· {node.status}</span>
                                                </div>
                                                <table className="w-full border-collapse text-xs">
                                                    <tbody>{node.courses.length
                                                        ? node.courses.map((course, courseIndex) => <tr key={courseIndex}>
                                                            <td className="w-10 border border-hairline px-2 py-1.5 text-center tabular-nums text-subtle">{courseIndex + 1}</td>
                                                            <td className="border border-hairline px-2.5 py-1.5 text-body">{course}</td>
                                                        </tr>)
                                                        : <tr><td className="w-10 border border-hairline px-2 py-1.5 text-center text-subtle">{DASH}</td><td className="border border-hairline px-2.5 py-1.5 text-subtle">No courses mapped</td></tr>}
                                                    </tbody>
                                                </table>
                                            </div>)}
                                        </div>)}
                                    </section>)}
                                </div>}
                        </>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>

            {/* ── Export / PDF / Print, in two steps ────────────────────────
                1. which clients  2. which columns. Both pre-ticked, so the
                quick path is Next → Export. A nested Dialog: it sits over the
                report it is about, which is where the reader's eye already is. */}
            {exportFlow && blocks && (
                <Dialog open onOpenChange={(open) => { if (!open && !exporting) setExportFlow(null) }}>
                    <DialogContent showCloseButton={!exporting} className="flex max-h-[88dvh] w-[92vw] max-w-lg flex-col gap-0 overflow-hidden p-0">
                        <DialogHeader className="shrink-0 border-b border-hairline px-5 py-3.5 text-left">
                            <DialogTitle className="flex items-center gap-2 text-base">
                                {exportFlow.format === 'print'
                                    ? <><Printer className="size-4 shrink-0 text-brand-strong" />Print report</>
                                    : exportFlow.format === 'pdf'
                                        ? <><FileText className="size-4 shrink-0 text-brand-strong" />Export PDF</>
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
                                            {exportFlow.clients.length} of {blocks.length} selected
                                        </span>
                                        <button
                                            type="button"
                                            className="text-[11px] font-semibold text-brand-strong hover:underline"
                                            onClick={() => setExportFlow((flow) => (flow ? {
                                                ...flow,
                                                clients: flow.clients.length === blocks.length ? [] : blocks.map((block) => block.client),
                                            } : flow))}
                                        >
                                            {exportFlow.clients.length === blocks.length ? 'Clear all' : 'Select all'}
                                        </button>
                                    </div>
                                    {blocks.map((block, index) => {
                                        const checked = exportFlow.clients.includes(block.client)
                                        return (
                                            <label key={`${block.client}-${index}`} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2 hover:bg-row-hover">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={(event) => setExportFlow((flow) => (flow ? {
                                                        ...flow,
                                                        clients: event.target.checked
                                                            ? [...flow.clients, block.client]
                                                            : flow.clients.filter((name) => name !== block.client),
                                                    } : flow))}
                                                    className="size-4 accent-[var(--color-brand-strong,#c2410c)]"
                                                />
                                                <span className="min-w-0 truncate text-xs font-medium text-heading">{block.client}</span>
                                                <span className="ml-auto shrink-0 text-[10px] tabular-nums text-subtle">{block.courseCount}</span>
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
                                                        // Rebuilt from COLUMNS rather than appended, so the
                                                        // ticked set keeps the declared column order however
                                                        // the boxes were clicked.
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
                                        client list. Any course column turns it into per-client blocks.
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
                                                : exportFlow.format === 'pdf'
                                                    ? <><FileText className="size-3.5" />PDF</>
                                                    : <><Download className="size-3.5" />Export</>}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
    </>
}
