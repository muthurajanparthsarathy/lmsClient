"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Download, FileText, Loader2, Printer, RotateCcw, Building2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { MappingFacets, MappingPageFilters, ServiceMapping } from '../api/serviceMappingService'
import { businessModelDisplayName, notify } from '../../clientmanagement/features/lib'
import { loadServiceReport, reportTotals, groupedClientReport, exportServiceReport } from './serviceReport'
import { MappingMultiFilter, MappingYearRange } from './MappingReportFilters'
import { useModalBlink } from '@/app/lms/shared/ui/useModalBlink'
import { scopeByClients, pruneToScope, collapseAll } from './filterScope'

type Filters = { from: string; to: string; businesses: string[]; models: string[]; clients: string[] }
const EMPTY: Filters = { from: '', to: '', businesses: [], models: [], clients: [] }

export default function ServiceReportDialog({ facets, catalogue, initialFilters, onClose }: { facets?: MappingFacets; catalogue: { businessModel: string; models: string[] }[]; initialFilters: MappingPageFilters; onClose: () => void }) {
    // Overlay clicks blink instead of closing — the report is a filtered,
    // generated snapshot that a stray click should not throw away. The X
    // (hidden mid-export) and Escape still close it.
    const { ref: panelRef, blink } = useModalBlink<HTMLDivElement>()
    const [draft, setDraft] = useState<Filters>(() => ({ from: initialFilters.yearFrom || initialFilters.year || '', to: initialFilters.yearTo || initialFilters.year || '', businesses: initialFilters.businessModels || (initialFilters.businessModel ? [initialFilters.businessModel] : []), models: initialFilters.serviceModels || [], clients: initialFilters.clients || (initialFilters.client ? [initialFilters.client] : []) }))
    const [snapshot, setSnapshot] = useState<{ filters: Filters; rows: ServiceMapping[]; generated: string } | null>(null)
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [exporting, setExporting] = useState(false)
    const [error, setError] = useState('')
    const request = useRef<AbortController | null>(null)
    useEffect(() => () => request.current?.abort(), [])
    // What the picked clients ACTUALLY have. Null means "do not narrow": no
    // client picked (an empty filter means no filter here), or a backend that
    // predates the byClient facet. Either way the full catalogue stands.
    const clientScope = useMemo(() => scopeByClients(facets, draft.clients), [facets, draft.clients])
    const businessOptions = clientScope ? catalogue.filter((group) => clientScope.businessModels.includes(group.businessModel)) : catalogue
    const years = clientScope ? clientScope.years : (facets?.years || [])
    const models = [...new Set(catalogue
        .filter((group) => !draft.businesses.length || draft.businesses.includes(group.businessModel))
        .flatMap((group) => group.models)
        .filter((model) => !clientScope || clientScope.serviceModels.includes(model)))].sort()
    // Drop draft selections the new scope no longer offers — a filter that
    // stays active while its option has left the list is a predicate the reader
    // cannot see, let alone un-tick. Returning `current` unchanged when there is
    // nothing to drop keeps this from looping.
    useEffect(() => {
        if (!clientScope) return
        setDraft((current) => {
            const businesses = pruneToScope(current.businesses, clientScope.businessModels)
            const pruned = pruneToScope(current.models, clientScope.serviceModels)
            const from = current.from && !clientScope.years.includes(current.from) ? '' : current.from
            const to = current.to && !clientScope.years.includes(current.to) ? '' : current.to
            return businesses === current.businesses && pruned === current.models && from === current.from && to === current.to
                ? current
                : { ...current, businesses, models: pruned, from, to }
        })
    }, [clientScope])
    const dirty = snapshot !== null && JSON.stringify(draft) !== JSON.stringify(snapshot.filters)
    const totals = useMemo(() => reportTotals(snapshot?.rows || []), [snapshot])
    const table = useMemo(() => groupedClientReport(snapshot?.rows || []), [snapshot])
    const groups = table.sections || []
    const pages = Math.max(1, Math.ceil(groups.length / 5))
    const clientCount = (facets?.clients || []).length
    const criteria = (filters: Filters) => {
        // Every client ticked says the same thing as none picked, and spelling
        // out hundreds of names would bury the rest of the line.
        const clients = collapseAll(filters.clients, clientCount)
        return [
            clients.length ? `Clients: ${clients.map((id) => facets?.clients.find(([key]) => key === id)?.[1] || id).join(', ')}` : 'All clients',
            filters.businesses.length ? filters.businesses.map(businessModelDisplayName).join(', ') : 'All business models',
            filters.models.length ? `Service models: ${filters.models.join(', ')}` : 'All service models',
            filters.from || filters.to ? `Service providing years: ${filters.from || 'any'} to ${filters.to || 'any'} (inclusive)` : 'All service providing years',
        ].join(' | ')
    }
    // The previous snapshot deliberately survives a reload. Blanking it was fine
    // when an Apply button gated the change; now that every checkbox triggers a
    // run, it would throw the tables off screen on each click.
    const runReport = useCallback(async (filters: Filters) => {
        request.current?.abort()
        const controller = new AbortController(); request.current = controller
        setLoading(true); setError('')
        try {
            const rows = await loadServiceReport({ yearFrom: filters.from, yearTo: filters.to, businessModels: filters.businesses, serviceModels: filters.models, clients: collapseAll(filters.clients, clientCount), sortKey: 'year', sortDir: 'asc' }, controller.signal)
            if (!controller.signal.aborted) { setSnapshot({ filters, rows, generated: new Date().toLocaleString('en-GB') }); setPage(1) }
        } catch (err) { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not generate the report. Please retry.') }
        finally { if (!controller.signal.aborted) setLoading(false) }
    }, [clientCount])

    const hasFilters = Boolean(draft.clients.length || draft.businesses.length || draft.models.length || draft.from || draft.to)

    // Filters apply themselves — there is no Apply button. The debounce folds a
    // burst of clicks into a single request, and each run aborts the one before
    // it, so what lands is always the last selection made rather than whichever
    // response happened to come back last.
    //
    // Nothing runs until something is chosen. Opening straight onto every
    // service in the institution buries the one the reader came for, and it
    // pulls the whole export-sized list across the wire to do it.
    useEffect(() => {
        if (!hasFilters) {
            // Back to the prompt — and drop any in-flight request, or a stale
            // response could land after the filters were cleared.
            request.current?.abort()
            setSnapshot(null)
            setError('')
            setLoading(false)
            return
        }
        const filters = { ...draft, businesses: [...draft.businesses], models: [...draft.models], clients: [...draft.clients] }
        const timer = setTimeout(() => { void runReport(filters) }, 350)
        return () => clearTimeout(timer)
    }, [draft, runReport, hasFilters])
    const output = async (format: 'csv' | 'pdf' | 'print') => {
        if (!snapshot || dirty || loading || exporting || !table.rows.length) return
        setExporting(true)
        try {
            await exportServiceReport(format, table, criteria(snapshot.filters), snapshot.generated)
            notify.success(format === 'print' ? 'Print preview opened' : 'Report exported')
        } catch (err) { notify.error(err instanceof Error ? err.message : 'Report export failed') }
        finally { setExporting(false) }
    }
    const canExport = Boolean(snapshot && !dirty && !loading && !exporting && table.rows.length)
    return <Dialog open onOpenChange={(open) => { if (!open && !exporting) onClose() }}>
        <DialogContent
            ref={panelRef}
            className="flex h-[94dvh] max-h-[94dvh] w-[98vw] max-w-[1600px] flex-col gap-0 overflow-hidden p-0"
            showCloseButton={!exporting}
            onPointerDownOutside={(event) => { event.preventDefault(); blink() }}
            onInteractOutside={(event) => event.preventDefault()}
        >
            <DialogHeader className="shrink-0 gap-3 border-b border-hairline py-3 pl-4 pr-12 text-left sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <DialogTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 shrink-0 text-brand-strong" />Client services report</DialogTitle>
                    <DialogDescription className="mt-1 text-xs">Filter services by client, business model and providing year.</DialogDescription>
                </div>
                <div role="group" aria-label="Export report" className="flex shrink-0 items-center gap-1.5" title="Export all matching services, grouped by client, across all pages">
                    <Button variant="outline" size="sm" className="text-xs" disabled={!canExport} onClick={() => output('csv')}><Download className="size-3.5" />CSV</Button>
                    <Button variant="outline" size="sm" className="text-xs" disabled={!canExport} onClick={() => output('pdf')}><FileText className="size-3.5" />PDF</Button>
                    <Button size="sm" className="text-xs" disabled={!canExport} onClick={() => output('print')}><Printer className="size-3.5" />Print</Button>
                </div>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="border-b border-hairline bg-canvas/40 px-4 py-2.5">
                    <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                        <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Clients</p><MappingMultiFilter label="Clients" options={(facets?.clients || []).map(([value, label]) => ({ value, label }))} value={draft.clients} onChange={(clients) => setDraft({ ...draft, clients })} placeholder="Select client" /></div>
                        <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Business models</p><MappingMultiFilter label="Business models" options={businessOptions.map((group) => ({ value: group.businessModel, label: businessModelDisplayName(group.businessModel) }))} value={draft.businesses} onChange={(businesses) => setDraft({ ...draft, businesses, models: [] })} emptyLabel={clientScope ? 'No business models for the selected clients' : undefined} placeholder="Select business model" /></div>
                        <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Service models</p><MappingMultiFilter label="Service models" options={models.map((value) => ({ value, label: value }))} value={draft.models} onChange={(models) => setDraft({ ...draft, models })} emptyLabel={clientScope ? 'No service models for the selected clients' : undefined} placeholder="Select service model" /></div>
                        <div className="min-w-0 [&>button]:w-full"><p className="mb-1 text-xs font-medium text-subtle">Year range</p><MappingYearRange from={draft.from} to={draft.to} years={years} onChange={(from, to) => setDraft({ ...draft, from, to })} placeholder="Select year range" /></div>
                        <div className="flex items-center justify-end gap-2 sm:col-span-2 lg:col-span-1">
                            {loading && <span role="status" className="flex items-center gap-1.5 whitespace-nowrap text-xs text-subtle"><Loader2 className="size-3.5 animate-spin" />Updating…</span>}
                            <Button variant="ghost" size="sm" className="size-8 p-0 has-[>svg]:px-0" aria-label="Reset all filters" title="Reset all filters" disabled={!hasFilters || exporting} onClick={() => setDraft({ ...EMPTY })}><RotateCcw className="size-3.5" /></Button>
                        </div>
                    </div>
                </div>
                <div className="p-4">
                    {!snapshot && !loading && !error && <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-hairline p-5 text-center"><Building2 className="mb-2 size-7 text-brand-strong" /><h2 className="text-sm font-semibold text-heading">Choose what to report on</h2><p className="mt-1.5 max-w-md text-xs leading-5 text-subtle">Pick a client above and its services appear here. Business model, service model and year range narrow it further — each one you choose reshapes the rest.</p></div>}
                    {loading && !snapshot && <div role="status" aria-label="Generating report" className="space-y-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-lg bg-ink-100" />)}</div>}
                    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<Button variant="outline" size="sm" className="text-xs" onClick={() => runReport(draft)}>Retry</Button></div>}
                    {snapshot && <>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <dl className="flex shrink-0 items-center gap-2">{[['Clients', totals.clients], ['Services', totals.services]].map(([label, count]) => <div key={label} className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-canvas/40 px-2.5"><dt className="text-xs text-subtle">{label}</dt><dd className="text-sm font-semibold tabular-nums text-heading">{count.toLocaleString()}</dd></div>)}</dl>
                            <p className="min-w-0 basis-full truncate text-xs text-subtle sm:ml-1 sm:flex-1" title={criteria(snapshot.filters)}>{criteria(snapshot.filters)}</p>
                        </div>
                        {!groups.length && <p className="rounded-xl border border-dashed border-hairline py-12 text-center text-sm text-subtle">No services match this combination. Try fewer filters or a wider year range.</p>}
                        {/* Dimmed while a newer run is in flight, so nobody reads
                            numbers that the filter bar has already moved past. */}
                        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-50' : ''}`}>{groups.slice((page - 1) * 5, page * 5).map((group, index) => <section key={index} className="overflow-hidden rounded-xl border border-hairline">
                            <header className="flex items-center gap-2 border-b border-hairline bg-brand-wash/40 px-3 py-2">
                                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-brand-strong"><Building2 className="size-3.5" /></span>
                                <h2 className="min-w-0 truncate text-sm font-semibold text-heading" title={group.title}>{group.title}</h2>
                                <span aria-hidden="true" className="shrink-0 text-hairline-strong">|</span>
                                <p className="min-w-0 max-w-[45%] shrink-0 truncate text-xs text-subtle" title={group.subtitle}>{group.subtitle}</p>
                            </header>
                            <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-canvas text-subtle"><tr>{group.headers.map((header, column) => <th key={header} className={`whitespace-nowrap px-3 py-2 font-medium ${column === 0 ? 'w-14' : ''}`}>{header}</th>)}</tr></thead><tbody>{group.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-t border-hairline even:bg-canvas/30">{row.map((cell, column) => <td key={column} className={`px-3 py-2.5 ${column === 0 ? 'w-14 tabular-nums text-subtle' : 'min-w-24 break-words text-body'}`}>{cell}</td>)}</tr>)}</tbody></table></div>
                        </section>)}</div>
                        {groups.length > 0 && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-subtle"><span>Client groups: page {page} of {pages}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button><Button variant="outline" size="sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</Button></div></div>}
                    </>}
                </div>
            </div>
        </DialogContent>
    </Dialog>
}
