"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Info, Loader2, Printer, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { pageEnter } from '@/app/lms/shared/ui'
import {
    useClientGroupsPage,
    type MappingPageFilters,
    type ServiceMapping,
} from '@/app/lms/pages/servicemapping/api/serviceMappingService'
import {
    MappingMultiFilter,
    displayLabel,
} from '@/app/lms/pages/servicemapping/components/MappingReportFilters'
import { collapseAll, scopeByClients, pruneToScope } from '@/app/lms/pages/servicemapping/components/filterScope'
import {
    exportServiceReport,
    reportTotals,
    loadServiceReport,
    type ReportClientBlock,
    type ReportTable,
} from '@/app/lms/pages/servicemapping/components/serviceReport'
import { businessModelDisplayName } from '@/app/lms/pages/clientmanagement/features/lib'
import { useClients, type Client } from '@/app/lms/pages/clientmanagement/api/clientManagementService'
import {
    activeFormat, fetchReportSettings, newFormat,
    type ReportFormat, type ReportSettings,
} from '@/app/lms/pages/reportsettings/api/reportSettingsService'
import { BRAND_FALLBACK } from '@/app/lms/pages/reportsettings/api/brand'
import { fetchInstitutionById } from '@/app/lms/pages/instutionmanagement/api/institutionService'
import { PrintPreviewModal } from './components/PrintPreviewModal'

/* Client Management ▸ Reports.
 *
 * Two things live on this page: a filter form for choosing what the report
 * covers, and — once Generate is pressed — a review table of the actual data.
 * That's it. Print opens ONE modal that carries the preview, the field
 * toggles and the layout settings on its own, so there is no wizard here
 * and no separate route to reach.
 *
 * NOTHING loads until Generate report is pressed. The dropdowns are a draft;
 * the report below is a snapshot of the draft as it was at generate time, so
 * fiddling with a filter afterwards cannot silently disagree with the table
 * you are reading.
 *
 * An empty dropdown means "everything" — leaving all four alone and pressing
 * Generate reports on every client, which is the common case and should not
 * require ticking every box. */

/** The year control has two modes; the switch beside it swaps them.
 *  'years' — tick individual years (2024, 2026) — is the default, because
 *  picking one or two named years is the common case and a range picker makes
 *  that a two-step job. 'range' is for a span (2024–2026). */
type PeriodMode = 'years' | 'range'

type Draft = {
    clients: string[]
    /** Which CLIENT CREATED years the client picker is narrowed to. Empty =
     *  every year. Not the service-providing year below: this one is about
     *  when the client was taken on, and it selects WHICH CLIENTS the report
     *  covers rather than which of their services. */
    clientYears: string[]
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
    clients: [], clientYears: [], businessModels: [], serviceModels: [],
    years: [], yearFrom: '', yearTo: '', period: 'years',
}

/** Facets are institution-wide, so the query that fetches them asks for the
 *  smallest possible page — it is the `facets` envelope we are after, not rows. */
const NO_FILTERS: MappingPageFilters = {}

/** "active" → "Active". Small enough not to warrant a util file; used in a
 *  couple of places where the client / service status flows into a table. */
const capitalise = (value: string) => value ? value.charAt(0).toUpperCase() + value.slice(1) : value

/** Split the stored `clientAddress` string back into the parts the report's
 *  Customize Fields sidebar can offer as individual columns (Address Line /
 *  City / State / Pincode). The client form combines them into a shape like
 *
 *      {Address Line}
 *      {City}, {State} - {Pincode}
 *
 *  so the parser reverses that; anything unrecognisable (legacy HTML from
 *  the old TipTap editor, say) falls through as a full Address Line with
 *  the city / state / pincode empty. Any HTML tags are stripped first. */
type AddressParts = { line: string; city: string; state: string; pincode: string }
const parseClientAddress = (raw: string): AddressParts => {
    const plain = (raw || '')
        .replace(/<br\s*\/?>(\r?\n)?/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/\r/g, '')
        .trim()
    if (!plain) return { line: '', city: '', state: '', pincode: '' }
    const lines = plain.split(/\n+/).map((s) => s.trim()).filter(Boolean)
    if (lines.length >= 2) {
        const csp = lines[1].match(/^(.+?),\s*(.+?)\s*[-–]\s*(\d[\d\s]*)$/)
        if (csp) {
            const [, city, state, pincode] = csp
            return { line: lines[0], city: city.trim(), state: state.trim(), pincode: pincode.replace(/\s+/g, '') }
        }
    }
    return { line: plain, city: '', state: '', pincode: '' }
}

export default function BusinessReportsPage() {
    const [draft, setDraft] = useState<Draft>({ ...EMPTY })
    const [snapshot, setSnapshot] = useState<{ draft: Draft; rows: ServiceMapping[]; generated: string } | null>(null)
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState<null | 'csv'>(null)
    const [error, setError] = useState('')
    /** Whether the big Print Preview modal is open. Opens on Print click,
     *  closes on the modal's own X or a Done button. No wizard, no separate
     *  route — one modal handles preview, field toggles and settings. */
    const [printModalOpen, setPrintModalOpen] = useState(false)
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
     * Management and every report picks it up with no design to reopen. */
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

    const serviceModelYearsFor = useCallback((serviceModelLabels: string[]) => {
        if (!serviceModelLabels.length) return [...(clientScope?.years ?? facets?.years ?? [])].sort()
        const byClient = facets?.byClient
        if (!byClient) return [...(clientScope?.years ?? facets?.years ?? [])].sort()
        const selectedClients = new Set(draft.clients)
        const selectedModels = new Set(serviceModelLabels.flatMap((label) => serviceModelGroups.get(label) || [label]))
        return [...new Set(byClient
            .filter((entry) => (!selectedClients.size || selectedClients.has(entry.client))
                && entry.serviceModels.some((model) => selectedModels.has(model)))
            .flatMap((entry) => entry.years))].sort()
    }, [clientScope, draft.clients, facets, serviceModelGroups])

    const serviceModelMatchesYear = useCallback((serviceModelLabel: string) => {
        const byClient = facets?.byClient
        if (!byClient) return true
        const selectedClients = new Set(draft.clients)
        const rawModels = new Set(serviceModelGroups.get(serviceModelLabel) || [serviceModelLabel])
        const matchesYear = (year: string) => draft.period === 'range'
            ? (!draft.yearFrom || year >= draft.yearFrom) && (!draft.yearTo || year <= draft.yearTo)
            : draft.years.includes(year)
        return byClient.some((entry) => (!selectedClients.size || selectedClients.has(entry.client))
            && entry.serviceModels.some((model) => rawModels.has(model))
            && entry.years.some(matchesYear))
    }, [draft, facets, serviceModelGroups])

    /* Everything ticked on arrival, so the page opens on the whole picture and
     * Generate answers "show me all of it" without any setup. Seeded ONCE. */
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
        draft.clients.length || draft.clientYears.length || draft.businessModels.length
        || draft.serviceModels.length
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
            const allClients = collapseAll(asked.clients, options.clients.length)
            const allBusiness = collapseAll(asked.businessModels, options.businessModels.length)
            const allServiceModels = collapseAll(asked.serviceModels, options.serviceModels.length)

            const filters: MappingPageFilters = {
                clients: allClients.length ? allClients : undefined,
                businessModels: allBusiness.length ? allBusiness : undefined,
                serviceModels: allServiceModels.length
                    ? allServiceModels.flatMap((label) => serviceModelGroups.get(label) || [label])
                    : undefined,
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

    /* Full client records — used to fill in the optional Client-level
     * columns (Client ID, Contact Number, Email, Address, Contact
     * Person) that the Print Preview modal's Customize Fields sidebar can
     * enable. The mapping endpoint only carries `MappedClientRef` which
     * has the name and business model, so the extras come from here. */
    const { data: clientList } = useClients()
    const clientById = useMemo(() => {
        const map = new Map<string, Client>()
        for (const client of clientList ?? []) map.set(String(client._id), client)
        return map
    }, [clientList])

    /* The year each client was taken on, for the Client filter's own
     * created-year picker. `createdYear` when the record carries one, else the
     * year off createdAt — the same derivation Service Mapping's client filter
     * uses, so a client is filed under the same year on both pages. */
    const clientCreatedYear = useCallback((clientId: string): string => {
        const client = clientById.get(String(clientId))
        if (!client) return ''
        const stored = (client as { createdYear?: string | number }).createdYear
        if (stored) return String(stored)
        return client.createdAt ? String(new Date(client.createdAt).getFullYear()) : ''
    }, [clientById])

    /** The created years actually present among the clients on offer — a year
     *  nobody was taken on in is not worth a row in the picker. */
    const clientYearOptions = useMemo(
        () => [...new Set(options.clients.map((option) => clientCreatedYear(option.value)).filter(Boolean))],
        [options.clients, clientCreatedYear],
    )

    /** What the Client picker LISTS: the full set, narrowed to the ticked
     *  created years. Deliberately not `options.clients` itself — that stays
     *  the whole list, because `collapseAll` measures a selection against it
     *  to decide whether "everything is ticked" means "no filter". Measured
     *  against a narrowed list, ticking every client of one year would collapse
     *  to no filter and quietly report every client in the institution. */
    const clientPickerOptions = useMemo(
        () => (draft.clientYears.length
            ? options.clients.filter((option) => draft.clientYears.includes(clientCreatedYear(option.value)))
            : options.clients),
        [options.clients, draft.clientYears, clientCreatedYear],
    )

    /** Narrowing the years drops any ticked client that falls outside them —
     *  a selection the reader can no longer see must not still be in force. */
    const setClientYears = useCallback((clientYears: string[]) => {
        setDraft((current) => ({
            ...current,
            clientYears,
            clients: clientYears.length
                ? current.clients.filter((id) => clientYears.includes(clientCreatedYear(id)))
                : current.clients,
        }))
    }, [clientCreatedYear])

    /* The report broken into per-client blocks with rowspan-friendly shape.
     * This is what the review table on this page renders AND what the print
     * modal feeds through the paginator. One source, no drift. */
    const clientNames = useMemo(
        () => new Map((facets?.clients ?? []).map(([id, name]) => [String(id), name])),
        [facets],
    )

    const report = useMemo(() => {
        if (!snapshot) return null
        type Group = { business: string; services: ServiceMapping[] }
        type Node = { client: string; clientId: string; groups: Map<string, Group> }
        const byClient = new Map<string, Node>()

        for (const row of snapshot.rows) {
            const clientObj = typeof row.client === 'object' && row.client ? row.client : null
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

        /* Flatten each client's business groups into a single block for the
         * rowspan layout. Each service object carries every optional key
         * the modal's Customize Fields sidebar might ask for; the paginator
         * emits only the keys listed in `table.serviceColumns`, so an
         * absent field costs nothing to keep around here.
         *
         * The client-level extras (contact, email, address, primary
         * contact person) are read off the full client record, when
         * available — the mapping API only carries `MappedClientRef` which
         * has the id, company and business model. */
        const blocks: ReportClientBlock[] = [...byClient.values()]
            .sort((a, b) => a.client.localeCompare(b.client))
            .map((node) => {
                const clientRecord = clientById.get(node.clientId)
                const primary = (clientRecord?.contactPersons ?? []).find((person) => person.isPrimary)
                    ?? clientRecord?.contactPersons?.[0]
                const addressParts = parseClientAddress(clientRecord?.clientAddress || '')
                /* The client's CREATED year, drawn from the same
                 * `createdAt` timestamp Client Management shows in its
                 * own listing. Distinct from a service's Offering Year
                 * (that one lives on each service under `year`). Falls
                 * back to an em-dash when the record has no timestamp
                 * — safer than showing "NaN" or 1970 on a broken date. */
                const createdAt = clientRecord?.createdAt
                const parsedCreated = createdAt ? new Date(createdAt) : null
                const createdYear = parsedCreated && !Number.isNaN(parsedCreated.getTime())
                    ? String(parsedCreated.getFullYear())
                    : '—'
                const clientExtras: Record<string, string> = {
                    clientId: clientRecord?.clientId || '—',
                    createdYear,
                    clientStatus: clientRecord?.status ? capitalise(clientRecord.status) : '—',
                    contactPerson: primary?.name || '—',
                    // Primary vs secondary emails and phones — separate
                    // columns so a report that needs both can carry them
                    // side by side.
                    email: primary?.email || '—',
                    secondaryEmail: primary?.secondaryEmail || '—',
                    contactNumber: primary?.phoneNumber || '—',
                    secondaryPhone: primary?.secondaryPhoneNumber || '—',
                    // Organisation switchboard, distinct from the primary
                    // contact person's mobile.
                    clientPhone: clientRecord?.clientPhone || '—',
                    // Full formatted address for the legacy `address`
                    // token, plus the parsed parts so a report can
                    // include City / State / Pincode as their own
                    // columns without dumping the full string.
                    address: clientRecord?.clientAddress || '—',
                    addressLine: addressParts.line || '—',
                    city: addressParts.city || '—',
                    state: addressParts.state || '—',
                    pincode: addressParts.pincode || '—',
                }
                const groups = [...node.groups.values()]
                const services: Record<string, string>[] = groups.flatMap((g) =>
                    [...g.services].sort((a, b) =>
                        (a.year || '').localeCompare(b.year || '', undefined, { numeric: true })
                        || (a.serviceCode || '').localeCompare(b.serviceCode || '')
                    ).map((r) => ({
                        serviceModel: (r.serviceModels || []).map(displayLabel).join(', ') || r.serviceCode || '—',
                        year: r.year || '—',
                        status: r.status ? capitalise(r.status) : '—',
                        code: r.serviceCode || '—',
                        category: r.category || '—',
                        course: r.courseName || '—',
                        // Per-run generated date — same value on every row.
                        // Useful for archival prints where the reader wants
                        // to see the timestamp on the sheet itself, not
                        // just the file name.
                        generatedDate: snapshot.generated,
                    }))
                )
                const business = [...new Set(groups.map((g) => g.business))].join(', ')
                return { client: node.client, business, clientExtras, services }
            })

        // Flat rows for CSV / Excel: Client + Business Model repeated on every row.
        const flatRows: string[][] = []
        let serial = 0
        for (const block of blocks) {
            for (const service of block.services) {
                serial += 1
                flatRows.push([String(serial), block.client, block.business, service.serviceModel, service.year])
            }
        }

        const table: ReportTable = {
            headers: ['S. No.', 'Client', 'Business Model', 'Service Model', 'Providing Year'],
            rows: flatRows,
            groups: blocks,
        }

        return { blocks, table }
    }, [snapshot, clientNames, clientById])

    const table = report?.table ?? null
    const totals = useMemo(() => (snapshot ? reportTotals(snapshot.rows) : null), [snapshot])

    /** Direct Excel download from the review — no dialog, whole table. */
    const exportExcelFromReview = async () => {
        if (!snapshot || !table || !table.rows.length || exporting) return
        setExporting('csv')
        try {
            const scope = `${report?.blocks.length ?? 0} client${(report?.blocks.length ?? 0) === 1 ? '' : 's'}  ·  ${table.rows.length} row${table.rows.length === 1 ? '' : 's'}`
            await exportServiceReport('csv', table, scope, snapshot.generated)
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Export failed. Please try again.')
        } finally {
            setExporting(null)
        }
    }

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

    /* The design the print modal opens on. Falls back to a fresh built-in
     * letterhead when no saved template is active, so the preview always has
     * something concrete to render — an empty preview would just look like
     * the modal was broken. The fallback is `newFormat()` which seeds itself
     * with the standard SmartCliff masthead / rules / table / footer. */
    const initialFormat: ReportFormat = useMemo(
        () => activeFormat(reportSettings) ?? newFormat('Report layout', false),
        [reportSettings],
    )

    /* What the reader actually narrowed the report to, in words.
     *
     * Only dimensions that were NARROWED get a mention: leaving a dropdown
     * fully ticked means "everything", and a report covering everything
     * shouldn't carry a line claiming a filter was applied. Press Generate
     * on the default all-selected state and this comes back empty, so the
     * sheet prints without the line at all.
     *
     * CLIENT is deliberately left out even when narrowed — the table names
     * every client it covers in its own column, so repeating a list of
     * them above the table says nothing the reader can't already see.
     * Business Model, Service Model and Offering Year are the dimensions
     * the table can't fully reveal on its own. */
    const filterSummary = useMemo(() => {
        if (!snapshot) return ''
        const asked = snapshot.draft
        const parts: string[] = []

        // A long list is summarised rather than printed in full — a line
        // naming fourteen service models is no more useful than one
        // saying how many there were.
        const describe = (label: string, values: string[], total: number) => {
            if (!values.length || values.length >= total) return
            parts.push(values.length <= 4
                ? `${label}: ${values.join(', ')}`
                : `${label}: ${values.slice(0, 3).join(', ')} +${values.length - 3} more`)
        }

        describe(
            'Business Model',
            asked.businessModels.map((value) => businessModelDisplayName(value) || value),
            options.businessModels.length,
        )
        describe('Service Model', asked.serviceModels, options.serviceModels.length)

        if (asked.period === 'range') {
            if (asked.yearFrom || asked.yearTo) {
                parts.push(`Service Providing Year: ${asked.yearFrom || '…'}–${asked.yearTo || '…'}`)
            }
        } else {
            describe('Service Providing Year', [...asked.years].sort(), options.years.length)
        }

        return parts.length ? `Filtered by  ·  ${parts.join('  ·  ')}` : ''
    }, [snapshot, options.businessModels.length, options.serviceModels.length, options.years.length])

    /** Tokens the design references at export time. Rebuilt whenever the
     *  snapshot or the letterhead changes. */
    const printMeta = useMemo(() => ({
        title: 'Services report',
        scope: report && table
            ? `${report.blocks.length} client${report.blocks.length === 1 ? '' : 's'}  ·  ${table.rows.length} row${table.rows.length === 1 ? '' : 's'}`
            : '',
        generated: snapshot?.generated ?? '',
        filters: filterSummary,
        ...letterhead,
    }), [snapshot, report, table, letterhead, filterSummary])

    return (
        <>
            <motion.div variants={pageEnter} initial="hidden" animate="visible" className="flex h-full min-h-0 min-w-0 flex-col">                <div className="flex min-h-0 flex-1 flex-col px-4 pb-3 pt-3 sm:px-6 md:px-8">

                    {/* Top page-heading row is gone — the sidebar entry
                        already labels this surface, and Export Excel /
                        Print now live in the Generate row of the filter
                        card below, so nothing is left at the very top. */}

                    {/* ── The scope form ─────────────────────────────────── */}
                    <div className="no-print mt-3 shrink-0 rounded-xl border border-hairline bg-canvas/40 p-3">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                                    yearFilter={{
                                        label: 'Service Providing Year',
                                        yearsFor: serviceModelYearsFor,
                                        matches: serviceModelMatchesYear,
                                        period: draft.period,
                                        years: draft.years,
                                        from: draft.yearFrom,
                                        to: draft.yearTo,
                                        onPeriodChange: (next) => setDraft((d) => (d.period === next
                                            ? d
                                            : next === 'range'
                                                ? { ...d, period: 'range', years: [] }
                                                : { ...d, period: 'years', yearFrom: '', yearTo: '' })),
                                        onYearsChange: (years) => setDraft((d) => ({ ...d, years })),
                                        onRangeChange: (yearFrom, yearTo) => setDraft((d) => ({ ...d, yearFrom, yearTo })),
                                    }}
                                />
                            </div>

                            <div className="min-w-0">
                                <p className="mb-1.5 text-xs font-medium text-subtle">Client</p>
                                <MappingMultiFilter
                                    label="Clients"
                                    options={clientPickerOptions}
                                    value={draft.clients}
                                    onChange={(clients) => setDraft((d) => ({ ...d, clients }))}
                                    placeholder="Select client"
                                    emptyLabel={draft.clientYears.length
                                        ? 'No clients created in the selected years'
                                        : undefined}
                                    // The client's own year, inside the client
                                    // filter: "which clients — and of those,
                                    // the ones taken on in 2025".
                                    extra={{
                                        label: 'Client created year',
                                        options: clientYearOptions,
                                        value: draft.clientYears,
                                        onChange: setClientYears,
                                        allLabel: 'All years',
                                    }}
                                />
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

                            {!draft.clients.length && (
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-strong">
                                    <Info className="size-3.5 shrink-0" />
                                    No client selected — pick at least one, or generate to include every client.
                                </span>
                            )}

                            {/* Preview & Print — opens the preview modal
                                that owns the actual Print / PDF actions.
                                Green, right-pinned on the Generate row.
                                Matches the sibling report pages (Users
                                Reports, Courses Reports). */}
                            {snapshot && table?.rows.length ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    className="ml-auto text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                                    onClick={() => setPrintModalOpen(true)}
                                >
                                    <Printer className="size-3.5" />Preview &amp; Print
                                </Button>
                            ) : null}
                        </div>
                    </div>


                    {/* ── The report ───────────────────────────────────────
                        Flex column so the table card can claim every pixel
                        remaining below the filter card. Only the table body
                        scrolls; the outer container is not scrollable so
                        the reader never sees a nested pair of scrollbars.
                        Hidden while the AI tab is up — one answer on screen
                        at a time. */}
                    <div className="mt-3 flex min-h-0 flex-1 flex-col">
                        {error && (
                            <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">
                                {error}
                                <Button variant="outline" size="sm" className="text-xs" onClick={() => void generate()}>Retry</Button>
                            </div>
                        )}

                        {!snapshot && !loading && !error && (
                            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-canvas/30 p-6 text-center">
                                <div className="relative mb-3">
                                    <svg
                                        aria-hidden
                                        className="pointer-events-none absolute left-1/2 top-1/2 h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 text-brand-300"
                                        viewBox="0 0 72 72"
                                        fill="none"
                                    >
                                        <path
                                            d="M10 51 A 30 30 0 1 1 62 51"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeLinecap="round"
                                            strokeDasharray="1 7"
                                        />
                                    </svg>
                                    <div className="relative flex h-11 w-11 items-center justify-center rounded-tile bg-brand-wash">
                                        <BarChart3 className="size-5 text-brand-strong" aria-hidden />
                                    </div>
                                </div>
                                <h2 className="text-sm font-semibold text-heading">Generate a report to see the results</h2>
                                <p className="mt-1 max-w-sm text-xs leading-5 text-subtle">
                                    Choose your filters above and click <span className="font-semibold text-heading">Generate report</span>.
                                </p>
                            </div>
                        )}

                        {loading && !snapshot && (
                            <div role="status" aria-label="Generating report" className="space-y-3">
                                {Array.from({ length: 6 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-ink-100" />)}
                            </div>
                        )}

                        {snapshot && table && totals && (
                            <div className={`flex flex-1 min-h-0 flex-col transition-opacity ${loading ? 'opacity-50' : ''}`}>
                                {/* The same "Filtered by" line the printed
                                    sheet carries, shown here so the reader
                                    confirms the scope before exporting.
                                    Absent when nothing was narrowed. */}
                                {filterSummary && (
                                    <p className="no-print mb-3 text-[11px] text-subtle">
                                        {filterSummary}
                                    </p>
                                )}

                                {!table.rows.length ? (
                                    <p className="rounded-xl border border-dashed border-hairline py-12 text-center text-sm text-subtle">
                                        Nothing matches this combination. Try a wider scope.
                                    </p>
                                ) : (
                                    <div className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-xl border border-hairline bg-white">
                                        {/* Single scroll container that fills the
                                            remaining viewport — no nested scrollbars,
                                            sticky thead sticks to the top of this
                                            container. */}
                                        <div className="min-h-0 flex-1 overflow-auto">
                                            <table className="w-full table-fixed border-collapse text-xs">
                                                {/* Column widths match the shared
                                                    REPORT_COLUMN_WIDTHS used by the modal
                                                    preview + PDF + print: 7 / 33 / 24 / 22 / 14. */}
                                                <colgroup>
                                                    <col style={{ width: '7%' }} />
                                                    <col style={{ width: '33%' }} />
                                                    <col style={{ width: '24%' }} />
                                                    <col style={{ width: '22%' }} />
                                                    <col style={{ width: '14%' }} />
                                                </colgroup>
                                                <thead>
                                                    <tr>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">S. No.</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Client</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Business Model</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-r border-hairline px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-subtle">Service Model</th>
                                                        <th className="sticky top-0 z-10 bg-canvas border-b border-hairline px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-subtle">Providing Year</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(report?.blocks ?? []).map((block, blockIdx) => block.services.map((svc, svcIdx) => {
                                                        const isFirst = svcIdx === 0
                                                        const boundary = isFirst && blockIdx > 0
                                                            ? 'border-t-2 border-hairline-strong'
                                                            : 'border-t border-hairline/60'
                                                        return (
                                                            <tr key={`${blockIdx}-${svcIdx}`} className={`${boundary} hover:bg-row-hover`}>
                                                                {/* S. No. rowspans the client block
                                                                    — one number per client, matching
                                                                    the merged Client / Business Model
                                                                    cells. */}
                                                                {isFirst && (
                                                                    <>
                                                                        <td
                                                                            rowSpan={block.services.length}
                                                                            className="border-r border-hairline/60 px-3 py-2 text-center align-middle tabular-nums text-subtle"
                                                                        >
                                                                            {blockIdx + 1}
                                                                        </td>
                                                                        <td
                                                                            rowSpan={block.services.length}
                                                                            className="border-r border-hairline/60 px-3 py-2 align-middle font-semibold text-heading"
                                                                            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                                                        >
                                                                            {block.client}
                                                                        </td>
                                                                        <td
                                                                            rowSpan={block.services.length}
                                                                            className="border-r border-hairline/60 px-3 py-2 align-middle font-semibold text-heading"
                                                                            style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                                                        >
                                                                            {block.business}
                                                                        </td>
                                                                    </>
                                                                )}
                                                                <td className="border-r border-hairline/60 px-3 py-2 align-middle text-body">
                                                                    {svc.serviceModel}
                                                                </td>
                                                                <td className="px-3 py-2 text-center align-middle tabular-nums text-body">
                                                                    {svc.year}
                                                                </td>
                                                            </tr>
                                                        )
                                                    }))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>            </motion.div>

            {/* ── Print Preview modal ─────────────────────────────────────
                Opens on Print. Owns its own working format (so edits inside
                are throwaways unless the user Applies them) and its own set
                of enabled optional fields. Preview updates live as the two
                sidebars (Customize Fields / Customize Report Settings) are
                edited. Download PDF and Print at the bottom. */}
            <PrintPreviewModal
                open={printModalOpen}
                onClose={() => setPrintModalOpen(false)}
                snapshot={snapshot}
                blocks={report?.blocks ?? []}
                letterhead={letterhead}
                initialFormat={initialFormat}
                meta={printMeta}
            />
        </>
    )
}
