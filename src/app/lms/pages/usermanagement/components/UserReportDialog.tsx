"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, Building2, Download, FileText, Loader2, Printer, RotateCcw, Users as UsersIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
    displayLabel,
    MappingMultiFilter,
    serviceLabel,
} from '@/app/lms/pages/servicemapping/components/MappingReportFilters'
import { fetchUsersForExport, type ServiceIndexEntry, type UsersPageParams } from '../api/userService'

/* The User Management report. Same pattern as the Service Mapping and Course
   Setup reports: the same multi-select controls along the top, nothing loaded
   until something is chosen, filters applying themselves with no Apply button,
   and Excel / PDF / Print off the header.

   The shape is CLIENT-FIRST, not a flat list: each client heads its own block
   with its basic details, its users are listed under it, then the next client.
   Picking "Students" and one client therefore reads as "here is that client,
   here are its students" rather than as a column of repeated client names.

   Deliberately no Active/Inactive here — neither as a column nor as a filter.
   A report is about who belongs to what; the account's own state is the
   directory's business and it is already a column there. */

type Option = { value: string; label: string }
type Options = { roles: Option[]; clients: Option[]; services: Option[]; serviceModels: Option[] }

type Draft = { roles: string[]; clients: string[]; services: string[]; serviceModels: string[] }
const EMPTY: Draft = { roles: [], clients: [], services: [], serviceModels: [] }

type ReportUser = { user: string; email: string; phone: string; role: string; service: string; model: string; batch: string }
type ClientGroup = {
    key: string
    name: string
    /** Label/value pairs shown beside the client name — its own record, not the
     *  users'. Only the ones that are actually filled in. */
    details: { label: string; value: string }[]
    users: ReportUser[]
}

const HEADERS = ['User', 'Email', 'Phone', 'Role', 'Service', 'Service model', 'Batch']
const asCells = (row: ReportUser) => [row.user, row.email, row.phone, row.role, row.service, row.model, row.batch]

const text = (value: unknown) => { const s = String(value ?? '').trim(); return s || '—' }
const blank = (value: unknown) => !String(value ?? '').trim()

const escapeCsv = (value: string) => /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const UNASSIGNED = '__no_client__'

type ClientRef = { _id?: unknown; clientCompany?: string; businessModel?: string; type?: string[]; clientAddress?: string; status?: string }
type MappingRef = { _id?: unknown; service?: string }
type Enrolment = { clientKey: string; clientName: string; client?: ClientRef; service: string; model: string }

const asClient = (value: unknown): ClientRef | undefined =>
    value && typeof value === 'object' ? value as ClientRef : undefined
const asMapping = (value: unknown): MappingRef | undefined =>
    value && typeof value === 'object' ? value as MappingRef : undefined
const idOf = (value: unknown): string => {
    if (!value) return ''
    if (typeof value === 'string') return value
    const record = value as { _id?: unknown }
    return record._id ? String(record._id) : String(value)
}

/* Users created before `serviceMappingId` existed carry a service-model name
   and nothing else, so their Service cell would read "—" even though the
   client runs exactly one service offering that model. This resolves those:
   given the client and the model, the mapping that offers it names the
   service. Ambiguous cases (two of the client's services offer the same
   model) resolve to nothing rather than to a guess. */
function serviceResolver(index: ServiceIndexEntry[]) {
    const byPair = new Map<string, string | null>()
    ;(index || []).forEach((mapping) => {
        const client = String(mapping.client || '')
        if (!client || !mapping.service) return
        ;(mapping.serviceModels || []).forEach((model) => {
            const key = `${client}|${String(model).trim().toLowerCase()}`
            if (!byPair.has(key)) byPair.set(key, mapping.service as string)
            else if (byPair.get(key) !== mapping.service) byPair.set(key, null)
        })
    })
    return (clientKey: string, model: string) =>
        byPair.get(`${clientKey}|${model.trim().toLowerCase()}`) || ''
}

/* Every (client, service, service model) a user belongs to. The legacy
   top-level fields are the FIRST enrolment; `services[]` holds any added later
   by Reassign Users. A user enrolled with two clients belongs under both, so
   this returns one entry per enrolment rather than one per user. */
function enrolmentsOf(entry: Record<string, unknown>): Enrolment[] {
    const rows: Enrolment[] = []
    const push = (rawClient: unknown, rawName: unknown, rawMapping: unknown, rawModel: unknown) => {
        const client = asClient(rawClient)
        const mapping = asMapping(rawMapping)
        const clientKey = idOf(rawClient) || String(rawName ?? '').trim()
        const name = client?.clientCompany || String(rawName ?? '').trim()
        const service = mapping?.service || ''
        // An entry with nothing in it at all is a schema artefact, not an
        // enrolment — an empty `services[]` slot left by an earlier edit.
        if (!clientKey && !name && !service && blank(rawModel)) return
        rows.push({
            clientKey: clientKey || UNASSIGNED,
            clientName: name,
            client,
            service,
            model: String(rawModel ?? '').trim(),
        })
    }

    push(entry.clientId, entry.clientName, entry.serviceMappingId, entry.serviceModel)
    const extra = Array.isArray(entry.services) ? entry.services as Record<string, unknown>[] : []
    extra.forEach((item) => push(item?.clientId, item?.clientName, item?.serviceMappingId, item?.serviceModel))

    // A user with no client and no service at all still belongs in the report,
    // under "No client assigned" — dropping them would make the totals lie.
    if (!rows.length) rows.push({ clientKey: UNASSIGNED, clientName: '', service: '', model: '' })

    // Two identical enrolments (the legacy pair duplicated into services[]) is
    // one enrolment as far as the reader is concerned.
    const seen = new Set<string>()
    return rows.filter((row) => {
        const key = `${row.clientKey}|${row.service}|${row.model}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
}

const clientDetails = (client?: ClientRef): { label: string; value: string }[] => {
    if (!client) return []
    const kinds = Array.isArray(client.type) ? client.type.filter(Boolean) : []
    return [
        { label: 'Business model', value: String(client.businessModel || '').trim() },
        { label: 'Type', value: kinds.map(displayLabel).join(', ') },
        { label: 'Status', value: displayLabel(String(client.status || '').trim()) },
        { label: 'Address', value: String(client.clientAddress || '').trim() },
    ].filter((detail) => detail.value)
}

/* Users → client blocks. `keep` prunes each user's enrolments to the ones the
   reader actually asked for, so picking one client shows that client alone
   even for users who also belong elsewhere. */
function groupByClient(
    entries: Record<string, unknown>[],
    keep: { clients: Set<string>; services: Set<string>; models: Set<string> },
    index: ServiceIndexEntry[],
): ClientGroup[] {
    const groups = new Map<string, ClientGroup>()
    const resolveService = serviceResolver(index)

    ;(entries || []).forEach((entry) => {
        const role = entry.role as { renameRole?: string; originalRole?: string } | string | undefined
        const person = {
            user: text([entry.firstName, entry.lastName].filter(Boolean).join(' ')),
            email: text(entry.email),
            phone: text(entry.phone),
            role: text(typeof role === 'object' ? role?.renameRole || role?.originalRole : role),
            batch: text(entry.batch),
        }

        const matching = enrolmentsOf(entry).map((row) => (
            row.service ? row : { ...row, service: resolveService(row.clientKey, row.model) }
        )).filter((row) => (
            (!keep.clients.size || keep.clients.has(row.clientKey))
            && (!keep.services.size || keep.services.has(row.service))
            && (!keep.models.size || keep.models.has(row.model))
        ))

        matching.forEach((row) => {
            const existing = groups.get(row.clientKey)
            const group = existing || {
                key: row.clientKey,
                name: row.clientName || (row.clientKey === UNASSIGNED ? 'No client assigned' : 'Unnamed client'),
                details: clientDetails(row.client),
                users: [] as ReportUser[],
            }
            // A later row may carry the populated client where an earlier one
            // only had the denormalised name.
            if (!existing) groups.set(row.clientKey, group)
            else if (!group.details.length && row.client) group.details = clientDetails(row.client)

            group.users.push({
                ...person,
                service: row.service ? serviceLabel(row.service) : '—',
                model: row.model ? displayLabel(row.model) : '—',
            })
        })
    })

    const ordered = [...groups.values()].sort((a, b) => {
        // "No client assigned" is a residue bucket; it belongs last whatever
        // it sorts as alphabetically.
        if (a.key === UNASSIGNED) return 1
        if (b.key === UNASSIGNED) return -1
        return a.name.localeCompare(b.name)
    })
    ordered.forEach((group) => group.users.sort((a, b) => a.user.localeCompare(b.user)))
    return ordered
}

export default function UserReportDialog({ institutionId, token, baseParams, options, onClose }: {
    institutionId: string
    token: string
    baseParams: Omit<UsersPageParams, 'page' | 'limit'>
    options: Options
    onClose: () => void
}) {
    const [draft, setDraft] = useState<Draft>({ ...EMPTY })
    const [groups, setGroups] = useState<ClientGroup[] | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [exporting, setExporting] = useState<null | 'csv' | 'pdf' | 'print'>(null)
    const request = useRef<AbortController | null>(null)
    useEffect(() => () => request.current?.abort(), [])

    const chosen = Boolean(draft.roles.length || draft.clients.length || draft.services.length || draft.serviceModels.length)

    const run = useCallback(async (next: Draft) => {
        request.current?.abort()
        const controller = new AbortController()
        request.current = controller
        setLoading(true)
        setError('')
        try {
            const result = await fetchUsersForExport(institutionId, token, {
                ...baseParams,
                roles: next.roles.length ? next.roles : undefined,
                clients: next.clients.length ? next.clients : undefined,
                services: next.services.length ? next.services : undefined,
                serviceModels: next.serviceModels.length ? next.serviceModels : undefined,
                // The report never filters on account state — see the note above.
                status: undefined,
                statuses: undefined,
            })
            if (!controller.signal.aborted) {
                setGroups(groupByClient(result as Record<string, unknown>[], {
                    clients: new Set(next.clients),
                    services: new Set(next.services),
                    models: new Set(next.serviceModels),
                }, (result as { serviceIndex?: ServiceIndexEntry[] }).serviceIndex || []))
            }
        } catch (err) {
            if (!controller.signal.aborted) setError(err instanceof Error && err.message ? err.message : 'Could not build the report. Please retry.')
        } finally {
            if (!controller.signal.aborted) setLoading(false)
        }
    }, [baseParams, institutionId, token])

    // Nothing loads until a filter is set — opening onto every user in the
    // institution buries whoever the reader came for, and pulls the whole
    // directory across the wire to do it.
    useEffect(() => {
        if (!chosen) {
            request.current?.abort()
            setGroups(null)
            setError('')
            setLoading(false)
            return
        }
        const snapshot = { ...draft }
        const timer = setTimeout(() => { void run(snapshot) }, 350)
        return () => clearTimeout(timer)
    }, [draft, run, chosen])

    const criteria = useMemo(() => [
        draft.roles.length ? `Roles: ${draft.roles.map((id) => options.roles.find((o) => o.value === id)?.label || id).join(', ')}` : 'All roles',
        draft.clients.length ? `Clients: ${draft.clients.map((id) => options.clients.find((o) => o.value === id)?.label || id).join(', ')}` : 'All clients',
        draft.services.length ? `Services: ${draft.services.map(serviceLabel).join(', ')}` : 'All services',
        draft.serviceModels.length ? `Service models: ${draft.serviceModels.map(displayLabel).join(', ')}` : 'All service models',
    ].join(' | '), [draft, options])

    const totalUsers = useMemo(() => (groups || []).reduce((sum, group) => sum + group.users.length, 0), [groups])
    const canExport = Boolean(groups && totalUsers && !loading && !exporting)

    const detailLine = (group: ClientGroup) => group.details.map((d) => `${d.label}: ${d.value}`).join('  ·  ')

    const output = async (format: 'csv' | 'pdf' | 'print') => {
        if (!canExport || !groups) return
        setExporting(format)
        try {
            const stamp = new Date().toISOString().slice(0, 10)
            if (format === 'csv') {
                // Grouped the same way the screen is: the client, its details,
                // then a header and its users, then a blank line before the
                // next client. Opening this in Excel reads like the report.
                const lines: string[][] = []
                groups.forEach((group, index) => {
                    if (index) lines.push([])
                    lines.push([`${group.name} (${group.users.length} ${group.users.length === 1 ? 'user' : 'users'})`])
                    if (group.details.length) lines.push([detailLine(group)])
                    lines.push(HEADERS)
                    group.users.forEach((user) => lines.push(asCells(user)))
                })
                const csv = lines.map((line) => line.map((cell) => escapeCsv(String(cell))).join(',')).join('\r\n')
                const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
                const link = document.createElement('a')
                link.href = url
                link.download = `user-report-${stamp}.csv`
                document.body.appendChild(link)
                link.click()
                link.remove()
                setTimeout(() => URL.revokeObjectURL(url), 1000)
            } else if (format === 'print') {
                const popup = window.open('', '_blank')
                if (!popup) throw new Error('Allow pop-ups to open the print preview, then try again.')
                popup.opener = null
                const blocks = groups.map((group) => `
                    <section>
                      <div class="client">
                        <span class="cname">${escapeHtml(group.name)}</span>
                        <span class="ccount">${group.users.length} ${group.users.length === 1 ? 'user' : 'users'}</span>
                      </div>
                      ${group.details.length ? `<p class="cdetail">${escapeHtml(detailLine(group))}</p>` : ''}
                      <table><thead><tr>${HEADERS.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
                      <tbody>${group.users.map((user) => `<tr>${asCells(user).map((c) => `<td>${escapeHtml(String(c))}</td>`).join('')}</tr>`).join('')}</tbody></table>
                    </section>`).join('')
                popup.document.open()
                popup.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>User report</title><style>
                    @page{size:A4 landscape;margin:12mm}
                    body{font-family:Arial,Helvetica,sans-serif;color:#172033;margin:0;font-size:10px}
                    h1{font-size:18px;margin:0 0 6px}
                    p.criteria{color:#657084;margin:0 0 12px}
                    section{margin:0 0 16px;break-inside:avoid}
                    .client{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#344b63;color:#fff;padding:6px 8px;border:1px solid #344b63}
                    .cname{font-size:12px;font-weight:bold}
                    .ccount{font-size:10px}
                    p.cdetail{margin:0;padding:4px 8px;border:1px solid #a6b4c5;border-top:0;background:#eef3f8;color:#3c4a5e}
                    table{width:100%;border-collapse:collapse;table-layout:fixed}
                    thead{display:table-header-group}
                    th{background:#5a7690;color:#fff;text-align:left}
                    th,td{border:1px solid #a6b4c5;padding:5px 6px;overflow-wrap:anywhere;vertical-align:top}
                    tbody tr:nth-child(even){background:#f4f7fa}
                    tr{break-inside:avoid}
                    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
                    @media screen{body{padding:22px;max-width:1600px;margin:auto}}
                    </style></head><body><h1>User report</h1><p class="criteria">${escapeHtml(criteria)}</p>
                    ${blocks}</body></html>`)
                popup.document.close()
                popup.addEventListener('afterprint', () => popup.close(), { once: true })
                setTimeout(() => { if (!popup.closed) { popup.focus(); popup.print() } }, 250)
            } else {
                const [{ default: JsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
                const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
                const margin = 32
                const width = doc.internal.pageSize.getWidth()
                doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(23, 32, 51)
                doc.text('User report', margin, 42)
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(101, 112, 132)
                const lines: string[] = doc.splitTextToSize(criteria, width - margin * 2)
                doc.text(lines, margin, 58)

                // One table, with each client announced by a full-width banner
                // row above its users. A table per client would restart the
                // column widths — and so the alignment — for every block.
                const body: unknown[][] = []
                groups.forEach((group) => {
                    body.push([{
                        content: `${group.name}   (${group.users.length} ${group.users.length === 1 ? 'user' : 'users'})`,
                        colSpan: HEADERS.length,
                        styles: { fillColor: [52, 75, 99], textColor: 255, fontStyle: 'bold', fontSize: 9.5 },
                    }])
                    if (group.details.length) {
                        body.push([{
                            content: detailLine(group),
                            colSpan: HEADERS.length,
                            styles: { fillColor: [238, 243, 248], textColor: [60, 74, 94], fontSize: 7.5 },
                        }])
                    }
                    group.users.forEach((user) => body.push(asCells(user)))
                })

                autoTable(doc, {
                    startY: 58 + lines.length * 12 + 8,
                    head: [HEADERS],
                    body: body as never,
                    margin: { top: margin, left: margin, right: margin, bottom: margin + 14 },
                    styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, overflow: 'linebreak', valign: 'middle', lineColor: [166, 180, 197], lineWidth: 0.4 },
                    headStyles: { fillColor: [90, 118, 144], textColor: 255, fontStyle: 'bold' },
                    showHead: 'everyPage',
                    rowPageBreak: 'auto',
                })
                doc.save(`user-report-${stamp}.pdf`)
            }
        } catch (err) {
            setError(err instanceof Error && err.message ? err.message : 'Export failed. Please try again.')
        } finally {
            setExporting(null)
        }
    }

    return <Dialog open onOpenChange={(open) => { if (!open && !exporting) onClose() }}>
        <DialogContent showCloseButton={!exporting} className="flex h-[94dvh] max-h-[94dvh] w-[98vw] max-w-[1600px] flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 gap-3 border-b border-hairline py-3 pl-4 pr-12 text-left sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <DialogTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-4 shrink-0 text-brand-strong" />User report</DialogTitle>
                    <DialogDescription className="mt-1 text-xs">Filter the directory by role, client, service and service model.</DialogDescription>
                </div>
                <div role="group" aria-label="Export report" className="flex shrink-0 items-center gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="text-xs" disabled={!canExport} onClick={() => output('csv')}>{exporting === 'csv' ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}Excel</Button>
                    <Button type="button" variant="outline" size="sm" className="text-xs" disabled={!canExport} onClick={() => output('pdf')}>{exporting === 'pdf' ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}PDF</Button>
                    <Button type="button" size="sm" className="text-xs" disabled={!canExport} onClick={() => output('print')}>{exporting === 'print' ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}Print</Button>
                </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 overflow-y-auto">
                <fieldset disabled={Boolean(exporting)} className="min-w-0 border-b border-hairline bg-canvas/40 px-4 py-3">
                    <legend className="sr-only">Report filters</legend>
                    <div className="grid items-end gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Role</p><MappingMultiFilter label="Roles" options={options.roles} value={draft.roles} onChange={(roles) => setDraft({ ...draft, roles })} placeholder="Select role" /></div>
                        <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Client</p><MappingMultiFilter label="Clients" options={options.clients} value={draft.clients} onChange={(clients) => setDraft({ ...draft, clients })} placeholder="Select client" /></div>
                        <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Service</p><MappingMultiFilter label="Services" options={options.services} value={draft.services} onChange={(services) => setDraft({ ...draft, services })} placeholder="Select service" /></div>
                        <div className="min-w-0"><p className="mb-1 text-xs font-medium text-subtle">Service model</p><MappingMultiFilter label="Service models" options={options.serviceModels} value={draft.serviceModels} onChange={(serviceModels) => setDraft({ ...draft, serviceModels })} placeholder="Select service model" /></div>
                        <div className="flex items-center justify-end gap-2">
                            {loading && <span role="status" className="flex items-center gap-1.5 whitespace-nowrap text-xs text-subtle"><Loader2 className="size-3.5 animate-spin" />Updating…</span>}
                            <Button variant="ghost" size="sm" className="size-8 p-0 has-[>svg]:px-0" aria-label="Reset all filters" title="Reset all filters" disabled={!chosen || Boolean(exporting)} onClick={() => setDraft({ ...EMPTY })}><RotateCcw className="size-3.5" /></Button>
                        </div>
                    </div>
                </fieldset>

                <div className="p-4">
                    {error && <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-danger-500/30 bg-danger-50 p-3 text-sm text-danger-700">{error}<Button variant="outline" size="sm" className="text-xs" onClick={() => run(draft)}>Retry</Button></div>}

                    {!groups && !loading && !error && <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-hairline p-5 text-center">
                        <UsersIcon className="mb-2 size-7 text-brand-strong" />
                        <h2 className="text-sm font-semibold text-heading">Choose what to report on</h2>
                        <p className="mt-1.5 max-w-md text-xs leading-5 text-subtle">Pick a role or a client above and the matching users appear here, grouped under the client they belong to. Service and service model narrow it further.</p>
                    </div>}

                    {loading && !groups && <div role="status" aria-label="Building report" className="space-y-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-ink-100" />)}</div>}

                    {groups && <>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <div className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-canvas/40 px-2.5"><span className="text-xs text-subtle">Clients</span><span className="text-sm font-semibold tabular-nums text-heading">{groups.length.toLocaleString()}</span></div>
                            <div className="flex h-8 items-center gap-2 rounded-lg border border-hairline bg-canvas/40 px-2.5"><span className="text-xs text-subtle">Users</span><span className="text-sm font-semibold tabular-nums text-heading">{totalUsers.toLocaleString()}</span></div>
                            <p className="min-w-0 basis-full truncate text-xs text-subtle sm:ml-1 sm:flex-1" title={criteria}>{criteria}</p>
                        </div>
                        {!groups.length
                            ? <p className="rounded-xl border border-dashed border-hairline py-12 text-center text-sm text-subtle">Nothing matches this combination. Try fewer filters.</p>
                            : <div className={`space-y-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
                                {groups.map((group) => <section key={group.key} className="overflow-hidden rounded-lg border border-hairline bg-white">
                                    <header className="flex flex-wrap items-center justify-between gap-2 bg-[#344b63] px-3 py-2 text-white">
                                        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                                            <Building2 className="size-4 shrink-0 opacity-80" />
                                            <span className="truncate">{group.name}</span>
                                        </h3>
                                        <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-medium tabular-nums">
                                            {group.users.length.toLocaleString()} {group.users.length === 1 ? 'user' : 'users'}
                                        </span>
                                    </header>
                                    {group.details.length > 0 && <dl className="flex flex-wrap gap-x-5 gap-y-1 border-b border-hairline bg-[#eef3f8] px-3 py-2 text-[11px]">
                                        {group.details.map((detail) => <div key={detail.label} className="flex min-w-0 items-baseline gap-1.5">
                                            <dt className="shrink-0 font-medium text-subtle">{detail.label}</dt>
                                            <dd className="min-w-0 truncate text-heading">{detail.value}</dd>
                                        </div>)}
                                    </dl>}
                                    <div className="max-w-full overflow-x-auto">
                                        <table className="w-full border-collapse text-xs">
                                            <thead><tr>{HEADERS.map((header) => <th key={header} className="border border-hairline bg-[#5a7690] px-2.5 py-2 text-left font-semibold text-white">{header}</th>)}</tr></thead>
                                            <tbody>{group.users.map((user, index) => <tr key={`${group.key}-${index}`} className="even:bg-canvas/40">
                                                {asCells(user).map((cell, column) => <td key={column} className="border border-hairline px-2.5 py-2 align-top text-body">{cell}</td>)}
                                            </tr>)}</tbody>
                                        </table>
                                    </div>
                                </section>)}
                            </div>}
                    </>}
                </div>
            </div>
        </DialogContent>
    </Dialog>
}
